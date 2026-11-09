/**
 * Minimal Pine Script® v6 subset compiler.
 *
 * Parses `indicator()` scripts with single-line statements and compiles them
 * into real indicator definitions backed by the same math as the built-ins:
 * `ta.ema/sma/wma/rma/rsi/vwma`, `ta.crossover/crossunder`, `nz`, `math.*`,
 * arithmetic, comparisons, `plot()` and `hline()`. Anything outside the
 * subset fails with a line-numbered error instead of silently doing nothing.
 */
import {
  COLORS,
  level,
  linePlot,
} from "../technical/indicator-catalog-builders";
import {
  type IndicatorDefinition,
  type IndicatorLevel,
  type IndicatorPlot,
} from "../technical/indicator-schema";
import { movingAverageByMethod } from "../technical/indicators-research";
import { relativeStrengthIndex } from "../technical/indicators";
import type { Candle, NullableNumber } from "../technical/types";

/* ------------------------------------------------------------------------ */
/* Values                                                                   */
/* ------------------------------------------------------------------------ */

type SeriesValue = { readonly kind: "series"; readonly data: NullableNumber[] };
type BoolSeriesValue = {
  readonly kind: "boolseries";
  readonly data: readonly (boolean | null)[];
};
type ScalarValue =
  | { readonly kind: "num"; readonly value: number }
  | { readonly kind: "str"; readonly value: string }
  | { readonly kind: "bool"; readonly value: boolean };

type Value = SeriesValue | BoolSeriesValue | ScalarValue;

const num = (value: number): ScalarValue => ({ kind: "num", value });
const str = (value: string): ScalarValue => ({ kind: "str", value });
const boolean = (value: boolean): ScalarValue => ({ kind: "bool", value });
const series = (data: NullableNumber[]): SeriesValue => ({ kind: "series", data });
const boolSeries = (data: readonly (boolean | null)[]): BoolSeriesValue => ({
  kind: "boolseries",
  data,
});

function isSeries(value: Value): value is SeriesValue {
  return value.kind === "series";
}

function toNumberArray(data: readonly NullableNumber[]): number[] {
  return data.map((value) => value ?? Number.NaN);
}

function broadcast(
  left: Value,
  right: Value,
  apply: (a: number | null, b: number | null) => number | null,
  length: number,
): NullableNumber[] {
  const pick = (value: Value, index: number): number | null => {
    if (value.kind === "num") return value.value;
    if (value.kind === "series") return value.data[index] ?? null;
    return null;
  };
  return Array.from({ length }, (_, index) =>
    apply(pick(left, index), pick(right, index)),
  );
}

function broadcastBool(
  left: Value,
  right: Value,
  apply: (a: number | null, b: number | null) => boolean | null,
  length: number,
): (boolean | null)[] {
  const pick = (value: Value, index: number): number | null => {
    if (value.kind === "num") return value.value;
    if (value.kind === "series") return value.data[index] ?? null;
    return null;
  };
  return Array.from({ length }, (_, index) =>
    apply(pick(left, index), pick(right, index)),
  );
}

/* ------------------------------------------------------------------------ */
/* Tokenizer + parser (expressions only)                                    */
/* ------------------------------------------------------------------------ */

type Token =
  | { readonly kind: "num"; readonly value: number }
  | { readonly kind: "str"; readonly value: string }
  | { readonly kind: "ident"; readonly value: string }
  | { readonly kind: "op"; readonly value: string }
  | { readonly kind: "lparen" }
  | { readonly kind: "rparen" }
  | { readonly kind: "comma" }
  | { readonly kind: "eof" };

function tokenize(input: string, line: number): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const fail = (message: string): never => {
    throw new PineError(line, message);
  };
  while (index < input.length) {
    const char = input[index]!;
    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ kind: "lparen" });
      index += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ kind: "rparen" });
      index += 1;
      continue;
    }
    if (char === ",") {
      tokens.push({ kind: "comma" });
      index += 1;
      continue;
    }
    if (char === '"') {
      let text = "";
      index += 1;
      while (index < input.length && input[index] !== '"') {
        text += input[index];
        index += 1;
      }
      if (index >= input.length) fail("unterminated string");
      index += 1;
      tokens.push({ kind: "str", value: text });
      continue;
    }
    const two = input.slice(index, index + 2);
    if (["==", "!=", ">=", "<="].includes(two)) {
      tokens.push({ kind: "op", value: two });
      index += 2;
      continue;
    }
    if ("+-*/><".includes(char)) {
      tokens.push({ kind: "op", value: char });
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const match = /^[0-9]*\.?[0-9]+/.exec(input.slice(index));
      if (!match) throw new PineError(line, `bad number near '${char}'`);
      const text = match[0];
      tokens.push({ kind: "num", value: Number(text) });
      index += text.length;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(input.slice(index));
      if (!match) throw new PineError(line, `bad name near '${char}'`);
      const head = match[0];
      tokens.push({ kind: "ident", value: head });
      index += head.length;
      if (input[index] === ".") {
        // Dotted path (ta.ema, color.lime): keep as one identifier.
        let path = head;
        while (input[index] === ".") {
          index += 1;
          const part = /^[A-Za-z_][A-Za-z0-9_]*/.exec(input.slice(index));
          if (!part) throw new PineError(line, "expected a name after '.'");
          const tail = part[0];
          path += `.${tail}`;
          index += tail.length;
        }
        tokens[tokens.length - 1] = { kind: "ident", value: path };
      }
      continue;
    }
    fail(`unexpected character '${char}'`);
  }
  tokens.push({ kind: "eof" });
  return tokens;
}

type Expr =
  | { readonly kind: "lit"; readonly value: ScalarValue }
  | { readonly kind: "ref"; readonly name: string }
  | { readonly kind: "unary"; readonly op: "-" | "not"; readonly expr: Expr }
  | {
      readonly kind: "binary";
      readonly op: string;
      readonly left: Expr;
      readonly right: Expr;
    }
  | { readonly kind: "call"; readonly name: string; readonly args: Expr[] };

class Parser {
  private position = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly line: number,
  ) {}

  private peek(): Token {
    return this.tokens[this.position]!;
  }

  private next(): Token {
    const token = this.tokens[this.position]!;
    this.position += 1;
    return token;
  }

  private fail(message: string): never {
    throw new PineError(this.line, message);
  }

  parse(): Expr {
    const expr = this.parseOr();
    if (this.peek().kind !== "eof") this.fail("unexpected text after expression");
    return expr;
  }

  private parseOr(): Expr {
    let expr = this.parseAnd();
    for (;;) {
      const token = this.peek();
      if (token.kind === "ident" && token.value === "or") {
        this.next();
        expr = { kind: "binary", op: "or", left: expr, right: this.parseAnd() };
      } else return expr;
    }
  }

  private parseAnd(): Expr {
    let expr = this.parseComparison();
    for (;;) {
      const token = this.peek();
      if (token.kind === "ident" && token.value === "and") {
        this.next();
        expr = {
          kind: "binary",
          op: "and",
          left: expr,
          right: this.parseComparison(),
        };
      } else return expr;
    }
  }

  private parseComparison(): Expr {
    let expr = this.parseAdd();
    for (;;) {
      const token = this.peek();
      if (
        token.kind === "op" &&
        ["==", "!=", ">", "<", ">=", "<="].includes(token.value)
      ) {
        this.next();
        expr = {
          kind: "binary",
          op: token.value,
          left: expr,
          right: this.parseAdd(),
        };
      } else return expr;
    }
  }

  private parseAdd(): Expr {
    let expr = this.parseMul();
    for (;;) {
      const token = this.peek();
      if (token.kind === "op" && (token.value === "+" || token.value === "-")) {
        this.next();
        expr = {
          kind: "binary",
          op: token.value,
          left: expr,
          right: this.parseMul(),
        };
      } else return expr;
    }
  }

  private parseMul(): Expr {
    let expr = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (token.kind === "op" && (token.value === "*" || token.value === "/")) {
        this.next();
        expr = {
          kind: "binary",
          op: token.value,
          left: expr,
          right: this.parseUnary(),
        };
      } else return expr;
    }
  }

  private parseUnary(): Expr {
    const token = this.peek();
    if (token.kind === "op" && token.value === "-") {
      this.next();
      return { kind: "unary", op: "-", expr: this.parseUnary() };
    }
    if (token.kind === "ident" && token.value === "not") {
      this.next();
      return { kind: "unary", op: "not", expr: this.parseUnary() };
    }
    if (token.kind === "ident" && token.value === "na") {
      this.next();
      const open = this.next();
      if (open.kind !== "lparen") this.fail("expected '(' after na");
      const inner = this.parseOr();
      const close = this.next();
      if (close.kind !== "rparen") this.fail("expected ')'");
      void inner;
      return { kind: "lit", value: boolean(false) };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const token = this.next();
    if (token.kind === "num") return { kind: "lit", value: num(token.value) };
    if (token.kind === "str") return { kind: "lit", value: str(token.value) };
    if (token.kind === "ident" && (token.value === "true" || token.value === "false")) {
      return { kind: "lit", value: boolean(token.value === "true") };
    }
    if (token.kind === "ident") {
      if (this.peek().kind === "lparen") {
        this.next();
        const args = this.parseArgs(token.value);
        return { kind: "call", name: token.value, args };
      }
      return { kind: "ref", name: token.value };
    }
    if (token.kind === "lparen") {
      const expr = this.parseOr();
      const close = this.next();
      if (close.kind !== "rparen") this.fail("expected ')'");
      return expr;
    }
    this.fail("expected a value");
  }

  private parseArgs(name: string): Expr[] {
    void name;
    const args: Expr[] = [];
    if (this.peek().kind === "rparen") {
      this.next();
      return args;
    }
    for (;;) {
      // Named argument key=value: fold the key away, keep the value.
      const snapshot = this.position;
      const maybeKey = this.peek();
      if (maybeKey.kind === "ident") {
        this.next();
        const eq = this.peek();
        if (eq.kind === "op" && eq.value === "=") {
          this.next();
          args.push(this.parseOr());
        } else {
          this.position = snapshot;
          args.push(this.parseOr());
        }
      } else {
        args.push(this.parseOr());
      }
      const next = this.next();
      if (next.kind === "rparen") return args;
      if (next.kind !== "comma") this.fail("expected ',' between arguments");
    }
  }
}

export class PineError extends Error {
  readonly line: number;
  constructor(line: number, message: string) {
    super(line > 0 ? `Line ${line}: ${message}` : message);
    this.name = "PineError";
    this.line = line;
  }
}

const SUPPORTED_CALLS: ReadonlySet<string> = new Set([
  "ta.ema",
  "ta.sma",
  "ta.wma",
  "ta.rma",
  "ta.vwma",
  "ta.rsi",
  "ta.crossover",
  "ta.crossunder",
  "nz",
  "na",
  "math.max",
  "math.min",
  "math.abs",
  "input.int",
  "input.float",
  "input.bool",
  "input.string",
  "input.source",
  "input.color",
  "input.timeframe",
]);

/** A plot of one of these can never draw as a line. */
function isBooleanExpr(expr: Expr, boolVars: ReadonlyMap<string, boolean>): boolean {
  switch (expr.kind) {
    case "lit":
      return expr.value.kind === "bool";
    case "ref":
      return boolVars.get(expr.name) ?? false;
    case "unary":
      return expr.op === "not";
    case "binary":
      return (
        expr.op === "and" ||
        expr.op === "or" ||
        ["==", "!=", ">", "<", ">=", "<="].includes(expr.op)
      );
    case "call":
      return expr.name === "ta.crossover" || expr.name === "ta.crossunder";
  }
}

/** Fail fast on unknown functions so errors carry line numbers. */
function validateCalls(expr: Expr, line: number): void {
  const visit = (node: Expr): void => {
    if (node.kind === "call") {
      if (!SUPPORTED_CALLS.has(node.name)) {
        throw new PineError(
          line,
          `'${node.name}' is not supported (supported: ta.ema/sma/wma/rma/rsi/vwma/crossover/crossunder, nz, math.max/min/abs, plot, hline)`,
        );
      }
      for (const arg of node.args) visit(arg);
    } else if (node.kind === "unary") {
      visit(node.expr);
    } else if (node.kind === "binary") {
      visit(node.left);
      visit(node.right);
    }
  };
  visit(expr);
}

/* ------------------------------------------------------------------------ */
/* Colors                                                                   */
/* ------------------------------------------------------------------------ */

const PINE_COLORS: Readonly<Record<string, string>> = {
  "color.aqua": "#00BCD4",
  "color.black": "#000000",
  "color.blue": "#2962FF",
  "color.fuchsia": "#E040FB",
  "color.gray": "#787B86",
  "color.green": "#4CAF50",
  "color.lime": "#00C853",
  "color.maroon": "#880E4F",
  "color.navy": "#000080",
  "color.olive": "#808000",
  "color.orange": "#FF9800",
  "color.purple": "#9C27B0",
  "color.red": "#FF5252",
  "color.silver": "#B2B5BE",
  "color.teal": "#009688",
  "color.white": "#FFFFFF",
  "color.yellow": "#FFEB3B",
};

function normalizeColor(value: string, line: number): string {
  if (PINE_COLORS[value]) return PINE_COLORS[value]!;
  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value.trim());
  if (!hex) throw new PineError(line, `unsupported color '${value}'`);
  const digits = hex[1]!;
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits;
  return `#${full.toUpperCase()}`;
}

/* ------------------------------------------------------------------------ */
/* Evaluator                                                                */
/* ------------------------------------------------------------------------ */

interface EvalContext {
  readonly candles: readonly Candle[];
  readonly env: Map<string, Value>;
  readonly warnings: string[];
  readonly warned: Set<string>;
  usesVolume: boolean;
}

function warnOnce(context: EvalContext, message: string): void {
  if (context.warned.has(message)) return;
  context.warned.add(message);
  context.warnings.push(message);
}

function sourcesOf(context: EvalContext): Map<string, NullableNumber[]> {
  const candles = context.candles;
  return new Map<string, NullableNumber[]>([
    ["open", candles.map((candle) => candle.open)],
    ["high", candles.map((candle) => candle.high)],
    ["low", candles.map((candle) => candle.low)],
    ["close", candles.map((candle) => candle.close)],
    ["hl2", candles.map((candle) => (candle.high + candle.low) / 2)],
    [
      "hlc3",
      candles.map((candle) => (candle.high + candle.low + candle.close) / 3),
    ],
    [
      "ohlc4",
      candles.map(
        (candle) => (candle.open + candle.high + candle.low + candle.close) / 4,
      ),
    ],
    ["volume", candles.map((candle) => candle.volume ?? null)],
  ]);
}

function seriesLength(context: EvalContext): number {
  return context.candles.length;
}

function asNumber(value: Value, line: number, what: string): number {
  if (value.kind === "num") return value.value;
  throw new PineError(line, `${what} must be a number`);
}

function crossover(
  left: NullableNumber[],
  right: NullableNumber,
  length: number,
): (boolean | null)[];
function crossover(
  left: NullableNumber[],
  right: NullableNumber[],
  length: number,
): (boolean | null)[];
function crossover(
  left: NullableNumber[],
  right: NullableNumber[] | NullableNumber,
  length: number,
): (boolean | null)[] {
  const pick = (index: number): number | null =>
    Array.isArray(right) ? (right[index] ?? null) : right;
  const result: (boolean | null)[] = [];
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? null;
    const b = pick(index);
    const prevA = index > 0 ? (left[index - 1] ?? null) : null;
    const prevB = index > 0 ? (Array.isArray(right) ? (right[index - 1] ?? null) : right) : null;
    if (a === null || b === null || prevA === null || prevB === null) {
      result.push(null);
    } else {
      result.push(prevA <= prevB && a > b);
    }
  }
  return result;
}

function evaluate(expr: Expr, context: EvalContext, line: number): Value {
  const length = seriesLength(context);
  switch (expr.kind) {
    case "lit":
      return expr.value;
    case "ref": {
      if (PINE_COLORS[expr.name]) return str(PINE_COLORS[expr.name]!);
      const sources = sourcesOf(context);
      if (sources.has(expr.name)) {
        if (expr.name === "volume") context.usesVolume = true;
        return series(sources.get(expr.name)!);
      }
      const stored = context.env.get(expr.name);
      if (!stored) throw new PineError(line, `unknown name '${expr.name}'`);
      return stored;
    }
    case "unary": {
      const inner = evaluate(expr.expr, context, line);
      if (expr.op === "not") {
        if (inner.kind === "bool") return boolean(!inner.value);
        if (inner.kind === "boolseries") {
          return boolSeries(
            inner.data.map((value) => (value === null ? null : !value)),
          );
        }
        throw new PineError(line, "not needs true/false");
      }
      if (inner.kind === "num") return num(-inner.value);
      if (inner.kind === "series") {
        return series(inner.data.map((value) => (value === null ? null : -value)));
      }
      throw new PineError(line, "cannot negate that value");
    }
    case "binary": {
      const left = evaluate(expr.left, context, line);
      const right = evaluate(expr.right, context, line);
      if (expr.op === "and" || expr.op === "or") {
        const combine = (a: boolean | null, b: boolean | null): boolean | null => {
          if (a === null || b === null) return null;
          return expr.op === "and" ? a && b : a || b;
        };
        if (left.kind === "bool" && right.kind === "bool") {
          return boolean(combine(left.value, right.value) ?? false);
        }
        const pick = (value: Value, index: number): boolean | null => {
          if (value.kind === "bool") return value.value;
          if (value.kind === "boolseries") return value.data[index] ?? null;
          throw new PineError(line, "and/or need true/false");
        };
        if (
          (left.kind === "bool" || left.kind === "boolseries") &&
          (right.kind === "bool" || right.kind === "boolseries")
        ) {
          return boolSeries(
            Array.from({ length }, (_, index) =>
              combine(pick(left, index), pick(right, index)),
            ),
          );
        }
        throw new PineError(line, "and/or need true/false");
      }
      const apply = (a: number | null, b: number | null): number | null => {
        if (a === null || b === null) return null;
        switch (expr.op) {
          case "+":
            return a + b;
          case "-":
            return a - b;
          case "*":
            return a * b;
          case "/":
            return b === 0 ? null : a / b;
          default:
            return null;
        }
      };
      const compare = (a: number | null, b: number | null): boolean | null => {
        if (a === null || b === null) return null;
        switch (expr.op) {
          case "==":
            return a === b;
          case "!=":
            return a !== b;
          case ">":
            return a > b;
          case "<":
            return a < b;
          case ">=":
            return a >= b;
          case "<=":
            return a <= b;
          default:
            return null;
        }
      };
      const numeric =
        left.kind === "num" || left.kind === "series";
      const numericRight =
        right.kind === "num" || right.kind === "series";
      if (!numeric || !numericRight) {
        throw new PineError(line, `cannot apply '${expr.op}' here`);
      }
      if (["==", "!=", ">", "<", ">=", "<="].includes(expr.op)) {
        if (left.kind === "num" && right.kind === "num") {
          return boolean(compare(left.value, right.value) ?? false);
        }
        return boolSeries(broadcastBool(left, right, compare, length));
      }
      if (left.kind === "num" && right.kind === "num") {
        return num(apply(left.value, right.value) ?? Number.NaN);
      }
      return series(broadcast(left, right, apply, length));
    }
    case "call":
      return evaluateCall(expr.name, expr.args, context, line);
  }
}

function evaluateCall(
  name: string,
  args: Expr[],
  context: EvalContext,
  line: number,
): Value {
  const values = args.map((arg) => evaluate(arg, context, line));
  const length = seriesLength(context);
  switch (name) {
    case "ta.ema":
    case "ta.sma":
    case "ta.wma":
    case "ta.rma": {
      const [source, period] = values;
      if (!source || !period) throw new PineError(line, `${name} needs (source, length)`);
      const data = isSeries(source)
        ? toNumberArray(source.data)
        : (() => {
            throw new PineError(line, `${name} needs a series`);
          })();
      return series(
        movingAverageByMethod(
          data,
          name.slice(3),
          Math.max(1, Math.round(asNumber(period, line, "length"))),
        ),
      );
    }
    case "ta.vwma": {
      const [source, period] = values;
      if (!source || !period) throw new PineError(line, "ta.vwma needs (source, length)");
      if (!isSeries(source)) throw new PineError(line, "ta.vwma needs a series");
      context.usesVolume = true;
      const window = Math.max(1, Math.round(asNumber(period, line, "length")));
      const prices = source.data;
      const volumes = context.candles.map((candle) => candle.volume ?? null);
      return series(
        Array.from({ length }, (_, index) => {
          let priceVolume = 0;
          let volume = 0;
          for (let back = Math.max(0, index - window + 1); back <= index; back += 1) {
            const price = prices[back] ?? null;
            const vol = volumes[back] ?? null;
            if (price === null || vol === null) return null;
            priceVolume += price * vol;
            volume += vol;
          }
          return volume === 0 ? null : priceVolume / volume;
        }),
      );
    }
    case "ta.rsi": {
      const [source, period] = values;
      if (!source || !period) throw new PineError(line, "ta.rsi needs (source, length)");
      if (!isSeries(source)) throw new PineError(line, "ta.rsi needs a series");
      return series(
        relativeStrengthIndex(
          toNumberArray(source.data),
          Math.max(1, Math.round(asNumber(period, line, "length"))),
        ),
      );
    }
    case "ta.crossover":
    case "ta.crossunder": {
      const [left, right] = values;
      if (!left || !right) throw new PineError(line, `${name} needs two series`);
      const leftData = isSeries(left)
        ? [...left.data]
        : Array.from({ length }, () => (left.kind === "num" ? left.value : null));
      if (left.kind !== "series" && left.kind !== "num") {
        throw new PineError(line, `${name} needs a series`);
      }
      const crossed =
        right.kind === "series"
          ? crossover(leftData, [...right.data], length)
          : right.kind === "num"
            ? crossover(leftData, right.value, length)
            : (() => {
                throw new PineError(line, `${name} needs a series`);
              })();
      if (name === "ta.crossunder") {
        // crossunder(a, b) === crossover(b, a)
        const rightData =
          right.kind === "series"
            ? [...right.data]
            : Array.from({ length }, () => (right as { value: number }).value);
        return boolSeries(crossover(rightData, leftData, length));
      }
      return boolSeries(crossed);
    }
    case "nz": {
      const [source, replacement] = values;
      if (!source) throw new PineError(line, "nz needs a value");
      const fill = replacement ? asNumber(replacement, line, "replacement") : 0;
      if (isSeries(source)) {
        return series(source.data.map((value) => value ?? fill));
      }
      if (source.kind === "num") {
        return num(Number.isFinite(source.value) ? source.value : fill);
      }
      throw new PineError(line, "nz needs a number or series");
    }
    case "math.max":
    case "math.min": {
      const [first, second] = values;
      if (!first || !second) throw new PineError(line, `${name} needs two values`);
      const pick = name === "math.max" ? Math.max : Math.min;
      if (first.kind === "num" && second.kind === "num") {
        return num(pick(first.value, second.value));
      }
      if (
        (first.kind === "num" || isSeries(first)) &&
        (second.kind === "num" || isSeries(second))
      ) {
        return series(
          broadcast(
            first,
            second,
            (a, b) => (a === null || b === null ? null : pick(a, b)),
            length,
          ),
        );
      }
      throw new PineError(line, `${name} needs numbers`);
    }
    case "math.abs": {
      const [only] = values;
      if (!only) throw new PineError(line, "math.abs needs a value");
      if (only.kind === "num") return num(Math.abs(only.value));
      if (isSeries(only)) {
        return series(only.data.map((value) => (value === null ? null : Math.abs(value))));
      }
      throw new PineError(line, "math.abs needs a number");
    }
    case "input.int":
    case "input.float":
    case "input.bool":
    case "input.string":
    case "input.source":
    case "input.color":
    case "input.timeframe": {
      warnOnce(
        context,
        "input() controls use their default values; edit the script to change them.",
      );
      if (values.length === 0) throw new PineError(line, `${name} needs a default`);
      return values[0]!;
    }
    default:
      throw new PineError(
        line,
        `'${name}' is not supported (supported: ta.ema/sma/wma/rma/rsi/vwma/crossover/crossunder, nz, math.max/min/abs, plot, hline)`,
      );
  }
}

/* ------------------------------------------------------------------------ */
/* Statements                                                               */
/* ------------------------------------------------------------------------ */

interface PlotSpec {
  readonly expr: Expr;
  readonly title: string;
  readonly color: string;
  readonly lineWidth: number;
  readonly line: number;
}

interface LevelSpec {
  readonly price: number;
  readonly title: string;
  readonly color: string;
  readonly lineWidth: number;
  readonly lineStyle: "solid" | "dashed" | "dotted";
}

interface CompiledBody {
  readonly title: string;
  readonly overlay: boolean;
  readonly precision: number;
  readonly assigns: { readonly name: string; readonly expr: Expr; readonly line: number }[];
  readonly plots: PlotSpec[];
  readonly levels: LevelSpec[];
  readonly warnings: string[];
  readonly usesVolume: boolean;
}

function stripComment(line: string): string {
  let inString = false;
  for (let index = 0; index < line.length - 1; index += 1) {
    if (line[index] === '"') inString = !inString;
    if (!inString && line[index] === "/" && line[index + 1] === "/") {
      return line.slice(0, index);
    }
  }
  return line;
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let current = "";
  for (const char of input) {
    if (char === '"') inString = !inString;
    if (!inString) {
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (char === "," && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

function parseNamedArgs(
  rawArgs: string[],
  line: number,
): { positional: string[]; named: Map<string, string> } {
  const positional: string[] = [];
  const named = new Map<string, string>();
  for (const part of rawArgs) {
    const eq = part.indexOf("=");
    if (
      eq > 0 &&
      part[eq + 1] !== "=" &&
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(part.slice(0, eq).trim())
    ) {
      named.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
    } else {
      positional.push(part.trim());
    }
  }
  void line;
  return { positional, named };
}

function parseLiteral(value: string, line: number): ScalarValue {
  const text = value.trim();
  if (text === "true") return boolean(true);
  if (text === "false") return boolean(false);
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    return str(text.slice(1, -1));
  }
  const numeric = Number(text);
  if (text !== "" && Number.isFinite(numeric)) return num(numeric);
  throw new PineError(line, `cannot use '${text}' here`);
}

function compileBody(name: string, code: string): CompiledBody {
  const warnings: string[] = [];
  const warned = new Set<string>();
  const context: EvalContext = {
    candles: [],
    env: new Map(),
    warnings,
    warned,
    usesVolume: false,
  };
  let title = name;
  let overlay = false;
  let precision = 2;
  let sawIndicator = false;
  // Numeric constants (literals and input.* defaults) for hline() prices.
  const constVals = new Map<string, number>();
  const tryConst = (expr: Expr, atLine: number): number | null => {
    try {
      const env = new Map<string, Value>(
        [...constVals.entries()].map(([key, value]) => [key, num(value)]),
      );
      const probe: EvalContext = {
        candles: [],
        env,
        warnings: [],
        warned: new Set(),
        usesVolume: false,
      };
      const value = evaluate(expr, probe, atLine);
      return value.kind === "num" && Number.isFinite(value.value)
        ? value.value
        : null;
    } catch {
      return null;
    }
  };
  const assigns: CompiledBody["assigns"] = [];
  const plots: PlotSpec[] = [];
  const levels: LevelSpec[] = [];

  const rawLines = code.split("\n");
  rawLines.forEach((raw, index) => {
    const line = index + 1;
    const text = stripComment(raw).trim();
    if (!text) return;
    if (text.startsWith("//@version")) return;

    const call = /^([A-Za-z_][A-Za-z0-9_.]*)\s*\((.*)\)\s*$/.exec(text);
    if (call) {
      const callee = call[1]!;
      const argText = call[2] ?? "";
      if (callee === "strategy") {
        throw new PineError(
          line,
          "strategy() scripts are not supported — use indicator() with plot() calls",
        );
      }
      if (callee === "indicator") {
        sawIndicator = true;
        const { positional, named } = parseNamedArgs(splitTopLevel(argText), line);
        const titleText = named.get("title") ?? positional[0];
        if (titleText) {
          const parsed = parseLiteral(titleText, line);
          title = parsed.kind === "str" && parsed.value ? parsed.value : name;
        }
        const overlayText = named.get("overlay") ?? "";
        if (overlayText.trim() === "true") overlay = true;
        const precisionText = named.get("precision");
        if (precisionText !== undefined) {
          const parsed = Number(precisionText);
          if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 8) {
            precision = parsed;
          }
        }
        if (named.has("timeframe")) {
          warnOnce(context, "timeframe is ignored; the chart timeframe is used.");
        }
        return;
      }
      if (callee === "plot") {
        const { positional, named } = parseNamedArgs(splitTopLevel(argText), line);
        const seriesText = positional[0];
        if (!seriesText) throw new PineError(line, "plot needs a series");
        const expr = new Parser(tokenize(seriesText, line), line).parse();
        validateCalls(expr, line);
        const titleText = named.get("title");
        const titleValue = titleText ? parseLiteral(titleText, line) : undefined;
        if (titleValue && titleValue.kind !== "str") {
          throw new PineError(line, "plot title must be text");
        }
        const colorText = named.get("color");
        const widthText = named.get("linewidth");
        const width = widthText ? Number(widthText) : 1;
        if (named.has("style")) {
          warnOnce(context, "plot styles render as lines.");
        }
        plots.push({
          expr,
          title:
            (titleValue as { value: string } | undefined)?.value ??
            `Plot ${plots.length + 1}`,
          color: colorText ? normalizeColor(parseColorLiteral(colorText, line), line) : COLORS.blue,
          lineWidth: Number.isFinite(width)
            ? Math.min(4, Math.max(1, Math.round(width)))
            : 1,
          line,
        });
        return;
      }
      if (callee === "hline") {
        const { positional, named } = parseNamedArgs(splitTopLevel(argText), line);
        const priceText = named.get("price") ?? positional[0];
        if (!priceText) throw new PineError(line, "hline needs a price");
        const literal = Number(priceText);
        const price = Number.isFinite(literal)
          ? literal
          : constVals.get(priceText.trim()) ?? Number.NaN;
        if (!Number.isFinite(price)) {
          throw new PineError(line, "hline needs a fixed price");
        }
        const titleText = named.get("title");
        const colorText = named.get("color");
        const styleText = named.get("linestyle")?.replace(/^line\.style_/, "");
        const width = named.get("linewidth") ? Number(named.get("linewidth")) : 1;
        const titleValue = titleText ? parseLiteral(titleText, line) : undefined;
        if (titleValue && titleValue.kind !== "str") {
          throw new PineError(line, "hline title must be text");
        }
        levels.push({
          price,
          title:
            titleValue?.kind === "str" ? titleValue.value : `Hline ${levels.length + 1}`,
          color: colorText
            ? normalizeColor(parseColorLiteral(colorText, line), line)
            : COLORS.slate,
          lineWidth: Number.isFinite(width) ? Math.min(4, Math.max(1, Math.round(width))) : 1,
          lineStyle:
            styleText === "dashed" || styleText === "dotted" || styleText === "solid"
              ? styleText
              : "solid",
        });
        return;
      }
      if (
        callee === "plotshape" ||
        callee === "plotchar" ||
        callee === "plotcandle" ||
        callee === "plotbar" ||
        callee === "bgcolor" ||
        callee === "barcolor" ||
        callee === "fill" ||
        callee === "alert"
      ) {
        throw new PineError(line, `${callee}() is not supported yet`);
      }
      throw new PineError(line, `cannot use '${callee}()' here`);
    }

    const assign = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(text);
    if (assign) {
      const varName = assign[1]!;
      const exprText = assign[2] ?? "";
      if (["if", "for", "while", "switch"].includes(varName)) {
        throw new PineError(line, `'${varName}' blocks are not supported — use single-line statements`);
      }
      if (exprText.trim().endsWith("=>")) {
        throw new PineError(line, "custom functions are not supported");
      }
      const parsed = new Parser(tokenize(exprText, line), line).parse();
      validateCalls(parsed, line);
      assigns.push({
        name: varName,
        expr: parsed,
        line,
      });
      const constant = tryConst(parsed, line);
      if (constant !== null) constVals.set(varName, constant);
      return;
    }

    if (/^(if|for|while|switch)\b/.test(text)) {
      throw new PineError(line, "if/for/while blocks are not supported — use single-line statements");
    }
    throw new PineError(line, "only indicator(), assignments, plot() and hline() are supported");
  });

  if (!sawIndicator) {
    throw new PineError(0, "missing indicator() — start the script with indicator(\"Title\", overlay=...)");
  }

  return {
    title,
    overlay,
    precision,
    assigns,
    plots,
    levels,
    warnings,
    usesVolume: context.usesVolume,
  };
}

function parseColorLiteral(text: string, line: number): string {
  const value = text.trim();
  if (value.startsWith('"')) {
    const parsed = parseLiteral(value, line);
    if (parsed.kind !== "str") throw new PineError(line, "color must be text");
    return parsed.value;
  }
  // color.lime or a variable holding a color string
  return value;
}

/* ------------------------------------------------------------------------ */
/* Public API                                                               */
/* ------------------------------------------------------------------------ */

export interface PineCompileResult {
  readonly definition?: IndicatorDefinition;
  readonly warnings: readonly string[];
  readonly error?: string;
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "script";
}

export function pineDefinitionId(name: string): string {
  return `pine:${slugify(name)}`;
}

const REGISTRY = new Map<string, IndicatorDefinition>();

export function registerPineDefinition(definition: IndicatorDefinition): void {
  REGISTRY.set(definition.id, definition);
}

/** Saved-name → compiled source, so edited scripts recompile on rehydrate. */
const SOURCES = new Map<string, string>();

export function registerCompiledScript(
  name: string,
  code: string,
  definition: IndicatorDefinition,
): void {
  SOURCES.set(name, code);
  REGISTRY.set(definition.id, definition);
}

export function registeredPineDefinitions(): readonly IndicatorDefinition[] {
  return [...REGISTRY.values()];
}

export function compilePineScript(name: string, code: string): PineCompileResult {
  let body: CompiledBody;
  try {
    body = compileBody(name, code);
  } catch (error) {
    return {
      warnings: [],
      error: error instanceof PineError ? error.message : "could not parse the script",
    };
  }

  const id = pineDefinitionId(body.title || name);
  const usedTitles = new Set<string>();
  const plots: IndicatorPlot[] = [];
  const plotExprs: { plotId: string; expr: Expr; line: number }[] = [];
  const boolVars = new Map<string, boolean>();
  for (const assign of body.assigns) {
    boolVars.set(assign.name, isBooleanExpr(assign.expr, boolVars));
  }
  const dropped: string[] = [];
  body.plots.forEach((spec) => {
    if (isBooleanExpr(spec.expr, boolVars)) {
      dropped.push(spec.title);
      return;
    }
    let plotId = slugify(spec.title) || `plot-${plots.length + 1}`;
    let counter = 2;
    while (usedTitles.has(plotId)) {
      plotId = `${slugify(spec.title)}-${counter}`;
      counter += 1;
    }
    usedTitles.add(plotId);
    plotExprs.push({ plotId, expr: spec.expr, line: spec.line });
    plots.push(
      linePlot(plotId, spec.title, spec.color, { lineWidth: spec.lineWidth }),
    );
  });

  if (plots.length === 0 && body.levels.length === 0) {
    return { warnings: body.warnings, error: "the script draws nothing — add a plot() or hline() call" };
  }

  const levels: IndicatorLevel[] = body.levels.map((spec, index) => {
    const entry = level(`hline${index + 1}`, spec.title, spec.price, {
      editable: false,
      lineStyle: spec.lineStyle,
      color: spec.color,
    });
    return {
      ...entry,
      defaultStyle: { ...entry.defaultStyle, lineWidth: spec.lineWidth },
    };
  });

  const definition: IndicatorDefinition = {
    id,
    name: body.title,
    shortName: body.title,
    description: `Custom Pine Script®: ${body.title}.`,
    category: "performance",
    pane: body.overlay ? "price" : "separate",
    defaultPrecision: body.precision,
    requiresVolume: false,
    inputs: [],
    plots,
    levels,
    fills: [],
    formatLabel: () => "",
    compute: (candles: readonly Candle[]) => {
      const context: EvalContext = {
        candles,
        env: new Map(),
        warnings: [],
        warned: new Set(),
        usesVolume: false,
      };
      for (const assign of body.assigns) {
        context.env.set(assign.name, evaluate(assign.expr, context, assign.line));
      }
      const series: Record<string, NullableNumber[]> = {};
      for (const { plotId, expr, line } of plotExprs) {
        const value = evaluate(expr, context, line);
        if (value.kind === "series") {
          series[plotId] = [...value.data];
        } else if (value.kind === "num") {
          series[plotId] = Array.from({ length: candles.length }, () =>
            Number.isFinite(value.value) ? value.value : null,
          );
        } else {
          series[plotId] = Array.from({ length: candles.length }, () => null);
        }
      }
      return series;
    },
  };

  return {
    definition,
    warnings: [
      ...body.warnings,
      ...dropped.map(
        (title) => `"${title}" is a true/false signal — markers are not drawn yet.`,
      ),
    ],
  };
}

export interface PineScriptEntry {
  readonly name: string;
  readonly code: string;
}

const PINE_SCRIPTS_KEY = "chart:pine:my-scripts:v1";

export function readPineScripts(): PineScriptEntry[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(PINE_SCRIPTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PineScriptEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as PineScriptEntry).name === "string" &&
        typeof (entry as PineScriptEntry).code === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Lazily compile + register a saved script so persisted charts rehydrate.
 * The definition id comes from the indicator title, which can differ from
 * the saved script name, so name matches are tried first and every other
 * saved script is compiled as a fallback.
 */
export function getPineDefinition(
  definitionId: string,
): IndicatorDefinition | undefined {
  const cached = REGISTRY.get(definitionId);
  if (cached) return cached;
  if (!definitionId.startsWith("pine:")) return undefined;
  const wanted = definitionId.slice("pine:".length);
  const entries = readPineScripts();
  for (const entry of entries) {
    if (slugify(entry.name) !== wanted) continue;
    const compiled = compilePineScript(entry.name, entry.code);
    if (compiled.definition?.id === definitionId) {
      registerCompiledScript(entry.name, entry.code, compiled.definition);
      return compiled.definition;
    }
  }
  for (const entry of entries) {
    if (slugify(entry.name) === wanted) continue;
    const compiled = compilePineScript(entry.name, entry.code);
    if (compiled.definition) {
      registerCompiledScript(entry.name, entry.code, compiled.definition);
      if (compiled.definition.id === definitionId) return compiled.definition;
    }
  }
  return REGISTRY.get(definitionId);
}

/** Compile every saved script so search and lists see custom indicators. */
export function rehydrateAllPineScripts(): void {
  for (const entry of readPineScripts()) {
    if (SOURCES.get(entry.name) === entry.code) continue;
    const compiled = compilePineScript(entry.name, entry.code);
    if (compiled.definition) {
      registerCompiledScript(entry.name, entry.code, compiled.definition);
    }
  }
}

/**
 * Evaluates a scan against one stock's daily candles.
 *
 * Every timeframed measure is computed as a whole series on its timeframe's
 * candles and read at `latest - offset - shift`. The shift is what lets one
 * clause be asked about an earlier candle: a cross compares shift 0 with
 * shift 1, Count/Countstreak/Max/Min walk shifts 0..duration-1, and a
 * backtest evaluates the scan "as of" an earlier session by truncating the
 * daily candles there (weekly and longer candles are rebuilt from the
 * truncated days so a backtest never sees the rest of that week).
 *
 * Daily series are causal, so they are computed once on the full history
 * and shared by every as-of evaluation of the same stock.
 */
import {
  averageTrueRange,
  bollingerBands,
  exponentialMovingAverage,
  movingAverageConvergenceDivergence,
  relativeStrengthIndex,
  rollingStandardDeviation,
  simpleMovingAverage,
  smoothedMovingAverage,
  trueRange,
} from "@/lib/technical/indicators";
import {
  accumulationDistribution,
  aroon,
  chaikinMoneyFlow,
  commodityChannelIndex,
  directionalMovementIndex,
  forceIndex,
  hullMovingAverage,
  ichimoku,
  momentum,
  moneyFlowIndex,
  onBalanceVolume,
  parabolicSar,
  rateOfChange,
  stochasticOscillator,
  stochasticRsi,
  supertrend,
  tripleExponentialMovingAverage,
  volumeWeightedMovingAverage,
  weightedMovingAverage,
  williamsPercentR,
} from "@/lib/technical/indicators-extended";
import { evaluateCandlestickPattern } from "@/lib/technical/patterns";
import type { Candle, NullableNumber } from "@/lib/technical/types";
import { getMeasure } from "./catalog";
import type {
  Arg,
  Clause,
  CompareOp,
  Expr,
  Group,
  MeasureTerm,
  ScanNode,
  SourceField,
  Term,
  TimeframeUnit,
} from "./scan-types";

export interface StockData {
  readonly key: string;
  readonly securityId: number;
  readonly exchange: string;
  readonly exchangeSegment: string;
  readonly symbol: string;
  readonly name: string;
  readonly sector: string;
  readonly industry: string;
  readonly marketCapCr: number | null;
  readonly marketCapLabel: string;
  /** Exchange VWAP for the live session, when the quote carries one. */
  readonly vwap: number | null;
  /** Oldest first; timestamps in epoch milliseconds. */
  readonly daily: readonly Candle[];
  readonly fundamentals?: Readonly<Record<string, number>>;
}

type Series = readonly number[];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TRADING_DAYS_52W = 252;

/** Shared, as-of-independent caches for one stock. */
export interface StockContext {
  readonly stock: StockData;
  readonly dailySeries: Map<string, Series>;
}

export function createStockContext(stock: StockData): StockContext {
  return { stock, dailySeries: new Map() };
}

export class ScanEvaluator {
  private readonly candleCache = new Map<TimeframeUnit, readonly Candle[]>();
  private readonly seriesCache = new Map<string, Series>();
  private readonly asOf: number;

  public constructor(
    private readonly context: StockContext,
    asOf?: number,
  ) {
    const last = context.stock.daily.length - 1;
    this.asOf = asOf === undefined ? last : Math.min(asOf, last);
  }

  public get stock(): StockData {
    return this.context.stock;
  }

  public get isLatest(): boolean {
    return this.asOf === this.context.stock.daily.length - 1;
  }

  /* ---------------------------------------------------------------- nodes */

  public evaluateNode(node: ScanNode, shift = 0): boolean {
    return node.kind === "clause"
      ? this.evaluateClause(node, shift)
      : this.evaluateGroup(node, shift);
  }

  public evaluateGroup(group: Group, shift = 0): boolean {
    const items = group.items.filter((item) => item.enabled);
    let result: boolean;
    if (items.length === 0) {
      result = true;
    } else if (group.match === "all") {
      result = items.every((item) => this.evaluateNode(item, shift));
    } else {
      let passed = 0;
      for (const item of items) {
        if (this.evaluateNode(item, shift)) passed += 1;
        if (passed >= group.match) break;
      }
      result = passed >= Math.min(group.match, items.length);
    }
    return group.mode === "fails" ? !result : result;
  }

  public evaluateClause(clause: Clause, shift = 0): boolean {
    if (clause.op === null || !clause.right || clause.right.terms.length === 0) {
      const value = this.evaluateExpr(clause.left, shift);
      return Number.isFinite(value) && value !== 0;
    }

    if (isTextExpr(clause.left) || isTextExpr(clause.right)) {
      return compareText(
        this.evaluateText(clause.left),
        clause.op,
        this.evaluateText(clause.right),
      );
    }

    const left = this.evaluateExpr(clause.left, shift);
    const right = this.evaluateExpr(clause.right, shift);
    if (clause.op === "crossed-above" || clause.op === "crossed-below") {
      const previousLeft = this.evaluateExpr(clause.left, shift + 1);
      const previousRight = this.evaluateExpr(clause.right, shift + 1);
      if (![left, right, previousLeft, previousRight].every(Number.isFinite)) {
        return false;
      }
      return clause.op === "crossed-above"
        ? left > right && previousLeft <= previousRight
        : left < right && previousLeft >= previousRight;
    }
    return compareNumbers(left, clause.op, right);
  }

  /* ---------------------------------------------------------- expressions */

  public evaluateExpr(expr: Expr, shift = 0): number {
    if (expr.terms.length === 0) return Number.NaN;
    // * and / first, then + and - left to right.
    const values: number[] = [this.evaluateTerm(expr.terms[0]!, shift)];
    const additive: ("+" | "-")[] = [];
    for (let index = 1; index < expr.terms.length; index += 1) {
      const op = expr.ops[index - 1] ?? "+";
      const value = this.evaluateTerm(expr.terms[index]!, shift);
      if (op === "*" || op === "/") {
        const previous = values.pop()!;
        values.push(op === "*" ? previous * value : value === 0 ? Number.NaN : previous / value);
      } else {
        additive.push(op);
        values.push(value);
      }
    }
    let total = values[0]!;
    for (let index = 1; index < values.length; index += 1) {
      total = additive[index - 1] === "-" ? total - values[index]! : total + values[index]!;
    }
    return total;
  }

  public evaluateText(expr: Expr): string {
    const term = expr.terms[0];
    if (!term) return "";
    if (term.kind === "text") return term.value;
    if (term.kind === "number") return String(term.value);
    const stock = this.context.stock;
    switch (term.measure) {
      case "symbol":
        return stock.symbol;
      case "sector":
        return stock.sector;
      case "industry":
        return stock.industry;
      case "marketcap-name":
        return stock.marketCapLabel;
      default:
        return String(this.evaluateTerm(term, 0));
    }
  }

  public evaluateTerm(term: Term, shift = 0): number {
    if (term.kind === "number") return term.value;
    if (term.kind === "text") return Number(term.value);
    return this.evaluateMeasure(term, shift);
  }

  private evaluateMeasure(term: MeasureTerm, shift: number): number {
    const def = getMeasure(term.measure);
    if (!def) return Number.NaN;
    const at = shift + Math.max(0, term.offset);
    const stock = this.context.stock;

    if (def.category === "Fundamentals") {
      const value = stock.fundamentals?.[term.measure.slice("fund:".length)];
      return value === undefined ? Number.NaN : value;
    }
    if (def.category === "Math functions") return this.evaluateFunction(term, at);
    if (def.output === "text") return Number.NaN;

    switch (term.measure) {
      case "market-cap":
        return stock.marketCapCr ?? Number.NaN;
      case "high-52w":
        return this.dailyValue("high-52w", [], at, () =>
          rollingExtreme(stock.daily.map((candle) => candle.high), TRADING_DAYS_52W, "max"),
        );
      case "low-52w":
        return this.dailyValue("low-52w", [], at, () =>
          rollingExtreme(stock.daily.map((candle) => candle.low), TRADING_DAYS_52W, "min"),
        );
      case "vwap":
        if (term.timeframe === "day" && at === 0 && this.isLatest && stock.vwap) {
          return stock.vwap;
        }
        break;
      default:
        break;
    }

    if (term.measure.startsWith("pattern:")) {
      return this.patternAt(term.measure.slice("pattern:".length), term.timeframe, at) ? 1 : 0;
    }

    const measureId = term.measure === "vwap" ? "hlc3" : term.measure;
    const series = this.series(term.timeframe, measureId, term.args);
    const index = this.latestIndex(term.timeframe) - at;
    if (index < 0 || index >= series.length) return Number.NaN;
    return series[index]!;
  }

  private evaluateFunction(term: MeasureTerm, at: number): number {
    const args = term.args;
    const exprAt = (position: number): Expr | null => {
      const arg = args[position];
      return arg && arg.kind === "expr" ? arg.expr : null;
    };
    const numberAt = (position: number, fallback: number): number => {
      const arg = args[position];
      return arg && arg.kind === "number" && Number.isFinite(arg.value) ? arg.value : fallback;
    };
    const unary = (fn: (value: number) => number): number => {
      const expr = exprAt(0);
      return expr ? fn(this.evaluateExpr(expr, at)) : Number.NaN;
    };

    switch (term.measure) {
      case "bracket":
        return unary((value) => value);
      case "abs":
        return unary(Math.abs);
      case "ceil":
        return unary(Math.ceil);
      case "floor":
        return unary(Math.floor);
      case "round":
        return unary(Math.round);
      case "square":
        return unary((value) => value * value);
      case "sqrt":
        return unary((value) => (value < 0 ? Number.NaN : Math.sqrt(value)));
      case "log":
        return unary((value) => (value <= 0 ? Number.NaN : Math.log(value)));
      case "log10":
        return unary((value) => (value <= 0 ? Number.NaN : Math.log10(value)));
      case "greatest":
      case "least": {
        const values = args
          .filter((arg): arg is Extract<Arg, { kind: "expr" }> => arg.kind === "expr")
          .map((arg) => this.evaluateExpr(arg.expr, at));
        if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
          return Number.NaN;
        }
        return term.measure === "greatest" ? Math.max(...values) : Math.min(...values);
      }
      case "max":
      case "min": {
        const duration = clampDuration(numberAt(0, 20));
        const expr = exprAt(1);
        if (!expr) return Number.NaN;
        let best = term.measure === "max" ? -Infinity : Infinity;
        for (let back = 0; back < duration; back += 1) {
          const value = this.evaluateExpr(expr, at + back);
          if (!Number.isFinite(value)) return Number.NaN;
          best = term.measure === "max" ? Math.max(best, value) : Math.min(best, value);
        }
        return best;
      }
      case "count":
      case "countstreak": {
        const duration = clampDuration(numberAt(0, 5));
        const filter = args[1];
        if (!filter || filter.kind !== "filter") return Number.NaN;
        let count = 0;
        for (let back = 0; back < duration; back += 1) {
          const passed = this.evaluateClause(filter.clause, at + back);
          if (passed) count += 1;
          else if (term.measure === "countstreak") break;
        }
        return count;
      }
      default:
        return Number.NaN;
    }
  }

  /* -------------------------------------------------------------- candles */

  public candles(timeframe: TimeframeUnit): readonly Candle[] {
    if (timeframe === "day") return this.context.stock.daily;
    const cached = this.candleCache.get(timeframe);
    if (cached) return cached;
    const daily = this.context.stock.daily.slice(0, this.asOf + 1);
    const built = resampleDaily(daily, timeframe);
    this.candleCache.set(timeframe, built);
    return built;
  }

  private latestIndex(timeframe: TimeframeUnit): number {
    return timeframe === "day" ? this.asOf : this.candles(timeframe).length - 1;
  }

  private series(timeframe: TimeframeUnit, measure: string, args: readonly Arg[]): Series {
    const key = `${timeframe}|${measure}|${argsKey(args)}`;
    const cache = timeframe === "day" ? this.context.dailySeries : this.seriesCache;
    const cached = cache.get(key);
    if (cached) return cached;
    const built = computeSeries(measure, args, this.candles(timeframe));
    cache.set(key, built);
    return built;
  }

  private dailyValue(key: string, args: readonly Arg[], at: number, build: () => Series): number {
    const cacheKey = `day|${key}|${argsKey(args)}`;
    let series = this.context.dailySeries.get(cacheKey);
    if (!series) {
      series = build();
      this.context.dailySeries.set(cacheKey, series);
    }
    const index = this.asOf - at;
    return index >= 0 && index < series.length ? series[index]! : Number.NaN;
  }

  private patternAt(pattern: string, timeframe: TimeframeUnit, at: number): boolean {
    const candles = this.candles(timeframe);
    const index = this.latestIndex(timeframe) - at;
    if (index < 0) return false;
    const current = candles[index];
    const previous = candles[index - 1];
    if (!current) return false;
    switch (pattern) {
      case "green-candle":
        return current.close > current.open;
      case "red-candle":
        return current.close < current.open;
      case "inside-bar":
        return !!previous && current.high < previous.high && current.low > previous.low;
      case "outside-bar":
        return !!previous && current.high > previous.high && current.low < previous.low;
      case "gap-up":
        return !!previous && current.low > previous.high;
      case "gap-down":
        return !!previous && current.high < previous.low;
      case "nr7": {
        if (index < 6) return false;
        const range = current.high - current.low;
        for (let back = 1; back < 7; back += 1) {
          const candle = candles[index - back]!;
          if (candle.high - candle.low <= range) return false;
        }
        return true;
      }
      default: {
        const window = candles.slice(Math.max(0, index - 9), index + 1);
        return evaluateCandlestickPattern(pattern, window).state === "detected";
      }
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Comparison                                                               */
/* ------------------------------------------------------------------------ */

const EPSILON = 1e-9;

export function compareNumbers(left: number, op: CompareOp, right: number): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  switch (op) {
    case "=":
      return Math.abs(left - right) <= EPSILON * Math.max(1, Math.abs(left), Math.abs(right));
    case "!=":
      return Math.abs(left - right) > EPSILON * Math.max(1, Math.abs(left), Math.abs(right));
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    default:
      return false;
  }
}

function compareText(left: string, op: CompareOp, right: string): boolean {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (op === "=") return a === b;
  if (op === "!=") return a !== b;
  return false;
}

function isTextExpr(expr: Expr): boolean {
  const term = expr.terms[0];
  if (!term) return false;
  if (term.kind === "text") return true;
  if (term.kind !== "measure") return false;
  return getMeasure(term.measure)?.output === "text";
}

function clampDuration(value: number): number {
  return Math.max(1, Math.min(500, Math.round(value)));
}

function argsKey(args: readonly Arg[]): string {
  return args
    .map((arg) => (arg.kind === "number" || arg.kind === "source" ? String(arg.value) : arg.kind))
    .join(",");
}

/* ------------------------------------------------------------------------ */
/* Resampling                                                               */
/* ------------------------------------------------------------------------ */

function periodKey(timestamp: number, timeframe: TimeframeUnit): number {
  const local = timestamp + IST_OFFSET_MS;
  const date = new Date(local);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  switch (timeframe) {
    case "week": {
      const dayIndex = Math.floor(local / DAY_MS);
      // 1970-01-01 was a Thursday; this makes Monday weekday 0.
      const weekday = (dayIndex + 3) % 7;
      return dayIndex - weekday;
    }
    case "month":
      return year * 12 + month;
    case "quarter":
      return year * 4 + Math.floor(month / 3);
    case "year":
      return year;
    default:
      return Math.floor(local / DAY_MS);
  }
}

export function resampleDaily(daily: readonly Candle[], timeframe: TimeframeUnit): Candle[] {
  if (timeframe === "day") return [...daily];
  const out: Candle[] = [];
  let currentKey: number | null = null;
  let open = 0;
  let high = 0;
  let low = 0;
  let close = 0;
  let volume = 0;
  let timestamp = 0;
  const flush = (): void => {
    if (currentKey === null) return;
    out.push({ timestamp, open, high, low, close, volume });
  };
  for (const candle of daily) {
    const key = periodKey(candle.timestamp, timeframe);
    if (key !== currentKey) {
      flush();
      currentKey = key;
      timestamp = candle.timestamp;
      open = candle.open;
      high = candle.high;
      low = candle.low;
      volume = 0;
    }
    high = Math.max(high, candle.high);
    low = Math.min(low, candle.low);
    close = candle.close;
    volume += candle.volume ?? 0;
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------------ */
/* Series                                                                   */
/* ------------------------------------------------------------------------ */

function toNumbers(values: readonly NullableNumber[]): number[] {
  return values.map((value) => (value === null || value === undefined ? Number.NaN : value));
}

function sourceSeries(candles: readonly Candle[], source: SourceField): number[] {
  switch (source) {
    case "open":
      return candles.map((candle) => candle.open);
    case "high":
      return candles.map((candle) => candle.high);
    case "low":
      return candles.map((candle) => candle.low);
    case "volume":
      return candles.map((candle) => candle.volume ?? Number.NaN);
    case "hl2":
      return candles.map((candle) => (candle.high + candle.low) / 2);
    case "hlc3":
      return candles.map((candle) => (candle.high + candle.low + candle.close) / 3);
    case "ohlc4":
      return candles.map((candle) => (candle.open + candle.high + candle.low + candle.close) / 4);
    default:
      return candles.map((candle) => candle.close);
  }
}

/** Monotonic-deque rolling max/min: O(n) regardless of the window. */
export function rollingExtreme(values: Series, period: number, kind: "max" | "min"): number[] {
  const out = new Array<number>(values.length).fill(Number.NaN);
  const deque: number[] = [];
  const better = (a: number, b: number): boolean => (kind === "max" ? a >= b : a <= b);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    while (deque.length > 0 && deque[0]! <= index - period) deque.shift();
    if (Number.isFinite(value)) {
      while (deque.length > 0 && better(value, values[deque[deque.length - 1]!]!)) deque.pop();
      deque.push(index);
    }
    // A short history still reports the extreme of what exists, the way a
    // 52-week high is quoted for a stock listed eight months ago.
    if (deque.length > 0) out[index] = values[deque[0]!]!;
  }
  return out;
}

function rollingSum(values: Series, period: number): number[] {
  const out = new Array<number>(values.length).fill(Number.NaN);
  let sum = 0;
  let valid = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (Number.isFinite(value)) {
      sum += value;
      valid += 1;
    }
    if (index >= period) {
      const dropped = values[index - period]!;
      if (Number.isFinite(dropped)) {
        sum -= dropped;
        valid -= 1;
      }
    }
    if (index >= period - 1 && valid === period) out[index] = sum;
  }
  return out;
}

function intArg(args: readonly Arg[], position: number, fallback: number): number {
  const arg = args[position];
  const value = arg && arg.kind === "number" ? arg.value : fallback;
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function floatArg(args: readonly Arg[], position: number, fallback: number): number {
  const arg = args[position];
  const value = arg && arg.kind === "number" ? arg.value : fallback;
  return Number.isFinite(value) ? value : fallback;
}

function sourceArg(args: readonly Arg[], fallback: SourceField = "close"): SourceField {
  const arg = args.find((candidate) => candidate.kind === "source");
  return arg && arg.kind === "source" ? arg.value : fallback;
}

/** The first integer argument after an optional source argument. */
function periodArg(args: readonly Arg[], fallback: number): number {
  const numbers = args.filter((arg) => arg.kind === "number");
  const first = numbers[0];
  return first && first.kind === "number" && first.value > 0 ? Math.round(first.value) : fallback;
}

function macdPeriods(args: readonly Arg[]): { fast: number; slow: number; signal: number } {
  const a = intArg(args, 0, 26);
  const b = intArg(args, 1, 12);
  return { fast: Math.min(a, b), slow: Math.max(a, b), signal: intArg(args, 2, 9) };
}

function heikinAshi(candles: readonly Candle[]): { open: number[]; high: number[]; low: number[]; close: number[] } {
  const open: number[] = [];
  const high: number[] = [];
  const low: number[] = [];
  const close: number[] = [];
  candles.forEach((candle, index) => {
    const haClose = (candle.open + candle.high + candle.low + candle.close) / 4;
    const haOpen =
      index === 0 ? (candle.open + candle.close) / 2 : (open[index - 1]! + close[index - 1]!) / 2;
    open.push(haOpen);
    close.push(haClose);
    high.push(Math.max(candle.high, haOpen, haClose));
    low.push(Math.min(candle.low, haOpen, haClose));
  });
  return { open, high, low, close };
}

function waveTrend(candles: readonly Candle[], channel: number, average: number) {
  const ap = sourceSeries(candles, "hlc3");
  const esa = toNumbers(exponentialMovingAverage(ap, channel));
  const deviation = toNumbers(
    exponentialMovingAverage(
      ap.map((value, index) => Math.abs(value - esa[index]!)),
      channel,
    ),
  );
  const ci = ap.map((value, index) => {
    const d = deviation[index]!;
    return Number.isFinite(d) && d !== 0 ? (value - esa[index]!) / (0.015 * d) : Number.NaN;
  });
  const wt1 = toNumbers(exponentialMovingAverage(ci, average));
  const wt2 = toNumbers(simpleMovingAverage(wt1, 4));
  return { wt1, wt2, momentum: wt1.map((value, index) => value - wt2[index]!) };
}

export function computeSeries(measure: string, args: readonly Arg[], candles: readonly Candle[]): number[] {
  const close = (): number[] => sourceSeries(candles, "close");
  switch (measure) {
    case "open":
    case "high":
    case "low":
    case "close":
    case "volume":
    case "hl2":
    case "hlc3":
    case "ohlc4":
      return sourceSeries(candles, measure);
    case "pct-change":
      return candles.map((candle, index) => {
        const previous = candles[index - 1];
        return previous && previous.close !== 0
          ? ((candle.close - previous.close) / previous.close) * 100
          : Number.NaN;
      });
    case "ha-open":
      return heikinAshi(candles).open;
    case "ha-high":
      return heikinAshi(candles).high;
    case "ha-low":
      return heikinAshi(candles).low;
    case "ha-close":
      return heikinAshi(candles).close;

    case "pivot":
    case "pivot-r1":
    case "pivot-r2":
    case "pivot-s1":
    case "pivot-s2":
      return candles.map((_, index) => {
        const previous = candles[index - 1];
        if (!previous) return Number.NaN;
        const pivot = (previous.high + previous.low + previous.close) / 3;
        const range = previous.high - previous.low;
        switch (measure) {
          case "pivot-r1":
            return 2 * pivot - previous.low;
          case "pivot-s1":
            return 2 * pivot - previous.high;
          case "pivot-r2":
            return pivot + range;
          case "pivot-s2":
            return pivot - range;
          default:
            return pivot;
        }
      });

    case "sma":
      return toNumbers(simpleMovingAverage(sourceSeries(candles, sourceArg(args)), periodArg(args, 20)));
    case "ema":
      return toNumbers(exponentialMovingAverage(sourceSeries(candles, sourceArg(args)), periodArg(args, 20)));
    case "wma":
      return toNumbers(weightedMovingAverage(sourceSeries(candles, sourceArg(args)), periodArg(args, 20)));
    case "tma": {
      const period = periodArg(args, 20);
      const first = toNumbers(simpleMovingAverage(sourceSeries(candles, sourceArg(args)), Math.ceil(period / 2)));
      return toNumbers(simpleMovingAverage(first, Math.floor(period / 2) + 1));
    }
    case "rma":
      return toNumbers(smoothedMovingAverage(sourceSeries(candles, sourceArg(args)), periodArg(args, 20)));
    case "tema":
      return toNumbers(tripleExponentialMovingAverage(sourceSeries(candles, sourceArg(args)), periodArg(args, 20)));
    case "hma":
      return toNumbers(hullMovingAverage(sourceSeries(candles, sourceArg(args)), periodArg(args, 20)));
    case "vwma":
      return toNumbers(volumeWeightedMovingAverage(candles, periodArg(args, 20)));
    case "std":
      return toNumbers(rollingStandardDeviation(sourceSeries(candles, sourceArg(args)), periodArg(args, 20)));
    case "sum":
      return rollingSum(sourceSeries(candles, sourceArg(args, "volume")), periodArg(args, 20));

    case "psar":
      return toNumbers(
        parabolicSar(candles, floatArg(args, 0, 0.02), floatArg(args, 1, 0.02), floatArg(args, 2, 0.2)).sar,
      );
    case "bb-upper":
    case "bb-lower":
    case "bb-percent-b": {
      const bands = bollingerBands(close(), intArg(args, 0, 20), floatArg(args, 1, 2));
      return toNumbers(
        measure === "bb-upper" ? bands.upper : measure === "bb-lower" ? bands.lower : bands.percentB,
      );
    }
    case "supertrend":
      return toNumbers(supertrend(candles, intArg(args, 0, 7), floatArg(args, 1, 3)).line);
    case "ichimoku-base":
    case "ichimoku-conversion":
    case "ichimoku-span-a":
    case "ichimoku-span-b":
    case "ichimoku-cloud-top":
    case "ichimoku-cloud-bottom": {
      const result = ichimoku(candles, intArg(args, 0, 9), intArg(args, 1, 26), intArg(args, 2, 52));
      switch (measure) {
        case "ichimoku-base":
          return toNumbers(result.kijun);
        case "ichimoku-conversion":
          return toNumbers(result.tenkan);
        case "ichimoku-span-a":
          return toNumbers(result.senkouA);
        case "ichimoku-span-b":
          return toNumbers(result.senkouB);
        default: {
          const a = toNumbers(result.cloudA);
          const b = toNumbers(result.cloudB);
          return a.map((value, index) =>
            measure === "ichimoku-cloud-top" ? Math.max(value, b[index]!) : Math.min(value, b[index]!),
          );
        }
      }
    }
    case "accdist":
      return toNumbers(accumulationDistribution(candles));
    case "rsi":
      return toNumbers(relativeStrengthIndex(close(), intArg(args, 0, 14)));
    case "stochrsi":
      return toNumbers(
        stochasticRsi(close(), intArg(args, 0, 14), intArg(args, 1, 14), intArg(args, 2, 3), intArg(args, 3, 3)).k,
      );
    case "cci":
      return toNumbers(commodityChannelIndex(candles, intArg(args, 0, 20)));
    case "cmf":
      return toNumbers(chaikinMoneyFlow(candles, intArg(args, 0, 20)));
    case "mfi":
      return toNumbers(moneyFlowIndex(candles, intArg(args, 0, 14)));
    case "obv":
      return toNumbers(onBalanceVolume(candles));
    case "williams-r":
      return toNumbers(williamsPercentR(candles, intArg(args, 0, 14)));
    case "intraday-intensity":
      return candles.map((candle) => {
        const range = candle.high - candle.low;
        return range === 0 ? 0 : ((2 * candle.close - candle.high - candle.low) / range) * (candle.volume ?? 0);
      });
    case "force-index":
      return toNumbers(forceIndex(candles, intArg(args, 0, 13)));
    case "macd-line":
    case "macd-signal":
    case "macd-histogram": {
      const { fast, slow, signal } = macdPeriods(args);
      const result = movingAverageConvergenceDivergence(close(), {
        fastPeriod: fast,
        slowPeriod: slow,
        signalPeriod: signal,
      });
      return toNumbers(
        measure === "macd-line" ? result.macd : measure === "macd-signal" ? result.signal : result.histogram,
      );
    }
    case "adx":
    case "adx-di-positive":
    case "adx-di-negative": {
      const period = intArg(args, 0, 14);
      const result = directionalMovementIndex(candles, period, period);
      return toNumbers(
        measure === "adx" ? result.adx : measure === "adx-di-positive" ? result.plusDi : result.minusDi,
      );
    }
    case "true-range":
      return toNumbers(trueRange(candles));
    case "atr":
      return toNumbers(averageTrueRange(candles, intArg(args, 0, 14)));
    case "aroon-up":
    case "aroon-down":
    case "aroon-osc": {
      const result = aroon(candles, intArg(args, 0, 14));
      return toNumbers(
        measure === "aroon-up" ? result.up : measure === "aroon-down" ? result.down : result.oscillator,
      );
    }
    case "stochastic":
    case "stochastic-d":
    case "slow-stoch-k":
    case "slow-stoch-d":
    case "fast-stoch-k":
    case "fast-stoch-d": {
      const k = intArg(args, 0, 14);
      const d = intArg(args, 1, 3);
      const smooth = measure.startsWith("slow") || measure.startsWith("stochastic") ? 3 : 1;
      const result = stochasticOscillator(candles, k, smooth, d);
      return toNumbers(measure.endsWith("-d") ? result.d : result.k);
    }
    case "roc":
      return toNumbers(rateOfChange(close(), intArg(args, 0, 9)));
    case "momentum":
      return toNumbers(momentum(close(), intArg(args, 0, 10)));
    case "wavetrend":
    case "wavetrend-trigger":
    case "wavetrend-momentum": {
      const result = waveTrend(candles, intArg(args, 0, 10), intArg(args, 1, 21));
      return measure === "wavetrend"
        ? result.wt1
        : measure === "wavetrend-trigger"
          ? result.wt2
          : result.momentum;
    }
    default:
      return candles.map(() => Number.NaN);
  }
}

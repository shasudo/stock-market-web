/**
 * The scan model behind the /charting stock screener. A scan is a tree of
 * groups and clauses, the way Chartink's scanner builds one: a group says
 * whether a stock passes or fails all (or any N) of its filters, and a clause
 * compares two arithmetic expressions of measures (price fields, indicators,
 * math functions, fundamentals) taken on a timeframe at a candle offset.
 *
 * Everything here is plain JSON so a scan can be saved, shared in a URL,
 * copied to the clipboard, and sent to the evaluation API unchanged.
 */

export const TIMEFRAME_UNITS = [
  "day",
  "week",
  "month",
  "quarter",
  "year",
] as const;
export type TimeframeUnit = (typeof TIMEFRAME_UNITS)[number];

export const ARITH_OPS = ["+", "-", "*", "/"] as const;
export type ArithOp = (typeof ARITH_OPS)[number];

export const COMPARE_OPS = [
  "=",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "crossed-above",
  "crossed-below",
] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export const SOURCE_FIELDS = [
  "close",
  "open",
  "high",
  "low",
  "volume",
  "hl2",
  "hlc3",
  "ohlc4",
] as const;
export type SourceField = (typeof SOURCE_FIELDS)[number];

export interface NumberTerm {
  readonly kind: "number";
  readonly value: number;
}

export interface TextTerm {
  readonly kind: "text";
  readonly value: string;
}

export interface MeasureTerm {
  readonly kind: "measure";
  readonly measure: string;
  readonly timeframe: TimeframeUnit;
  /** Candles back from the latest one on the term's timeframe (0 = latest). */
  readonly offset: number;
  readonly args: readonly Arg[];
}

export type Term = NumberTerm | TextTerm | MeasureTerm;

/** Terms joined left to right by `ops`, with * and / binding tighter. */
export interface Expr {
  readonly terms: readonly Term[];
  readonly ops: readonly ArithOp[];
}

export type Arg =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "source"; readonly value: SourceField }
  | { readonly kind: "expr"; readonly expr: Expr }
  | { readonly kind: "filter"; readonly clause: Clause };

export interface Clause {
  readonly kind: "clause";
  readonly id: string;
  readonly enabled: boolean;
  readonly left: Expr;
  /** Null for a boolean measure (a candlestick pattern) on its own. */
  readonly op: CompareOp | null;
  readonly right: Expr | null;
}

export type GroupMatch = "all" | 1 | 2 | 3 | 4 | 5;

export interface Group {
  readonly kind: "group";
  readonly id: string;
  readonly enabled: boolean;
  readonly mode: "passes" | "fails";
  /** "all" or the number of filters of which any must pass. */
  readonly match: GroupMatch;
  readonly items: readonly ScanNode[];
}

export type ScanNode = Clause | Group;

export interface ResultColumn {
  readonly id: string;
  readonly label: string;
  readonly expr: Expr;
}

export interface Scan {
  readonly version: 1;
  readonly name: string;
  readonly segment: string;
  readonly root: Group;
  readonly columns: readonly ResultColumn[];
}

let idCounter = 0;
export function newId(prefix = "n"): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function numberExpr(value: number): Expr {
  return { terms: [{ kind: "number", value }], ops: [] };
}

export function termExpr(term: Term): Expr {
  return { terms: [term], ops: [] };
}

export function emptyGroup(): Group {
  return {
    kind: "group",
    id: newId("g"),
    enabled: true,
    mode: "passes",
    match: "all",
    items: [],
  };
}

export function emptyScan(segment = "cash"): Scan {
  return {
    version: 1,
    name: "",
    segment,
    root: emptyGroup(),
    columns: [],
  };
}

/** A fresh copy with new ids throughout, for duplicate and paste. */
export function cloneWithNewIds<T extends ScanNode>(node: T): T {
  if (node.kind === "clause") {
    return { ...node, id: newId("c") } as T;
  }
  return {
    ...node,
    id: newId("g"),
    items: node.items.map((item) => cloneWithNewIds(item)),
  } as T;
}

export function isExprEmpty(expr: Expr | null | undefined): boolean {
  return !expr || expr.terms.length === 0;
}

/** Every measure term in an expression, including inside function arguments. */
export function collectMeasures(expr: Expr, into: MeasureTerm[] = []): MeasureTerm[] {
  for (const term of expr.terms) {
    if (term.kind !== "measure") continue;
    into.push(term);
    for (const arg of term.args) {
      if (arg.kind === "expr") collectMeasures(arg.expr, into);
      if (arg.kind === "filter") collectClauseMeasures(arg.clause, into);
    }
  }
  return into;
}

export function collectClauseMeasures(
  clause: Clause,
  into: MeasureTerm[] = [],
): MeasureTerm[] {
  collectMeasures(clause.left, into);
  if (clause.right) collectMeasures(clause.right, into);
  return into;
}

export function collectNodeMeasures(
  node: ScanNode,
  into: MeasureTerm[] = [],
): MeasureTerm[] {
  if (node.kind === "clause") return collectClauseMeasures(node, into);
  for (const item of node.items) collectNodeMeasures(item, into);
  return into;
}

/** Clauses in document order, with their depth, for debug output. */
export function listClauses(group: Group): Clause[] {
  const out: Clause[] = [];
  const walk = (node: ScanNode): void => {
    if (node.kind === "clause") out.push(node);
    else node.items.forEach(walk);
  };
  walk(group);
  return out;
}

/**
 * Every measure the screener can put in a clause, grouped the way Chartink's
 * filter picker groups them. The evaluator (engine.ts) implements each id;
 * the UI reads labels, parameter shapes and defaults from here.
 */
import type {
  Arg,
  Expr,
  MeasureTerm,
  SourceField,
  TimeframeUnit,
} from "./scan-types";
import { numberExpr } from "./scan-types";

export type ParamKind = "int" | "float" | "source" | "expr" | "filter";

export interface ParamDef {
  readonly name: string;
  readonly kind: ParamKind;
  readonly default?: number | SourceField;
}

export type MeasureOutput = "number" | "boolean" | "text";

export interface MeasureDef {
  readonly id: string;
  readonly label: string;
  readonly category: MeasureCategory;
  readonly params: readonly ParamDef[];
  readonly output: MeasureOutput;
  /** False for values that do not depend on a candle (sector, PE, ...). */
  readonly timeframed: boolean;
  /** Short name used in the expression text, e.g. "Sma". */
  readonly short?: string;
  readonly keywords?: readonly string[];
}

export const MEASURE_CATEGORIES = [
  "Stock attributes",
  "Math functions",
  "Pivots",
  "Moving averages",
  "Indicators",
  "Candlestick patterns",
  "Fundamentals",
] as const;
export type MeasureCategory = (typeof MEASURE_CATEGORIES)[number];

const p = (name: string, def: number): ParamDef => ({
  name,
  kind: Number.isInteger(def) ? "int" : "float",
  default: def,
});
const src = (def: SourceField = "close"): ParamDef => ({
  name: "source",
  kind: "source",
  default: def,
});
const exprParam: ParamDef = { name: "value", kind: "expr" };
const filterParam: ParamDef = { name: "filter", kind: "filter" };

function m(
  id: string,
  label: string,
  category: MeasureCategory,
  params: readonly ParamDef[] = [],
  extra: Partial<Omit<MeasureDef, "id" | "label" | "category" | "params">> = {},
): MeasureDef {
  return {
    id,
    label,
    category,
    params,
    output: extra.output ?? "number",
    timeframed: extra.timeframed ?? true,
    short: extra.short,
    keywords: extra.keywords,
  };
}

const attrs: MeasureDef[] = [
  m("open", "Open", "Stock attributes"),
  m("high", "High", "Stock attributes"),
  m("low", "Low", "Stock attributes"),
  m("close", "Close", "Stock attributes", [], { keywords: ["price", "ltp"] }),
  m("volume", "Volume", "Stock attributes"),
  m("pct-change", "% Change", "Stock attributes", [], {
    keywords: ["percent", "change", "gain", "up", "down"],
  }),
  m("vwap", "VWAP", "Stock attributes"),
  m("hl2", "HL2", "Stock attributes"),
  m("hlc3", "HLC3", "Stock attributes"),
  m("ohlc4", "OHLC4", "Stock attributes"),
  m("ha-open", "HA-Open (Heikin-Ashi)", "Stock attributes"),
  m("ha-high", "HA-High (Heikin-Ashi)", "Stock attributes"),
  m("ha-low", "HA-Low (Heikin-Ashi)", "Stock attributes"),
  m("ha-close", "HA-Close (Heikin-Ashi)", "Stock attributes"),
  m("high-52w", "52 week high", "Stock attributes", [], {
    timeframed: false,
    keywords: ["52 week", "yearly high"],
  }),
  m("low-52w", "52 week low", "Stock attributes", [], {
    timeframed: false,
    keywords: ["52 week", "yearly low"],
  }),
  m("market-cap", "Market cap (₹ Cr)", "Stock attributes", [], {
    timeframed: false,
    keywords: ["mcap", "marketcap"],
  }),
  m("symbol", "Symbol", "Stock attributes", [], {
    timeframed: false,
    output: "text",
  }),
  m("sector", "Sector", "Stock attributes", [], {
    timeframed: false,
    output: "text",
  }),
  m("industry", "Industry", "Stock attributes", [], {
    timeframed: false,
    output: "text",
  }),
  m("marketcap-name", "Marketcapname", "Stock attributes", [], {
    timeframed: false,
    output: "text",
    keywords: ["large cap", "mid cap", "small cap"],
  }),
];

const math: MeasureDef[] = [
  m("bracket", "Bracket (value)", "Math functions", [exprParam], {
    short: "",
  }),
  m("max", "Max(duration, value)", "Math functions", [p("duration", 20), exprParam], {
    short: "Max",
  }),
  m("min", "Min(duration, value)", "Math functions", [p("duration", 20), exprParam], {
    short: "Min",
  }),
  m(
    "greatest",
    "Greatest (fields..)",
    "Math functions",
    [exprParam, { ...exprParam, name: "value 2" }],
    { short: "Greatest" },
  ),
  m(
    "least",
    "Least (fields..)",
    "Math functions",
    [exprParam, { ...exprParam, name: "value 2" }],
    { short: "Least" },
  ),
  m("count", "Count(duration, filter)", "Math functions", [p("duration", 5), filterParam], {
    short: "Count",
  }),
  m(
    "countstreak",
    "Countstreak(duration, filter)",
    "Math functions",
    [p("duration", 5), filterParam],
    { short: "Countstreak" },
  ),
  m("abs", "Abs(value)", "Math functions", [exprParam], { short: "Abs" }),
  m("ceil", "Ceil(value)", "Math functions", [exprParam], { short: "Ceil" }),
  m("floor", "Floor(value)", "Math functions", [exprParam], { short: "Floor" }),
  m("round", "Round(value)", "Math functions", [exprParam], { short: "Round" }),
  m("square", "Square(value)", "Math functions", [exprParam], { short: "Square" }),
  m("sqrt", "Square root(value)", "Math functions", [exprParam], { short: "Sqrt" }),
  m("log", "Log(value)", "Math functions", [exprParam], { short: "Log" }),
  m("log10", "Log10(value)", "Math functions", [exprParam], { short: "Log10" }),
];

const pivots: MeasureDef[] = [
  m("pivot", "Pivot point", "Pivots"),
  m("pivot-r1", "Pivot point R1", "Pivots"),
  m("pivot-r2", "Pivot point R2", "Pivots"),
  m("pivot-s1", "Pivot point S1", "Pivots"),
  m("pivot-s2", "Pivot point S2", "Pivots"),
];

const averages: MeasureDef[] = [
  m("sma", "Sma (Simple)", "Moving averages", [src(), p("period", 20)], { short: "Sma" }),
  m("ema", "Ema (Exponential)", "Moving averages", [src(), p("period", 20)], { short: "Ema" }),
  m("wma", "Wma (Weighted)", "Moving averages", [src(), p("period", 20)], { short: "Wma" }),
  m("tma", "Tma (Triangular)", "Moving averages", [src(), p("period", 20)], { short: "Tma" }),
  m("rma", "Rma (Rolling Moving Average)", "Moving averages", [src(), p("period", 20)], {
    short: "Rma",
  }),
  m("tema", "Tema (Triple EMA)", "Moving averages", [src(), p("period", 20)], {
    short: "Tema",
  }),
  m("hma", "Hma (Hull moving average)", "Moving averages", [src(), p("period", 20)], {
    short: "Hma",
  }),
  m("vwma", "Vwma (Volume-weighted avg)", "Moving averages", [p("period", 20)], {
    short: "Vwma",
  }),
  m("std", "Std (Standard Deviation)", "Moving averages", [src(), p("period", 20)], {
    short: "Std",
  }),
  m("sum", "Sum (total for the given period)", "Moving averages", [src("volume"), p("period", 20)], {
    short: "Sum",
  }),
];

const indicators: MeasureDef[] = [
  m("psar", "Parabolic Sar", "Indicators", [p("start", 0.02), p("increment", 0.02), p("max", 0.2)], {
    short: "Parabolic Sar",
  }),
  m("bb-upper", "Upper Bollinger band", "Indicators", [p("period", 20), p("deviation", 2)], {
    short: "Upper Bollinger band",
  }),
  m("bb-lower", "Lower Bollinger band", "Indicators", [p("period", 20), p("deviation", 2)], {
    short: "Lower Bollinger band",
  }),
  m("bb-percent-b", "Bollinger Bands %b", "Indicators", [p("period", 20), p("deviation", 2)], {
    short: "Bollinger %b",
  }),
  m("supertrend", "Supertrend", "Indicators", [p("period", 7), p("multiplier", 3)], {
    short: "Supertrend",
  }),
  m("ichimoku-base", "Ichimoku Base Line", "Indicators", [p("conversion", 9), p("base", 26), p("span", 52)]),
  m("ichimoku-conversion", "Ichimoku Conversion Line", "Indicators", [
    p("conversion", 9),
    p("base", 26),
    p("span", 52),
  ]),
  m("ichimoku-span-a", "Ichimoku Span A", "Indicators", [p("conversion", 9), p("base", 26), p("span", 52)]),
  m("ichimoku-span-b", "Ichimoku Span B", "Indicators", [p("conversion", 9), p("base", 26), p("span", 52)]),
  m("ichimoku-cloud-top", "Ichimoku Cloud Top", "Indicators", [
    p("conversion", 9),
    p("base", 26),
    p("span", 52),
  ]),
  m("ichimoku-cloud-bottom", "Ichimoku Cloud Bottom", "Indicators", [
    p("conversion", 9),
    p("base", 26),
    p("span", 52),
  ]),
  m("accdist", "AccDist (Accumulation/Distribution)", "Indicators", [], { short: "AccDist" }),
  m("rsi", "Rsi (Relative strength)", "Indicators", [p("period", 14)], {
    short: "Rsi",
    keywords: ["relative strength"],
  }),
  m("stochrsi", "StochRsi", "Indicators", [p("rsi", 14), p("stoch", 14), p("k", 3), p("d", 3)], {
    short: "StochRsi",
  }),
  m("cci", "Cci", "Indicators", [p("period", 20)], { short: "Cci" }),
  m("cmf", "Cmf", "Indicators", [p("period", 20)], { short: "Cmf" }),
  m("mfi", "MFi", "Indicators", [p("period", 14)], { short: "Mfi" }),
  m("obv", "OBV (On Balance Volume)", "Indicators", [], { short: "Obv" }),
  m("williams-r", "Williams %R", "Indicators", [p("period", 14)], { short: "Williams %R" }),
  m("intraday-intensity", "Intraday Intensity", "Indicators"),
  m("force-index", "Force Index", "Indicators", [p("period", 13)], { short: "Force Index" }),
  m("macd-line", "Macd Line", "Indicators", [p("fast", 26), p("slow", 12), p("signal", 9)], {
    short: "Macd Line",
  }),
  m("macd-signal", "Macd Signal", "Indicators", [p("fast", 26), p("slow", 12), p("signal", 9)], {
    short: "Macd Signal",
  }),
  m("macd-histogram", "Macd Histogram", "Indicators", [p("fast", 26), p("slow", 12), p("signal", 9)], {
    short: "Macd Histogram",
  }),
  m("adx", "ADX", "Indicators", [p("period", 14)], { short: "Adx" }),
  m("adx-di-positive", "ADX DI Positive", "Indicators", [p("period", 14)], {
    short: "Adx Di Positive",
  }),
  m("adx-di-negative", "ADX DI Negative", "Indicators", [p("period", 14)], {
    short: "Adx Di Negative",
  }),
  m("true-range", "True Range", "Indicators"),
  m("atr", "Avg True Range (ATR)", "Indicators", [p("period", 14)], { short: "Atr" }),
  m("aroon-up", "Aroon Up", "Indicators", [p("period", 14)], { short: "Aroon Up" }),
  m("aroon-down", "Aroon Down", "Indicators", [p("period", 14)], { short: "Aroon Down" }),
  m("aroon-osc", "Aroon Osc", "Indicators", [p("period", 14)], { short: "Aroon Osc" }),
  m("stochastic", "Stochastic", "Indicators", [p("k", 14), p("d", 3)], { short: "Stochastic %K" }),
  m("stochastic-d", "Stochastic %d", "Indicators", [p("k", 14), p("d", 3)], { short: "Stochastic %D" }),
  m("slow-stoch-k", "Slow Stochastic %K", "Indicators", [p("k", 14), p("d", 3)], {
    short: "Slow Stochastic %K",
  }),
  m("slow-stoch-d", "Slow Stochastic %D", "Indicators", [p("k", 14), p("d", 3)], {
    short: "Slow Stochastic %D",
  }),
  m("fast-stoch-k", "Fast Stochastic %K", "Indicators", [p("k", 14), p("d", 3)], {
    short: "Fast Stochastic %K",
  }),
  m("fast-stoch-d", "Fast Stochastic %D", "Indicators", [p("k", 14), p("d", 3)], {
    short: "Fast Stochastic %D",
  }),
  m("roc", "Rate of change (ROC)", "Indicators", [p("period", 9)], { short: "Roc" }),
  m("momentum", "Momentum", "Indicators", [p("period", 10)], { short: "Momentum" }),
  m("wavetrend", "WaveTrend", "Indicators", [p("channel", 10), p("average", 21)], { short: "WaveTrend" }),
  m("wavetrend-trigger", "WaveTrend Trigger", "Indicators", [p("channel", 10), p("average", 21)], {
    short: "WaveTrend Trigger",
  }),
  m("wavetrend-momentum", "WaveTrend Momentum", "Indicators", [p("channel", 10), p("average", 21)], {
    short: "WaveTrend Momentum",
  }),
];

const PATTERNS: readonly [string, string][] = [
  ["green-candle", "Green candle"],
  ["red-candle", "Red candle"],
  ["doji", "Doji"],
  ["dragonfly-doji", "Dragonfly doji"],
  ["gravestone-doji", "Gravestone doji"],
  ["hammer", "Hammer"],
  ["inverted-hammer", "Inverted hammer"],
  ["shooting-star", "Shooting star"],
  ["hanging-man", "Hanging man"],
  ["bullish-engulfing", "Bullish engulfing"],
  ["bearish-engulfing", "Bearish engulfing"],
  ["bullish-harami", "Bullish harami"],
  ["bearish-harami", "Bearish harami"],
  ["marubozu", "Marubozu"],
  ["bullish-marubozu", "Bullish marubozu"],
  ["bearish-marubozu", "Bearish marubozu"],
  ["spinning-top", "Spinning top"],
  ["three-white-soldiers", "Three white soldiers"],
  ["three-black-crows", "Three black crows"],
  ["tweezer-top", "Tweezer top"],
  ["tweezer-bottom", "Tweezer bottom"],
  ["inside-bar", "Inside bar"],
  ["outside-bar", "Outside bar"],
  ["nr7", "NR7 (narrowest range of 7)"],
  ["gap-up", "Gap up"],
  ["gap-down", "Gap down"],
];

const patterns: MeasureDef[] = PATTERNS.map(([id, label]) =>
  m(`pattern:${id}`, label, "Candlestick patterns", [], {
    output: "boolean",
    short: label,
  }),
);

const FUNDAMENTALS: readonly (readonly [string, string, (readonly string[])?])[] = [
  ["pe", "PE ratio (TTM)", ["p/e", "price to earnings"]],
  ["forward-pe", "Forward PE"],
  ["pb", "Price to book", ["p/b"]],
  ["ps", "Price to sales", ["p/s"]],
  ["peg", "PEG ratio"],
  ["eps", "EPS (TTM)", ["earnings per share"]],
  ["book-value", "Book value per share"],
  ["roe", "Return on equity %", ["roe"]],
  ["roa", "Return on assets %", ["roa"]],
  ["profit-margin", "Net profit margin %"],
  ["operating-margin", "Operating margin %"],
  ["dividend-yield", "Dividend yield %"],
  ["dividend-per-share", "Dividend per share"],
  ["payout-ratio", "Payout ratio %"],
  ["sales-growth-yoy", "YoY quarterly sales growth %", ["sales growth", "revenue growth"]],
  ["earnings-growth-yoy", "YoY quarterly profit growth %", ["profit growth", "earnings growth"]],
  ["ev-ebitda", "EV / EBITDA"],
  ["revenue-ttm", "Sales TTM (₹ Cr)", ["revenue", "sales"]],
  ["ebitda", "EBITDA (₹ Cr)"],
  ["insider-holding", "Promoter / insider holding %", ["promoter"]],
  ["institution-holding", "Institutional holding %", ["fii", "dii", "institutions"]],
  ["beta", "Beta"],
];

const fundamentals: MeasureDef[] = FUNDAMENTALS.map(([id, label, keywords]) =>
  m(`fund:${id}`, label, "Fundamentals", [], {
    timeframed: false,
    keywords,
  }),
);

export const MEASURES: readonly MeasureDef[] = [
  ...attrs,
  ...math,
  ...pivots,
  ...averages,
  ...indicators,
  ...patterns,
  ...fundamentals,
];

const byId = new Map(MEASURES.map((measure) => [measure.id, measure]));

export function getMeasure(id: string): MeasureDef | undefined {
  return byId.get(id);
}

export function defaultArgs(def: MeasureDef): Arg[] {
  return def.params.map((param): Arg => {
    switch (param.kind) {
      case "source":
        return { kind: "source", value: (param.default as SourceField) ?? "close" };
      case "expr":
        return { kind: "expr", expr: defaultInnerExpr() };
      case "filter":
        return {
          kind: "filter",
          clause: {
            kind: "clause",
            id: `f${Math.random().toString(36).slice(2, 9)}`,
            enabled: true,
            left: {
              terms: [measureTerm("close")],
              ops: [],
            },
            op: ">",
            right: {
              terms: [{ ...measureTerm("close"), offset: 1 }],
              ops: [],
            },
          },
        };
      default:
        return { kind: "number", value: Number(param.default ?? 0) };
    }
  });
}

function defaultInnerExpr(): Expr {
  return { terms: [measureTerm("close")], ops: [] };
}

export function measureTerm(
  id: string,
  timeframe: TimeframeUnit = "day",
  offset = 0,
  args?: readonly Arg[],
): MeasureTerm {
  const def = getMeasure(id);
  return {
    kind: "measure",
    measure: id,
    timeframe,
    offset,
    args: args ?? (def ? defaultArgs(def) : []),
  };
}

export { numberExpr };

/* ------------------------------------------------------------------------ */
/* Timeframes and segments                                                  */
/* ------------------------------------------------------------------------ */

export const TIMEFRAME_LABELS: Record<TimeframeUnit, { now: string; unit: string; plural: string }> = {
  day: { now: "Daily", unit: "day", plural: "days" },
  week: { now: "Weekly", unit: "week", plural: "weeks" },
  month: { now: "Monthly", unit: "month", plural: "months" },
  quarter: { now: "Quarterly", unit: "quarter", plural: "quarters" },
  year: { now: "Yearly", unit: "year", plural: "years" },
};

export function timeframeText(timeframe: TimeframeUnit, offset: number): string {
  const labels = TIMEFRAME_LABELS[timeframe];
  if (offset <= 0) return labels.now;
  return `${offset} ${offset === 1 ? labels.unit : labels.plural} ago`;
}

export interface SegmentDef {
  readonly id: string;
  readonly label: string;
  readonly group: "Exchange" | "NSE index" | "Market cap";
  /** NSE archive CSV for an index segment. */
  readonly indexCsv?: string;
}

export const SEGMENTS: readonly SegmentDef[] = [
  { id: "cash", label: "cash", group: "Exchange" },
  { id: "bse", label: "bse cash", group: "Exchange" },
  { id: "nifty-50", label: "nifty 50", group: "NSE index", indexCsv: "ind_nifty50list" },
  { id: "nifty-next-50", label: "nifty next 50", group: "NSE index", indexCsv: "ind_niftynext50list" },
  { id: "nifty-100", label: "nifty 100", group: "NSE index", indexCsv: "ind_nifty100list" },
  { id: "nifty-200", label: "nifty 200", group: "NSE index", indexCsv: "ind_nifty200list" },
  { id: "nifty-500", label: "nifty 500", group: "NSE index", indexCsv: "ind_nifty500list" },
  {
    id: "nifty-500-multicap",
    label: "nifty 500 multicap 50:25:25",
    group: "NSE index",
    indexCsv: "ind_nifty500Multicap502525_list",
  },
  { id: "banknifty", label: "banknifty", group: "NSE index", indexCsv: "ind_niftybanklist" },
  {
    id: "nifty-largemidcap-250",
    label: "nifty large midcap 250",
    group: "NSE index",
    indexCsv: "ind_niftylargemidcap250list",
  },
  { id: "nifty-midcap-50", label: "nifty midcap 50", group: "NSE index", indexCsv: "ind_niftymidcap50list" },
  { id: "nifty-midcap-100", label: "nifty midcap 100", group: "NSE index", indexCsv: "ind_niftymidcap100list" },
  { id: "nifty-midcap-150", label: "nifty midcap 150", group: "NSE index", indexCsv: "ind_niftymidcap150list" },
  {
    id: "nifty-midcap-select",
    label: "nifty midcap select",
    group: "NSE index",
    indexCsv: "ind_niftymidcapselect_list",
  },
  {
    id: "nifty-midsmallcap-400",
    label: "nifty mid smallcap 400",
    group: "NSE index",
    indexCsv: "ind_niftymidsmallcap400list",
  },
  {
    id: "nifty-smallcap-50",
    label: "nifty smallcap 50",
    group: "NSE index",
    indexCsv: "ind_niftysmallcap50list",
  },
  {
    id: "nifty-smallcap-100",
    label: "nifty smallcap 100",
    group: "NSE index",
    indexCsv: "ind_niftysmallcap100list",
  },
  {
    id: "nifty-smallcap-250",
    label: "nifty smallcap 250",
    group: "NSE index",
    indexCsv: "ind_niftysmallcap250list",
  },
  {
    id: "nifty-microcap-250",
    label: "nifty microcap 250",
    group: "NSE index",
    indexCsv: "ind_niftymicrocap250_list",
  },
  { id: "large-cap", label: "large cap", group: "Market cap" },
  { id: "mid-cap", label: "mid cap", group: "Market cap" },
  { id: "small-cap", label: "small cap", group: "Market cap" },
  { id: "micro-cap", label: "micro cap", group: "Market cap" },
];

export function getSegment(id: string): SegmentDef | undefined {
  return SEGMENTS.find((segment) => segment.id === id);
}

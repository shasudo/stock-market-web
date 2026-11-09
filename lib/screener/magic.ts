/**
 * Magic filters: turns a plain-language prompt ("stocks up by 4% and rising
 * volume, rsi above 60 on weekly") into scan clauses. Deterministic pattern
 * rules, no model call: every phrase either becomes clauses the user can see
 * and edit, or is reported back as not understood.
 */
import { measureTerm } from "./catalog";
import {
  newId,
  numberExpr,
  type Arg,
  type Clause,
  type CompareOp,
  type Expr,
  type MeasureTerm,
  type SourceField,
  type Term,
  type TimeframeUnit,
} from "./scan-types";
import { getMeasure } from "./catalog";

export interface MagicResult {
  readonly clauses: Clause[];
  readonly unmatched: string[];
}

export const MAGIC_SUGGESTIONS: readonly string[] = [
  "stocks up by 4% and rising volume",
  "close crossed above 20 ema",
  "rsi above 60 and adx above 25",
  "golden cross",
  "volume > 2 x sma(volume,20)",
  "SMA50 in uptrend since last 20 days",
  "hammer",
  "Inverted hammer",
  "Bullish engulfing",
  "Gravestone doji",
  "latest close between 100 and 2000",
  "stocks at 52 week high",
  "consecutive 5 red candles",
  "supertrend and macd positive",
  "EPS greater than 0",
  "YoY sales greater than 20%",
  "pe below 20 and roe above 15",
  "weekly rsi crossed above 50",
  "nr7 inside bar",
  "gap up with high volume",
];

/* ------------------------------------------------------------------ builders */

const t = (id: string, tf: TimeframeUnit = "day", offset = 0, args?: readonly Arg[]): MeasureTerm =>
  measureTerm(id, tf, offset, args);
const ex = (...terms: Term[]): Expr => ({ terms, ops: terms.slice(1).map(() => "+" as const) });
const mul = (a: Term, b: Term): Expr => ({ terms: [a, b], ops: ["*"] });
const n = (value: number): Term => ({ kind: "number", value });
const ma = (kind: string, period: number, source: SourceField = "close", tf: TimeframeUnit = "day", offset = 0): MeasureTerm =>
  t(kind, tf, offset, [
    { kind: "source", value: source },
    { kind: "number", value: period },
  ]);
const clause = (left: Expr, op: CompareOp | null, right: Expr | null): Clause => ({
  kind: "clause",
  id: newId("c"),
  enabled: true,
  left,
  op,
  right,
});
const fn = (id: string, args: Arg[], tf: TimeframeUnit = "day"): MeasureTerm => ({
  kind: "measure",
  measure: id,
  timeframe: tf,
  offset: 0,
  args,
});
const pattern = (id: string): Clause => clause(ex(t(`pattern:${id}`)), null, null);

/* ------------------------------------------------------------------- parsing */

const COMPARATORS: readonly [RegExp, CompareOp][] = [
  [/^(crossed|crosses|cross|crossing)\s+(above|over)/, "crossed-above"],
  [/^(crossed|crosses|cross|crossing)\s+(below|under)/, "crossed-below"],
  [/^(>=|at least|greater than or equal to|greater than equal to)/, ">="],
  [/^(<=|at most|less than or equal to|less than equal to)/, "<="],
  [/^(>|above|greater than|more than|over|higher than|exceeds?|>)/, ">"],
  [/^(<|below|less than|under|lower than)/, "<"],
  [/^(!=|not equal to|not equals)/, "!="],
  [/^(=|==|equals?|equal to|is)/, "="],
];

const CMP_WORDS =
  "(crossed above|crosses above|cross above|crossed over|crossed below|crosses below|cross below|>=|<=|!=|>|<|=|at least|at most|greater than or equal to|greater than equal to|less than or equal to|less than equal to|greater than|less than|more than|higher than|lower than|above|below|over|under|equals?|equal to)";

function comparator(text: string): CompareOp | null {
  const trimmed = text.trim();
  for (const [pattern, op] of COMPARATORS) if (pattern.test(trimmed)) return op;
  return null;
}

function parseNumber(text: string): number {
  const match = /^(-?\d+(?:\.\d+)?)\s*(k|thousand|l|lakh|lakhs|lac|m|mn|million|cr|crore|crores|b|bn|billion)?$/.exec(text.trim());
  if (!match) return Number.NaN;
  const value = Number(match[1]);
  switch (match[2]) {
    case "k":
    case "thousand":
      return value * 1e3;
    case "l":
    case "lakh":
    case "lakhs":
    case "lac":
      return value * 1e5;
    case "m":
    case "mn":
    case "million":
      return value * 1e6;
    case "b":
    case "bn":
    case "billion":
      return value * 1e9;
    default:
      return value;
  }
}

const NUM = "(-?\\d+(?:\\.\\d+)?\\s*(?:k|thousand|lakhs?|lac|l|mn|million|m|crores?|cr|bn|billion|b)?)";

const PATTERN_WORDS: readonly [string, string][] = (
  [
    ["three white soldiers", "three-white-soldiers"],
    ["three black soldiers", "three-black-crows"],
    ["three black crows", "three-black-crows"],
    ["bullish engulfing", "bullish-engulfing"],
    ["bearish engulfing", "bearish-engulfing"],
    ["bullish harami", "bullish-harami"],
    ["bearish harami", "bearish-harami"],
    ["bullish marubozu", "bullish-marubozu"],
    ["bearish marubozu", "bearish-marubozu"],
    ["gravestone doji", "gravestone-doji"],
    ["dragonfly doji", "dragonfly-doji"],
    ["inverted hammer", "inverted-hammer"],
    ["shooting star", "shooting-star"],
    ["hanging man", "hanging-man"],
    ["spinning top", "spinning-top"],
    ["tweezer top", "tweezer-top"],
    ["tweezer bottom", "tweezer-bottom"],
    ["inside bar", "inside-bar"],
    ["inside candle", "inside-bar"],
    ["outside bar", "outside-bar"],
    ["marubozu", "marubozu"],
    ["hammer", "hammer"],
    ["doji", "doji"],
    ["nr7", "nr7"],
    ["gap up", "gap-up"],
    ["gap down", "gap-down"],
    ["green candle", "green-candle"],
    ["red candle", "red-candle"],
  ] as [string, string][]
).sort((a, b) => b[0].length - a[0].length);

const MA_KINDS: Record<string, string> = {
  sma: "sma",
  dma: "sma",
  ma: "sma",
  ema: "ema",
  wma: "wma",
  hma: "hma",
  tema: "tema",
};

const FUNDAMENTAL_WORDS: readonly [RegExp, string, number?][] = [
  [/(?:p\/e|pe ratio|pe|price to earnings)/, "fund:pe"],
  [/(?:p\/b|pb|price to book)/, "fund:pb"],
  [/(?:peg)/, "fund:peg"],
  [/(?:eps|earnings per share)/, "fund:eps"],
  [/(?:roe|return on equity)/, "fund:roe"],
  [/(?:roa|return on assets)/, "fund:roa"],
  [/(?:dividend yield)/, "fund:dividend-yield"],
  [/(?:yoy sales|sales growth|revenue growth|yoy revenue)/, "fund:sales-growth-yoy"],
  [/(?:yoy profit|profit growth|earnings growth|yoy earnings)/, "fund:earnings-growth-yoy"],
  [/(?:net profit margin|profit margin|npm)/, "fund:profit-margin"],
  [/(?:operating margin|opm)/, "fund:operating-margin"],
  [/(?:promoter holding|insider holding)/, "fund:insider-holding"],
  [/(?:institutional holding|fii holding|dii holding)/, "fund:institution-holding"],
  [/(?:ev\/ebitda|ev to ebitda)/, "fund:ev-ebitda"],
  [/(?:beta)/, "fund:beta"],
  [/(?:market cap|marketcap|mcap|m cap)/, "market-cap"],
];

const INDICATOR_WORDS: readonly [RegExp, () => MeasureTerm][] = [
  [/^adx(?:\s*\(?(\d+)\)?)?/, () => t("adx")],
  [/^cci/, () => t("cci")],
  [/^mfi/, () => t("mfi")],
  [/^williams\s*%?\s*r/, () => t("williams-r")],
  [/^stoch(?:astic)?\s*rsi/, () => t("stochrsi")],
  [/^stoch(?:astic)?/, () => t("stochastic")],
  [/^atr/, () => t("atr")],
  [/^roc/, () => t("roc")],
  [/^cmf/, () => t("cmf")],
  [/^aroon\s*up/, () => t("aroon-up")],
  [/^aroon\s*down/, () => t("aroon-down")],
  [/^macd\s*hist(?:ogram)?/, () => t("macd-histogram")],
  [/^macd\s*signal/, () => t("macd-signal")],
  [/^macd(?:\s*line)?/, () => t("macd-line")],
  [/^bollinger\s*%?\s*b/, () => t("bb-percent-b")],
  [/^(?:close|price|ltp|cmp|latest close|last price)/, () => t("close")],
  [/^open/, () => t("open")],
  [/^high/, () => t("high")],
  [/^low/, () => t("low")],
  [/^volume/, () => t("volume")],
  [/^(?:%|percent|pct)\s*change/, () => t("pct-change")],
];

function withPeriod(term: MeasureTerm, period: number | null): MeasureTerm {
  if (!period) return term;
  const def = getMeasure(term.measure);
  const position = def?.params.findIndex((param) => param.kind === "int") ?? -1;
  if (position < 0) return term;
  const args = [...term.args];
  args[position] = { kind: "number", value: period };
  return { ...term, args };
}

/** Rewrites every timeframed measure in a clause onto `tf`. */
function retimeframe(input: Clause, tf: TimeframeUnit): Clause {
  const exprOn = (expr: Expr): Expr => ({ ...expr, terms: expr.terms.map(termOn) });
  const termOn = (term: Term): Term => {
    if (term.kind !== "measure") return term;
    const def = getMeasure(term.measure);
    return {
      ...term,
      timeframe: def?.timeframed ? tf : term.timeframe,
      args: term.args.map((arg): Arg => {
        if (arg.kind === "expr") return { kind: "expr", expr: exprOn(arg.expr) };
        if (arg.kind === "filter") return { kind: "filter", clause: retimeframe(arg.clause, tf) };
        return arg;
      }),
    };
  };
  return {
    ...input,
    left: exprOn(input.left),
    right: input.right ? exprOn(input.right) : null,
  };
}

type Rule = (text: string, tf: TimeframeUnit) => Clause[] | null;

const RULES: Rule[] = [
  // "golden cross" / "death cross"
  (text) =>
    /golden\s*cross/.test(text)
      ? [clause(ex(ma("sma", 50)), "crossed-above", ex(ma("sma", 200)))]
      : /death\s*cross/.test(text)
        ? [clause(ex(ma("sma", 50)), "crossed-below", ex(ma("sma", 200)))]
        : null,

  // "between 100 and 2000"
  (text) => {
    const match = new RegExp(`(?:close|price|ltp|cmp)?\\s*between\\s+${NUM}\\s+(?:to|and|-)\\s+${NUM}`).exec(text);
    if (!match) return null;
    return [
      clause(ex(t("close")), ">", numberExpr(parseNumber(match[1]!))),
      clause(ex(t("close")), "<", numberExpr(parseNumber(match[2]!))),
    ];
  },

  // "up by 4%" / "down 3%"
  (text) => {
    const match = /\b(up|gain(?:ed|ing|ers?)?|rose|rising|risen|down|fall(?:en|ing)?|fell|declin\w*|lost|losers?)\b(?:\s+by)?(?:\s+(?:more than|over|above|at least))?\s+(\d+(?:\.\d+)?)\s*%/.exec(
      text,
    );
    if (!match) return null;
    const down = /down|fall|fell|declin|lost|loser/.test(match[1]!);
    return [clause(ex(t("pct-change")), down ? "<" : ">", numberExpr(down ? -Number(match[2]) : Number(match[2])))];
  },

  // RSI
  (text) => {
    if (/rsi/.test(text) && /overbought/.test(text)) return [clause(ex(t("rsi")), ">", numberExpr(70))];
    if (/rsi/.test(text) && /oversold/.test(text)) return [clause(ex(t("rsi")), "<", numberExpr(30))];
    const match = new RegExp(`(?<!stoch\\s?)rsi\\s*\\(?\\s*(\\d+)?\\s*\\)?\\s*${CMP_WORDS}\\s*${NUM}`).exec(text);
    if (!match) return null;
    const op = comparator(match[2]!);
    if (!op) return null;
    return [clause(ex(withPeriod(t("rsi"), match[1] ? Number(match[1]) : null)), op, numberExpr(parseNumber(match[3]!)))];
  },

  // MA uptrend / downtrend since N days: "SMA50 in uptrend since last 20 days"
  (text) => {
    const match = /\b(sma|ema|dma|wma)\s*\(?\s*(\d+)\s*\)?\s*(?:is\s+)?(?:in\s+)?(uptrend|rising|downtrend|falling)(?:\s+(?:since|for))?(?:\s+(?:the\s+)?last)?\s+(\d+)\s*(?:days?|candles?|sessions?|weeks?|months?)?/.exec(
      text,
    );
    if (!match) return null;
    const kind = MA_KINDS[match[1]!]!;
    const period = Number(match[2]);
    const days = Number(match[4]);
    const rising = /uptrend|rising/.test(match[3]!);
    const inner = clause(ex(ma(kind, period)), rising ? ">" : "<", ex(ma(kind, period, "close", "day", 1)));
    return [
      clause(
        ex(fn("count", [{ kind: "number", value: days }, { kind: "filter", clause: inner }])),
        "=",
        numberExpr(days),
      ),
    ];
  },

  // MA vs MA: "ema 9 crossed above ema 21", "sma50 above sma200"
  (text) => {
    const match = new RegExp(
      `\\b(sma|ema|dma|wma|hma|tema)\\s*\\(?\\s*(\\d+)\\s*\\)?\\s*${CMP_WORDS}\\s*(sma|ema|dma|wma|hma|tema)\\s*\\(?\\s*(\\d+)\\s*\\)?`,
    ).exec(text);
    if (!match) return null;
    const op = comparator(match[3]!);
    if (!op) return null;
    return [clause(ex(ma(MA_KINDS[match[1]!]!, Number(match[2]))), op, ex(ma(MA_KINDS[match[4]!]!, Number(match[5]))))];
  },

  // Price vs MA: "close above 200 ema", "price crossed above sma(50)", "above 50 dma"
  (text) => {
    const match = new RegExp(
      `(?:\\b(?:close|price|ltp|cmp|stock|stocks|trading)\\s*)?${CMP_WORDS}\\s*(?:the\\s+)?(?:(\\d+)\\s*(?:-?\\s*day\\s*)?(sma|ema|dma|wma|hma|tema|ma)|(sma|ema|dma|wma|hma|tema|ma)\\s*\\(?\\s*(?:close\\s*,\\s*)?(\\d+)\\s*\\)?)`,
    ).exec(text);
    if (!match) return null;
    const op = comparator(match[1]!);
    if (!op) return null;
    const kind = MA_KINDS[(match[3] ?? match[4])!]!;
    const period = Number(match[2] ?? match[5]);
    return [clause(ex(t("close")), op, ex(ma(kind, period)))];
  },

  // Price vs a level: "close crossed above upper bollinger band", "above psar"
  (text) => {
    const match = new RegExp(`(?:\\b(?:close|price|ltp|cmp)\\s*)?${CMP_WORDS}\\s*(?:the\\s+)?(.+)$`).exec(text);
    if (!match) return null;
    const op = comparator(match[1]!);
    const level = match[2]!;
    if (!op) return null;
    const levels: readonly [RegExp, string][] = [
      [/^upper bollinger|^upper bb/, "bb-upper"],
      [/^lower bollinger|^lower bb/, "bb-lower"],
      [/^(parabolic sar|psar|sar)\b/, "psar"],
      [/^(pivot )?r1\b/, "pivot-r1"],
      [/^(pivot )?r2\b/, "pivot-r2"],
      [/^(pivot )?s1\b/, "pivot-s1"],
      [/^(pivot )?s2\b/, "pivot-s2"],
      [/^pivot/, "pivot"],
      [/^(ichimoku )?cloud|^kumo/, op === "<" || op === "crossed-below" ? "ichimoku-cloud-bottom" : "ichimoku-cloud-top"],
      [/^(ichimoku )?base line|^kijun/, "ichimoku-base"],
      [/^(ichimoku )?conversion line|^tenkan/, "ichimoku-conversion"],
    ];
    for (const [pattern, id] of levels) {
      if (pattern.test(level)) return [clause(ex(t("close")), op, ex(t(id)))];
    }
    return null;
  },

  // Volume multiples: "volume > 2 x sma(volume,20)", "volume 3 times average"
  (text) => {
    const match = /volume\s*(?:>|greater than|above|more than|over|is)?\s*(\d+(?:\.\d+)?)\s*(?:x|times)\s*(?:the\s+)?(?:(sma|ema|average|avg)\s*)?(?:\(?\s*(?:volume\s*,?\s*)?(\d+)?\s*\)?)?/.exec(
      text,
    );
    if (!match) return null;
    const kind = match[2] === "ema" ? "ema" : "sma";
    return [clause(ex(t("volume")), ">", mul(n(Number(match[1])), ma(kind, match[3] ? Number(match[3]) : 20, "volume")))];
  },
  (text) => {
    if (/(high|heavy|huge|big)\s+volume|volume\s+(spike|shocker|surge|breakout)|volume shockers?/.test(text)) {
      return [clause(ex(t("volume")), ">", mul(n(2), ma("sma", 20, "volume")))];
    }
    if (/(rising|increasing|higher)\s+volume|volume\s+(rising|increasing|up)/.test(text)) {
      return [clause(ex(t("volume")), ">", ex(t("volume", "day", 1)))];
    }
    return null;
  },

  // 52 week
  (text) => {
    if (!/52\s*-?\s*w(?:ee)?k|52w|yearly (high|low)/.test(text)) return null;
    const low = /low/.test(text);
    if (/near|close to|within/.test(text)) {
      return low
        ? [clause(ex(t("close")), "<", mul(n(1.05), t("low-52w")))]
        : [clause(ex(t("close")), ">", mul(n(0.95), t("high-52w")))];
    }
    return low ? [clause(ex(t("low")), "<=", ex(t("low-52w")))] : [clause(ex(t("high")), ">=", ex(t("high-52w")))];
  },

  // N-day breakout / breakdown
  (text) => {
    const match = /(\d+)\s*-?\s*(?:day|days|candle|session)s?\s*(high|low)\b(?:\s*(breakout|breakdown))?|\b(breakout|breakdown)\b/.exec(text);
    if (!match) return null;
    const days = match[1] ? Number(match[1]) : 20;
    const low = match[2] === "low" || match[4] === "breakdown" || match[3] === "breakdown";
    const prior: Arg[] = [
      { kind: "number", value: days },
      { kind: "expr", expr: ex(t(low ? "low" : "high", "day", 1)) },
    ];
    return low
      ? [clause(ex(t("close")), "<", ex(fn("min", prior)))]
      : [clause(ex(t("close")), ">", ex(fn("max", prior)))];
  },

  // "consecutive 5 red candles"
  (text) => {
    const match = /(?:consecutive|continuous|straight)\s*(\d+)\s*(green|red|bullish|bearish|up|down)\s*(?:candles?|days?|bars?|sessions?)|(\d+)\s*(?:consecutive|continuous|straight)\s*(green|red|bullish|bearish|up|down)/.exec(
      text,
    );
    if (!match) return null;
    const count = Number(match[1] ?? match[3]);
    const red = /red|bearish|down/.test((match[2] ?? match[4])!);
    return [
      clause(
        ex(fn("countstreak", [{ kind: "number", value: count }, { kind: "filter", clause: pattern(red ? "red-candle" : "green-candle") }])),
        "=",
        numberExpr(count),
      ),
    ];
  },

  // Supertrend / MACD shorthand
  (text) => {
    const out: Clause[] = [];
    if (/supertrend/.test(text)) {
      if (/cross(ed|es)?\s*(above|over)|buy signal|turned (buy|green|positive)/.test(text)) {
        out.push(clause(ex(t("close")), "crossed-above", ex(t("supertrend"))));
      } else if (/cross(ed|es)?\s*(below|under)|sell signal|turned (sell|red|negative)/.test(text)) {
        out.push(clause(ex(t("close")), "crossed-below", ex(t("supertrend"))));
      } else if (/sell|negative|bearish|red|down/.test(text)) {
        out.push(clause(ex(t("close")), "<", ex(t("supertrend"))));
      } else {
        out.push(clause(ex(t("close")), ">", ex(t("supertrend"))));
      }
    }
    if (/macd/.test(text) && !new RegExp(`macd\\s*(line|signal|hist\\w*)?\\s*${CMP_WORDS}\\s*${NUM}`).test(text)) {
      if (/bearish cross|cross(ed|es)?\s*(below|under)/.test(text)) {
        out.push(clause(ex(t("macd-line")), "crossed-below", ex(t("macd-signal"))));
      } else if (/cross/.test(text)) {
        out.push(clause(ex(t("macd-line")), "crossed-above", ex(t("macd-signal"))));
      } else if (/negative|bearish|below zero/.test(text)) {
        out.push(clause(ex(t("macd-line")), "<", numberExpr(0)));
      } else {
        out.push(clause(ex(t("macd-line")), ">", numberExpr(0)));
        out.push(clause(ex(t("macd-line")), ">", ex(t("macd-signal"))));
      }
    }
    if (/\bvwap\b/.test(text)) {
      out.push(clause(ex(t("close")), /below|under/.test(text) ? "<" : ">", ex(t("vwap"))));
    }
    return out.length ? out : null;
  },

  // Fundamentals: "pe below 20", "market cap above 10000 crore"
  (text) => {
    for (const [pattern, id] of FUNDAMENTAL_WORDS) {
      const match = new RegExp(`(?:^|\\b)${pattern.source}\\s*(?:is\\s+)?${CMP_WORDS}\\s*${NUM}\\s*%?`).exec(text);
      if (!match) continue;
      const op = comparator(match[1]!);
      if (!op) continue;
      let value = parseNumber(match[2]!);
      if (id === "market-cap" && /crores?|cr\b/.test(match[2]!) === false && /lakh|lac|\bl\b/.test(match[2]!)) {
        value /= 1e2;
      }
      return [clause(ex(t(id)), op, numberExpr(value))];
    }
    if (/\broce\b|debt|current ratio|interest cover/.test(text)) return null;
    return null;
  },

  // Generic indicator/field comparisons: "adx above 25", "close > 100"
  (text) => {
    const clauses: Clause[] = [];
    for (const [pattern, build] of INDICATOR_WORDS) {
      const match = new RegExp(`(?:^|\\s)(?:latest\\s+|daily\\s+|weekly\\s+|monthly\\s+)?${pattern.source.slice(1)}\\s*(?:\\(?\\s*(\\d+)\\s*\\)?)?\\s*${CMP_WORDS}\\s*${NUM}`).exec(text);
      if (!match) continue;
      const groups = match.slice(1);
      const value = groups[groups.length - 1]!;
      const opText = groups[groups.length - 2]!;
      const period = groups[groups.length - 3];
      const op = comparator(opText);
      if (!op) continue;
      clauses.push(clause(ex(withPeriod(build(), period ? Number(period) : null)), op, numberExpr(parseNumber(value))));
      break;
    }
    return clauses.length ? clauses : null;
  },

  // Candlestick patterns, possibly several in one phrase ("nr7 inside bar")
  (text) => {
    const out: Clause[] = [];
    let rest = text;
    for (const [word, id] of PATTERN_WORDS) {
      if (rest.includes(word)) {
        out.push(pattern(id));
        rest = rest.replace(word, " ");
      }
    }
    return out.length ? out : null;
  },
];

const FILLER = /\b(stocks?|shares?|scrips?|companies|with|where|having|that|which|are|the|show|me|find|list|all|today|todays|today's|latest|candle on|on the|in)\b/g;

function timeframeOf(text: string): TimeframeUnit {
  if (/\b(weekly|week chart|on week|1w)\b/.test(text) && !/52\s*-?\s*w/.test(text)) return "week";
  if (/\b(monthly|month chart|1m chart)\b/.test(text)) return "month";
  if (/\b(quarterly)\b/.test(text)) return "quarter";
  if (/\b(yearly)\b/.test(text) && !/yearly (high|low)/.test(text)) return "year";
  return "day";
}

function splitPrompt(prompt: string): string[] {
  const normalised = prompt
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/&/g, " and ")
    .replace(/between\s+(\S+)\s+and\s+(\S+)/g, "between $1 to $2")
    .replace(/\s+/g, " ")
    // Commas inside brackets are argument separators, not phrase breaks.
    .replace(/\(([^()]*)\)/g, (group) => group.replace(/,/g, "\u0000"));
  return normalised
    .split(/\s+and\s+|\s+&\s+|,|;|\s\+\s|\s+plus\s+|\n/)
    .map((part) => part.replace(/\u0000/g, ",").trim())
    .filter(Boolean);
}

export function parseMagicPrompt(prompt: string): MagicResult {
  const clauses: Clause[] = [];
  const unmatched: string[] = [];
  const parts = splitPrompt(prompt);

  // "supertrend and macd positive": a bare indicator name inherits the
  // qualifier of the phrase after it.
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (/^(supertrend|macd)$/.test(parts[index]!)) {
      const qualifier = parts[index + 1]!.replace(/^(supertrend|macd)\s*/, "");
      parts[index] = `${parts[index]} ${qualifier}`;
    }
  }

  for (const original of parts) {
    const tf = timeframeOf(original);
    const text = original
      .replace(/\b(weekly|monthly|quarterly|daily|on weekly|on monthly|on daily)\b/g, " ")
      .replace(/\b\d+\s*-?\s*min(?:ute)?s?\b/g, " ")
      .replace(FILLER, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    let matched: Clause[] | null = null;
    for (const rule of RULES) {
      matched = rule(text, tf);
      if (matched && matched.length) break;
    }
    if (!matched || matched.length === 0) {
      unmatched.push(original);
      continue;
    }
    clauses.push(...matched.map((item) => (tf === "day" ? item : retimeframe(item, tf))));
  }
  return { clauses, unmatched };
}

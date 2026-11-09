import { isBasicCandlestickPattern, isBasicChartSignal } from "./patterns";
import {
  resolveTimeframeCapability,
  type TimeframeCapability,
} from "./timeframes";
import type { CapabilitySource, CapabilityStatus } from "./types";

export type ColumnGroupId =
  | "candlesticks"
  | "indicators"
  | "chart-patterns"
  | "drawing-tools"
  | "strategies-builder"
  | "filterings";

export interface ColumnCapability {
  readonly groupId: string;
  readonly itemId: string;
  readonly status: CapabilityStatus;
  readonly source: CapabilitySource;
  /** True only when this core exposes a direct deterministic calculator. */
  readonly computedByCore: boolean;
  /** Whether a valid candle timeframe is required for the selected option. */
  readonly requiresCandles: boolean;
  readonly dependencies: readonly CapabilitySource[];
  readonly message: string;
  readonly timeframe?: TimeframeCapability;
}

/**
 * Indicators the core computes from candles, each from its published formula
 * with TradingView's default parameters (see lib/technical/indicators*.ts).
 * Anything not listed here is reported as unsupported rather than
 * approximated: a column either shows the real value or says it cannot.
 */
const CORE_INDICATOR_IDS = new Set<string>([
  "sma-5",
  "sma-10",
  "sma-20",
  "sma-50",
  "sma-100",
  "sma-200",
  "ema-5",
  "ema-9",
  "ema-10",
  "ema-20",
  "ema-50",
  "ema-100",
  "ema-200",
  "wma",
  "hma",
  "vwma",
  "dema",
  "tema",
  "kama",
  "alma",
  "t3-ma",
  "lsma",
  "moving-average-ribbon",
  "golden-cross",
  "death-cross",
  "rsi",
  "rsi-7",
  "rsi-14",
  "rsi-21",
  "connors-rsi",
  "stochastic-rsi",
  "rsi-overbought",
  "rsi-oversold",
  "macd",
  "macd-crossover",
  "macd-histogram",
  "ppo",
  "apo",
  "stochastic",
  "stochastic-fast",
  "stochastic-slow",
  "cci",
  "williams-r",
  "roc",
  "momentum",
  "awesome-oscillator",
  "tsi",
  "trix",
  "ultimate-oscillator",
  "coppock-curve",
  "dpo",
  "kst",
  "fisher-transform",
  "chande-momentum-oscillator",
  "supertrend",
  "supertrend-buy-sell",
  "adx",
  "di-plus",
  "di-minus",
  "aroon",
  "aroon-oscillator",
  "parabolic-sar",
  "ichimoku-cloud",
  "vortex-indicator",
  "mass-index",
  "choppiness-index",
  "trend-intensity-index",
  "atr",
  "atr-trailing-stop",
  "bollinger-bands",
  "bollinger-bandwidth",
  "bollinger-percent-b",
  "bollinger-squeeze",
  "keltner-channel",
  "donchian-channel",
  "price-channel",
  "standard-deviation",
  "historical-volatility",
  "chaikin-volatility",
  "ulcer-index",
  "vwap",
  "vwap-cross",
  "volume",
  "volume-ma",
  "volume-spike",
  "relative-volume",
  "obv",
  "mfi",
  "chaikin-money-flow",
  "accumulation-distribution",
  "force-index",
  "ease-of-movement",
  "negative-volume-index",
  "positive-volume-index",
  "price-volume-trend",
  "volume-oscillator",
  "pivot-points",
  "standard-pivots",
  "fibonacci-pivots",
  "camarilla-pivots",
  "woodie-pivots",
  "demark-pivots",
  "central-pivot-range",
  "envelopes",
  "linear-regression-channel",
  "ma-crossover",
  "ema-crossover",
  "price-above-sma-50",
  "price-below-sma-50",
  "price-above-sma-200",
  "price-below-sma-200",
]);

/** Overlays that only exist relative to user-chosen anchors or swing points. */
const ANCHORED_INDICATOR_IDS = new Set<string>([
  "zig-zag",
  "anchored-vwap",
  "support-resistance",
  "fibonacci-retracement",
  "fibonacci-extension",
  "gann-fan",
]);

/** Market-wide breadth measures; a single stock's candles cannot produce them. */
const BREADTH_INDICATOR_IDS = new Set<string>([
  "high-low-index",
  "new-high-new-low",
]);

const LIVE_FEED_INDICATOR_IDS = new Set<string>([
  "advance-decline-line",
  "advance-decline-ratio",
  "mcclellan-oscillator",
  "mcclellan-summation-index",
  "trin",
]);

const LOCAL_FILTERING_IDS = new Set<string>([
  "price-range",
  "volatility-filter",
  "previous-close",
  "gap-up-filter",
  "gap-down-filter",
  "near-52-week-high",
  "near-52-week-low",
  "new-52-week-high",
  "new-52-week-low",
  "near-all-time-high",
  "near-all-time-low",
  "new-all-time-high",
  "new-all-time-low",
  "distance-from-high",
  "distance-from-low",
  "daily-return",
  "weekly-return",
  "monthly-return",
  "quarterly-return",
  "yearly-return",
  "ytd-return",
  "one-year-return",
  "three-year-return",
  "five-year-return",
  "ten-year-return",
  "average-volume",
  "relative-volume",
  "volume-change",
  "volume-spike",
  "sma-position",
  "ema-position",
  "moving-average-alignment",
  "moving-average-crossover",
  "rsi-range",
  "rsi-overbought",
  "rsi-oversold",
  "macd-signal",
  "macd-histogram",
  "bollinger-bandwidth",
  "historical-volatility",
  "maximum-drawdown",
  "standard-deviation",
  "stochastic-range",
  "adx-range",
  "cci-range",
  "mfi-range",
  "williams-r-range",
  "supertrend-signal",
  "parabolic-sar-signal",
  "ichimoku-position",
  "bollinger-position",
  "vwap-position",
  "pivot-position",
  "cpr-width",
  "atr-range",
]);

const DHAN_QUOTE_FILTERING_IDS = new Set<string>([
  "exchange",
  "stock-series",
  "current-price",
  "previous-close",
  "open-price",
  "day-high",
  "day-low",
  "price-change",
  "percentage-change",
  "volume",
  "volume-range",
  "near-day-high",
  "near-day-low",
  "market-cap-range",
  "sector-filter",
  "industry",
  "face-value",
  "price-band",
  // Dhan's quote carries the session's average traded price, so traded
  // value is average price × volume — the exchange's own turnover measure.
  "turnover",
  "traded-value",
]);

const LIVE_FEED_FILTERING_IDS = new Set<string>([
  "number-of-trades",
  "average-trade-size",
  "bid-ask-spread",
  "market-depth",
  "liquidity",
  "futures-oi",
  "futures-oi-change",
  "futures-basis",
  "rollover-percentage",
  "long-buildup",
  "short-buildup",
  "long-unwinding",
  "short-covering",
]);

const OPTION_CHAIN_FILTERING_IDS = new Set<string>([
  "options-open-interest",
  "put-call-ratio",
  "max-pain",
  "implied-volatility",
  "option-delta",
  "option-gamma",
  "option-theta",
  "option-vega",
]);

const HISTORICAL_OPTION_CHAIN_FILTERING_IDS = new Set<string>([
  "iv-percentile",
  "iv-rank",
]);

const EVENT_FILTERING_IDS = new Set<string>([
  "earnings-date",
  "results-announcement",
  "dividend-date",
  "ex-dividend-date",
  "bonus-date",
  "split-date",
  "rights-issue-date",
  "board-meeting-date",
  "bulk-deal",
  "block-deal",
  "insider-trading",
  "credit-rating-change",
  "analyst-rating",
  "target-price-upside",
]);

const FUNDAMENTAL_FILTERING_IDS = new Set<string>([
  "index-membership",
  "sub-industry",
  "delivery-volume",
  "delivery-percentage",
  "free-float-market-cap",
  "enterprise-value",
  "pe-ratio",
  "forward-pe",
  "peg-ratio",
  "pb-ratio",
  "ps-ratio",
  "ev-ebitda",
  "ev-sales",
  "price-cash-flow",
  "price-free-cash-flow",
  "earnings-yield",
  "book-value",
  "intrinsic-value",
  "margin-of-safety",
  "dividend-yield",
  "dividend-payout",
  "dividend-growth",
  "sales",
  "sales-growth",
  "quarterly-sales-growth",
  "annual-sales-growth",
  "profit",
  "profit-growth",
  "quarterly-profit-growth",
  "annual-profit-growth",
  "eps",
  "eps-growth",
  "ebitda",
  "ebitda-growth",
  "gross-margin",
  "operating-margin",
  "net-profit-margin",
  "margin-expansion",
  "roe",
  "roce",
  "roa",
  "roic",
  "asset-turnover",
  "inventory-turnover",
  "receivables-days",
  "working-capital-days",
  "cash-conversion-cycle",
  "debt",
  "debt-equity",
  "net-debt",
  "interest-coverage",
  "current-ratio",
  "quick-ratio",
  "cash-flow-operations",
  "free-cash-flow",
  "cash-flow-growth",
  "capex",
  "promoter-holding",
  "promoter-pledge",
  "promoter-holding-change",
  "fii-holding",
  "fii-holding-change",
  "dii-holding",
  "dii-holding-change",
  "mutual-fund-holding",
  "institutional-holding",
  "public-holding",
  "shareholder-count",
  "piotroski-score",
  "altman-z-score",
  "beneish-m-score",
  "quality-score",
  "value-score",
  "momentum-score",
  "growth-score",
  "financial-strength",
  "earnings-quality",
  "accounting-risk",
]);

const BENCHMARK_OR_CONFIGURATION_FILTERING_IDS = new Set<string>([
  "beta",
  "alpha",
  "sharpe-ratio",
  "sortino-ratio",
  "correlation-index",
  "relative-strength-index",
]);

const FUNDAMENTAL_STRATEGY_IDS = new Set<string>([
  "earnings-momentum",
  "post-earnings-drift",
  "event-driven",
  "sector-rotation",
  "quality-momentum",
  "value-momentum",
  "growth-at-reasonable-price",
  "deep-value",
  "dividend-growth",
  "magic-formula",
  "piotroski-f-score",
  "can-slim",
  "coffee-can",
  "small-cap-growth",
  "large-cap-quality",
  "institutional-activity",
  "smart-money",
  "delivery-volume",
]);

const OPTION_STRATEGY_IDS = new Set<string>([
  "options-long-call",
  "options-long-put",
  "covered-call",
  "protective-put",
  "bull-call-spread",
  "bear-put-spread",
  "short-straddle",
  "long-straddle",
  "short-strangle",
  "long-strangle",
  "iron-condor",
  "iron-butterfly",
  "calendar-spread",
  "ratio-spread",
  "options-gamma-scalping",
  "options-volatility-crush",
]);

const LIVE_STRATEGY_IDS = new Set<string>([
  "intraday-scalping",
  "vwap-scalping",
  "momentum-scalping",
  "opening-drive",
  "first-hour",
  "power-hour",
  "opening-range-breakout",
  "initial-balance-breakout",
  "futures-trend",
  "futures-basis",
]);

/**
 * Resolves every known picker group without importing UI configuration. Unknown
 * option IDs are deliberately manual instead of being assumed to be available.
 * Pass a timeframe for local-candle options to surface the sub-minute feed gate.
 */
export function resolveColumnCapability(
  groupId: string,
  itemId: string,
  timeframeId?: string,
): ColumnCapability {
  const base = resolveBaseColumnCapability(groupId, itemId);
  if (!timeframeId || !base.requiresCandles || base.status !== "supported") {
    return base;
  }

  const timeframe = resolveTimeframeCapability(timeframeId);
  if (timeframe.status === "supported") return { ...base, timeframe };

  return {
    ...base,
    status: timeframe.status,
    source: timeframe.source,
    computedByCore: false,
    dependencies: uniqueDependencies([
      ...base.dependencies,
      base.source,
      timeframe.source,
    ]),
    message: `${base.message} ${timeframe.message}`,
    timeframe,
  };
}

function resolveBaseColumnCapability(
  groupId: string,
  itemId: string,
): ColumnCapability {
  switch (groupId) {
    case "candlesticks":
      return resolveCandlestickCapability(groupId, itemId);
    case "indicators":
      return resolveIndicatorCapability(groupId, itemId);
    case "chart-patterns":
      return resolveChartPatternCapability(groupId, itemId);
    case "drawing-tools":
      return manual(
        groupId,
        itemId,
        "manual-chart",
        "Drawing tools need user-selected anchors on an interactive chart; a market-data API cannot infer them.",
        ["local-candles"],
      );
    case "strategies-builder":
      return resolveStrategyCapability(groupId, itemId);
    case "filterings":
      return resolveFilteringCapability(groupId, itemId);
    default:
      return manual(
        groupId,
        itemId,
        "unknown",
        "Unknown option groups are disabled until an explicit capability is defined.",
      );
  }
}

function resolveCandlestickCapability(
  groupId: string,
  itemId: string,
): ColumnCapability {
  if (isBasicCandlestickPattern(itemId)) {
    return supported(
      groupId,
      itemId,
      "local-candles",
      "The deterministic core evaluates this pattern from completed OHLC candles.",
      true,
      true,
    );
  }
  return manual(
    groupId,
    itemId,
    "manual-chart",
    "This candlestick pattern has no implemented detector; the core only reports patterns it evaluates from explicit rules.",
    ["local-candles"],
  );
}

function resolveIndicatorCapability(
  groupId: string,
  itemId: string,
): ColumnCapability {
  if (CORE_INDICATOR_IDS.has(itemId)) {
    return supported(
      groupId,
      itemId,
      "local-candles",
      "The core calculates this indicator from Dhan OHLCV candles.",
      true,
      true,
    );
  }
  if (LIVE_FEED_INDICATOR_IDS.has(itemId)) {
    return manual(
      groupId,
      itemId,
      "dhan-live-feed",
      "This breadth indicator needs a configured universe-wide Dhan feed and aggregation rule. The visible-symbol ticker collector does not calculate it yet.",
      ["dhan-live-feed"],
    );
  }
  if (itemId === "delivery-volume") {
    return fundamentals(
      groupId,
      itemId,
      "Delivery volume comes from exchange delivery data and needs an external market-data provider.",
      "external-market-data",
    );
  }
  if (itemId === "put-call-ratio") {
    return manual(
      groupId,
      itemId,
      "dhan-option-chain",
      "The put/call ratio needs the underlying's Dhan option chain for a chosen expiry.",
      ["dhan-option-chain"],
    );
  }
  if (ANCHORED_INDICATOR_IDS.has(itemId)) {
    return manual(
      groupId,
      itemId,
      "manual-chart",
      "This overlay is defined by user-chosen anchors or swing points on a chart; there is no single value to compute from candles alone.",
      ["local-candles"],
    );
  }
  if (BREADTH_INDICATOR_IDS.has(itemId)) {
    return manual(
      groupId,
      itemId,
      "dhan-live-feed",
      "This is a market-breadth measure across the whole universe, not a per-stock value; it needs a universe-wide aggregation that is not configured.",
      ["dhan-live-feed"],
    );
  }
  return manual(
    groupId,
    itemId,
    "manual-chart",
    "This indicator has no implemented formula in the core, so no value is shown rather than an approximation.",
    ["local-candles"],
  );
}

function resolveChartPatternCapability(
  groupId: string,
  itemId: string,
): ColumnCapability {
  if (isBasicChartSignal(itemId)) {
    return supported(
      groupId,
      itemId,
      "local-candles",
      "The deterministic core evaluates this chart signal from completed OHLC candles.",
      true,
      true,
    );
  }
  return manual(
    groupId,
    itemId,
    "manual-chart",
    "This chart pattern needs configured pivots, tolerances, or a dedicated detector; raw Dhan candles alone do not justify a signal.",
    ["local-candles"],
  );
}

function resolveStrategyCapability(
  groupId: string,
  itemId: string,
): ColumnCapability {
  if (FUNDAMENTAL_STRATEGY_IDS.has(itemId)) {
    return manual(
      groupId,
      itemId,
      "manual-strategy",
      "This strategy depends on reported financials, events, or ownership data from an external provider and still needs user-defined rules.",
      ["fundamentals-provider"],
    );
  }
  if (OPTION_STRATEGY_IDS.has(itemId)) {
    return manual(
      groupId,
      itemId,
      "manual-strategy",
      "Options strategies require a user-selected expiry, strikes, entry, exit, and risk rules. Dhan option-chain data is an input, not an automatically executable strategy.",
      ["dhan-option-chain"],
    );
  }
  if (LIVE_STRATEGY_IDS.has(itemId)) {
    return manual(
      groupId,
      itemId,
      "manual-strategy",
      "This intraday strategy needs a live feed plus user-defined entry, exit, and risk parameters.",
      ["dhan-live-feed", "local-candles"],
    );
  }
  return manual(
    groupId,
    itemId,
    "manual-strategy",
    "A strategy is a configurable trading rule, not a single market-data field. Define its parameters before enabling it.",
    ["local-candles"],
  );
}

function resolveFilteringCapability(
  groupId: string,
  itemId: string,
): ColumnCapability {
  if (FUNDAMENTAL_FILTERING_IDS.has(itemId)) {
    return fundamentals(
      groupId,
      itemId,
      "This fundamental or ownership field requires a financial-statements and shareholding provider; Dhan candles do not contain it.",
    );
  }
  if (EVENT_FILTERING_IDS.has(itemId)) {
    return fundamentals(
      groupId,
      itemId,
      "This corporate event, deal, rating, or analyst field needs an external events provider.",
      "events-provider",
    );
  }
  if (OPTION_CHAIN_FILTERING_IDS.has(itemId)) {
    return manual(
      groupId,
      itemId,
      "dhan-option-chain",
      "This Dhan option-chain field needs an expiry and underlying-specific collector. It is disabled until that selection workflow is configured.",
      ["dhan-option-chain"],
    );
  }
  if (HISTORICAL_OPTION_CHAIN_FILTERING_IDS.has(itemId)) {
    return manual(
      groupId,
      itemId,
      "dhan-option-chain",
      "IV rank and percentile require a stored historical implied-volatility series in addition to the current Dhan option chain.",
      ["dhan-option-chain"],
    );
  }
  if (LIVE_FEED_FILTERING_IDS.has(itemId)) {
    return manual(
      groupId,
      itemId,
      "dhan-live-feed",
      "This depth or derivative metric needs the Dhan full-feed mode and an instrument-specific aggregation rule. The current ticker collector intentionally does not fabricate it.",
      ["dhan-live-feed"],
    );
  }
  if (DHAN_QUOTE_FILTERING_IDS.has(itemId)) {
    return supported(
      groupId,
      itemId,
      "dhan-rest",
      "Dhan market quote or instrument metadata can supply this field.",
    );
  }
  if (LOCAL_FILTERING_IDS.has(itemId)) {
    return supported(
      groupId,
      itemId,
      "local-candles",
      "Dhan OHLCV history provides the inputs for this local technical or return filter.",
      false,
      true,
    );
  }
  if (BENCHMARK_OR_CONFIGURATION_FILTERING_IDS.has(itemId)) {
    return manual(
      groupId,
      itemId,
      "manual-chart",
      "This filter compares the stock with a benchmark index series that is not stored, so it stays disabled rather than showing an estimate.",
      ["local-candles"],
    );
  }
  return manual(
    groupId,
    itemId,
    "unknown",
    "This option has no approved data mapping yet, so it remains disabled rather than returning an empty or fabricated value.",
  );
}

function supported(
  groupId: string,
  itemId: string,
  source: CapabilitySource,
  message: string,
  computedByCore = false,
  requiresCandles = false,
): ColumnCapability {
  return {
    groupId,
    itemId,
    status: "supported",
    source,
    computedByCore,
    requiresCandles,
    dependencies: [],
    message,
  };
}

function fundamentals(
  groupId: string,
  itemId: string,
  message: string,
  source: CapabilitySource = "fundamentals-provider",
  additionalDependencies: readonly CapabilitySource[] = [],
): ColumnCapability {
  return {
    groupId,
    itemId,
    status: "needs-fundamentals",
    source,
    computedByCore: false,
    requiresCandles: false,
    dependencies: uniqueDependencies([source, ...additionalDependencies]),
    message,
  };
}

function manual(
  groupId: string,
  itemId: string,
  source: CapabilitySource,
  message: string,
  dependencies: readonly CapabilitySource[] = [],
): ColumnCapability {
  return {
    groupId,
    itemId,
    status: "needs-manual-input",
    source,
    computedByCore: false,
    requiresCandles: false,
    dependencies: uniqueDependencies([source, ...dependencies]),
    message,
  };
}

function uniqueDependencies(
  dependencies: readonly CapabilitySource[],
): CapabilitySource[] {
  return [...new Set(dependencies)];
}

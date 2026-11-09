/**
 * Real, working definitions for TradingView's built-in Technicals list.
 * Every entry computes from its published formula (see
 * lib/technical/indicators-research.ts) — no aliases, no stubs.
 */
import {
  COLORS,
  areaPlot,
  decimalField,
  fill,
  histogramPlot,
  lengthField,
  level,
  levelAnchor,
  linePlot,
  numberField,
  numberInput,
  offsetField,
  selectField,
  sourceField,
  stringInput,
} from "./indicator-catalog-builders";
import {
  normalizeProfileRows,
  normalizeValueAreaPct,
  sessionLevelSeries,
} from "./session-profile";
import type { IndicatorInputs } from "./indicator-schema";
import {
  type CandleSource,
  type IndicatorDefinition,
  resolveSourceSeries,
} from "./indicator-schema";
import {
  bollingerBands,
  exponentialMovingAverage,
  simpleMovingAverage,
  smoothedMovingAverage,
} from "./indicators";
import {
  accumulationDistribution,
  arnaudLegouxMovingAverage,
  aroon,
  awesomeOscillator,
  chandeMomentumOscillator,
  chaikinMoneyFlow,
  choppinessIndex,
  commodityChannelIndex,
  connorsRsi,
  coppockCurve,
  detrendedPriceOscillator,
  directionalMovementIndex,
  donchianChannel,
  easeOfMovement,
  envelopes,
  fisherTransform,
  forceIndex,
  ichimoku,
  kaufmanAdaptiveMovingAverage,
  keltnerChannel,
  knowSureThing,
  leastSquaresMovingAverage,
  linearRegressionChannel,
  massIndex,
  moneyFlowIndex,
  momentum,
  parabolicSar,
  percentagePriceOscillator,
  pivotPoints,
  priceVolumeTrend,
  stochasticRsi,
  trix,
  trueStrengthIndex,
  ulcerIndex,
  ultimateOscillator,
  volumeIndex,
  volumeOscillator,
  volumeWeightedMovingAverage,
  vortexIndicator,
  williamsPercentR,
} from "./indicators-extended";
import { shiftSeries } from "./indicator-schema";
import {
  autoAnchoredVwap,
  balanceOfPower,
  bollingerTrend,
  chandeKrollStop,
  chandelierExit,
  cumulativeAverage,
  cumulativeVolumeDelta,
  cumulativeVolumeIndex,
  klingerOscillator,
  mcginleyDynamic,
  medianChannel,
  moonPhases,
  movingAverageByMethod,
  netVolume,
  performanceSinceStart,
  pivotPointsHighLow,
  priceMomentumOscillator,
  rankCorrelationIndex,
  relativeVigorIndex,
  relativeVolatilityIndex,
  rollingCorrelation,
  rsiDivergence,
  seasonality,
  autoProfileAnchor,
  developingDistribution,
  sessionVolumeProfile,
  staticDistribution,
  toFiniteSeries,
  sessionGaps,
  smiErgodic,
  specialK,
  tripleExponentialMovingAverage,
  upDownVolume,
  volatilityStop,
  volumeDelta,
  zigzag,
} from "./indicators-research";
import type { Candle } from "./types";

export function booleanInput(
  inputs: IndicatorInputs,
  id: string,
  fallback: boolean,
): boolean {
  const value = inputs[id];
  return typeof value === "boolean" ? value : fallback;
}

export function sessionTimeZone(inputs: IndicatorInputs): string {
  const value = inputs["timeZone"];
  return typeof value === "string" && value.length > 0
    ? value
    : "Asia/Kolkata";
}

const SESSION_TIMEZONE_FIELD = selectField("timeZone", "Session timezone", "Asia/Kolkata", [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
]);

const VALUE_AREA_FIELD = numberField("valueAreaPct", "Value area %", 70, 50, 95);

const SHOW_HISTOGRAM_FIELD = {
  kind: "boolean" as const,
  id: "showHistogram",
  label: "Show histogram",
  defaultValue: true,
};

const SHOW_VALUE_AREA_FIELD = {
  kind: "boolean" as const,
  id: "showValueArea",
  label: "Show value area",
  defaultValue: true,
};

function seriesOf(
  candles: readonly Candle[],
  inputs: IndicatorInputs,
  id = "source",
): readonly (number | null)[] {
  return resolveSourceSeries(
    candles,
    (typeof inputs[id] === "string" ? inputs[id] : "close") as CandleSource,
  );
}

function methodField(defaultValue = "sma"): ReturnType<typeof selectField> {
  return selectField("method", "Method", defaultValue, [
    { value: "sma", label: "SMA" },
    { value: "ema", label: "EMA" },
    { value: "wma", label: "WMA" },
    { value: "smma", label: "SMMA" },
    { value: "hull", label: "Hull" },
  ]);
}

function maLabel(prefix: string) {
  return (inputs: IndicatorInputs): string =>
    `${prefix} ${numberInput(inputs, "length")} ${stringInput(inputs, "source")}`;
}

/**
 * TradingView's Session Volume Profile (and its HD variant): inputs mirror
 * TradingView's settings dialog; the histogram, value area and POC/VAH/VAL
 * are drawn per session by SessionVolumeProfilePrimitive on the chart, which
 * reads the plot colours below. The plots still compute POC/VAH/VAL so the
 * legend and data window show the session's levels.
 */
function sessionVolumeProfileDefinition(
  id: string,
  name: string,
  shortName: string,
  defaultRows: number,
): IndicatorDefinition {
  return {
    id,
    name,
    shortName,
    description:
      "TradingView-style session volume profile: one volume-at-price histogram per session, split into up and down volume, brighter inside the value area, with the session POC and optional VAH/VAL, previous-session levels, initial balance and summary table.",
    category: "volume",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [
      numberField("rows", "Row size", defaultRows, 2, 200),
      selectField("volumeMode", "Volume", "updown", [
        { value: "updown", label: "Up/Down" },
        { value: "total", label: "Total" },
        { value: "delta", label: "Delta" },
      ]),
      VALUE_AREA_FIELD,
      numberField("widthPct", "Width (% of the box)", 40, 5, 100),
      selectField("placement", "Placement", "left", [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ]),
      { kind: "boolean", id: "extendPocRight", label: "Extend POC right", defaultValue: false },
      SHOW_HISTOGRAM_FIELD,
      SHOW_VALUE_AREA_FIELD,
      {
        kind: "boolean",
        id: "showPrevious",
        label: "Previous session levels (pPOC, pVAH, pVAL, PDH, PDL)",
        defaultValue: false,
      },
      { kind: "boolean", id: "showInitialBalance", label: "Initial balance (IBH, IBL)", defaultValue: false },
      numberField("ibMinutes", "Initial balance minutes", 60, 5, 375),
      { kind: "boolean", id: "showTable", label: "Info table", defaultValue: false },
      SESSION_TIMEZONE_FIELD,
    ],
    plots: [
      linePlot("poc", "POC", COLORS.red, { lineWidth: 2 }),
      linePlot("vah", "Value Area High", COLORS.blue, { lineWidth: 1, visible: false }),
      linePlot("val", "Value Area Low", COLORS.blue, { lineWidth: 1, visible: false }),
      histogramPlot("valueArea", "Value Area Up/Down", "#26c6da", "direction", {
        upColor: "#26c6da",
        downColor: "#ec407a",
        opacity: 80,
      }),
      histogramPlot("volume", "Up/Down Volume", "#26c6da", "direction", {
        upColor: "#26c6da",
        downColor: "#ec407a",
        opacity: 35,
      }),
    ],
    levels: [],
    fills: [
      fill("value", "Value area background", { kind: "plot", id: "vah" }, { kind: "plot", id: "val" }, {
        color: "#26c6da",
        opacity: 8,
      }),
    ],
    formatLabel: (inputs) =>
      `${normalizeProfileRows(numberInput(inputs, "rows"), defaultRows)} ${normalizeValueAreaPct(numberInput(inputs, "valueAreaPct"), 70)}%`,
    compute: (candles, inputs) => {
      const { poc, vah, val } = sessionLevelSeries(candles, {
        rows: numberInput(inputs, "rows"),
        valueAreaPct: numberInput(inputs, "valueAreaPct"),
        timeZone: sessionTimeZone(inputs),
      });
      // Colour carriers for the histogram; the chart primitive draws it.
      const none = candles.map(() => null);
      return { poc, vah, val, valueArea: none, volume: [...none] };
    },
  };
}

export const CLASSIC_DEFINITIONS: readonly IndicatorDefinition[] = [
  {
    id: "wma",
    name: "Weighted Moving Average",
    shortName: "WMA",
    description: "Linearly weighted mean; the newest bar carries most weight.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(9), sourceField("close"), offsetField()],
    plots: [linePlot("ma", "WMA", COLORS.orange, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: maLabel(""),
    compute: (candles, inputs) => ({
      ma: movingAverageByMethod(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        "wma",
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "hull",
    name: "Hull Moving Average",
    shortName: "HMA",
    description: "WMA(half) doubled minus WMA(full), smoothed by WMA(sqrt).",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(9), sourceField("close"), offsetField()],
    plots: [linePlot("ma", "HMA", COLORS.teal, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: maLabel(""),
    compute: (candles, inputs) => ({
      ma: movingAverageByMethod(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        "hull",
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "dema",
    name: "Double Exponential Moving Average",
    shortName: "DEMA",
    description: "2 × EMA − EMA(EMA): faster than EMA with less lag.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(21), sourceField("close"), offsetField()],
    plots: [linePlot("ma", "DEMA", COLORS.purple, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: maLabel(""),
    compute: (candles, inputs) => {
      const values = seriesOf(candles, inputs).map(
        (value) => value ?? Number.NaN,
      );
      const length = numberInput(inputs, "length");
      const first = exponentialMovingAverage(values, length).map(
        (value) => value ?? Number.NaN,
      );
      const second = exponentialMovingAverage(first, length);
      return {
        ma: first.map((value, index) => {
          const double = second[index];
          return value === null || double === null
            ? null
            : 2 * value - double;
        }),
      };
    },
  },
  {
    id: "mcginley",
    name: "McGinley Dynamic",
    shortName: "MD",
    description: "Self-adjusting average that tracks fast markets closely.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(14), sourceField("close"), offsetField()],
    plots: [linePlot("ma", "MD", COLORS.blue, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: maLabel(""),
    compute: (candles, inputs) => ({
      ma: mcginleyDynamic(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "kama",
    name: "Kaufman's Adaptive Moving Average",
    shortName: "KAMA",
    description: "Efficiency-ratio adaptive average; flat in chop, fast in runs.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("erLength", "ER length", 10, 1, 5000),
      numberField("fastLength", "Fast length", 2, 1, 5000),
      numberField("slowLength", "Slow length", 30, 1, 5000),
      sourceField("close"),
      offsetField(),
    ],
    plots: [linePlot("ma", "KAMA", COLORS.orange, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "erLength")} ${numberInput(inputs, "fastLength")} ${numberInput(inputs, "slowLength")}`,
    compute: (candles, inputs) => ({
      ma: kaufmanAdaptiveMovingAverage(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "erLength"),
        numberInput(inputs, "fastLength"),
        numberInput(inputs, "slowLength"),
      ),
    }),
  },
  {
    id: "lsma",
    name: "Least Squares Moving Average",
    shortName: "LSMA",
    description: "Least-squares regression endpoint; leads turning points.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(25), sourceField("close"), offsetField()],
    plots: [linePlot("ma", "LSMA", COLORS.slate, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: maLabel(""),
    compute: (candles, inputs) => ({
      ma: leastSquaresMovingAverage(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "median",
    name: "Median",
    shortName: "Median",
    description:
      "Median of the mid-range with its EMA cloud and ATR envelope bands.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      sourceField("hl2"),
      numberField("length", "Median length", 14, 1, 5000),
      numberField("atrLength", "ATR length", 14, 1, 5000),
      decimalField("multiplier", "ATR multiplier", 2, 0.1, 20, 0.1),
    ],
    plots: [
      linePlot("median", "Median", COLORS.blue, { lineWidth: 2 }),
      linePlot("emaLine", "EMA", COLORS.orange, { lineWidth: 1 }),
      linePlot("upper", "Upper", COLORS.slate, { lineWidth: 1 }),
      linePlot("lower", "Lower", COLORS.slate, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [
      fill("cloud", "Cloud", { kind: "plot", id: "median" }, { kind: "plot", id: "emaLine" }, {
        color: COLORS.teal,
        opacity: 14,
      }),
    ],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "atrLength")} ${numberInput(inputs, "multiplier")}`,
    compute: (candles, inputs) =>
      medianChannel(
        candles,
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
        numberInput(inputs, "atrLength"),
        numberInput(inputs, "multiplier"),
      ),
  },
  {
    id: "alma",
    name: "Arnaud Legoux Moving Average",
    shortName: "ALMA",
    description: "Gaussian-weighted average; smooth with low lag.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      lengthField(9),
      sourceField("close"),
      decimalField("offset", "Offset", 0.85, 0, 1, 0.01),
      decimalField("sigma", "Sigma", 6, 1, 20, 0.5),
    ],
    plots: [linePlot("ma", "ALMA", COLORS.blue, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: maLabel(""),
    compute: (candles, inputs) => ({
      ma: arnaudLegouxMovingAverage(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
        numberInput(inputs, "offset"),
        numberInput(inputs, "sigma"),
      ),
    }),
  },
  {
    id: "maribbon",
    name: "Moving Average Ribbon",
    shortName: "MA Ribbon",
    description: "Six EMAs fanning out with trend strength.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(10), sourceField("close")],
    plots: [1, 1.5, 2, 2.5, 3, 4].map((factor, index) =>
      linePlot(`ma${index + 1}`, `EMA ${factor}×`, COLORS.blue, {
        lineWidth: 1,
      }),
    ),
    levels: [],
    fills: [],
    formatLabel: maLabel(""),
    compute: (candles, inputs) => {
      const values = seriesOf(candles, inputs).map(
        (value) => value ?? Number.NaN,
      );
      const base = numberInput(inputs, "length");
      const out: Record<string, (number | null)[]> = {};
      [1, 1.5, 2, 2.5, 3, 4].forEach((factor, index) => {
        out[`ma${index + 1}`] = exponentialMovingAverage(
          values,
          Math.max(1, Math.round(base * factor)),
        );
      });
      return out;
    },
  },
  {
    id: "macross",
    name: "Moving Average Crossover",
    shortName: "MA Cross",
    description: "Fast/slow average cross with a direction histogram.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("fastLength", "Fast length", 9, 1, 5000),
      numberField("slowLength", "Slow length", 21, 1, 5000),
      methodField(),
      sourceField("close"),
    ],
    plots: [
      linePlot("fast", "Fast", COLORS.blue, { lineWidth: 2 }),
      linePlot("slow", "Slow", COLORS.orange, { lineWidth: 2 }),
      histogramPlot("cross", "Cross", COLORS.teal, "sign", { opacity: 60 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "fastLength")} ${numberInput(inputs, "slowLength")}`,
    compute: (candles, inputs) => {
      const values = seriesOf(candles, inputs).map(
        (value) => value ?? Number.NaN,
      );
      const method = stringInput(inputs, "method");
      const fast = movingAverageByMethod(
        values,
        method,
        numberInput(inputs, "fastLength"),
      );
      const slow = movingAverageByMethod(
        values,
        method,
        numberInput(inputs, "slowLength"),
      );
      const cross = candles.map((_, index) => {
        const f = fast[index];
        const s = slow[index];
        if (f === null || s === null) return null;
        return f >= s ? 1 : -1;
      });
      return { fast, slow, cross };
    },
  },
  {
    id: "twap",
    name: "Time-Weighted Average Price",
    shortName: "TWAP",
    description: "Rolling time-weighted mean price of the source.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(20), sourceField("close")],
    plots: [linePlot("ma", "TWAP", COLORS.slate, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: maLabel(""),
    compute: (candles, inputs) => ({
      ma: simpleMovingAverage(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "vwapanchored",
    name: "VWAP Auto-Anchored",
    shortName: "AVWAP",
    description: "VWAP cumulated from the highest-volume bar.",
    category: "volume",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [],
    plots: [linePlot("vwap", "AVWAP", COLORS.orange, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => ({ vwap: autoAnchoredVwap(candles) }),
  },
  {
    id: "vwma",
    name: "Volume-Weighted Moving Average",
    shortName: "VWMA",
    description: "Mean price weighted by volume over the lookback.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [lengthField(20)],
    plots: [linePlot("ma", "VWMA", COLORS.blue, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      ma: volumeWeightedMovingAverage(
        candles,
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "adr",
    name: "Average Daily Range",
    shortName: "ADR",
    description: "Simple average of the daily high-low range.",
    category: "volatility",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(20)],
    plots: [linePlot("adr", "ADR", COLORS.blue, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      adr: simpleMovingAverage(
        candles.map((candle) => candle.high - candle.low),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "donchian",
    name: "Donchian Channels",
    shortName: "DC",
    description: "Highest high / lowest low with a midline basis.",
    category: "volatility",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(20)],
    plots: [
      linePlot("basis", "Basis", COLORS.orange, { lineWidth: 1 }),
      linePlot("upper", "Upper", COLORS.blue, { lineWidth: 1 }),
      linePlot("lower", "Lower", COLORS.blue, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => {
      const channel = donchianChannel(candles, numberInput(inputs, "length"));
      return {
        basis: channel.middle,
        upper: channel.upper,
        lower: channel.lower,
      };
    },
  },
  {
    id: "keltner",
    name: "Keltner Channels",
    shortName: "KC",
    description: "EMA basis with ATR-multiple bands.",
    category: "volatility",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      lengthField(20),
      decimalField("multiplier", "Multiplier", 2, 0.1, 20, 0.1),
    ],
    plots: [
      linePlot("basis", "Basis", COLORS.orange, { lineWidth: 1 }),
      linePlot("upper", "Upper", COLORS.blue, { lineWidth: 1 }),
      linePlot("lower", "Lower", COLORS.blue, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "multiplier")}`,
    compute: (candles, inputs) => {
      const channel = keltnerChannel(
        candles,
        numberInput(inputs, "length"),
        numberInput(inputs, "multiplier"),
      );
      return {
        basis: channel.middle,
        upper: channel.upper,
        lower: channel.lower,
      };
    },
  },
  {
    id: "envelope",
    name: "Envelope",
    shortName: "ENV",
    description: "SMA band set ± percent around the source.",
    category: "volatility",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      lengthField(20),
      decimalField("percent", "Percent", 10, 0.1, 100, 0.5),
      sourceField("close"),
    ],
    plots: [
      linePlot("basis", "Basis", COLORS.orange, { lineWidth: 1 }),
      linePlot("upper", "Upper", COLORS.blue, { lineWidth: 1 }),
      linePlot("lower", "Lower", COLORS.blue, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "percent")}%`,
    compute: (candles, inputs) => {
      const channel = envelopes(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
        numberInput(inputs, "percent"),
      );
      return {
        basis: channel.middle,
        upper: channel.upper,
        lower: channel.lower,
      };
    },
  },
  {
    id: "linregchannel",
    name: "Linear Regression Channel",
    shortName: "LRC",
    description: "Least-squares fit with standard-deviation rails.",
    category: "volatility",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("length", "Length", 100, 2, 5000),
      decimalField("deviations", "Deviations", 2, 0.1, 10, 0.1),
      sourceField("close"),
    ],
    plots: [
      linePlot("basis", "Basis", COLORS.orange, { lineWidth: 1 }),
      linePlot("upper", "Upper", COLORS.blue, { lineWidth: 1 }),
      linePlot("lower", "Lower", COLORS.blue, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "deviations")}`,
    compute: (candles, inputs) => {
      const channel = linearRegressionChannel(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
        numberInput(inputs, "deviations"),
      );
      return {
        basis: channel.middle,
        upper: channel.upper,
        lower: channel.lower,
      };
    },
  },
  {
    id: "ichimoku",
    name: "Ichimoku Cloud",
    shortName: "Ichimoku",
    description: "Conversion/base lines with a forward-displaced cloud.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("conversion", "Conversion", 9, 1, 5000),
      numberField("base", "Base", 26, 1, 5000),
      numberField("span", "Span B", 52, 1, 5000),
    ],
    plots: [
      linePlot("conversion", "Conversion", COLORS.blue, { lineWidth: 1 }),
      linePlot("base", "Base", COLORS.red, { lineWidth: 1 }),
      linePlot("lead1", "Lead 1", COLORS.teal, { lineWidth: 1 }),
      linePlot("lead2", "Lead 2", COLORS.orange, { lineWidth: 1 }),
      linePlot("lagging", "Lagging", COLORS.purple, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [
      fill("cloud", "Cloud", { kind: "plot", id: "lead1" }, { kind: "plot", id: "lead2" }, {
        color: COLORS.slate,
        opacity: 12,
      }),
    ],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "conversion")} ${numberInput(inputs, "base")} ${numberInput(inputs, "span")}`,
    compute: (candles, inputs) => {
      const cloud = ichimoku(
        candles,
        numberInput(inputs, "conversion"),
        numberInput(inputs, "base"),
        numberInput(inputs, "span"),
      );
      return {
        conversion: cloud.tenkan,
        base: cloud.kijun,
        lead1: cloud.cloudA,
        lead2: cloud.cloudB,
        lagging: shiftSeries(
          candles.map((candle) => candle.close),
          numberInput(inputs, "base") * -1,
        ),
      };
    },
  },
  {
    id: "psar",
    name: "Parabolic SAR",
    shortName: "SAR",
    description: "Wilder's stop-and-reverse dots that trail the trend.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      decimalField("start", "Start", 0.02, 0.001, 1, 0.005),
      decimalField("increment", "Increment", 0.02, 0.001, 1, 0.005),
      decimalField("maximum", "Max value", 0.2, 0.01, 2, 0.01),
    ],
    plots: [linePlot("sar", "SAR", COLORS.red, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "start")} ${numberInput(inputs, "increment")} ${numberInput(inputs, "maximum")}`,
    compute: (candles, inputs) => ({
      sar: parabolicSar(
        candles,
        numberInput(inputs, "start"),
        numberInput(inputs, "increment"),
        numberInput(inputs, "maximum"),
      ).sar,
    }),
  },
  {
    id: "alligator",
    name: "Williams Alligator",
    shortName: "Alligator",
    description: "Jaw, teeth and lips: three displaced smoothed averages.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [sourceField("hl2")],
    plots: [
      linePlot("jaw", "Jaw", COLORS.blue, { lineWidth: 2 }),
      linePlot("teeth", "Teeth", COLORS.red, { lineWidth: 2 }),
      linePlot("lips", "Lips", COLORS.teal, { lineWidth: 2 }),
    ],
    levels: [],
    fills: [],
    formatLabel: () => "13 8 5",
    compute: (candles, inputs) => {
      const values = seriesOf(candles, inputs).map(
        (value) => value ?? Number.NaN,
      );
      return {
        jaw: shiftSeries(smoothedMovingAverage(values, 13), 8),
        teeth: shiftSeries(smoothedMovingAverage(values, 8), 5),
        lips: shiftSeries(smoothedMovingAverage(values, 5), 3),
      };
    },
  },
  {
    id: "aroon",
    name: "Aroon",
    shortName: "Aroon",
    description: "Bars since the highest high / lowest low, up vs down.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(14)],
    plots: [
      linePlot("up", "Aroon Up", COLORS.teal, { lineWidth: 2 }),
      linePlot("down", "Aroon Down", COLORS.red, { lineWidth: 2 }),
    ],
    levels: [level("upper", "Overbought", 70, { editable: true }), level("lower", "Oversold", 30, { editable: true })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => {
      const { up, down } = aroon(candles, numberInput(inputs, "length"));
      return { up, down };
    },
  },
  {
    id: "adx",
    name: "Average Directional Index",
    shortName: "ADX",
    description: "Wilder's trend-strength gauge from +DI and −DI.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("diLength", "DI length", 14, 1, 5000),
      numberField("adxLength", "ADX smoothing", 14, 1, 5000),
    ],
    plots: [
      linePlot("adx", "ADX", COLORS.red, { lineWidth: 2 }),
      linePlot("plus", "+DI", COLORS.teal, { lineWidth: 1 }),
      linePlot("minus", "−DI", COLORS.orange, { lineWidth: 1 }),
    ],
    levels: [level("strong", "Strong trend", 25, { editable: true })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "diLength")} ${numberInput(inputs, "adxLength")}`,
    compute: (candles, inputs) => {
      const { adx, plusDi, minusDi } = directionalMovementIndex(
        candles,
        numberInput(inputs, "diLength"),
        numberInput(inputs, "adxLength"),
      );
      return { adx, plus: plusDi, minus: minusDi };
    },
  },
  {
    id: "dmi",
    name: "Directional Movement Index",
    shortName: "DMI",
    description: "+DI and −DI crossovers with the ADX trend filter.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("diLength", "DI length", 14, 1, 5000),
      numberField("adxLength", "ADX smoothing", 14, 1, 5000),
    ],
    plots: [
      linePlot("plus", "+DI", COLORS.teal, { lineWidth: 2 }),
      linePlot("minus", "−DI", COLORS.red, { lineWidth: 2 }),
      linePlot("adx", "ADX", COLORS.slate, { lineWidth: 1 }),
    ],
    levels: [level("strong", "Strong trend", 25, { editable: true })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "diLength")} ${numberInput(inputs, "adxLength")}`,
    compute: (candles, inputs) => {
      const { adx, plusDi, minusDi } = directionalMovementIndex(
        candles,
        numberInput(inputs, "diLength"),
        numberInput(inputs, "adxLength"),
      );
      return { plus: plusDi, minus: minusDi, adx };
    },
  },
  {
    id: "chandelier",
    name: "Chandelier Exit",
    shortName: "CE",
    description: "ATR-based trailing exit hanging off the extreme.",
    category: "volatility",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      lengthField(22),
      decimalField("multiplier", "Multiplier", 3, 0.1, 20, 0.1),
    ],
    plots: [
      linePlot("long", "Long", COLORS.teal, { lineWidth: 1 }),
      linePlot("short", "Short", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "multiplier")}`,
    compute: (candles, inputs) => {
      const { long, short } = chandelierExit(
        candles,
        numberInput(inputs, "length"),
        numberInput(inputs, "multiplier"),
      );
      return { long, short };
    },
  },
  {
    id: "chandekroll",
    name: "Chande Kroll Stop",
    shortName: "CKS",
    description: "ATR stops pushed to the extreme of the last q bars.",
    category: "volatility",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("p", "P", 10, 1, 5000),
      decimalField("multiplier", "Multiplier", 1, 0.1, 20, 0.1),
      numberField("q", "Q", 9, 1, 5000),
    ],
    plots: [
      linePlot("long", "Long", COLORS.teal, { lineWidth: 1 }),
      linePlot("short", "Short", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "p")} ${numberInput(inputs, "multiplier")} ${numberInput(inputs, "q")}`,
    compute: (candles, inputs) => {
      const { long, short } = chandeKrollStop(
        candles,
        numberInput(inputs, "p"),
        numberInput(inputs, "multiplier"),
        numberInput(inputs, "q"),
      );
      return { long, short };
    },
  },
  {
    id: "vstop",
    name: "Volatility Stop",
    shortName: "VStop",
    description: "Ratcheting ATR trailing stop that flips on a close cross.",
    category: "volatility",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      lengthField(20),
      decimalField("multiplier", "Multiplier", 2, 0.1, 20, 0.1),
    ],
    plots: [linePlot("stop", "Stop", COLORS.red, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "multiplier")}`,
    compute: (candles, inputs) => ({
      stop: volatilityStop(
        candles,
        numberInput(inputs, "length"),
        numberInput(inputs, "multiplier"),
      ),
    }),
  },
  {
    id: "pivots",
    name: "Pivot Points Standard",
    shortName: "Pivots",
    description: "Classic floor pivots rolled forward from the prior bar.",
    category: "performance",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [],
    plots: [
      linePlot("p", "P", COLORS.orange, { lineWidth: 2 }),
      linePlot("r1", "R1", COLORS.teal, { lineWidth: 1 }),
      linePlot("r2", "R2", COLORS.teal, { lineWidth: 1 }),
      linePlot("r3", "R3", COLORS.teal, { lineWidth: 1 }),
      linePlot("s1", "S1", COLORS.red, { lineWidth: 1 }),
      linePlot("s2", "S2", COLORS.red, { lineWidth: 1 }),
      linePlot("s3", "S3", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: () => "Standard",
    compute: (candles) => {
      const p: (number | null)[] = [];
      const r1: (number | null)[] = [];
      const r2: (number | null)[] = [];
      const r3: (number | null)[] = [];
      const s1: (number | null)[] = [];
      const s2: (number | null)[] = [];
      const s3: (number | null)[] = [];
      for (let index = 0; index < candles.length; index += 1) {
        if (index === 0) {
          p.push(null);
          r1.push(null);
          r2.push(null);
          r3.push(null);
          s1.push(null);
          s2.push(null);
          s3.push(null);
          continue;
        }
        const levels = pivotPoints(candles[index - 1]!, "standard");
        p.push(levels.pivot);
        r1.push(levels.resistances[0] ?? null);
        r2.push(levels.resistances[1] ?? null);
        r3.push(levels.resistances[2] ?? null);
        s1.push(levels.supports[0] ?? null);
        s2.push(levels.supports[1] ?? null);
        s3.push(levels.supports[2] ?? null);
      }
      return { p, r1, r2, r3, s1, s2, s3 };
    },
  },
  {
    id: "pivotshl",
    name: "Pivot Points High Low",
    shortName: "Pivots HL",
    description: "Floor pivots from the rolling highest high / lowest low.",
    category: "performance",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [numberField("window", "Window", 10, 2, 5000)],
    plots: [
      linePlot("p", "P", COLORS.orange, { lineWidth: 2 }),
      linePlot("r1", "R1", COLORS.teal, { lineWidth: 1 }),
      linePlot("r2", "R2", COLORS.teal, { lineWidth: 1 }),
      linePlot("s1", "S1", COLORS.red, { lineWidth: 1 }),
      linePlot("s2", "S2", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "window")}`,
    compute: (candles, inputs) => {
      const levels = pivotPointsHighLow(candles, numberInput(inputs, "window"));
      return {
        p: levels.pivot,
        r1: levels.r1,
        r2: levels.r2,
        s1: levels.s1,
        s2: levels.s2,
      };
    },
  },
  {
    id: "zigzag",
    name: "Zigzag",
    shortName: "ZigZag",
    description: "Swing highs/lows that reverse by at least N percent.",
    category: "performance",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [decimalField("deviation", "Deviation %", 5, 0.5, 50, 0.5)],
    plots: [linePlot("zigzag", "ZigZag", COLORS.blue, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "deviation")}%`,
    compute: (candles, inputs) => ({
      zigzag: zigzag(candles, numberInput(inputs, "deviation")),
    }),
  },
  {
    id: "bbtrend",
    name: "BBTrend",
    shortName: "BBTrend",
    description: "John Bollinger's trend gauge from two band envelopes.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("shortLength", "Short length", 20, 1, 5000),
      decimalField("shortMult", "Short mult", 2, 0.1, 10, 0.1),
      numberField("longLength", "Long length", 50, 1, 5000),
      decimalField("longMult", "Long mult", 2, 0.1, 10, 0.1),
      sourceField("close"),
    ],
    plots: [
      histogramPlot("trend", "BBTrend", COLORS.blue, "sign", { opacity: 80 }),
    ],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "shortLength")} ${numberInput(inputs, "longLength")}`,
    compute: (candles, inputs) => ({
      trend: bollingerTrend(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "shortLength"),
        numberInput(inputs, "shortMult"),
        numberInput(inputs, "longLength"),
        numberInput(inputs, "longMult"),
      ),
    }),
  },
  {
    id: "bollingerbars",
    name: "Bollinger Bars",
    shortName: "BB Bars",
    description: "Bollinger basis and bands drawn over the price bars.",
    category: "volatility",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      lengthField(20),
      decimalField("multiplier", "StdDev", 2, 0.1, 10, 0.1),
      sourceField("close"),
    ],
    plots: [
      linePlot("basis", "Basis", COLORS.orange, { lineWidth: 1 }),
      linePlot("upper", "Upper", COLORS.blue, { lineWidth: 1 }),
      linePlot("lower", "Lower", COLORS.blue, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "multiplier")}`,
    compute: (candles, inputs) => {
      const bands = bollingerBands(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
        numberInput(inputs, "multiplier"),
      );
      return { basis: bands.middle, upper: bands.upper, lower: bands.lower };
    },
  },
  {
    id: "perf",
    name: "Performance",
    shortName: "Perf",
    description: "Percent change of the source since the first bar.",
    category: "performance",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [sourceField("close")],
    plots: [linePlot("perf", "Performance", COLORS.blue, { lineWidth: 2 })],
    levels: [level("zero", "Break-even", 0, { editable: false })],
    fills: [],
    formatLabel: () => "",
    compute: (candles, inputs) => ({
      perf: performanceSinceStart(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
      ),
    }),
  },
  {
    id: "corr",
    name: "Correlation Coefficient",
    shortName: "CC",
    description: "Rolling Pearson correlation between close and volume.",
    category: "performance",
    pane: "separate",
    defaultPrecision: 3,
    requiresVolume: true,
    inputs: [lengthField(20)],
    plots: [linePlot("corr", "Correlation", COLORS.red, { lineWidth: 2 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      corr: rollingCorrelation(
        candles.map((candle) => candle.close),
        candles.map((candle) => candle.volume ?? Number.NaN),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "visavg",
    name: "Visible Average Price",
    shortName: "VAP",
    description: "Cumulative mean price of everything seen so far.",
    category: "performance",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [sourceField("close")],
    plots: [linePlot("avg", "Average", COLORS.slate, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles, inputs) => ({
      avg: cumulativeAverage(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
      ),
    }),
  },
  {
    id: "stochrsi",
    name: "Stochastic RSI",
    shortName: "Stoch RSI",
    description: "Stochastic applied to RSI instead of price.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("rsiLength", "RSI length", 14, 1, 5000),
      numberField("stochLength", "Stochastic length", 14, 1, 5000),
      numberField("smoothK", "%K smoothing", 3, 1, 5000),
      numberField("smoothD", "%D smoothing", 3, 1, 5000),
      sourceField("close"),
    ],
    plots: [
      linePlot("k", "K", COLORS.blue, { lineWidth: 2 }),
      linePlot("d", "D", COLORS.orange, { lineWidth: 2 }),
    ],
    levels: [
      level("upper", "Overbought", 80, { editable: true }),
      level("lower", "Oversold", 20, { editable: true }),
    ],
    fills: [
      fill("band", "Background", levelAnchor("upper"), levelAnchor("lower"), {
        color: COLORS.blue,
        opacity: 10,
      }),
    ],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "rsiLength")} ${numberInput(inputs, "stochLength")} ${numberInput(inputs, "smoothK")} ${numberInput(inputs, "smoothD")}`,
    compute: (candles, inputs) => {
      const { k, d } = stochasticRsi(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "rsiLength"),
        numberInput(inputs, "stochLength"),
        numberInput(inputs, "smoothK"),
        numberInput(inputs, "smoothD"),
      );
      return { k, d };
    },
  },
  {
    id: "smi",
    name: "SMI Ergodic Indicator",
    shortName: "SMI",
    description: "William Blau's double-smoothed momentum oscillator.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("longLength", "Long length", 20, 1, 5000),
      numberField("shortLength", "Short length", 5, 1, 5000),
      numberField("signalLength", "Signal smoothing", 5, 1, 5000),
    ],
    plots: [
      linePlot("smi", "SMI", COLORS.blue, { lineWidth: 2 }),
      linePlot("signal", "Signal", COLORS.orange, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "longLength")} ${numberInput(inputs, "shortLength")} ${numberInput(inputs, "signalLength")}`,
    compute: (candles, inputs) =>
      smiErgodic(
        candles,
        numberInput(inputs, "longLength"),
        numberInput(inputs, "shortLength"),
        numberInput(inputs, "signalLength"),
      ),
  },
  {
    id: "smimom",
    name: "Stochastic Momentum Index",
    shortName: "SMI Mom",
    description: "Distance of the close from the range midpoint, smoothed twice.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("longLength", "Long length", 20, 1, 5000),
      numberField("shortLength", "Short length", 5, 1, 5000),
      numberField("signalLength", "Signal smoothing", 5, 1, 5000),
    ],
    plots: [
      linePlot("smi", "SMI", COLORS.purple, { lineWidth: 2 }),
      linePlot("signal", "Signal", COLORS.orange, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "longLength")} ${numberInput(inputs, "shortLength")} ${numberInput(inputs, "signalLength")}`,
    compute: (candles, inputs) =>
      smiErgodic(
        candles,
        numberInput(inputs, "longLength"),
        numberInput(inputs, "shortLength"),
        numberInput(inputs, "signalLength"),
      ),
  },
  {
    id: "tsi",
    name: "True Strength Index",
    shortName: "TSI",
    description: "Double-smoothed momentum over double-smoothed absolute momentum.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("longLength", "Long length", 25, 1, 5000),
      numberField("shortLength", "Short length", 13, 1, 5000),
      numberField("signalLength", "Signal smoothing", 13, 1, 5000),
      sourceField("close"),
    ],
    plots: [
      linePlot("tsi", "TSI", COLORS.blue, { lineWidth: 2 }),
      linePlot("signal", "Signal", COLORS.orange, { lineWidth: 1 }),
    ],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "longLength")} ${numberInput(inputs, "shortLength")} ${numberInput(inputs, "signalLength")}`,
    compute: (candles, inputs) =>
      trueStrengthIndex(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "longLength"),
        numberInput(inputs, "shortLength"),
        numberInput(inputs, "signalLength"),
      ),
  },
  {
    id: "fisher",
    name: "Fisher Transform",
    shortName: "Fisher",
    description: "Normalizes the median price into a near-Gaussian wave.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [numberField("length", "Length", 9, 1, 5000)],
    plots: [
      linePlot("fisher", "Fisher", COLORS.blue, { lineWidth: 2 }),
      linePlot("trigger", "Trigger", COLORS.orange, { lineWidth: 1 }),
    ],
    levels: [
      level("upper", "Overbought", 1.5, { editable: true }),
      level("lower", "Oversold", -1.5, { editable: true }),
    ],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => {
      const { fisher, trigger } = fisherTransform(candles, numberInput(inputs, "length"));
      return { fisher, trigger };
    },
  },
  {
    id: "connorsrsi",
    name: "Connors RSI",
    shortName: "CRSI",
    description: "Mean of RSI(3), streak RSI(2) and 100-bar percent rank.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [sourceField("close")],
    plots: [linePlot("crsi", "CRSI", COLORS.blue, { lineWidth: 2 })],
    levels: [
      level("upper", "Overbought", 70, { editable: true }),
      level("lower", "Oversold", 30, { editable: true }),
    ],
    fills: [],
    formatLabel: () => "3 2 100",
    compute: (candles, inputs) => ({
      crsi: connorsRsi(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
      ),
    }),
  },
  {
    id: "coppock",
    name: "Coppock Curve",
    shortName: "Coppock",
    description: "WMA of summed 14- and 11-period rates of change.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("wmaLength", "WMA length", 10, 1, 5000),
      numberField("longRoc", "Long ROC", 14, 1, 5000),
      numberField("shortRoc", "Short ROC", 11, 1, 5000),
      sourceField("close"),
    ],
    plots: [linePlot("coppock", "Coppock", COLORS.teal, { lineWidth: 2 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "wmaLength")} ${numberInput(inputs, "longRoc")} ${numberInput(inputs, "shortRoc")}`,
    compute: (candles, inputs) => ({
      coppock: coppockCurve(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "wmaLength"),
        numberInput(inputs, "longRoc"),
        numberInput(inputs, "shortRoc"),
      ),
    }),
  },
  {
    id: "kst",
    name: "Know Sure Thing",
    shortName: "KST",
    description: "Pring's summed rate of change with a 9-bar signal.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [sourceField("close")],
    plots: [
      linePlot("kst", "KST", COLORS.teal, { lineWidth: 2 }),
      linePlot("signal", "Signal", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: () => "10 15 20 30",
    compute: (candles, inputs) => {
      const { kst, signal } = knowSureThing(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
      );
      return { kst, signal };
    },
  },
  {
    id: "specialk",
    name: "Pring's Special K",
    shortName: "Special K",
    description: "Weighted sum of twelve smoothed rates of change.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [sourceField("close")],
    plots: [
      linePlot("k", "K", COLORS.blue, { lineWidth: 2 }),
      linePlot("signal", "Signal", COLORS.orange, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles, inputs) =>
      specialK(seriesOf(candles, inputs).map((value) => value ?? Number.NaN)),
  },
  {
    id: "ultosc",
    name: "Ultimate Oscillator",
    shortName: "UO",
    description: "Williams' triple-timeframe buying-pressure gauge.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("fast", "Fast", 7, 1, 5000),
      numberField("medium", "Medium", 14, 1, 5000),
      numberField("slow", "Slow", 28, 1, 5000),
    ],
    plots: [linePlot("uo", "UO", COLORS.blue, { lineWidth: 2 })],
    levels: [
      level("upper", "Overbought", 70, { editable: true }),
      level("lower", "Oversold", 30, { editable: true }),
    ],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "fast")} ${numberInput(inputs, "medium")} ${numberInput(inputs, "slow")}`,
    compute: (candles, inputs) => ({
      uo: ultimateOscillator(
        candles,
        numberInput(inputs, "fast"),
        numberInput(inputs, "medium"),
        numberInput(inputs, "slow"),
      ),
    }),
  },
  {
    id: "awesome",
    name: "Awesome Oscillator",
    shortName: "AO",
    description: "SMA(5) − SMA(34) of the bar midpoint.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("fast", "Fast", 5, 1, 5000),
      numberField("slow", "Slow", 34, 1, 5000),
    ],
    plots: [histogramPlot("ao", "AO", COLORS.teal, "sign", { opacity: 80 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "fast")} ${numberInput(inputs, "slow")}`,
    compute: (candles, inputs) => ({
      ao: awesomeOscillator(
        candles,
        numberInput(inputs, "fast"),
        numberInput(inputs, "slow"),
      ),
    }),
  },
  {
    id: "bullbear",
    name: "Bull Bear Power",
    shortName: "BBP",
    description: "Elder's bull (high − EMA) and bear (low − EMA) power.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(13)],
    plots: [
      linePlot("bull", "Bull", COLORS.teal, { lineWidth: 1 }),
      linePlot("bear", "Bear", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => {
      const emaLine = exponentialMovingAverage(
        candles.map((candle) => candle.close),
        numberInput(inputs, "length"),
      );
      return {
        bull: candles.map((candle, index) => {
          const average = emaLine[index];
          return average === null ? null : candle.high - average;
        }),
        bear: candles.map((candle, index) => {
          const average = emaLine[index];
          return average === null ? null : candle.low - average;
        }),
      };
    },
  },
  {
    id: "forceindex",
    name: "Elder's Force Index",
    shortName: "Force",
    description: "Volume-weighted close-to-close change, EMA smoothed.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [numberField("length", "Length", 13, 1, 5000)],
    plots: [linePlot("force", "Force", COLORS.blue, { lineWidth: 2 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      force: forceIndex(candles, numberInput(inputs, "length")),
    }),
  },
  {
    id: "cmo",
    name: "Chande Momentum Oscillator",
    shortName: "CMO",
    description: "100 × (up − down) / (up + down) sums over N bars.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [numberField("length", "Length", 9, 1, 5000), sourceField("close")],
    plots: [linePlot("cmo", "CMO", COLORS.blue, { lineWidth: 2 })],
    levels: [
      level("upper", "Overbought", 50, { editable: true }),
      level("lower", "Oversold", -50, { editable: true }),
    ],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      cmo: chandeMomentumOscillator(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "vortex",
    name: "Vortex Indicator",
    shortName: "VI",
    description: "Up vs down vortex movement normalized by true range.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(14)],
    plots: [
      linePlot("plus", "VI+", COLORS.teal, { lineWidth: 2 }),
      linePlot("minus", "VI−", COLORS.red, { lineWidth: 2 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => {
      const { plus, minus } = vortexIndicator(candles, numberInput(inputs, "length"));
      return { plus, minus };
    },
  },
  {
    id: "trix",
    name: "TRIX",
    shortName: "TRIX",
    description: "Triple-EMA rate of change; filters minor moves.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 4,
    requiresVolume: false,
    inputs: [numberField("length", "Length", 18, 1, 5000), sourceField("close")],
    plots: [linePlot("trix", "TRIX", COLORS.blue, { lineWidth: 2 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      trix: trix(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "rci",
    name: "Rank Correlation Index",
    shortName: "RCI",
    description: "Spearman rank correlation of price vs time, × 100.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [numberField("length", "Length", 14, 3, 5000), sourceField("close")],
    plots: [linePlot("rci", "RCI", COLORS.blue, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      rci: rankCorrelationIndex(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "rciribbon",
    name: "RCI Ribbon",
    shortName: "RCI Rib",
    description: "Short, middle and long rank-correlation lines.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [sourceField("close")],
    plots: [
      linePlot("short", "Short", COLORS.teal, { lineWidth: 1 }),
      linePlot("middle", "Middle", COLORS.blue, { lineWidth: 2 }),
      linePlot("long", "Long", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: () => "9 14 26",
    compute: (candles, inputs) => {
      const values = seriesOf(candles, inputs).map(
        (value) => value ?? Number.NaN,
      );
      return {
        short: rankCorrelationIndex(values, 9),
        middle: rankCorrelationIndex(values, 14),
        long: rankCorrelationIndex(values, 26),
      };
    },
  },
  {
    id: "rvgi",
    name: "Relative Vigor Index",
    shortName: "RVGI",
    description: "Smoothed (close − open) over smoothed range, with a signal.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 3,
    requiresVolume: false,
    inputs: [lengthField(10), numberField("signalLength", "Signal", 4, 1, 5000)],
    plots: [
      linePlot("rvgi", "RVGI", COLORS.teal, { lineWidth: 2 }),
      linePlot("signal", "Signal", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "signalLength")}`,
    compute: (candles, inputs) =>
      relativeVigorIndex(
        candles,
        numberInput(inputs, "length"),
        numberInput(inputs, "signalLength"),
      ),
  },
  {
    id: "rvi",
    name: "Relative Volatility Index",
    shortName: "RVI",
    description: "RSI-style gauge built from directional volatility.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      lengthField(10),
      numberField("signalLength", "Signal", 10, 1, 5000),
      sourceField("close"),
    ],
    plots: [
      linePlot("rvi", "RVI", COLORS.blue, { lineWidth: 2 }),
      linePlot("signal", "Signal", COLORS.orange, { lineWidth: 1 }),
    ],
    levels: [
      level("upper", "Overbought", 80, { editable: true }),
      level("lower", "Oversold", 20, { editable: true }),
    ],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "signalLength")}`,
    compute: (candles, inputs) =>
      relativeVolatilityIndex(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
        numberInput(inputs, "signalLength"),
      ),
  },
  {
    id: "ppo",
    name: "Price Oscillator",
    shortName: "PPO",
    description: "Percentage gap between fast and slow EMAs, with a signal.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("fast", "Fast", 12, 1, 5000),
      numberField("slow", "Slow", 26, 1, 5000),
      numberField("signalLength", "Signal", 9, 1, 5000),
      sourceField("close"),
    ],
    plots: [
      linePlot("ppo", "PPO", COLORS.blue, { lineWidth: 2 }),
      linePlot("signal", "Signal", COLORS.orange, { lineWidth: 1 }),
      histogramPlot("hist", "Histogram", COLORS.teal, "sign", { opacity: 60 }),
    ],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "fast")} ${numberInput(inputs, "slow")} ${numberInput(inputs, "signalLength")}`,
    compute: (candles, inputs) => {
      const { ppo, signal, histogram } = percentagePriceOscillator(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "fast"),
        numberInput(inputs, "slow"),
        numberInput(inputs, "signalLength"),
      );
      return { ppo, signal, hist: histogram };
    },
  },
  {
    id: "pmo",
    name: "Price Momentum Oscillator",
    shortName: "PMO",
    description: "Swenlin's double-smoothed ROC with an EMA signal.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 3,
    requiresVolume: false,
    inputs: [
      numberField("smooth1", "Smoothing 1", 35, 1, 5000),
      numberField("smooth2", "Smoothing 2", 20, 1, 5000),
      numberField("signalLength", "Signal", 10, 1, 5000),
      sourceField("close"),
    ],
    plots: [
      linePlot("pmo", "PMO", COLORS.blue, { lineWidth: 2 }),
      linePlot("signal", "Signal", COLORS.orange, { lineWidth: 1 }),
    ],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "smooth1")} ${numberInput(inputs, "smooth2")} ${numberInput(inputs, "signalLength")}`,
    compute: (candles, inputs) =>
      priceMomentumOscillator(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "smooth1"),
        numberInput(inputs, "smooth2"),
        numberInput(inputs, "signalLength"),
      ),
  },
  {
    id: "dpo",
    name: "Detrended Price Oscillator",
    shortName: "DPO",
    description: "Close minus its SMA shifted back half a cycle.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [numberField("length", "Length", 21, 2, 5000), sourceField("close")],
    plots: [linePlot("dpo", "DPO", COLORS.blue, { lineWidth: 2 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      dpo: detrendedPriceOscillator(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "massindex",
    name: "Mass Index",
    shortName: "Mass",
    description: "EMA-ratio reversal bulge; 27 flags a turn ahead.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [],
    plots: [linePlot("mass", "Mass", COLORS.blue, { lineWidth: 2 })],
    levels: [level("bulge", "Reversal bulge", 27, { editable: true })],
    fills: [],
    formatLabel: () => "9 25",
    compute: (candles) => ({ mass: massIndex(candles) }),
  },
  {
    id: "ulcer",
    name: "Ulcer Index",
    shortName: "UI",
    description: "Depth and duration of drawdowns from the running peak.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [numberField("length", "Length", 14, 1, 5000), sourceField("close")],
    plots: [linePlot("ulcer", "Ulcer", COLORS.red, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      ulcer: ulcerIndex(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "chop",
    name: "Choppiness Index",
    shortName: "CHOP",
    description: "Higher means chop, lower means trend.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [numberField("length", "Length", 14, 1, 5000)],
    plots: [linePlot("chop", "CHOP", COLORS.purple, { lineWidth: 2 })],
    levels: [
      level("upper", "Choppy", 61.8, { editable: true }),
      level("lower", "Trending", 38.2, { editable: true }),
    ],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      chop: choppinessIndex(candles, numberInput(inputs, "length")),
    }),
  },
  {
    id: "chopzone",
    name: "Chop Zone",
    shortName: "ChopZ",
    description: "Choppiness index zoned between trending and choppy.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [numberField("length", "Length", 14, 1, 5000)],
    plots: [linePlot("chop", "Chop", COLORS.teal, { lineWidth: 2 })],
    levels: [
      level("upper", "Choppy", 61.8, { editable: true }),
      level("lower", "Trending", 38.2, { editable: true }),
    ],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      chop: choppinessIndex(candles, numberInput(inputs, "length")),
    }),
  },
  {
    id: "klinger",
    name: "Klinger Oscillator",
    shortName: "KVO",
    description: "Volume force smoothed 34 vs 55 with a 13-bar signal.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: true,
    inputs: [
      numberField("fast", "Fast", 34, 1, 5000),
      numberField("slow", "Slow", 55, 1, 5000),
      numberField("signalLength", "Signal", 13, 1, 5000),
    ],
    plots: [
      linePlot("kvo", "KVO", COLORS.blue, { lineWidth: 2 }),
      linePlot("signal", "Signal", COLORS.orange, { lineWidth: 1 }),
    ],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "fast")} ${numberInput(inputs, "slow")} ${numberInput(inputs, "signalLength")}`,
    compute: (candles, inputs) =>
      klingerOscillator(
        candles,
        numberInput(inputs, "fast"),
        numberInput(inputs, "slow"),
        numberInput(inputs, "signalLength"),
      ),
  },
  {
    id: "bop",
    name: "Balance of Power",
    shortName: "BOP",
    description: "Buying vs selling pressure with an SMA signal.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 3,
    requiresVolume: false,
    inputs: [numberField("signalLength", "Signal", 14, 1, 5000)],
    plots: [
      linePlot("bop", "BOP", COLORS.teal, { lineWidth: 2 }),
      linePlot("signal", "Signal", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "signalLength")}`,
    compute: (candles, inputs) =>
      balanceOfPower(candles, numberInput(inputs, "signalLength")),
  },
  {
    id: "willr",
    name: "Williams Percent Range",
    shortName: "%R",
    description: "Where the close sits in the recent range, × −100.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(14)],
    plots: [linePlot("r", "%R", COLORS.blue, { lineWidth: 2 })],
    levels: [
      level("upper", "Overbought", -20, { editable: true }),
      level("lower", "Oversold", -80, { editable: true }),
    ],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      r: williamsPercentR(candles, numberInput(inputs, "length")),
    }),
  },
  {
    id: "fractal",
    name: "Williams Fractal",
    shortName: "Fractal",
    description: "+1 at confirmed swing highs, −1 at swing lows.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: false,
    inputs: [],
    plots: [histogramPlot("fractal", "Fractal", COLORS.blue, "sign", { opacity: 80 })],
    levels: [],
    fills: [],
    formatLabel: () => "5",
    compute: (candles) => {
      const fractal = candles.map(() => 0 as number | null);
      for (let index = 2; index < candles.length - 2; index += 1) {
        const high = candles[index]!.high;
        const low = candles[index]!.low;
        const isUp =
          high > candles[index - 1]!.high &&
          high > candles[index - 2]!.high &&
          high > candles[index + 1]!.high &&
          high > candles[index + 2]!.high;
        const isDown =
          low < candles[index - 1]!.low &&
          low < candles[index - 2]!.low &&
          low < candles[index + 1]!.low &&
          low < candles[index + 2]!.low;
        if (isUp) fractal[index] = 1;
        else if (isDown) fractal[index] = -1;
      }
      return { fractal };
    },
  },
  {
    id: "woodies",
    name: "Woodies CCI",
    shortName: "WCCI",
    description: "CCI(14) trend line with a CCI(6) turbo line.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [],
    plots: [
      linePlot("cci", "CCI", COLORS.slate, { lineWidth: 2 }),
      linePlot("turbo", "Turbo", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [
      level("upper2", "+200", 200, { editable: true }),
      level("upper1", "+100", 100, { editable: true }),
      level("zero", "Zero", 0, { editable: false }),
      level("lower1", "−100", -100, { editable: true }),
      level("lower2", "−200", -200, { editable: true }),
    ],
    fills: [],
    formatLabel: () => "14 6",
    compute: (candles) => ({
      cci: commodityChannelIndex(candles, 14),
      turbo: commodityChannelIndex(candles, 6),
    }),
  },
  {
    id: "mfi",
    name: "Money Flow Index",
    shortName: "MFI",
    description: "Volume-weighted RSI of typical price.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [numberField("length", "Length", 14, 1, 5000)],
    plots: [linePlot("mfi", "MFI", COLORS.blue, { lineWidth: 2 })],
    levels: [
      level("upper", "Overbought", 80, { editable: true }),
      level("lower", "Oversold", 20, { editable: true }),
    ],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      mfi: moneyFlowIndex(candles, numberInput(inputs, "length")),
    }),
  },
  {
    id: "cmf",
    name: "Chaikin Money Flow",
    shortName: "CMF",
    description: "Money-flow volume over N bars divided by total volume.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 3,
    requiresVolume: true,
    inputs: [numberField("length", "Length", 20, 1, 5000)],
    plots: [linePlot("cmf", "CMF", COLORS.teal, { lineWidth: 2 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      cmf: chaikinMoneyFlow(candles, numberInput(inputs, "length")),
    }),
  },
  {
    id: "chaikin",
    name: "Chaikin Oscillator",
    shortName: "Chaikin",
    description: "EMA(3) − EMA(10) of the accumulation/distribution line.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: true,
    inputs: [
      numberField("fast", "Fast", 3, 1, 5000),
      numberField("slow", "Slow", 10, 1, 5000),
    ],
    plots: [linePlot("osc", "Oscillator", COLORS.blue, { lineWidth: 2 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "fast")} ${numberInput(inputs, "slow")}`,
    compute: (candles, inputs) => {
      const ad = toFiniteSeries(accumulationDistribution(candles));
      const fast = toFiniteSeries(
        exponentialMovingAverage(ad, numberInput(inputs, "fast")),
      );
      const slow = toFiniteSeries(
        exponentialMovingAverage(ad, numberInput(inputs, "slow")),
      );
      return {
        osc: candles.map((_, index) => {
          const f = fast[index]!;
          const s = slow[index]!;
          return Number.isFinite(f) && Number.isFinite(s) ? f - s : null;
        }),
      };
    },
  },
  {
    id: "pvo",
    name: "Percentage Volume Oscillator",
    shortName: "PVO",
    description: "Fast vs slow volume EMA gap as a percent of the slow EMA.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [
      numberField("fast", "Fast", 5, 1, 5000),
      numberField("slow", "Slow", 10, 1, 5000),
    ],
    plots: [linePlot("pvo", "PVO", COLORS.teal, { lineWidth: 2 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "fast")} ${numberInput(inputs, "slow")}`,
    compute: (candles, inputs) => ({
      pvo: volumeOscillator(
        candles,
        numberInput(inputs, "fast"),
        numberInput(inputs, "slow"),
      ),
    }),
  },
  {
    id: "voldelta",
    name: "Volume Delta",
    shortName: "VDelta",
    description: "Signed volume per bar from the tick rule.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: true,
    inputs: [],
    plots: [histogramPlot("delta", "Delta", COLORS.blue, "sign", { opacity: 80 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => ({ delta: volumeDelta(candles) }),
  },
  {
    id: "cvd",
    name: "Cumulative Volume Delta",
    shortName: "CVD",
    description: "Running total of signed volume.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: true,
    inputs: [],
    plots: [linePlot("cvd", "CVD", COLORS.teal, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => ({ cvd: cumulativeVolumeDelta(candles) }),
  },
  {
    id: "cumvolidx",
    name: "Cumulative Volume Index",
    shortName: "CVI",
    description: "Running total of volume signed by bar direction.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: true,
    inputs: [],
    plots: [linePlot("cvi", "CVI", COLORS.blue, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => ({ cvi: cumulativeVolumeIndex(candles) }),
  },
  {
    id: "updownvol",
    name: "Up/Down Volume",
    shortName: "UDVol",
    description: "Volume split into up bars and down bars.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: true,
    inputs: [],
    plots: [
      linePlot("up", "Up", COLORS.teal, { lineWidth: 1 }),
      linePlot("down", "Down", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => upDownVolume(candles),
  },
  {
    id: "netvol",
    name: "Net Volume",
    shortName: "NetVol",
    description: "Up-volume minus down-volume per bar.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: true,
    inputs: [],
    plots: [histogramPlot("net", "Net", COLORS.blue, "sign", { opacity: 80 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => ({ net: netVolume(candles) }),
  },
  {
    id: "nvi",
    name: "Negative Volume Index",
    shortName: "NVI",
    description: "Compounds only on falling-volume days (smart money).",
    category: "volume",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [],
    plots: [linePlot("nvi", "NVI", COLORS.teal, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => ({ nvi: volumeIndex(candles, "negative") }),
  },
  {
    id: "pvi",
    name: "Positive Volume Index",
    shortName: "PVI",
    description: "Compounds only on rising-volume days (crowd money).",
    category: "volume",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [],
    plots: [linePlot("pvi", "PVI", COLORS.red, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => ({ pvi: volumeIndex(candles, "positive") }),
  },
  {
    id: "emv",
    name: "Ease of Movement",
    shortName: "EMV",
    description: "Price distance per unit of box-ratio volume.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 3,
    requiresVolume: true,
    inputs: [numberField("length", "Length", 14, 1, 5000)],
    plots: [linePlot("emv", "EMV", COLORS.blue, { lineWidth: 2 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      emv: easeOfMovement(candles, numberInput(inputs, "length")),
    }),
  },
  {
    id: "mom",
    name: "Momentum",
    shortName: "MOM",
    description: "Close minus the close N bars ago.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [numberField("length", "Length", 10, 1, 5000), sourceField("close")],
    plots: [linePlot("mom", "MOM", COLORS.blue, { lineWidth: 2 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      mom: momentum(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "pvtrend",
    name: "Price-Volume Trend",
    shortName: "PVT",
    description: "Running total of volume-scaled close changes.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: true,
    inputs: [],
    plots: [linePlot("pvt", "PVT", COLORS.purple, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => ({ pvt: priceVolumeTrend(candles) }),
  },
  {
    id: "gaps",
    name: "Gaps",
    shortName: "Gaps",
    description: "Session gap as a percent of the previous close.",
    category: "performance",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [],
    plots: [histogramPlot("gap", "Gap", COLORS.blue, "sign", { opacity: 80 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => ({ gap: sessionGaps(candles) }),
  },
  {
    id: "season",
    name: "Seasonality",
    shortName: "Season",
    description: "Average same-calendar-month change across history.",
    category: "performance",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [],
    plots: [areaPlot("season", "Seasonality", COLORS.teal)],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: () => "12M",
    compute: (candles) => ({ season: seasonality(candles) }),
  },
  {
    id: "moon",
    name: "Moon Phases",
    shortName: "Moon",
    description: "Illuminated fraction of the moon per bar.",
    category: "performance",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [],
    plots: [linePlot("phase", "Phase", COLORS.slate, { lineWidth: 2 })],
    levels: [
      level("full", "Full", 1, { editable: false }),
      level("new", "New", 0, { editable: false }),
    ],
    fills: [],
    formatLabel: () => "29.5d",
    compute: (candles) => ({ phase: moonPhases(candles) }),
  },
  {
    id: "rsidiv",
    name: "RSI Divergence Indicator",
    shortName: "RSID",
    description: "RSI with classic bullish/bearish divergence flags.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [numberField("length", "RSI length", 14, 1, 5000)],
    plots: [
      linePlot("rsi", "RSI", COLORS.purple, { lineWidth: 2 }),
      histogramPlot("div", "Divergence", COLORS.orange, "sign", { opacity: 90 }),
    ],
    levels: [
      level("upper", "Overbought", 70, { editable: true }),
      level("lower", "Oversold", 30, { editable: true }),
    ],
    fills: [
      fill("band", "Background", levelAnchor("upper"), levelAnchor("lower"), {
        color: COLORS.purple,
        opacity: 10,
      }),
    ],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => {
      const { rsi, signal } = rsiDivergence(candles, numberInput(inputs, "length"));
      return { rsi, div: signal };
    },
  },
  {
    id: "rvat",
    name: "Relative Volume at Time",
    shortName: "RVAT",
    description: "Volume divided by its own moving average.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [numberField("length", "Length", 20, 1, 5000)],
    plots: [linePlot("rvat", "RVAT", COLORS.blue, { lineWidth: 2 })],
    levels: [level("average", "Average", 1, { editable: true })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => {
      const volume = candles.map((candle) => candle.volume ?? null);
      const average = simpleMovingAverage(volume, numberInput(inputs, "length"));
      return {
        rvat: volume.map((value, index) => {
          const mean = average[index];
          if (value === null || mean === null || mean <= 0) return null;
          return value / mean;
        }),
      };
    },
  },
  {
    id: "ad",
    name: "Accumulation/Distribution",
    shortName: "AD",
    description: "Money-flow volume cumulated from the close location value.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: true,
    inputs: [],
    plots: [linePlot("ad", "A/D", COLORS.teal, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => ({ ad: accumulationDistribution(candles) }),
  },
  {
    id: "aroonosc",
    name: "Aroon Oscillator",
    shortName: "Aroon Osc",
    description: "Aroon Up minus Aroon Down in a single line.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(14)],
    plots: [linePlot("osc", "Oscillator", COLORS.blue, { lineWidth: 2 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => {
      const { up, down } = aroon(candles, numberInput(inputs, "length"));
      return {
        osc: up.map((value, index) => {
          const other = down[index];
          return value === null || other === null ? null : value - other;
        }),
      };
    },
  },
  {
    id: "smiosc",
    name: "SMI Ergodic Oscillator",
    shortName: "SMIO",
    description: "SMI Ergodic minus its signal line.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("longLength", "Long length", 20, 1, 5000),
      numberField("shortLength", "Short length", 5, 1, 5000),
      numberField("signalLength", "Signal smoothing", 5, 1, 5000),
    ],
    plots: [linePlot("osc", "Oscillator", COLORS.purple, { lineWidth: 2 })],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "longLength")} ${numberInput(inputs, "shortLength")} ${numberInput(inputs, "signalLength")}`,
    compute: (candles, inputs) => {
      const { smi, signal } = smiErgodic(
        candles,
        numberInput(inputs, "longLength"),
        numberInput(inputs, "shortLength"),
        numberInput(inputs, "signalLength"),
      );
      return {
        osc: smi.map((value, index) => {
          const other = signal[index];
          return value === null || other === null ? null : value - other;
        }),
      };
    },
  },
  {
    id: "tema",
    name: "Triple Exponential Moving Average",
    shortName: "TEMA",
    description: "Triple-smoothed average with minimal lag.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(21), sourceField("close"), offsetField()],
    plots: [linePlot("ma", "TEMA", COLORS.purple, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: maLabel(""),
    compute: (candles, inputs) => ({
      ma: tripleExponentialMovingAverage(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "linreg",
    name: "Linear Regression",
    shortName: "LinReg",
    description: "Least-squares line endpoint over the lookback.",
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(25), sourceField("close"), offsetField()],
    plots: [linePlot("ma", "LinReg", COLORS.slate, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: maLabel(""),
    compute: (candles, inputs) => ({
      ma: leastSquaresMovingAverage(
        seriesOf(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "sessvol",
    name: "Session Volume",
    shortName: "SV",
    description:
      "Volume cumulated within each calendar-day session. Point of control and value area live on the price-pane Session Volume Profile (SVP), not here: price lines cannot share this pane's volume scale.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: true,
    inputs: [],
    plots: [
      histogramPlot("volume", "Session vol", COLORS.blue, "direction", {
        opacity: 80,
      }),
    ],
    levels: [],
    fills: [],
    formatLabel: () => "1D",
    compute: (candles) => {
      const profile = sessionVolumeProfile(candles, 24);
      return { volume: profile.sessionVolume };
    },
  },
  {
    id: "tpo",
    name: "Time Price Opportunity",
    shortName: "TPO",
    description:
      "Market Profile TPO count per price row over a trailing window, with developing point of control and 70% value area.",
    category: "volume",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      lengthField(30),
      numberField("rows", "Rows", 24, 2, 200),
    ],
    plots: [
      linePlot("poc", "POC", COLORS.orange, { lineWidth: 2 }),
      linePlot("vah", "VAH", COLORS.teal, { lineWidth: 1 }),
      linePlot("val", "VAL", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [
      fill("value", "Value area", { kind: "plot", id: "vah" }, { kind: "plot", id: "val" }, {
        color: COLORS.orange,
        opacity: 10,
      }),
    ],
    formatLabel: () => "TPO",
    compute: (candles, inputs) =>
      developingDistribution(
        candles,
        numberInput(inputs, "rows"),
        "time",
        "trailing",
        numberInput(inputs, "length"),
      ),
  },
  {
    id: "stpo",
    name: "Session Time Price Opportunity",
    shortName: "STPO",
    description:
      "TPO letter count restarted every calendar-day session, with developing session POC and 70% value area.",
    category: "volume",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [numberField("rows", "Rows", 24, 2, 200)],
    plots: [
      linePlot("poc", "POC", COLORS.orange, { lineWidth: 2 }),
      linePlot("vah", "VAH", COLORS.teal, { lineWidth: 1 }),
      linePlot("val", "VAL", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [
      fill("value", "Value area", { kind: "plot", id: "vah" }, { kind: "plot", id: "val" }, {
        color: COLORS.orange,
        opacity: 10,
      }),
    ],
    formatLabel: () => "1D",
    compute: (candles, inputs) =>
      developingDistribution(candles, numberInput(inputs, "rows"), "time", "day"),
  },
  {
    id: "aavp",
    name: "Auto Anchored Volume Profile",
    shortName: "AAVP",
    description:
      "Volume profile anchored automatically at the highest-volume bar, with POC and 70% value area rays.",
    category: "volume",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [numberField("rows", "Rows", 24, 2, 200)],
    plots: [
      linePlot("poc", "POC", COLORS.orange, { lineWidth: 2 }),
      linePlot("vah", "VAH", COLORS.teal, { lineWidth: 1 }),
      linePlot("val", "VAL", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [
      fill("value", "Value area", { kind: "plot", id: "vah" }, { kind: "plot", id: "val" }, {
        color: COLORS.orange,
        opacity: 10,
      }),
    ],
    formatLabel: () => "AUTO",
    compute: (candles, inputs) =>
      staticDistribution(candles, autoProfileAnchor(candles), numberInput(inputs, "rows"), "volume"),
  },
  {
    id: "frvp",
    name: "Fixed Range Volume Profile",
    shortName: "FRVP",
    description:
      "Volume distribution over a fixed trailing range of bars, with POC and 70% value area.",
    category: "volume",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [
      lengthField(100),
      numberField("rows", "Rows", 24, 2, 200),
    ],
    plots: [
      linePlot("poc", "POC", COLORS.orange, { lineWidth: 2 }),
      linePlot("vah", "VAH", COLORS.teal, { lineWidth: 1 }),
      linePlot("val", "VAL", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [
      fill("value", "Value area", { kind: "plot", id: "vah" }, { kind: "plot", id: "val" }, {
        color: COLORS.orange,
        opacity: 10,
      }),
    ],
    formatLabel: () => "FR",
    compute: (candles, inputs) => {
      const length = Math.max(1, numberInput(inputs, "length"));
      return staticDistribution(
        candles,
        candles.length - length,
        numberInput(inputs, "rows"),
        "volume",
      );
    },
  },
  {
    id: "pvp",
    name: "Periodic Volume Profile",
    shortName: "PVP",
    description:
      "Volume profile restarted every day, week, or month, with developing POC and 70% value area.",
    category: "volume",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [
      selectField("period", "Period", "day", [
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
        { value: "month", label: "Month" },
      ]),
      numberField("rows", "Rows", 24, 2, 200),
    ],
    plots: [
      linePlot("poc", "POC", COLORS.orange, { lineWidth: 2 }),
      linePlot("vah", "VAH", COLORS.teal, { lineWidth: 1 }),
      linePlot("val", "VAL", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [
      fill("value", "Value area", { kind: "plot", id: "vah" }, { kind: "plot", id: "val" }, {
        color: COLORS.orange,
        opacity: 10,
      }),
    ],
    formatLabel: (inputs) => stringInput(inputs, "period").toUpperCase(),
    compute: (candles, inputs) => {
      const period = stringInput(inputs, "period");
      const key: "day" | "week" | "month" =
        period === "week" || period === "month" ? period : "day";
      return developingDistribution(candles, numberInput(inputs, "rows"), "volume", key);
    },
  },
  sessionVolumeProfileDefinition("svp", "Session Volume Profile", "SVP", 24),
  sessionVolumeProfileDefinition("svphd", "Session Volume Profile HD", "SVP HD", 100),
  {
    id: "vrvp",
    name: "Visible Range Volume Profile",
    shortName: "VRVP",
    description:
      "Volume distribution over the whole loaded (visible) range, with POC and 70% value area.",
    category: "volume",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [numberField("rows", "Rows", 24, 2, 200)],
    plots: [
      linePlot("poc", "POC", COLORS.orange, { lineWidth: 2 }),
      linePlot("vah", "VAH", COLORS.teal, { lineWidth: 1 }),
      linePlot("val", "VAL", COLORS.red, { lineWidth: 1 }),
    ],
    levels: [],
    fills: [
      fill("value", "Value area", { kind: "plot", id: "vah" }, { kind: "plot", id: "val" }, {
        color: COLORS.orange,
        opacity: 10,
      }),
    ],
    formatLabel: () => "VR",
    compute: (candles, inputs) =>
      staticDistribution(candles, 0, numberInput(inputs, "rows"), "volume"),
  },
];

import {
  analyzeVolume,
  averageTrueRange,
  bollingerBands,
  exponentialMovingAverage,
  historicalVolatility,
  maximumDrawdown,
  movingAverageConvergenceDivergence,
  periodReturn,
  relativeStrengthIndex,
  rollingStandardDeviation,
  simpleMovingAverage,
  smoothedMovingAverage,
  trueRange,
  volumeWeightedAveragePrice,
} from "./indicators";
import {
  commodityChannelIndex,
  onBalanceVolume,
  stochasticOscillator,
  supertrend,
} from "./indicators-extended";
import { movingAverageByMethod } from "./indicators-research";
import {
  getPineDefinition,
  registeredPineDefinitions,
} from "../pine/pine-script";
import {
  CANDLE_SOURCE_LABELS,
  type CandleSource,
  type IndicatorDefinition,
  shiftSeries,
} from "./indicator-schema";
import { CLASSIC_DEFINITIONS } from "./indicator-catalog-classics";

import {
  areaPlot,
  COLORS,
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
  plotAnchor,
  selectField,
  sourceField,
  sourceSeries,
  stringInput,
} from "./indicator-catalog-builders";
export * from "./indicator-catalog-builders";
export const INDICATOR_DEFINITIONS: readonly IndicatorDefinition[] = [
  movingAverageDefinition({
    id: "sma",
    name: "Simple Moving Average",
    shortName: "SMA",
    description: "Unweighted mean of the source over the last N bars.",
    defaultLength: 9,
    color: COLORS.blue,
    calculate: simpleMovingAverage,
  }),
  movingAverageDefinition({
    id: "ema",
    name: "Exponential Moving Average",
    shortName: "EMA",
    description: "Mean that weights recent bars more heavily.",
    defaultLength: 9,
    color: COLORS.orange,
    calculate: exponentialMovingAverage,
  }),
  movingAverageDefinition({
    id: "smma",
    name: "Smoothed Moving Average",
    shortName: "SMMA",
    description:
      "Wilder's smoothing; reacts slower than an EMA of equal length.",
    defaultLength: 20,
    color: COLORS.purple,
    calculate: smoothedMovingAverage,
  }),
  {
    id: "rsi",
    name: "Relative Strength Index",
    shortName: "RSI",
    description: "Momentum oscillator bounded between 0 and 100.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      {
        ...numberField("length", "RSI Length", 14, 1, 5000),
        group: "RSI settings",
      },
      { ...sourceField("close"), group: "RSI settings" },
      {
        ...selectField("smoothType", "Type", "sma", [
          { value: "sma", label: "SMA" },
          { value: "ema", label: "EMA" },
          { value: "rma", label: "RMA" },
          { value: "wma", label: "WMA" },
        ]),
        group: "Smoothing",
      },
      {
        ...numberField("smoothLength", "Length", 14, 1, 5000),
        group: "Smoothing",
      },
    ],
    plots: [
      linePlot("rsi", "RSI", COLORS.purple, { lineWidth: 2 }),
      linePlot("ma", "RSI-based MA", COLORS.amber, { lineWidth: 1 }),
    ],
    levels: [
      level("upper", "RSI Upper Band", 70, {
        editable: true,
        lineStyle: "dashed",
      }),
      level("middle", "RSI Middle Band", 50, {
        editable: true,
        lineStyle: "dashed",
      }),
      level("lower", "RSI Lower Band", 30, {
        editable: true,
        lineStyle: "dashed",
      }),
    ],
    fills: [
      fill("band", "RSI Background Fill", levelAnchor("upper"), levelAnchor("lower"), {
        color: COLORS.purple,
        opacity: 10,
      }),
    ],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${CANDLE_SOURCE_LABELS[stringInput(inputs, "source") as CandleSource] ?? "Close"}`,
    compute: (candles, inputs) => {
      const rsi = relativeStrengthIndex(
        sourceSeries(candles, inputs).map((value) => value ?? Number.NaN),
        numberInput(inputs, "length"),
      );
      return {
        rsi,
        ma: movingAverageByMethod(
          rsi.map((value) => value ?? Number.NaN),
          stringInput(inputs, "smoothType"),
          numberInput(inputs, "smoothLength"),
        ),
      };
    },
  },
  {
    id: "macd",
    name: "MACD",
    shortName: "MACD",
    description: "Difference between a fast and slow EMA, with a signal line.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("fastPeriod", "Fast length", 12, 1, 500),
      numberField("slowPeriod", "Slow length", 26, 1, 500),
      numberField("signalPeriod", "Signal smoothing", 9, 1, 500),
      sourceField("close"),
    ],
    plots: [
      linePlot("macd", "MACD", COLORS.blue, { lineWidth: 2 }),
      linePlot("signal", "Signal", COLORS.orange, { lineWidth: 2 }),
      histogramPlot("histogram", "Histogram", COLORS.slate, "sign"),
    ],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "fastPeriod")} ${numberInput(inputs, "slowPeriod")} ${numberInput(inputs, "signalPeriod")}`,
    compute: (candles, inputs) => {
      const result = movingAverageConvergenceDivergence(
        sourceSeries(candles, inputs),
        {
          fastPeriod: numberInput(inputs, "fastPeriod"),
          slowPeriod: numberInput(inputs, "slowPeriod"),
          signalPeriod: numberInput(inputs, "signalPeriod"),
        },
      );
      return {
        macd: result.macd,
        signal: result.signal,
        histogram: result.histogram,
      };
    },
  },
  {
    id: "bollinger-bands",
    name: "Bollinger Bands",
    shortName: "BB",
    description: "A moving average with standard-deviation envelopes.",
    category: "volatility",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      lengthField(20),
      sourceField("close"),
      decimalField("multiplier", "StdDev", 2, 0.1, 50, 0.1),
      offsetField(),
    ],
    plots: [
      linePlot("middle", "Basis", COLORS.orange),
      linePlot("upper", "Upper", COLORS.blue),
      linePlot("lower", "Lower", COLORS.blue),
    ],
    levels: [],
    fills: [
      fill("envelope", "Background", plotAnchor("upper"), plotAnchor("lower"), {
        color: COLORS.blue,
        opacity: 8,
      }),
    ],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "multiplier")}`,
    compute: (candles, inputs) => {
      const bands = bollingerBands(
        sourceSeries(candles, inputs),
        numberInput(inputs, "length"),
        numberInput(inputs, "multiplier"),
      );
      const offset = numberInput(inputs, "offset");
      return {
        middle: shiftSeries(bands.middle, offset),
        upper: shiftSeries(bands.upper, offset),
        lower: shiftSeries(bands.lower, offset),
      };
    },
  },
  {
    id: "bollinger-bandwidth",
    name: "Bollinger Bandwidth",
    shortName: "BBW",
    description: "Width of the Bollinger envelope as a percent of its basis.",
    category: "volatility",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      lengthField(20),
      sourceField("close"),
      decimalField("multiplier", "StdDev", 2, 0.1, 50, 0.1),
    ],
    plots: [linePlot("bandwidth", "Bandwidth", COLORS.teal, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "multiplier")}`,
    compute: (candles, inputs) => ({
      bandwidth: bollingerBands(
        sourceSeries(candles, inputs),
        numberInput(inputs, "length"),
        numberInput(inputs, "multiplier"),
      ).bandwidth,
    }),
  },
  {
    id: "bollinger-percent-b",
    name: "Bollinger %B",
    shortName: "%B",
    description: "Where the source sits inside the Bollinger envelope.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 4,
    requiresVolume: false,
    inputs: [
      lengthField(20),
      sourceField("close"),
      decimalField("multiplier", "StdDev", 2, 0.1, 50, 0.1),
    ],
    plots: [linePlot("percentB", "%B", COLORS.purple, { lineWidth: 2 })],
    levels: [
      level("upper", "Upper", 1, {
        editable: true,
        lineStyle: "dashed",
        minimum: -10,
        maximum: 10,
      }),
      level("lower", "Lower", 0, {
        editable: true,
        lineStyle: "dashed",
        minimum: -10,
        maximum: 10,
      }),
    ],
    fills: [
      fill("band", "Background", levelAnchor("upper"), levelAnchor("lower"), {
        color: COLORS.purple,
        opacity: 10,
      }),
    ],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "multiplier")}`,
    compute: (candles, inputs) => ({
      percentB: bollingerBands(
        sourceSeries(candles, inputs),
        numberInput(inputs, "length"),
        numberInput(inputs, "multiplier"),
      ).percentB,
    }),
  },
  {
    id: "vwap",
    name: "Volume Weighted Average Price",
    shortName: "VWAP",
    description: "Volume-weighted mean price, reset at each session boundary.",
    category: "volume",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: true,
    inputs: [
      selectField("timeZone", "Session timezone", "Asia/Kolkata", [
        { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
        { value: "UTC", label: "UTC" },
        { value: "America/New_York", label: "America/New_York" },
        { value: "Europe/London", label: "Europe/London" },
        { value: "Asia/Singapore", label: "Asia/Singapore" },
      ]),
    ],
    plots: [linePlot("vwap", "VWAP", COLORS.blue, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles, inputs) => ({
      vwap: volumeWeightedAveragePrice(candles, {
        timeZone: stringInput(inputs, "timeZone"),
      }),
    }),
  },
  {
    id: "volume",
    name: "Volume",
    shortName: "Vol",
    description: "Traded volume with its moving average and spike threshold.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: true,
    inputs: [
      numberField("length", "MA length", 20, 1, 1000),
      decimalField("spikeMultiplier", "Spike multiplier", 2, 0.1, 20, 0.1),
    ],
    plots: [
      histogramPlot("volume", "Volume", COLORS.slate, "direction", {
        upColor: COLORS.green,
        downColor: COLORS.red,
        opacity: 70,
      }),
      linePlot("average", "Volume MA", COLORS.blue),
      histogramPlot("relative", "Relative volume", COLORS.amber, "fixed", {
        visible: false,
      }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => {
      const analysis = analyzeVolume(
        candles,
        numberInput(inputs, "length"),
        numberInput(inputs, "spikeMultiplier"),
      );
      return {
        volume: analysis.volume,
        average: analysis.average,
        relative: analysis.relative,
      };
    },
  },
  {
    id: "true-range",
    name: "True Range",
    shortName: "TR",
    description: "Per-bar range including the gap from the previous close.",
    category: "volatility",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [],
    plots: [linePlot("trueRange", "True Range", COLORS.teal, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => ({ trueRange: trueRange(candles) }),
  },
  {
    id: "atr",
    name: "Average True Range",
    shortName: "ATR",
    description: "Wilder-smoothed true range; a volatility baseline for stops.",
    category: "volatility",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(14)],
    plots: [linePlot("atr", "ATR", COLORS.orange, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      atr: averageTrueRange(candles, numberInput(inputs, "length")),
    }),
  },
  {
    id: "stdev",
    name: "Standard Deviation",
    shortName: "StdDev",
    description: "Rolling standard deviation of the source.",
    category: "volatility",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(20), sourceField("close")],
    plots: [linePlot("stdev", "StdDev", COLORS.teal, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      stdev: rollingStandardDeviation(
        sourceSeries(candles, inputs),
        numberInput(inputs, "length"),
      ),
    }),
  },
  {
    id: "historical-volatility",
    name: "Historical Volatility",
    shortName: "HV",
    description: "Annualised standard deviation of log returns, in percent.",
    category: "volatility",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      lengthField(20),
      numberField("annualization", "Bars per year", 252, 1, 5000),
      sourceField("close"),
    ],
    plots: [linePlot("volatility", "HV %", COLORS.red, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${numberInput(inputs, "annualization")}`,
    compute: (candles, inputs) => ({
      volatility: historicalVolatility(
        sourceSeries(candles, inputs),
        numberInput(inputs, "length"),
        numberInput(inputs, "annualization"),
      ),
    }),
  },
  {
    id: "roc",
    name: "Rate of Change",
    shortName: "ROC",
    description: "Percent change of the source over N bars.",
    category: "performance",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("periods", "Length", 9, 1, 1000),
      sourceField("close"),
    ],
    plots: [histogramPlot("roc", "ROC %", COLORS.slate, "sign")],
    levels: [level("zero", "Zero line", 0, { editable: false })],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "periods")}`,
    compute: (candles, inputs) => ({
      roc: periodReturn(
        sourceSeries(candles, inputs),
        numberInput(inputs, "periods"),
      ),
    }),
  },
  {
    id: "max-drawdown",
    name: "Maximum Drawdown",
    shortName: "DD",
    description: "Percent below the running high-water mark.",
    category: "performance",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [sourceField("close")],
    plots: [areaPlot("drawdown", "Drawdown %", COLORS.red)],
    levels: [level("zero", "Peak", 0, { editable: false })],
    fills: [],
    formatLabel: () => "",
    compute: (candles, inputs) => ({
      drawdown: maximumDrawdown(sourceSeries(candles, inputs)),
    }),
  },
  {
    id: "stochastic",
    name: "Stochastic",
    shortName: "Stoch",
    description: "Momentum oscillator comparing the close to its recent range.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("kPeriod", "%K length", 14, 1, 5000),
      numberField("smoothK", "%K smoothing", 1, 1, 5000),
      numberField("dPeriod", "%D smoothing", 3, 1, 5000),
    ],
    plots: [
      linePlot("k", "%K", COLORS.blue, { lineWidth: 2 }),
      linePlot("d", "%D", COLORS.orange, { lineWidth: 2 }),
    ],
    levels: [
      level("upper", "Overbought", 80, { editable: true, lineStyle: "dashed" }),
      level("middle", "Middle", 50, { editable: true, lineStyle: "dashed" }),
      level("lower", "Oversold", 20, { editable: true, lineStyle: "dashed" }),
    ],
    fills: [
      fill("band", "Background", levelAnchor("upper"), levelAnchor("lower"), {
        color: COLORS.blue,
        opacity: 10,
      }),
    ],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "kPeriod")} ${numberInput(inputs, "smoothK")} ${numberInput(inputs, "dPeriod")}`,
    compute: (candles, inputs) => {
      const { k, d } = stochasticOscillator(
        candles,
        numberInput(inputs, "kPeriod"),
        numberInput(inputs, "smoothK"),
        numberInput(inputs, "dPeriod"),
      );
      return { k, d };
    },
  },
  {
    id: "supertrend",
    name: "Supertrend",
    shortName: "ST",
    description: "ATR-based trailing stop that flips with the trend.",
    category: "volatility",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      numberField("atrPeriod", "ATR length", 10, 1, 5000),
      decimalField("multiplier", "Multiplier", 3, 0.1, 50, 0.1),
    ],
    plots: [
      linePlot("supertrend", "Supertrend", COLORS.teal, { lineWidth: 2 }),
    ],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "atrPeriod")} ${numberInput(inputs, "multiplier")}`,
    compute: (candles, inputs) => ({
      supertrend: supertrend(
        candles,
        numberInput(inputs, "atrPeriod"),
        numberInput(inputs, "multiplier"),
      ).line,
    }),
  },
  {
    id: "cci",
    name: "Commodity Channel Index",
    shortName: "CCI",
    description: "Deviation of the typical price from its moving average.",
    category: "oscillator",
    pane: "separate",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [lengthField(20)],
    plots: [linePlot("cci", "CCI", COLORS.blue, { lineWidth: 2 })],
    levels: [
      level("upper", "Overbought", 100, {
        editable: true,
        lineStyle: "dashed",
        minimum: -1000,
        maximum: 1000,
      }),
      level("zero", "Zero line", 0, {
        editable: true,
        lineStyle: "dashed",
        minimum: -1000,
        maximum: 1000,
      }),
      level("lower", "Oversold", -100, {
        editable: true,
        lineStyle: "dashed",
        minimum: -1000,
        maximum: 1000,
      }),
    ],
    fills: [],
    formatLabel: (inputs) => `${numberInput(inputs, "length")}`,
    compute: (candles, inputs) => ({
      cci: commodityChannelIndex(candles, numberInput(inputs, "length")),
    }),
  },
  {
    id: "obv",
    name: "On-Balance Volume",
    shortName: "OBV",
    description: "Cumulative volume signed by the direction of each move.",
    category: "volume",
    pane: "separate",
    defaultPrecision: 0,
    requiresVolume: true,
    inputs: [],
    plots: [linePlot("obv", "OBV", COLORS.teal, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: () => "",
    compute: (candles) => ({ obv: onBalanceVolume(candles) }),
  },
  ...CLASSIC_DEFINITIONS,
];

const DEFINITIONS_BY_ID: ReadonlyMap<string, IndicatorDefinition> = new Map(
  INDICATOR_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function getIndicatorDefinition(
  definitionId: string,
): IndicatorDefinition | undefined {
  return (
    DEFINITIONS_BY_ID.get(definitionId) ?? getPineDefinition(definitionId)
  );
}

export function requireIndicatorDefinition(
  definitionId: string,
): IndicatorDefinition {
  const definition = getIndicatorDefinition(definitionId);
  if (!definition) {
    throw new Error(`Unknown indicator definition: ${definitionId}`);
  }
  return definition;
}

export function searchIndicatorDefinitions(
  query: string,
): readonly IndicatorDefinition[] {
  const needle = query.trim().toLowerCase();
  const matches = (definition: IndicatorDefinition): boolean =>
    definition.name.toLowerCase().includes(needle) ||
    definition.shortName.toLowerCase().includes(needle) ||
    definition.description.toLowerCase().includes(needle);
  if (!needle) return [...INDICATOR_DEFINITIONS, ...registeredPineDefinitions()];

  return [
    ...INDICATOR_DEFINITIONS.filter(matches),
    ...registeredPineDefinitions().filter(matches),
  ];
}

interface MovingAverageOptions {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly defaultLength: number;
  readonly color: string;
  readonly calculate: (
    values: readonly (number | null | undefined)[],
    period: number,
  ) => (number | null)[];
}

/**
 * The moving-average family differs only in its smoothing function, so the
 * shared shape is built once instead of repeated per indicator.
 */
function movingAverageDefinition(
  options: MovingAverageOptions,
): IndicatorDefinition {
  return {
    id: options.id,
    name: options.name,
    shortName: options.shortName,
    description: options.description,
    category: "moving-average",
    pane: "price",
    defaultPrecision: 2,
    requiresVolume: false,
    inputs: [
      lengthField(options.defaultLength),
      sourceField("close"),
      offsetField(),
    ],
    plots: [linePlot("ma", options.shortName, options.color, { lineWidth: 2 })],
    levels: [],
    fills: [],
    formatLabel: (inputs) =>
      `${numberInput(inputs, "length")} ${stringInput(inputs, "source")}`,
    compute: (candles, inputs) => ({
      ma: shiftSeries(
        options.calculate(
          sourceSeries(candles, inputs),
          numberInput(inputs, "length"),
        ),
        numberInput(inputs, "offset"),
      ),
    }),
  };
}


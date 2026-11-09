import {
  type Candle,
  type NullableNumber,
  hasFiniteVolume,
  isFiniteNumber,
  isValidCandle,
} from "./types";

export const CANDLE_SOURCES = [
  "open",
  "high",
  "low",
  "close",
  "hl2",
  "hlc3",
  "ohlc4",
  "volume",
] as const;

export type CandleSource = (typeof CANDLE_SOURCES)[number];

export const PRICE_SOURCES: readonly CandleSource[] = [
  "open",
  "high",
  "low",
  "close",
  "hl2",
  "hlc3",
  "ohlc4",
];

export const CANDLE_SOURCE_LABELS: Readonly<Record<CandleSource, string>> = {
  open: "Open",
  high: "High",
  low: "Low",
  close: "Close",
  hl2: "HL2",
  hlc3: "HLC3",
  ohlc4: "OHLC4",
  volume: "Volume",
};

export type IndicatorInputValue = number | string | boolean;

export type IndicatorInputs = Readonly<Record<string, IndicatorInputValue>>;

interface InputFieldBase {
  readonly id: string;
  readonly label: string;
  /** Inputs tab section header (e.g. "RSI SETTINGS"). Ungrouped first. */
  readonly group?: string;
  /** Info-tooltip text rendered as ⓘ next to the control. */
  readonly help?: string;
}

export interface NumberInputField extends InputFieldBase {
  readonly kind: "number";
  readonly defaultValue: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly step?: number;
  readonly integer?: boolean;
}

export interface SourceInputField extends InputFieldBase {
  readonly kind: "source";
  readonly defaultValue: CandleSource;
  readonly allowed: readonly CandleSource[];
}

export interface SelectInputField extends InputFieldBase {
  readonly kind: "select";
  readonly defaultValue: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
}

export interface BooleanInputField extends InputFieldBase {
  readonly kind: "boolean";
  readonly defaultValue: boolean;
}

export type IndicatorInputField =
  NumberInputField | SourceInputField | SelectInputField | BooleanInputField;

export type PlotKind = "line" | "histogram" | "area" | "columns";

export type LineStyle = "solid" | "dashed" | "dotted";

export const LINE_STYLES: readonly LineStyle[] = ["solid", "dashed", "dotted"];

export const LINE_WIDTHS: readonly number[] = [1, 2, 3, 4];

/**
 * `direction` colours a bar by its candle's open/close direction, `sign` by the
 * plotted value's own sign. Both need the renderer to pick per-bar colours, so
 * they are declared here rather than baked into a single style colour.
 */
export type PlotColorMode = "fixed" | "direction" | "sign";

export interface PlotStyle {
  readonly visible: boolean;
  readonly color: string;
  readonly upColor: string;
  readonly downColor: string;
  readonly lineWidth: number;
  readonly lineStyle: LineStyle;
  readonly opacity: number;
}

export interface IndicatorPlot {
  readonly id: string;
  readonly label: string;
  readonly kind: PlotKind;
  readonly colorMode: PlotColorMode;
  readonly defaultStyle: PlotStyle;
}

export interface LevelStyle {
  readonly visible: boolean;
  readonly color: string;
  readonly lineWidth: number;
  readonly lineStyle: LineStyle;
}

export interface IndicatorLevel {
  readonly id: string;
  readonly label: string;
  readonly defaultValue: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly editable: boolean;
  readonly defaultStyle: LevelStyle;
}

export type FillAnchor =
  | { readonly kind: "plot"; readonly id: string }
  | { readonly kind: "level"; readonly id: string };

export interface FillStyle {
  readonly visible: boolean;
  readonly color: string;
  readonly opacity: number;
}

export interface IndicatorFill {
  readonly id: string;
  readonly label: string;
  readonly from: FillAnchor;
  readonly to: FillAnchor;
  readonly defaultStyle: FillStyle;
}

export const VISIBILITY_TIMEFRAMES = [
  "ticks",
  "seconds",
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
] as const;

export type VisibilityTimeframe = (typeof VISIBILITY_TIMEFRAMES)[number];

/** Per-unit visibility: enabled plus the TradingView-style [min, max] range. */
export interface VisibilityRule {
  readonly enabled: boolean;
  readonly min: number;
  readonly max: number;
}

export type IndicatorVisibility = Readonly<
  Record<VisibilityTimeframe, VisibilityRule>
>;

export const DEFAULT_VISIBILITY: IndicatorVisibility = {
  ticks: { enabled: true, min: 1, max: 1 },
  seconds: { enabled: true, min: 1, max: 59 },
  minutes: { enabled: true, min: 1, max: 59 },
  hours: { enabled: true, min: 1, max: 24 },
  days: { enabled: true, min: 1, max: 366 },
  weeks: { enabled: true, min: 1, max: 52 },
  months: { enabled: true, min: 1, max: 12 },
};

/**
 * Whether an indicator draws on a chart of the given unit/value
 * (e.g. minutes/15). Units without a numeric value (ticks on our charts)
 * fall back to the enabled flag alone.
 */
export function isVisibleOn(
  visibility: IndicatorVisibility,
  unit: VisibilityTimeframe,
  value: number | null,
): boolean {
  const rule = visibility[unit];
  if (!rule.enabled) return false;
  if (value === null) return true;
  return value >= rule.min && value <= rule.max;
}

export type IndicatorPane = "price" | "separate";

export type IndicatorCategory =
  "moving-average" | "oscillator" | "volatility" | "volume" | "performance";

export type IndicatorSeriesMap = Readonly<Record<string, NullableNumber[]>>;

export interface IndicatorDefinition {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly category: IndicatorCategory;
  readonly pane: IndicatorPane;
  readonly defaultPrecision: number;
  readonly requiresVolume: boolean;
  readonly inputs: readonly IndicatorInputField[];
  readonly plots: readonly IndicatorPlot[];
  readonly levels: readonly IndicatorLevel[];
  readonly fills: readonly IndicatorFill[];
  readonly formatLabel: (inputs: IndicatorInputs) => string;
  readonly compute: (
    candles: readonly Candle[],
    inputs: IndicatorInputs,
  ) => IndicatorSeriesMap;
}

export type IndicatorScaleSide = "left" | "right";

export interface IndicatorInstance {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly inputs: IndicatorInputs;
  readonly plotStyles: Readonly<Record<string, PlotStyle>>;
  readonly levelValues: Readonly<Record<string, number>>;
  readonly levelStyles: Readonly<Record<string, LevelStyle>>;
  readonly fillStyles: Readonly<Record<string, FillStyle>>;
  readonly visibility: IndicatorVisibility;
  /** Null means "Default" (the definition's defaultPrecision). */
  readonly precision: number | null;
  readonly hidden: boolean;
  /** Status-line toggles from the Style tab. */
  readonly labelsOnScale: boolean;
  readonly valuesInStatus: boolean;
  readonly inputsInStatus: boolean;
  /** "Move to" override; null follows the definition pane. */
  readonly paneOverride: IndicatorPane | null;
  /** "Pin to scale" override; null follows the chart default (right). */
  readonly scaleSide: IndicatorScaleSide | null;
  /** Calculation: hold the last value until the timeframe closes. */
  readonly waitForClose: boolean;
}

/**
 * A saved instance without its identity, used both for per-indicator defaults
 * and for rehydrating persisted chart state.
 */
export type IndicatorInstanceSnapshot = Partial<
  Omit<IndicatorInstance, "instanceId" | "definitionId">
>;

const MAXIMUM_PRECISION = 8;

export function resolveSourceSeries(
  candles: readonly Candle[],
  source: CandleSource,
): NullableNumber[] {
  return candles.map((candle) => {
    if (!isValidCandle(candle)) return null;
    switch (source) {
      case "open":
        return candle.open;
      case "high":
        return candle.high;
      case "low":
        return candle.low;
      case "close":
        return candle.close;
      case "hl2":
        return (candle.high + candle.low) / 2;
      case "hlc3":
        return (candle.high + candle.low + candle.close) / 3;
      case "ohlc4":
        return (candle.open + candle.high + candle.low + candle.close) / 4;
      case "volume":
        return hasFiniteVolume(candle) ? candle.volume : null;
    }
  });
}

/**
 * Displaces a series by whole bars. A positive offset moves values forward in
 * time; values pushed past the final bar are dropped because the chart has no
 * future bars to hold them.
 */
export function shiftSeries(
  series: readonly NullableNumber[],
  offset: number,
): NullableNumber[] {
  if (!Number.isSafeInteger(offset) || offset === 0) return [...series];

  const result: NullableNumber[] = Array.from(
    { length: series.length },
    () => null,
  );
  for (let index = 0; index < series.length; index += 1) {
    const sourceIndex = index - offset;
    if (sourceIndex < 0 || sourceIndex >= series.length) continue;
    result[index] = series[sourceIndex] ?? null;
  }
  return result;
}

export function coerceInputValue(
  field: IndicatorInputField,
  value: unknown,
): IndicatorInputValue {
  switch (field.kind) {
    case "number":
      return coerceNumberInput(field, value);
    case "source":
      return field.allowed.includes(value as CandleSource)
        ? (value as CandleSource)
        : field.defaultValue;
    case "select":
      return field.options.some((option) => option.value === value)
        ? (value as string)
        : field.defaultValue;
    case "boolean":
      return typeof value === "boolean" ? value : field.defaultValue;
  }
}

function coerceNumberInput(field: NumberInputField, value: unknown): number {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if (!isFiniteNumber(parsed)) return field.defaultValue;
  const rounded = field.integer === false ? parsed : Math.round(parsed);
  return Math.min(field.maximum, Math.max(field.minimum, rounded));
}

export function createDefaultInputs(
  definition: IndicatorDefinition,
): IndicatorInputs {
  const inputs: Record<string, IndicatorInputValue> = {};
  for (const field of definition.inputs) {
    inputs[field.id] = field.defaultValue;
  }
  return inputs;
}

export function createDefaultInstance(
  definition: IndicatorDefinition,
  instanceId: string,
): IndicatorInstance {
  return normalizeIndicatorInstance(definition, instanceId, {});
}

/**
 * Rebuilds a complete instance from an arbitrary snapshot. Unknown keys are
 * dropped and out-of-range values are clamped, so persisted state written by an
 * older catalog can never produce an instance the renderer cannot draw.
 */
export function normalizeIndicatorInstance(
  definition: IndicatorDefinition,
  instanceId: string,
  snapshot: IndicatorInstanceSnapshot,
): IndicatorInstance {
  const inputs: Record<string, IndicatorInputValue> = {};
  for (const field of definition.inputs) {
    inputs[field.id] = coerceInputValue(field, snapshot.inputs?.[field.id]);
  }

  const plotStyles: Record<string, PlotStyle> = {};
  for (const plot of definition.plots) {
    plotStyles[plot.id] = normalizePlotStyle(
      plot.defaultStyle,
      snapshot.plotStyles?.[plot.id],
    );
  }

  const levelValues: Record<string, number> = {};
  const levelStyles: Record<string, LevelStyle> = {};
  for (const level of definition.levels) {
    const stored = snapshot.levelValues?.[level.id];
    levelValues[level.id] = level.editable
      ? clampNumber(stored, level.minimum, level.maximum, level.defaultValue)
      : level.defaultValue;
    levelStyles[level.id] = normalizeLevelStyle(
      level.defaultStyle,
      snapshot.levelStyles?.[level.id],
    );
  }

  const fillStyles: Record<string, FillStyle> = {};
  for (const fill of definition.fills) {
    fillStyles[fill.id] = normalizeFillStyle(
      fill.defaultStyle,
      snapshot.fillStyles?.[fill.id],
    );
  }

  const visibility: Record<VisibilityTimeframe, VisibilityRule> = {
    ...DEFAULT_VISIBILITY,
  };
  for (const timeframe of VISIBILITY_TIMEFRAMES) {
    visibility[timeframe] = normalizeVisibilityRule(
      DEFAULT_VISIBILITY[timeframe],
      snapshot.visibility?.[timeframe],
    );
  }

  return {
    instanceId,
    definitionId: definition.id,
    inputs,
    plotStyles,
    levelValues,
    levelStyles,
    fillStyles,
    visibility,
    precision:
      snapshot.precision === null || snapshot.precision === undefined
        ? null
        : clampNumber(
            snapshot.precision,
            0,
            MAXIMUM_PRECISION,
            definition.defaultPrecision,
          ),
    hidden: snapshot.hidden === true,
    labelsOnScale: snapshot.labelsOnScale !== false,
    valuesInStatus: snapshot.valuesInStatus !== false,
    inputsInStatus: snapshot.inputsInStatus !== false,
    paneOverride:
      snapshot.paneOverride === "price" ||
      snapshot.paneOverride === "separate"
        ? snapshot.paneOverride
        : null,
    scaleSide:
      snapshot.scaleSide === "left" || snapshot.scaleSide === "right"
        ? snapshot.scaleSide
        : null,
    waitForClose: snapshot.waitForClose !== false,
  };
}

function normalizeVisibilityRule(
  base: VisibilityRule,
  stored: unknown,
): VisibilityRule {
  // Legacy snapshots stored a plain boolean.
  if (typeof stored === "boolean") return { ...base, enabled: stored };
  if (typeof stored !== "object" || stored === null) return base;
  const candidate = stored as Partial<VisibilityRule>;
  const min = clampNumber(candidate.min, 1, 1000, base.min);
  const max = clampNumber(candidate.max, 1, 1000, base.max);
  return {
    enabled:
      typeof candidate.enabled === "boolean" ? candidate.enabled : base.enabled,
    min: Math.min(min, max),
    max: Math.max(min, max),
  };
}

export function toInstanceSnapshot(
  instance: IndicatorInstance,
): IndicatorInstanceSnapshot {
  return {
    inputs: instance.inputs,
    plotStyles: instance.plotStyles,
    levelValues: instance.levelValues,
    levelStyles: instance.levelStyles,
    fillStyles: instance.fillStyles,
    visibility: instance.visibility,
    precision: instance.precision,
    hidden: instance.hidden,
    labelsOnScale: instance.labelsOnScale,
    valuesInStatus: instance.valuesInStatus,
    inputsInStatus: instance.inputsInStatus,
    paneOverride: instance.paneOverride,
    scaleSide: instance.scaleSide,
    waitForClose: instance.waitForClose,
  };
}

export function withInputValue(
  definition: IndicatorDefinition,
  instance: IndicatorInstance,
  fieldId: string,
  value: unknown,
): IndicatorInstance {
  const field = definition.inputs.find((candidate) => candidate.id === fieldId);
  if (!field) return instance;

  return {
    ...instance,
    inputs: { ...instance.inputs, [fieldId]: coerceInputValue(field, value) },
  };
}

export function withPlotStyle(
  instance: IndicatorInstance,
  plotId: string,
  patch: Partial<PlotStyle>,
): IndicatorInstance {
  const current = instance.plotStyles[plotId];
  if (!current) return instance;

  return {
    ...instance,
    plotStyles: {
      ...instance.plotStyles,
      [plotId]: normalizePlotStyle(current, patch),
    },
  };
}

export function withLevelStyle(
  instance: IndicatorInstance,
  levelId: string,
  patch: Partial<LevelStyle>,
): IndicatorInstance {
  const current = instance.levelStyles[levelId];
  if (!current) return instance;

  return {
    ...instance,
    levelStyles: {
      ...instance.levelStyles,
      [levelId]: normalizeLevelStyle(current, patch),
    },
  };
}

export function withLevelValue(
  definition: IndicatorDefinition,
  instance: IndicatorInstance,
  levelId: string,
  value: unknown,
): IndicatorInstance {
  const level = definition.levels.find((candidate) => candidate.id === levelId);
  if (!level || !level.editable) return instance;

  return {
    ...instance,
    levelValues: {
      ...instance.levelValues,
      [levelId]: clampNumber(
        typeof value === "string" ? Number(value.trim()) : value,
        level.minimum,
        level.maximum,
        level.defaultValue,
      ),
    },
  };
}

export function withFillStyle(
  instance: IndicatorInstance,
  fillId: string,
  patch: Partial<FillStyle>,
): IndicatorInstance {
  const current = instance.fillStyles[fillId];
  if (!current) return instance;

  return {
    ...instance,
    fillStyles: {
      ...instance.fillStyles,
      [fillId]: normalizeFillStyle(current, patch),
    },
  };
}

export function withVisibility(
  instance: IndicatorInstance,
  timeframe: VisibilityTimeframe,
  visible: boolean,
): IndicatorInstance {
  return {
    ...instance,
    visibility: {
      ...instance.visibility,
      [timeframe]: { ...instance.visibility[timeframe], enabled: visible },
    },
  };
}

export function withVisibilityRange(
  instance: IndicatorInstance,
  timeframe: VisibilityTimeframe,
  min: number,
  max: number,
): IndicatorInstance {
  const base = instance.visibility[timeframe];
  const lo = Math.max(1, Math.min(min, max));
  const hi = Math.max(1, Math.max(min, max));
  return {
    ...instance,
    visibility: { ...instance.visibility, [timeframe]: { ...base, min: lo, max: hi } },
  };
}

export function withPrecision(
  instance: IndicatorInstance,
  precision: number | null,
): IndicatorInstance {
  return { ...instance, precision };
}

export function withStatusFlags(
  instance: IndicatorInstance,
  patch: Partial<
    Pick<IndicatorInstance, "labelsOnScale" | "valuesInStatus" | "inputsInStatus">
  >,
): IndicatorInstance {
  return { ...instance, ...patch };
}

export function withPaneOverride(
  instance: IndicatorInstance,
  paneOverride: IndicatorPane | null,
): IndicatorInstance {
  return { ...instance, paneOverride };
}

export function withScaleSide(
  instance: IndicatorInstance,
  scaleSide: IndicatorScaleSide | null,
): IndicatorInstance {
  return { ...instance, scaleSide };
}

export function withWaitForClose(
  instance: IndicatorInstance,
  waitForClose: boolean,
): IndicatorInstance {
  return { ...instance, waitForClose };
}

/** Effective decimal precision: explicit choice or the definition default. */
export function resolvePrecision(
  definition: IndicatorDefinition,
  instance: IndicatorInstance,
): number {
  return instance.precision ?? definition.defaultPrecision;
}

export function computeIndicator(
  definition: IndicatorDefinition,
  instance: IndicatorInstance,
  candles: readonly Candle[],
): IndicatorSeriesMap {
  const computed = definition.compute(candles, instance.inputs);
  const series: Record<string, NullableNumber[]> = {};
  for (const plot of definition.plots) {
    series[plot.id] =
      computed[plot.id] ?? Array.from({ length: candles.length }, () => null);
  }
  return series;
}

export function formatIndicatorTitle(
  definition: IndicatorDefinition,
  instance: IndicatorInstance,
  showInputs = true,
): string {
  if (!showInputs) return definition.shortName;
  const suffix = definition.formatLabel(instance.inputs).trim();
  return suffix ? `${definition.shortName} ${suffix}` : definition.shortName;
}

export function formatIndicatorValue(
  value: NullableNumber,
  precision: number,
): string {
  if (value === null) return "—";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

function normalizePlotStyle(
  base: PlotStyle,
  patch: Partial<PlotStyle> | undefined,
): PlotStyle {
  return {
    visible: typeof patch?.visible === "boolean" ? patch.visible : base.visible,
    color: normalizeColor(patch?.color, base.color),
    upColor: normalizeColor(patch?.upColor, base.upColor),
    downColor: normalizeColor(patch?.downColor, base.downColor),
    lineWidth: LINE_WIDTHS.includes(patch?.lineWidth as number)
      ? (patch?.lineWidth as number)
      : base.lineWidth,
    lineStyle: LINE_STYLES.includes(patch?.lineStyle as LineStyle)
      ? (patch?.lineStyle as LineStyle)
      : base.lineStyle,
    opacity: clampNumber(patch?.opacity, 0, 100, base.opacity),
  };
}

function normalizeLevelStyle(
  base: LevelStyle,
  patch: Partial<LevelStyle> | undefined,
): LevelStyle {
  return {
    visible: typeof patch?.visible === "boolean" ? patch.visible : base.visible,
    color: normalizeColor(patch?.color, base.color),
    lineWidth: LINE_WIDTHS.includes(patch?.lineWidth as number)
      ? (patch?.lineWidth as number)
      : base.lineWidth,
    lineStyle: LINE_STYLES.includes(patch?.lineStyle as LineStyle)
      ? (patch?.lineStyle as LineStyle)
      : base.lineStyle,
  };
}

function normalizeFillStyle(
  base: FillStyle,
  patch: Partial<FillStyle> | undefined,
): FillStyle {
  return {
    visible: typeof patch?.visible === "boolean" ? patch.visible : base.visible,
    color: normalizeColor(patch?.color, base.color),
    opacity: clampNumber(patch?.opacity, 0, 100, base.opacity),
  };
}

/**
 * Colours are written straight into inline styles, so only the hex form the
 * colour input produces is accepted.
 */
function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toLowerCase()
    : fallback;
}

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (!isFiniteNumber(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * False for a computed plot that never holds a value — a plot that only
 * carries colours for a custom renderer, like the session volume profile's
 * histogram. Still true before the series is computed, so the readout shows.
 */
export function producesValues(values: readonly (number | null | undefined)[] | undefined): boolean {
  if (!values) return true;
  return values.some((value) => value !== null && value !== undefined);
}

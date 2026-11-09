import type { Candle } from "./types";
import {
  PRICE_SOURCES,
  type CandleSource,
  type FillStyle,
  type IndicatorFill,
  type IndicatorInputs,
  type IndicatorLevel,
  type IndicatorPlot,
  type LineStyle,
  type NumberInputField,
  type PlotColorMode,
  type PlotKind,
  type PlotStyle,
  type SelectInputField,
  type SourceInputField,
  resolveSourceSeries,
} from "./indicator-schema";

export const COLORS = {
  blue: "#2962ff",
  purple: "#7e57c2",
  teal: "#00897b",
  orange: "#ff6d00",
  red: "#ef5350",
  green: "#26a69a",
  slate: "#787b86",
  black: "#131722",
  amber: "#f9a825",
} as const;

export function lengthField(defaultValue: number): NumberInputField {
  return numberField("length", "Length", defaultValue, 1, 5000);
}

export function offsetField(): NumberInputField {
  return numberField("offset", "Offset", 0, -500, 500);
}

export function numberField(
  id: string,
  label: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): NumberInputField {
  return { kind: "number", id, label, defaultValue, minimum, maximum, step: 1 };
}

export function decimalField(
  id: string,
  label: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
  step: number,
): NumberInputField {
  return {
    kind: "number",
    id,
    label,
    defaultValue,
    minimum,
    maximum,
    step,
    integer: false,
  };
}

export function sourceField(defaultValue: CandleSource): SourceInputField {
  return {
    kind: "source",
    id: "source",
    label: "Source",
    defaultValue,
    allowed: PRICE_SOURCES,
  };
}

export function selectField(
  id: string,
  label: string,
  defaultValue: string,
  options: readonly { readonly value: string; readonly label: string }[],
): SelectInputField {
  return { kind: "select", id, label, defaultValue, options };
}

export function linePlot(
  id: string,
  label: string,
  color: string,
  overrides: Partial<PlotStyle> = {},
): IndicatorPlot {
  return plot(id, label, "line", "fixed", { color, ...overrides });
}

export function histogramPlot(
  id: string,
  label: string,
  color: string,
  colorMode: PlotColorMode,
  overrides: Partial<PlotStyle> = {},
): IndicatorPlot {
  return plot(id, label, "histogram", colorMode, {
    color,
    opacity: 80,
    ...overrides,
  });
}

export function areaPlot(
  id: string,
  label: string,
  color: string,
  overrides: Partial<PlotStyle> = {},
): IndicatorPlot {
  return plot(id, label, "area", "fixed", { color, opacity: 20, ...overrides });
}

export function plot(
  id: string,
  label: string,
  kind: PlotKind,
  colorMode: PlotColorMode,
  overrides: Partial<PlotStyle>,
): IndicatorPlot {
  return {
    id,
    label,
    kind,
    colorMode,
    defaultStyle: {
      visible: true,
      color: COLORS.blue,
      upColor: COLORS.green,
      downColor: COLORS.red,
      lineWidth: 1,
      lineStyle: "solid",
      opacity: 100,
      ...overrides,
    },
  };
}

interface LevelOptions {
  readonly editable: boolean;
  readonly lineStyle?: LineStyle;
  readonly color?: string;
  readonly minimum?: number;
  readonly maximum?: number;
}

export function level(
  id: string,
  label: string,
  defaultValue: number,
  options: LevelOptions,
): IndicatorLevel {
  return {
    id,
    label,
    defaultValue,
    minimum: options.minimum ?? 0,
    maximum: options.maximum ?? 100,
    editable: options.editable,
    defaultStyle: {
      visible: true,
      color: options.color ?? COLORS.slate,
      lineWidth: 1,
      lineStyle: options.lineStyle ?? "solid",
    },
  };
}

export function fill(
  id: string,
  label: string,
  from: IndicatorFill["from"],
  to: IndicatorFill["to"],
  style: Partial<FillStyle> & { readonly color: string },
): IndicatorFill {
  return {
    id,
    label,
    from,
    to,
    defaultStyle: { visible: true, opacity: 10, ...style },
  };
}

export function plotAnchor(id: string): IndicatorFill["from"] {
  return { kind: "plot", id };
}

export function levelAnchor(id: string): IndicatorFill["from"] {
  return { kind: "level", id };
}

export function sourceSeries(
  candles: readonly Candle[],
  inputs: IndicatorInputs,
): (number | null)[] {
  return resolveSourceSeries(
    candles,
    stringInput(inputs, "source") as CandleSource,
  );
}

export function numberInput(inputs: IndicatorInputs, id: string): number {
  const value = inputs[id];
  return typeof value === "number" ? value : 0;
}

export function stringInput(inputs: IndicatorInputs, id: string): string {
  const value = inputs[id];
  return typeof value === "string" ? value : "close";
}

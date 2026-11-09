import type { ChartCandle } from "@/lib/market/chart-candles";

export type ChartStyle =
  "candles" | "hollow" | "bars" | "line" | "area" | "baseline" | "heikin";

export const CHART_STYLES: readonly { id: ChartStyle; label: string }[] = [
  { id: "bars", label: "Bars" },
  { id: "candles", label: "Candles" },
  { id: "hollow", label: "Hollow candles" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
  { id: "baseline", label: "Baseline" },
  { id: "heikin", label: "Heikin Ashi" },
];

export function isChartStyle(value: unknown): value is ChartStyle {
  return CHART_STYLES.some((style) => style.id === value);
}

export function toHeikinAshi(candles: readonly ChartCandle[]): ChartCandle[] {
  const result: ChartCandle[] = [];
  let previousOpen = 0;
  let previousClose = 0;
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]!;
    const close = (candle.open + candle.high + candle.low + candle.close) / 4;
    const open =
      index === 0
        ? (candle.open + candle.close) / 2
        : (previousOpen + previousClose) / 2;
    result.push({
      time: candle.time,
      open,
      high: Math.max(candle.high, open, close),
      low: Math.min(candle.low, open, close),
      close,
      volume: candle.volume,
    });
    previousOpen = open;
    previousClose = close;
  }
  return result;
}

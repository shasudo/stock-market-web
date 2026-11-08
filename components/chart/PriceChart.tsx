"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartCandle } from "@/lib/types";

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v === "" ? fallback : v;
}

function toTime(t: string): UTCTimestamp | string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000) as UTCTimestamp;
}

function sma(values: Array<number | null>, period: number): Array<number | null> {
  return values.map((_, i) => {
    if (i + 1 < period) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j];
      if (v == null) return null;
      sum += v;
    }
    return sum / period;
  });
}

function ema(values: Array<number | null>, period: number): Array<number | null> {
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let seed: number[] = [];
  return values.map((v) => {
    if (v == null) {
      prev = null;
      seed = [];
      return null;
    }
    if (prev == null) {
      seed.push(v);
      if (seed.length < period) return null;
      prev = seed.reduce((a, b) => a + b, 0) / seed.length;
      return prev;
    }
    prev = v * k + prev * (1 - k);
    return prev;
  });
}

export type OverlayId = "sma20" | "sma50" | "ema12" | "ema26";

export const OVERLAYS: Array<{ id: OverlayId; label: string; period: number; kind: "sma" | "ema"; colorVar: string; fallback: string }> = [
  { id: "sma20", label: "SMA 20", period: 20, kind: "sma", colorVar: "--smp-accent", fallback: "#1f6feb" },
  { id: "sma50", label: "SMA 50", period: 50, kind: "sma", colorVar: "--smp-faint", fallback: "#6e7681" },
  { id: "ema12", label: "EMA 12", period: 12, kind: "ema", colorVar: "--smp-warn", fallback: "#d29922" },
  { id: "ema26", label: "EMA 26", period: 26, kind: "ema", colorVar: "--smp-fg", fallback: "#e6edf3" },
];

/** Candles + volume + selectable SMA/EMA overlays. Theme-aware via design tokens. */
export function PriceChart({ candles, overlays = ["sma20", "sma50"] }: { candles: ChartCandle[]; overlays?: OverlayId[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el == null) return;
    const faint = cssVar("--smp-faint", "#6e7681");
    const line = cssVar("--smp-line", "#21262d");
    const up = cssVar("--smp-up", "#3fb950");
    const down = cssVar("--smp-down", "#f85149");

    const chart: IChartApi = createChart(el, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: faint },
      grid: { vertLines: { color: line }, horzLines: { color: line } },
      rightPriceScale: { borderColor: line },
      timeScale: { borderColor: line, timeVisible: true },
      height: 420,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      wickUpColor: up,
      wickDownColor: down,
      borderVisible: false,
    });
    const vol = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" } });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const closes: Array<number | null> = [];
    const rows = candles.flatMap((c) => {
      const time = toTime(c.time);
      if (time == null) return [];
      closes.push(c.close);
      return [{ c, time }];
    });
    series.setData(
      rows.map(({ c, time }) => ({ time, open: c.open, high: c.high, low: c.low, close: c.close })),
    );
    vol.setData(
      rows.map(({ c, time }) => ({
        time,
        value: c.volume,
        color: c.close >= c.open ? up + "55" : down + "55",
      })),
    );

    for (const def of OVERLAYS) {
      if (!overlays.includes(def.id)) continue;
      const values = def.kind === "sma" ? sma(closes, def.period) : ema(closes, def.period);
      const lineSeries = chart.addSeries(LineSeries, {
        color: cssVar(def.colorVar, def.fallback),
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
      });
      lineSeries.setData(
        rows.flatMap(({ time }, i) => {
          const v = values[i] ?? null;
          return v == null ? [] : [{ time, value: v }];
        }),
      );
    }

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [candles, overlays]);

  if (candles.length === 0) return null;
  return <div ref={ref} className="h-[420px] w-full" aria-label="Price chart" />;
}

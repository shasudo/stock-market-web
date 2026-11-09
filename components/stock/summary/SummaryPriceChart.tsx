"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import apiClient from "@/lib/api-client";
import type { FinancialStatementPeriod } from "@/lib/fundamentals/types";
import {
  indexTrendLineColor,
  toIndexPeLinePoints,
} from "@/lib/market/index-pe-chart";

interface ChartCandle {
  readonly time: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

const RANGES = [
  { id: "1M", sessions: 22 },
  { id: "6M", sessions: 132 },
  { id: "1Y", sessions: 264 },
  { id: "3Y", sessions: 792 },
  { id: "5Y", sessions: 1320 },
  { id: "10Y", sessions: 2640 },
  { id: "MAX", sessions: Number.POSITIVE_INFINITY },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

const isCandle = (value: unknown): value is ChartCandle => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.time === "string" &&
    typeof v.close === "number" &&
    typeof v.volume === "number"
  );
};

function sma(values: readonly number[], length: number): (number | null)[] {
  return values.map((_, i) => {
    if (i + 1 < length) return null;
    let total = 0;
    for (let j = i - length + 1; j <= i; j += 1) total += values[j];
    return total / length;
  });
}

export function SummaryPriceChart({
  symbol,
  annualIncome,
  shares,
  indexPeHistory,
  pctChange,
}: {
  symbol: string;
  annualIncome: readonly FinancialStatementPeriod[];
  shares: number | null;
  /** Index P/E history (NSE-published series); enables PE mode for indices. */
  indexPeHistory?: readonly { date: string; pe: number }[] | null;
  /** Index day change percent; colors the index P/E line. */
  pctChange?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [candles, setCandles] = useState<readonly ChartCandle[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">(
    "loading",
  );
  const [range, setRange] = useState<RangeId>("1Y");
  const [mode, setMode] = useState<"price" | "pe">("price");
  const [showVolume, setShowVolume] = useState(true);
  const [showDMA50, setShowDMA50] = useState(true);
  const [showDMA200, setShowDMA200] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async (): Promise<void> => {
      setStatus("loading");
      try {
        const response = await apiClient.get<unknown>(
          `/api/market-data/chart?symbol=${encodeURIComponent(symbol)}&timeframe=D`,
          { signal: controller.signal },
        );
        if (!active) return;
        const data = response.data as {
          status?: string;
          candles?: unknown;
        };
        const list = Array.isArray(data?.candles)
          ? data.candles.filter(isCandle)
          : [];
        if (data?.status === "ready" && list.length > 0) {
          setCandles(list);
          setStatus("ready");
        } else {
          setCandles([]);
          setStatus("empty");
        }
      } catch (error: unknown) {
        if (!active) return;
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus("error");
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [symbol]);

  const indexPePoints = useMemo(
    () => toIndexPeLinePoints(indexPeHistory),
    [indexPeHistory],
  );
  const peByDate = useMemo(() => {
    if (shares === null || annualIncome.length === 0) return null;
    return annualIncome.map((period) => {
      const net = period.values.netIncome;
      return {
        date: period.date.slice(0, 10),
        eps:
          typeof net === "number" && Number.isFinite(net) && shares
            ? net / shares
            : null,
      };
    });
  }, [annualIncome, shares]);

  /** PE mode served by the index P/E series (stocks use per-share earnings). */
  const isIndexPeMode =
    mode === "pe" && peByDate === null && indexPePoints.length > 0;
  const latestIndexPe =
    indexPePoints.length > 0
      ? (indexPePoints[indexPePoints.length - 1] ?? null)
      : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || status !== "ready" || candles.length === 0) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#FFFFFF" },
        textColor: "#6E6E73",
        fontFamily: "inherit",
      },
      grid: {
        vertLines: { color: "rgba(0,0,0,0.04)" },
        horzLines: { color: "rgba(0,0,0,0.04)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(0,0,0,0.08)" },
      timeScale: { borderColor: "rgba(0,0,0,0.08)" },
    });
    chartRef.current = chart;

    const sessions =
      RANGES.find((r) => r.id === range)?.sessions ?? Number.POSITIVE_INFINITY;
    const sliced =
      sessions === Number.POSITIVE_INFINITY
        ? candles
        : candles.slice(-Math.min(candles.length, sessions));

    const mainSeries: ISeriesApi<"Area" | "Line"> =
      mode === "price"
        ? chart.addSeries(AreaSeries, {
            lineColor: "#2563EB",
            topColor: "rgba(37,99,235,0.28)",
            bottomColor: "rgba(37,99,235,0.02)",
            lineWidth: 2,
            priceFormat: { type: "price", precision: 2, minMove: 0.01 },
          })
        : chart.addSeries(LineSeries, {
            color:
              peByDate !== null
                ? "#7C3AED"
                : indexTrendLineColor(pctChange ?? null),
            lineWidth: 2,
            priceFormat: { type: "price", precision: 2, minMove: 0.01 },
          });

    if (mode === "price") {
      mainSeries.setData(sliced.map((c) => ({ time: c.time, value: c.close })));
      const closes = candles.map((c) => c.close);
      const dma50 = sma(closes, 50);
      const dma200 = sma(closes, 200);
      const offset = candles.length - sliced.length;
      if (showDMA50) {
        const line = chart.addSeries(LineSeries, {
          color: "#F59E0B",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        const points: { time: string; value: number }[] = [];
        sliced.forEach((c, i) => {
          const v = dma50[offset + i];
          if (v !== null) points.push({ time: c.time, value: v });
        });
        line.setData(points);
      }
      if (showDMA200) {
        const line = chart.addSeries(LineSeries, {
          color: "#F43F5E",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        const points: { time: string; value: number }[] = [];
        sliced.forEach((c, i) => {
          const v = dma200[offset + i];
          if (v !== null) points.push({ time: c.time, value: v });
        });
        line.setData(points);
      }
      if (showVolume) {
        const volume = chart.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          lastValueVisible: false,
          priceLineVisible: false,
        });
        volume.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        volume.setData(
          sliced.map((c) => ({
            time: c.time,
            value: c.volume,
            color:
              c.close >= c.open
                ? "rgba(16,185,129,0.5)"
                : "rgba(244,63,94,0.5)",
          })),
        );
      }
    } else if (peByDate) {
      const sorted = [...peByDate].sort((a, b) => (a.date < b.date ? 1 : -1));
      const points: { time: string; value: number }[] = [];
      for (const c of sliced) {
        const day = c.time.slice(0, 10);
        const anchor = sorted.find(
          (e) => e.date <= day && e.eps !== null && (e.eps as number) > 0,
        );
        if (anchor?.eps)
          points.push({
            time: c.time,
            value: c.close / (anchor.eps as number),
          });
      }
      mainSeries.setData(points);
    } else if (indexPePoints.length > 0) {
      // Index P/E history stands alone: slice it to the visible window.
      const start = sliced.length > 0 ? sliced[0]?.time ?? null : null;
      mainSeries.setData(
        start === null
          ? indexPePoints
          : indexPePoints.filter((p) => p.time >= start),
      );
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [
    candles,
    status,
    range,
    mode,
    showVolume,
    showDMA50,
    showDMA200,
    peByDate,
    indexPePoints,
    pctChange,
  ]);

  const peAvailable =
    (peByDate?.length ?? 0) > 0 || indexPePoints.length > 0;

  return (
    <div>
      <div className="mb-2 flex items-center gap-1 flex-wrap">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
              range === r.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {r.id}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setMode("price")}
          className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
            mode === "price"
              ? "bg-info/10 text-info"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Price
        </button>
        {peAvailable ? (
          <button
            type="button"
            onClick={() => setMode("pe")}
            className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
              mode === "pe"
                ? "bg-info/10 text-info"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            PE Ratio
          </button>
        ) : null}
      </div>
      {status === "loading" ? (
        <p className="py-16 text-center text-xs text-muted-foreground">
          Loading chart…
        </p>
      ) : status === "error" ? (
        <p className="py-16 text-center text-xs text-error">
          Could not load the chart right now.
        </p>
      ) : status === "empty" ? (
        <p className="py-16 text-center text-xs text-muted-foreground">
          No price history stored for this symbol yet.
        </p>
      ) : (
        <div ref={containerRef} className="h-[320px] w-full" />
      )}
      {status === "ready" ? (
        <div className="mt-2 flex items-center gap-4 flex-wrap text-[11px] font-semibold text-muted-foreground">
          {isIndexPeMode && latestIndexPe ? (
            <span>
              P/E{" "}
              <span className="text-foreground">
                {latestIndexPe.value.toFixed(2)}
              </span>{" "}
              · {latestIndexPe.time}
            </span>
          ) : (
            <span>
              Price on <span className="text-foreground">NSE</span>
            </span>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={showVolume}
              onChange={(e) => setShowVolume(e.target.checked)}
              className="h-3.5 w-3.5 accent-blue-600"
            />
            Volume
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={showDMA50}
              onChange={(e) => setShowDMA50(e.target.checked)}
              className="h-3.5 w-3.5 accent-amber-500"
            />
            <span
              className="inline-block h-0.5 w-4 bg-amber-500"
              aria-hidden="true"
            />
            50 DMA
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={showDMA200}
              onChange={(e) => setShowDMA200(e.target.checked)}
              className="h-3.5 w-3.5 accent-rose-500"
            />
            <span
              className="inline-block h-0.5 w-4 bg-rose-500"
              aria-hidden="true"
            />
            200 DMA
          </label>
        </div>
      ) : null}
    </div>
  );
}

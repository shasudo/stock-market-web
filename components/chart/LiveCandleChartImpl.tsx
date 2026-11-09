"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type Time,
} from "lightweight-charts";
import {
  Bell,
  ChartCandlestick,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  RANGE_IDS,
  RANGE_TIMEFRAME,
  indexAtOrAfterDate,
  sliceCandlesToRange,
  type RangeId,
} from "@/lib/chart/analytics";
import { resolveCoreCanvasTheme, useIsDark } from "@/lib/chart/chart-theme";
import { openChartAlerts, openChartIndicators } from "@/lib/chart/chart-events";
import {
  fetchChartData,
  type ChartDataDTO,
} from "@/lib/market/chart-data-client";
import type { ChartCandle, ChartTimeframe } from "@/lib/market/chart-candles";
import SymbolSearchDialog, {
  type SearchResult,
} from "./terminal/SymbolSearchDialog";

const UP = "#34C759";
const DOWN = "#FF3B30";
const UP_VOLUME = "rgba(52,199,89,0.35)";
const DOWN_VOLUME = "rgba(255,59,48,0.35)";

type CoreStyle = "candles" | "line" | "area";

const STYLE_OPTIONS: readonly { id: CoreStyle; label: string }[] = [
  { id: "candles", label: "Candles" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
];

const OPEN_POLL_MS = 5_000;
const CLOSED_POLL_MS = 60_000;
const LOADING_POLL_MS = 2_000;
const TAIL_CANDLES = 4;

export interface LiveCandleChartProps {
  readonly symbol: string;
  readonly exchange?: string;
  readonly defaultTimeframe?: ChartTimeframe;
  readonly defaultRange?: RangeId;
  readonly height?: number | string;
  readonly className?: string;
  readonly onSymbolChange?: (symbol: string) => void;
}

interface Legend {
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

function formatPrice(value: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatVolume(value: number): string {
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)}Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)}L`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

function toLegend(candle: ChartCandle): Legend {
  return {
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

function initialRange(
  defaultRange: RangeId | undefined,
  defaultTimeframe: ChartTimeframe | undefined,
): RangeId {
  if (defaultRange) return defaultRange;
  if (
    defaultTimeframe === "1" ||
    defaultTimeframe === "5" ||
    defaultTimeframe === "15" ||
    defaultTimeframe === "60"
  ) {
    return "1D";
  }
  if (defaultTimeframe === "W") return "5Y";
  if (defaultTimeframe === "M") return "ALL";
  return "1Y";
}

export default function LiveCandleChart({
  symbol,
  exchange,
  defaultTimeframe = "D",
  defaultRange,
  height = 540,
  className = "",
  onSymbolChange,
}: LiveCandleChartProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const prevCloseLineRef = useRef<IPriceLine | null>(null);
  const lastLineRef = useRef<IPriceLine | null>(null);
  const renderedRef = useRef<{ key: string; candles: readonly ChartCandle[] }>({
    key: "",
    candles: [],
  });
  const candlesByTimeRef = useRef<Map<Time, ChartCandle>>(new Map());
  const styleRef = useRef<CoreStyle>("candles");

  const [range, setRange] = useState<RangeId>(() =>
    initialRange(defaultRange, defaultTimeframe),
  );
  const [style, setStyle] = useState<CoreStyle>("candles");
  const [searchOpen, setSearchOpen] = useState(false);
  const [goToDate, setGoToDate] = useState("");
  const requestKey = `${symbol}|${exchange ?? ""}|${range}`;
  // Reset the go-to-date input when the viewed symbol/range changes.
  // Done as a render-phase adjustment (the documented replacement for
  // resetting state inside an effect).
  const [prevRequestKey, setPrevRequestKey] = useState(requestKey);
  if (prevRequestKey !== requestKey) {
    setPrevRequestKey(requestKey);
    setGoToDate("");
  }
  const [result, setResult] = useState<{
    readonly key: string;
    readonly data: ChartDataDTO;
    readonly usedTimeframe: ChartTimeframe;
    readonly intradayFallback: boolean;
  } | null>(null);
  const [failure, setFailure] = useState<{
    readonly key: string;
    readonly message: string;
  } | null>(null);
  const [legend, setLegend] = useState<Legend | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    styleRef.current = style;
  }, [style]);

  const activeSeries = useCallback(():
    | ISeriesApi<"Candlestick">
    | ISeriesApi<"Line">
    | ISeriesApi<"Area">
    | null => {
    const current = styleRef.current;
    if (current === "line") return lineSeriesRef.current;
    if (current === "area") return areaSeriesRef.current;
    return candleSeriesRef.current;
  }, []);

  const ensureMainSeries = useCallback((chart: IChartApi, next: CoreStyle) => {
    for (const entry of [
      candleSeriesRef,
      lineSeriesRef,
      areaSeriesRef,
    ] as const) {
      if (entry.current) {
        chart.removeSeries(entry.current);
        entry.current = null;
      }
    }
    prevCloseLineRef.current = null;
    lastLineRef.current = null;
    const priceFormat = { type: "price" as const, precision: 2, minMove: 0.01 };
    if (next === "line") {
      const series = chart.addSeries(LineSeries, {
        color: "#007AFF",
        lineWidth: 2,
        priceFormat,
      });
      lineSeriesRef.current = series;
      series.priceScale().applyOptions({
        scaleMargins: { top: 0.06, bottom: 0.26 },
      });
      return series;
    }
    if (next === "area") {
      const series = chart.addSeries(AreaSeries, {
        lineColor: "#007AFF",
        topColor: "rgba(0,122,255,0.28)",
        bottomColor: "rgba(0,122,255,0.02)",
        lineWidth: 2,
        priceFormat,
      });
      areaSeriesRef.current = series;
      series.priceScale().applyOptions({
        scaleMargins: { top: 0.06, bottom: 0.26 },
      });
      return series;
    }
    const series = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceFormat,
    });
    candleSeriesRef.current = series;
    series.priceScale().applyOptions({
      scaleMargins: { top: 0.06, bottom: 0.26 },
    });
    return series;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialTheme = resolveCoreCanvasTheme(
      typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark"),
    );
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: initialTheme.background },
        textColor: initialTheme.text,
        fontFamily: "inherit",
      },
      grid: {
        vertLines: { color: initialTheme.grid },
        horzLines: { color: initialTheme.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: initialTheme.border },
      timeScale: {
        borderColor: initialTheme.border,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const main = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    main.priceScale().applyOptions({
      scaleMargins: { top: 0.06, bottom: 0.26 },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });

    chart.subscribeCrosshairMove((param) => {
      const hovered = param.time
        ? candlesByTimeRef.current.get(param.time)
        : undefined;
      if (hovered) {
        setLegend(toLegend(hovered));
        return;
      }
      const all = renderedRef.current.candles;
      const last = all[all.length - 1];
      setLegend(last ? toLegend(last) : null);
    });

    chartRef.current = chart;
    candleSeriesRef.current = main;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
      areaSeriesRef.current = null;
      volumeSeriesRef.current = null;
      prevCloseLineRef.current = null;
      lastLineRef.current = null;
      renderedRef.current = { key: "", candles: [] };
    };
  }, []);

  const isDark = useIsDark();
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const theme = resolveCoreCanvasTheme(isDark);
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.text,
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      rightPriceScale: { borderColor: theme.border },
    });
    chart.timeScale().applyOptions({ borderColor: theme.border });
  }, [isDark]);

  const render = useCallback(
    (
      chartData: ChartDataDTO,
      key: string,
      isTail: boolean,
      nextStyle: CoreStyle,
    ) => {
      const chart = chartRef.current;
      const volumeSeries = volumeSeriesRef.current;
      if (!chart || !volumeSeries) return;
      let main = activeSeries();
      if (!main || styleRef.current !== nextStyle) {
        styleRef.current = nextStyle;
        main = ensureMainSeries(chart, nextStyle);
      }

      const sliced = sliceCandlesToRange(chartData.candles, range);
      const toVolume = (candle: ChartCandle) => ({
        time: candle.time as Time,
        value: candle.volume,
        color: candle.close >= candle.open ? UP_VOLUME : DOWN_VOLUME,
      });
      const toBar = (candle: ChartCandle) => ({
        time: candle.time as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
      const toPoint = (candle: ChartCandle) => ({
        time: candle.time as Time,
        value: candle.close,
      });

      const setMainData = (candles: readonly ChartCandle[]) => {
        if (nextStyle === "candles") {
          (main as ISeriesApi<"Candlestick">).setData(candles.map(toBar));
        } else if (nextStyle === "line") {
          (main as ISeriesApi<"Line">).setData(candles.map(toPoint));
        } else {
          (main as ISeriesApi<"Area">).setData(candles.map(toPoint));
        }
      };
      const updateMain = (candle: ChartCandle) => {
        if (nextStyle === "candles") {
          (main as ISeriesApi<"Candlestick">).update(toBar(candle));
        } else if (nextStyle === "line") {
          (main as ISeriesApi<"Line">).update(toPoint(candle));
        } else {
          (main as ISeriesApi<"Area">).update(toPoint(candle));
        }
      };

      let candles: readonly ChartCandle[];
      if (isTail) {
        const merged = [...renderedRef.current.candles];
        for (const candle of sliced) {
          const lastRendered = merged[merged.length - 1];
          if (lastRendered && candle.time === lastRendered.time) {
            merged[merged.length - 1] = candle;
          } else if (!lastRendered || candle.time > lastRendered.time) {
            merged.push(candle);
          } else {
            continue;
          }
          updateMain(candle);
          volumeSeries.update(toVolume(candle));
        }
        candles = sliceCandlesToRange(merged, range);
      } else {
        candles = sliced;
        setMainData(candles);
        volumeSeries.setData(candles.map(toVolume));
        chart.timeScale().fitContent();
      }

      renderedRef.current = { key, candles };
      candlesByTimeRef.current = new Map(
        candles.map((candle) => [candle.time as Time, candle]),
      );

      if (prevCloseLineRef.current) {
        main.removePriceLine(prevCloseLineRef.current);
        prevCloseLineRef.current = null;
      }
      if (lastLineRef.current) {
        main.removePriceLine(lastLineRef.current);
        lastLineRef.current = null;
      }
      if (chartData.quote.prevClose > 0) {
        prevCloseLineRef.current = main.createPriceLine({
          price: chartData.quote.prevClose,
          color: "#86868B",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Prev close",
        });
      }
      const last = candles[candles.length - 1];
      if (last) {
        lastLineRef.current = main.createPriceLine({
          price: last.close,
          color: last.close >= last.open ? UP : DOWN,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Last",
        });
      }

      setLegend(last ? toLegend(last) : null);
    },
    [activeSeries, ensureMainSeries, range],
  );

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const key = requestKey;

    renderedRef.current = { key: "", candles: [] };
    const main = activeSeries();
    main?.setData([]);
    volumeSeriesRef.current?.setData([]);

    async function load(): Promise<void> {
      let nextDelay = CLOSED_POLL_MS;
      try {
        const rendered = renderedRef.current;
        const isTail =
          rendered.key.startsWith(`${key}|`) && rendered.candles.length > 0;
        const timeframe = RANGE_TIMEFRAME[range];
        const tail = isTail ? TAIL_CANDLES : undefined;
        let chartData = await fetchChartData(
          { symbol, exchange, timeframe, ...(tail ? { tail } : {}) },
          controller.signal,
        );
        let usedTimeframe: ChartTimeframe = timeframe;
        let intradayFallback = false;
        const intraday =
          timeframe === "5" || timeframe === "15" || timeframe === "60";
        if (
          intraday &&
          (chartData.status !== "ready" || chartData.candles.length === 0)
        ) {
          try {
            const daily = await fetchChartData(
              { symbol, exchange, timeframe: "D" },
              controller.signal,
            );
            if (daily.status === "ready" && daily.candles.length > 0) {
              chartData = daily;
              usedTimeframe = "D";
              intradayFallback = true;
            }
          } catch {
            // Keep the intraday response; its status drives the retry below.
          }
        }
        if (cancelled) return;
        const renderKey = `${key}|${usedTimeframe}|${styleRef.current}`;
        setResult({
          key: renderKey,
          data: chartData,
          usedTimeframe,
          intradayFallback,
        });
        setFailure(null);
        setUpdatedAt(new Date());
        if (chartData.status === "loading") {
          nextDelay = LOADING_POLL_MS;
        } else {
          render(
            chartData,
            renderKey,
            isTail && !intradayFallback,
            styleRef.current,
          );
          nextDelay = chartData.marketOpen ? OPEN_POLL_MS : CLOSED_POLL_MS;
        }
      } catch (caught) {
        if (cancelled || controller.signal.aborted) return;
        setFailure({
          key,
          message:
            caught instanceof Error
              ? caught.message
              : "Chart data is unavailable.",
        });
        nextDelay = CLOSED_POLL_MS / 2;
      }
      if (!cancelled) timer = setTimeout(() => void load(), nextDelay);
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [symbol, exchange, range, requestKey, render, activeSeries]);

  useEffect(() => {
    if (!result || !result.key.startsWith(requestKey)) return;
    render(
      result.data,
      `${requestKey}|${result.usedTimeframe}|${style}`,
      false,
      style,
    );
  }, [style, result, requestKey, render]);

  const scrollToDate = useCallback((iso: string) => {
    setGoToDate(iso);
    const chart = chartRef.current;
    const candles = renderedRef.current.candles;
    if (!chart || !iso || candles.length === 0) return;
    const index = indexAtOrAfterDate(candles, iso);
    if (index < 0) {
      chart.timeScale().fitContent();
      return;
    }
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, index - 10),
      to: Math.min(candles.length + 4, index + 60),
    });
  }, []);

  const onPickSymbol = useCallback(
    (picked: SearchResult) => {
      setSearchOpen(false);
      if (picked.symbol === symbol.toUpperCase()) return;
      if (onSymbolChange) {
        onSymbolChange(picked.symbol);
      } else {
        router.push(`/chart/${encodeURIComponent(picked.symbol)}`);
      }
    },
    [symbol, onSymbolChange, router],
  );

  const data = result && result.key.startsWith(requestKey) ? result.data : null;
  const usedTimeframe =
    result && result.key.startsWith(requestKey) ? result.usedTimeframe : null;
  const intradayFallback =
    result && result.key.startsWith(requestKey)
      ? result.intradayFallback
      : false;
  const error = failure?.key === requestKey ? failure.message : null;
  const loading = !error && (!data || data.status === "loading");
  const quote = data?.quote;
  const isUp = (quote?.netChange ?? 0) >= 0;
  const empty = !loading && !error && data?.status === "empty";
  const lastPrice = quote?.lastPrice ?? legend?.close ?? 0;

  return (
    <div
      id="chart-core"
      className={`flex flex-col overflow-hidden rounded-2xl bg-card ${className}`}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <button
          id="chart-symbol-search"
          type="button"
          onClick={() => setSearchOpen(true)}
          title="Search symbol"
          aria-label="Search symbol"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-foreground hover:bg-muted"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          {data?.displayName ?? symbol.toUpperCase()}
        </button>
        <span className="flex items-center gap-1">
          {STYLE_OPTIONS.map((option) => (
            <button
              key={option.id}
              id={`chart-core-style-${option.id}`}
              type="button"
              aria-pressed={style === option.id}
              onClick={() => setStyle(option.id)}
              className={`rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
                style === option.id
                  ? "bg-foreground text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </span>
        <button
          id="chart-indicators-button"
          type="button"
          onClick={() => openChartIndicators(symbol.toUpperCase())}
          title="Indicators"
          aria-label="Open indicators"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChartCandlestick className="h-3.5 w-3.5" />
          Indicators
        </button>
        <button
          id="chart-alerts-button"
          type="button"
          onClick={() =>
            openChartAlerts(symbol.toUpperCase(), legend?.close ?? null)
          }
          title="Create alert"
          aria-label="Create alert"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-3.5 w-3.5" />
          Alert
        </button>
        <span className="flex-1" />
        <span
          className="flex items-center gap-1"
          title="Trade at the last price"
        >
          <span
            id="chart-core-sell"
            className="rounded-md bg-error/10 px-2 py-1 font-mono text-[11px] font-bold text-error"
          >
            SELL {formatPrice(lastPrice)}
          </span>
          <span
            id="chart-core-buy"
            className="rounded-md bg-success/10 px-2 py-1 font-mono text-[11px] font-bold text-success"
          >
            BUY {formatPrice(lastPrice)}
          </span>
        </span>
      </div>

      <div
        id="chart-core-header"
        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-border px-3 py-1.5 text-xs"
      >
        <span className="font-bold text-foreground">
          {data?.displayName ?? symbol.toUpperCase()}
        </span>
        <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-bold text-muted-foreground">
          {data?.exchange ?? exchange ?? "NSE"}
        </span>
        <span className="rounded bg-foreground px-1 py-0.5 text-[10px] font-bold text-primary-foreground">
          {range}
        </span>
        {usedTimeframe && (
          <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {usedTimeframe === "D" ||
            usedTimeframe === "W" ||
            usedTimeframe === "M"
              ? `1${usedTimeframe}`
              : `${usedTimeframe}m`}
          </span>
        )}
        {legend && (
          <span
            id="chart-core-ohlc"
            className="flex flex-wrap gap-x-2 font-mono text-[11px] text-muted-foreground"
          >
            <span>O {formatPrice(legend.open)}</span>
            <span>H {formatPrice(legend.high)}</span>
            <span>L {formatPrice(legend.low)}</span>
            <span style={{ color: legend.close >= legend.open ? UP : DOWN }}>
              C {formatPrice(legend.close)}
            </span>
            <span>Vol {formatVolume(legend.volume)}</span>
          </span>
        )}
        {quote && (
          <span
            className="font-mono font-bold"
            style={{ color: isUp ? UP : DOWN }}
          >
            {isUp ? "+" : ""}
            {quote.netChange.toFixed(2)} ({isUp ? "+" : ""}
            {quote.pctChange.toFixed(2)}%)
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <div
          className="flex items-center gap-0.5"
          role="group"
          aria-label="Chart range"
        >
          {RANGE_IDS.map((id) => (
            <button
              key={id}
              id={`chart-core-range-${id}`}
              type="button"
              aria-pressed={range === id}
              onClick={() => setRange(id)}
              className={`rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
                range === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {id}
            </button>
          ))}
        </div>
        <input
          id="chart-core-date-picker"
          type="date"
          value={goToDate}
          aria-label="Go to date"
          title="Go to date"
          onChange={(event) => scrollToDate(event.target.value)}
          className="ml-1 rounded-lg border border-border px-1.5 py-1 text-[11px] font-semibold text-muted-foreground outline-none focus:border-ring"
        />
        <span className="flex-1" />
        <span
          id="chart-core-status"
          className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"
          title={
            data
              ? `Quote synced ${new Date(data.quote.syncedAt).toLocaleString()}`
              : ""
          }
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              data?.delayed
                ? "bg-warning"
                : data?.marketOpen
                  ? "animate-pulse bg-success"
                  : "bg-muted-foreground"
            }`}
          />
          {data?.delayed
            ? "Delayed"
            : data?.marketOpen
              ? "Live"
              : "Market closed"}
          {updatedAt && (
            <span className="font-mono font-normal">
              · Updated {updatedAt.toLocaleTimeString()}
            </span>
          )}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />

        {intradayFallback && !loading && !empty && (
          <p className="absolute bottom-2 left-3 z-10 rounded-md bg-background/85 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            Intraday unavailable — showing daily bars.
          </p>
        )}

        {loading && !error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/85">
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary" />
            <p className="text-xs font-semibold text-muted-foreground">
              {data?.status === "loading"
                ? "Fetching intraday candles…"
                : `Loading ${symbol} chart…`}
            </p>
          </div>
        )}

        {(error || empty) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-card px-6 text-center">
            <p className="text-sm font-semibold text-foreground">
              {error ?? "No chart data"}
            </p>
            {empty && data?.message && (
              <p className="max-w-sm text-xs text-muted-foreground">
                {data.message}
              </p>
            )}
            {error && (
              <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <RefreshCw className="h-3 w-3" /> Retrying automatically
              </p>
            )}
          </div>
        )}
      </div>
      <SymbolSearchDialog
        open={searchOpen}
        title="Symbol search"
        onSelect={onPickSymbol}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  );
}

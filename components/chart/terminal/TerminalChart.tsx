"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  AreaSeries,
  BarSeries,
  BaselineSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesType,
  type TickMarkType,
  type Time,
} from "lightweight-charts";
import { BarIndex } from "@/lib/chart/bar-index";
import { toHeikinAshi, type ChartStyle } from "@/lib/chart/chart-styles";
import {
  isDarkDocument,
  resolveCanvasTheme,
  useIsDark,
} from "@/lib/chart/chart-theme";
import {
  candlePalette,
  formatTick,
  isIntraday,
  mainPriceFormat,
  prevCloseTints,
  volumeColor,
  type ChartDisplaySettings,
  type CrosshairDash,
} from "@/lib/chart/display-settings";
import { DrawingsPrimitive } from "@/lib/chart/drawings-primitive";
import { FillPrimitive } from "@/lib/chart/fill-primitive";
import { chartTimeToEpoch } from "@/lib/chart/bar-index";
import {
  SessionVolumeProfilePrimitive,
  type ProfileDrawSession,
  type ProfileLine,
  type SessionProfileStyle,
} from "@/lib/chart/session-profile-primitive";
import {
  computeSessionProfiles,
  normalizeProfileRows,
  normalizeValueAreaPct,
} from "@/lib/technical/session-profile";
import {
  cloneDrawing,
  createDrawing,
  getToolDefinition,
  isDrawingVisibleOn,
  moveDrawing,
  movePoint,
  sortByVisualOrder,
  type Drawing,
  type DrawingPoint,
  type DrawingType,
} from "@/lib/chart/drawings";
import type { ChartCandle, ChartTimeframe } from "@/lib/market/chart-candles";
import { getIndicatorDefinition } from "@/lib/technical/indicator-catalog";
import {
  isVisibleOn,
  type IndicatorFill,
  type IndicatorInstance,
  type IndicatorSeriesMap,
  type LineStyle as PlotLineStyle,
  type VisibilityTimeframe,
} from "@/lib/technical/indicator-schema";
import type { ScaleMode } from "./terminal-settings";
import type { CursorKind } from "./tool-icons";

type AnySeries = ISeriesApi<SeriesType, Time>;

const UP = "#089981";
const DOWN = "#F23645";
const INITIAL_VISIBLE_BARS = 130;
const RIGHT_PADDING_BARS = 6;

export interface CompareSeries {
  readonly symbol: string;
  readonly color: string;
  readonly candles: readonly ChartCandle[];
}

export interface ChartPriceLine {
  readonly id: string;
  readonly price: number;
  readonly color: string;
  readonly title: string;
}

export interface DrawingStyle {
  readonly color: string;
  readonly width: number;
  readonly dash: "solid" | "dashed" | "dotted";
}

export interface TerminalChartHandle {
  screenshot(): HTMLCanvasElement | null;
  /** Show from this time to the newest bar; null shows everything. */
  showRange(startEpoch: number | null): void;
  /** Centre the chart on a time. */
  scrollToEpoch(epoch: number): void;
  resetView(): void;
  /** Re-enable auto-scaling on both price scales. */
  resetPriceScale(): void;
  zoom(direction: "in" | "out"): void;
  /** Shift the visible window left or right by a fraction of its span. */
  pan(direction: "left" | "right"): void;
  /** Jump to the newest bar, restoring the default right-edge offset. */
  scrollToLatest(): void;
  /** Epoch at the visible left edge, for the keep-left-edge preference. */
  getLeftEdgeEpoch(): number | null;
}

/** Right-click on the chart: pane (drawings, prices) or price scale. */
export interface ChartContextMenu {
  readonly x: number;
  readonly y: number;
  readonly area: "pane" | "scale";
  readonly time: number | null;
  readonly price: number | null;
  readonly drawingId: string | null;
}

export interface TerminalChartProps {
  readonly chartKey: string;
  readonly timeframe: ChartTimeframe;
  readonly candles: readonly ChartCandle[];
  readonly style: ChartStyle;
  readonly showVolume: boolean;
  readonly showGrid: boolean;
  readonly scaleMode: ScaleMode;
  readonly display: ChartDisplaySettings;
  /** Currency suffix for the price axis (e.g. "₹"), or null for none. */
  readonly currency: string | null;
  readonly magnet: "off" | "weak" | "strong";
  readonly instances: readonly IndicatorInstance[];
  readonly indicatorSeries: Readonly<Record<string, IndicatorSeriesMap>>;
  readonly compare: readonly CompareSeries[];
  readonly priceLines: readonly ChartPriceLine[];
  readonly drawings: readonly Drawing[];
  readonly selectedId: string | null;
  readonly hideDrawings: boolean;
  readonly lockDrawings: boolean;
  readonly tool: DrawingType | null;
  readonly drawingStyle: DrawingStyle;
  /** When set, a click picks a bar instead of placing a drawing (replay). */
  readonly pickBar: boolean;
  readonly cursor: CursorKind;
  readonly valuesTooltip: boolean;
  readonly hidePositions: boolean;
  /** Extra prices a magnet may snap to on a bar, e.g. indicator values. */
  readonly snapValues?: (index: number) => readonly number[];
  readonly onErase: (id: string) => void;
  readonly emoji: string;
  readonly onHover: (index: number | null) => void;
  /** Adds the drawing and returns the stored copy (with stacking order). */
  readonly onAddDrawing: (drawing: Drawing) => Drawing;
  readonly onUpdateDrawing: (drawing: Drawing, record: boolean) => void;
  readonly onBeginChange: () => void;
  readonly onSelect: (id: string | null) => void;
  readonly onRemoveSelected: () => void;
  readonly onToolDone: () => void;
  readonly onCancel: () => void;
  readonly onBarClick: (index: number) => void;
  readonly onContextMenu: (menu: ChartContextMenu) => void;
  /** Copy the selected drawing (⌘C); the owner keeps the clipboard. */
  readonly onCopyDrawing: (id: string) => void;
  /** Paste at the default offset (⌘V); the menu path passes coordinates. */
  readonly onPasteDrawing: () => void;
  /** Report the live price-per-bar so the ratio lock can show its value. */
  readonly onRatioCapture: (pricePerBar: number) => void;
}

const TIMEFRAME_UNIT: Readonly<Record<ChartTimeframe, VisibilityTimeframe>> = {
  "1": "minutes",
  "5": "minutes",
  "15": "minutes",
  "60": "hours",
  D: "days",
  W: "weeks",
  M: "months",
};

/** Numeric value behind each chart timeframe for visibility ranges. */
const TIMEFRAME_VALUE: Readonly<Record<ChartTimeframe, number | null>> = {
  "1": 1,
  "5": 5,
  "15": 15,
  "60": 1,
  D: 1,
  W: 1,
  M: 1,
};

/**
 * Whether the final loaded bar is still forming (same IST calendar day for
 * daily/intraday bars, same week for W, same month for M). Used by
 * "Wait for timeframe closes": a forming bar holds the previous value.
 */
function isLastCandleForming(
  candles: readonly { readonly time: string | number }[],
  timeframe: ChartTimeframe,
  nowMs = Date.now(),
): boolean {
  const last = candles[candles.length - 1];
  if (!last) return false;
  const dayKey = (epochMs: number): string =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(epochMs));
  const mondayOf = (day: string): string => {
    const date = new Date(`${day}T00:00:00Z`);
    const shift = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - shift);
    return date.toISOString().slice(0, 10);
  };
  // Intraday times are IST-shifted unix seconds, so their UTC calendar day
  // is the IST wall-clock day.
  const barDay =
    typeof last.time === "number"
      ? new Date(last.time * 1000).toISOString().slice(0, 10)
      : last.time;
  const today = dayKey(nowMs);
  if (timeframe === "W") return mondayOf(barDay) === mondayOf(today);
  if (timeframe === "M") return barDay.slice(0, 7) === today.slice(0, 7);
  return barDay === today;
}

const LINE_STYLE: Readonly<Record<PlotLineStyle, LineStyle>> = {
  solid: LineStyle.Solid,
  dotted: LineStyle.Dotted,
  dashed: LineStyle.Dashed,
};

const SESSION_PROFILE_IDS = new Set(["svp", "svphd"]);

/** The SVP primitive's look from the instance's inputs and Style tab. */
function sessionProfileStyle(
  instance: IndicatorInstance,
  dark: boolean,
): Partial<SessionProfileStyle> {
  const inputs = instance.inputs;
  const plotStyle = (id: string) => instance.plotStyles[id];
  const line = (id: string, fallback: string): ProfileLine => {
    const style = plotStyle(id);
    let color = style?.color ?? fallback;
    // The default near-black POC disappears on the dark canvas.
    if (dark && color.toLowerCase() === "#131722") color = "#d1d4dc";
    return {
      visible: style?.visible ?? false,
      color: toRgba(color, style?.opacity ?? 100),
      width: style?.lineWidth ?? 1,
      style: style?.lineStyle ?? "solid",
    };
  };
  const pair = (id: string, opacity: number) => {
    const style = plotStyle(id);
    const visible = style?.visible !== false;
    const alpha = style?.opacity ?? opacity;
    return {
      up: visible ? toRgba(style?.upColor ?? "#26c6da", Math.min(alpha, 99)) : "rgba(0,0,0,0)",
      down: visible ? toRgba(style?.downColor ?? "#ec407a", Math.min(alpha, 99)) : "rgba(0,0,0,0)",
    };
  };
  const inside = pair("valueArea", 80);
  const outside = pair("volume", 35);
  const fillStyle = instance.fillStyles["value"];
  const showValueArea =
    inputs["showValueArea"] !== false && fillStyle?.visible !== false;
  const mode = inputs["volumeMode"];
  const width = Number(inputs["widthPct"]);
  return {
    volumeMode: mode === "total" || mode === "delta" ? mode : "updown",
    placement: inputs["placement"] === "right" ? "right" : "left",
    widthPct: Number.isFinite(width) ? width : 40,
    showHistogram: inputs["showHistogram"] !== false,
    valueAreaFill: showValueArea
      ? toRgba(fillStyle?.color ?? "#26c6da", fillStyle?.opacity ?? 8)
      : null,
    insideUp: inside.up,
    insideDown: inside.down,
    outsideUp: outside.up,
    outsideDown: outside.down,
    poc: line("poc", "#ef5350"),
    vah: line("vah", "#2962ff"),
    val: line("val", "#2962ff"),
    extendPocRight: inputs["extendPocRight"] === true,
    showPrevious: inputs["showPrevious"] === true,
    showInitialBalance: inputs["showInitialBalance"] === true,
    showTable: inputs["showTable"] === true,
    dark,
  };
}

function toRgba(color: string, opacity: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match || opacity >= 100) return color;
  const value = parseInt(match[1]!, 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${Math.max(0, opacity) / 100})`;
}

function isOhlcStyle(style: ChartStyle): boolean {
  return (
    style === "candles" ||
    style === "hollow" ||
    style === "bars" ||
    style === "heikin"
  );
}

export const CROSSHAIR_LINE_STYLE: Readonly<Record<CrosshairDash, LineStyle>> =
  {
    solid: LineStyle.Solid,
    dashed: LineStyle.Dashed,
    dotted: LineStyle.Dotted,
  };

function createMainSeries(
  chart: IChartApi,
  style: ChartStyle,
  baseline: number,
  display: ChartDisplaySettings,
  currency: string | null,
): AnySeries {
  const palette = candlePalette(display);
  const priceFormat = mainPriceFormat(display, currency);
  const lastValueVisible =
    display.lastValue === "value-line" || display.lastValue === "value";
  const priceLineVisible =
    display.lastValue === "value-line" || display.lastValue === "line";
  const priceScaleId = display.scalePlacement === "left" ? "left" : "right";
  switch (style) {
    case "bars":
      return chart.addSeries(BarSeries, {
        upColor: palette.upColor,
        downColor: palette.downColor,
        thinBars: false,
        priceFormat,
        lastValueVisible,
        priceLineVisible,
        priceScaleId,
      }) as AnySeries;
    case "line":
      return chart.addSeries(LineSeries, {
        color: "#2962FF",
        lineWidth: 2,
        priceFormat,
        lastValueVisible,
        priceLineVisible,
        priceScaleId,
      }) as AnySeries;
    case "area":
      return chart.addSeries(AreaSeries, {
        lineColor: "#2962FF",
        topColor: "rgba(41,98,255,0.28)",
        bottomColor: "rgba(41,98,255,0.02)",
        lineWidth: 2,
        priceFormat,
        lastValueVisible,
        priceLineVisible,
        priceScaleId,
      }) as AnySeries;
    case "baseline":
      return chart.addSeries(BaselineSeries, {
        baseValue: { type: "price", price: baseline },
        topLineColor: UP,
        topFillColor1: "rgba(8,153,129,0.28)",
        topFillColor2: "rgba(8,153,129,0.04)",
        bottomLineColor: DOWN,
        bottomFillColor1: "rgba(242,54,69,0.04)",
        bottomFillColor2: "rgba(242,54,69,0.28)",
        lineWidth: 2,
        priceFormat,
        lastValueVisible,
        priceLineVisible,
        priceScaleId,
      }) as AnySeries;
    case "hollow":
      return chart.addSeries(CandlestickSeries, {
        upColor: "rgba(0,0,0,0)",
        downColor: palette.downColor,
        borderVisible: palette.borderVisible,
        borderUpColor: palette.borderUpColor,
        borderDownColor: palette.borderDownColor,
        wickVisible: palette.wickVisible,
        wickUpColor: palette.wickUpColor,
        wickDownColor: palette.wickDownColor,
        priceFormat,
        lastValueVisible,
        priceLineVisible,
        priceScaleId,
      }) as AnySeries;
    default:
      return chart.addSeries(CandlestickSeries, {
        upColor: palette.upColor,
        downColor: palette.downColor,
        borderVisible: palette.borderVisible,
        borderUpColor: palette.borderUpColor,
        borderDownColor: palette.borderDownColor,
        wickVisible: palette.wickVisible,
        wickUpColor: palette.wickUpColor,
        wickDownColor: palette.wickDownColor,
        priceFormat,
        lastValueVisible,
        priceLineVisible,
        priceScaleId,
      }) as AnySeries;
  }
}

function toSeriesPoint(style: ChartStyle, candle: ChartCandle) {
  const time = candle.time as Time;
  return isOhlcStyle(style)
    ? {
        time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }
    : { time, value: candle.close };
}

function toVolumePoint(candle: ChartCandle, display: ChartDisplaySettings) {
  return {
    time: candle.time as Time,
    value: candle.volume,
    color: volumeColor(candle.close >= candle.open, display),
  };
}

interface IndicatorEntry {
  readonly signature: string;
  readonly series: Map<string, AnySeries>;
  readonly fills: FillPrimitive[];
}

const TerminalChart = forwardRef<TerminalChartHandle, TerminalChartProps>(
  function TerminalChart(props, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const mainRef = useRef<AnySeries | null>(null);
    const volumeRef = useRef<ISeriesApi<"Histogram", Time> | null>(null);
    const primitiveRef = useRef(new DrawingsPrimitive());
    const barIndexRef = useRef(new BarIndex([]));
    const timeIndexRef = useRef(new Map<Time, number>());
    const renderedRef = useRef<{
      key: string;
      style: ChartStyle;
      length: number;
      first: Time | null;
    }>({ key: "", style: "candles", length: 0, first: null });
    const compareRef = useRef(new Map<string, AnySeries>());
    const indicatorRef = useRef(new Map<string, IndicatorEntry>());
    const profileRef = useRef(
      new Map<string, SessionVolumeProfilePrimitive>(),
    );
    const profileSeriesRef = useRef(new Map<string, AnySeries>());
    const priceLineRef = useRef<IPriceLine[]>([]);
    const propsRef = useRef(props);
    const draftRef = useRef<DrawingPoint[]>([]);
    const demoRef = useRef<HTMLDivElement>(null);
    const [textEditor, setTextEditor] = useState<{
      x: number;
      y: number;
      type: DrawingType;
      points: readonly DrawingPoint[];
      text: string;
      /** Set when editing an existing drawing instead of placing a new one. */
      editingId?: string;
    } | null>(null);
    const [valuesTip, setValuesTip] = useState<{
      x: number;
      y: number;
      index: number;
    } | null>(null);
    const [seriesVersion, setSeriesVersion] = useState(0);
    const isDark = useIsDark();

    useEffect(() => {
      propsRef.current = props;
    });

    useImperativeHandle(ref, () => ({
      screenshot: () => chartRef.current?.takeScreenshot(true, false) ?? null,
      showRange: (startEpoch) => {
        const chart = chartRef.current;
        const index = barIndexRef.current;
        if (!chart || index.length === 0) return;
        if (startEpoch === null) {
          chart.timeScale().setVisibleLogicalRange({
            from: -1,
            to: index.length - 1 + RIGHT_PADDING_BARS,
          });
          return;
        }
        const from = Math.min(
          index.firstIndexAtOrAfter(startEpoch),
          index.length - 1,
        );
        chart.timeScale().setVisibleLogicalRange({
          from: from - 1,
          to: index.length - 1 + RIGHT_PADDING_BARS,
        });
      },
      scrollToEpoch: (epoch) => {
        const chart = chartRef.current;
        const index = barIndexRef.current;
        if (!chart || index.length === 0) return;
        const centre = index.toLogical(epoch);
        chart.timeScale().setVisibleLogicalRange({
          from: centre - INITIAL_VISIBLE_BARS / 2,
          to: centre + INITIAL_VISIBLE_BARS / 2,
        });
      },
      zoom: (direction) => {
        const chart = chartRef.current;
        if (!chart) return;
        const range = chart.timeScale().getVisibleLogicalRange();
        if (!range) return;
        const span = range.to - range.from;
        const factor = direction === "in" ? 0.7 : 1.4;
        chart.timeScale().setVisibleLogicalRange({
          from: range.to - Math.max(8, span * factor),
          to: range.to,
        });
      },
      pan: (direction) => {
        const chart = chartRef.current;
        if (!chart) return;
        const range = chart.timeScale().getVisibleLogicalRange();
        if (!range) return;
        const span = range.to - range.from;
        const shift = Math.max(1, span * 0.25) * (direction === "left" ? -1 : 1);
        chart.timeScale().setVisibleLogicalRange({
          from: range.from + shift,
          to: range.to + shift,
        });
      },
      scrollToLatest: () => {
        const chart = chartRef.current;
        if (!chart) return;
        const length = barIndexRef.current.length;
        if (length === 0) return;
        const range = chart.timeScale().getVisibleLogicalRange();
        const span = range ? range.to - range.from : INITIAL_VISIBLE_BARS;
        chart.timeScale().setVisibleLogicalRange({
          from: length - 1 + RIGHT_PADDING_BARS - span,
          to: length - 1 + RIGHT_PADDING_BARS,
        });
      },
      resetView: () => {
        const chart = chartRef.current;
        if (!chart) return;
        chart.priceScale("right").applyOptions({ autoScale: true });
        chart.priceScale("left").applyOptions({ autoScale: true });
        const length = barIndexRef.current.length;
        chart.timeScale().setVisibleLogicalRange({
          from: Math.max(-1, length - INITIAL_VISIBLE_BARS),
          to: length - 1 + RIGHT_PADDING_BARS,
        });
      },
      resetPriceScale: () => {
        const chart = chartRef.current;
        if (!chart) return;
        chart.priceScale("right").applyOptions({ autoScale: true });
        chart.priceScale("left").applyOptions({ autoScale: true });
      },
      getLeftEdgeEpoch: () => {
        const chart = chartRef.current;
        const index = barIndexRef.current;
        if (!chart || index.length === 0) return null;
        const range = chart.timeScale().getVisibleLogicalRange();
        if (!range) return null;
        return Math.round(index.toEpoch(range.from));
      },
    }));

    // ── chart + interaction (once) ──────────────────────────────────────
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const initialTheme = resolveCanvasTheme(
        propsRef.current.display,
        isDarkDocument(),
      );
      const chart = createChart(container, {
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: initialTheme.background },
          textColor: initialTheme.text,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 12,
          panes: {
            separatorColor: initialTheme.separator,
            separatorHoverColor: initialTheme.separatorHover,
          },
        },
        grid: {
          vertLines: { color: initialTheme.grid },
          horzLines: { color: initialTheme.grid },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: {
          borderColor: initialTheme.axisLine,
          scaleMargins: { top: 0.08, bottom: 0.22 },
        },
        timeScale: {
          borderColor: initialTheme.axisLine,
          rightOffset: RIGHT_PADDING_BARS,
          timeVisible: false,
          secondsVisible: false,
        },
      });
      chartRef.current = chart;

      const volume = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      volume
        .priceScale()
        .applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volumeRef.current = volume;

      const primitive = primitiveRef.current;
      const compareSeries = compareRef.current;
      const indicatorEntries = indicatorRef.current;
      const pointer = (clientX: number, clientY: number) => {
        const rect = container.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
      };

      const MAGNET_RADIUS_PX = 14;

      const snap = (point: DrawingPoint): DrawingPoint => {
        const current = propsRef.current;
        if (current.magnet === "off") return point;
        const index = barIndexRef.current;
        const position = index.nearestIndex(index.toLogical(point.t));
        const candle = current.candles[position];
        if (!candle) return point;
        const candidates = [
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          ...(current.snapValues?.(position) ?? []),
        ];
        let best = candidates[0]!;
        for (const value of candidates) {
          if (Math.abs(value - point.p) < Math.abs(best - point.p))
            best = value;
        }
        if (current.magnet === "weak") {
          const series = mainRef.current;
          const near = series?.priceToCoordinate(best);
          const here = series?.priceToCoordinate(point.p);
          if (
            near == null ||
            here == null ||
            Math.abs(near - here) > MAGNET_RADIUS_PX
          ) {
            return point;
          }
        }
        return { t: index.epochs[position]!, p: best };
      };

      const buildDrawing = (
        type: DrawingType,
        points: readonly DrawingPoint[],
        text?: string,
      ): Drawing => {
        const style = propsRef.current.drawingStyle;
        const label =
          text ?? (type === "emoji" ? propsRef.current.emoji : undefined);
        return createDrawing(type, points, {
          color: style.color,
          width: style.width,
          dash: style.dash,
          ...(label !== undefined ? { text: label } : {}),
        });
      };

      const finishDrawing = (drawing: Drawing): void => {
        const current = propsRef.current;
        draftRef.current = [];
        primitive.setState({ preview: null });
        current.onAddDrawing(drawing);
        current.onSelect(drawing.id);
        current.onToolDone();
      };

      /** Reads a picked image, shrinks it, and returns a compact data URL. */
      const loadImage = (file: File): Promise<string | null> =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onerror = () => resolve(null);
          reader.onload = () => {
            const image = new Image();
            image.onerror = () => resolve(null);
            image.onload = () => {
              const scale = Math.min(
                1,
                480 / Math.max(image.width, image.height),
              );
              const canvas = document.createElement("canvas");
              canvas.width = Math.max(1, Math.round(image.width * scale));
              canvas.height = Math.max(1, Math.round(image.height * scale));
              canvas
                .getContext("2d")
                ?.drawImage(image, 0, 0, canvas.width, canvas.height);
              const url = canvas.toDataURL("image/jpeg", 0.82);
              resolve(url.length <= 400_000 ? url : null);
            };
            image.src = String(reader.result);
          };
          reader.readAsDataURL(file);
        });

      const complete = (
        type: DrawingType,
        points: readonly DrawingPoint[],
        x: number,
        y: number,
      ): void => {
        const definition = getToolDefinition(type);
        draftRef.current = [];
        primitive.setState({ preview: null });
        if (definition.text === "prompt") {
          setTextEditor({ x, y, type, points, text: "" });
          return;
        }
        if (definition.text === "image") {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            void loadImage(file).then((url) => {
              if (url) finishDrawing(buildDrawing(type, points, url));
            });
          };
          input.click();
          return;
        }
        finishDrawing(buildDrawing(type, points));
      };

      // Placement uses the DOM click and its own coordinates rather than the
      // chart's click event, which only carries a position once the crosshair
      // has caught up with the pointer; a quick move-and-click would lose it.
      let downAt: { x: number; y: number } | null = null;
      const onClick = (event: MouseEvent): void => {
        const start = downAt;
        downAt = null;
        const { x, y } = pointer(event.clientX, event.clientY);
        if (start && Math.hypot(start.x - x, start.y - y) > 4) return;
        if (x > chart.paneSize().width) return;

        const current = propsRef.current;
        if (current.pickBar) {
          const logical = chart.timeScale().coordinateToLogical(x);
          if (logical !== null) {
            const index = barIndexRef.current.nearestIndex(logical);
            if (index >= 0) current.onBarClick(index);
          }
          return;
        }
        const type = current.tool;
        if (!type) {
          if (
            current.cursor === "eraser" &&
            !current.hideDrawings &&
            !current.lockDrawings
          ) {
            const found = primitive.findDrawingAt(x, y);
            if (
              found &&
              !current.lockDrawings &&
              found.drawing.locked !== true
            ) {
              current.onErase(found.drawing.id);
            }
          }
          return;
        }
        const definition = getToolDefinition(type);
        if (definition.points === "drag") return;
        const raw = primitive.pointAt(x, y);
        if (!raw) return;
        const point = snap(raw);

        const draft = [...draftRef.current, point];
        if (definition.points === "multi") {
          draftRef.current = draft;
          primitive.setState({
            preview: buildDrawing(type, [...draft, point]),
          });
          return;
        }
        if (draft.length >= definition.points) {
          complete(type, draft, x, y);
        } else {
          draftRef.current = draft;
          primitive.setState({
            preview: buildDrawing(type, [...draft, point]),
          });
        }
      };
      container.addEventListener("click", onClick);

      const onDoubleClick = (event: MouseEvent): void => {
        const current = propsRef.current;
        const { x, y } = pointer(event.clientX, event.clientY);
        const type = current.tool;
        if (type) {
          const definition = getToolDefinition(type);
          if (definition.points === "multi") {
            event.preventDefault();
            // The second click of the double-click added a duplicate point.
            const draft = draftRef.current.slice(0, -1);
            if (draft.length >= (definition.minPoints ?? 2)) {
              finishDrawing(buildDrawing(type, draft));
            }
          }
          return;
        }
        if (current.hideDrawings || current.lockDrawings) return;
        const found = primitive.findDrawingAt(x, y);
        if (
          found &&
          found.drawing.locked !== true &&
          getToolDefinition(found.drawing.type).text === "prompt"
        ) {
          setTextEditor({
            x,
            y,
            type: found.drawing.type,
            points: found.drawing.points,
            text: found.drawing.text ?? "",
            editingId: found.drawing.id,
          });
        }
      };
      container.addEventListener("dblclick", onDoubleClick);

      const onMenu = (event: MouseEvent): void => {
        event.preventDefault();
        const current = propsRef.current;
        const { x, y } = pointer(event.clientX, event.clientY);
        if (x > chart.paneSize().width) {
          const raw = mainRef.current?.coordinateToPrice(y) ?? null;
          current.onContextMenu({
            x: event.clientX,
            y: event.clientY,
            area: "scale",
            time: null,
            price: typeof raw === "number" ? raw : null,
            drawingId: null,
          });
          return;
        }
        const found = current.hideDrawings
          ? null
          : primitive.findDrawingAt(x, y);
        if (found) current.onSelect(found.drawing.id);
        const point = primitive.pointAt(x, y);
        current.onContextMenu({
          x: event.clientX,
          y: event.clientY,
          area: "pane",
          time: point?.t ?? null,
          price: point?.p ?? null,
          drawingId: found?.drawing.id ?? null,
        });
      };
      container.addEventListener("contextmenu", onMenu);

      chart.subscribeCrosshairMove((param) => {
        const current = propsRef.current;
        const index = param.time
          ? timeIndexRef.current.get(param.time)
          : undefined;
        current.onHover(index ?? null);

        const type = current.tool;
        if (type && draftRef.current.length > 0 && param.point) {
          const raw = primitive.pointAt(param.point.x, param.point.y);
          if (raw) {
            primitive.setState({
              preview: buildDrawing(type, [...draftRef.current, snap(raw)]),
            });
          }
        }
      });

      // Dragging or selecting existing drawings, and the freehand brushes,
      // need to claim the mouse before the chart starts panning.
      let drag: {
        original: Drawing;
        mode: "handle" | "body";
        index: number;
        start: DrawingPoint;
        moved: boolean;
      } | null = null;
      let brush: { type: DrawingType; points: DrawingPoint[] } | null = null;
      let pressTimer: ReturnType<typeof setTimeout> | undefined;
      let pressAt: { x: number; y: number } | null = null;

      const endPress = (): void => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = undefined;
        pressAt = null;
        setValuesTip(null);
      };

      const onMove = (event: MouseEvent): void => {
        const { x, y } = pointer(event.clientX, event.clientY);
        const raw = primitive.pointAt(x, y);
        if (!raw) return;
        if (brush) {
          if (brush.points.length < 600) brush.points.push(raw);
          primitive.setState({
            preview: buildDrawing(brush.type, brush.points),
          });
          return;
        }
        if (!drag) return;
        const current = propsRef.current;
        if (!drag.moved) {
          drag.moved = true;
          current.onBeginChange();
        }
        const updated =
          drag.mode === "handle"
            ? movePoint(drag.original, drag.index, snap(raw))
            : moveDrawing(
                drag.original,
                raw.t - drag.start.t,
                raw.p - drag.start.p,
              );
        current.onUpdateDrawing(updated, false);
      };

      const onUp = (): void => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (brush) {
          const finished = brush;
          brush = null;
          primitive.setState({ preview: null });
          if (finished.points.length >= 2) {
            const current = propsRef.current;
            const drawing = buildDrawing(finished.type, finished.points);
            current.onAddDrawing(drawing);
            current.onSelect(drawing.id);
            current.onToolDone();
          }
        }
        drag = null;
      };

      const onDown = (event: MouseEvent): void => {
        if (event.button !== 0) return;
        downAt = pointer(event.clientX, event.clientY);
        const current = propsRef.current;
        if (current.pickBar) return;
        const { x, y } = downAt;
        const size = chart.paneSize();
        if (x > size.width) return;

        if (current.tool === "brush" || current.tool === "highlighter") {
          const start = primitive.pointAt(x, y);
          if (!start) return;
          brush = { type: current.tool, points: [start] };
          event.stopPropagation();
          event.preventDefault();
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
          return;
        }
        if (current.tool || current.hideDrawings) return;

        const found = primitive.findDrawingAt(x, y);
        if (!found) {
          if (current.selectedId) current.onSelect(null);
          if (current.valuesTooltip && current.cursor !== "eraser") {
            pressAt = { x, y };
            pressTimer = setTimeout(() => {
              if (!pressAt) return;
              const logical = chart.timeScale().coordinateToLogical(pressAt.x);
              if (logical === null) return;
              const position = barIndexRef.current.nearestIndex(logical);
              if (position >= 0)
                setValuesTip({ x: pressAt.x, y: pressAt.y, index: position });
            }, 450);
          }
          return;
        }
        if (current.cursor === "eraser") return;
        const locked = current.lockDrawings || found.drawing.locked === true;
        // ⌘/Ctrl-drag clones the drawing instead of moving it.
        let target = found;
        if ((event.metaKey || event.ctrlKey) && !locked) {
          const clone = cloneDrawing(found.drawing);
          const added = current.onAddDrawing(clone);
          target = { drawing: added, hit: { kind: "body" } };
        }
        current.onSelect(target.drawing.id);
        event.stopPropagation();
        event.preventDefault();
        if (locked && target.drawing.id === found.drawing.id) return;
        const start = primitive.pointAt(x, y);
        if (!start) return;
        drag = {
          original: target.drawing,
          mode: target.hit.kind === "handle" ? "handle" : "body",
          index: target.hit.kind === "handle" ? target.hit.index : 0,
          start,
          moved: false,
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      };
      container.addEventListener("mousedown", onDown, true);

      const onPressMove = (event: MouseEvent): void => {
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const demo = demoRef.current;
        if (demo) {
          demo.style.transform = `translate(${x - 17}px, ${y - 17}px)`;
        }
        if (pressAt && Math.hypot(pressAt.x - x, pressAt.y - y) > 6) endPress();
      };
      window.addEventListener("mousemove", onPressMove);
      window.addEventListener("mouseup", endPress);

      const onKey = (event: KeyboardEvent): void => {
        const target = event.target as HTMLElement | null;
        if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
        const current = propsRef.current;
        if (event.key === "Escape") {
          draftRef.current = [];
          primitive.setState({ preview: null });
          setTextEditor(null);
          current.onCancel();
        } else if (event.key === "Enter" && current.tool) {
          const definition = getToolDefinition(current.tool);
          if (
            definition.points === "multi" &&
            draftRef.current.length >= (definition.minPoints ?? 2)
          ) {
            event.preventDefault();
            finishDrawing(buildDrawing(current.tool, draftRef.current));
          }
        } else if (
          (event.key === "Delete" || event.key === "Backspace") &&
          current.selectedId &&
          !current.lockDrawings &&
          current.drawings.every(
            (entry) => entry.id !== current.selectedId || !entry.locked,
          )
        ) {
          event.preventDefault();
          current.onRemoveSelected();
        } else if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "c" &&
          current.selectedId
        ) {
          event.preventDefault();
          current.onCopyDrawing(current.selectedId);
        } else if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "v"
        ) {
          event.preventDefault();
          current.onPasteDrawing();
        }
      };
      window.addEventListener("keydown", onKey);

      return () => {
        endPress();
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("mousemove", onPressMove);
        window.removeEventListener("mouseup", endPress);
        container.removeEventListener("mousedown", onDown, true);
        container.removeEventListener("click", onClick);
        container.removeEventListener("dblclick", onDoubleClick);
        container.removeEventListener("contextmenu", onMenu);
        compareSeries.clear();
        indicatorEntries.clear();
        priceLineRef.current = [];
        mainRef.current = null;
        volumeRef.current = null;
        chart.remove();
        chartRef.current = null;
      };
    }, []);

    // A tool change abandons any half-placed drawing.
    useEffect(() => {
      draftRef.current = [];
      primitiveRef.current.setState({ preview: null });
      setTextEditor(null);
    }, [props.tool]);

    // ── main series (recreated when the chart style changes) ────────────
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      const primitive = primitiveRef.current;
      const first = props.candles[0];
      const baseline = first?.close ?? 0;
      const series = createMainSeries(
        chart,
        props.style,
        baseline,
        props.display,
        props.currency,
      );
      series.attachPrimitive(primitive);
      mainRef.current = series;
      renderedRef.current = {
        key: "",
        style: props.style,
        length: 0,
        first: null,
      };
      setSeriesVersion((version) => version + 1);
      return () => {
        if (mainRef.current === series) {
          series.detachPrimitive(primitive);
          chart.removeSeries(series);
          mainRef.current = null;
          priceLineRef.current = [];
        }
      };
      // The baseline only matters at creation; data effects keep it current.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.style]);

    // ── data ─────────────────────────────────────────────────────────────
    const { candles, chartKey, style, timeframe, display: appearance } = props;
    useEffect(() => {
      const chart = chartRef.current;
      const series = mainRef.current;
      const volume = volumeRef.current;
      if (!chart || !series || !volume) return;

      const rendered = renderedRef.current;
      const sameSeries = rendered.key === chartKey && rendered.style === style;
      const display = style === "heikin" ? toHeikinAshi(candles) : candles;
      const firstTime = (candles[0]?.time ?? null) as Time | null;
      const canUpdate =
        sameSeries &&
        style !== "heikin" &&
        rendered.length > 0 &&
        candles.length >= rendered.length &&
        rendered.first === firstTime;

      // Previous-close coloring only applies to plain candles and bars;
      // hollow candles keep their hollow rendering.
      const tinted =
        appearance.colorByPrevClose &&
        (style === "candles" || style === "bars");
      const tints = tinted
        ? prevCloseTints(
            display.map((candle) => candle.close),
            appearance,
          )
        : null;
      const withTint = (
        point: Record<string, unknown>,
        index: number,
      ): Record<string, unknown> => {
        const tint = tints?.[index];
        if (!tint) return point;
        return style === "bars"
          ? { ...point, color: tint.color }
          : {
              ...point,
              color: tint.color,
              borderColor: tint.borderColor,
              wickColor: tint.wickColor,
            };
      };

      if (canUpdate) {
        for (
          let index = rendered.length - 1;
          index < candles.length;
          index += 1
        ) {
          const candle = candles[index]!;
          (series as ISeriesApi<"Candlestick", Time>).update(
            withTint(
              toSeriesPoint(style, candle) as Record<string, unknown>,
              index,
            ) as never,
          );
          volume.update(toVolumePoint(candle, appearance));
        }
      } else {
        (series as ISeriesApi<"Candlestick", Time>).setData(
          display.map((candle, index) =>
            withTint(
              toSeriesPoint(style, candle) as Record<string, unknown>,
              index,
            ),
          ) as never,
        );
        volume.setData(
          candles.map((candle) => toVolumePoint(candle, appearance)),
        );
        if (!sameSeries && candles.length > 0) {
          chart.timeScale().setVisibleLogicalRange({
            from: Math.max(-1, candles.length - INITIAL_VISIBLE_BARS),
            to: candles.length - 1 + RIGHT_PADDING_BARS,
          });
        }
      }

      renderedRef.current = {
        key: chartKey,
        style,
        length: candles.length,
        first: firstTime,
      };
      barIndexRef.current = new BarIndex(candles);
      timeIndexRef.current = new Map(
        candles.map((candle, index) => [candle.time as Time, index]),
      );
      primitiveRef.current.setState({
        barIndex: barIndexRef.current,
        data: {
          epochs: barIndexRef.current.epochs,
          opens: candles.map((candle) => candle.open),
          highs: candles.map((candle) => candle.high),
          lows: candles.map((candle) => candle.low),
          closes: candles.map((candle) => candle.close),
          volumes: candles.map((candle) => candle.volume),
        },
      });
      chart.timeScale().applyOptions({
        timeVisible: isIntraday(timeframe),
      });
    }, [candles, chartKey, style, timeframe, seriesVersion, appearance]);

    // ── options ──────────────────────────────────────────────────────────
    const {
      showGrid,
      showVolume,
      scaleMode,
      compare,
      display: appearanceOptions,
      currency: axisCurrency,
    } = props;
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      const display = appearanceOptions;
      const canvas = resolveCanvasTheme(display, isDark);
      const gridColor = canvas.grid;
      const transparent = "rgba(0,0,0,0)";
      chart.applyOptions({
        layout: {
          background: {
            type: ColorType.Solid,
            color: canvas.background,
          },
          textColor: canvas.text,
          fontSize: display.axisFontSize,
          panes: {
            separatorColor: canvas.separator,
            separatorHoverColor: canvas.separatorHover,
          },
        },
        grid: {
          vertLines: {
            visible: showGrid && display.showVertGrid,
            color: showGrid && display.showVertGrid ? gridColor : transparent,
          },
          horzLines: {
            visible: showGrid && display.showHorzGrid,
            color: showGrid && display.showHorzGrid ? gridColor : transparent,
          },
        },
        crosshair: {
          vertLine: {
            color: display.crosshairColor,
            style: CROSSHAIR_LINE_STYLE[display.crosshairStyle],
          },
          horzLine: {
            color: display.crosshairColor,
            style: CROSSHAIR_LINE_STYLE[display.crosshairStyle],
          },
        },
        timeScale: {
          tickMarkFormatter: (
            time: Time,
            _type: TickMarkType,
            _locale: string,
          ) => formatTick(time, display, timeframe),
        },
        handleScale: {
          axisPressedMouseMove: {
            time: !display.scalePriceOnly,
            price: true,
          },
        },
      });
      chart.timeScale().applyOptions({
        borderColor: canvas.axisLine,
        rightOffset: display.marginRightBars,
      });
      volumeRef.current?.applyOptions({ visible: showVolume });
      const mode =
        compare.length > 0 || display.priceScaleMode === "percent"
          ? PriceScaleMode.Percentage
          : display.priceScaleMode === "indexed"
            ? PriceScaleMode.IndexedTo100
            : display.priceScaleMode === "log" || scaleMode === "log"
              ? PriceScaleMode.Logarithmic
              : scaleMode === "percent"
                ? PriceScaleMode.Percentage
                : PriceScaleMode.Normal;
      const left = display.scalePlacement === "left";
      chart.priceScale("left").applyOptions({
        visible: left,
        autoScale: display.priceAutoScale,
        invertScale: display.invertScale,
        borderColor: canvas.axisLine,
      });
      chart.priceScale("right").applyOptions({
        visible: !left,
        mode,
        autoScale: display.priceAutoScale,
        invertScale: display.invertScale,
        borderColor: canvas.axisLine,
        scaleMargins: {
          top: display.marginTop / 100,
          bottom: showVolume ? display.marginBottom / 100 : 0.08,
        },
      });
      const main = mainRef.current;
      if (main) {
        const palette = candlePalette(display);
        const priceFormat = mainPriceFormat(display, axisCurrency);
        const lastValueVisible =
          display.lastValue === "value-line" || display.lastValue === "value";
        const priceLineVisible =
          display.lastValue === "value-line" || display.lastValue === "line";
        const priceScaleId = left ? "left" : "right";
        const base = {
          priceFormat,
          lastValueVisible,
          priceLineVisible,
          priceScaleId,
        };
        if (style === "hollow") {
          main.applyOptions({
            ...base,
            upColor: "rgba(0,0,0,0)",
            downColor: palette.downColor,
            borderVisible: palette.borderVisible,
            borderUpColor: palette.borderUpColor,
            borderDownColor: palette.borderDownColor,
            wickVisible: palette.wickVisible,
            wickUpColor: palette.wickUpColor,
            wickDownColor: palette.wickDownColor,
          });
        } else if (
          style === "candles" ||
          style === "bars" ||
          style === "heikin"
        ) {
          main.applyOptions({
            ...base,
            upColor: palette.upColor,
            downColor: palette.downColor,
            borderVisible: palette.borderVisible,
            borderUpColor: palette.borderUpColor,
            borderDownColor: palette.borderDownColor,
            wickVisible: palette.wickVisible,
            wickUpColor: palette.wickUpColor,
            wickDownColor: palette.wickDownColor,
          });
        } else {
          main.applyOptions(base);
        }
      }
    }, [
      showGrid,
      showVolume,
      scaleMode,
      compare.length,
      appearanceOptions,
      axisCurrency,
      style,
      timeframe,
      isDark,
    ]);

    // ── cursor type ──────────────────────────────────────────────────────
    const { cursor } = props;
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      const lines = cursor === "cross" || cursor === "eraser";
      chart.applyOptions({
        crosshair: {
          mode:
            cursor === "arrow" || cursor === "demo"
              ? CrosshairMode.Hidden
              : CrosshairMode.Normal,
          vertLine: { visible: lines },
          horzLine: { visible: lines },
        },
      });
    }, [cursor]);

    // ── comparison symbols ───────────────────────────────────────────────
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      const wanted = new Set(compare.map((entry) => entry.symbol));
      for (const [symbol, series] of compareRef.current) {
        if (!wanted.has(symbol)) {
          chart.removeSeries(series);
          compareRef.current.delete(symbol);
        }
      }
      for (const entry of compare) {
        let series = compareRef.current.get(entry.symbol);
        if (!series) {
          series = chart.addSeries(LineSeries, {
            color: entry.color,
            lineWidth: 2,
            priceLineVisible: false,
            title: entry.symbol,
          }) as AnySeries;
          compareRef.current.set(entry.symbol, series);
        }
        (series as ISeriesApi<"Line", Time>).setData(
          entry.candles.map((candle) => ({
            time: candle.time as Time,
            value: candle.close,
          })),
        );
      }
    }, [compare, seriesVersion]);

    // ── price lines: alerts ──────────────────────────────────────────────
    const { priceLines } = props;
    useEffect(() => {
      const series = mainRef.current;
      if (!series) return;
      for (const line of priceLineRef.current) series.removePriceLine(line);
      priceLineRef.current = priceLines.map((line) =>
        series.createPriceLine({
          price: line.price,
          color: line.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: line.title,
        }),
      );
    }, [priceLines, seriesVersion]);

    // ── indicators ───────────────────────────────────────────────────────
    const { instances, indicatorSeries } = props;
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      const unit = TIMEFRAME_UNIT[timeframe];
      const entries = indicatorRef.current;

      const wanted = new Map<string, IndicatorInstance>();
      for (const instance of instances) {
        if (
          !instance.hidden &&
          isVisibleOn(instance.visibility, unit, TIMEFRAME_VALUE[timeframe])
        ) {
          wanted.set(instance.instanceId, instance);
        }
      }
      const holdFormingBar = isLastCandleForming(candles, timeframe);

      for (const [id, entry] of entries) {
        const instance = wanted.get(id);
        const signature = instance ? JSON.stringify(instance) : "";
        if (!instance || entry.signature !== signature) {
          for (const series of entry.series.values())
            chart.removeSeries(series);
          entries.delete(id);
        }
      }

      for (const [id, instance] of wanted) {
        const definition = getIndicatorDefinition(instance.definitionId);
        if (!definition) continue;
        let entry = entries.get(id);
        if (!entry) {
          const created = new Map<string, AnySeries>();
          const effectivePane = instance.paneOverride ?? definition.pane;
          let paneIndex =
            effectivePane === "price" ? 0 : chart.panes().length;
          // The session volume profile draws its histogram and levels on
          // its own canvas primitive (below); its plots only carry colours.
          const drawnByProfile = SESSION_PROFILE_IDS.has(instance.definitionId);
          for (const plot of definition.plots) {
            const style = instance.plotStyles[plot.id];
            if (!style?.visible || drawnByProfile) continue;
            const color = toRgba(style.color, style.opacity);
            const base = {
              priceLineVisible: false,
              lastValueVisible:
                effectivePane === "separate" && instance.labelsOnScale,
              crosshairMarkerVisible: false,
              priceScaleId:
                effectivePane === "price"
                  ? (instance.scaleSide ?? "right")
                  : undefined,
            };
            let series: AnySeries;
            if (plot.kind === "histogram" || plot.kind === "columns") {
              series = chart.addSeries(
                HistogramSeries,
                { ...base, color },
                paneIndex,
              ) as AnySeries;
            } else if (plot.kind === "area") {
              series = chart.addSeries(
                AreaSeries,
                {
                  ...base,
                  lineColor: color,
                  topColor: toRgba(style.color, Math.min(style.opacity, 30)),
                  bottomColor: toRgba(style.color, 2),
                  lineWidth: style.lineWidth as 1 | 2 | 3 | 4,
                },
                paneIndex,
              ) as AnySeries;
            } else {
              series = chart.addSeries(
                LineSeries,
                {
                  ...base,
                  color,
                  lineWidth: style.lineWidth as 1 | 2 | 3 | 4,
                  lineStyle: LINE_STYLE[style.lineStyle],
                },
                paneIndex,
              ) as AnySeries;
            }
            paneIndex = series.getPane().paneIndex();
            created.set(plot.id, series);
          }

          const anchor = created.values().next().value as AnySeries | undefined;
          if (anchor) {
            for (const level of definition.levels) {
              const levelStyle = instance.levelStyles[level.id];
              if (!levelStyle?.visible) continue;
              anchor.createPriceLine({
                price: instance.levelValues[level.id] ?? level.defaultValue,
                color: levelStyle.color,
                lineWidth: levelStyle.lineWidth as 1 | 2 | 3 | 4,
                lineStyle: LINE_STYLE[levelStyle.lineStyle],
                axisLabelVisible: false,
                title: "",
              });
            }
          }
          // One fill primitive per band, in definition order, so updates can
          // pair primitives with bands by index.
          const fillPrimitives: FillPrimitive[] = [];
          const anchorSeries = created.values().next()
            .value as AnySeries | undefined;
          if (anchorSeries) {
            for (let fillIndex = 0; fillIndex < definition.fills.length; fillIndex += 1) {
              const primitive = new FillPrimitive();
              primitive.setBands([]);
              anchorSeries.attachPrimitive(primitive);
              fillPrimitives.push(primitive);
            }
          }
          entry = {
            signature: JSON.stringify(instance),
            series: created,
            fills: fillPrimitives,
          };
          entries.set(id, entry);
        }

        const values = indicatorSeries[id];
        if (!values) continue;
        // Refresh band fills (plot↔plot and plot↔level regions).
        if (entry.fills.length > 0) {
          const times = candles.map((candle) => candle.time as Time);
          definition.fills.forEach((fill, fillIndex) => {
            const primitive = entry.fills[fillIndex];
            if (!primitive) return;
            const style = instance.fillStyles[fill.id] ?? fill.defaultStyle;
            if (style.visible === false) {
              primitive.setBands([]);
              return;
            }
            const edge = (
              anchor: IndicatorFill["from"],
            ): ReadonlyArray<number | null> | null => {
              if (anchor.kind === "plot") {
                const plotValues = values[anchor.id];
                return Array.isArray(plotValues) ? plotValues : null;
              }
              const level = definition.levels.find(
                (levelEntry) => levelEntry.id === anchor.id,
              );
              const constant =
                instance.levelValues[anchor.id] ?? level?.defaultValue;
              if (typeof constant !== "number") return null;
              return times.map(() => constant);
            };
            const top = edge(fill.from);
            const bottom = edge(fill.to);
            if (!top || !bottom) {
              primitive.setBands([]);
              return;
            }
            primitive.setBands([
              { top, bottom, times, color: toRgba(style.color, style.opacity) },
            ]);
          });
        }
        for (const plot of definition.plots) {
          const series = entry.series.get(plot.id);
          const plotValues = values[plot.id];
          if (!series || !plotValues) continue;
          const style = instance.plotStyles[plot.id]!;
          const holdLast =
            instance.waitForClose &&
            holdFormingBar &&
            candles.length > 1;
          const data = candles.map((candle, index) => {
            if (holdLast && index === candles.length - 1) {
              return { time: candle.time as Time };
            }
            const value = plotValues[index];
            if (value === null || value === undefined) {
              return { time: candle.time as Time };
            }
            const point: { time: Time; value: number; color?: string } = {
              time: candle.time as Time,
              value,
            };
            if (plot.colorMode === "direction") {
              point.color = toRgba(
                candle.close >= candle.open ? style.upColor : style.downColor,
                style.opacity,
              );
            } else if (plot.colorMode === "sign") {
              point.color = toRgba(
                value >= 0 ? style.upColor : style.downColor,
                style.opacity,
              );
            }
            return point;
          });
          (series as ISeriesApi<"Line", Time>).setData(data as never);
        }
      }

      // ── session volume profile histograms ──────────────────────────
      // TradingView draws one horizontal volume-at-price histogram per
      // session behind the candles. Lightweight-charts has no horizontal
      // series type, so each SVP instance gets a canvas primitive on the
      // main price series; POC/VAH/VAL stay as line plots above.
      const mainSeries = mainRef.current;
      if (mainSeries) {
        const wantedProfiles = new Map<string, IndicatorInstance>();
        for (const [id, instance] of wanted) {
          if (
            instance.definitionId === "svp" ||
            instance.definitionId === "svphd"
          ) {
            wantedProfiles.set(id, instance);
          }
        }
        for (const [id, primitive] of profileRef.current) {
          if (!wantedProfiles.has(id)) {
            const attached = profileSeriesRef.current.get(id) ?? mainSeries;
            try {
              attached.detachPrimitive(primitive);
            } catch {
              // Already detached with a removed series.
            }
            profileRef.current.delete(id);
            profileSeriesRef.current.delete(id);
          }
        }
        if (wantedProfiles.size > 0 && candles.length > 0) {
          const profileCandles = candles.map((candle) => ({
            timestamp:
              (chartTimeToEpoch(candle.time) - 19_800) * 1_000,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          }));
          for (const [id, instance] of wantedProfiles) {
            const inputs = instance.inputs;
            const rows = normalizeProfileRows(
              inputs["rows"],
              instance.definitionId === "svphd" ? 100 : 24,
            );
            const valueAreaPct = normalizeValueAreaPct(inputs["valueAreaPct"], 70);
            const timeZone =
              typeof inputs["timeZone"] === "string" &&
              (inputs["timeZone"] as string).length > 0
                ? (inputs["timeZone"] as string)
                : "Asia/Kolkata";
            const ibMinutes =
              typeof inputs["ibMinutes"] === "number" ? (inputs["ibMinutes"] as number) : 60;
            const computed = computeSessionProfiles(profileCandles, {
              rows,
              valueAreaPct,
              timeZone,
              initialBalanceMinutes: ibMinutes,
            });
            const drawSessions: ProfileDrawSession[] = [];
            for (const profile of computed) {
              if (
                profile.poc === null ||
                profile.vah === null ||
                profile.val === null
              ) {
                continue;
              }
              const start = candles[profile.startIndex];
              const end = candles[profile.endIndex];
              if (!start || !end) continue;
              drawSessions.push({
                startTime: start.time as Time,
                endTime: end.time as Time,
                poc: profile.poc,
                vah: profile.vah,
                val: profile.val,
                high: profile.high,
                low: profile.low,
                ibHigh: profile.ibHigh,
                ibLow: profile.ibLow,
                maxRowVolume: profile.maxRowVolume,
                maxRowDelta: profile.maxRowDelta,
                buckets: profile.buckets,
              });
            }
            let primitive = profileRef.current.get(id);
            if (!primitive) {
              primitive = new SessionVolumeProfilePrimitive();
              profileRef.current.set(id, primitive);
              mainSeries.attachPrimitive(primitive);
              profileSeriesRef.current.set(id, mainSeries);
            } else if (profileSeriesRef.current.get(id) !== mainSeries) {
              // The main series is recreated on style changes; move the
              // existing primitive to the new series so it survives the swap.
              const previous = profileSeriesRef.current.get(id);
              if (previous) {
                try {
                  previous.detachPrimitive(primitive);
                } catch {
                  // Already detached with a removed series.
                }
              }
              mainSeries.attachPrimitive(primitive);
              profileSeriesRef.current.set(id, mainSeries);
            }
            primitive.setSessions(
              drawSessions,
              sessionProfileStyle(instance, isDark),
              candles[candles.length - 1]?.close ?? null,
            );
          }
        }
      }

      const panes = chart.panes();
      panes.forEach((pane, index) =>
        pane.setStretchFactor(index === 0 ? 3 : 1),
      );
    }, [instances, indicatorSeries, candles, timeframe, seriesVersion, isDark]);

    // ── drawings ─────────────────────────────────────────────────────────
    const { drawings, selectedId, hideDrawings, hidePositions } = props;
    useEffect(() => {
      primitiveRef.current.setState({
        drawings: hideDrawings
          ? []
          : sortByVisualOrder(
              drawings.filter((drawing) =>
                isDrawingVisibleOn(drawing, props.timeframe),
              ),
            ),
        selectedId,
        hidden: hideDrawings,
        hidePositions,
      });
    }, [
      drawings,
      selectedId,
      hideDrawings,
      hidePositions,
      props.timeframe,
      seriesVersion,
    ]);

    // ── lock price to bar ratio ──────────────────────────────────────
    // While locked, every time-zoom keeps the captured price-per-bar by
    // resizing the price range around its middle.
    useEffect(() => {
      const chart = chartRef.current;
      const lockOn = props.display.lockPriceBarRatio;
      const capturedPerBar = props.display.pricePerBar;
      const scale = props.display.scalePlacement === "left" ? "left" : "right";
      if (!chart || !lockOn) return;
      const capture = (): number | null => {
        const logical = chart.timeScale().getVisibleLogicalRange();
        const visible = chart.priceScale(scale).getVisibleRange();
        if (!logical || !visible) return null;
        const bars = logical.to - logical.from;
        if (!(bars > 0)) return null;
        return (visible.to - visible.from) / bars;
      };
      if (!(capturedPerBar > 0)) {
        const now = capture();
        if (now !== null) propsRef.current.onRatioCapture(now);
      }
      const onRange = (): void => {
        const current = propsRef.current;
        const perBar = current.display.lockPriceBarRatio
          ? current.display.pricePerBar
          : 0;
        if (!(perBar > 0)) return;
        const logical = chart.timeScale().getVisibleLogicalRange();
        const visible = chart.priceScale(scale).getVisibleRange();
        if (!logical || !visible) return;
        const bars = logical.to - logical.from;
        if (!(bars > 0)) return;
        const mid = (visible.from + visible.to) / 2;
        const half = (perBar * bars) / 2;
        chart.priceScale(scale).applyOptions({ autoScale: false });
        chart
          .priceScale(scale)
          .setVisibleRange({ from: mid - half, to: mid + half });
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
      return () => {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      };
    }, [
      props.display.lockPriceBarRatio,
      props.display.pricePerBar,
      props.display.scalePlacement,
    ]);

    const OPTIONAL_TEXT = new Set<DrawingType>(["pin", "flag"]);

    const commitText = (text: string): void => {
      const editor = textEditor;
      setTextEditor(null);
      if (!editor) return;
      const value = text.trim();
      const current = propsRef.current;
      if (editor.editingId) {
        const existing = current.drawings.find(
          (entry) => entry.id === editor.editingId,
        );
        if (existing && value && value !== existing.text) {
          current.onUpdateDrawing({ ...existing, text: value }, true);
        }
        return;
      }
      if (!value && !OPTIONAL_TEXT.has(editor.type)) return;
      const drawing = createDrawing(editor.type, editor.points, {
        color: current.drawingStyle.color,
        width: current.drawingStyle.width,
        dash: current.drawingStyle.dash,
        ...(value ? { text: value } : {}),
      });
      current.onAddDrawing(drawing);
      current.onSelect(drawing.id);
      current.onToolDone();
    };

    const tipCandle = valuesTip ? props.candles[valuesTip.index] : undefined;
    const tipPrevious = valuesTip
      ? props.candles[valuesTip.index - 1]
      : undefined;
    const tipChange =
      tipCandle && tipPrevious && tipPrevious.close > 0
        ? ((tipCandle.close - tipPrevious.close) / tipPrevious.close) * 100
        : null;

    return (
      <div className="relative h-full w-full">
        <div
          ref={containerRef}
          className={`absolute inset-0 ${
            props.tool
              ? "cursor-crosshair"
              : props.cursor === "eraser"
                ? "cursor-pointer"
                : props.cursor === "demo"
                  ? "cursor-none"
                  : ""
          }`}
        />
        {props.cursor === "demo" && (
          <div
            ref={demoRef}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-20 h-[34px] w-[34px] rounded-full border-2 border-error bg-error/25 shadow-[0_0_0_6px_rgba(242,54,69,0.12)]"
          />
        )}
        {tipCandle && valuesTip && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-30 rounded-lg bg-foreground/95 px-3 py-2 font-mono text-[11.5px] leading-5 text-primary-foreground shadow-xl"
            style={{
              left: Math.min(valuesTip.x + 14, 99999),
              top: Math.max(8, valuesTip.y - 96),
            }}
          >
            <div className="mb-0.5 font-sans text-[11px] font-semibold text-muted-foreground/70">
              {typeof tipCandle.time === "string"
                ? tipCandle.time
                : new Date(tipCandle.time * 1000)
                    .toISOString()
                    .replace("T", " ")
                    .slice(0, 16)}
            </div>
            <div>O {tipCandle.open.toFixed(2)}</div>
            <div>H {tipCandle.high.toFixed(2)}</div>
            <div>L {tipCandle.low.toFixed(2)}</div>
            <div>C {tipCandle.close.toFixed(2)}</div>
            {tipChange !== null && (
              <div
                className={tipChange >= 0 ? "text-success" : "text-error"}
              >
                {tipChange >= 0 ? "+" : ""}
                {tipChange.toFixed(2)}%
              </div>
            )}
            {tipCandle.volume > 0 && (
              <div>Vol {tipCandle.volume.toLocaleString("en-IN")}</div>
            )}
          </div>
        )}
        {textEditor && (
          <textarea
            autoFocus
            rows={3}
            maxLength={600}
            defaultValue={textEditor.text}
            placeholder={
              textEditor.type === "table"
                ? "Rows on separate lines, columns split by |"
                : "Type your text. Enter to save, Shift+Enter for a new line"
            }
            className="absolute z-30 w-64 resize-none rounded-md border border-primary bg-card px-2 py-1.5 text-xs text-foreground shadow-lg outline-none"
            style={{ left: textEditor.x, top: Math.max(0, textEditor.y - 70) }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                commitText(event.currentTarget.value);
              }
              if (event.key === "Escape") setTextEditor(null);
            }}
            onBlur={(event) => commitText(event.currentTarget.value)}
          />
        )}
      </div>
    );
  },
);

export default TerminalChart;

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import { StockActionsMenu } from "@/components/common";
import IndicatorLegend from "@/components/chart/IndicatorLegend";
import IndicatorPicker from "@/components/chart/IndicatorPicker";
import IndicatorSettingsDialog from "@/components/chart/IndicatorSettingsDialog";
import { useChartIndicators } from "@/components/chart/useChartIndicators";
import { chartTimeToEpoch } from "@/lib/chart/bar-index";
import {
  CHART_ALERTS_EVENT,
  CHART_INDICATORS_EVENT,
  type ChartPanelDetail,
} from "@/lib/chart/chart-events";
import {
  RANGE_TIMEFRAME,
  rangeStartEpoch,
  type RangeId,
} from "@/lib/chart/analytics";
import {
  cloneDrawing,
  createDrawingId,
  FIB_LEVELS,
  getToolDefinition,
  reorderDrawing,
  toolForShortcut,
  type DashStyle,
  type Drawing,
  type DrawingType,
  type DrawingVisibilityScope,
  type VisualOrderDirection,
} from "@/lib/chart/drawings";
import { getIndicatorDefinition } from "@/lib/technical/indicator-catalog";
import {
  normalizeIndicatorInstance,
  toInstanceSnapshot,
  withPaneOverride,
  withScaleSide,
  withVisibility,
  type IndicatorInstanceSnapshot,
} from "@/lib/technical/indicator-schema";
import {
  loadIndicatorFavorites,
  saveIndicatorFavorites,
  toggleIndicatorFavorite,
} from "@/lib/chart/indicator-favorites";
import type { Candle } from "@/lib/technical/types";
import {
  fetchChartData,
  type ChartDataDTO,
} from "@/lib/market/chart-data-client";
import type { ChartCandle, ChartTimeframe } from "@/lib/market/chart-candles";
import { isMarketOpen } from "@/lib/market-hours";
import {
  alertOperatorLabel,
  attachedKindFor,
  bandForDrawing,
  defaultAlertMessage,
  evaluateAllStates,
  evaluateChannelState,
  evaluateRuleState,
  fetchAlerts,
  fibLevelPrice,
  fireAlertWebhook,
  formatBand,
  getAlertMeta,
  isAlertExpired,
  isAlertPaused,
  isChannelOperator,
  isLevelOperator,
  legacyConditionFor,
  markLocalAlertTriggered,
  readLocalAlerts,
  renderAlertMessage,
  supportsTrendlineAlert,
  trendLinePriceAt,
  recordAlertTrigger,
  type AlertRule,
  type ChannelBand,
  type ChartAlert,
} from "./alerts";
import { queuePush } from "./chart-sync";
import AlertLogPanel from "./AlertLogPanel";
import AlertsPanel from "./AlertsPanel";
import BottomBar from "./BottomBar";
import CalendarPanel from "./CalendarPanel";
import ChartCanvasMenu from "./ChartCanvasMenu";
import IndicatorInfoDialog from "./IndicatorInfoDialog";
import IndicatorMenu, { type IndicatorMenuAction } from "./IndicatorMenu";
import DataPanel from "./DataPanel";
import DataWindowDialog from "./DataWindowDialog";
import NewsPanel from "./NewsPanel";
import DrawingMoreMenu from "./DrawingMoreMenu";
import DrawingPropsBar, { type DrawingStylePatch } from "./DrawingPropsBar";
import DrawingSettingsDialog from "./DrawingSettingsDialog";
import ObjectsPanel from "./ObjectsPanel";
import ObjectTreeDialog from "./ObjectTreeDialog";
import OrderTicketDialog, {
  type OrderSide,
  type OrderType,
} from "./OrderTicketDialog";
import PineEditorPanel from "./PineEditorPanel";
import PriceScaleMenu from "./PriceScaleMenu";
import FavoritesBar from "./FavoritesBar";
import RightRail from "./RightRail";
import {
  loadFavorites,
  saveFavorites,
  toggleIn,
  type Favorites,
} from "./favorites";
import DrawingToolbar, {
  type HideState,
  type LockState,
} from "./DrawingToolbar";
import PriceAlertDialog, { type AlertEditTarget } from "./PriceAlertDialog";
import ScreenerPanel from "./ScreenerPanel";
import { type CursorKind } from "./tool-icons";
import ReplayBar, { REPLAY_SPEEDS } from "./ReplayBar";
import SidePanel from "./SidePanel";
import SymbolDetailsPanel from "./SymbolDetailsPanel";
import SymbolSearchDialog, { type SearchResult } from "./SymbolSearchDialog";
import TerminalChart, {
  type ChartContextMenu,
  type ChartPriceLine,
  type CompareSeries,
  type TerminalChartHandle,
} from "./TerminalChart";
import TopToolbar, { TIMEFRAME_OPTIONS } from "./TopToolbar";
import WatchlistPanel from "./WatchlistPanel";
import {
  DEFAULT_SETTINGS,
  engineScaleForPriceMode,
  loadLayouts,
  loadSettings,
  saveLayouts,
  saveSettings,
  type SavedLayout,
  type ScaleMode,
  type TerminalSettings,
} from "./terminal-settings";
import type {
  ChartDisplaySettings,
  PriceScaleMode,
} from "@/lib/chart/display-settings";
import ChartSettingsDialog from "./ChartSettingsDialog";
import {
  countdownSeconds,
  formatCountdown,
  playAlertSound,
  sessionHighLow,
} from "@/lib/chart/display-settings";
import { useChartData } from "./useChartData";
import { useDrawings } from "./useDrawings";
import { useDailyHistory, useStockInfo } from "./useSymbolInfo";
import { DOWN_COLOR, UP_COLOR, formatNumber, signed, useDismiss } from "./ui";

const COMPARE_COLORS = ["#F57C00", "#7E57C2", "#E91E63", "#00BCD4"];
const TEMPLATES_KEY = "chart:terminal:indicator-templates:v1";
const IST_OFFSET_SECONDS = 19_800;

interface ReplayState {
  readonly mode: "off" | "select" | "ready";
  readonly index: number;
  readonly playing: boolean;
  readonly speedIndex: number;
}

interface IndicatorTemplate {
  readonly name: string;
  readonly items: readonly {
    readonly definitionId: string;
    readonly snapshot: IndicatorInstanceSnapshot;
  }[];
}

function readTemplates(): IndicatorTemplate[] {
  try {
    const raw = window.localStorage.getItem(TEMPLATES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? (parsed as IndicatorTemplate[]).filter(
          (entry) =>
            typeof entry?.name === "string" && Array.isArray(entry.items),
        )
      : [];
  } catch {
    return [];
  }
}

function writeTemplates(templates: readonly IndicatorTemplate[]): void {
  try {
    window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    queuePush("templates", templates);
  } catch {
    // Templates are a convenience.
  }
}

function toIndicatorCandle(candle: ChartCandle): Candle {
  const seconds = chartTimeToEpoch(candle.time);
  return {
    timestamp: (seconds - IST_OFFSET_SECONDS) * 1_000,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

function formatBarTime(
  candle: ChartCandle | undefined,
  timeframe: ChartTimeframe,
): string {
  if (!candle) return "";
  if (typeof candle.time === "string") return candle.time;
  const date = new Date(candle.time * 1_000);
  const day = date.toISOString().slice(0, 10);
  const clock = date.toISOString().slice(11, 16);
  return ["D", "W", "M"].includes(timeframe) ? day : `${day} ${clock}`;
}

/** Candles for the symbols being compared, refreshed while the market is open. */
function useCompareData(
  symbols: readonly string[],
  timeframe: ChartTimeframe,
): Readonly<Record<string, readonly ChartCandle[]>> {
  const [data, setData] = useState<
    Readonly<Record<string, readonly ChartCandle[]>>
  >({});
  const key = symbols.join(",");

  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async (): Promise<void> => {
      const results = await Promise.allSettled(
        symbols.map((symbol) => fetchChartData({ symbol, timeframe })),
      );
      if (cancelled) return;
      setData((previous) => {
        const next: Record<string, readonly ChartCandle[]> = {};
        results.forEach((result, index) => {
          const symbol = symbols[index]!;
          if (
            result.status === "fulfilled" &&
            result.value.status === "ready"
          ) {
            next[symbol] = result.value.candles;
          } else if (previous[symbol]) {
            next[symbol] = previous[symbol]!;
          }
        });
        return next;
      });
      timer = setTimeout(() => void load(), isMarketOpen() ? 15_000 : 120_000);
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // `key` stands in for the symbols array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, timeframe]);

  return data;
}

export default function ChartTerminal({ symbol }: { readonly symbol: string }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<TerminalChartHandle>(null);
  const pendingRangeRef = useRef<RangeId | null>(null);

  const [settings, setSettings] = useState<TerminalSettings>(
    typeof window === "undefined" ? DEFAULT_SETTINGS : loadSettings,
  );
  const [layouts, setLayouts] = useState<SavedLayout[]>(() =>
    typeof window === "undefined" ? [] : loadLayouts(),
  );
  const [templates, setTemplates] = useState<IndicatorTemplate[]>(() =>
    typeof window === "undefined" ? [] : readTemplates(),
  );

  const [tool, setTool] = useState<DrawingType | null>(null);
  const [emoji, setEmoji] = useState("🔥");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hides, setHides] = useState<HideState>({
    drawings: false,
    indicators: false,
    positions: false,
  });
  const [locks, setLocks] = useState<LockState>({
    drawings: false,
    indicators: false,
  });
  const hideDrawings = hides.drawings;
  const lockDrawings = locks.drawings;
  const [favorites, setFavorites] = useState<Favorites>(() =>
    typeof window === "undefined"
      ? { tools: [], products: [] }
      : loadFavorites(),
  );
  const updateFavorites = useCallback((next: Favorites) => {
    setFavorites(next);
    saveFavorites(next);
  }, []);
  const [drawingStyle, setDrawingStyle] = useState<{
    color: string;
    width: number;
    dash: DashStyle;
  }>({ color: "#2962FF", width: 2, dash: "solid" });

  const [searchMode, setSearchMode] = useState<"symbol" | "compare" | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<
    "inputs" | "style" | "visibility"
  >("inputs");
  const [menuIndicator, setMenuIndicator] = useState<{
    instanceId: string;
    x: number;
    y: number;
  } | null>(null);
  const [infoIndicator, setInfoIndicator] = useState<{
    instanceId: string;
    tab: "about" | "source";
  } | null>(null);
  const [, setFavVersion] = useState(0);
  const [alertDialog, setAlertDialog] = useState<{
    price: number | null;
    drawing: Drawing | null;
    linePrice: number | null;
  } | null>(null);
  const [alertEditTarget, setAlertEditTarget] =
    useState<AlertEditTarget | null>(null);
  const [localAlerts, setLocalAlerts] = useState<ChartAlert[]>(() =>
    readLocalAlerts(),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ChartContextMenu | null>(null);
  const [copiedDrawing, setCopiedDrawing] = useState<Drawing | null>(null);
  const [drawingSettingsOpen, setDrawingSettingsOpen] = useState(false);
  const [objectTreeOpen, setObjectTreeOpen] = useState(false);
  const [dataWindowOpen, setDataWindowOpen] = useState(false);
  const [orderTicket, setOrderTicket] = useState<{
    side: OrderSide;
    orderType: OrderType;
    price: number;
  } | null>(null);
  const ctxMenuRef = useDismiss(() => setCtxMenu(null), ctxMenu !== null);
  const leftEdgeRef = useRef<Map<ChartTimeframe, number>>(new Map());
  const prevTimeframeRef = useRef<ChartTimeframe>(settings.timeframe);
  const [alerts, setAlerts] = useState<ChartAlert[]>([]);
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [activeRange, setActiveRange] = useState<RangeId | null>(null);
  const [pineOpen, setPineOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("chart:terminal:left-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [replay, setReplay] = useState<ReplayState>({
    mode: "off",
    index: 0,
    playing: false,
    speedIndex: 0,
  });

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "chart:terminal:left-collapsed",
        leftCollapsed ? "1" : "0",
      );
    } catch {
      // Cosmetic preference; ignore storage failures.
    }
  }, [leftCollapsed]);

  const patchSettings = useCallback(
    (patch: Partial<TerminalSettings>) =>
      setSettings((current) => ({ ...current, ...patch })),
    [],
  );

  // ── data ───────────────────────────────────────────────────────────────
  const live = useChartData({
    symbol,
    timeframe: settings.timeframe,
    paused: replay.mode !== "off",
  });
  const fullCandles = live.candles;
  const candles = useMemo(
    () =>
      replay.mode === "ready"
        ? fullCandles.slice(0, replay.index + 1)
        : fullCandles,
    [fullCandles, replay.mode, replay.index],
  );
  const meta = live.meta;
  const displaySymbol = meta?.symbol ?? symbol.toUpperCase();
  const quote = meta?.quote;

  const daily = useDailyHistory(symbol);
  const info = useStockInfo(symbol);

  const compareData = useCompareData(compareSymbols, settings.timeframe);
  const compare = useMemo<CompareSeries[]>(
    () =>
      compareSymbols.flatMap((entry, index) => {
        const series = compareData[entry];
        return series
          ? [
              {
                symbol: entry,
                color: COMPARE_COLORS[index % COMPARE_COLORS.length]!,
                candles: series,
              },
            ]
          : [];
      }),
    [compareSymbols, compareData],
  );

  // ── indicators ─────────────────────────────────────────────────────────
  const indicatorCandles = useMemo(
    () => candles.map(toIndicatorCandle),
    [candles],
  );
  const indicators = useChartIndicators({
    storageKey: "chart:terminal:indicators",
    candles: indicatorCandles,
    onPersist: (payload) => queuePush("indicators", payload),
  });
  const visibleInstances = hides.indicators ? [] : indicators.instances;

  /** Prices a magnet may snap to on a bar: values of the plotted price-pane indicators. */
  const snapValues = useMemo(() => {
    if (!settings.snapIndicators || hides.indicators) return undefined;
    return (index: number): number[] => {
      const values: number[] = [];
      for (const instance of indicators.instances) {
        const definition = getIndicatorDefinition(instance.definitionId);
        if (!definition || definition.pane !== "price" || instance.hidden)
          continue;
        const series = indicators.series[instance.instanceId];
        for (const plot of definition.plots) {
          if (!instance.plotStyles[plot.id]?.visible) continue;
          const value = series?.[plot.id]?.[index];
          if (typeof value === "number" && Number.isFinite(value))
            values.push(value);
        }
      }
      return values;
    };
  }, [
    settings.snapIndicators,
    hides.indicators,
    indicators.instances,
    indicators.series,
  ]);

  const guardIndicators = useCallback(
    <T extends unknown[]>(action: (...args: T) => void) =>
      (...args: T): void => {
        if (locks.indicators) {
          toast("Indicators are locked. Unlock them from the toolbar to edit.");
          return;
        }
        action(...args);
      },
    [locks.indicators],
  );

  const editingInstance = editingIndicator
    ? indicators.getInstance(editingIndicator)
    : undefined;

  const handleIndicatorMenuAction = (
    instanceId: string,
    action: IndicatorMenuAction,
  ): void => {
    const target = indicators.getInstance(instanceId);
    if (!target) {
      setMenuIndicator(null);
      return;
    }
    switch (action) {
      case "alert": {
        const last = candles[candles.length - 1];
        setAlertDialog({ price: last?.close ?? null, drawing: null, linePrice: null });
        setMenuIndicator(null);
        return;
      }
      case "add-indicator":
        setPickerOpen(true);
        setMenuIndicator(null);
        return;
      case "favorite": {
        const next = toggleIndicatorFavorite(
          loadIndicatorFavorites(),
          target.definitionId,
        );
        saveIndicatorFavorites(next);
        setFavVersion((version) => version + 1);
        return;
      }
      case "visibility-settings":
        setSettingsTab("visibility");
        setEditingIndicator(instanceId);
        setMenuIndicator(null);
        return;
      case "about":
        setInfoIndicator({ instanceId, tab: "about" });
        setMenuIndicator(null);
        return;
      case "source":
        setInfoIndicator({ instanceId, tab: "source" });
        setMenuIndicator(null);
        return;
      case "copy":
        guardIndicators(indicators.duplicateIndicator)(instanceId);
        setMenuIndicator(null);
        return;
      case "hide":
        guardIndicators(indicators.toggleHidden)(instanceId);
        setMenuIndicator(null);
        return;
      case "remove":
        guardIndicators(indicators.removeIndicator)(instanceId);
        setMenuIndicator(null);
        return;
      case "object-tree":
        setObjectTreeOpen(true);
        setMenuIndicator(null);
        return;
      case "settings":
        setSettingsTab("inputs");
        setEditingIndicator(instanceId);
        setMenuIndicator(null);
        return;
    }
  };

  const saveTemplate = useCallback(
    (name: string): void => {
      const next = [
        ...templates.filter((entry) => entry.name !== name),
        {
          name,
          items: indicators.instances.map((instance) => ({
            definitionId: instance.definitionId,
            snapshot: toInstanceSnapshot(instance),
          })),
        },
      ];
      setTemplates(next);
      writeTemplates(next);
      toast.success(`Template "${name}" saved`);
    },
    [templates, indicators.instances],
  );

  const applyTemplate = useCallback(
    (name: string): void => {
      const template = templates.find((entry) => entry.name === name);
      if (!template) return;
      for (const instance of indicators.instances) {
        indicators.removeIndicator(instance.instanceId);
      }
      for (const item of template.items) {
        const definition = getIndicatorDefinition(item.definitionId);
        const instanceId = indicators.addIndicator(item.definitionId);
        if (definition && instanceId) {
          indicators.updateIndicator(
            normalizeIndicatorInstance(definition, instanceId, item.snapshot),
          );
        }
      }
      toast.success(`Applied "${name}"`);
    },
    [templates, indicators],
  );

  const deleteTemplate = useCallback(
    (name: string): void => {
      const next = templates.filter((entry) => entry.name !== name);
      setTemplates(next);
      writeTemplates(next);
    },
    [templates],
  );

  // ── drawings ───────────────────────────────────────────────────────────
  const drawings = useDrawings(symbol.toUpperCase());

  const patchDisplay = useCallback((patch: Partial<ChartDisplaySettings>) => {
    setSettings((current) => ({
      ...current,
      display: { ...current.display, ...patch },
    }));
  }, []);

  /** Price-axis mode from either scale menu; keeps the engine scale in sync. */
  const handlePriceMode = useCallback(
    (mode: PriceScaleMode) => {
      patchDisplay({ priceScaleMode: mode });
      const engine = engineScaleForPriceMode(mode);
      if (engine) patchSettings({ scaleMode: engine });
    },
    [patchDisplay, patchSettings],
  );

  /** New drawings paint on top of every existing one. */
  const addDrawing = useCallback(
    (drawing: Drawing): Drawing => {
      const top = drawings.drawings.reduce(
        (highest, entry) => Math.max(highest, entry.z),
        0,
      );
      const stamped = { ...drawing, z: top + 1 };
      drawings.add(stamped);
      return stamped;
    },
    [drawings],
  );

  const drawingLockedById = useCallback(
    (drawing: Drawing): boolean => lockDrawings || drawing.locked === true,
    [lockDrawings],
  );

  const requireUnlocked = useCallback(
    (drawing: Drawing): boolean => {
      if (drawingLockedById(drawing)) {
        toast("This drawing is locked. Unlock it first.");
        return false;
      }
      return true;
    },
    [drawingLockedById],
  );

  const removeDrawingById = useCallback(
    (id: string) => {
      const target = drawings.drawings.find((entry) => entry.id === id);
      if (!target) return;
      if (drawingLockedById(target) && !settings.alwaysRemoveLocked) {
        toast("This drawing is locked. Unlock it first.");
        return;
      }
      drawings.remove(id);
      if (selectedId === id) setSelectedId(null);
    },
    [drawings, drawingLockedById, settings.alwaysRemoveLocked, selectedId],
  );

  const selectedDrawing = useMemo(
    () => drawings.drawings.find((entry) => entry.id === selectedId) ?? null,
    [drawings.drawings, selectedId],
  );

  const objectTreeIndicators = useMemo(
    () =>
      indicators.instances.map((instance) => ({
        instanceId: instance.instanceId,
        name:
          getIndicatorDefinition(instance.definitionId)?.name ??
          instance.definitionId,
        hidden: instance.hidden,
      })),
    [indicators.instances],
  );

  const menuDrawing = useMemo(
    () =>
      ctxMenu?.drawingId
        ? (drawings.drawings.find((entry) => entry.id === ctxMenu.drawingId) ??
          null)
        : null,
    [ctxMenu, drawings.drawings],
  );

  const lockCursorLine = useCallback(() => {
    if (ctxMenu?.time === null || ctxMenu?.time === undefined) {
      toast("Right-click on the chart to pick a time first.");
      return;
    }
    const at = ctxMenu.time;
    const price = ctxMenu.price ?? quote?.lastPrice ?? 0;
    if (!(price > 0)) {
      toast("No price at the cursor.");
      return;
    }
    addDrawing({
      id: createDrawingId(),
      type: "vline",
      points: [{ t: at, p: price }],
      color: "#787B86",
      width: 1,
      dash: "dashed",
      z: 0,
      hidden: false,
      locked: true,
      visibleOn: "all",
      visibleTimeframe: null,
    });
    toast.success("Vertical line locked at the cursor time.");
  }, [ctxMenu, quote, addDrawing]);
  const barSeconds = useMemo(() => {
    const last = candles[candles.length - 1];
    const previous = candles[candles.length - 2];
    return last && previous
      ? Math.max(
          60,
          chartTimeToEpoch(last.time) - chartTimeToEpoch(previous.time),
        )
      : 86_400;
  }, [candles]);

  const removeObjects = useCallback(
    (what: "drawings" | "indicators" | "both") => {
      if (what !== "indicators") {
        if (locks.drawings && !settings.alwaysRemoveLocked) {
          toast(
            "Drawings are locked. Turn on “Always remove locked drawings” or unlock them.",
          );
        } else {
          drawings.clear();
          setSelectedId(null);
        }
      }
      if (what !== "drawings") {
        if (locks.indicators) {
          toast("Indicators are locked. Unlock them first.");
        } else {
          for (const instance of indicators.instances) {
            indicators.removeIndicator(instance.instanceId);
          }
        }
      }
    },
    [locks, settings.alwaysRemoveLocked, drawings, indicators],
  );

  const chooseTool = useCallback((next: DrawingType | null) => {
    setTool(next);
    setSelectedId(null);
    if (next) {
      setDrawingStyle((current) => ({
        ...current,
        color: getToolDefinition(next).defaultColor,
      }));
    }
  }, []);

  const onStyleChange = useCallback(
    (patch: DrawingStylePatch) => {
      // textColor applies to the drawing only; the default style keeps the
      // line attributes.
      setDrawingStyle((current) => ({
        ...current,
        ...(patch.color !== undefined ? { color: patch.color } : {}),
        ...(patch.width !== undefined ? { width: patch.width } : {}),
        ...(patch.dash !== undefined ? { dash: patch.dash } : {}),
      }));
      if (selectedDrawing && !lockDrawings && !selectedDrawing.locked) {
        drawings.replace({ ...selectedDrawing, ...patch });
      }
    },
    [selectedDrawing, lockDrawings, drawings],
  );

  const removeSelected = useCallback(() => {
    if (selectedId) removeDrawingById(selectedId);
  }, [selectedId, removeDrawingById]);

  const toggleDrawingLockedById = useCallback(
    (id: string) => {
      if (lockDrawings) return;
      const target = drawings.drawings.find((entry) => entry.id === id);
      if (!target) return;
      drawings.replace({ ...target, locked: !target.locked });
    },
    [lockDrawings, drawings],
  );

  const toggleSelectedLock = useCallback(() => {
    if (selectedDrawing) toggleDrawingLockedById(selectedDrawing.id);
  }, [selectedDrawing, toggleDrawingLockedById]);

  const cloneDrawingById = useCallback(
    (id: string, deltaTime: number, deltaPrice: number) => {
      const target = drawings.drawings.find((entry) => entry.id === id);
      if (!target) return;
      const copy = cloneDrawing(target, deltaTime, deltaPrice);
      addDrawing(copy);
      setSelectedId(copy.id);
    },
    [drawings, addDrawing],
  );

  const cloneSelected = useCallback(
    (deltaTime: number, deltaPrice: number) => {
      if (selectedDrawing) {
        cloneDrawingById(selectedDrawing.id, deltaTime, deltaPrice);
      }
    },
    [selectedDrawing, cloneDrawingById],
  );

  const orderDrawingById = useCallback(
    (id: string, direction: VisualOrderDirection) => {
      const target = drawings.drawings.find((entry) => entry.id === id);
      if (!target || !requireUnlocked(target)) return;
      const next = reorderDrawing(drawings.drawings, id, direction);
      for (const entry of next) {
        const before = drawings.drawings.find((item) => item.id === entry.id);
        if (before && before.z !== entry.z) drawings.replace(entry);
      }
    },
    [drawings, requireUnlocked],
  );

  const orderSelected = useCallback(
    (direction: VisualOrderDirection) => {
      if (selectedDrawing) orderDrawingById(selectedDrawing.id, direction);
    },
    [selectedDrawing, orderDrawingById],
  );

  const scopeDrawingById = useCallback(
    (id: string, scope: DrawingVisibilityScope) => {
      const target = drawings.drawings.find((entry) => entry.id === id);
      if (!target || !requireUnlocked(target)) return;
      drawings.replace({
        ...target,
        visibleOn: scope,
        visibleTimeframe: scope === "all" ? null : settings.timeframe,
      });
    },
    [drawings, requireUnlocked, settings.timeframe],
  );

  const scopeSelected = useCallback(
    (scope: DrawingVisibilityScope) => {
      if (selectedDrawing) scopeDrawingById(selectedDrawing.id, scope);
    },
    [selectedDrawing, scopeDrawingById],
  );

  const hideDrawingById = useCallback(
    (id: string) => {
      const target = drawings.drawings.find((entry) => entry.id === id);
      if (!target || !requireUnlocked(target)) return;
      drawings.replace({ ...target, hidden: true });
    },
    [drawings, requireUnlocked],
  );

  /** True visibility toggle for the object tree (hide is one-way). */
  const toggleDrawingHiddenById = useCallback(
    (id: string) => {
      const target = drawings.drawings.find((entry) => entry.id === id);
      if (!target || !requireUnlocked(target)) return;
      drawings.replace({ ...target, hidden: !target.hidden });
    },
    [drawings, requireUnlocked],
  );

  const toggleIndicatorHidden = useCallback(
    (instanceId: string) => {
      const instance = indicators.instances.find(
        (entry) => entry.instanceId === instanceId,
      );
      if (instance) {
        indicators.updateIndicator({
          ...instance,
          hidden: !instance.hidden,
        });
      }
    },
    [indicators],
  );

  const hideSelected = useCallback(() => {
    if (selectedDrawing) hideDrawingById(selectedDrawing.id);
  }, [selectedDrawing, hideDrawingById]);

  const copyDrawing = useCallback(
    (id: string) => {
      const found = drawings.drawings.find((entry) => entry.id === id);
      if (!found) return;
      setCopiedDrawing(found);
      try {
        void navigator.clipboard?.writeText(JSON.stringify(found));
      } catch {
        // The in-app clipboard above is the source of truth; the system
        // clipboard is only a convenience.
      }
      toast.success("Drawing copied — right-click to paste it.");
    },
    [drawings],
  );

  const pasteDrawingAt = useCallback(
    (point: { t: number; p: number } | null) => {
      if (!copiedDrawing) {
        toast("Copy a drawing first.");
        return;
      }
      const anchor = copiedDrawing.points[0];
      if (!anchor) return;
      const copy = cloneDrawing(
        copiedDrawing,
        point ? point.t - anchor.t : barSeconds * 5,
        point ? point.p - anchor.p : 0,
      );
      addDrawing(copy);
      setSelectedId(copy.id);
    },
    [copiedDrawing, barSeconds, addDrawing],
  );

  // ── alerts ─────────────────────────────────────────────────────────────
  const loadAlerts = useCallback(async (): Promise<void> => {
    try {
      setAlerts(await fetchAlerts());
    } catch {
      // Alerts are supplementary; the chart works without them.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchAlerts()
      .then((loaded) => {
        if (!cancelled) setAlerts(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // The embeddable chart has no panels of its own; its toolbar buttons dispatch
  // these events and the mounted terminal answers by opening its dialogs.
  useEffect(() => {
    const onIndicators = (): void => setPickerOpen(true);
    const onAlerts = (event: Event): void => {
      const detail = (event as CustomEvent<ChartPanelDetail>).detail;
      setAlertDialog({
        price: detail?.price ?? null,
        drawing: null,
        linePrice: null,
      });
    };
    window.addEventListener(CHART_INDICATORS_EVENT, onIndicators);
    window.addEventListener(CHART_ALERTS_EVENT, onAlerts);
    return () => {
      window.removeEventListener(CHART_INDICATORS_EVENT, onIndicators);
      window.removeEventListener(CHART_ALERTS_EVENT, onAlerts);
    };
  }, []);

  const symbolAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.status === "active" && alert.tradingSymbol === displaySymbol,
      ),
    [alerts, displaySymbol],
  );

  const localSymbolAlerts = useMemo(
    () =>
      localAlerts.filter(
        (alert) =>
          alert.status === "active" && alert.tradingSymbol === displaySymbol,
      ),
    [localAlerts, displaySymbol],
  );

  // Bar closes in epoch seconds for the regression band behind alerts.
  const regressionCloses = useMemo(
    () =>
      candles.map((candle) => ({
        t: chartTimeToEpoch(candle.time),
        p: candle.close,
      })),
    [candles],
  );

  // Full attachment context for the alert dialog: band, fork median and fib
  // levels resolve from the drawing itself, anchored at the latest bar so no
  // clock read is needed during render.
  const alertDraftContext = useMemo(() => {
    const drawing = alertDialog?.drawing ?? null;
    const kind = drawing
      ? attachedKindFor(drawing.type, drawing.points.length)
      : null;
    const base = {
      price: alertDialog?.price ?? null,
      drawingId: drawing?.id ?? null,
      drawingType: drawing?.type ?? null,
      drawingLabel: drawing ? getToolDefinition(drawing.type).label : null,
      linePrice: alertDialog?.linePrice ?? null,
      kind,
      band: null as ChannelBand | null,
      median: null as number | null,
      fibLevels: [] as readonly {
        readonly value: number;
        readonly label: string;
        readonly price: number;
      }[],
    };
    if (!drawing || !kind) return base;
    const anchorSec =
      regressionCloses[regressionCloses.length - 1]?.t ??
      drawing.points[drawing.points.length - 1]?.t ??
      null;
    if (anchorSec === null) return base;
    if (kind === "channel" || kind === "fork") {
      const resolved = bandForDrawing(
        drawing.type,
        drawing.points,
        anchorSec,
        regressionCloses,
      );
      return { ...base, band: resolved.band, median: resolved.median };
    }
    if (kind === "fib") {
      return {
        ...base,
        fibLevels: FIB_LEVELS.map((level) => ({
          value: level.value,
          label: `${level.value} (${Math.round(level.value * 100)}%)`,
          price: fibLevelPrice(drawing.points, level.value) ?? NaN,
        })).filter((entry) => Number.isFinite(entry.price)),
      };
    }
    return base;
  }, [alertDialog, regressionCloses]);

  // Evaluates rich alert rules on every quote tick: AND-combined price/volume
  // conditions, trendline targets that move with the drawing, once vs
  // every-minute triggers, expirations, and per-alert schedules.
  const firedAlertsRef = useRef<Set<string>>(new Set());
  const alertStateRef = useRef<Map<string, boolean>>(new Map());
  const alertCooldownRef = useRef<Map<string, number>>(new Map());
  const previousPriceRef = useRef<number | null>(null);
  const alertPrice = quote?.lastPrice ?? null;
  const latestVolume =
    candles.length > 0 ? (candles[candles.length - 1]?.volume ?? null) : null;
  useEffect(() => {
    if (!alertPrice || alertPrice <= 0) return;
    const previous = previousPriceRef.current;
    previousPriceRef.current = alertPrice;
    if (previous === null || previous === alertPrice) return;
    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const marketOpen = isMarketOpen(new Date(nowMs));
    let localChanged = false;
    for (const alert of [...symbolAlerts, ...localSymbolAlerts]) {
      if (isAlertPaused(alert.id)) continue;
      const meta = getAlertMeta(alert.tradingSymbol, alert.targetPrice);
      if (meta && isAlertExpired(meta, nowMs)) continue;
      if (meta && meta.schedule === "market-hours" && !marketOpen) continue;
      const rules: readonly AlertRule[] = meta?.rules ?? [
        alert.direction === "above"
          ? { operator: "crossing-up", target: alert.targetPrice }
          : alert.direction === "below"
            ? { operator: "crossing-down", target: alert.targetPrice }
            : { operator: "crossing", target: alert.targetPrice },
      ];
      // Attached alerts follow the drawing: trend lines move the target,
      // fib alerts re-resolve their level, and channel/fork alerts evaluate
      // against the live band. Otherwise use stored targets.
      let targets = rules.map((rule) => rule.target);
      let liveBand: ChannelBand | null = null;
      if (meta?.drawingId) {
        const drawing = drawings.drawings.find(
          (entry) => entry.id === meta.drawingId,
        );
        if (drawing && meta.attachedKind === "fib" && meta.fibLevel !== null) {
          const level = fibLevelPrice(drawing.points, meta.fibLevel);
          targets = rules.map(() => level ?? meta.staticTarget);
        } else if (
          drawing &&
          rules.some((rule) => isChannelOperator(rule.operator))
        ) {
          liveBand = bandForDrawing(
            drawing.type,
            drawing.points,
            nowSec,
            regressionCloses,
          ).band;
          if (liveBand === null) {
            targets = rules.map(() => meta.staticTarget);
          }
        } else {
          const line =
            drawing && supportsTrendlineAlert(drawing.type)
              ? trendLinePriceAt(drawing.points, nowSec)
              : null;
          const dynamic = line ?? meta.staticTarget;
          targets = rules.map(() => dynamic);
        }
      }
      const effective = rules.map((rule, index) => ({
        ...rule,
        target: targets[index] ?? rule.target,
      }));
      const kind = meta?.kind ?? "price";
      const band = liveBand;
      const stateNow =
        band === null
          ? evaluateAllStates(effective, alertPrice, previous, latestVolume)
          : effective.every((rule) =>
              isChannelOperator(rule.operator)
                ? evaluateChannelState(rule.operator, alertPrice, band)
                : evaluateRuleState(rule, alertPrice, previous, latestVolume),
            );
      const trigger = meta?.trigger ?? "once";
      if (trigger === "once") {
        if (firedAlertsRef.current.has(alert.id)) continue;
        const seen = alertStateRef.current.get(alert.id);
        if (seen === undefined) {
          // First sight while a level condition already holds must not fire
          // (the crossing happened before the alert existed).
          const allLevel = effective.every((rule) =>
            isLevelOperator(rule.operator),
          );
          alertStateRef.current.set(alert.id, allLevel ? stateNow : false);
          if (allLevel || !stateNow) continue;
        } else {
          if (!stateNow || seen) continue;
          alertStateRef.current.set(alert.id, true);
        }
        firedAlertsRef.current.add(alert.id);
        if (alert.id.startsWith("local-")) {
          markLocalAlertTriggered(alert.id);
          localChanged = true;
        }
      } else {
        alertStateRef.current.set(alert.id, stateNow);
        if (!stateNow) continue;
        if (nowMs - (alertCooldownRef.current.get(alert.id) ?? 0) < 60_000) {
          continue;
        }
        alertCooldownRef.current.set(alert.id, nowMs);
      }
      const primary = effective[0]!;
      const conditionLabel = alertOperatorLabel(primary.operator);
      const targetLabel =
        band !== null && isChannelOperator(primary.operator)
          ? formatBand(band, (value) => `₹${formatNumber(value)}`)
          : primary.operator === "rising-pct" ||
              primary.operator === "falling-pct"
            ? `${primary.target}%`
            : kind === "volume" || primary.operator === "volume-above"
              ? `${primary.target.toLocaleString("en-IN")} shares`
              : `₹${formatNumber(primary.target)}`;
      const message =
        meta?.message?.trim() && meta.message.trim().length > 0
          ? renderAlertMessage(meta.message, {
              symbol: alert.tradingSymbol,
              condition: conditionLabel,
              target: targetLabel,
              price: `₹${formatNumber(alertPrice)}`,
            })
          : defaultAlertMessage(
              alert.tradingSymbol,
              conditionLabel,
              targetLabel,
            );
      recordAlertTrigger({
        symbol: alert.tradingSymbol,
        targetPrice: primary.target,
        condition: legacyConditionFor(primary.operator),
        price: alertPrice,
      });
      if (meta?.notifyToast ?? true) {
        toast.success(
          message,
          settings.display.autoHideToasts ? undefined : { duration: Infinity },
        );
      }
      if ((meta?.playSound ?? false) && settings.display.executionSound) {
        playAlertSound(
          settings.display.soundName,
          settings.display.alertVolume / 100,
        );
      }
      if (meta?.webhookUrl) {
        void fireAlertWebhook(meta.webhookUrl, {
          symbol: alert.tradingSymbol,
          condition: conditionLabel,
          target: primary.target,
          price: alertPrice,
          at: new Date(nowMs).toISOString(),
        });
      }
      void loadAlerts();
    }
    if (localChanged) setLocalAlerts(readLocalAlerts());
  }, [
    alertPrice,
    latestVolume,
    symbolAlerts,
    localSymbolAlerts,
    drawings.drawings,
    regressionCloses,
    loadAlerts,
    settings.display,
  ]);

  const priceLines = useMemo<ChartPriceLine[]>(() => {
    const display = settings.display;
    const lines: ChartPriceLine[] = display.showAlertLines
      ? [...symbolAlerts, ...localSymbolAlerts]
          .filter(
            (alert) => !display.onlyActiveAlerts || alert.status === "active",
          )
          .map((alert) => ({
            id: alert.id,
            price: alert.targetPrice,
            color: display.alertLineColor,
            title: `Alert ${alert.direction === "above" ? "▲" : "▼"}`,
          }))
      : [];
    if (display.highLow === "value-line") {
      const extremes = sessionHighLow(candles, settings.timeframe);
      if (extremes) {
        lines.push(
          {
            id: "session-high",
            price: extremes.high,
            color: "#089981",
            title: "High",
          },
          {
            id: "session-low",
            price: extremes.low,
            color: "#F23645",
            title: "Low",
          },
        );
      }
    }
    if (
      settings.showPrevClose &&
      quote &&
      quote.prevClose > 0 &&
      replay.mode === "off"
    ) {
      lines.push({
        id: "prev-close",
        price: quote.prevClose,
        color: "#787B86",
        title: "Prev close",
      });
    }
    return lines;
  }, [
    symbolAlerts,
    localSymbolAlerts,
    settings.showPrevClose,
    settings.display,
    settings.timeframe,
    candles,
    quote,
    replay.mode,
  ]);

  // ── ranges and navigation ──────────────────────────────────────────────
  const applyRange = useCallback(
    (range: RangeId): void => {
      const last = candles[candles.length - 1];
      if (!last) return;
      chartRef.current?.showRange(
        rangeStartEpoch(range, chartTimeToEpoch(last.time)),
      );
    },
    [candles],
  );

  const onRange = useCallback(
    (range: RangeId) => {
      setActiveRange(range);
      const timeframe = RANGE_TIMEFRAME[range];
      if (timeframe !== settings.timeframe) {
        if (settings.display.keepLeftEdge) {
          const edge = chartRef.current?.getLeftEdgeEpoch();
          if (edge !== null && edge !== undefined) {
            leftEdgeRef.current.set(settings.timeframe, edge);
          }
        }
        pendingRangeRef.current = range;
        patchSettings({ timeframe });
      } else {
        applyRange(range);
      }
    },
    [
      settings.timeframe,
      settings.display.keepLeftEdge,
      patchSettings,
      applyRange,
    ],
  );

  useEffect(() => {
    const pending = pendingRangeRef.current;
    if (!pending) return;
    if (live.status === "empty" || live.status === "error") {
      pendingRangeRef.current = null;
    } else if (live.status === "ready" && candles.length > 0) {
      pendingRangeRef.current = null;
      applyRange(pending);
    }
  }, [live.status, candles, applyRange]);

  const onTimeframe = useCallback(
    (timeframe: ChartTimeframe) => {
      if (settings.display.keepLeftEdge) {
        const edge = chartRef.current?.getLeftEdgeEpoch();
        if (edge !== null && edge !== undefined) {
          leftEdgeRef.current.set(settings.timeframe, edge);
        }
      }
      setActiveRange(null);
      pendingRangeRef.current = null;
      patchSettings({ timeframe });
    },
    [patchSettings, settings.display.keepLeftEdge, settings.timeframe],
  );

  // Either the object-tree hide switch or the Settings dialog can suppress
  // position drawings.
  const hidePositions = hides.positions || !settings.display.showPositions;

  // Restore the saved left edge after an interval change reloads the data,
  // unless a range selection already claimed the view.
  useEffect(() => {
    if (live.status !== "ready" || candles.length === 0) return;
    const previous = prevTimeframeRef.current;
    if (previous === settings.timeframe) return;
    prevTimeframeRef.current = settings.timeframe;
    if (pendingRangeRef.current !== null) return;
    if (!settings.display.keepLeftEdge) return;
    const saved = leftEdgeRef.current.get(settings.timeframe);
    if (saved !== undefined) chartRef.current?.showRange(saved);
  }, [live.status, candles, settings.timeframe, settings.display.keepLeftEdge]);

  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    if (!settings.display.showCountdown) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [settings.display.showCountdown, settings.timeframe]);
  const countdown = (() => {
    if (!settings.display.showCountdown) return null;
    const seconds = countdownSeconds(clockNow, settings.timeframe);
    return seconds === null ? null : formatCountdown(seconds);
  })();

  const goToSymbol = useCallback(
    (next: string) => router.push(`/chart/${encodeURIComponent(next)}`),
    [router],
  );

  const onSearchSelect = useCallback(
    (result: SearchResult) => {
      const mode = searchMode;
      setSearchMode(null);
      if (mode === "compare") {
        if (
          result.symbol !== displaySymbol &&
          !compareSymbols.includes(result.symbol)
        ) {
          setCompareSymbols((current) =>
            [...current, result.symbol].slice(0, 4),
          );
        }
      } else {
        setCompareSymbols([]);
        goToSymbol(result.symbol);
      }
    },
    [searchMode, displaySymbol, compareSymbols, goToSymbol],
  );

  // ── replay ─────────────────────────────────────────────────────────────
  const lastIndex = fullCandles.length - 1;
  useEffect(() => {
    if (!replay.playing) return;
    const timer = setInterval(() => {
      setReplay((current) => {
        if (current.index >= lastIndex) return { ...current, playing: false };
        return { ...current, index: current.index + 1 };
      });
    }, REPLAY_SPEEDS[replay.speedIndex]!.ms);
    return () => clearInterval(timer);
  }, [replay.playing, replay.speedIndex, lastIndex]);

  const toggleReplay = useCallback(() => {
    setReplay((current) =>
      current.mode === "off"
        ? {
            mode: "select",
            index: Math.max(0, lastIndex),
            playing: false,
            speedIndex: current.speedIndex,
          }
        : { ...current, mode: "off", playing: false },
    );
  }, [lastIndex]);

  // ── layouts ────────────────────────────────────────────────────────────
  const saveLayout = useCallback(
    (name: string) => {
      const next = [
        ...layouts.filter((entry) => entry.name !== name),
        { name, savedAt: new Date().toISOString(), settings },
      ];
      setLayouts(next);
      saveLayouts(next);
      toast.success(`Layout "${name}" saved`);
    },
    [layouts, settings],
  );

  const loadLayout = useCallback(
    (name: string) => {
      const layout = layouts.find((entry) => entry.name === name);
      if (!layout) return;
      setActiveRange(null);
      setSettings(layout.settings);
      toast.success(`Loaded "${name}"`);
    },
    [layouts],
  );

  const deleteLayout = useCallback(
    (name: string) => {
      const next = layouts.filter((entry) => entry.name !== name);
      setLayouts(next);
      saveLayouts(next);
    },
    [layouts],
  );

  // ── screenshot, fullscreen, keyboard ───────────────────────────────────
  const screenshot = useCallback(() => {
    const canvas = chartRef.current?.screenshot();
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${displaySymbol}-${settings.timeframe}.png`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }, [displaySymbol, settings.timeframe]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void rootRef.current?.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const onChange = (): void =>
      setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const shortcut = toolForShortcut(event.code, event.shiftKey);
        if (shortcut) {
          event.preventDefault();
          chooseTool(shortcut);
          return;
        }
      }
      if (event.key === "/" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setSearchMode("symbol");
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        if (event.shiftKey) drawings.redo();
        else drawings.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawings, chooseTool]);

  // ── overlay values ─────────────────────────────────────────────────────
  const shownIndex =
    hoverIndex !== null && hoverIndex < candles.length
      ? hoverIndex
      : candles.length - 1;
  const shown = candles[shownIndex];
  const previousClose =
    shownIndex > 0 ? candles[shownIndex - 1]?.close : quote?.prevClose;
  const barChange = shown && previousClose ? shown.close - previousClose : null;
  const barPct =
    barChange !== null && previousClose
      ? (barChange / previousClose) * 100
      : null;
  const timeframeLabel = TIMEFRAME_OPTIONS.find(
    (option) => option.id === settings.timeframe,
  )!;
  const barUp = (barChange ?? 0) >= 0;
  const showPropsBar =
    (tool !== null && tool !== "text") || selectedDrawing !== null;

  const statusOverlay = (() => {
    if (live.status === "loading") {
      return (
        <div className="flex flex-col items-center gap-2 text-[13px] font-semibold text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          Loading {displaySymbol}…
        </div>
      );
    }
    if (live.status === "error") {
      return (
        <div className="text-center">
          <p className="text-[14px] font-semibold text-foreground">
            {live.error}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Retrying automatically
          </p>
        </div>
      );
    }
    if (live.status === "empty") {
      return (
        <div className="max-w-sm text-center">
          <p className="text-[14px] font-semibold text-foreground">
            No chart data
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {meta?.message ?? "Nothing to show for this timeframe yet."}
          </p>
        </div>
      );
    }
    return null;
  })();

  return (
    <div
      ref={rootRef}
      className={`flex flex-col bg-card text-foreground ${
        fullscreen ? "h-screen" : "h-[calc(100dvh-7rem)] min-h-[540px]"
      }`}
    >
      <TopToolbar
        symbol={displaySymbol}
        exchange={meta?.exchange ?? "NSE"}
        timeframe={settings.timeframe}
        onTimeframe={onTimeframe}
        style={settings.style}
        onStyle={(style) => patchSettings({ style })}
        onSearch={() => setSearchMode("symbol")}
        onCompare={() => setSearchMode("compare")}
        onIndicators={() => setPickerOpen(true)}
        indicatorCount={indicators.instances.length}
        templateNames={templates.map((entry) => entry.name)}
        onSaveTemplate={saveTemplate}
        onApplyTemplate={applyTemplate}
        onDeleteTemplate={deleteTemplate}
        alertCount={symbolAlerts.length}
        onAlert={() =>
          setAlertDialog({ price: null, drawing: null, linePrice: null })
        }
        replayActive={replay.mode !== "off"}
        onReplay={toggleReplay}
        canUndo={drawings.canUndo}
        canRedo={drawings.canRedo}
        onUndo={drawings.undo}
        onRedo={drawings.redo}
        panelOpen={settings.panelOpen}
        onPanel={() => patchSettings({ panelOpen: !settings.panelOpen })}
        layouts={layouts}
        onSaveLayout={saveLayout}
        onLoadLayout={loadLayout}
        onDeleteLayout={deleteLayout}
        showGrid={settings.showGrid}
        showVolume={settings.showVolume}
        showPrevClose={settings.showPrevClose}
        scaleMode={settings.scaleMode}
        onToggle={(key) => patchSettings({ [key]: !settings[key] })}
        onScaleMode={(mode: ScaleMode) => patchSettings({ scaleMode: mode })}
        onSettings={() => setSettingsOpen(true)}
        fullscreen={fullscreen}
        onFullscreen={toggleFullscreen}
        onScreenshot={screenshot}
        onTrade={() =>
          setOrderTicket({
            side: "buy",
            orderType: "limit",
            price: quote?.lastPrice && quote.lastPrice > 0 ? quote.lastPrice : 0,
          })
        }
        actions={
          <StockActionsMenu
            stock={{
              symbol: displaySymbol,
              name: meta?.displayName ?? displaySymbol,
              ltp: quote?.lastPrice ?? 0,
              sector: info?.sector ?? undefined,
              industry: info?.industry ?? undefined,
            }}
            source="others"
            className="h-8 w-8 rounded-md hover:bg-muted"
          />
        }
      />

      <div className="flex min-h-0 flex-1">
        {leftCollapsed ? (
          <button
            type="button"
            onClick={() => setLeftCollapsed(false)}
            title="Show drawing toolbar"
            aria-label="Show drawing toolbar"
            className="flex w-[14px] shrink-0 items-center justify-center border-r border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <span aria-hidden className="text-[10px]">
              »
            </span>
          </button>
        ) : (
          <DrawingToolbar
          tool={tool}
          onToolChange={chooseTool}
          cursor={settings.cursor}
          onCursor={(cursor: CursorKind) => patchSettings({ cursor })}
          valuesTooltip={settings.valuesTooltip}
          onValuesTooltip={(valuesTooltip) => patchSettings({ valuesTooltip })}
          emoji={emoji}
          onEmoji={setEmoji}
          favorites={favorites.tools}
          onToggleFavorite={(type) =>
            updateFavorites({
              ...favorites,
              tools: toggleIn(favorites.tools, type),
            })
          }
          magnet={settings.magnet}
          onMagnet={(magnet) => patchSettings({ magnet })}
          snapIndicators={settings.snapIndicators}
          onSnapIndicators={(snapIndicators) =>
            patchSettings({ snapIndicators })
          }
          magnetNoticeSeen={settings.magnetNoticeSeen}
          onDismissMagnetNotice={() =>
            patchSettings({ magnetNoticeSeen: true })
          }
          keepDrawing={settings.keepDrawing}
          onKeepDrawing={() =>
            patchSettings({ keepDrawing: !settings.keepDrawing })
          }
          locks={locks}
          onLocks={setLocks}
          hides={hides}
          onHides={setHides}
          drawingCount={drawings.drawings.length}
          indicatorCount={indicators.instances.length}
          alwaysRemoveLocked={settings.alwaysRemoveLocked}
          onAlwaysRemoveLocked={(alwaysRemoveLocked) =>
            patchSettings({ alwaysRemoveLocked })
          }
          onRemove={removeObjects}
          onZoom={(direction) => chartRef.current?.zoom(direction)}
          onCollapse={() => setLeftCollapsed(true)}
        />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="group/chart relative min-h-0 flex-1">
            <TerminalChart
              ref={chartRef}
              chartKey={`${symbol}|${settings.timeframe}`}
              timeframe={settings.timeframe}
              candles={candles}
              style={settings.style}
              showVolume={settings.showVolume}
              showGrid={settings.showGrid}
              scaleMode={settings.scaleMode}
              display={settings.display}
              currency={
                meta?.exchange === "NSE" || meta?.exchange === "BSE"
                  ? "₹"
                  : null
              }
              magnet={settings.magnet}
              snapValues={snapValues}
              instances={visibleInstances}
              indicatorSeries={indicators.series}
              compare={compare}
              priceLines={priceLines}
              drawings={drawings.drawings}
              selectedId={selectedId}
              hideDrawings={hideDrawings}
              lockDrawings={lockDrawings}
              tool={tool}
              drawingStyle={drawingStyle}
              pickBar={replay.mode === "select"}
              cursor={settings.cursor}
              valuesTooltip={settings.valuesTooltip}
              hidePositions={hidePositions}
              onErase={(id) => {
                drawings.remove(id);
                setSelectedId(null);
              }}
              emoji={emoji}
              onHover={setHoverIndex}
              onAddDrawing={addDrawing}
              onUpdateDrawing={drawings.replace}
              onBeginChange={drawings.beginChange}
              onSelect={setSelectedId}
              onRemoveSelected={removeSelected}
              onContextMenu={setCtxMenu}
              onCopyDrawing={copyDrawing}
              onPasteDrawing={() => pasteDrawingAt(null)}
              onRatioCapture={(pricePerBar) => patchDisplay({ pricePerBar })}
              onToolDone={() => {
                if (!settings.keepDrawing) setTool(null);
              }}
              onCancel={() => {
                setTool(null);
                setSelectedId(null);
              }}
              onBarClick={(index) =>
                setReplay((current) => ({
                  ...current,
                  mode: "ready",
                  index,
                  playing: false,
                }))
              }
            />

            {settings.display.watermark && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
              >
                <span
                  className="select-none text-[44px] font-bold text-border"
                  style={
                    settings.display.watermarkColor === "#E0E3EB"
                      ? undefined
                      : { color: settings.display.watermarkColor }
                  }
                >
                  {displaySymbol} · {timeframeLabel.short}
                </span>
              </div>
            )}
            {settings.display.navButtons !== "hidden" && (
              <div
                className={`absolute bottom-2 right-14 z-20 flex flex-col gap-1 ${
                  settings.display.navButtons === "hover"
                    ? "opacity-0 transition-opacity group-hover/chart:opacity-100 focus-within:opacity-100"
                    : ""
                }`}
              >
                <button
                  type="button"
                  aria-label="Zoom in"
                  title="Zoom in (+)"
                  onClick={() => chartRef.current?.zoom("in")}
                  className="flex h-7 w-7 items-center justify-center rounded border border-border bg-popover/95 text-foreground shadow-sm hover:bg-muted"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Zoom out"
                  title="Zoom out (−)"
                  onClick={() => chartRef.current?.zoom("out")}
                  className="flex h-7 w-7 items-center justify-center rounded border border-border bg-popover/95 text-foreground shadow-sm hover:bg-muted"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Pan left"
                  title="Scroll left (←)"
                  onClick={() => chartRef.current?.pan("left")}
                  className="flex h-7 w-7 items-center justify-center rounded border border-border bg-popover/95 text-foreground shadow-sm hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Pan right"
                  title="Scroll right (→)"
                  onClick={() => chartRef.current?.pan("right")}
                  className="flex h-7 w-7 items-center justify-center rounded border border-border bg-popover/95 text-foreground shadow-sm hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Refresh and reset chart view"
                  title="Go to realtime and reset view"
                  onClick={() => {
                    setActiveRange(null);
                    chartRef.current?.scrollToLatest();
                    chartRef.current?.resetView();
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded border border-border bg-popover/95 text-foreground shadow-sm hover:bg-muted"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            )}

            <div
              id="chart-terminal-header"
              className="pointer-events-none absolute left-3 top-2 z-10 flex max-w-[calc(100%-5rem)] flex-col gap-1 rounded px-1"
              style={
                settings.display.statusOpacity >= 100
                  ? undefined
                  : {
                      backgroundColor: `hsl(var(--card) / ${settings.display.statusOpacity / 100})`,
                    }
              }
            >
              <div className="flex flex-wrap items-center gap-x-2 text-[13px]">
                <span className="font-bold">
                  {settings.display.titleMode === "name"
                    ? (meta?.displayName ?? displaySymbol)
                    : displaySymbol}
                </span>
                <span className="text-muted-foreground">
                  · {timeframeLabel.short} · {meta?.exchange ?? "NSE"}
                </span>
                {settings.display.showLogo && (
                  <span
                    aria-hidden
                    className={`h-2 w-2 rounded-full ${
                      meta?.delayed
                        ? "bg-warning"
                        : meta?.marketOpen
                          ? "animate-pulse bg-success"
                          : "bg-muted-foreground"
                    }`}
                  />
                )}
                <span
                  id="chart-terminal-status"
                  className="text-[12px] font-semibold text-muted-foreground"
                >
                  {meta?.delayed
                    ? "Delayed"
                    : meta?.marketOpen
                      ? "Live"
                      : "Market closed"}
                  {live.updatedAt
                    ? ` · Updated ${live.updatedAt.toLocaleTimeString()}`
                    : ""}
                </span>
                {quote && settings.display.showDayChange && (
                  <b
                    className="font-mono text-[12px]"
                    style={{
                      color: quote.netChange >= 0 ? UP_COLOR : DOWN_COLOR,
                    }}
                  >
                    {signed(quote.netChange)} ({signed(quote.pctChange)}%)
                  </b>
                )}
                {quote &&
                  quote.lastPrice > 0 &&
                  settings.display.showBuySell && (
                    <span className="flex items-center gap-1">
                      <span className="rounded bg-error/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-error">
                        SELL {formatNumber(quote.lastPrice)}
                      </span>
                      <span className="rounded bg-success/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-success">
                        BUY {formatNumber(quote.lastPrice)}
                      </span>
                    </span>
                  )}
              </div>
              {shown && settings.display.showChartValues && (
                <div className="flex flex-wrap items-center gap-x-2.5 font-mono text-[12px] text-muted-foreground">
                  <span>
                    O{" "}
                    <b style={{ color: barUp ? UP_COLOR : DOWN_COLOR }}>
                      {formatNumber(shown.open)}
                    </b>
                  </span>
                  <span>
                    H{" "}
                    <b style={{ color: barUp ? UP_COLOR : DOWN_COLOR }}>
                      {formatNumber(shown.high)}
                    </b>
                  </span>
                  <span>
                    L{" "}
                    <b style={{ color: barUp ? UP_COLOR : DOWN_COLOR }}>
                      {formatNumber(shown.low)}
                    </b>
                  </span>
                  <span>
                    C{" "}
                    <b style={{ color: barUp ? UP_COLOR : DOWN_COLOR }}>
                      {formatNumber(shown.close)}
                    </b>
                  </span>
                  {barChange !== null &&
                    barPct !== null &&
                    settings.display.showBarChange && (
                      <b style={{ color: barUp ? UP_COLOR : DOWN_COLOR }}>
                        {signed(barChange)} ({signed(barPct)}%)
                      </b>
                    )}
                  {shown.volume > 0 && settings.display.showStatusVolume && (
                    <span>
                      Vol{" "}
                      <b className="text-foreground">
                        {formatNumber(shown.volume, 0)}
                      </b>
                    </span>
                  )}
                </div>
              )}
              {compareSymbols.length > 0 && (
                <div className="pointer-events-auto flex flex-wrap gap-1">
                  {compareSymbols.map((entry, index) => (
                    <span
                      key={entry}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-popover/95 px-2 py-0.5 text-[12px] font-semibold"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            COMPARE_COLORS[index % COMPARE_COLORS.length],
                        }}
                      />
                      {entry}
                      <button
                        type="button"
                        aria-label={`Remove ${entry} from comparison`}
                        onClick={() =>
                          setCompareSymbols((current) =>
                            current.filter((item) => item !== entry),
                          )
                        }
                        className="text-muted-foreground hover:text-error"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {!hides.indicators && (
                <div className="pointer-events-auto">
                  <IndicatorLegend
                    instances={indicators.instances}
                    series={indicators.series}
                    activeIndex={shownIndex >= 0 ? shownIndex : undefined}
                    hideActions={!settings.display.paneButtons}
                    onToggleHidden={guardIndicators(indicators.toggleHidden)}
                    onOpenSettings={guardIndicators((instanceId: string) => {
                      setSettingsTab("inputs");
                      setEditingIndicator(instanceId);
                    })}
                    onShowSource={guardIndicators((instanceId: string) => {
                      setInfoIndicator({ instanceId, tab: "source" });
                    })}
                    onOpenMenu={guardIndicators(
                      (instanceId: string, x: number, y: number) => {
                        setMenuIndicator({ instanceId, x, y });
                      },
                    )}
                    onRemove={guardIndicators(indicators.removeIndicator)}
                  />
                </div>
              )}
            </div>

            <FavoritesBar
              tools={favorites.tools}
              active={tool}
              onPick={chooseTool}
              onRemove={(type) =>
                updateFavorites({
                  ...favorites,
                  tools: toggleIn(favorites.tools, type),
                })
              }
            />

            <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2">
              {showPropsBar ? (
                <DrawingPropsBar
                  drawing={selectedDrawing}
                  style={drawingStyle}
                  locked={lockDrawings}
                  canDeleteLocked={settings.alwaysRemoveLocked}
                  onStyleChange={onStyleChange}
                  onDelete={removeSelected}
                  onToggleLock={toggleSelectedLock}
                  onOpenSettings={() => setDrawingSettingsOpen(true)}
                  onOpenObjectTree={() => setObjectTreeOpen(true)}
                  onCreateAlert={(price, drawing) =>
                    setAlertDialog({
                      price,
                      drawing,
                      linePrice:
                        drawing &&
                        supportsTrendlineAlert(drawing.type) &&
                        drawing.points.length > 0
                          ? trendLinePriceAt(
                              drawing.points,
                              Math.floor(Date.now() / 1000),
                            )
                          : null,
                    })
                  }
                  moreMenu={(close) =>
                    selectedDrawing ? (
                      <DrawingMoreMenu
                        drawing={selectedDrawing}
                        onVisualOrder={orderSelected}
                        onVisibility={scopeSelected}
                        onClone={() => cloneSelected(0, 0)}
                        onCopy={() => copyDrawing(selectedDrawing.id)}
                        onHide={hideSelected}
                        close={close}
                      />
                    ) : null
                  }
                />
              ) : null}
              {tool && (
                <p className="pointer-events-none mt-1 rounded-md bg-foreground/90 px-3 py-1 text-center text-[12px] font-medium text-primary-foreground">
                  {getToolDefinition(tool).hint} · Esc to cancel
                </p>
              )}
            </div>

            {replay.mode !== "off" && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
                <ReplayBar
                  mode={replay.mode}
                  playing={replay.playing}
                  speedIndex={replay.speedIndex}
                  atEnd={replay.index >= lastIndex}
                  position={formatBarTime(
                    fullCandles[replay.index],
                    settings.timeframe,
                  )}
                  onTogglePlay={() =>
                    setReplay((current) => ({
                      ...current,
                      playing: !current.playing,
                    }))
                  }
                  onStep={() =>
                    setReplay((current) => ({
                      ...current,
                      index: Math.min(lastIndex, current.index + 1),
                    }))
                  }
                  onSpeed={(speedIndex) =>
                    setReplay((current) => ({ ...current, speedIndex }))
                  }
                  onExit={toggleReplay}
                />
              </div>
            )}

            {statusOverlay && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/90">
                {statusOverlay}
              </div>
            )}
          </div>

          {pineOpen && (
            <PineEditorPanel
              onClose={() => setPineOpen(false)}
              onAddToChart={(definitionId) => {
                const created = indicators.addIndicator(definitionId);
                if (created) {
                  setSettingsTab("inputs");
                  setEditingIndicator(created);
                }
              }}
            />
          )}

          <BottomBar
            activeRange={activeRange}
            onRange={onRange}
            onGoToDate={(iso) =>
              chartRef.current?.scrollToEpoch(
                Date.parse(`${iso}T00:00:00Z`) / 1_000,
              )
            }
            scaleMode={settings.scaleMode}
            onScaleMode={(scaleMode) => patchSettings({ scaleMode })}
            onReset={() => {
              setActiveRange(null);
              chartRef.current?.resetView();
            }}
            countdown={countdown}
            scaleControls={settings.display.scaleButtons}
            scaleMenu={{
              display: settings.display,
              compareActive: compare.length > 0,
              onResetPriceScale: () => chartRef.current?.resetPriceScale(),
              onPatchDisplay: patchDisplay,
              onPriceMode: handlePriceMode,
              onMoreSettings: () => setSettingsOpen(true),
            }}
          />
        </div>

        {settings.panelOpen && (
          <SidePanel
            tab={settings.sidePanel}
            width={settings.panelWidth}
            onWidth={(panelWidth) => patchSettings({ panelWidth })}
            split={settings.watchlistSplit}
            onSplit={(watchlistSplit) => patchSettings({ watchlistSplit })}
            onHide={() => patchSettings({ panelOpen: false })}
            watchlist={
              <WatchlistPanel
                activeSymbol={displaySymbol}
                onSelect={goToSymbol}
              />
            }
            details={
              <SymbolDetailsPanel
                symbol={displaySymbol}
                meta={meta as Omit<ChartDataDTO, "candles"> | null}
                daily={daily.candles}
                dailyLoading={daily.loading}
                info={info}
              />
            }
            alerts={
              <AlertsPanel
                alerts={symbolAlerts}
                localAlerts={localSymbolAlerts}
                onCreate={() =>
                  setAlertDialog({
                    price: null,
                    drawing: null,
                    linePrice: null,
                  })
                }
                onEdit={(id, local) => {
                  setAlertEditTarget({ id, local });
                  setAlertDialog({
                    price: null,
                    drawing: null,
                    linePrice: null,
                  });
                }}
                onChanged={() => {
                  void loadAlerts();
                  setLocalAlerts(readLocalAlerts());
                }}
              />
            }
            log={<AlertLogPanel />}
            objects={
              <ObjectsPanel
                drawings={drawings.drawings}
                indicators={objectTreeIndicators}
                onToggleDrawingHidden={toggleDrawingHiddenById}
                onToggleDrawingLocked={toggleDrawingLockedById}
                onRemoveDrawing={removeDrawingById}
                onToggleIndicatorHidden={toggleIndicatorHidden}
                onEditIndicator={(instanceId) =>
                  setEditingIndicator(instanceId)
                }
                onDuplicateIndicator={(instanceId) =>
                  indicators.duplicateIndicator(instanceId)
                }
                onRemoveIndicator={(instanceId) =>
                  indicators.removeIndicator(instanceId)
                }
              />
            }
            data={
              <DataPanel
                symbol={displaySymbol}
                candles={candles}
                activeIndex={shownIndex >= 0 ? shownIndex : null}
                instances={visibleInstances}
                series={indicators.series}
              />
            }
            screener={<ScreenerPanel onSelect={goToSymbol} />}
            calendar={<CalendarPanel onSelect={goToSymbol} />}
            news={<NewsPanel symbol={displaySymbol} />}
          />
        )}
        <RightRail
          starred={favorites.products}
          onToggleStar={(id) =>
            updateFavorites({
              ...favorites,
              products: toggleIn(favorites.products, id),
            })
          }
          activeTab={settings.sidePanel}
          panelOpen={settings.panelOpen}
          pineOpen={pineOpen}
          onPine={() => setPineOpen((current) => !current)}
          onTab={(sidePanel) =>
            patchSettings(
              sidePanel === settings.sidePanel && settings.panelOpen
                ? { panelOpen: false }
                : { sidePanel, panelOpen: true },
            )
          }
        />
      </div>

      <SymbolSearchDialog
        open={searchMode !== null}
        title={searchMode === "compare" ? "Compare symbol" : "Symbol search"}
        onSelect={onSearchSelect}
        onClose={() => setSearchMode(null)}
      />
      <IndicatorPicker
        open={pickerOpen}
        onSelect={(definitionId) => {
          const created = indicators.addIndicator(definitionId);
          if (created) setEditingIndicator(created);
        }}
        onSelectMultiple={(definitionIds) => {
          let last: string | null = null;
          for (const definitionId of definitionIds) {
            last = indicators.addIndicator(definitionId) ?? last;
          }
          if (last) setEditingIndicator(last);
        }}
        symbol={displaySymbol}
        hasFundamentals={info !== null}
        onClose={() => setPickerOpen(false)}
        onCreateScript={() => {
          setPickerOpen(false);
          setPineOpen(true);
        }}
      />
      {editingInstance && (
        <IndicatorSettingsDialog
          key={`${editingInstance.instanceId}:${settingsTab}`}
          instance={editingInstance}
          initialTab={settingsTab}
          onApply={guardIndicators(indicators.updateIndicator)}
          onClose={() => setEditingIndicator(null)}
          onSaveAsDefault={indicators.saveAsDefault}
          onClearDefault={indicators.clearDefault}
        />
      )}
      {menuIndicator &&
        indicators.getInstance(menuIndicator.instanceId) && (
          <div
            className="fixed inset-0 z-[75]"
            onMouseDown={() => setMenuIndicator(null)}
          >
            <IndicatorMenu
              instance={
                indicators.getInstance(menuIndicator.instanceId)!
              }
              isFavorite={loadIndicatorFavorites().includes(
                indicators.getInstance(menuIndicator.instanceId)!
                  .definitionId,
              )}
              x={menuIndicator.x}
              y={menuIndicator.y}
              onAction={(action) =>
                handleIndicatorMenuAction(menuIndicator.instanceId, action)
              }
              onToggleUnit={(unit, enabled) =>
                guardIndicators(indicators.updateIndicator)(
                  withVisibility(
                    indicators.getInstance(menuIndicator.instanceId)!,
                    unit,
                    enabled,
                  ),
                )
              }
              onReorder={(direction) =>
                guardIndicators(indicators.moveIndicator)(
                  menuIndicator.instanceId,
                  direction,
                )
              }
              onMoveTo={(pane) =>
                guardIndicators(indicators.updateIndicator)(
                  withPaneOverride(
                    indicators.getInstance(menuIndicator.instanceId)!,
                    pane,
                  ),
                )
              }
              onPinScale={(side) =>
                guardIndicators(indicators.updateIndicator)(
                  withScaleSide(
                    indicators.getInstance(menuIndicator.instanceId)!,
                    side,
                  ),
                )
              }
              onClose={() => setMenuIndicator(null)}
            />
          </div>
        )}
      {infoIndicator && indicators.getInstance(infoIndicator.instanceId) && (
        <IndicatorInfoDialog
          instance={indicators.getInstance(infoIndicator.instanceId)!}
          initialTab={infoIndicator.tab}
          onClose={() => setInfoIndicator(null)}
          onOpenSettings={() => {
            setSettingsTab("inputs");
            setEditingIndicator(infoIndicator.instanceId);
          }}
        />
      )}
      {alertDialog && quote && (
        <PriceAlertDialog
          symbol={displaySymbol}
          displayName={meta?.displayName ?? displaySymbol}
          lastPrice={quote.lastPrice}
          context={alertDraftContext}
          alerts={symbolAlerts}
          localAlerts={localSymbolAlerts}
          drawingIds={drawings.drawings.map((drawing) => drawing.id)}
          editTarget={alertEditTarget}
          onClose={() => {
            setAlertDialog(null);
            setAlertEditTarget(null);
          }}
          onChanged={() => {
            void loadAlerts();
            setLocalAlerts(readLocalAlerts());
          }}
        />
      )}
      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          className="fixed z-[75]"
          style={{
            top: Math.max(8, Math.min(ctxMenu.y, window.innerHeight - 430)),
            left: Math.max(8, Math.min(ctxMenu.x, window.innerWidth - 340)),
          }}
        >
          {ctxMenu.area === "scale" ? (
            <div
              role="menu"
              className="max-h-[calc(100vh-16px)] overflow-y-auto rounded-lg border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
            >
              <PriceScaleMenu
                priceAutoScale={settings.display.priceAutoScale}
                ratioLocked={settings.display.lockPriceBarRatio}
                ratioLabel={
                  settings.display.lockPriceBarRatio &&
                  settings.display.pricePerBar > 0
                    ? settings.display.pricePerBar.toFixed(4)
                    : null
                }
                scalePriceOnly={settings.display.scalePriceOnly}
                invertScale={settings.display.invertScale}
                activeMode={
                  compare.length > 0
                    ? "percent"
                    : settings.display.priceScaleMode
                }
                scaleOnLeft={settings.display.scalePlacement === "left"}
                lastValue={settings.display.lastValue}
                highLowLabels={settings.display.highLow === "value-line"}
                countdown={settings.display.showCountdown}
                horzGrid={settings.display.showHorzGrid}
                vertGrid={settings.display.showVertGrid}
                onResetScale={() => chartRef.current?.resetPriceScale()}
                onToggleAuto={() =>
                  patchDisplay({
                    priceAutoScale: !settings.display.priceAutoScale,
                  })
                }
                onToggleRatioLock={() => {
                  if (settings.display.lockPriceBarRatio) {
                    patchDisplay({ lockPriceBarRatio: false });
                  } else {
                    patchDisplay({
                      lockPriceBarRatio: true,
                      priceAutoScale: false,
                      pricePerBar: 0,
                    });
                  }
                }}
                onTogglePriceOnly={() =>
                  patchDisplay({
                    scalePriceOnly: !settings.display.scalePriceOnly,
                  })
                }
                onToggleInvert={() =>
                  patchDisplay({ invertScale: !settings.display.invertScale })
                }
                onMode={handlePriceMode}
                onMoveScale={() =>
                  patchDisplay({
                    scalePlacement:
                      settings.display.scalePlacement === "left"
                        ? "right"
                        : "left",
                  })
                }
                onLastValue={(mode) => patchDisplay({ lastValue: mode })}
                onHighLowLabels={(on) =>
                  patchDisplay({ highLow: on ? "value-line" : "hidden" })
                }
                onCountdown={(on) => patchDisplay({ showCountdown: on })}
                onHorzGrid={(on) => patchDisplay({ showHorzGrid: on })}
                onVertGrid={(on) => patchDisplay({ showVertGrid: on })}
                onMoreSettings={() => setSettingsOpen(true)}
                close={() => setCtxMenu(null)}
              />
            </div>
          ) : menuDrawing ? (
            <div
              role="menu"
              className="max-h-[calc(100vh-16px)] overflow-y-auto rounded-lg border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
            >
              <DrawingMoreMenu
                drawing={menuDrawing}
                onVisualOrder={(direction) =>
                  orderDrawingById(menuDrawing.id, direction)
                }
                onVisibility={(scope) =>
                  scopeDrawingById(menuDrawing.id, scope)
                }
                onClone={() => cloneDrawingById(menuDrawing.id, 0, 0)}
                onCopy={() => copyDrawing(menuDrawing.id)}
                onHide={() => hideDrawingById(menuDrawing.id)}
                close={() => setCtxMenu(null)}
              />
            </div>
          ) : (
            <div
              role="menu"
              className="max-h-[calc(100vh-16px)] overflow-y-auto rounded-lg border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
            >
              <ChartCanvasMenu
                symbol={displaySymbol}
                price={ctxMenu.price}
                drawingCount={drawings.drawings.length}
                indicatorCount={indicators.instances.length}
                hasClipboard={copiedDrawing !== null}
                templates={layouts.map((entry) => ({ name: entry.name }))}
                onResetView={() => {
                  setActiveRange(null);
                  chartRef.current?.resetView();
                }}
                onCopyPrice={() => {
                  const value = ctxMenu.price;
                  if (value === null) return;
                  try {
                    void navigator.clipboard?.writeText(formatNumber(value));
                    toast.success("Price copied.");
                  } catch {
                    toast(`Price: ${formatNumber(value)}`);
                  }
                }}
                onPaste={() =>
                  pasteDrawingAt(
                    ctxMenu.time !== null && ctxMenu.price !== null
                      ? { t: ctxMenu.time, p: ctxMenu.price }
                      : null,
                  )
                }
                onAddAlert={() => {
                  if (ctxMenu.price === null) return;
                  setAlertDialog({
                    price: ctxMenu.price,
                    drawing: null,
                    linePrice: null,
                  });
                }}
                onSellLimit={() => {
                  if (ctxMenu.price === null) return;
                  setOrderTicket({
                    side: "sell",
                    orderType: "limit",
                    price: ctxMenu.price,
                  });
                }}
                onBuyStop={() => {
                  if (ctxMenu.price === null) return;
                  setOrderTicket({
                    side: "buy",
                    orderType: "stop",
                    price: ctxMenu.price,
                  });
                }}
                onAddOrder={() => {
                  if (ctxMenu.price === null) return;
                  setOrderTicket({
                    side: "buy",
                    orderType: "limit",
                    price: ctxMenu.price,
                  });
                }}
                onLockCursorLine={lockCursorLine}
                onTableView={() => setDataWindowOpen(true)}
                onObjectTree={() => setObjectTreeOpen(true)}
                onApplyTemplate={loadLayout}
                onSaveTemplate={saveLayout}
                onDeleteTemplate={deleteLayout}
                onRemoveDrawings={() => removeObjects("drawings")}
                onRemoveIndicators={() => removeObjects("indicators")}
                onOpenSettings={() => setSettingsOpen(true)}
                close={() => setCtxMenu(null)}
              />
            </div>
          )}
        </div>
      )}
      {drawingSettingsOpen && selectedDrawing && (
        <DrawingSettingsDialog
          drawing={selectedDrawing}
          timeframe={settings.timeframe}
          onApply={(next) => {
            if (lockDrawings || selectedDrawing.locked) {
              toast("This drawing is locked. Unlock it first.");
              return;
            }
            drawings.replace(next);
          }}
          onClose={() => setDrawingSettingsOpen(false)}
        />
      )}
      {objectTreeOpen && (
        <ObjectTreeDialog
          drawings={drawings.drawings}
          indicators={objectTreeIndicators}
          onToggleDrawingHidden={toggleDrawingHiddenById}
          onToggleDrawingLocked={toggleDrawingLockedById}
          onRemoveDrawing={removeDrawingById}
          onToggleIndicatorHidden={toggleIndicatorHidden}
          onEditIndicator={(instanceId) => setEditingIndicator(instanceId)}
          onDuplicateIndicator={(instanceId) =>
            indicators.duplicateIndicator(instanceId)
          }
          onRemoveIndicator={(instanceId) =>
            indicators.removeIndicator(instanceId)
          }
          onClose={() => setObjectTreeOpen(false)}
        />
      )}
      {dataWindowOpen && (
        <DataWindowDialog
          symbol={displaySymbol}
          candles={fullCandles}
          onClose={() => setDataWindowOpen(false)}
        />
      )}
      {orderTicket && (
        <OrderTicketDialog
          symbol={displaySymbol}
          displayName={meta?.displayName ?? displaySymbol}
          side={orderTicket.side}
          orderType={orderTicket.orderType}
          price={orderTicket.price}
          onClose={() => setOrderTicket(null)}
        />
      )}
      {settingsOpen && (
        <ChartSettingsDialog
          initial={settings.display}
          onApply={(display) => {
            patchSettings({ display });
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

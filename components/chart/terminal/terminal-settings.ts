import { queuePush } from "./chart-sync";
import type { CursorKind } from "./tool-icons";
import { isChartStyle, type ChartStyle } from "@/lib/chart/chart-styles";
import {
  DEFAULT_DISPLAY_SETTINGS,
  sanitizeDisplaySettings,
  type ChartDisplaySettings,
  type PriceScaleMode,
} from "@/lib/chart/display-settings";
import {
  isChartTimeframe,
  type ChartTimeframe,
} from "@/lib/market/chart-candles";

export type MagnetMode = "off" | "weak" | "strong";

export type ScaleMode = "auto" | "log" | "percent";

/** Dockable side-panel tab, mirroring the TradingView right rail. */
export type SidePanelTab =
  | "watchlist"
  | "details"
  | "alerts"
  | "objects"
  | "screener"
  | "calendar"
  | "news";

const SIDE_PANEL_TABS: readonly SidePanelTab[] = [
  "watchlist",
  "details",
  "alerts",
  "objects",
  "screener",
  "calendar",
  "news",
];

export function isSidePanelTab(value: unknown): value is SidePanelTab {
  return (
    typeof value === "string" &&
    (SIDE_PANEL_TABS as readonly string[]).includes(value)
  );
}

/**
 * Engine scale implied by a price-axis menu mode. Percent and log drive the
 * engine scale, regular resets it to auto, and indexed leaves it untouched
 * (null) so both the bottom-bar and right-click menus stay in sync.
 */
export function engineScaleForPriceMode(
  mode: PriceScaleMode,
): ScaleMode | null {
  if (mode === "percent") return "percent";
  if (mode === "log") return "log";
  if (mode === "regular") return "auto";
  return null;
}

export const PANEL_WIDTH_MIN = 240;
export const PANEL_WIDTH_MAX = 600;
export const PANEL_WIDTH_DEFAULT = 320;

export function clampPanelWidth(value: unknown): number {
  const numeric = typeof value === "number" ? value : PANEL_WIDTH_DEFAULT;
  if (!Number.isFinite(numeric)) return PANEL_WIDTH_DEFAULT;
  return Math.min(
    PANEL_WIDTH_MAX,
    Math.max(PANEL_WIDTH_MIN, Math.round(numeric)),
  );
}

/** Share of the watchlist tab's height the watchlist takes (details get the rest). */
export const WATCHLIST_SPLIT_MIN = 0.15;
export const WATCHLIST_SPLIT_MAX = 0.85;
export const WATCHLIST_SPLIT_DEFAULT = 0.55;

export function clampWatchlistSplit(value: unknown): number {
  const numeric = typeof value === "number" ? value : WATCHLIST_SPLIT_DEFAULT;
  if (!Number.isFinite(numeric)) return WATCHLIST_SPLIT_DEFAULT;
  return Math.min(WATCHLIST_SPLIT_MAX, Math.max(WATCHLIST_SPLIT_MIN, Math.round(numeric * 1000) / 1000));
}

export interface TerminalSettings {
  readonly style: ChartStyle;
  readonly timeframe: ChartTimeframe;
  readonly scaleMode: ScaleMode;
  readonly showVolume: boolean;
  readonly showGrid: boolean;
  readonly showPrevClose: boolean;
  readonly panelOpen: boolean;
  readonly sidePanel: SidePanelTab;
  /** Docked side-panel width in pixels; resizable by dragging its edge. */
  readonly panelWidth: number;
  /** Watchlist vs details height split, dragged at the divider between them. */
  readonly watchlistSplit: number;
  readonly magnet: MagnetMode;
  readonly snapIndicators: boolean;
  readonly valuesTooltip: boolean;
  readonly alwaysRemoveLocked: boolean;
  readonly magnetNoticeSeen: boolean;
  readonly keepDrawing: boolean;
  readonly cursor: CursorKind;
  /** Chart appearance preferences from the Settings dialog. */
  readonly display: ChartDisplaySettings;
}

export const DEFAULT_SETTINGS: TerminalSettings = {
  style: "candles",
  timeframe: "D",
  scaleMode: "auto",
  showVolume: true,
  showGrid: true,
  showPrevClose: true,
  panelOpen: true,
  sidePanel: "watchlist",
  panelWidth: PANEL_WIDTH_DEFAULT,
  watchlistSplit: WATCHLIST_SPLIT_DEFAULT,
  magnet: "off",
  snapIndicators: false,
  valuesTooltip: true,
  alwaysRemoveLocked: false,
  magnetNoticeSeen: false,
  keepDrawing: false,
  cursor: "cross",
  display: DEFAULT_DISPLAY_SETTINGS,
};

const SETTINGS_KEY = "chart:terminal:settings:v1";
const LAYOUTS_KEY = "chart:terminal:layouts:v1";

export interface SavedLayout {
  readonly name: string;
  readonly savedAt: string;
  readonly settings: TerminalSettings;
}

export function sanitizeSettings(value: unknown): TerminalSettings {
  if (typeof value !== "object" || value === null) return DEFAULT_SETTINGS;
  const input = value as Record<string, unknown>;
  const flag = (key: keyof TerminalSettings): boolean =>
    typeof input[key] === "boolean"
      ? (input[key] as boolean)
      : (DEFAULT_SETTINGS[key] as boolean);
  return {
    style: isChartStyle(input.style) ? input.style : DEFAULT_SETTINGS.style,
    timeframe:
      typeof input.timeframe === "string" && isChartTimeframe(input.timeframe)
        ? input.timeframe
        : DEFAULT_SETTINGS.timeframe,
    scaleMode:
      input.scaleMode === "log" || input.scaleMode === "percent"
        ? input.scaleMode
        : "auto",
    showVolume: flag("showVolume"),
    showGrid: flag("showGrid"),
    showPrevClose: flag("showPrevClose"),
    panelOpen: flag("panelOpen"),
    sidePanel: isSidePanelTab(input.sidePanel)
      ? input.sidePanel
      : DEFAULT_SETTINGS.sidePanel,
    panelWidth: clampPanelWidth(input.panelWidth),
    watchlistSplit: clampWatchlistSplit(input.watchlistSplit),
    // Older saves stored the magnet as a boolean.
    magnet:
      input.magnet === "weak" || input.magnet === "strong"
        ? input.magnet
        : input.magnet === true
          ? "strong"
          : "off",
    snapIndicators: flag("snapIndicators"),
    valuesTooltip: flag("valuesTooltip"),
    alwaysRemoveLocked: flag("alwaysRemoveLocked"),
    magnetNoticeSeen: flag("magnetNoticeSeen"),
    keepDrawing: flag("keepDrawing"),
    cursor:
      input.cursor === "dot" ||
      input.cursor === "arrow" ||
      input.cursor === "demo" ||
      input.cursor === "eraser"
        ? input.cursor
        : "cross",
    display: sanitizeDisplaySettings(input.display),
  };
}

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preferences are cosmetic; ignore a full or blocked storage.
  }
}

export function loadSettings(): TerminalSettings {
  return sanitizeSettings(readJson(SETTINGS_KEY));
}

export function saveSettings(settings: TerminalSettings): void {
  writeJson(SETTINGS_KEY, settings);
  queuePush("settings", settings);
}

export function loadLayouts(): SavedLayout[] {
  const stored = readJson(LAYOUTS_KEY);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter(
      (entry): entry is { name: string; savedAt: string; settings: unknown } =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as SavedLayout).name === "string",
    )
    .map((entry) => ({
      name: entry.name,
      savedAt: typeof entry.savedAt === "string" ? entry.savedAt : "",
      settings: sanitizeSettings(entry.settings),
    }));
}

export function saveLayouts(layouts: readonly SavedLayout[]): void {
  writeJson(LAYOUTS_KEY, layouts);
  queuePush("layouts", layouts);
}

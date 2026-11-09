import type { PriceFormat } from "lightweight-charts";
import type { ChartCandle, ChartTimeframe } from "@/lib/market/chart-candles";

/**
 * Chart appearance preferences behind the terminal Settings dialog. Every
 * field maps to a real lightweight-charts option or a real terminal overlay;
 * options with no data or engine backing are deliberately absent.
 */
export type TitleMode = "name" | "symbol";
export type ButtonVisibility = "always" | "hover" | "hidden";
export type LastValueMode = "value-line" | "value" | "line" | "hidden";
export type HighLowMode = "hidden" | "value-line";
export type CrosshairDash = "solid" | "dashed" | "dotted";
export type AlertSoundName = "alarm" | "chime";
export type ScalePlacement = "right" | "left";
export type HoursFormat = "24" | "12";
export type PriceScaleMode = "regular" | "percent" | "indexed" | "log";

export interface ChartDisplaySettings {
  // ── Symbol ──
  readonly colorByPrevClose: boolean;
  readonly bodyUp: string;
  readonly bodyDown: string;
  readonly showBorder: boolean;
  readonly borderUp: string;
  readonly borderDown: string;
  readonly showWick: boolean;
  readonly wickUp: string;
  readonly wickDown: string;
  readonly precision: number;
  readonly timezone: string;
  // ── Status line ──
  readonly showLogo: boolean;
  readonly titleMode: TitleMode;
  readonly showChartValues: boolean;
  readonly showBarChange: boolean;
  readonly showStatusVolume: boolean;
  readonly showDayChange: boolean;
  readonly showBuySell: boolean;
  readonly statusOpacity: number;
  // ── Scales and lines ──
  readonly showCurrency: boolean;
  readonly scaleButtons: ButtonVisibility;
  readonly scalePlacement: ScalePlacement;
  readonly showCountdown: boolean;
  /** Price-axis scale mode behind the axis context menu. */
  readonly priceScaleMode: PriceScaleMode;
  /** Fit bars into view on every update. */
  readonly priceAutoScale: boolean;
  readonly invertScale: boolean;
  /** Axis drags scale price only, never time. */
  readonly scalePriceOnly: boolean;
  /** Hold the price-per-bar ratio while zooming. */
  readonly lockPriceBarRatio: boolean;
  /** Captured ratio while the lock is on (price units per bar). */
  readonly pricePerBar: number;
  readonly lastValue: LastValueMode;
  readonly highLow: HighLowMode;
  readonly showDayOfWeek: boolean;
  readonly dateFormat: string;
  readonly hoursFormat: HoursFormat;
  readonly keepLeftEdge: boolean;
  // ── Canvas ──
  readonly canvasBackground: string;
  readonly showVertGrid: boolean;
  readonly showHorzGrid: boolean;
  readonly crosshairColor: string;
  readonly crosshairStyle: CrosshairDash;
  readonly watermark: boolean;
  readonly watermarkColor: string;
  readonly axisTextColor: string;
  readonly axisFontSize: number;
  readonly axisLineColor: string;
  readonly navButtons: ButtonVisibility;
  readonly paneButtons: boolean;
  readonly marginTop: number;
  readonly marginBottom: number;
  readonly marginRightBars: number;
  // ── Trading ──
  readonly executionSound: boolean;
  readonly soundName: AlertSoundName;
  readonly showPositions: boolean;
  // ── Alerts ──
  readonly showAlertLines: boolean;
  readonly onlyActiveAlerts: boolean;
  readonly alertLineColor: string;
  readonly alertVolume: number;
  readonly autoHideToasts: boolean;
}

export const DEFAULT_DISPLAY_SETTINGS: ChartDisplaySettings = {
  colorByPrevClose: false,
  bodyUp: "#089981",
  bodyDown: "#F23645",
  showBorder: true,
  borderUp: "#089981",
  borderDown: "#F23645",
  showWick: true,
  wickUp: "#089981",
  wickDown: "#F23645",
  precision: 2,
  timezone: "Asia/Kolkata",
  showLogo: true,
  titleMode: "name",
  showChartValues: true,
  showBarChange: true,
  showStatusVolume: true,
  showDayChange: true,
  showBuySell: true,
  statusOpacity: 100,
  showCurrency: false,
  scaleButtons: "always",
  scalePlacement: "right",
  showCountdown: true,
  priceScaleMode: "regular",
  priceAutoScale: true,
  invertScale: false,
  scalePriceOnly: false,
  lockPriceBarRatio: false,
  pricePerBar: 0,
  lastValue: "value-line",
  highLow: "hidden",
  showDayOfWeek: true,
  dateFormat: "auto",
  hoursFormat: "24",
  keepLeftEdge: false,
  canvasBackground: "#FFFFFF",
  showVertGrid: true,
  showHorzGrid: true,
  crosshairColor: "#758696",
  crosshairStyle: "dashed",
  watermark: false,
  watermarkColor: "#E0E3EB",
  axisTextColor: "#434651",
  axisFontSize: 12,
  axisLineColor: "#E0E3EB",
  navButtons: "hover",
  paneButtons: true,
  marginTop: 8,
  marginBottom: 22,
  marginRightBars: 6,
  executionSound: false,
  soundName: "alarm",
  showPositions: true,
  showAlertLines: true,
  onlyActiveAlerts: false,
  alertLineColor: "#FF9800",
  alertVolume: 60,
  autoHideToasts: true,
};

export const TIMEZONES: readonly {
  readonly value: string;
  readonly label: string;
}[] = [
  { value: "Asia/Kolkata", label: "(UTC+5:30) Kolkata" },
  { value: "UTC", label: "(UTC) Coordinated Universal Time" },
  { value: "Europe/London", label: "(UTC+0/+1) London" },
  { value: "America/New_York", label: "(UTC-5/-4) New York" },
  { value: "Asia/Tokyo", label: "(UTC+9) Tokyo" },
  { value: "Australia/Sydney", label: "(UTC+10/+11) Sydney" },
];

export const DATE_FORMATS: readonly {
  readonly value: string;
  readonly label: string;
}[] = [
  { value: "auto", label: "Default" },
  { value: "dMMMyy", label: "29 Sep '97" },
  { value: "Mdy", label: "Sep 29, 2026" },
  { value: "dM", label: "29 Sep" },
  { value: "iso", label: "2026-09-29" },
  { value: "dmy", label: "29/09/2026" },
];

export const ALERT_SOUNDS: readonly {
  readonly value: AlertSoundName;
  readonly label: string;
}[] = [
  { value: "alarm", label: "Alarm Clock" },
  { value: "chime", label: "Chime" },
];

export function isIntraday(timeframe: ChartTimeframe): boolean {
  return (
    timeframe === "1" ||
    timeframe === "5" ||
    timeframe === "15" ||
    timeframe === "60"
  );
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberIn(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" &&
    (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function timezone(value: unknown): string {
  if (
    typeof value === "string" &&
    TIMEZONES.some((entry) => entry.value === value)
  ) {
    return value;
  }
  return DEFAULT_DISPLAY_SETTINGS.timezone;
}

/** Old or hand-edited saves fall back to defaults field by field. */
export function sanitizeDisplaySettings(value: unknown): ChartDisplaySettings {
  const fallback = DEFAULT_DISPLAY_SETTINGS;
  if (typeof value !== "object" || value === null) return fallback;
  const input = value as Record<string, unknown>;
  return {
    colorByPrevClose: flag(input.colorByPrevClose, fallback.colorByPrevClose),
    bodyUp: color(input.bodyUp, fallback.bodyUp),
    bodyDown: color(input.bodyDown, fallback.bodyDown),
    showBorder: flag(input.showBorder, fallback.showBorder),
    borderUp: color(input.borderUp, fallback.borderUp),
    borderDown: color(input.borderDown, fallback.borderDown),
    showWick: flag(input.showWick, fallback.showWick),
    wickUp: color(input.wickUp, fallback.wickUp),
    wickDown: color(input.wickDown, fallback.wickDown),
    precision: numberIn(input.precision, fallback.precision, 0, 8),
    timezone: timezone(input.timezone),
    showLogo: flag(input.showLogo, fallback.showLogo),
    titleMode: oneOf(input.titleMode, ["name", "symbol"], fallback.titleMode),
    showChartValues: flag(input.showChartValues, fallback.showChartValues),
    showBarChange: flag(input.showBarChange, fallback.showBarChange),
    showStatusVolume: flag(input.showStatusVolume, fallback.showStatusVolume),
    showDayChange: flag(input.showDayChange, fallback.showDayChange),
    showBuySell: flag(input.showBuySell, fallback.showBuySell),
    statusOpacity: numberIn(
      input.statusOpacity,
      fallback.statusOpacity,
      0,
      100,
    ),
    showCurrency: flag(input.showCurrency, fallback.showCurrency),
    scaleButtons: oneOf(
      input.scaleButtons,
      ["always", "hover", "hidden"],
      fallback.scaleButtons,
    ),
    scalePlacement: oneOf(
      input.scalePlacement,
      ["right", "left"],
      fallback.scalePlacement,
    ),
    showCountdown: flag(input.showCountdown, fallback.showCountdown),
    priceScaleMode: oneOf(
      input.priceScaleMode,
      ["regular", "percent", "indexed", "log"],
      fallback.priceScaleMode,
    ),
    priceAutoScale: flag(input.priceAutoScale, fallback.priceAutoScale),
    invertScale: flag(input.invertScale, fallback.invertScale),
    scalePriceOnly: flag(input.scalePriceOnly, fallback.scalePriceOnly),
    lockPriceBarRatio: flag(
      input.lockPriceBarRatio,
      fallback.lockPriceBarRatio,
    ),
    pricePerBar:
      typeof input.pricePerBar === "number" &&
      Number.isFinite(input.pricePerBar) &&
      input.pricePerBar >= 0
        ? input.pricePerBar
        : fallback.pricePerBar,
    lastValue: oneOf(
      input.lastValue,
      ["value-line", "value", "line", "hidden"],
      fallback.lastValue,
    ),
    highLow: oneOf(input.highLow, ["hidden", "value-line"], fallback.highLow),
    showDayOfWeek: flag(input.showDayOfWeek, fallback.showDayOfWeek),
    dateFormat: DATE_FORMATS.some((entry) => entry.value === input.dateFormat)
      ? (input.dateFormat as string)
      : fallback.dateFormat,
    hoursFormat: oneOf(input.hoursFormat, ["24", "12"], fallback.hoursFormat),
    keepLeftEdge: flag(input.keepLeftEdge, fallback.keepLeftEdge),
    canvasBackground: color(input.canvasBackground, fallback.canvasBackground),
    showVertGrid: flag(input.showVertGrid, fallback.showVertGrid),
    showHorzGrid: flag(input.showHorzGrid, fallback.showHorzGrid),
    crosshairColor: color(input.crosshairColor, fallback.crosshairColor),
    crosshairStyle: oneOf(
      input.crosshairStyle,
      ["solid", "dashed", "dotted"],
      fallback.crosshairStyle,
    ),
    watermark: flag(input.watermark, fallback.watermark),
    watermarkColor: color(input.watermarkColor, fallback.watermarkColor),
    axisTextColor: color(input.axisTextColor, fallback.axisTextColor),
    axisFontSize: numberIn(input.axisFontSize, fallback.axisFontSize, 9, 20),
    axisLineColor: color(input.axisLineColor, fallback.axisLineColor),
    navButtons: oneOf(
      input.navButtons,
      ["always", "hover", "hidden"],
      fallback.navButtons,
    ),
    paneButtons: flag(input.paneButtons, fallback.paneButtons),
    marginTop: numberIn(input.marginTop, fallback.marginTop, 0, 40),
    marginBottom: numberIn(input.marginBottom, fallback.marginBottom, 0, 60),
    marginRightBars: numberIn(
      input.marginRightBars,
      fallback.marginRightBars,
      0,
      30,
    ),
    executionSound: flag(input.executionSound, fallback.executionSound),
    soundName: oneOf(input.soundName, ["alarm", "chime"], fallback.soundName),
    showPositions: flag(input.showPositions, fallback.showPositions),
    showAlertLines: flag(input.showAlertLines, fallback.showAlertLines),
    onlyActiveAlerts: flag(input.onlyActiveAlerts, fallback.onlyActiveAlerts),
    alertLineColor: color(input.alertLineColor, fallback.alertLineColor),
    alertVolume: numberIn(input.alertVolume, fallback.alertVolume, 0, 100),
    autoHideToasts: flag(input.autoHideToasts, fallback.autoHideToasts),
  };
}

export interface DisplayTemplate {
  readonly name: string;
  readonly savedAt: string;
  readonly settings: ChartDisplaySettings;
}

const TEMPLATES_KEY = "chart:terminal:display-templates:v1";

function readTemplatesRaw(): unknown {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function loadDisplayTemplates(): DisplayTemplate[] {
  const stored = readTemplatesRaw();
  if (!Array.isArray(stored)) return [];
  return stored
    .filter(
      (entry): entry is { name: string; savedAt: string; settings: unknown } =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as DisplayTemplate).name === "string",
    )
    .map((entry) => ({
      name: entry.name,
      savedAt: typeof entry.savedAt === "string" ? entry.savedAt : "",
      settings: sanitizeDisplaySettings(entry.settings),
    }));
}

function writeTemplates(templates: readonly DisplayTemplate[]): void {
  try {
    window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // Templates are convenience; a full or blocked storage must not break
    // the dialog.
  }
}

export function saveDisplayTemplate(
  name: string,
  settings: ChartDisplaySettings,
): DisplayTemplate[] {
  const next = [
    ...loadDisplayTemplates().filter((entry) => entry.name !== name),
    { name, savedAt: new Date().toISOString(), settings },
  ];
  writeTemplates(next);
  return next;
}

export function deleteDisplayTemplate(name: string): DisplayTemplate[] {
  const next = loadDisplayTemplates().filter((entry) => entry.name !== name);
  writeTemplates(next);
  return next;
}

// ── lightweight-charts option mappers (pure, unit-tested) ────────────────

export interface CandlePalette {
  readonly upColor: string;
  readonly downColor: string;
  readonly borderVisible: boolean;
  readonly borderUpColor: string;
  readonly borderDownColor: string;
  readonly wickVisible: boolean;
  readonly wickUpColor: string;
  readonly wickDownColor: string;
}

export function candlePalette(display: ChartDisplaySettings): CandlePalette {
  return {
    upColor: display.bodyUp,
    downColor: display.bodyDown,
    borderVisible: display.showBorder,
    borderUpColor: display.borderUp,
    borderDownColor: display.borderDown,
    wickVisible: display.showWick,
    wickUpColor: display.wickUp,
    wickDownColor: display.wickDown,
  };
}

/** `#rrggbb` with an alpha channel; opaque and non-hex pass through. */
export function withAlpha(colorValue: string, alpha: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(colorValue);
  if (!match || alpha >= 1) return colorValue;
  const value = parseInt(match[1]!, 16);
  const clamped = Math.min(1, Math.max(0, alpha));
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${clamped})`;
}

/** Volume bars follow the candle body colors at 45% opacity. */
export function volumeColor(
  up: boolean,
  display: ChartDisplaySettings,
): string {
  return withAlpha(up ? display.bodyUp : display.bodyDown, 0.45);
}

export interface PrevCloseTint {
  readonly color: string;
  readonly borderColor: string;
  readonly wickColor: string;
}

/**
 * Per-bar colors when "color bars based on previous close" is on: a bar is
 * up when its close beats the previous bar's close.
 */
export function prevCloseTints(
  closes: readonly number[],
  display: ChartDisplaySettings,
): PrevCloseTint[] {
  return closes.map((close, index) => {
    const previous = index === 0 ? close : closes[index - 1]!;
    const up = close >= previous;
    return {
      color: up ? display.bodyUp : display.bodyDown,
      borderColor: up ? display.borderUp : display.borderDown,
      wickColor: up ? display.wickUp : display.wickDown,
    };
  });
}

export type MainPriceFormat = PriceFormat;

export function priceFormatter(
  precision: number,
  currency: string | null,
): (price: number) => string {
  return (price: number) =>
    `${price.toFixed(precision)}${currency ? ` ${currency}` : ""}`;
}

/** Precision always applies; the ₹ suffix only when enabled. */
export function mainPriceFormat(
  display: ChartDisplaySettings,
  currency: string | null,
): MainPriceFormat {
  const minMove = 1 / 10 ** display.precision;
  if (display.showCurrency && currency) {
    return {
      type: "custom",
      minMove,
      formatter: priceFormatter(display.precision, currency),
    };
  }
  return { type: "price", precision: display.precision, minMove };
}

export interface AxisLabelParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function tickDateParts(timezone: string, date: Date): AxisLabelParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string): number => {
    const found = parts.find((part) => part.type === type);
    return found ? Number(found.value) : 0;
  };
  return { year: get("year"), month: get("month"), day: get("day") };
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatTickDate(
  date: Date,
  display: ChartDisplaySettings,
): string {
  const { year, month, day } = tickDateParts(display.timezone, date);
  const name = SHORT_MONTHS[Math.min(11, Math.max(0, month - 1))]!;
  const pad = (value: number): string => String(value).padStart(2, "0");
  let label: string;
  switch (display.dateFormat) {
    case "dMMMyy":
      label = `${day} ${name} '${String(year).slice(2)}`;
      break;
    case "Mdy":
      label = `${name} ${day}, ${year}`;
      break;
    case "dM":
      label = `${day} ${name}`;
      break;
    case "iso":
      label = `${year}-${pad(month)}-${pad(day)}`;
      break;
    case "dmy":
      label = `${pad(day)}/${pad(month)}/${year}`;
      break;
    default:
      label = `${day} ${name} '${String(year).slice(2)}`;
      break;
  }
  if (display.showDayOfWeek) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return `${SHORT_DAYS[weekday]} ${label}`;
  }
  return label;
}

export function formatTickTime(
  date: Date,
  display: ChartDisplaySettings,
): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: display.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: display.hoursFormat === "12" ? "h12" : "h23",
  }).format(date);
  return display.hoursFormat === "12" ? formatted.toUpperCase() : formatted;
}

export type TickInput =
  | { readonly year: number; readonly month: number; readonly day: number }
  | number
  | string;

function tickDate(input: TickInput): Date | null {
  if (typeof input === "number") return new Date(input * 1000);
  if (typeof input === "string") {
    const parsed = Date.parse(`${input}T00:00:00Z`);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
  return new Date(Date.UTC(input.year, input.month - 1, input.day));
}

/**
 * Axis label formatter. Returns null while the Default date format is
 * selected so lightweight-charts keeps its built-in labels.
 */
export function formatTick(
  input: TickInput,
  display: ChartDisplaySettings,
  timeframe: ChartTimeframe,
): string | null {
  if (display.dateFormat === "auto" && !isIntraday(timeframe)) return null;
  const date = tickDate(input);
  if (!date) return null;
  if (isIntraday(timeframe) && typeof input === "number") {
    return formatTickTime(date, display);
  }
  if (display.dateFormat === "auto") return null;
  return formatTickDate(date, display);
}

const INTRADAY_SPAN_SECONDS: Readonly<Record<string, number>> = {
  "1": 60,
  "5": 300,
  "15": 900,
  "60": 3600,
};

/** Seconds until the current bar closes; null when there is no live bar. */
export function countdownSeconds(
  nowMs: number,
  timeframe: ChartTimeframe,
): number | null {
  const span = INTRADAY_SPAN_SECONDS[timeframe];
  if (span) {
    const nowSeconds = Math.floor(nowMs / 1000);
    const rest = span - (nowSeconds % span);
    return rest === 0 ? span : rest;
  }
  if (timeframe === "D") {
    // Countdown to the 15:30 IST close on weekdays.
    const ist = new Date(
      nowMs + (330 + new Date(nowMs).getTimezoneOffset()) * 60000,
    );
    const weekday = ist.getDay();
    if (weekday === 0 || weekday === 6) return null;
    const close = new Date(ist);
    close.setHours(15, 30, 0, 0);
    const rest = Math.round((close.getTime() - ist.getTime()) / 1000);
    return rest > 0 ? rest : null;
  }
  return null;
}

export function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number): string => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

// ── alert sound (client-only, best effort) ────────────────────────────────

function beep(
  context: AudioContext,
  at: number,
  frequency: number,
  duration: number,
  volume: number,
  shape: OscillatorType,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = shape;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(Math.min(1, Math.max(0, volume)), at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}

/** Short synthesized blip; silently no-ops outside the browser. */
export function playAlertSound(name: AlertSoundName, volume: number): void {
  if (typeof window === "undefined") return;
  try {
    const holder = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Factory = holder.AudioContext ?? holder.webkitAudioContext;
    if (!Factory) return;
    const context = new Factory();
    const start = context.currentTime + 0.01;
    if (name === "chime") {
      beep(context, start, 660, 0.25, volume, "sine");
      beep(context, start + 0.28, 880, 0.35, volume, "sine");
    } else {
      beep(context, start, 880, 0.12, volume, "square");
      beep(context, start + 0.2, 880, 0.12, volume, "square");
      beep(context, start + 0.4, 880, 0.2, volume, "square");
    }
    window.setTimeout(() => void context.close(), 1500);
  } catch {
    // Sound is decoration; a blocked AudioContext must never break alerts.
  }
}

// ── session high/low from loaded candles ──────────────────────────────────

export function sessionHighLow(
  candles: readonly ChartCandle[],
  timeframe: ChartTimeframe,
): { readonly high: number; readonly low: number } | null {
  if (candles.length === 0) return null;
  if (isIntraday(timeframe)) {
    let high = -Infinity;
    let low = Infinity;
    for (const candle of candles) {
      if (candle.high > high) high = candle.high;
      if (candle.low < low) low = candle.low;
    }
    return { high, low };
  }
  const last = candles[candles.length - 1]!;
  return { high: last.high, low: last.low };
}

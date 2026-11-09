import apiClient, {
  getAxiosErrorMessage,
  isRecord,
  isSuccessfulApiResponse,
} from "@/lib/api-client";
import { formatNumber } from "./ui";

export interface ChartAlert {
  readonly id: string;
  readonly tradingSymbol: string;
  readonly targetPrice: number;
  readonly direction: "above" | "below";
  readonly status: "active" | "triggered";
}

function isChartAlert(value: unknown): value is ChartAlert {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.tradingSymbol === "string" &&
    typeof value.targetPrice === "number" &&
    (value.direction === "above" || value.direction === "below") &&
    (value.status === "active" || value.status === "triggered")
  );
}

export async function fetchAlerts(): Promise<ChartAlert[]> {
  const response = await apiClient.get<unknown>("/api/alerts");
  const data = isSuccessfulApiResponse(response.data)
    ? response.data.data
    : null;
  return isRecord(data) && Array.isArray(data.alerts)
    ? data.alerts.filter(isChartAlert)
    : [];
}

export async function createAlert(input: {
  readonly tradingSymbol: string;
  readonly displayName: string;
  readonly targetPrice: number;
  readonly lastPrice: number;
  readonly direction?: "above" | "below";
}): Promise<void> {
  await apiClient.post("/api/alerts", {
    tradingSymbol: input.tradingSymbol,
    displayName: input.displayName,
    targetPrice: input.targetPrice,
    direction:
      input.direction ??
      (input.targetPrice >= input.lastPrice ? "above" : "below"),
    source: "others",
    category: "swing",
  });
}

export async function deleteAlert(id: string): Promise<void> {
  await apiClient.delete("/api/alerts", { data: { id } });
}

/** Price condition for an alert. The server stores above/below; crossing is client-side. */
export type AlertCondition = "above" | "below" | "crossing";

export function isAlertCondition(value: unknown): value is AlertCondition {
  return value === "above" || value === "below" || value === "crossing";
}

/**
 * True when the move from the previous quote to the current one satisfies the
 * condition against the target. Above/below are directional; crossing fires on
 * a touch from either side.
 */
export function evaluateAlertCondition(
  condition: AlertCondition,
  target: number,
  previous: number,
  current: number,
): boolean {
  if (
    !Number.isFinite(target) ||
    !Number.isFinite(previous) ||
    !Number.isFinite(current) ||
    previous === current
  ) {
    return false;
  }
  switch (condition) {
    case "above":
      return previous < target && current >= target;
    case "below":
      return previous > target && current <= target;
    case "crossing":
      return (
        (previous < target && current >= target) ||
        (previous > target && current <= target)
      );
  }
}

const CONDITION_STORAGE_KEY = "chart:alerts:conditions:v1";
const TRIGGER_LOG_KEY = "chart:alerts:trigger-log:v1";
const MAX_TRIGGER_LOG = 100;

export function alertConditionKey(symbol: string, target: number): string {
  return `${symbol.toUpperCase()}:${target}`;
}

function readRecord(key: string): Record<string, unknown> {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Crossing choices are client-side only, keyed by symbol and target price. */
export function getAlertCondition(
  symbol: string,
  target: number,
): AlertCondition | null {
  if (typeof window === "undefined") return null;
  const value = readRecord(CONDITION_STORAGE_KEY)[
    alertConditionKey(symbol, target)
  ];
  return isAlertCondition(value) ? value : null;
}

export function saveAlertCondition(
  symbol: string,
  target: number,
  condition: AlertCondition,
): void {
  try {
    const stored = readRecord(CONDITION_STORAGE_KEY);
    stored[alertConditionKey(symbol, target)] = condition;
    window.localStorage.setItem(CONDITION_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Client-only metadata; blocked storage must not break alert creation.
  }
}

export interface AlertTrigger {
  readonly id: string;
  readonly symbol: string;
  readonly targetPrice: number;
  readonly condition: AlertCondition;
  readonly price: number;
  readonly at: string;
}

function isAlertTrigger(value: unknown): value is AlertTrigger {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.symbol === "string" &&
    typeof value.targetPrice === "number" &&
    isAlertCondition(value.condition) &&
    typeof value.price === "number" &&
    typeof value.at === "string"
  );
}

export function readAlertTriggerLog(): AlertTrigger[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TRIGGER_LOG_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(isAlertTrigger).slice(0, MAX_TRIGGER_LOG)
      : [];
  } catch {
    return [];
  }
}

export function recordAlertTrigger(
  trigger: Omit<AlertTrigger, "id" | "at">,
): AlertTrigger {
  const entry: AlertTrigger = {
    ...trigger,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: new Date().toISOString(),
  };
  try {
    const next = [entry, ...readAlertTriggerLog()].slice(0, MAX_TRIGGER_LOG);
    window.localStorage.setItem(TRIGGER_LOG_KEY, JSON.stringify(next));
  } catch {
    // The log is supplementary; losing it must not break the toast.
  }
  return entry;
}

export function clearAlertTriggerLog(): void {
  try {
    window.localStorage.removeItem(TRIGGER_LOG_KEY);
  } catch {
    // Ignored: clearing a convenience log is never fatal.
  }
}

// ── paused alerts ──────────────────────────────────────────────────────────

const PAUSED_KEY = "chart:alerts:paused:v1";

function readPausedIdSet(): Set<string> {
  try {
    const raw = window.localStorage.getItem(PAUSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

/** Paused alerts stay listed but never fire, for server and local alerts. */
export function isAlertPaused(id: string): boolean {
  if (typeof window === "undefined") return false;
  return readPausedIds().has(id);
}

/** Live paused-id set for panels that render many rows. */
export function readPausedIds(): ReadonlySet<string> {
  if (typeof window === "undefined") return new Set();
  return readPausedIdSet();
}

export function setAlertPaused(id: string, paused: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const ids = readPausedIdSet();
    if (paused) ids.add(id);
    else ids.delete(id);
    window.localStorage.setItem(PAUSED_KEY, JSON.stringify([...ids]));
  } catch {
    // Pausing is a convenience; blocked storage must not break the panel.
  }
}

// ── TradingView-style alert rules ─────────────────────────────────────────

export type AlertOperator =
  | "crossing"
  | "crossing-up"
  | "crossing-down"
  | "greater-than"
  | "less-than"
  | "rising"
  | "falling"
  | "rising-pct"
  | "falling-pct"
  | "volume-above"
  | "entering-channel"
  | "exiting-channel"
  | "inside-channel"
  | "outside-channel";

export interface AlertRule {
  readonly operator: AlertOperator;
  readonly target: number;
}

export const ALERT_OPERATORS: readonly {
  readonly id: AlertOperator;
  readonly label: string;
}[] = [
  { id: "crossing", label: "Crossing" },
  { id: "crossing-up", label: "Crossing Up" },
  { id: "crossing-down", label: "Crossing Down" },
  { id: "greater-than", label: "Greater Than" },
  { id: "less-than", label: "Less Than" },
  { id: "rising", label: "Moving Up" },
  { id: "falling", label: "Moving Down" },
  { id: "rising-pct", label: "Moving Up %" },
  { id: "falling-pct", label: "Moving Down %" },
  { id: "volume-above", label: "Volume Above" },
  { id: "entering-channel", label: "Entering Channel" },
  { id: "exiting-channel", label: "Exiting Channel" },
  { id: "inside-channel", label: "Inside Channel" },
  { id: "outside-channel", label: "Outside Channel" },
];

export function isAlertOperator(value: unknown): value is AlertOperator {
  return ALERT_OPERATORS.some((entry) => entry.id === value);
}

export function alertOperatorLabel(operator: AlertOperator): string {
  return (
    ALERT_OPERATORS.find((entry) => entry.id === operator)?.label ?? operator
  );
}

/** Legacy above/below/crossing label for logs and old call sites. */
export function legacyConditionFor(operator: AlertOperator): AlertCondition {
  switch (operator) {
    case "crossing-down":
    case "less-than":
    case "falling":
    case "falling-pct":
      return "below";
    case "crossing":
      return "crossing";
    default:
      return "above";
  }
}

export function ruleTargetLabel(
  rule: AlertRule,
  kind: "price" | "volume",
): string {
  if (rule.operator === "rising-pct" || rule.operator === "falling-pct") {
    return `${rule.target}%`;
  }
  if (kind === "volume" || rule.operator === "volume-above") {
    return `${rule.target.toLocaleString("en-IN")} shares`;
  }
  return `₹${formatNumber(rule.target)}`;
}

/** Condition for alerts created before rich metadata existed. */
export function storedAlertDirection(alert: ChartAlert): AlertCondition {
  const stored = getAlertCondition(alert.tradingSymbol, alert.targetPrice);
  if (stored && isAlertCondition(stored)) return stored;
  return alert.direction;
}

function legacyConditionLabel(alert: ChartAlert): AlertCondition {
  return storedAlertDirection(alert);
}

/** One-line rule summary shared by the dialog list and the docked panel. */
export function describeAlert(alert: ChartAlert): string {
  const meta = getAlertMeta(alert.tradingSymbol, alert.targetPrice);
  const kind = meta?.kind ?? "price";
  const rules = meta?.rules ?? [
    {
      operator:
        legacyConditionLabel(alert) === "above"
          ? ("crossing-up" as const)
          : legacyConditionLabel(alert) === "below"
            ? ("crossing-down" as const)
            : ("crossing" as const),
      target: alert.targetPrice,
    },
  ];
  return rules
    .map((rule) => {
      if (isChannelOperator(rule.operator)) {
        return `${alertOperatorLabel(rule.operator)} ${meta?.drawingLabel ?? "channel"}`;
      }
      if (meta?.attachedKind === "fib" && meta.fibLevel !== null) {
        return `${alertOperatorLabel(rule.operator)} ${meta.fibLevel} @ ${ruleTargetLabel(rule, kind)}`;
      }
      return `${alertOperatorLabel(rule.operator)} ${ruleTargetLabel(rule, kind)}`;
    })
    .join(" + ");
}

/** Server persistence only knows above/below; everything else is client-side. */
export function operatorDirection(operator: AlertOperator): "above" | "below" {
  switch (operator) {
    case "crossing-down":
    case "less-than":
    case "falling":
    case "falling-pct":
      return "below";
    default:
      return "above";
  }
}

/**
 * Volume and momentum operators never touch the server: a percent threshold
 * stored as a price target would evaluate wrongly against live quotes.
 */
/**
 * Level operators compare against a fixed line (first sight while already
 * satisfied must not fire); momentum operators read tick direction.
 */
export function isLevelOperator(operator: AlertOperator): boolean {
  return (
    operator === "crossing" ||
    operator === "crossing-up" ||
    operator === "crossing-down" ||
    operator === "greater-than" ||
    operator === "less-than" ||
    operator === "volume-above" ||
    operator === "entering-channel" ||
    operator === "exiting-channel" ||
    operator === "inside-channel" ||
    operator === "outside-channel"
  );
}

export function isChannelOperator(
  operator: AlertOperator,
): operator is
  | "entering-channel"
  | "exiting-channel"
  | "inside-channel"
  | "outside-channel" {
  return (
    operator === "entering-channel" ||
    operator === "exiting-channel" ||
    operator === "inside-channel" ||
    operator === "outside-channel"
  );
}

export function isLocalOnlyRule(
  rule: AlertRule,
  kind: "price" | "volume",
): boolean {
  if (kind === "volume") return true;
  return (
    rule.operator === "rising" ||
    rule.operator === "falling" ||
    rule.operator === "rising-pct" ||
    rule.operator === "falling-pct" ||
    rule.operator === "volume-above" ||
    isChannelOperator(rule.operator)
  );
}

function finite(...values: readonly number[]): boolean {
  return values.every((value) => Number.isFinite(value));
}

/** Edge semantics: did this tick cross into the condition? */
export function evaluateRuleTransition(
  rule: AlertRule,
  previous: number,
  current: number,
): boolean {
  if (!finite(rule.target, previous, current) || previous === current) {
    return false;
  }
  const target = rule.target;
  switch (rule.operator) {
    case "crossing-up":
      return previous < target && current >= target;
    case "crossing-down":
      return previous > target && current <= target;
    case "crossing":
      return (
        (previous < target && current >= target) ||
        (previous > target && current <= target)
      );
    case "greater-than":
      return previous <= target && current > target;
    case "less-than":
      return previous >= target && current < target;
    case "rising":
      return current > previous;
    case "falling":
      return current < previous;
    case "rising-pct":
      return previous > 0 && ((current - previous) / previous) * 100 >= target;
    case "falling-pct":
      return previous > 0 && ((current - previous) / previous) * 100 <= -target;
    case "volume-above":
    case "entering-channel":
    case "exiting-channel":
    case "inside-channel":
    case "outside-channel":
      // Volume and channel rules evaluate through dedicated paths.
      return false;
  }
}

/** State semantics: does the condition hold right now? */
export function evaluateRuleState(
  rule: AlertRule,
  current: number,
  previous: number,
  volume: number | null,
): boolean {
  if (!finite(rule.target, current)) return false;
  const target = rule.target;
  switch (rule.operator) {
    case "crossing-up":
    case "greater-than":
      return current > target;
    case "crossing-down":
    case "less-than":
      return current < target;
    case "crossing":
      return current !== target;
    case "rising":
      return finite(previous) && current > previous;
    case "falling":
      return finite(previous) && current < previous;
    case "rising-pct":
      return (
        finite(previous) &&
        previous > 0 &&
        ((current - previous) / previous) * 100 >= target
      );
    case "falling-pct":
      return (
        finite(previous) &&
        previous > 0 &&
        ((current - previous) / previous) * 100 <= -target
      );
    case "volume-above":
      return volume !== null && volume >= target;
    case "entering-channel":
    case "exiting-channel":
    case "inside-channel":
    case "outside-channel":
      // Channel rules evaluate through the band path below.
      return false;
  }
}

/** Every condition in the list must hold (AND). */
export function evaluateAllTransitions(
  rules: readonly AlertRule[],
  previous: number,
  current: number,
): boolean {
  return (
    rules.length > 0 &&
    rules.every((rule) => evaluateRuleTransition(rule, previous, current))
  );
}

export function evaluateAllStates(
  rules: readonly AlertRule[],
  current: number,
  previous: number,
  volume: number | null,
): boolean {
  return (
    rules.length > 0 &&
    rules.every((rule) => evaluateRuleState(rule, current, previous, volume))
  );
}

// ── per-alert metadata (client-side) ──────────────────────────────────────

export type AlertTriggerMode = "once" | "every";
export type AlertSchedule = "always" | "market-hours";

export interface AlertMeta {
  readonly rules: readonly AlertRule[];
  readonly kind: "price" | "volume";
  readonly trigger: AlertTriggerMode;
  readonly expiresAt: string | null;
  readonly message: string | null;
  readonly notifyToast: boolean;
  readonly playSound: boolean;
  readonly webhookUrl: string | null;
  readonly schedule: AlertSchedule;
  /** Trendline drawing this alert follows, if any. */
  readonly drawingId: string | null;
  /** Static fallback target when the drawing is gone. */
  readonly staticTarget: number;
  readonly drawingLabel: string | null;
  /** Fib level behind the alert, if any. */
  readonly fibLevel: number | null;
  /** Attachment family behind the alert, if any. */
  readonly attachedKind: AttachedKind | null;
  readonly createdAt: string;
}

const META_KEY = "chart:alerts:meta:v1";

function metaKey(symbol: string, target: number): string {
  return `${symbol.toUpperCase()}:${target}`;
}

function isAlertMeta(value: unknown): value is AlertMeta {
  if (!isRecord(value)) return false;
  const rules = value.rules;
  return (
    Array.isArray(rules) &&
    rules.every(
      (rule): rule is AlertRule =>
        isRecord(rule) &&
        isAlertOperator(rule.operator) &&
        typeof rule.target === "number",
    ) &&
    (value.kind === "price" || value.kind === "volume") &&
    (value.trigger === "once" || value.trigger === "every") &&
    (value.expiresAt === null || typeof value.expiresAt === "string") &&
    (value.message === null || typeof value.message === "string") &&
    typeof value.notifyToast === "boolean" &&
    typeof value.playSound === "boolean" &&
    (value.webhookUrl === null || typeof value.webhookUrl === "string") &&
    (value.schedule === "always" || value.schedule === "market-hours") &&
    (value.drawingId === null || typeof value.drawingId === "string") &&
    typeof value.staticTarget === "number" &&
    (value.drawingLabel === null || typeof value.drawingLabel === "string") &&
    (value.fibLevel === null || typeof value.fibLevel === "number") &&
    (value.attachedKind === null ||
      value.attachedKind === "line" ||
      value.attachedKind === "channel" ||
      value.attachedKind === "fork" ||
      value.attachedKind === "fib") &&
    typeof value.createdAt === "string"
  );
}

export function getAlertMeta(symbol: string, target: number): AlertMeta | null {
  if (typeof window === "undefined") return null;
  const stored = readRecord(META_KEY)[metaKey(symbol, target)];
  return isAlertMeta(stored) ? stored : null;
}

export function saveAlertMeta(
  symbol: string,
  target: number,
  meta: AlertMeta,
): void {
  try {
    const stored = readRecord(META_KEY);
    stored[metaKey(symbol, target)] = meta;
    window.localStorage.setItem(META_KEY, JSON.stringify(stored));
  } catch {
    // Client-only metadata; blocked storage must not break alert creation.
  }
}

export function deleteAlertMeta(symbol: string, target: number): void {
  try {
    const stored = readRecord(META_KEY);
    delete stored[metaKey(symbol, target)];
    window.localStorage.setItem(META_KEY, JSON.stringify(stored));
  } catch {
    // Ignored: metadata cleanup is never fatal.
  }
}

export function isAlertExpired(meta: AlertMeta, nowMs: number): boolean {
  if (!meta.expiresAt) return false;
  const at = Date.parse(meta.expiresAt);
  return !Number.isNaN(at) && nowMs >= at;
}

// ── expiry presets ────────────────────────────────────────────────────────

export type ExpiryPreset = "open" | "day" | "week" | "month" | "custom";

const IST_OFFSET_MS = 19_800_000;

export function expiryPresetDate(
  preset: ExpiryPreset,
  nowMs: number,
  customIso: string | null,
): string | null {
  switch (preset) {
    case "open":
      return null;
    case "day": {
      const istDay = Math.floor((nowMs + IST_OFFSET_MS) / 86_400_000);
      return new Date(
        istDay * 86_400_000 + (23 * 3600 + 59 * 60) * 1000 - IST_OFFSET_MS,
      ).toISOString();
    }
    case "week":
      return new Date(nowMs + 7 * 86_400_000).toISOString();
    case "month": {
      const date = new Date(nowMs);
      date.setUTCMonth(date.getUTCMonth() + 1);
      return date.toISOString();
    }
    case "custom":
      if (!customIso) return null;
      const at = Date.parse(customIso);
      return Number.isNaN(at) ? null : new Date(at).toISOString();
  }
}

// ── messages and placeholders ─────────────────────────────────────────────

export const MESSAGE_PLACEHOLDERS: readonly {
  readonly token: string;
  readonly label: string;
}[] = [
  { token: "{{symbol}}", label: "Symbol" },
  { token: "{{condition}}", label: "Condition" },
  { token: "{{target}}", label: "Target" },
  { token: "{{price}}", label: "Current price" },
];

export function defaultAlertMessage(
  symbol: string,
  conditionLabel: string,
  target: string,
): string {
  return `${symbol} ${conditionLabel} ${target}`;
}

export function renderAlertMessage(
  template: string,
  vars: Readonly<Record<string, string>>,
): string {
  let message = template;
  for (const [key, value] of Object.entries(vars)) {
    message = message.split(`{{${key}}}`).join(value);
  }
  return message;
}

// ── webhook delivery ──────────────────────────────────────────────────────

export interface AlertWebhookPayload {
  readonly symbol: string;
  readonly condition: string;
  readonly target: number;
  readonly price: number;
  readonly at: string;
}

export async function fireAlertWebhook(
  url: string,
  payload: AlertWebhookPayload,
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ── trendline target math ─────────────────────────────────────────────────

export const TRENDLINE_ALERT_TYPES: readonly string[] = [
  "trend",
  "ray",
  "extended",
  "hline",
  "hray",
  "angle",
];

export function supportsTrendlineAlert(drawingType: string): boolean {
  return TRENDLINE_ALERT_TYPES.includes(drawingType);
}

/** Drawings whose alerts follow a band rather than a single line. */
export const CHANNEL_ALERT_TYPES: readonly string[] = [
  "channel",
  "flat",
  "regression",
  "pitchfork",
  "schiff",
  "modschiff",
  "insidefork",
];

export function supportsChannelAlert(
  drawingType: string,
  pointCount: number,
): boolean {
  if (drawingType === "flat") return pointCount >= 3;
  if (drawingType === "regression") return pointCount >= 2;
  if (drawingType === "channel") return pointCount >= 3;
  return (
    (drawingType === "pitchfork" ||
      drawingType === "schiff" ||
      drawingType === "modschiff" ||
      drawingType === "insidefork") &&
    pointCount >= 3
  );
}

export function supportsFibAlert(
  drawingType: string,
  pointCount: number,
): boolean {
  return drawingType === "fib" && pointCount >= 2;
}

export type AttachedKind = "line" | "channel" | "fork" | "fib";

export function attachedKindFor(
  drawingType: string,
  pointCount: number,
): AttachedKind | null {
  if (supportsFibAlert(drawingType, pointCount)) return "fib";
  if (
    (drawingType === "pitchfork" ||
      drawingType === "schiff" ||
      drawingType === "modschiff" ||
      drawingType === "insidefork") &&
    pointCount >= 3
  ) {
    return "fork";
  }
  if (supportsChannelAlert(drawingType, pointCount)) return "channel";
  if (supportsTrendlineAlert(drawingType) && pointCount >= 1) return "line";
  return null;
}

export interface TrendPoint {
  readonly t: number;
  readonly p: number;
}

/**
 * Price of a two-point line at an epoch, extrapolated forever like a ray.
 * Single-point drawings behave as a horizontal line.
 */
export function trendLinePriceAt(
  points: readonly TrendPoint[],
  epochSec: number,
): number | null {
  if (points.length === 0) return null;
  const first = points[0]!;
  if (points.length === 1) return first.p;
  const ordered = [...points].sort((a, b) => a.t - b.t);
  const start = ordered[0]!;
  const end = ordered[ordered.length - 1]!;
  if (end.t === start.t) return start.p;
  const slope = (end.p - start.p) / (end.t - start.t);
  return start.p + slope * (epochSec - start.t);
}

// ── channel and fork band math (mirrors drawing-render.ts) ───────────────

export interface ChannelBand {
  readonly lower: number;
  readonly upper: number;
}

function lineAt(a: TrendPoint, b: TrendPoint, epochSec: number): number | null {
  if (b.t === a.t) return null;
  return a.p + ((b.p - a.p) * (epochSec - a.t)) / (b.t - a.t);
}

/**
 * Parallel-channel band: the main line through the first two points plus the
 * offset of the third point, exactly like the rendered channel.
 */
export function parallelChannelBandAt(
  points: readonly TrendPoint[],
  epochSec: number,
): ChannelBand | null {
  const [a, b, c] = points;
  if (!a || !b || !c) return null;
  const main = lineAt(a, b, epochSec);
  if (main === null) return null;
  const offset = c.p - (lineAt(a, b, c.t) ?? c.p);
  return {
    lower: Math.min(main, main + offset),
    upper: Math.max(main, main + offset),
  };
}

/**
 * Flat top/bottom band: the sloped line through the first two points plus
 * the horizontal level of the third point.
 */
export function flatBandAt(
  points: readonly TrendPoint[],
  epochSec: number,
): ChannelBand | null {
  const [a, b, c] = points;
  if (!a || !b || !c) return null;
  const line = lineAt(a, b, epochSec);
  if (line === null) return null;
  return { lower: Math.min(line, c.p), upper: Math.max(line, c.p) };
}

export interface ForkLines {
  readonly median: number | null;
  readonly band: ChannelBand | null;
}

function forkOrigin(type: string, p1: TrendPoint, p2: TrendPoint): TrendPoint {
  if (type === "schiff") return { t: p1.t, p: (p1.p + p2.p) / 2 };
  if (type === "modschiff") {
    return { t: (p1.t + p2.t) / 2, p: (p1.p + p2.p) / 2 };
  }
  return p1;
}

/**
 * Pitchfork median and tine band in data space, mirroring the rendered fork:
 * the median runs from the origin through the midpoint of the swing points
 * and the tines run parallel through them (half width for inside forks).
 */
export function forkLinesAt(
  type: string,
  points: readonly TrendPoint[],
  epochSec: number,
): ForkLines {
  const [p1, p2, p3] = points;
  if (!p1 || !p2 || !p3) return { median: null, band: null };
  const mid = { t: (p2.t + p3.t) / 2, p: (p2.p + p3.p) / 2 };
  const origin = forkOrigin(type, p1, p2);
  const run = mid.t - origin.t;
  if (run === 0) return { median: null, band: null };
  const slope = (mid.p - origin.p) / run;
  const spread = type === "insidefork" ? 0.5 : 1;
  const tine = (anchor: TrendPoint): number => {
    const shifted = {
      t: mid.t + (anchor.t - mid.t) * spread,
      p: mid.p + (anchor.p - mid.p) * spread,
    };
    return shifted.p + slope * (epochSec - shifted.t);
  };
  return {
    median: origin.p + slope * (epochSec - origin.t),
    band: {
      lower: Math.min(tine(p2), tine(p3)),
      upper: Math.max(tine(p2), tine(p3)),
    },
  };
}

export interface RegressionPoint {
  readonly t: number;
  readonly p: number;
}

const REGRESSION_DEVIATIONS = 2;

/**
 * Least-squares band over closes between two anchors, ±2σ like the rendered
 * regression trend. Returns null with fewer than three bars in range.
 */
export function regressionBandAt(
  closes: readonly RegressionPoint[],
  fromT: number,
  toT: number,
  epochSec: number,
): ChannelBand | null {
  const start = Math.min(fromT, toT);
  const end = Math.max(fromT, toT);
  const sample = closes.filter((point) => point.t >= start && point.t <= end);
  if (sample.length < 3) return null;
  const n = sample.length;
  let sumT = 0;
  let sumP = 0;
  for (const point of sample) {
    sumT += point.t;
    sumP += point.p;
  }
  const meanT = sumT / n;
  const meanP = sumP / n;
  let run = 0;
  let rise = 0;
  for (const point of sample) {
    run += (point.t - meanT) * (point.t - meanT);
    rise += (point.t - meanT) * (point.p - meanP);
  }
  if (run === 0) return null;
  const slope = rise / run;
  const at = (t: number): number => meanP + slope * (t - meanT);
  let variance = 0;
  for (const point of sample) {
    variance += (point.p - at(point.t)) * (point.p - at(point.t));
  }
  const offset = Math.sqrt(variance / n) * REGRESSION_DEVIATIONS;
  const centre = at(epochSec);
  return { lower: centre - offset, upper: centre + offset };
}

/** Fib retracement level price, exactly like the rendered labels. */
export function fibLevelPrice(
  points: readonly TrendPoint[],
  level: number,
): number | null {
  const [start, end] = points;
  if (!start || !end) return null;
  return end.p + (start.p - end.p) * level;
}

export type ChannelZone = "inside" | "above" | "below";

export function channelZone(band: ChannelBand, price: number): ChannelZone {
  if (price > band.upper) return "above";
  if (price < band.lower) return "below";
  return "inside";
}

export function formatBand(
  band: ChannelBand,
  format: (value: number) => string,
): string {
  return `${format(band.lower)} – ${format(band.upper)}`;
}

/**
 * State semantics for channel operators: entering/inside hold while price is
 * inside the band, exiting/outside while it is out. Pairs with the generic
 * once/every state machine, whose false-to-true edge gives the entry/exit
 * trigger and whose arming skips alerts created while already satisfied.
 */
export function evaluateChannelState(
  operator: AlertOperator,
  price: number,
  band: ChannelBand,
): boolean {
  if (!Number.isFinite(price)) return false;
  const zone = channelZone(band, price);
  switch (operator) {
    case "entering-channel":
    case "inside-channel":
      return zone === "inside";
    case "exiting-channel":
    case "outside-channel":
      return zone !== "inside";
    default:
      return false;
  }
}

export interface DrawingBand {
  readonly band: ChannelBand | null;
  readonly median: number | null;
}

/**
 * Live band (and fork median) for any band-style drawing, mirroring the
 * rendered geometry. Regression needs bar closes; every other type resolves
 * from the drawing points alone.
 */
export function bandForDrawing(
  drawingType: string,
  points: readonly TrendPoint[],
  epochSec: number,
  closes: readonly RegressionPoint[],
): DrawingBand {
  const empty: DrawingBand = { band: null, median: null };
  if (points.length === 0) return empty;
  switch (drawingType) {
    case "channel":
      return {
        band: parallelChannelBandAt(points, epochSec),
        median: null,
      };
    case "flat":
      return { band: flatBandAt(points, epochSec), median: null };
    case "regression": {
      const [from, to] = points;
      if (!from || !to) return empty;
      return {
        band: regressionBandAt(closes, from.t, to.t, epochSec),
        median: null,
      };
    }
    case "pitchfork":
    case "schiff":
    case "modschiff":
    case "insidefork": {
      const lines = forkLinesAt(drawingType, points, epochSec);
      return { band: lines.band, median: lines.median };
    }
    default:
      return empty;
  }
}

// ── purely local alerts (volume and momentum operators) ───────────────────

const LOCAL_KEY = "chart:alerts:local:v1";

export function readLocalAlerts(): ChartAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isChartAlert) : [];
  } catch {
    return [];
  }
}

function writeLocalAlerts(alerts: readonly ChartAlert[]): void {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(alerts));
  } catch {
    // Client-only alerts; blocked storage must not break the dialog.
  }
}

export function addLocalAlert(alert: ChartAlert): ChartAlert[] {
  const next = [alert, ...readLocalAlerts()];
  writeLocalAlerts(next);
  return next;
}

export function removeLocalAlert(id: string): ChartAlert[] {
  const next = readLocalAlerts().filter((alert) => alert.id !== id);
  writeLocalAlerts(next);
  return next;
}

export function markLocalAlertTriggered(id: string): ChartAlert[] {
  const next = readLocalAlerts().map((alert) =>
    alert.id === id ? { ...alert, status: "triggered" as const } : alert,
  );
  writeLocalAlerts(next);
  return next;
}

export { getAxiosErrorMessage };

/**
 * The market table's "Candlestick" and "Chart Patterns" summary columns:
 * every implemented pattern detected on each stock's latest candles, for the
 * timeframes the page has selected.
 *
 * Free of server imports, so the browser reads the same ids, labels,
 * timeframe rules and filter semantics the server applies.
 */
import { ADD_COLUMN_GROUPS, ADD_TIMEFRAMES } from "@/lib/screener-columns";
import {
  isBasicCandlestickPattern,
  isBasicChartSignal,
  isCandlestickAlias,
  resolveTimeframeCapability,
} from "@/lib/technical";

export type PatternSummaryGroup = "candlesticks" | "chart-patterns";

export interface PatternSummaryItem {
  readonly id: string;
  readonly label: string;
}

/** One detected pattern and the timeframes it was detected on. */
export interface PatternHit {
  readonly id: string;
  readonly timeframeIds: readonly string[];
}

/**
 * A stock's detections. `no-data` means none of the requested timeframes had
 * candles with stored open/high/low (OHLC history not backfilled), so "no
 * pattern" could not be decided; `ready` with empty lists means the candles
 * were read and nothing matched.
 */
export interface RowPatternSummary {
  readonly state: "ready" | "no-data";
  readonly candlesticks: readonly PatternHit[];
  readonly chartPatterns: readonly PatternHit[];
}

export interface PatternOptionCount {
  readonly id: string;
  readonly label: string;
  /** Stocks in the current result (before pattern filters) showing it. */
  readonly count: number;
}

/** What /api/market/live returns when the summary columns are requested. */
export interface PatternSummaryPayload {
  readonly timeframeIds: readonly string[];
  /** Summaries for the rows on this page, keyed by `<segment>:<securityId>`. */
  readonly rows: Readonly<Record<string, RowPatternSummary>>;
  readonly options: {
    readonly candlesticks: readonly PatternOptionCount[];
    readonly chartPatterns: readonly PatternOptionCount[];
  };
  /** Stocks scanned for the options, and how many of them had no OHLC history. */
  readonly scanned: number;
  readonly withoutData: number;
}

function groupItems(
  groupId: PatternSummaryGroup,
  isImplemented: (id: string) => boolean,
): readonly PatternSummaryItem[] {
  const group = ADD_COLUMN_GROUPS.find((entry) => entry.id === groupId);
  return (group?.items ?? [])
    .filter((item) => isImplemented(item.id))
    .map((item) => ({ id: item.id, label: item.label }));
}

/**
 * Picker candlesticks with a detector. Alias ids ("engulfing-bullish") are
 * left out so one formation is never listed twice under two names.
 */
export const CANDLESTICK_SUMMARY_ITEMS = groupItems(
  "candlesticks",
  (id) => isBasicCandlestickPattern(id) && !isCandlestickAlias(id),
);

/** Picker chart patterns with a detector. */
export const CHART_PATTERN_SUMMARY_ITEMS = groupItems(
  "chart-patterns",
  isBasicChartSignal,
);

export const CANDLESTICK_SUMMARY_IDS = CANDLESTICK_SUMMARY_ITEMS.map(
  (item) => item.id,
);
export const CHART_PATTERN_SUMMARY_IDS = CHART_PATTERN_SUMMARY_ITEMS.map(
  (item) => item.id,
);

const labelById = new Map<string, string>(
  [...CANDLESTICK_SUMMARY_ITEMS, ...CHART_PATTERN_SUMMARY_ITEMS].map((item) => [
    item.id,
    item.label,
  ]),
);

export function patternSummaryLabel(id: string): string {
  return labelById.get(id) ?? id;
}

const candlestickIdSet = new Set(CANDLESTICK_SUMMARY_IDS);
const chartPatternIdSet = new Set(CHART_PATTERN_SUMMARY_IDS);

export function isCandlestickSummaryId(id: string): boolean {
  return candlestickIdSet.has(id);
}

export function isChartPatternSummaryId(id: string): boolean {
  return chartPatternIdSet.has(id);
}

export const DEFAULT_PATTERN_TIMEFRAME = "tf-1day";
export const MAX_PATTERN_TIMEFRAMES = 6;

/**
 * Whether the summary can be computed for every stock on this timeframe:
 * daily or coarser, served from the stored daily history. Minute and second
 * timeframes need per-symbol intraday or live-feed candles. Daily candles
 * resampled to weeks or months qualify.
 */
export function isPatternSummaryTimeframe(timeframeId: string): boolean {
  if (!ADD_TIMEFRAMES.some((timeframe) => timeframe.id === timeframeId)) {
    return false;
  }
  const capability = resolveTimeframeCapability(timeframeId);
  // YTD / 1 year / max are change windows over plain daily candles, not a
  // candle interval of their own; they would only repeat the daily result.
  return (
    capability.status === "supported" &&
    capability.dhanInterval === "day" &&
    capability.acquisition !== "daily-history-range"
  );
}

/**
 * The timeframes the summary columns scan for a page whose added-column
 * selection has `selected`: the selected daily-or-coarser ones, in picker
 * order, or the daily timeframe when none of them qualifies.
 */
export function resolvePatternSummaryTimeframes(
  selected: readonly string[],
): string[] {
  const wanted = new Set(selected);
  const timeframes = ADD_TIMEFRAMES.map((timeframe) => timeframe.id).filter(
    (id) => wanted.has(id) && isPatternSummaryTimeframe(id),
  );
  return timeframes.length > 0
    ? timeframes.slice(0, MAX_PATTERN_TIMEFRAMES)
    : [DEFAULT_PATTERN_TIMEFRAME];
}

export function patternTimeframeLabel(timeframeId: string): string {
  return (
    ADD_TIMEFRAMES.find((timeframe) => timeframe.id === timeframeId)?.label ??
    timeframeId
  );
}

/**
 * Merges per-timeframe detections into one hit per pattern, keeping the
 * pattern order of `orderedIds` and the timeframe order of the input.
 */
export function mergePatternHits(
  orderedIds: readonly string[],
  detectedByTimeframe: readonly (readonly [string, readonly string[]])[],
): PatternHit[] {
  const timeframesById = new Map<string, string[]>();
  for (const [timeframeId, ids] of detectedByTimeframe) {
    for (const id of ids) {
      const timeframes = timeframesById.get(id) ?? [];
      timeframes.push(timeframeId);
      timeframesById.set(id, timeframes);
    }
  }
  return orderedIds
    .filter((id) => timeframesById.has(id))
    .map((id) => ({ id, timeframeIds: timeframesById.get(id)! }));
}

export interface PatternFilter {
  /** Keep stocks showing at least one of these candlestick ids. */
  readonly candlesticks: readonly string[];
  /** Keep stocks showing at least one of these chart-pattern ids. */
  readonly chartPatterns: readonly string[];
}

export function hasPatternFilter(filter: PatternFilter): boolean {
  return filter.candlesticks.length > 0 || filter.chartPatterns.length > 0;
}

/**
 * Whether a stock passes the summary-column filters: any of the selected
 * ids within a column, and every column that has a selection. A stock
 * without a summary (no history) never passes an active filter.
 */
export function matchesPatternFilter(
  summary: RowPatternSummary | undefined,
  filter: PatternFilter,
): boolean {
  if (!hasPatternFilter(filter)) return true;
  if (!summary || summary.state !== "ready") return false;
  const matchesAny = (hits: readonly PatternHit[], ids: readonly string[]) =>
    ids.length === 0 || hits.some((hit) => ids.includes(hit.id));
  return (
    matchesAny(summary.candlesticks, filter.candlesticks) &&
    matchesAny(summary.chartPatterns, filter.chartPatterns)
  );
}

/**
 * Per-pattern stock counts over `summaries`, for the header filter menus:
 * only patterns some stock shows, most common first, then by label.
 */
export function countPatternOptions(
  summaries: Iterable<RowPatternSummary | undefined>,
): PatternSummaryPayload["options"] {
  const candlestickCounts = new Map<string, number>();
  const chartCounts = new Map<string, number>();
  for (const summary of summaries) {
    if (!summary || summary.state !== "ready") continue;
    for (const hit of summary.candlesticks) {
      candlestickCounts.set(hit.id, (candlestickCounts.get(hit.id) ?? 0) + 1);
    }
    for (const hit of summary.chartPatterns) {
      chartCounts.set(hit.id, (chartCounts.get(hit.id) ?? 0) + 1);
    }
  }
  const toOptions = (counts: Map<string, number>): PatternOptionCount[] =>
    [...counts.entries()]
      .map(([id, count]) => ({ id, label: patternSummaryLabel(id), count }))
      .sort(
        (left, right) =>
          right.count - left.count || left.label.localeCompare(right.label),
      );
  return {
    candlesticks: toOptions(candlestickCounts),
    chartPatterns: toOptions(chartCounts),
  };
}

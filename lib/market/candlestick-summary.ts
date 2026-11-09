import type { AddedColumnDefinition } from "@/lib/screener-columns";
import {
  patternSummaryLabel,
  patternTimeframeLabel,
  type PatternHit,
} from "./pattern-summary";

export interface CandlestickMatch {
  readonly label: string;
  readonly timeframeLabel: string;
}

interface MatchableValue {
  readonly state: string;
  readonly display: string;
  readonly numericValue?: number;
}

function isDetected(value: MatchableValue): boolean {
  if (value.state !== "ready") return false;
  if (value.numericValue === 1) return true;
  return value.display.trim().toLowerCase() === "yes";
}

/**
 * Detected patterns for one table row in the given group, derived from the
 * already-evaluated option columns (the same values the Yes/No cells
 * render). Other groups, change columns, and non-ready values never
 * contribute.
 */
export function patternMatchesForRow(
  addedColumns: readonly AddedColumnDefinition[],
  values: Readonly<Record<string, MatchableValue>> | undefined,
  groupId: string,
): CandlestickMatch[] {
  if (!values) return [];
  const matches: CandlestickMatch[] = [];
  for (const column of addedColumns) {
    if (
      column.kind !== "option" ||
      column.groupId !== groupId ||
      !column.itemId
    ) {
      continue;
    }
    const value = values[column.id];
    if (!value || !isDetected(value)) continue;
    matches.push({
      label: column.label,
      timeframeLabel: column.timeframeLabel,
    });
  }
  return matches;
}

/**
 * Detected candlestick patterns for one table row, derived from the
 * already-evaluated candlestick option columns (the same values the Yes/No
 * cells render). Other groups, change columns, and non-ready values never
 * contribute.
 */
export function candlestickMatchesForRow(
  addedColumns: readonly AddedColumnDefinition[],
  values: Readonly<Record<string, MatchableValue>> | undefined,
): CandlestickMatch[] {
  return patternMatchesForRow(addedColumns, values, "candlesticks");
}

/** Whether any selected option column in the given group exists. */
export function hasPatternSelection(
  addedColumns: readonly AddedColumnDefinition[],
  groupId: string,
): boolean {
  return addedColumns.some(
    (column) =>
      column.kind === "option" &&
      column.groupId === groupId &&
      Boolean(column.itemId),
  );
}

/** Whether any selected candlestick option column still lacks a value. */
export function hasCandlestickSelection(
  addedColumns: readonly AddedColumnDefinition[],
): boolean {
  return hasPatternSelection(addedColumns, "candlesticks");
}

/** Whether a selected column in the given group is still loading for this row. */
export function isPatternPendingForRow(
  addedColumns: readonly AddedColumnDefinition[],
  values: Readonly<Record<string, MatchableValue>> | undefined,
  groupId: string,
): boolean {
  if (!hasPatternSelection(addedColumns, groupId)) return false;
  if (!values) return true;
  return addedColumns.some((column) => {
    if (
      column.kind !== "option" ||
      column.groupId !== groupId ||
      !column.itemId
    ) {
      return false;
    }
    const value = values[column.id];
    return (
      !value ||
      value.state === "warming-live-feed" ||
      value.state === "warming-intraday"
    );
  });
}

/** Whether a selected candlestick column is still loading for this row. */
export function isCandlestickPendingForRow(
  addedColumns: readonly AddedColumnDefinition[],
  values: Readonly<Record<string, MatchableValue>> | undefined,
): boolean {
  return isPatternPendingForRow(addedColumns, values, "candlesticks");
}

/**
 * What a summary cell shows: the server-detected patterns (one entry per
 * pattern and timeframe), followed by any detection from a pattern column
 * the user added on a timeframe the server summary does not scan (intraday,
 * live feed). Duplicates of the same pattern on the same timeframe collapse.
 */
export function combinePatternMatches(
  hits: readonly PatternHit[] | undefined,
  addedMatches: readonly CandlestickMatch[],
): CandlestickMatch[] {
  const seen = new Set<string>();
  const combined: CandlestickMatch[] = [];
  const push = (match: CandlestickMatch) => {
    const key = `${match.label}\u0000${match.timeframeLabel}`;
    if (seen.has(key)) return;
    seen.add(key);
    combined.push(match);
  };
  for (const hit of hits ?? []) {
    for (const timeframeId of hit.timeframeIds) {
      push({
        label: patternSummaryLabel(hit.id),
        timeframeLabel: patternTimeframeLabel(timeframeId),
      });
    }
  }
  for (const match of addedMatches) push(match);
  return combined;
}

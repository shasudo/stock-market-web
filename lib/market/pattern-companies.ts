/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export type ColumnValueState =
  | "ready"
  | "insufficient-data"
  | "warming-live-feed"
  | "warming-intraday"
  | "awaiting-fundamentals"
  | "requires-provider"
  | "awaiting-option-chain"
  | "disabled";

export interface ColumnValue {
  readonly state: ColumnValueState;
  /** Never empty: table and CSV consumers can render this directly. */
  readonly display: string;
  readonly numericValue?: number;
  readonly message?: string;
}

import { ADD_TIMEFRAMES } from "@/lib/screener-columns";
import type { AddedColumnDefinition } from "@/lib/screener-columns";

/**
 * One table column per timeframe for a single picker option (e.g. one
 * candlestick pattern). Ids mirror buildAddedColumnDefinitions so a value
 * computed for these columns lines up with the value the table shows for
 * the same option and timeframe.
 */
export function buildPatternMatchColumns(
  groupId: string,
  itemId: string,
  timeframeIds: readonly string[],
): AddedColumnDefinition[] {
  return timeframeIds.map((timeframeId) => ({
    id: `${timeframeId}:${groupId}:${itemId}`,
    timeframeId,
    timeframeLabel: resolvePatternTimeframeLabel(timeframeId),
    label: itemId,
    groupId,
    groupLabel: groupId,
    itemId,
    kind: "option",
  }));
}

/** Display label for a picker timeframe; unknown ids pass through. */
export function resolvePatternTimeframeLabel(timeframeId: string): string {
  return (
    ADD_TIMEFRAMES.find((timeframe) => timeframe.id === timeframeId)?.label ??
    timeframeId
  );
}

/**
 * Whether a resolved column value means the company is forming the pattern:
 * a ready "Yes". Anything else (No, warming, insufficient, disabled) is not
 * a match.
 */
export function isPatternMatchValue(
  value: Pick<ColumnValue, "state" | "numericValue">,
): boolean {
  return value.state === "ready" && value.numericValue === 1;
}

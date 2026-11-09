export interface IndexPeHistoryPoint {
  readonly date: string;
  readonly pe: number;
}

export interface IndexPeLinePoint {
  readonly time: string;
  readonly value: number;
}

/** Day-change green/red used across the summary (matches volume bars). */
export const INDEX_UP_LINE_COLOR = "#10B981";
export const INDEX_DOWN_LINE_COLOR = "#F43F5E";

/**
 * Line color for an index series from its day change: green when the index
 * closed up, red when down. Null/NaN change reads as down rather than
 * inventing a direction.
 */
export function indexTrendLineColor(pctChange: number | null): string {
  return pctChange !== null &&
    Number.isFinite(pctChange) &&
    pctChange >= 0
    ? INDEX_UP_LINE_COLOR
    : INDEX_DOWN_LINE_COLOR;
}

/**
 * Index P/E history into ascending chart points. Drops rows without a
 * finite positive P/E instead of plotting a fabricated zero.
 */
export function toIndexPeLinePoints(
  history: readonly IndexPeHistoryPoint[] | null | undefined,
): IndexPeLinePoint[] {
  if (!history) return [];
  return history
    .filter(
      (point): point is IndexPeHistoryPoint & { date: string } =>
        typeof point?.date === "string" &&
        point.date.length >= 10 &&
        typeof point?.pe === "number" &&
        Number.isFinite(point.pe) &&
        point.pe > 0,
    )
    .map((point) => ({ time: point.date.slice(0, 10), value: point.pe }))
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

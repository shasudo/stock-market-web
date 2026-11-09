/**
 * Spreadsheet-style 3-color scale (min = red, median = yellow, max = green),
 * the conditional formatting used by the reference "Nifty Monthly Return"
 * sheet. Each row (and the calendar-year column) is scaled on its own values.
 */

type Rgb = readonly [number, number, number];

export const SCALE_LOW: Rgb = [248, 105, 107];
export const SCALE_MID: Rgb = [255, 235, 132];
export const SCALE_HIGH: Rgb = [99, 190, 123];

function blend(from: Rgb, to: Rgb, t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const channel = (index: 0 | 1 | 2): number =>
    Math.round(from[index] + (to[index] - from[index]) * clamped);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function percentile50(sorted: readonly number[]): number {
  const position = (sorted.length - 1) / 2;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/** Returns a color function scaled to `values`; non-finite values are ignored. */
export function threeColorScale(
  values: readonly (number | null | undefined)[],
): (value: number | null | undefined) => string | undefined {
  const finite = values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (finite.length === 0) return () => undefined;

  const min = finite[0];
  const max = finite[finite.length - 1];
  const mid = percentile50(finite);

  return (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    if (max === min) return blend(SCALE_MID, SCALE_MID, 0);
    if (value <= mid) {
      return mid === min
        ? blend(SCALE_MID, SCALE_MID, 0)
        : blend(SCALE_LOW, SCALE_MID, (value - min) / (mid - min));
    }
    return mid === max
      ? blend(SCALE_MID, SCALE_MID, 0)
      : blend(SCALE_MID, SCALE_HIGH, (value - mid) / (max - mid));
  };
}

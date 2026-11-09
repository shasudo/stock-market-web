/**
 * Year x month heatmap grids (the "Nifty Monthly Return" sheet layout) built
 * from dated series. Pure: no network, no database, so the same logic serves
 * the Nifty return sheet and the P/E sheet and is unit-tested directly.
 */

export type HeatmapKind = "return" | "level";
export type HeatmapCellSource = "live" | "archive";

export interface HeatmapCell {
  /** Return sheet: the month's % return. Level sheet: the month-end value. */
  readonly value: number;
  /** % change from the previous period; drives the cell color. */
  readonly change: number | null;
  readonly source: HeatmapCellSource;
  /** The month (or year) is still in progress, so the value is live. */
  readonly partial: boolean;
}

export interface HeatmapRow {
  readonly year: number;
  /** Always 12 entries, Jan..Dec; null where there is no data yet. */
  readonly months: readonly (HeatmapCell | null)[];
  /** Calendar-year column: compounded return, or year-end level. */
  readonly total: HeatmapCell | null;
}

export type HeatmapStatLabel = "Median" | "SD" | "Avg";

export interface HeatmapStatRow {
  readonly label: HeatmapStatLabel;
  readonly months: readonly (number | null)[];
  readonly total: number | null;
}

export interface HeatmapSourceSpan {
  readonly from: string;
  readonly to: string;
}

export interface MonthlyHeatmap {
  readonly kind: HeatmapKind;
  /** Newest year first, like the reference sheet. */
  readonly rows: readonly HeatmapRow[];
  readonly stats: readonly HeatmapStatRow[];
  /** Date (YYYY-MM-DD, IST) of the latest data point. */
  readonly asOf: string | null;
  /** Latest index close or latest P/E. */
  readonly latestValue: number | null;
  readonly liveSpan: HeatmapSourceSpan | null;
  readonly archiveSpan: HeatmapSourceSpan | null;
}

export interface DatedValue {
  /** YYYY-MM-DD */
  readonly date: string;
  readonly value: number;
}

/** YYYY-MM -> % return, for months the live feed cannot reproduce. */
export type MonthlyReturnArchive = Readonly<Record<string, number>>;

/**
 * A live month that disagrees with the archive by more than this many
 * percentage points is treated as a feed gap (e.g. a missing month-end
 * session) and the archived figure is kept. Archive values are rounded to
 * 0.1, so anything within rounding is accepted as live.
 */
export const ARCHIVE_REPAIR_TOLERANCE_PP = 0.15;

const IST_OFFSET_MS = 19_800_000;

export function istDateKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function previousMonthKey(key: string): string {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7)) - 1;
  return month === 0 ? monthKey(year - 1, 11) : monthKey(year, month - 1);
}

/** Last valid value in each calendar month, keyed YYYY-MM. */
export function monthEndValues(
  series: readonly DatedValue[],
): Map<string, DatedValue> {
  const sorted = series
    .filter(
      (point) =>
        /^\d{4}-\d{2}-\d{2}$/.test(point.date) &&
        Number.isFinite(point.value) &&
        point.value > 0,
    )
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const result = new Map<string, DatedValue>();
  for (const point of sorted) result.set(point.date.slice(0, 7), point);
  return result;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Sample standard deviation (Excel STDEV). */
export function sampleStdDev(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const average = mean(values) as number;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function buildStats(
  rows: readonly HeatmapRow[],
  columnValue: (cell: HeatmapCell) => number,
): HeatmapStatRow[] {
  const monthColumns = Array.from({ length: 12 }, (_, monthIndex) =>
    rows
      .map((row) => row.months[monthIndex])
      .filter((cell): cell is HeatmapCell => cell !== null && !cell.partial)
      .map(columnValue),
  );
  const totals = rows
    .map((row) => row.total)
    .filter((cell): cell is HeatmapCell => cell !== null && !cell.partial)
    .map(columnValue);

  const stat = (
    label: HeatmapStatLabel,
    fn: (values: readonly number[]) => number | null,
  ): HeatmapStatRow => ({
    label,
    months: monthColumns.map((values) => fn(values)),
    total: fn(totals),
  });

  return [stat("Median", median), stat("SD", sampleStdDev), stat("Avg", mean)];
}

function spanOf(keys: readonly string[]): HeatmapSourceSpan | null {
  if (keys.length === 0) return null;
  const sorted = [...keys].sort();
  return { from: sorted[0], to: sorted[sorted.length - 1] };
}

export interface BuildReturnHeatmapInput {
  /** Daily closes (IST dates). */
  readonly closes: readonly DatedValue[];
  readonly archive: MonthlyReturnArchive;
  readonly now: Date;
}

/**
 * Monthly % returns from month-end closes, with the archive covering months
 * before the live feed begins and repairing closed months where the feed has
 * a gap. The calendar-year column compounds the months (equal to the
 * Dec-to-Dec close ratio when every month is live).
 */
export function buildReturnHeatmap(
  input: BuildReturnHeatmapInput,
): MonthlyHeatmap {
  const currentMonth = istDateKey(input.now).slice(0, 7);
  const monthEnds = monthEndValues(input.closes);
  const cells = new Map<string, HeatmapCell>();

  for (const [key, value] of Object.entries(input.archive)) {
    if (!/^\d{4}-\d{2}$/.test(key) || !Number.isFinite(value)) continue;
    cells.set(key, { value, change: value, source: "archive", partial: false });
  }

  const liveKeys: string[] = [];
  for (const [key, end] of monthEnds) {
    const previous = monthEnds.get(previousMonthKey(key));
    if (!previous) continue;
    const value = (end.value / previous.value - 1) * 100;
    const partial = key === currentMonth;
    const archived = cells.get(key);
    if (
      archived &&
      !partial &&
      Math.abs(archived.value - value) > ARCHIVE_REPAIR_TOLERANCE_PP
    ) {
      continue;
    }
    cells.set(key, { value, change: value, source: "live", partial });
    liveKeys.push(key);
  }

  const archiveKeys = [...cells]
    .filter(([, cell]) => cell.source === "archive")
    .map(([key]) => key);

  const years = [...new Set([...cells.keys()].map((key) => Number(key.slice(0, 4))))]
    .sort((a, b) => b - a);

  const rows: HeatmapRow[] = years.map((year) => {
    const months = Array.from(
      { length: 12 },
      (_, monthIndex) => cells.get(monthKey(year, monthIndex)) ?? null,
    );
    const present = months.filter((cell): cell is HeatmapCell => cell !== null);
    let total: HeatmapCell | null = null;
    if (present.length > 0) {
      const growth = present.reduce((acc, cell) => acc * (1 + cell.value / 100), 1);
      const value = (growth - 1) * 100;
      total = {
        value,
        change: value,
        source: present.every((cell) => cell.source === "archive") ? "archive" : "live",
        partial: present.length < 12 || present.some((cell) => cell.partial),
      };
    }
    return { year, months, total };
  });

  const latest = [...monthEnds.values()].at(-1) ?? null;

  return {
    kind: "return",
    rows,
    stats: buildStats(rows, (cell) => cell.value),
    asOf: latest?.date ?? null,
    latestValue: latest?.value ?? null,
    liveSpan: spanOf(liveKeys),
    archiveSpan: spanOf(archiveKeys),
  };
}

export interface BuildLevelHeatmapInput {
  readonly points: readonly DatedValue[];
  readonly now: Date;
}

/**
 * Month-end levels (e.g. index P/E). Each cell carries its % change from the
 * previous month-end, which colors it; the calendar-year column is the
 * year-end level with its change from the prior year-end.
 */
export function buildLevelHeatmap(input: BuildLevelHeatmapInput): MonthlyHeatmap {
  const currentMonth = istDateKey(input.now).slice(0, 7);
  const monthEnds = monthEndValues(input.points);
  const keys = [...monthEnds.keys()];

  const years = [...new Set(keys.map((key) => Number(key.slice(0, 4))))].sort(
    (a, b) => b - a,
  );

  const yearEnd = new Map<number, number>();
  for (const key of keys) yearEnd.set(Number(key.slice(0, 4)), monthEnds.get(key)!.value);

  const rows: HeatmapRow[] = years.map((year) => {
    const months = Array.from({ length: 12 }, (_, monthIndex) => {
      const key = monthKey(year, monthIndex);
      const end = monthEnds.get(key);
      if (!end) return null;
      const previous = monthEnds.get(previousMonthKey(key));
      return {
        value: end.value,
        change: previous ? (end.value / previous.value - 1) * 100 : null,
        source: "live" as const,
        partial: key === currentMonth,
      };
    });
    const lastMonthIndex = months.findLastIndex((cell) => cell !== null);
    const last = months[lastMonthIndex];
    const priorYearEnd = yearEnd.get(year - 1);
    const total: HeatmapCell | null = last
      ? {
          value: last.value,
          change: priorYearEnd ? (last.value / priorYearEnd - 1) * 100 : null,
          source: "live",
          partial: lastMonthIndex < 11 || last.partial,
        }
      : null;
    return { year, months, total };
  });

  const latest = [...monthEnds.values()].at(-1) ?? null;

  return {
    kind: "level",
    rows,
    stats: buildStats(rows, (cell) => cell.value),
    asOf: latest?.date ?? null,
    latestValue: latest?.value ?? null,
    liveSpan: spanOf(keys),
    archiveSpan: null,
  };
}

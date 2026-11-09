import type { ChartCandle } from "@/lib/market/chart-candles";
import { chartTimeToEpoch } from "./bar-index";

const DAY = 86_400;

export interface PerformanceRow {
  readonly id: "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y";
  readonly label: string;
  /** Percent change from the close at the start of the period, or null. */
  readonly change: number | null;
}

export type RangeId =
  "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "ALL";

export const RANGE_IDS: readonly RangeId[] = [
  "1D",
  "5D",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "5Y",
  "ALL",
];

/** Timeframe a range switches to, so "1D" is a day of intraday bars. */
export const RANGE_TIMEFRAME: Readonly<
  Record<RangeId, "5" | "15" | "60" | "D" | "W" | "M">
> = {
  "1D": "5",
  "5D": "15",
  "1M": "60",
  "3M": "D",
  "6M": "D",
  YTD: "D",
  "1Y": "D",
  "5Y": "W",
  ALL: "M",
};

function startOfPeriod(lastEpoch: number, id: PerformanceRow["id"]): number {
  const last = new Date(lastEpoch * 1_000);
  switch (id) {
    case "1W":
      return lastEpoch - 7 * DAY;
    case "1M":
      return (
        Date.UTC(
          last.getUTCFullYear(),
          last.getUTCMonth() - 1,
          last.getUTCDate(),
        ) / 1_000
      );
    case "3M":
      return (
        Date.UTC(
          last.getUTCFullYear(),
          last.getUTCMonth() - 3,
          last.getUTCDate(),
        ) / 1_000
      );
    case "6M":
      return (
        Date.UTC(
          last.getUTCFullYear(),
          last.getUTCMonth() - 6,
          last.getUTCDate(),
        ) / 1_000
      );
    case "1Y":
      return (
        Date.UTC(
          last.getUTCFullYear() - 1,
          last.getUTCMonth(),
          last.getUTCDate(),
        ) / 1_000
      );
    case "YTD":
      return Date.UTC(last.getUTCFullYear() - 1, 11, 31) / 1_000;
  }
}

/** Close of the last bar at or before the period start. */
function closeAtOrBefore(
  epochs: readonly number[],
  candles: readonly ChartCandle[],
  target: number,
): number | null {
  let result: number | null = null;
  for (let index = 0; index < epochs.length; index += 1) {
    if (epochs[index]! > target) break;
    result = candles[index]!.close;
  }
  return result;
}

/**
 * Trading bars behind each performance window, mirroring TradingView's
 * performance table (5 daily bars a week, ~21 a month, 251 a year).
 */
const PERFORMANCE_BARS: Readonly<
  Record<Exclude<PerformanceRow["id"], "YTD">, number>
> = { "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 251 };

export function computePerformance(
  daily: readonly ChartCandle[],
): PerformanceRow[] {
  const ids: PerformanceRow["id"][] = ["1W", "1M", "3M", "6M", "YTD", "1Y"];
  const empty = ids.map((id) => ({ id, label: id, change: null }));
  const lastCandle = daily[daily.length - 1];
  if (!lastCandle) return empty;

  let ytdBase: number | null = null;
  if (daily.length > 0) {
    const epochs = daily.map((candle) => chartTimeToEpoch(candle.time));
    const lastEpoch = epochs[epochs.length - 1]!;
    ytdBase = closeAtOrBefore(epochs, daily, startOfPeriod(lastEpoch, "YTD"));
  }
  return ids.map((id) => {
    const base =
      id === "YTD"
        ? ytdBase
        : (daily[daily.length - 1 - PERFORMANCE_BARS[id]]?.close ?? null);
    const change =
      base !== null && base > 0
        ? ((lastCandle.close - base) / base) * 100
        : null;
    return { id, label: id, change };
  });
}

export interface SeasonalMonth {
  /** 0 = January. */
  readonly month: number;
  readonly averageReturn: number | null;
  readonly winRate: number | null;
  readonly samples: number;
}

/** Average month-over-month return for each calendar month, from daily bars. */
export function computeSeasonality(
  daily: readonly ChartCandle[],
): SeasonalMonth[] {
  const monthEndClose = new Map<string, number>();
  for (const candle of daily) {
    const key = typeof candle.time === "string" ? candle.time.slice(0, 7) : "";
    if (key) monthEndClose.set(key, candle.close);
  }

  const keys = [...monthEndClose.keys()].sort();
  const returns: number[][] = Array.from({ length: 12 }, () => []);
  for (let index = 1; index < keys.length; index += 1) {
    const previous = monthEndClose.get(keys[index - 1]!)!;
    const current = monthEndClose.get(keys[index]!)!;
    if (previous <= 0) continue;
    const month = Number(keys[index]!.slice(5, 7)) - 1;
    returns[month]!.push(((current - previous) / previous) * 100);
  }

  return returns.map((values, month) => {
    if (values.length === 0) {
      return { month, averageReturn: null, winRate: null, samples: 0 };
    }
    const sum = values.reduce((total, value) => total + value, 0);
    const wins = values.filter((value) => value > 0).length;
    return {
      month,
      averageReturn: sum / values.length,
      winRate: (wins / values.length) * 100,
      samples: values.length,
    };
  });
}

/**
 * Epoch window a range button should show, anchored on the newest bar. `null`
 * means "everything".
 */
export function rangeStartEpoch(
  range: RangeId,
  lastEpoch: number,
): number | null {
  const last = new Date(lastEpoch * 1_000);
  switch (range) {
    case "1D":
      // Intraday times are already IST wall-clock seconds, so a day starts at a multiple of 86,400.
      return Math.floor(lastEpoch / DAY) * DAY;
    case "5D":
      return lastEpoch - 5 * DAY;
    case "1M":
      return lastEpoch - 30 * DAY;
    case "3M":
      return (
        Date.UTC(
          last.getUTCFullYear(),
          last.getUTCMonth() - 3,
          last.getUTCDate(),
        ) / 1_000
      );
    case "6M":
      return (
        Date.UTC(
          last.getUTCFullYear(),
          last.getUTCMonth() - 6,
          last.getUTCDate(),
        ) / 1_000
      );
    case "YTD":
      return Date.UTC(last.getUTCFullYear(), 0, 1) / 1_000;
    case "1Y":
      return (
        Date.UTC(
          last.getUTCFullYear() - 1,
          last.getUTCMonth(),
          last.getUTCDate(),
        ) / 1_000
      );
    case "5Y":
      return (
        Date.UTC(
          last.getUTCFullYear() - 5,
          last.getUTCMonth(),
          last.getUTCDate(),
        ) / 1_000
      );
    case "ALL":
      return null;
  }
}

export interface RegressionFit {
  readonly slope: number;
  readonly intercept: number;
  /** Standard deviation of the closes around the fitted line. */
  readonly sigma: number;
}

/**
 * Candles inside a range window, anchored on the newest bar. The caller
 * fetches the range's underlying timeframe (see RANGE_TIMEFRAME) and then
 * re-slices here, so "1D" shows intraday bars when available while longer
 * ranges show daily/weekly/monthly bars. "ALL" returns everything.
 */
export function sliceCandlesToRange(
  candles: readonly ChartCandle[],
  range: RangeId,
): ChartCandle[] {
  if (range === "ALL" || candles.length === 0) return [...candles];
  const last = candles[candles.length - 1]!;
  const start = rangeStartEpoch(range, chartTimeToEpoch(last.time));
  if (start === null) return [...candles];
  return candles.filter((candle) => chartTimeToEpoch(candle.time) >= start);
}

/** Index of the first candle on or after an ISO date, or -1 when absent. */
export function indexAtOrAfterDate(
  candles: readonly ChartCandle[],
  isoDate: string,
): number {
  const target = Date.parse(`${isoDate}T00:00:00Z`) / 1_000;
  if (!Number.isFinite(target)) return -1;
  const epochs = candles.map((candle) => chartTimeToEpoch(candle.time));
  for (let index = 0; index < epochs.length; index += 1) {
    if (epochs[index]! >= target) return index;
  }
  return -1;
}

/** Least-squares line through `closes[first..last]`, indexed by bar position. */
export function linearRegression(
  closes: readonly number[],
  first: number,
  last: number,
): RegressionFit | null {
  const count = last - first + 1;
  if (count < 2 || first < 0 || last >= closes.length) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let index = first; index <= last; index += 1) {
    const y = closes[index]!;
    sumX += index;
    sumY += y;
    sumXY += index * y;
    sumXX += index * index;
  }
  const denominator = count * sumXX - sumX * sumX;
  const slope =
    denominator === 0 ? 0 : (count * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / count;

  let squares = 0;
  for (let index = first; index <= last; index += 1) {
    const residual = closes[index]! - (slope * index + intercept);
    squares += residual * residual;
  }
  return { slope, intercept, sigma: Math.sqrt(squares / count) };
}

import type { ChartCandle, ChartTime } from "@/lib/market/chart-candles";

const DAY_SECONDS = 86_400;

/** Chart time (a `YYYY-MM-DD` string or unix seconds) as unix seconds. */
export function chartTimeToEpoch(time: ChartTime): number {
  if (typeof time === "number") return time;
  return Date.parse(`${time}T00:00:00Z`) / 1_000;
}

export function epochToChartTime(epoch: number, daily: boolean): ChartTime {
  if (!daily) return Math.round(epoch);
  return new Date(epoch * 1_000).toISOString().slice(0, 10);
}

/**
 * Maps between time and the chart's fractional bar index. Drawings are stored
 * in time and price so they survive a timeframe change, but the chart only
 * knows bars: this bridges the two, interpolating between bars and
 * extrapolating past the ends (a trend line may reach into the future).
 */
export class BarIndex {
  public readonly epochs: readonly number[];
  public readonly daily: boolean;
  private readonly step: number;

  public constructor(candles: readonly ChartCandle[]) {
    this.epochs = candles.map((candle) => chartTimeToEpoch(candle.time));
    this.daily = candles.length > 0 && typeof candles[0]!.time === "string";
    this.step = estimateStep(this.epochs, this.daily);
  }

  public get length(): number {
    return this.epochs.length;
  }

  public toLogical(epoch: number): number {
    const { epochs } = this;
    const count = epochs.length;
    if (count === 0) return 0;
    const first = epochs[0]!;
    const last = epochs[count - 1]!;
    if (epoch <= first) return (epoch - first) / this.step;
    if (epoch >= last) return count - 1 + (epoch - last) / this.step;

    let low = 0;
    let high = count - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (epochs[middle]! <= epoch) low = middle;
      else high = middle;
    }
    const start = epochs[low]!;
    const span = epochs[high]! - start;
    return low + (span > 0 ? (epoch - start) / span : 0);
  }

  public toEpoch(logical: number): number {
    const { epochs } = this;
    const count = epochs.length;
    if (count === 0) return 0;
    if (logical <= 0) return epochs[0]! + logical * this.step;
    if (logical >= count - 1) {
      return epochs[count - 1]! + (logical - (count - 1)) * this.step;
    }
    const low = Math.floor(logical);
    const start = epochs[low]!;
    return start + (logical - low) * (epochs[low + 1]! - start);
  }

  /** Index of the bar closest to a logical position, clamped to the data. */
  public nearestIndex(logical: number): number {
    if (this.epochs.length === 0) return -1;
    return Math.min(this.epochs.length - 1, Math.max(0, Math.round(logical)));
  }

  /** First bar at or after the epoch; `length` when every bar is earlier. */
  public firstIndexAtOrAfter(epoch: number): number {
    let low = 0;
    let high = this.epochs.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (this.epochs[middle]! < epoch) low = middle + 1;
      else high = middle;
    }
    return low;
  }
}

function estimateStep(epochs: readonly number[], daily: boolean): number {
  if (epochs.length < 2) return daily ? DAY_SECONDS : 60;
  const deltas: number[] = [];
  for (
    let index = Math.max(1, epochs.length - 40);
    index < epochs.length;
    index += 1
  ) {
    const delta = epochs[index]! - epochs[index - 1]!;
    if (delta > 0) deltas.push(delta);
  }
  if (deltas.length === 0) return daily ? DAY_SECONDS : 60;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)]!;
}

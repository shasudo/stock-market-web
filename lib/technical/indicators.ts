import { getCandleSessionKey } from "./timeframes";
import {
  type Candle,
  type NullableNumber,
  type NumericSeries,
  hasFiniteVolume,
  isFiniteNumber,
  isValidCandle,
  toNullableNumber,
} from "./types";

export interface MacdOptions {
  readonly fastPeriod?: number;
  readonly slowPeriod?: number;
  readonly signalPeriod?: number;
}

export interface MacdResult {
  readonly macd: NullableNumber[];
  readonly signal: NullableNumber[];
  readonly histogram: NullableNumber[];
}

export interface BollingerBands {
  readonly middle: NullableNumber[];
  readonly upper: NullableNumber[];
  readonly lower: NullableNumber[];
  readonly bandwidth: NullableNumber[];
  readonly percentB: NullableNumber[];
}

export interface VolumeAnalysis {
  readonly volume: NullableNumber[];
  readonly average: NullableNumber[];
  readonly relative: NullableNumber[];
  readonly spike: (boolean | null)[];
}

export interface VwapOptions {
  readonly timeZone?: string;
}

export function closeSeries(candles: readonly Candle[]): NullableNumber[] {
  return candles.map((candle) => (isValidCandle(candle) ? candle.close : null));
}

export function simpleMovingAverage(
  values: NumericSeries,
  period: number,
): NullableNumber[] {
  const result = emptyNumberSeries(values.length);
  if (!isValidPeriod(period)) return result;

  const window: number[] = [];
  let sum = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = toNullableNumber(values[index]);
    if (value === null) {
      window.length = 0;
      sum = 0;
      continue;
    }

    window.push(value);
    sum += value;
    if (window.length > period) sum -= window.shift() as number;
    if (window.length === period) result[index] = sum / period;
  }

  return result;
}

/**
 * EMA is seeded with an SMA and resets after a missing value. Resetting avoids
 * carrying an old value through an unknown section of the price series.
 */
export function exponentialMovingAverage(
  values: NumericSeries,
  period: number,
): NullableNumber[] {
  const result = emptyNumberSeries(values.length);
  if (!isValidPeriod(period)) return result;

  const multiplier = 2 / (period + 1);
  const seed: number[] = [];
  let ema: number | null = null;

  for (let index = 0; index < values.length; index += 1) {
    const value = toNullableNumber(values[index]);
    if (value === null) {
      seed.length = 0;
      ema = null;
      continue;
    }

    if (ema === null) {
      seed.push(value);
      if (seed.length > period) seed.shift();
      if (seed.length === period) {
        ema = average(seed);
        result[index] = ema;
      }
      continue;
    }

    ema = value * multiplier + ema * (1 - multiplier);
    result[index] = ema;
  }

  return result;
}

/**
 * SMMA/RMA. Identical to the smoothing Wilder's indicators use internally, but
 * exposed under the name charting tools plot it as.
 */
export function smoothedMovingAverage(
  values: NumericSeries,
  period: number,
): NullableNumber[] {
  return wilderSmoothedAverage(values, period);
}

export function relativeStrengthIndex(
  values: NumericSeries,
  period = 14,
): NullableNumber[] {
  const result = emptyNumberSeries(values.length);
  if (!isValidPeriod(period)) return result;

  let previous: number | null = null;
  const gainSeed: number[] = [];
  const lossSeed: number[] = [];
  let averageGain: number | null = null;
  let averageLoss: number | null = null;

  for (let index = 0; index < values.length; index += 1) {
    const value = toNullableNumber(values[index]);
    if (value === null) {
      previous = null;
      gainSeed.length = 0;
      lossSeed.length = 0;
      averageGain = null;
      averageLoss = null;
      continue;
    }

    if (previous === null) {
      previous = value;
      continue;
    }

    const change = value - previous;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    previous = value;

    if (averageGain === null || averageLoss === null) {
      gainSeed.push(gain);
      lossSeed.push(loss);
      if (gainSeed.length < period) continue;

      averageGain = average(gainSeed);
      averageLoss = average(lossSeed);
    } else {
      averageGain = (averageGain * (period - 1) + gain) / period;
      averageLoss = (averageLoss * (period - 1) + loss) / period;
    }

    result[index] = rsiValue(averageGain, averageLoss);
  }

  return result;
}

export function movingAverageConvergenceDivergence(
  values: NumericSeries,
  options: MacdOptions = {},
): MacdResult {
  const fastPeriod = options.fastPeriod ?? 12;
  const slowPeriod = options.slowPeriod ?? 26;
  const signalPeriod = options.signalPeriod ?? 9;
  const empty = emptyNumberSeries(values.length);

  if (
    !isValidPeriod(fastPeriod) ||
    !isValidPeriod(slowPeriod) ||
    !isValidPeriod(signalPeriod) ||
    fastPeriod >= slowPeriod
  ) {
    return { macd: empty, signal: [...empty], histogram: [...empty] };
  }

  const fast = exponentialMovingAverage(values, fastPeriod);
  const slow = exponentialMovingAverage(values, slowPeriod);
  const macd = values.map((_, index) => {
    const fastValue = fast[index];
    const slowValue = slow[index];
    return fastValue === null || slowValue === null
      ? null
      : fastValue - slowValue;
  });
  const signal = exponentialMovingAverage(macd, signalPeriod);
  const histogram = macd.map((value, index) => {
    const signalValue = signal[index];
    return value === null || signalValue === null ? null : value - signalValue;
  });

  return { macd, signal, histogram };
}

export function trueRange(candles: readonly Candle[]): NullableNumber[] {
  const result = emptyNumberSeries(candles.length);
  let previousClose: number | null = null;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    if (!isValidCandle(candle)) {
      previousClose = null;
      continue;
    }

    const highLow = candle.high - candle.low;
    result[index] =
      previousClose === null
        ? highLow
        : Math.max(
            highLow,
            Math.abs(candle.high - previousClose),
            Math.abs(candle.low - previousClose),
          );
    previousClose = candle.close;
  }

  return result;
}

export function averageTrueRange(
  candles: readonly Candle[],
  period = 14,
): NullableNumber[] {
  return wilderSmoothedAverage(trueRange(candles), period);
}

export function bollingerBands(
  values: NumericSeries,
  period = 20,
  standardDeviationMultiplier = 2,
): BollingerBands {
  const middle = emptyNumberSeries(values.length);
  const upper = emptyNumberSeries(values.length);
  const lower = emptyNumberSeries(values.length);
  const bandwidth = emptyNumberSeries(values.length);
  const percentB = emptyNumberSeries(values.length);

  if (
    !isValidPeriod(period) ||
    !isFiniteNumber(standardDeviationMultiplier) ||
    standardDeviationMultiplier < 0
  ) {
    return { middle, upper, lower, bandwidth, percentB };
  }

  const window: number[] = [];
  let sum = 0;
  let sumSquares = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = toNullableNumber(values[index]);
    if (value === null) {
      window.length = 0;
      sum = 0;
      sumSquares = 0;
      continue;
    }

    window.push(value);
    sum += value;
    sumSquares += value * value;
    if (window.length > period) {
      const removed = window.shift() as number;
      sum -= removed;
      sumSquares -= removed * removed;
    }
    if (window.length !== period) continue;

    const mean = sum / period;
    const variance = Math.max(0, sumSquares / period - mean * mean);
    const deviation = Math.sqrt(variance);
    const upperValue = mean + standardDeviationMultiplier * deviation;
    const lowerValue = mean - standardDeviationMultiplier * deviation;
    const width = upperValue - lowerValue;

    middle[index] = mean;
    upper[index] = upperValue;
    lower[index] = lowerValue;
    bandwidth[index] = mean === 0 ? null : (width / mean) * 100;
    percentB[index] = width === 0 ? null : (value - lowerValue) / width;
  }

  return { middle, upper, lower, bandwidth, percentB };
}

/**
 * Session VWAP. If a candle in a session has no trustworthy volume, remaining
 * values in that session are null instead of silently omitting traded volume.
 */
export function volumeWeightedAveragePrice(
  candles: readonly Candle[],
  options: VwapOptions = {},
): NullableNumber[] {
  const result = emptyNumberSeries(candles.length);
  let currentSession: string | null = null;
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;
  let sessionHasCompleteVolume = true;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    if (!isValidCandle(candle)) {
      sessionHasCompleteVolume = false;
      continue;
    }

    const session = getCandleSessionKey(candle.timestamp, options.timeZone);
    if (session !== currentSession) {
      currentSession = session;
      cumulativePriceVolume = 0;
      cumulativeVolume = 0;
      sessionHasCompleteVolume = true;
    }

    if (!hasFiniteVolume(candle)) {
      sessionHasCompleteVolume = false;
      continue;
    }

    if (!sessionHasCompleteVolume) continue;

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativePriceVolume += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;
    result[index] =
      cumulativeVolume === 0 ? null : cumulativePriceVolume / cumulativeVolume;
  }

  return result;
}

export function analyzeVolume(
  candles: readonly Candle[],
  period = 20,
  spikeMultiplier = 2,
): VolumeAnalysis {
  const volume = candles.map((candle) =>
    isValidCandle(candle) && hasFiniteVolume(candle) ? candle.volume : null,
  );
  const average = simpleMovingAverage(volume, period);
  const relative = volume.map((value, index) => {
    const averageValue = average[index];
    return value === null || averageValue === null || averageValue <= 0
      ? null
      : value / averageValue;
  });
  const spike = relative.map((value) =>
    value === null || !isFiniteNumber(spikeMultiplier)
      ? null
      : value >= spikeMultiplier,
  );

  return { volume, average, relative, spike };
}

export function rollingStandardDeviation(
  values: NumericSeries,
  period = 20,
): NullableNumber[] {
  const bands = bollingerBands(values, period, 1);
  return bands.upper.map((upper, index) => {
    const middle = bands.middle[index];
    return upper === null || middle === null ? null : upper - middle;
  });
}

export function historicalVolatility(
  values: NumericSeries,
  period = 20,
  annualizationPeriods = 252,
): NullableNumber[] {
  if (!isValidPeriod(period) || !isFiniteNumber(annualizationPeriods)) {
    return emptyNumberSeries(values.length);
  }

  const returns = emptyNumberSeries(values.length);
  let previous: number | null = null;
  for (let index = 0; index < values.length; index += 1) {
    const value = toNullableNumber(values[index]);
    if (value === null || value <= 0 || previous === null || previous <= 0) {
      previous = value;
      continue;
    }
    returns[index] = Math.log(value / previous);
    previous = value;
  }

  return rollingStandardDeviation(returns, period).map((deviation) =>
    deviation === null
      ? null
      : deviation * Math.sqrt(annualizationPeriods) * 100,
  );
}

export function periodReturn(
  values: NumericSeries,
  periods = 1,
): NullableNumber[] {
  const result = emptyNumberSeries(values.length);
  if (!isValidPeriod(periods)) return result;

  for (let index = periods; index < values.length; index += 1) {
    const current = toNullableNumber(values[index]);
    const prior = toNullableNumber(values[index - periods]);
    if (current === null || prior === null || prior === 0) continue;
    result[index] = ((current - prior) / prior) * 100;
  }

  return result;
}

export function maximumDrawdown(values: NumericSeries): NullableNumber[] {
  const result = emptyNumberSeries(values.length);
  let highWaterMark: number | null = null;

  for (let index = 0; index < values.length; index += 1) {
    const value = toNullableNumber(values[index]);
    if (value === null || value <= 0) {
      highWaterMark = null;
      continue;
    }

    highWaterMark =
      highWaterMark === null ? value : Math.max(highWaterMark, value);
    result[index] = ((value - highWaterMark) / highWaterMark) * 100;
  }

  return result;
}

export function crossesAbove(
  left: NumericSeries,
  right: NumericSeries,
): (boolean | null)[] {
  return crosses(left, right, "above");
}

export function crossesBelow(
  left: NumericSeries,
  right: NumericSeries,
): (boolean | null)[] {
  return crosses(left, right, "below");
}

function crosses(
  left: NumericSeries,
  right: NumericSeries,
  direction: "above" | "below",
): (boolean | null)[] {
  const length = Math.max(left.length, right.length);
  const result: (boolean | null)[] = Array.from({ length }, () => null);

  for (let index = 1; index < length; index += 1) {
    const priorLeft = toNullableNumber(left[index - 1]);
    const priorRight = toNullableNumber(right[index - 1]);
    const currentLeft = toNullableNumber(left[index]);
    const currentRight = toNullableNumber(right[index]);
    if (
      priorLeft === null ||
      priorRight === null ||
      currentLeft === null ||
      currentRight === null
    ) {
      continue;
    }

    result[index] =
      direction === "above"
        ? priorLeft <= priorRight && currentLeft > currentRight
        : priorLeft >= priorRight && currentLeft < currentRight;
  }

  return result;
}

function wilderSmoothedAverage(
  values: NumericSeries,
  period: number,
): NullableNumber[] {
  const result = emptyNumberSeries(values.length);
  if (!isValidPeriod(period)) return result;

  const seed: number[] = [];
  let smoothed: number | null = null;
  for (let index = 0; index < values.length; index += 1) {
    const value = toNullableNumber(values[index]);
    if (value === null) {
      seed.length = 0;
      smoothed = null;
      continue;
    }

    if (smoothed === null) {
      seed.push(value);
      if (seed.length === period) {
        smoothed = average(seed);
        result[index] = smoothed;
      }
      continue;
    }

    smoothed = (smoothed * (period - 1) + value) / period;
    result[index] = smoothed;
  }

  return result;
}

function rsiValue(averageGain: number, averageLoss: number): number {
  if (averageLoss === 0 && averageGain === 0) return 50;
  if (averageLoss === 0) return 100;
  if (averageGain === 0) return 0;
  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function emptyNumberSeries(length: number): NullableNumber[] {
  return Array.from({ length }, () => null);
}

function isValidPeriod(period: number): boolean {
  return Number.isSafeInteger(period) && period > 0;
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

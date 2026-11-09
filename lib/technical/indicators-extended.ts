/**
 * Indicators beyond the original core set, each implemented from its
 * published definition with TradingView's default parameters (noted per
 * function) so that a value here can be checked against a chart of the same
 * candles. Every function returns a series aligned with its input; warm-up
 * bars are null. Inputs are expected to be normalized candles (see
 * normalizeCandles) — no nulls inside a series.
 */
import {
  exponentialMovingAverage,
  relativeStrengthIndex,
  simpleMovingAverage,
  smoothedMovingAverage,
  trueRange,
} from "./indicators";
import { type Candle, type NullableNumber } from "./types";

type Series = readonly number[];

function empty(length: number): NullableNumber[] {
  return Array.from({ length }, () => null);
}

function validPeriod(period: number): boolean {
  return Number.isSafeInteger(period) && period > 0;
}

function num(values: readonly NullableNumber[]): Series {
  return values.map((value) => (value === null ? Number.NaN : value));
}

function fromNaN(values: Series): NullableNumber[] {
  return values.map((value) => (Number.isFinite(value) ? value : null));
}

function rollingMax(values: Series, period: number): NullableNumber[] {
  const result = empty(values.length);
  for (let index = period - 1; index < values.length; index += 1) {
    let max = -Infinity;
    for (let back = index - period + 1; back <= index; back += 1) {
      const value = values[back]!;
      if (!Number.isFinite(value)) {
        max = Number.NaN;
        break;
      }
      if (value > max) max = value;
    }
    result[index] = Number.isFinite(max) ? max : null;
  }
  return result;
}

function rollingMin(values: Series, period: number): NullableNumber[] {
  const result = empty(values.length);
  for (let index = period - 1; index < values.length; index += 1) {
    let min = Infinity;
    for (let back = index - period + 1; back <= index; back += 1) {
      const value = values[back]!;
      if (!Number.isFinite(value)) {
        min = Number.NaN;
        break;
      }
      if (value < min) min = value;
    }
    result[index] = Number.isFinite(min) ? min : null;
  }
  return result;
}

function rollingSum(values: Series, period: number): NullableNumber[] {
  const result = empty(values.length);
  for (let index = period - 1; index < values.length; index += 1) {
    let sum = 0;
    for (let back = index - period + 1; back <= index; back += 1) {
      sum += values[back]!;
    }
    result[index] = Number.isFinite(sum) ? sum : null;
  }
  return result;
}

const sma = (values: Series, period: number): NullableNumber[] =>
  simpleMovingAverage(values, period);
const ema = (values: Series, period: number): NullableNumber[] =>
  exponentialMovingAverage(values, period);
const rma = (values: Series, period: number): NullableNumber[] =>
  smoothedMovingAverage(values, period);

function closes(candles: readonly Candle[]): Series {
  return candles.map((candle) => candle.close);
}
function highs(candles: readonly Candle[]): Series {
  return candles.map((candle) => candle.high);
}
function lows(candles: readonly Candle[]): Series {
  return candles.map((candle) => candle.low);
}
function volumes(candles: readonly Candle[]): Series {
  return candles.map((candle) => candle.volume ?? Number.NaN);
}
function hl2(candles: readonly Candle[]): Series {
  return candles.map((candle) => (candle.high + candle.low) / 2);
}
function hlc3(candles: readonly Candle[]): Series {
  return candles.map((candle) => (candle.high + candle.low + candle.close) / 3);
}

/* ------------------------------------------------------------------------ */
/* Moving averages                                                          */
/* ------------------------------------------------------------------------ */

/** Linearly weighted moving average; the newest bar carries weight `period`. */
export function weightedMovingAverage(
  values: Series,
  period: number,
): NullableNumber[] {
  const result = empty(values.length);
  if (!validPeriod(period)) return result;
  const norm = (period * (period + 1)) / 2;
  for (let index = period - 1; index < values.length; index += 1) {
    let sum = 0;
    for (let offset = 0; offset < period; offset += 1) {
      sum += values[index - offset]! * (period - offset);
    }
    result[index] = Number.isFinite(sum) ? sum / norm : null;
  }
  return result;
}

/** Hull MA: WMA(2·WMA(n/2) − WMA(n), √n), integer lengths rounded down / to nearest. */
export function hullMovingAverage(
  values: Series,
  period: number,
): NullableNumber[] {
  if (!validPeriod(period)) return empty(values.length);
  const half = weightedMovingAverage(values, Math.floor(period / 2));
  const full = weightedMovingAverage(values, period);
  const diff = values.map((_, index) => {
    const h = half[index];
    const f = full[index];
    return h === null || f === null ? Number.NaN : 2 * h - f;
  });
  return weightedMovingAverage(diff, Math.round(Math.sqrt(period)));
}

/** Volume-weighted MA: Σ(close·volume) / Σvolume over `period`. */
export function volumeWeightedMovingAverage(
  candles: readonly Candle[],
  period: number,
): NullableNumber[] {
  const result = empty(candles.length);
  if (!validPeriod(period)) return result;
  const volume = volumes(candles);
  const priceVolume = candles.map(
    (candle, index) => candle.close * volume[index]!,
  );
  const sumPv = rollingSum(priceVolume, period);
  const sumV = rollingSum(volume, period);
  for (let index = 0; index < candles.length; index += 1) {
    const pv = sumPv[index];
    const v = sumV[index];
    result[index] = pv === null || v === null || v === 0 ? null : pv / v;
  }
  return result;
}

/** DEMA = 2·EMA − EMA(EMA). */
export function doubleExponentialMovingAverage(
  values: Series,
  period: number,
): NullableNumber[] {
  const first = ema(values, period);
  const second = ema(num(first), period);
  return values.map((_, index) => {
    const a = first[index];
    const b = second[index];
    return a === null || b === null ? null : 2 * a - b;
  });
}

/** TEMA = 3·EMA − 3·EMA(EMA) + EMA(EMA(EMA)). */
export function tripleExponentialMovingAverage(
  values: Series,
  period: number,
): NullableNumber[] {
  const first = ema(values, period);
  const second = ema(num(first), period);
  const third = ema(num(second), period);
  return values.map((_, index) => {
    const a = first[index];
    const b = second[index];
    const c = third[index];
    return a === null || b === null || c === null ? null : 3 * a - 3 * b + c;
  });
}

/**
 * Kaufman's adaptive MA. Efficiency ratio over `period`, smoothing constant
 * squared between the fast (2) and slow (30) EMA constants; seeded with the
 * first price after the warm-up, as Kaufman specifies.
 */
export function kaufmanAdaptiveMovingAverage(
  values: Series,
  period = 10,
  fast = 2,
  slow = 30,
): NullableNumber[] {
  const result = empty(values.length);
  if (!validPeriod(period) || values.length <= period) return result;
  const fastest = 2 / (fast + 1);
  const slowest = 2 / (slow + 1);
  let kama = values[period - 1]!;
  result[period - 1] = kama;
  for (let index = period; index < values.length; index += 1) {
    const change = Math.abs(values[index]! - values[index - period]!);
    let volatility = 0;
    for (let back = index - period + 1; back <= index; back += 1) {
      volatility += Math.abs(values[back]! - values[back - 1]!);
    }
    const efficiency = volatility === 0 ? 0 : change / volatility;
    const smoothing = (efficiency * (fastest - slowest) + slowest) ** 2;
    kama = kama + smoothing * (values[index]! - kama);
    result[index] = kama;
  }
  return result;
}

/** Arnaud Legoux MA with Gaussian weights (offset 0.85, sigma 6). */
export function arnaudLegouxMovingAverage(
  values: Series,
  period = 9,
  offset = 0.85,
  sigma = 6,
): NullableNumber[] {
  const result = empty(values.length);
  if (!validPeriod(period)) return result;
  const m = offset * (period - 1);
  const s = period / sigma;
  const weights = Array.from({ length: period }, (_, i) =>
    Math.exp(-((i - m) ** 2) / (2 * s * s)),
  );
  const norm = weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = period - 1; index < values.length; index += 1) {
    let sum = 0;
    for (let i = 0; i < period; i += 1) {
      sum += values[index - period + 1 + i]! * weights[i]!;
    }
    result[index] = Number.isFinite(sum) ? sum / norm : null;
  }
  return result;
}

/** Tillson T3 (length 5, volume factor 0.7): six chained EMAs combined with the T3 coefficients. */
export function tillsonT3(
  values: Series,
  period = 5,
  volumeFactor = 0.7,
): NullableNumber[] {
  const e1 = ema(values, period);
  const e2 = ema(num(e1), period);
  const e3 = ema(num(e2), period);
  const e4 = ema(num(e3), period);
  const e5 = ema(num(e4), period);
  const e6 = ema(num(e5), period);
  const a = volumeFactor;
  const c1 = -(a ** 3);
  const c2 = 3 * a * a + 3 * a ** 3;
  const c3 = -6 * a * a - 3 * a - 3 * a ** 3;
  const c4 = 1 + 3 * a + a ** 3 + 3 * a * a;
  return values.map((_, index) => {
    const v3 = e3[index];
    const v4 = e4[index];
    const v5 = e5[index];
    const v6 = e6[index];
    return v3 === null || v4 === null || v5 === null || v6 === null
      ? null
      : c1 * v6 + c2 * v5 + c3 * v4 + c4 * v3;
  });
}

/** Least-squares MA: the end value of the linear regression line over `period`. */
export function leastSquaresMovingAverage(
  values: Series,
  period = 25,
): NullableNumber[] {
  const result = empty(values.length);
  if (!validPeriod(period)) return result;
  const xMean = (period - 1) / 2;
  let xVariance = 0;
  for (let i = 0; i < period; i += 1) xVariance += (i - xMean) ** 2;
  for (let index = period - 1; index < values.length; index += 1) {
    let yMean = 0;
    for (let i = 0; i < period; i += 1)
      yMean += values[index - period + 1 + i]!;
    yMean /= period;
    let covariance = 0;
    for (let i = 0; i < period; i += 1) {
      covariance += (i - xMean) * (values[index - period + 1 + i]! - yMean);
    }
    const slope = covariance / xVariance;
    const intercept = yMean - slope * xMean;
    result[index] = intercept + slope * (period - 1);
  }
  return result;
}

/* ------------------------------------------------------------------------ */
/* Momentum                                                                 */
/* ------------------------------------------------------------------------ */

/** Percent rate of change over `period`: (close / close[period] − 1) · 100. */
export function rateOfChange(values: Series, period = 9): NullableNumber[] {
  const result = empty(values.length);
  if (!validPeriod(period)) return result;
  for (let index = period; index < values.length; index += 1) {
    const prior = values[index - period]!;
    result[index] =
      prior === 0 ? null : ((values[index]! - prior) / prior) * 100;
  }
  return result;
}

/** Momentum: close − close[period]. */
export function momentum(values: Series, period = 10): NullableNumber[] {
  const result = empty(values.length);
  if (!validPeriod(period)) return result;
  for (let index = period; index < values.length; index += 1) {
    result[index] = values[index]! - values[index - period]!;
  }
  return result;
}

export interface StochasticResult {
  readonly k: NullableNumber[];
  readonly d: NullableNumber[];
}

/**
 * Stochastic oscillator. Raw %K = 100·(close − lowest low) / (highest high −
 * lowest low) over `kPeriod`, smoothed by an SMA of `smoothK`; %D is an SMA
 * of `dPeriod` over %K. TradingView's defaults are 14 / 1 / 3 ("fast");
 * "slow" uses smoothK 3.
 */
export function stochasticOscillator(
  candles: readonly Candle[],
  kPeriod = 14,
  smoothK = 1,
  dPeriod = 3,
): StochasticResult {
  const raw = empty(candles.length);
  if (validPeriod(kPeriod)) {
    const highest = rollingMax(highs(candles), kPeriod);
    const lowest = rollingMin(lows(candles), kPeriod);
    for (let index = 0; index < candles.length; index += 1) {
      const hh = highest[index];
      const ll = lowest[index];
      if (hh === null || ll === null) continue;
      raw[index] =
        hh === ll ? 50 : ((candles[index]!.close - ll) / (hh - ll)) * 100;
    }
  }
  const k = smoothK > 1 ? sma(num(raw), smoothK) : raw;
  return { k, d: sma(num(k), dPeriod) };
}

/** Stochastic RSI: the stochastic of RSI(`rsiPeriod`) over `stochPeriod`, %K/%D smoothed by 3. */
export function stochasticRsi(
  values: Series,
  rsiPeriod = 14,
  stochPeriod = 14,
  smoothK = 3,
  dPeriod = 3,
): StochasticResult {
  const rsi = num(relativeStrengthIndex(values, rsiPeriod));
  const raw = empty(values.length);
  const highest = rollingMax(rsi, stochPeriod);
  const lowest = rollingMin(rsi, stochPeriod);
  for (let index = 0; index < values.length; index += 1) {
    const hh = highest[index];
    const ll = lowest[index];
    const value = rsi[index]!;
    if (hh === null || ll === null || !Number.isFinite(value)) continue;
    raw[index] = hh === ll ? 0 : ((value - ll) / (hh - ll)) * 100;
  }
  const k = sma(num(raw), smoothK);
  return { k, d: sma(num(k), dPeriod) };
}

/**
 * Connors RSI (3, 2, 100): the mean of RSI(3) of price, RSI(2) of the
 * up/down streak, and the percent rank of the 1-bar return over 100 bars.
 */
export function connorsRsi(
  values: Series,
  rsiPeriod = 3,
  streakPeriod = 2,
  rankPeriod = 100,
): NullableNumber[] {
  const priceRsi = relativeStrengthIndex(values, rsiPeriod);
  const streak: number[] = [0];
  for (let index = 1; index < values.length; index += 1) {
    const change = values[index]! - values[index - 1]!;
    const previous = streak[index - 1]!;
    streak.push(
      change > 0
        ? previous > 0
          ? previous + 1
          : 1
        : change < 0
          ? previous < 0
            ? previous - 1
            : -1
          : 0,
    );
  }
  const streakRsi = relativeStrengthIndex(streak, streakPeriod);
  const returns = values.map((value, index) =>
    index === 0
      ? Number.NaN
      : (value - values[index - 1]!) / values[index - 1]!,
  );
  const rank = empty(values.length);
  for (let index = rankPeriod; index < values.length; index += 1) {
    let below = 0;
    for (let back = index - rankPeriod; back < index; back += 1) {
      if (returns[back]! < returns[index]!) below += 1;
    }
    rank[index] = (below / rankPeriod) * 100;
  }
  return values.map((_, index) => {
    const a = priceRsi[index];
    const b = streakRsi[index];
    const c = rank[index];
    return a === null || b === null || c === null ? null : (a + b + c) / 3;
  });
}

/** Percentage price oscillator: (EMA12 − EMA26) / EMA26 · 100, with its EMA9 signal. */
export function percentagePriceOscillator(
  values: Series,
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): {
  readonly ppo: NullableNumber[];
  readonly signal: NullableNumber[];
  readonly histogram: NullableNumber[];
} {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const ppo = values.map((_, index) => {
    const f = fastEma[index];
    const s = slowEma[index];
    return f === null || s === null || s === 0 ? null : ((f - s) / s) * 100;
  });
  const signal = ema(num(ppo), signalPeriod);
  const histogram = ppo.map((value, index) => {
    const s = signal[index];
    return value === null || s === null ? null : value - s;
  });
  return { ppo, signal, histogram };
}

/** Absolute price oscillator: EMA12 − EMA26. */
export function absolutePriceOscillator(
  values: Series,
  fast = 12,
  slow = 26,
): NullableNumber[] {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  return values.map((_, index) => {
    const f = fastEma[index];
    const s = slowEma[index];
    return f === null || s === null ? null : f - s;
  });
}

/** Commodity channel index (20): (TP − SMA(TP)) / (0.015 · mean |TP − SMA(TP)|). */
export function commodityChannelIndex(
  candles: readonly Candle[],
  period = 20,
): NullableNumber[] {
  const typical = hlc3(candles);
  const average = sma(typical, period);
  const result = empty(candles.length);
  for (let index = period - 1; index < candles.length; index += 1) {
    const mean = average[index];
    if (mean === null) continue;
    let deviation = 0;
    for (let back = index - period + 1; back <= index; back += 1) {
      deviation += Math.abs(typical[back]! - mean);
    }
    deviation /= period;
    result[index] =
      deviation === 0 ? 0 : (typical[index]! - mean) / (0.015 * deviation);
  }
  return result;
}

/** Williams %R (14): (highest high − close) / (highest high − lowest low) · −100. */
export function williamsPercentR(
  candles: readonly Candle[],
  period = 14,
): NullableNumber[] {
  const highest = rollingMax(highs(candles), period);
  const lowest = rollingMin(lows(candles), period);
  return candles.map((candle, index) => {
    const hh = highest[index];
    const ll = lowest[index];
    if (hh === null || ll === null) return null;
    return hh === ll ? 0 : ((hh - candle.close) / (hh - ll)) * -100;
  });
}

/** Awesome oscillator: SMA5(hl2) − SMA34(hl2). */
export function awesomeOscillator(
  candles: readonly Candle[],
  fast = 5,
  slow = 34,
): NullableNumber[] {
  const median = hl2(candles);
  const fastSma = sma(median, fast);
  const slowSma = sma(median, slow);
  return candles.map((_, index) => {
    const f = fastSma[index];
    const s = slowSma[index];
    return f === null || s === null ? null : f - s;
  });
}

/** True strength index (25, 13): 100 · EMA13(EMA25(Δclose)) / EMA13(EMA25(|Δclose|)), with an EMA13 signal. */
export function trueStrengthIndex(
  values: Series,
  long = 25,
  short = 13,
  signalPeriod = 13,
): { readonly tsi: NullableNumber[]; readonly signal: NullableNumber[] } {
  const change = values.map((value, index) =>
    index === 0 ? Number.NaN : value - values[index - 1]!,
  );
  const absolute = change.map((value) => Math.abs(value));
  const doubleSmoothed = ema(num(ema(change, long)), short);
  const doubleSmoothedAbs = ema(num(ema(absolute, long)), short);
  const tsi = values.map((_, index) => {
    const a = doubleSmoothed[index];
    const b = doubleSmoothedAbs[index];
    return a === null || b === null || b === 0 ? null : (100 * a) / b;
  });
  return { tsi, signal: ema(num(tsi), signalPeriod) };
}

/** TRIX (18), as TradingView computes it: 10000 · Δ(EMA(EMA(EMA(ln close)))). */
export function trix(values: Series, period = 18): NullableNumber[] {
  const logs = values.map((value) => Math.log(value));
  const triple = ema(num(ema(num(ema(logs, period)), period)), period);
  return values.map((_, index) => {
    const current = triple[index];
    const previous = index === 0 ? null : triple[index - 1];
    return current === null || previous === null
      ? null
      : 10000 * (current - previous);
  });
}

/** Ultimate oscillator (7, 14, 28) with weights 4 / 2 / 1. */
export function ultimateOscillator(
  candles: readonly Candle[],
  fast = 7,
  medium = 14,
  slow = 28,
): NullableNumber[] {
  const buyingPressure: number[] = [];
  const range: number[] = [];
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]!;
    const previousClose = index === 0 ? Number.NaN : candles[index - 1]!.close;
    const trueLow = Math.min(candle.low, previousClose);
    const trueHigh = Math.max(candle.high, previousClose);
    buyingPressure.push(candle.close - trueLow);
    range.push(trueHigh - trueLow);
  }
  const average = (period: number): NullableNumber[] => {
    const bp = rollingSum(buyingPressure, period);
    const tr = rollingSum(range, period);
    return bp.map((value, index) => {
      const denominator = tr[index];
      return value === null || denominator === null || denominator === 0
        ? null
        : value / denominator;
    });
  };
  const a1 = average(fast);
  const a2 = average(medium);
  const a3 = average(slow);
  return candles.map((_, index) => {
    const x = a1[index];
    const y = a2[index];
    const z = a3[index];
    return x === null || y === null || z === null
      ? null
      : (100 * (4 * x + 2 * y + z)) / 7;
  });
}

/** Coppock curve: WMA10 of (ROC14 + ROC11). */
export function coppockCurve(
  values: Series,
  wmaPeriod = 10,
  longRoc = 14,
  shortRoc = 11,
): NullableNumber[] {
  const long = rateOfChange(values, longRoc);
  const short = rateOfChange(values, shortRoc);
  const sum = values.map((_, index) => {
    const a = long[index];
    const b = short[index];
    return a === null || b === null ? Number.NaN : a + b;
  });
  return weightedMovingAverage(sum, wmaPeriod);
}

/** Detrended price oscillator (21), TradingView's non-centred form: close − SMA shifted back by period/2 + 1. */
export function detrendedPriceOscillator(
  values: Series,
  period = 21,
): NullableNumber[] {
  const result = empty(values.length);
  if (!validPeriod(period)) return result;
  const average = sma(values, period);
  const shift = Math.floor(period / 2) + 1;
  for (let index = shift; index < values.length; index += 1) {
    const shifted = average[index - shift];
    result[index] = shifted === null ? null : values[index]! - shifted;
  }
  return result;
}

/** Know Sure Thing: ROC(10,15,20,30) smoothed by SMA(10,10,10,15), weighted 1..4; signal SMA9. */
export function knowSureThing(values: Series): {
  readonly kst: NullableNumber[];
  readonly signal: NullableNumber[];
} {
  const parts = [
    [10, 10, 1],
    [15, 10, 2],
    [20, 10, 3],
    [30, 15, 4],
  ] as const;
  const smoothed = parts.map(([rocPeriod, smaPeriod]) =>
    sma(num(rateOfChange(values, rocPeriod)), smaPeriod),
  );
  const kst = values.map((_, index) => {
    let total = 0;
    for (let part = 0; part < parts.length; part += 1) {
      const value = smoothed[part]![index];
      if (value === null) return null;
      total += value * parts[part]![2];
    }
    return total;
  });
  return { kst, signal: sma(num(kst), 9) };
}

/** Fisher transform (9) of hl2, TradingView's recursion with the ±0.999 clamp, plus its 1-bar trigger. */
export function fisherTransform(
  candles: readonly Candle[],
  period = 9,
): { readonly fisher: NullableNumber[]; readonly trigger: NullableNumber[] } {
  const median = hl2(candles);
  const highest = rollingMax(median, period);
  const lowest = rollingMin(median, period);
  const fisher = empty(candles.length);
  let value = 0;
  let previousFisher = 0;
  for (let index = 0; index < candles.length; index += 1) {
    const hh = highest[index];
    const ll = lowest[index];
    if (hh === null || ll === null) continue;
    const ratio = hh === ll ? 0 : (median[index]! - ll) / (hh - ll) - 0.5;
    value = 0.66 * ratio + 0.67 * value;
    if (value > 0.999) value = 0.999;
    if (value < -0.999) value = -0.999;
    previousFisher =
      0.5 * Math.log((1 + value) / (1 - value)) + 0.5 * previousFisher;
    fisher[index] = previousFisher;
  }
  const trigger = fisher.map((_, index) =>
    index === 0 ? null : fisher[index - 1]!,
  );
  return { fisher, trigger };
}

/** Chande momentum oscillator (9): 100 · (Σup − Σdown) / (Σup + Σdown). */
export function chandeMomentumOscillator(
  values: Series,
  period = 9,
): NullableNumber[] {
  const ups: number[] = [];
  const downs: number[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const change =
      index === 0 ? Number.NaN : values[index]! - values[index - 1]!;
    ups.push(Math.max(change, 0));
    downs.push(Math.max(-change, 0));
  }
  const up = rollingSum(ups, period);
  const down = rollingSum(downs, period);
  return values.map((_, index) => {
    const u = up[index];
    const d = down[index];
    return u === null || d === null || u + d === 0
      ? null
      : (100 * (u - d)) / (u + d);
  });
}

/* ------------------------------------------------------------------------ */
/* Trend                                                                    */
/* ------------------------------------------------------------------------ */

export interface SupertrendResult {
  readonly line: NullableNumber[];
  /** 1 while price is above the line (uptrend), −1 below it. */
  readonly direction: NullableNumber[];
}

/** Supertrend (ATR 10, multiplier 3) with the standard band-ratchet and flip rules. */
export function supertrend(
  candles: readonly Candle[],
  atrPeriod = 10,
  multiplier = 3,
): SupertrendResult {
  const line = empty(candles.length);
  const direction = empty(candles.length);
  const atr = rma(num(trueRange(candles)), atrPeriod);
  const median = hl2(candles);
  let previousUpper: number | null = null;
  let previousLower: number | null = null;
  let trend = 1;
  for (let index = 0; index < candles.length; index += 1) {
    const range = atr[index];
    if (range === null) continue;
    const close = candles[index]!.close;
    const previousClose = index === 0 ? close : candles[index - 1]!.close;
    let upper = median[index]! + multiplier * range;
    let lower = median[index]! - multiplier * range;
    if (
      previousUpper !== null &&
      !(upper < previousUpper || previousClose > previousUpper)
    ) {
      upper = previousUpper;
    }
    if (
      previousLower !== null &&
      !(lower > previousLower || previousClose < previousLower)
    ) {
      lower = previousLower;
    }
    if (previousUpper === null || previousLower === null) {
      trend = close > upper ? 1 : close < lower ? -1 : 1;
    } else if (trend === -1 && close > previousUpper) {
      trend = 1;
    } else if (trend === 1 && close < previousLower) {
      trend = -1;
    }
    line[index] = trend === 1 ? lower : upper;
    direction[index] = trend;
    previousUpper = upper;
    previousLower = lower;
  }
  return { line, direction };
}

export interface DirectionalMovementResult {
  readonly adx: NullableNumber[];
  readonly plusDi: NullableNumber[];
  readonly minusDi: NullableNumber[];
}

/** Wilder's DMI: +DI / −DI over `diPeriod` with RMA smoothing, ADX = RMA of DX over `adxPeriod`. */
export function directionalMovementIndex(
  candles: readonly Candle[],
  diPeriod = 14,
  adxPeriod = 14,
): DirectionalMovementResult {
  const plusDm: number[] = [Number.NaN];
  const minusDm: number[] = [Number.NaN];
  for (let index = 1; index < candles.length; index += 1) {
    const upMove = candles[index]!.high - candles[index - 1]!.high;
    const downMove = candles[index - 1]!.low - candles[index]!.low;
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  const tr = num(trueRange(candles)).map((value, index) =>
    index === 0 ? Number.NaN : value,
  );
  const smoothedTr = rma(tr, diPeriod);
  const smoothedPlus = rma(plusDm, diPeriod);
  const smoothedMinus = rma(minusDm, diPeriod);
  const plusDi = empty(candles.length);
  const minusDi = empty(candles.length);
  const dx = empty(candles.length);
  for (let index = 0; index < candles.length; index += 1) {
    const range = smoothedTr[index];
    const plus = smoothedPlus[index];
    const minus = smoothedMinus[index];
    if (range === null || plus === null || minus === null) continue;
    const pdi = range === 0 ? 0 : (100 * plus) / range;
    const mdi = range === 0 ? 0 : (100 * minus) / range;
    plusDi[index] = pdi;
    minusDi[index] = mdi;
    dx[index] = pdi + mdi === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / (pdi + mdi);
  }
  return { adx: rma(num(dx), adxPeriod), plusDi, minusDi };
}

export interface AroonResult {
  readonly up: NullableNumber[];
  readonly down: NullableNumber[];
  readonly oscillator: NullableNumber[];
}

/** Aroon (14): 100 · (period − bars since the highest high / lowest low over period + 1 bars) / period. */
export function aroon(candles: readonly Candle[], period = 14): AroonResult {
  const up = empty(candles.length);
  const down = empty(candles.length);
  const oscillator = empty(candles.length);
  if (!validPeriod(period)) return { up, down, oscillator };
  for (let index = period; index < candles.length; index += 1) {
    let highestIndex = index;
    let lowestIndex = index;
    for (let back = index; back >= index - period; back -= 1) {
      if (candles[back]!.high >= candles[highestIndex]!.high)
        highestIndex = back;
      if (candles[back]!.low <= candles[lowestIndex]!.low) lowestIndex = back;
    }
    // Scanning backwards with >= picks the OLDEST tie, matching TradingView's
    // ta.highestbars / ta.lowestbars.
    const upValue = ((period - (index - highestIndex)) / period) * 100;
    const downValue = ((period - (index - lowestIndex)) / period) * 100;
    up[index] = upValue;
    down[index] = downValue;
    oscillator[index] = upValue - downValue;
  }
  return { up, down, oscillator };
}

export interface ParabolicSarResult {
  readonly sar: NullableNumber[];
  /** 1 in an uptrend (SAR below price), −1 in a downtrend. */
  readonly direction: NullableNumber[];
}

/** Parabolic SAR (start 0.02, increment 0.02, maximum 0.2), Wilder's rules as TradingView applies them. */
export function parabolicSar(
  candles: readonly Candle[],
  start = 0.02,
  increment = 0.02,
  maximum = 0.2,
): ParabolicSarResult {
  const sar = empty(candles.length);
  const direction = empty(candles.length);
  if (candles.length < 2) return { sar, direction };
  let uptrend = candles[1]!.close >= candles[0]!.close;
  let acceleration = start;
  let extreme = uptrend ? candles[0]!.high : candles[0]!.low;
  let current = uptrend ? candles[0]!.low : candles[0]!.high;
  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index]!;
    const previous = candles[index - 1]!;
    const beforePrevious = candles[index - 2] ?? previous;
    let next = current + acceleration * (extreme - current);
    if (uptrend) {
      next = Math.min(next, previous.low, beforePrevious.low);
      if (candle.low < next) {
        uptrend = false;
        next = extreme;
        extreme = candle.low;
        acceleration = start;
      } else if (candle.high > extreme) {
        extreme = candle.high;
        acceleration = Math.min(acceleration + increment, maximum);
      }
    } else {
      next = Math.max(next, previous.high, beforePrevious.high);
      if (candle.high > next) {
        uptrend = true;
        next = extreme;
        extreme = candle.high;
        acceleration = start;
      } else if (candle.low < extreme) {
        extreme = candle.low;
        acceleration = Math.min(acceleration + increment, maximum);
      }
    }
    current = next;
    sar[index] = current;
    direction[index] = uptrend ? 1 : -1;
  }
  return { sar, direction };
}

export interface IchimokuResult {
  readonly tenkan: NullableNumber[];
  readonly kijun: NullableNumber[];
  /** Senkou span A/B as computed on each bar (before the forward displacement). */
  readonly senkouA: NullableNumber[];
  readonly senkouB: NullableNumber[];
  /** The cloud drawn under each bar: span A/B computed `base` bars earlier. */
  readonly cloudA: NullableNumber[];
  readonly cloudB: NullableNumber[];
}

/** Ichimoku (9, 26, 52): midpoints of the highest high and lowest low over each length; the cloud is displaced 26 bars forward. */
export function ichimoku(
  candles: readonly Candle[],
  conversion = 9,
  base = 26,
  span = 52,
): IchimokuResult {
  const midpoint = (period: number): NullableNumber[] => {
    const highest = rollingMax(highs(candles), period);
    const lowest = rollingMin(lows(candles), period);
    return candles.map((_, index) => {
      const hh = highest[index];
      const ll = lowest[index];
      return hh === null || ll === null ? null : (hh + ll) / 2;
    });
  };
  const tenkan = midpoint(conversion);
  const kijun = midpoint(base);
  const senkouA = candles.map((_, index) => {
    const t = tenkan[index];
    const k = kijun[index];
    return t === null || k === null ? null : (t + k) / 2;
  });
  const senkouB = midpoint(span);
  const displace = (values: NullableNumber[]): NullableNumber[] =>
    values.map((_, index) => (index < base ? null : values[index - base]!));
  return {
    tenkan,
    kijun,
    senkouA,
    senkouB,
    cloudA: displace(senkouA),
    cloudB: displace(senkouB),
  };
}

export interface VortexResult {
  readonly plus: NullableNumber[];
  readonly minus: NullableNumber[];
}

/** Vortex (14): Σ|high − low[1]| / ΣTR and Σ|low − high[1]| / ΣTR. */
export function vortexIndicator(
  candles: readonly Candle[],
  period = 14,
): VortexResult {
  const plusMovement: number[] = [Number.NaN];
  const minusMovement: number[] = [Number.NaN];
  for (let index = 1; index < candles.length; index += 1) {
    plusMovement.push(Math.abs(candles[index]!.high - candles[index - 1]!.low));
    minusMovement.push(
      Math.abs(candles[index]!.low - candles[index - 1]!.high),
    );
  }
  const tr = num(trueRange(candles)).map((value, index) =>
    index === 0 ? Number.NaN : value,
  );
  const sumTr = rollingSum(tr, period);
  const sumPlus = rollingSum(plusMovement, period);
  const sumMinus = rollingSum(minusMovement, period);
  const divide = (numerator: NullableNumber[]): NullableNumber[] =>
    numerator.map((value, index) => {
      const denominator = sumTr[index];
      return value === null || denominator === null || denominator === 0
        ? null
        : value / denominator;
    });
  return { plus: divide(sumPlus), minus: divide(sumMinus) };
}

/** Mass index (9, 25): Σ over 25 bars of EMA9(high − low) / EMA9(EMA9(high − low)). */
export function massIndex(
  candles: readonly Candle[],
  emaPeriod = 9,
  sumPeriod = 25,
): NullableNumber[] {
  const range = candles.map((candle) => candle.high - candle.low);
  const single = ema(range, emaPeriod);
  const double = ema(num(single), emaPeriod);
  const ratio = candles.map((_, index) => {
    const s = single[index];
    const d = double[index];
    return s === null || d === null || d === 0 ? Number.NaN : s / d;
  });
  return rollingSum(ratio, sumPeriod);
}

/** Choppiness index (14): 100 · log10(ΣATR(1) / (highest high − lowest low)) / log10(period). */
export function choppinessIndex(
  candles: readonly Candle[],
  period = 14,
): NullableNumber[] {
  const tr = num(trueRange(candles));
  const sumTr = rollingSum(tr, period);
  const highest = rollingMax(highs(candles), period);
  const lowest = rollingMin(lows(candles), period);
  return candles.map((_, index) => {
    const total = sumTr[index];
    const hh = highest[index];
    const ll = lowest[index];
    if (total === null || hh === null || ll === null || hh === ll || total <= 0)
      return null;
    return (100 * Math.log10(total / (hh - ll))) / Math.log10(period);
  });
}

/**
 * Trend intensity index (M.H. Pee): over the last `minor` bars, the share of
 * the total deviation from SMA(`major`) that lies above it, in percent.
 * Defaults 60 / 30.
 */
export function trendIntensityIndex(
  values: Series,
  major = 60,
  minor = 30,
): NullableNumber[] {
  const average = sma(values, major);
  const result = empty(values.length);
  for (let index = major - 1 + minor - 1; index < values.length; index += 1) {
    let above = 0;
    let below = 0;
    for (let back = index - minor + 1; back <= index; back += 1) {
      const mean = average[back];
      if (mean === null) {
        above = Number.NaN;
        break;
      }
      const deviation = values[back]! - mean;
      if (deviation > 0) above += deviation;
      else below -= deviation;
    }
    if (!Number.isFinite(above)) continue;
    result[index] = above + below === 0 ? 50 : (100 * above) / (above + below);
  }
  return result;
}

export interface AtrTrailingStopResult {
  readonly stop: NullableNumber[];
  /** 1 while the stop sits below price (long), −1 above it (short). */
  readonly direction: NullableNumber[];
}

/** ATR trailing stop (ATR 14, multiplier 3): a ratcheting stop that flips when the close crosses it. */
export function atrTrailingStop(
  candles: readonly Candle[],
  atrPeriod = 14,
  multiplier = 3,
): AtrTrailingStopResult {
  const stop = empty(candles.length);
  const direction = empty(candles.length);
  const atr = rma(num(trueRange(candles)), atrPeriod);
  let previousStop: number | null = null;
  let trend = 1;
  for (let index = 0; index < candles.length; index += 1) {
    const range = atr[index];
    if (range === null) continue;
    const close = candles[index]!.close;
    const previousClose = index === 0 ? close : candles[index - 1]!.close;
    const longStop = close - multiplier * range;
    const shortStop = close + multiplier * range;
    let next: number;
    if (previousStop === null) {
      trend = 1;
      next = longStop;
    } else if (close > previousStop && previousClose > previousStop) {
      trend = 1;
      next = Math.max(previousStop, longStop);
    } else if (close < previousStop && previousClose < previousStop) {
      trend = -1;
      next = Math.min(previousStop, shortStop);
    } else if (close > previousStop) {
      trend = 1;
      next = longStop;
    } else {
      trend = -1;
      next = shortStop;
    }
    stop[index] = next;
    direction[index] = trend;
    previousStop = next;
  }
  return { stop, direction };
}

/* ------------------------------------------------------------------------ */
/* Volatility and channels                                                  */
/* ------------------------------------------------------------------------ */

export interface ChannelResult {
  readonly upper: NullableNumber[];
  readonly middle: NullableNumber[];
  readonly lower: NullableNumber[];
}

/** Keltner channel (EMA 20 ± 2 · ATR 10), TradingView's default settings. */
export function keltnerChannel(
  candles: readonly Candle[],
  period = 20,
  multiplier = 2,
  atrPeriod = 10,
): ChannelResult {
  const middle = ema(closes(candles), period);
  const atr = rma(num(trueRange(candles)), atrPeriod);
  const upper = candles.map((_, index) => {
    const m = middle[index];
    const a = atr[index];
    return m === null || a === null ? null : m + multiplier * a;
  });
  const lower = candles.map((_, index) => {
    const m = middle[index];
    const a = atr[index];
    return m === null || a === null ? null : m - multiplier * a;
  });
  return { upper, middle, lower };
}

/** Donchian channel (20): highest high, lowest low and their midpoint. */
export function donchianChannel(
  candles: readonly Candle[],
  period = 20,
): ChannelResult {
  const upper = rollingMax(highs(candles), period);
  const lower = rollingMin(lows(candles), period);
  const middle = upper.map((u, index) => {
    const l = lower[index];
    return u === null || l === null ? null : (u + l) / 2;
  });
  return { upper, middle, lower };
}

/** Chaikin volatility (10, 10): percent change over 10 bars of EMA10(high − low). */
export function chaikinVolatility(
  candles: readonly Candle[],
  emaPeriod = 10,
  rocPeriod = 10,
): NullableNumber[] {
  const smoothed = ema(
    candles.map((candle) => candle.high - candle.low),
    emaPeriod,
  );
  return rateOfChange(num(smoothed), rocPeriod);
}

/** Ulcer index (14): √(mean over 14 of (percent drawdown from the 14-bar highest close)²). */
export function ulcerIndex(values: Series, period = 14): NullableNumber[] {
  const highest = rollingMax(values, period);
  const drawdownSquared = values.map((value, index) => {
    const peak = highest[index];
    return peak === null || peak === 0
      ? Number.NaN
      : (((value - peak) / peak) * 100) ** 2;
  });
  return sma(drawdownSquared, period).map((value) =>
    value === null ? null : Math.sqrt(value),
  );
}

/** Moving-average envelopes: SMA 20 ± 10 %. */
export function envelopes(
  values: Series,
  period = 20,
  percent = 10,
): ChannelResult {
  const middle = sma(values, period);
  const factor = percent / 100;
  return {
    upper: middle.map((value) =>
      value === null ? null : value * (1 + factor),
    ),
    middle,
    lower: middle.map((value) =>
      value === null ? null : value * (1 - factor),
    ),
  };
}

/**
 * Linear regression channel (100, ±2σ): the regression line's current value
 * with bands at 2 population standard deviations of the residuals, as
 * TradingView draws it.
 */
export function linearRegressionChannel(
  values: Series,
  period = 100,
  deviations = 2,
): ChannelResult {
  const upper = empty(values.length);
  const middle = empty(values.length);
  const lower = empty(values.length);
  if (!validPeriod(period)) return { upper, middle, lower };
  const xMean = (period - 1) / 2;
  let xVariance = 0;
  for (let i = 0; i < period; i += 1) xVariance += (i - xMean) ** 2;
  for (let index = period - 1; index < values.length; index += 1) {
    const start = index - period + 1;
    let yMean = 0;
    for (let i = 0; i < period; i += 1) yMean += values[start + i]!;
    yMean /= period;
    let covariance = 0;
    for (let i = 0; i < period; i += 1) {
      covariance += (i - xMean) * (values[start + i]! - yMean);
    }
    const slope = covariance / xVariance;
    const intercept = yMean - slope * xMean;
    let residuals = 0;
    for (let i = 0; i < period; i += 1) {
      residuals += (values[start + i]! - (intercept + slope * i)) ** 2;
    }
    const deviation = Math.sqrt(residuals / period);
    const end = intercept + slope * (period - 1);
    middle[index] = end;
    upper[index] = end + deviations * deviation;
    lower[index] = end - deviations * deviation;
  }
  return { upper, middle, lower };
}

/* ------------------------------------------------------------------------ */
/* Volume                                                                   */
/* ------------------------------------------------------------------------ */

/** On-balance volume: running total of volume signed by the close's direction. */
export function onBalanceVolume(candles: readonly Candle[]): NullableNumber[] {
  const result = empty(candles.length);
  let total = 0;
  for (let index = 0; index < candles.length; index += 1) {
    const volume = candles[index]!.volume;
    if (volume === undefined || volume === null || !Number.isFinite(volume))
      return result;
    if (index > 0) {
      const change = candles[index]!.close - candles[index - 1]!.close;
      total += change > 0 ? volume : change < 0 ? -volume : 0;
    }
    result[index] = total;
  }
  return result;
}

/** Money flow index (14) on typical price. */
export function moneyFlowIndex(
  candles: readonly Candle[],
  period = 14,
): NullableNumber[] {
  const typical = hlc3(candles);
  const volume = volumes(candles);
  const positive: number[] = [Number.NaN];
  const negative: number[] = [Number.NaN];
  for (let index = 1; index < candles.length; index += 1) {
    const flow = typical[index]! * volume[index]!;
    const up = typical[index]! > typical[index - 1]!;
    const down = typical[index]! < typical[index - 1]!;
    positive.push(up ? flow : 0);
    negative.push(down ? flow : 0);
  }
  const positiveSum = rollingSum(positive, period);
  const negativeSum = rollingSum(negative, period);
  return candles.map((_, index) => {
    const p = positiveSum[index];
    const n = negativeSum[index];
    if (p === null || n === null) return null;
    if (n === 0) return p === 0 ? 50 : 100;
    return 100 - 100 / (1 + p / n);
  });
}

function moneyFlowMultiplier(candle: Candle): number {
  const range = candle.high - candle.low;
  return range === 0
    ? 0
    : (candle.close - candle.low - (candle.high - candle.close)) / range;
}

/** Chaikin money flow (20): Σ(money-flow volume) / Σvolume. */
export function chaikinMoneyFlow(
  candles: readonly Candle[],
  period = 20,
): NullableNumber[] {
  const volume = volumes(candles);
  const flow = candles.map(
    (candle, index) => moneyFlowMultiplier(candle) * volume[index]!,
  );
  const flowSum = rollingSum(flow, period);
  const volumeSum = rollingSum(volume, period);
  return candles.map((_, index) => {
    const f = flowSum[index];
    const v = volumeSum[index];
    return f === null || v === null || v === 0 ? null : f / v;
  });
}

/** Accumulation/distribution line: running total of money-flow volume. */
export function accumulationDistribution(
  candles: readonly Candle[],
): NullableNumber[] {
  const result = empty(candles.length);
  let total = 0;
  for (let index = 0; index < candles.length; index += 1) {
    const volume = candles[index]!.volume;
    if (volume === undefined || volume === null || !Number.isFinite(volume))
      return result;
    total += moneyFlowMultiplier(candles[index]!) * volume;
    result[index] = total;
  }
  return result;
}

/** Force index (13): EMA13 of (close − close[1]) · volume. */
export function forceIndex(
  candles: readonly Candle[],
  period = 13,
): NullableNumber[] {
  const raw = candles.map((candle, index) =>
    index === 0
      ? Number.NaN
      : (candle.close - candles[index - 1]!.close) *
        (candle.volume ?? Number.NaN),
  );
  return ema(raw, period);
}

/** Ease of movement (14, divisor 10000): SMA14 of (Δhl2 / (volume / 10000 / (high − low))). */
export function easeOfMovement(
  candles: readonly Candle[],
  period = 14,
  divisor = 10000,
): NullableNumber[] {
  const median = hl2(candles);
  const raw = candles.map((candle, index) => {
    if (index === 0) return Number.NaN;
    const range = candle.high - candle.low;
    const volume = candle.volume ?? Number.NaN;
    if (range === 0 || volume === 0) return 0;
    return (median[index]! - median[index - 1]!) / (volume / divisor / range);
  });
  return sma(raw, period);
}

/** Negative / positive volume index, starting at 1000 and moving by the price change on days volume fell / rose. */
export function volumeIndex(
  candles: readonly Candle[],
  kind: "negative" | "positive",
  initial = 1000,
): NullableNumber[] {
  const result = empty(candles.length);
  if (candles.length === 0) return result;
  let value = initial;
  result[0] = value;
  for (let index = 1; index < candles.length; index += 1) {
    const volume = candles[index]!.volume ?? Number.NaN;
    const previousVolume = candles[index - 1]!.volume ?? Number.NaN;
    const moved =
      kind === "negative" ? volume < previousVolume : volume > previousVolume;
    if (moved) {
      const previousClose = candles[index - 1]!.close;
      value +=
        ((candles[index]!.close - previousClose) / previousClose) * value;
    }
    result[index] = value;
  }
  return result;
}

/** Price-volume trend: running total of volume · percent change of the close. */
export function priceVolumeTrend(candles: readonly Candle[]): NullableNumber[] {
  const result = empty(candles.length);
  let total = 0;
  for (let index = 0; index < candles.length; index += 1) {
    const volume = candles[index]!.volume;
    if (volume === undefined || volume === null || !Number.isFinite(volume))
      return result;
    if (index > 0) {
      const previousClose = candles[index - 1]!.close;
      total +=
        ((candles[index]!.close - previousClose) / previousClose) * volume;
    }
    result[index] = total;
  }
  return result;
}

/** Volume oscillator (5, 10): (EMA5(volume) − EMA10(volume)) / EMA10(volume) · 100. */
export function volumeOscillator(
  candles: readonly Candle[],
  fast = 5,
  slow = 10,
): NullableNumber[] {
  const volume = volumes(candles);
  const fastEma = ema(volume, fast);
  const slowEma = ema(volume, slow);
  return candles.map((_, index) => {
    const f = fastEma[index];
    const s = slowEma[index];
    return f === null || s === null || s === 0 ? null : ((f - s) / s) * 100;
  });
}

/* ------------------------------------------------------------------------ */
/* Pivot points (from one completed session)                               */
/* ------------------------------------------------------------------------ */

export type PivotMethod =
  "standard" | "fibonacci" | "camarilla" | "woodie" | "demark";

export interface PivotLevels {
  readonly pivot: number;
  readonly resistances: readonly number[];
  readonly supports: readonly number[];
}

/** Pivot levels for the session after `candle`, by the named method. */
export function pivotPoints(candle: Candle, method: PivotMethod): PivotLevels {
  const { high, low, close, open } = candle;
  const range = high - low;
  switch (method) {
    case "standard": {
      const pivot = (high + low + close) / 3;
      return {
        pivot,
        resistances: [2 * pivot - low, pivot + range, high + 2 * (pivot - low)],
        supports: [2 * pivot - high, pivot - range, low - 2 * (high - pivot)],
      };
    }
    case "fibonacci": {
      const pivot = (high + low + close) / 3;
      return {
        pivot,
        resistances: [
          pivot + 0.382 * range,
          pivot + 0.618 * range,
          pivot + range,
        ],
        supports: [pivot - 0.382 * range, pivot - 0.618 * range, pivot - range],
      };
    }
    case "camarilla": {
      const pivot = (high + low + close) / 3;
      const step = (range * 1.1) / 12;
      return {
        pivot,
        resistances: [
          close + step,
          close + 2 * step,
          close + 3 * step,
          close + 6 * step,
        ],
        supports: [
          close - step,
          close - 2 * step,
          close - 3 * step,
          close - 6 * step,
        ],
      };
    }
    case "woodie": {
      const pivot = (high + low + 2 * close) / 4;
      return {
        pivot,
        resistances: [2 * pivot - low, pivot + range],
        supports: [2 * pivot - high, pivot - range],
      };
    }
    case "demark": {
      const x =
        close < open
          ? high + 2 * low + close
          : close > open
            ? 2 * high + low + close
            : high + low + 2 * close;
      return {
        pivot: x / 4,
        resistances: [x / 2 - low],
        supports: [x / 2 - high],
      };
    }
  }
}

export interface CentralPivotRange {
  readonly pivot: number;
  readonly bottomCentral: number;
  readonly topCentral: number;
  /** Width of the range as a percentage of the pivot. */
  readonly widthPercent: number;
}

/** Central pivot range: pivot, BC = (high + low) / 2, TC = 2 · pivot − BC. */
export function centralPivotRange(candle: Candle): CentralPivotRange {
  const pivot = (candle.high + candle.low + candle.close) / 3;
  const bottomCentral = (candle.high + candle.low) / 2;
  const topCentral = 2 * pivot - bottomCentral;
  return {
    pivot,
    bottomCentral: Math.min(bottomCentral, topCentral),
    topCentral: Math.max(bottomCentral, topCentral),
    widthPercent:
      pivot === 0 ? 0 : (Math.abs(topCentral - bottomCentral) / pivot) * 100,
  };
}

export { fromNaN as nullableFromNaN };

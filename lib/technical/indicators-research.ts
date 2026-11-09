/**
 * Classic chart indicators researched from their published definitions
 * (TradingView built-ins and their documented formulas). Every function
 * returns a series aligned with its input; warm-up bars are null. Candles are
 * expected normalized (see normalizeCandles) — no nulls inside a series.
 */
import {
  averageTrueRange,
  bollingerBands,
  exponentialMovingAverage,
  simpleMovingAverage,
  smoothedMovingAverage,
} from "./indicators";
import { type Candle, type NullableNumber } from "./types";

type Series = readonly number[];

function empty(length: number): NullableNumber[] {
  return Array.from({ length }, () => null);
}

function validPeriod(period: number): boolean {
  return Number.isSafeInteger(period) && period > 0;
}

export function toFiniteSeries(
  values: readonly NullableNumber[],
): Series {
  return values.map((value) => (value === null ? Number.NaN : value));
}

function num(values: readonly NullableNumber[]): Series {
  return toFiniteSeries(values);
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
function hlc3(candles: readonly Candle[]): Series {
  return candles.map((candle) => (candle.high + candle.low + candle.close) / 3);
}

function rollingMax(values: Series, period: number): NullableNumber[] {
  const result = empty(values.length);
  if (!validPeriod(period)) return result;
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
  if (!validPeriod(period)) return result;
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

/* ------------------------------------------------------------------------ */
/* Moving averages                                                          */
/* ------------------------------------------------------------------------ */

/** McGinley Dynamic: self-adjusting average that speeds up in fast markets. */
export function mcginleyDynamic(
  values: Series,
  period = 14,
  k = 0.6,
): NullableNumber[] {
  const result = empty(values.length);
  if (!validPeriod(period)) return result;
  let mgd: number | null = null;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!Number.isFinite(value)) {
      mgd = null;
      continue;
    }
    if (mgd === null || mgd === 0) {
      mgd = value;
    } else {
      mgd =
        mgd + (value - mgd) / (period * Math.pow(value / mgd, 4) * k + 1e-12);
    }
    result[index] = mgd;
  }
  return result;
}

/** Rolling median of a series over `period` bars. */
export function rollingMedian(
  values: Series,
  period: number,
): NullableNumber[] {
  const result = empty(values.length);
  if (!validPeriod(period)) return result;
  for (let index = period - 1; index < values.length; index += 1) {
    const window: number[] = [];
    let ok = true;
    for (let back = index - period + 1; back <= index; back += 1) {
      const value = values[back]!;
      if (!Number.isFinite(value)) {
        ok = false;
        break;
      }
      window.push(value);
    }
    if (!ok) continue;
    window.sort((a, b) => a - b);
    const mid = Math.floor(window.length / 2);
    result[index] =
      window.length % 2 === 1
        ? window[mid]!
        : (window[mid - 1]! + window[mid]!) / 2;
  }
  return result;
}

/** Moving average by method name, for ribbon/crossover composites. */
export function movingAverageByMethod(
  values: Series,
  method: string,
  period: number,
): NullableNumber[] {
  switch (method) {
    case "ema":
      return ema(values, period);
    case "wma": {
      const result = empty(values.length);
      if (!validPeriod(period)) return result;
      const denom = (period * (period + 1)) / 2;
      for (let index = period - 1; index < values.length; index += 1) {
        let weighted = 0;
        let ok = true;
        for (let back = 0; back < period; back += 1) {
          const value = values[index - period + 1 + back]!;
          if (!Number.isFinite(value)) {
            ok = false;
            break;
          }
          weighted += value * (back + 1);
        }
        if (ok) result[index] = weighted / denom;
      }
      return result;
    }
    case "smma":
    case "rma":
      return rma(values, period);
    case "hull": {
      const half = Math.max(1, Math.floor(period / 2));
      const root = Math.max(1, Math.floor(Math.sqrt(period)));
      const raw = num(
        sma(values, period).map((value, index) => {
          const halfValue = num(sma(values, half))[index]!;
          if (value === null || !Number.isFinite(halfValue)) return null;
          return 2 * halfValue - (value ?? Number.NaN);
        }),
      );
      return sma(raw, root);
    }
    case "sma":
    default:
      return sma(values, period);
  }
}

/* ------------------------------------------------------------------------ */
/* VWAP variants                                                            */
/* ------------------------------------------------------------------------ */

/** VWAP cumulated from a fixed anchor bar (session start by default). */
export function anchoredVwap(
  candles: readonly Candle[],
  anchorIndex = 0,
): NullableNumber[] {
  const result = empty(candles.length);
  let priceVolume = 0;
  let volume = 0;
  for (let index = 0; index < candles.length; index += 1) {
    if (index < anchorIndex) continue;
    const candle = candles[index]!;
    const candleVolume = candle.volume ?? Number.NaN;
    if (!Number.isFinite(candleVolume)) {
      result[index] = volume === 0 ? null : priceVolume / volume;
      continue;
    }
    priceVolume += hlc3(candles)[index]! * candleVolume;
    volume += candleVolume;
    result[index] = volume === 0 ? null : priceVolume / volume;
  }
  return result;
}

/** VWAP auto-anchored at the highest-volume bar of the series. */
export function autoAnchoredVwap(candles: readonly Candle[]): NullableNumber[] {
  let anchor = 0;
  let best = -Infinity;
  for (let index = 0; index < candles.length; index += 1) {
    const volume = candles[index]!.volume ?? Number.NaN;
    if (Number.isFinite(volume) && volume > best) {
      best = volume;
      anchor = index;
    }
  }
  return anchoredVwap(candles, anchor);
}

/* ------------------------------------------------------------------------ */
/* Volatility stops                                                        */
/* ------------------------------------------------------------------------ */

export interface StopLines {
  readonly long: NullableNumber[];
  readonly short: NullableNumber[];
}

/**
 * Chandelier Exit: highest high − ATR × multiplier (long) and lowest low +
 * ATR × multiplier (short).
 */
export function chandelierExit(
  candles: readonly Candle[],
  period = 22,
  multiplier = 3,
): StopLines {
  const long = empty(candles.length);
  const short = empty(candles.length);
  if (!validPeriod(period)) return { long, short };
  const high = highs(candles);
  const low = lows(candles);
  const atr = num(averageTrueRange(candles, period));
  const highestHigh = rollingMax(high, period);
  const lowestLow = rollingMin(low, period);
  for (let index = 0; index < candles.length; index += 1) {
    const atrValue = atr[index]!;
    const hh = highestHigh[index];
    const ll = lowestLow[index];
    if (!Number.isFinite(atrValue) || hh === null || ll === null) continue;
    long[index] = hh - multiplier * atrValue;
    short[index] = ll + multiplier * atrValue;
  }
  return { long, short };
}

/**
 * Chande Kroll Stop. Initial stops sit one ATR away from the p-bar extreme;
 * the plotted stops are the q-bar extremes of those initial stops.
 */
export function chandeKrollStop(
  candles: readonly Candle[],
  p = 10,
  multiplier = 1,
  q = 9,
): StopLines {
  const long = empty(candles.length);
  const short = empty(candles.length);
  if (!validPeriod(p) || !validPeriod(q)) return { long, short };
  const high = highs(candles);
  const low = lows(candles);
  const atr = num(averageTrueRange(candles, p));
  const initialHigh: Series = candles.map((_, index) => {
    const hh = rollingMax(high, p)[index];
    const atrValue = atr[index]!;
    if (hh === null || !Number.isFinite(atrValue)) return Number.NaN;
    return hh - multiplier * atrValue;
  });
  const initialLow: Series = candles.map((_, index) => {
    const ll = rollingMin(low, p)[index];
    const atrValue = atr[index]!;
    if (ll === null || !Number.isFinite(atrValue)) return Number.NaN;
    return ll + multiplier * atrValue;
  });
  // Recompute windowed extremes of the initial series (O(n·q), fine).
  for (let index = 0; index < candles.length; index += 1) {
    if (index < p - 1 + (q - 1)) continue;
    let maxHigh = -Infinity;
    let minLow = Infinity;
    let ok = true;
    for (let back = index - q + 1; back <= index; back += 1) {
      const hi = initialHigh[back]!;
      const lo = initialLow[back]!;
      if (!Number.isFinite(hi) || !Number.isFinite(lo)) {
        ok = false;
        break;
      }
      if (hi > maxHigh) maxHigh = hi;
      if (lo < minLow) minLow = lo;
    }
    if (!ok) continue;
    short[index] = maxHigh;
    long[index] = minLow;
  }
  return { long, short };
}

/**
 * Volatility Stop: ATR trailing stop that only tightens in the direction of
 * the trend and flips when the close crosses it.
 */
export function volatilityStop(
  candles: readonly Candle[],
  period = 20,
  multiplier = 2,
): NullableNumber[] {
  const result = empty(candles.length);
  if (!validPeriod(period)) return result;
  const close = closes(candles);
  const atr = num(averageTrueRange(candles, period));
  let stop: number | null = null;
  let uptrend = true;
  for (let index = 0; index < candles.length; index += 1) {
    const price = close[index]!;
    const atrValue = atr[index]!;
    if (!Number.isFinite(price) || !Number.isFinite(atrValue)) {
      result[index] = Number.isFinite(stop) ? stop : null;
      continue;
    }
    const band = multiplier * (atrValue ?? Number.NaN);
    if (stop === null) {
      uptrend = true;
      stop = price - band;
    } else if (uptrend) {
      if (price < stop) {
        uptrend = false;
        stop = price + band;
      } else {
        stop = Math.max(stop, price - band);
      }
    } else {
      if (price > stop) {
        uptrend = true;
        stop = price - band;
      } else {
        stop = Math.min(stop, price + band);
      }
    }
    result[index] = stop;
  }
  return result;
}

/* ------------------------------------------------------------------------ */
/* Bollinger extensions                                                    */
/* ------------------------------------------------------------------------ */

/**
 * BBTrend (John Bollinger): (|shortLower − longLower| − |shortUpper −
 * longUpper|) / shortMiddle × 100. Positive values favor trend continuation
 * upward, negative values downward.
 */
export function bollingerTrend(
  values: Series,
  shortLength = 20,
  shortMult = 2,
  longLength = 50,
  longMult = 2,
): NullableNumber[] {
  const result = empty(values.length);
  const short = bollingerBands(values, shortLength, shortMult);
  const long = bollingerBands(values, longLength, longMult);
  for (let index = 0; index < values.length; index += 1) {
    const sLower = short.lower[index];
    const sUpper = short.upper[index];
    const sMiddle = short.middle[index];
    const lLower = long.lower[index];
    const lUpper = long.upper[index];
    if (
      sLower === null ||
      sUpper === null ||
      sMiddle === null ||
      lLower === null ||
      lUpper === null ||
      sMiddle === 0
    ) {
      continue;
    }
    result[index] =
      ((Math.abs(sLower - lLower) - Math.abs(sUpper - lUpper)) / sMiddle) * 100;
  }
  return result;
}

/* ------------------------------------------------------------------------ */
/* Rank and vigor oscillators                                              */
/* ------------------------------------------------------------------------ */

/**
 * Rank Correlation Index (Spearman): compares the rank order of the last
 * `period` closes against the rank order of time itself, × 100.
 */
export function rankCorrelationIndex(
  values: Series,
  period = 14,
): NullableNumber[] {
  const result = empty(values.length);
  if (!validPeriod(period)) return result;
  const denom = period * (period * period - 1);
  for (let index = period - 1; index < values.length; index += 1) {
    const window = values.slice(index - period + 1, index + 1);
    if (window.some((value) => !Number.isFinite(value))) continue;
    const ranked = window
      .map((value, position) => ({ value, position }))
      .sort((a, b) => a.value - b.value);
    const ranks = new Array<number>(period);
    for (let rank = 0; rank < period; rank += 1) {
      ranks[ranked[rank]!.position] = rank + 1;
    }
    let squared = 0;
    for (let position = 0; position < period; position += 1) {
      const diff = ranks[position]! - (position + 1);
      squared += diff * diff;
    }
    result[index] = (1 - (6 * squared) / denom) * 100;
  }
  return result;
}

/**
 * Relative Vigor Index: SMA(close − open) / SMA(high − low) with an SMA
 * signal line.
 */
export function relativeVigorIndex(
  candles: readonly Candle[],
  length = 10,
  signalLength = 4,
): { rvgi: NullableNumber[]; signal: NullableNumber[] } {
  const diff = candles.map((candle) => candle.close - candle.open);
  const range = candles.map((candle) => candle.high - candle.low);
  const numSma = num(sma(diff, length));
  const denSma = num(sma(range, length));
  const rvgi = empty(candles.length);
  for (let index = 0; index < candles.length; index += 1) {
    const numerator = numSma[index]!;
    const denominator = denSma[index]!;
    rvgi[index] =
      !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0
        ? null
        : numerator / denominator;
  }
  return { rvgi, signal: sma(num(rvgi), signalLength) };
}

/**
 * Relative Volatility Index: 100 × RMA(upward stdev) / (RMA(upward stdev) +
 * RMA(downward stdev)) with an SMA signal line.
 */
export function relativeVolatilityIndex(
  values: Series,
  length = 10,
  signalLength = 10,
): { rvi: NullableNumber[]; signal: NullableNumber[] } {
  const rvi = empty(values.length);
  if (!validPeriod(length)) return { rvi, signal: empty(values.length) };
  const up: Series = values.map((value, index) => {
    if (index === 0 || !Number.isFinite(value)) return Number.NaN;
    const previous = values[index - 1]!;
    if (!Number.isFinite(previous)) return Number.NaN;
    return value > previous ? value - previous : 0;
  });
  const down: Series = values.map((value, index) => {
    if (index === 0 || !Number.isFinite(value)) return Number.NaN;
    const previous = values[index - 1]!;
    if (!Number.isFinite(previous)) return Number.NaN;
    return value < previous ? previous - value : 0;
  });
  // Rolling standard deviation of the one-sided moves.
  const stdev = (series: Series): Series =>
    series.map((_, index) => {
      if (index < length - 1) return Number.NaN;
      const window = series.slice(index - length + 1, index + 1);
      if (window.some((value) => !Number.isFinite(value))) return Number.NaN;
      const mean = window.reduce((a, b) => a + b, 0) / length;
      const variance =
        window.reduce((a, b) => a + (b - mean) * (b - mean), 0) / length;
      return Math.sqrt(Math.max(0, variance));
    });
  const upS = num(rma(stdev(up), length));
  const downS = num(rma(stdev(down), length));
  for (let index = 0; index < values.length; index += 1) {
    const u = upS[index]!;
    const d = downS[index]!;
    if (!Number.isFinite(u) || !Number.isFinite(d) || u + d === 0) continue;
    rvi[index] = (100 * u) / (u + d);
  }
  return { rvi, signal: sma(num(rvi), signalLength) };
}

/**
 * Price Momentum Oscillator (Carl Swenlin): one-bar ROC smoothed twice with a
 * custom EMA (factor 2 / length), scaled ×10, plus an EMA signal line.
 */
export function priceMomentumOscillator(
  values: Series,
  smooth1 = 35,
  smooth2 = 20,
  signalLength = 10,
): { pmo: NullableNumber[]; signal: NullableNumber[] } {
  const pmo = empty(values.length);
  const customEma = (series: Series, length: number): Series => {
    const result: number[] = Array.from(
      { length: series.length },
      () => Number.NaN,
    );
    if (!Number.isFinite(length) || length <= 0) return result;
    const alpha = 2 / length;
    let previous = Number.NaN;
    for (let index = 0; index < series.length; index += 1) {
      const value = series[index]!;
      if (!Number.isFinite(value)) {
        previous = Number.NaN;
        continue;
      }
      previous = Number.isFinite(previous)
        ? value * alpha + previous * (1 - alpha)
        : value;
      result[index] = previous;
    }
    return result;
  };
  const roc: Series = values.map((value, index) => {
    if (index === 0 || !Number.isFinite(value)) return Number.NaN;
    const previous = values[index - 1]!;
    if (!Number.isFinite(previous) || previous === 0) return Number.NaN;
    return ((value - previous) / previous) * 100;
  });
  const first = customEma(roc, smooth1);
  const second = customEma(
    first.map((value) => (Number.isFinite(value) ? value * 10 : Number.NaN)),
    smooth2,
  );
  for (let index = 0; index < values.length; index += 1) {
    pmo[index] = Number.isFinite(second[index]!) ? second[index]! : null;
  }
  return { pmo, signal: ema(num(pmo), signalLength) };
}

/**
 * Pring's Special K: weighted sum of twelve SMA-smoothed ROCs (daily
 * standard parameters), plus a 9-bar SMA signal line.
 */
export function specialK(values: Series): {
  k: NullableNumber[];
  signal: NullableNumber[];
} {
  const k = empty(values.length);
  const rocOf = (length: number): Series =>
    values.map((value, index) => {
      if (index < length || !Number.isFinite(value)) return Number.NaN;
      const previous = values[index - length]!;
      if (!Number.isFinite(previous) || previous === 0) return Number.NaN;
      return ((value - previous) / previous) * 100;
    });
  const terms: Array<{ length: number; smooth: number; weight: number }> = [
    { length: 10, smooth: 10, weight: 1 },
    { length: 15, smooth: 10, weight: 2 },
    { length: 20, smooth: 10, weight: 3 },
    { length: 30, smooth: 15, weight: 4 },
    { length: 40, smooth: 50, weight: 1 },
    { length: 65, smooth: 50, weight: 2 },
    { length: 75, smooth: 50, weight: 3 },
    { length: 100, smooth: 50, weight: 4 },
    { length: 195, smooth: 130, weight: 1 },
    { length: 265, smooth: 130, weight: 2 },
    { length: 390, smooth: 130, weight: 3 },
    { length: 530, smooth: 195, weight: 4 },
  ];
  const smoothed = terms.map((term) =>
    num(sma(rocOf(term.length), term.smooth)),
  );
  for (let index = 0; index < values.length; index += 1) {
    let total = 0;
    let ok = true;
    for (let term = 0; term < terms.length; term += 1) {
      const value = smoothed[term]![index]!;
      if (!Number.isFinite(value)) {
        ok = false;
        break;
      }
      total += value * terms[term]!.weight;
    }
    if (ok) k[index] = total;
  }
  return { k, signal: sma(num(k), 9) };
}

/**
 * Klinger Oscillator: EMA(34) − EMA(55) of volume force, with a 13-bar EMA
 * signal line. Volume force = V × (2 × (dm/cm) − 1) × trend × 100.
 */
export function klingerOscillator(
  candles: readonly Candle[],
  fast = 34,
  slow = 55,
  signalLength = 13,
): { kvo: NullableNumber[]; signal: NullableNumber[] } {
  const kvo = empty(candles.length);
  // Trend-persistent cumulative range cm, then the force formula.
  let cm = 0;
  let previousTrend = 0;
  const vf: Series = candles.map((candle, index) => {
    if (index === 0) return Number.NaN;
    const previous = candles[index - 1]!;
    const hlc = candle.high + candle.low + candle.close;
    const prevHlc = previous.high + previous.low + previous.close;
    const trend = hlc > prevHlc ? 1 : hlc < prevHlc ? -1 : 0;
    const dm = candle.high - candle.low;
    if (trend === 0 || !Number.isFinite(dm)) return 0;
    cm = trend === previousTrend ? cm + dm : dm;
    previousTrend = trend;
    const volume = candle.volume ?? Number.NaN;
    if (!Number.isFinite(volume) || cm === 0) return 0;
    return volume * (2 * (dm / cm) - 1) * trend * 100;
  });
  const fastEma = num(ema(vf, fast));
  const slowEma = num(ema(vf, slow));
  for (let index = 0; index < candles.length; index += 1) {
    const f = fastEma[index]!;
    const s = slowEma[index]!;
    if (Number.isFinite(f) && Number.isFinite(s)) kvo[index] = f - s;
  }
  return { kvo, signal: ema(num(kvo), signalLength) };
}

/**
 * Balance of Power: (close − open) / (high − low) with an SMA signal line.
 */
export function balanceOfPower(
  candles: readonly Candle[],
  signalLength = 14,
): { bop: NullableNumber[]; signal: NullableNumber[] } {
  const bop = empty(candles.length);
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]!;
    const range = candle.high - candle.low;
    bop[index] =
      range === 0 ? null : (candle.close - candle.open) / range;
  }
  return { bop, signal: sma(num(bop), signalLength) };
}

/* ------------------------------------------------------------------------ */
/* Volume composites                                                        */
/* ------------------------------------------------------------------------ */

/** Per-bar signed volume (tick rule vs the previous close). */
export function volumeDelta(candles: readonly Candle[]): NullableNumber[] {
  const result = empty(candles.length);
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]!;
    const volume = candle.volume ?? null;
    if (volume === null || !Number.isFinite(volume)) continue;
    if (index === 0) {
      result[index] = 0;
      continue;
    }
    const previousClose = candles[index - 1]!.close;
    if (candle.close > previousClose) result[index] = volume;
    else if (candle.close < previousClose) result[index] = -volume;
    else result[index] = 0;
  }
  return result;
}

/** Cumulative volume delta: running total of signed volume. */
export function cumulativeVolumeDelta(
  candles: readonly Candle[],
): NullableNumber[] {
  const delta = num(volumeDelta(candles));
  const result = empty(candles.length);
  let total = 0;
  let started = false;
  for (let index = 0; index < candles.length; index += 1) {
    const value = delta[index]!;
    if (!Number.isFinite(value)) {
      if (started) result[index] = total;
      continue;
    }
    started = true;
    total += value;
    result[index] = total;
  }
  return result;
}

/**
 * Cumulative volume index: running total of volume signed by close vs open.
 * (Distinct from OBV, which signs by close vs the previous close.)
 */
export function cumulativeVolumeIndex(
  candles: readonly Candle[],
): NullableNumber[] {
  const result = empty(candles.length);
  let total = 0;
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]!;
    const volume = candle.volume ?? null;
    if (volume === null || !Number.isFinite(volume)) continue;
    if (candle.close > candle.open) total += volume;
    else if (candle.close < candle.open) total -= volume;
    result[index] = total;
  }
  return result;
}

/** Up-volume and down-volume split by close vs open. */
export function upDownVolume(candles: readonly Candle[]): {
  up: NullableNumber[];
  down: NullableNumber[];
} {
  const up = empty(candles.length);
  const down = empty(candles.length);
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]!;
    const volume = candle.volume ?? null;
    if (volume === null || !Number.isFinite(volume)) continue;
    up[index] = candle.close >= candle.open ? volume : 0;
    down[index] = candle.close >= candle.open ? 0 : volume;
  }
  return { up, down };
}

/** Net volume: up-volume minus down-volume per bar. */
export function netVolume(candles: readonly Candle[]): NullableNumber[] {
  const { up, down } = upDownVolume(candles);
  return candles.map((_, index) => {
    const u = up[index];
    const d = down[index];
    return u === null || d === null ? null : u - d;
  });
}

/* ------------------------------------------------------------------------ */
/* SMI ergodic                                                              */
/* ------------------------------------------------------------------------ */

/**
 * SMI Ergodic (William Blau): 100 × double-smoothed (close − midpoint) /
 * double-smoothed |close − midpoint|, where the midpoint is the average of
 * the highest high and lowest low. Plus an EMA signal line.
 */
export function smiErgodic(
  candles: readonly Candle[],
  longLength = 20,
  shortLength = 5,
  signalLength = 5,
): { smi: NullableNumber[]; signal: NullableNumber[] } {
  const smi = empty(candles.length);
  const high = highs(candles);
  const low = lows(candles);
  const close = closes(candles);
  const highestHigh = num(rollingMax(high, longLength));
  const lowestLow = num(rollingMin(low, longLength));
  const pc: Series = close.map((value, index) => {
    const hh = highestHigh[index]!;
    const ll = lowestLow[index]!;
    if (!Number.isFinite(value) || !Number.isFinite(hh) || !Number.isFinite(ll))
      return Number.NaN;
    return value - (hh + ll) / 2;
  });
  const apc: Series = pc.map((value) =>
    Number.isFinite(value) ? Math.abs(value) : Number.NaN,
  );
  const ds = num(ema(num(ema(pc, longLength)), shortLength));
  const dsAbs = num(ema(num(ema(apc, longLength)), shortLength));
  for (let index = 0; index < candles.length; index += 1) {
    const numerator = ds[index]!;
    const denominator = dsAbs[index]!;
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0)
      continue;
    smi[index] = (100 * numerator) / denominator;
  }
  return { smi, signal: ema(num(smi), signalLength) };
}

/* ------------------------------------------------------------------------ */
/* RSI divergence                                                           */
/* ------------------------------------------------------------------------ */

function fractalPivots(
  values: Series,
  left: number,
  right: number,
): { highs: boolean[]; lows: boolean[] } {
  const highs = Array.from({ length: values.length }, () => false);
  const lows = Array.from({ length: values.length }, () => false);
  for (let index = left; index < values.length - right; index += 1) {
    const value = values[index]!;
    if (!Number.isFinite(value)) continue;
    let isHigh = true;
    let isLow = true;
    for (let back = index - left; back <= index + right; back += 1) {
      if (back === index) continue;
      const other = values[back]!;
      if (!Number.isFinite(other)) {
        isHigh = false;
        isLow = false;
        break;
      }
      if (other > value) isHigh = false;
      if (other < value) isLow = false;
    }
    highs[index] = isHigh;
    lows[index] = isLow;
  }
  return { highs, lows };
}

export interface RsiDivergence {
  readonly rsi: NullableNumber[];
  /** +1 bullish divergence, −1 bearish divergence, 0 none. */
  readonly signal: NullableNumber[];
}

/**
 * RSI with classic divergence detection: price makes a lower low while RSI
 * makes a higher low (bullish) or price makes a higher high while RSI makes
 * a lower high (bearish), measured on fractal pivots.
 */
export function rsiDivergence(
  candles: readonly Candle[],
  rsiLength = 14,
  pivotLeft = 5,
  pivotRight = 5,
): RsiDivergence {
  const rsi = empty(candles.length);
  const signal = empty(candles.length);
  const close = closes(candles);
  // Wilder RSI via the shared helper on a candle-like series is overkill;
  // compute directly here.
  const gains: number[] = [];
  const losses: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const change = close[index]! - close[index - 1]!;
    gains.push(Number.isFinite(change) && change > 0 ? change : 0);
    losses.push(Number.isFinite(change) && change < 0 ? -change : 0);
  }
  const avgGain: number[] = [];
  const avgLoss: number[] = [];
  for (let index = 0; index < gains.length; index += 1) {
    if (index < rsiLength) {
      const g = gains.slice(0, index + 1);
      const l = losses.slice(0, index + 1);
      avgGain.push(g.reduce((a, b) => a + b, 0) / rsiLength);
      avgLoss.push(l.reduce((a, b) => a + b, 0) / rsiLength);
    } else {
      avgGain.push(
        (avgGain[index - 1]! * (rsiLength - 1) + gains[index]!) / rsiLength,
      );
      avgLoss.push(
        (avgLoss[index - 1]! * (rsiLength - 1) + losses[index]!) / rsiLength,
      );
    }
    if (index + 1 >= rsiLength) {
      const rs = avgLoss[index]! === 0 ? 100 : avgGain[index]! / avgLoss[index]!;
      rsi[index + 1] = 100 - 100 / (1 + rs);
    }
  }
  const rsiNum = num(rsi);
  const pricePivots = fractalPivots(close, pivotLeft, pivotRight);
  const rsiPivots = fractalPivots(rsiNum, pivotLeft, pivotRight);
  let lastLowPrice = -1;
  let lastHighPrice = -1;
  for (let index = 0; index < candles.length; index += 1) {
    let value = 0;
    if (pricePivots.lows[index] && rsiPivots.lows[index]) {
      if (
        lastLowPrice >= 0 &&
        close[index]! < close[lastLowPrice]! &&
        rsiNum[index]! > rsiNum[lastLowPrice]!
      ) {
        value = 1;
      }
      lastLowPrice = index;
    }
    if (pricePivots.highs[index] && rsiPivots.highs[index]) {
      if (
        lastHighPrice >= 0 &&
        close[index]! > close[lastHighPrice]! &&
        rsiNum[index]! < rsiNum[lastHighPrice]!
      ) {
        value = -1;
      }
      lastHighPrice = index;
    }
    signal[index] = value;
  }
  return { rsi, signal };
}

/* ------------------------------------------------------------------------ */
/* Gaps, seasonality, moon, performance, correlation                        */
/* ------------------------------------------------------------------------ */

/** Overnight/session gap as a percent of the previous close. */
export function sessionGaps(candles: readonly Candle[]): NullableNumber[] {
  const result = empty(candles.length);
  for (let index = 1; index < candles.length; index += 1) {
    const previousClose = candles[index - 1]!.close;
    if (!Number.isFinite(previousClose) || previousClose === 0) continue;
    result[index] =
      ((candles[index]!.open - previousClose) / previousClose) * 100;
  }
  return result;
}

/**
 * Seasonality: for each bar, the average same-calendar-month percent change
 * across the whole history.
 */
export function seasonality(candles: readonly Candle[]): NullableNumber[] {
  const result = empty(candles.length);
  const byMonth: number[][] = Array.from({ length: 12 }, () => []);
  for (let index = 1; index < candles.length; index += 1) {
    const previousClose = candles[index - 1]!.close;
    const close = candles[index]!.close;
    if (!Number.isFinite(previousClose) || previousClose === 0) continue;
    if (!Number.isFinite(close)) continue;
    const month = new Date(candles[index]!.timestamp).getUTCMonth();
    byMonth[month]!.push(((close - previousClose) / previousClose) * 100);
  }
  const average = byMonth.map((values) =>
    values.length === 0
      ? null
      : values.reduce((a, b) => a + b, 0) / values.length,
  );
  for (let index = 0; index < candles.length; index += 1) {
    const month = new Date(candles[index]!.timestamp).getUTCMonth();
    result[index] = average[month];
  }
  return result;
}

/**
 * Moon phases: illuminated fraction of the moon (0–1) for each bar's date,
 * from the synodic month anchored at the 2000-01-06 new moon.
 */
export function moonPhases(candles: readonly Candle[]): NullableNumber[] {
  const SYNODIC_MS = 29.530588853 * 86_400_000;
  const REFERENCE = Date.UTC(2000, 0, 6, 18, 14);
  return candles.map((candle) => {
    const age = (((candle.timestamp - REFERENCE) % SYNODIC_MS) + SYNODIC_MS) % SYNODIC_MS;
    return (1 - Math.cos((2 * Math.PI * age) / SYNODIC_MS)) / 2;
  });
}

/** Performance: percent change of the source since the first bar. */
export function performanceSinceStart(values: Series): NullableNumber[] {
  const result = empty(values.length);
  const first = values.find((value) => Number.isFinite(value));
  if (first === undefined || first === 0) return result;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!Number.isFinite(value)) continue;
    result[index] = ((value - first) / Math.abs(first)) * 100;
  }
  return result;
}

/**
 * Rolling Pearson correlation between two series (here: close vs volume).
 */
export function rollingCorrelation(
  first: Series,
  second: Series,
  length = 20,
): NullableNumber[] {
  const result = empty(first.length);
  if (!validPeriod(length)) return result;
  for (let index = length - 1; index < first.length; index += 1) {
    const a = first.slice(index - length + 1, index + 1);
    const b = second.slice(index - length + 1, index + 1);
    if (
      a.some((value) => !Number.isFinite(value)) ||
      b.some((value) => !Number.isFinite(value))
    ) {
      continue;
    }
    const meanA = a.reduce((x, y) => x + y, 0) / length;
    const meanB = b.reduce((x, y) => x + y, 0) / length;
    let num = 0;
    let denA = 0;
    let denB = 0;
    for (let k = 0; k < length; k += 1) {
      num += (a[k]! - meanA) * (b[k]! - meanB);
      denA += (a[k]! - meanA) * (a[k]! - meanA);
      denB += (b[k]! - meanB) * (b[k]! - meanB);
    }
    result[index] = denA === 0 || denB === 0 ? null : num / Math.sqrt(denA * denB);
  }
  return result;
}

/** Cumulative mean of a series (average of everything seen so far). */
export function cumulativeAverage(values: Series): NullableNumber[] {
  const result = empty(values.length);
  let sum = 0;
  let count = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!Number.isFinite(value)) {
      if (count > 0) result[index] = sum / count;
      continue;
    }
    sum += value;
    count += 1;
    result[index] = sum / count;
  }
  return result;
}

/* ------------------------------------------------------------------------ */
/* Zigzag and pivot variants                                               */
/* ------------------------------------------------------------------------ */

/**
 * Zigzag pivots: only swing highs/lows that reverse by at least `deviation`
 * percent survive; every other bar is null so the renderer joins the pivots.
 */
export function zigzag(
  candles: readonly Candle[],
  deviation = 5,
): NullableNumber[] {
  const result = empty(candles.length);
  if (candles.length === 0 || !(deviation > 0)) return result;
  const ratio = deviation / 100;
  // Pivots confirmed so far, newest last.
  const pivots: Array<{ index: number; price: number; direction: 1 | -1 }> = [
    { index: 0, price: candles[0]!.high, direction: 1 },
  ];
  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index]!;
    const head = pivots[pivots.length - 1]!;
    if (head.direction === 1) {
      if (candle.high >= head.price) {
        head.index = index;
        head.price = candle.high;
      } else if (candle.low <= head.price * (1 - ratio)) {
        pivots.push({ index, price: candle.low, direction: -1 });
      }
    } else {
      if (candle.low <= head.price) {
        head.index = index;
        head.price = candle.low;
      } else if (candle.high >= head.price * (1 + ratio)) {
        pivots.push({ index, price: candle.high, direction: 1 });
      }
    }
  }
  for (const pivot of pivots) result[pivot.index] = pivot.price;
  return result;
}

/**
 * Triple Exponential Moving Average: 3×EMA − 3×EMA(EMA) + EMA(EMA(EMA)).
 */
export function tripleExponentialMovingAverage(
  values: Series,
  period: number,
): NullableNumber[] {
  const result = empty(values.length);
  if (!validPeriod(period)) return result;
  const ema1 = ema(values, period);
  const ema2 = ema(num(ema1), period);
  const ema3 = ema(num(ema2), period);
  for (let index = 0; index < values.length; index += 1) {
    const a = ema1[index];
    const b = ema2[index];
    const c = ema3[index];
    if (a === null || b === null || c === null) continue;
    result[index] = 3 * (a - b) + c;
  }
  return result;
}

export interface SessionProfile {
  /** Cumulative volume within the bar's calendar-day session. */
  readonly sessionVolume: NullableNumber[];
  /** Developing point of control of the session. */
  readonly poc: NullableNumber[];
  /** Developing value-area high/low (70% of session volume). */
  readonly vah: NullableNumber[];
  readonly val: NullableNumber[];
}

/**
 * Session volume profile analytics. Bars are grouped into calendar-day
 * sessions; each session's volume is spread across `rows` price buckets to
 * find the developing point of control and the 70% value area.
 */
export function sessionVolumeProfile(
  candles: readonly Candle[],
  rows = 24,
): SessionProfile {
  const sessionVolume = empty(candles.length);
  const poc = empty(candles.length);
  const vah = empty(candles.length);
  const val = empty(candles.length);
  if (rows < 2) return { sessionVolume, poc, vah, val };
  let sessionStart = 0;
  const dayOf = (index: number): number => {
    const date = new Date(candles[index]!.timestamp);
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    );
  };
  for (let index = 0; index < candles.length; index += 1) {
    if (index > 0 && dayOf(index) !== dayOf(index - 1)) sessionStart = index;
    let total = 0;
    let highest = -Infinity;
    let lowest = Infinity;
    let complete = true;
    for (let back = sessionStart; back <= index; back += 1) {
      const bar = candles[back]!;
      const volume = bar.volume ?? Number.NaN;
      if (!Number.isFinite(volume)) {
        complete = false;
        break;
      }
      total += volume;
      if (bar.high > highest) highest = bar.high;
      if (bar.low < lowest) lowest = bar.low;
    }
    if (!complete || total <= 0 || !(highest > lowest)) {
      sessionVolume[index] =
        complete && total > 0 ? total : (sessionVolume[index - 1] ?? null);
      continue;
    }
    sessionVolume[index] = total;
    const buckets = new Array<number>(rows).fill(0);
    const width = (highest - lowest) / rows;
    for (let back = sessionStart; back <= index; back += 1) {
      const bar = candles[back]!;
      const volume = bar.volume ?? 0;
      const center = (bar.high + bar.low) / 2;
      const row = Math.min(
        rows - 1,
        Math.max(0, Math.floor((center - lowest) / width)),
      );
      buckets[row]! += volume;
    }
    let pocRow = 0;
    for (let row = 0; row < rows; row += 1) {
      if (buckets[row]! > buckets[pocRow]!) pocRow = row;
    }
    poc[index] = lowest + (pocRow + 0.5) * width;
    const target = total * 0.7;
    let covered = buckets[pocRow]!;
    let top = pocRow;
    let bottom = pocRow;
    while (covered < target && (top + 1 < rows || bottom - 1 >= 0)) {
      const up = top + 1 < rows ? buckets[top + 1]! : -1;
      const down = bottom - 1 >= 0 ? buckets[bottom - 1]! : -1;
      if (up >= down && up >= 0) {
        covered += up;
        top += 1;
      } else if (down >= 0) {
        covered += down;
        bottom -= 1;
      } else {
        break;
      }
    }
    vah[index] = lowest + (top + 1) * width;
    val[index] = lowest + bottom * width;
  }
  return { sessionVolume, poc, vah, val };
}

/* ------------------------------------------------------------------------ */
/* Distribution profiles (TPO / volume profile family)                      */
/* ------------------------------------------------------------------------ */

export type DistributionWeight = "volume" | "time";

export interface DistributionSummary {
  readonly poc: number | null;
  readonly vah: number | null;
  readonly val: number | null;
  readonly total: number;
}

/**
 * Core distribution over bars [from, to]: each bar's weight is spread across
 * every price row its [low, high] range touches (volume is split evenly so
 * the total is conserved; time counts one TPO letter per touched row, the
 * Market Profile convention). POC is the heaviest row; the value area grows
 * outward from POC until it holds 70% of the weight.
 */
export function rangeDistribution(
  candles: readonly Candle[],
  from: number,
  to: number,
  rows = 24,
  weight: DistributionWeight = "volume",
): DistributionSummary {
  const start = Math.max(0, Math.min(from, to));
  const end = Math.min(candles.length - 1, Math.max(from, to));
  if (rows < 2 || end < start) return { poc: null, vah: null, val: null, total: 0 };
  let highest = -Infinity;
  let lowest = Infinity;
  let total = 0;
  let complete = true;
  for (let index = start; index <= end; index += 1) {
    const bar = candles[index]!;
    if (weight === "volume") {
      const volume = bar.volume ?? Number.NaN;
      if (!Number.isFinite(volume)) {
        complete = false;
        break;
      }
      total += volume;
    } else {
      total += 1;
    }
    if (bar.high > highest) highest = bar.high;
    if (bar.low < lowest) lowest = bar.low;
  }
  if (!complete || total <= 0 || !(highest > lowest)) {
    return { poc: null, vah: null, val: null, total: 0 };
  }
  const buckets = new Array<number>(rows).fill(0);
  const width = (highest - lowest) / rows;
  const rowOf = (price: number): number =>
    Math.min(rows - 1, Math.max(0, Math.floor((price - lowest) / width)));
  for (let index = start; index <= end; index += 1) {
    const bar = candles[index]!;
    const first = rowOf(bar.low);
    const last = rowOf(bar.high);
    if (weight === "volume") {
      const share = (bar.volume ?? 0) / (last - first + 1);
      for (let row = first; row <= last; row += 1) buckets[row]! += share;
    } else {
      for (let row = first; row <= last; row += 1) buckets[row]! += 1;
    }
  }
  let pocRow = 0;
  for (let row = 0; row < rows; row += 1) {
    if (buckets[row]! > buckets[pocRow]!) pocRow = row;
  }
  const target = total * 0.7;
  let covered = buckets[pocRow]!;
  let top = pocRow;
  let bottom = pocRow;
  while (covered < target && (top + 1 < rows || bottom - 1 >= 0)) {
    const up = top + 1 < rows ? buckets[top + 1]! : -1;
    const down = bottom - 1 >= 0 ? buckets[bottom - 1]! : -1;
    if (up >= down && up >= 0) {
      covered += up;
      top += 1;
    } else if (down >= 0) {
      covered += down;
      bottom -= 1;
    } else {
      break;
    }
  }
  return {
    poc: lowest + (pocRow + 0.5) * width,
    vah: lowest + (top + 1) * width,
    val: lowest + bottom * width,
    total,
  };
}

export type ProfilePeriod = "day" | "week" | "month";

function periodKey(candles: readonly Candle[], index: number, period: ProfilePeriod): number {
  const date = new Date(candles[index]!.timestamp);
  if (period === "month") return Date.UTC(date.getUTCFullYear(), date.getUTCMonth());
  if (period === "week") {
    const day = (date.getUTCDay() + 6) % 7;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - day);
    return Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
  }
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Developing distribution: at every bar, the profile of the current window
 * (session/period/trailing) is recomputed and its POC/VAH/VAL emitted — the
 * developing point of control and value area TradingView draws intraday.
 */
export function developingDistribution(
  candles: readonly Candle[],
  rows = 24,
  weight: DistributionWeight = "volume",
  period: ProfilePeriod | "trailing" = "day",
  trailingLength = 30,
): { poc: NullableNumber[]; vah: NullableNumber[]; val: NullableNumber[] } {
  const poc = empty(candles.length);
  const vah = empty(candles.length);
  const val = empty(candles.length);
  let windowStart = 0;
  for (let index = 0; index < candles.length; index += 1) {
    if (period === "trailing") {
      windowStart = Math.max(0, index - trailingLength + 1);
    } else if (index > 0 && periodKey(candles, index, period) !== periodKey(candles, index - 1, period)) {
      windowStart = index;
    }
    const summary = rangeDistribution(candles, windowStart, index, rows, weight);
    poc[index] = summary.poc;
    vah[index] = summary.vah;
    val[index] = summary.val;
  }
  return { poc, vah, val };
}

/**
 * Static distribution: one profile over [from, end] drawn as flat rays —
 * how Fixed Range, Visible Range and Auto Anchored profiles render their
 * POC/VAH/VAL. Bars before `from` are null.
 */
export function staticDistribution(
  candles: readonly Candle[],
  from: number,
  rows = 24,
  weight: DistributionWeight = "volume",
): { poc: NullableNumber[]; vah: NullableNumber[]; val: NullableNumber[] } {
  const poc = empty(candles.length);
  const vah = empty(candles.length);
  const val = empty(candles.length);
  const start = Math.max(0, from);
  if (start >= candles.length) return { poc, vah, val };
  const summary = rangeDistribution(candles, start, candles.length - 1, rows, weight);
  if (summary.poc === null) return { poc, vah, val };
  for (let index = start; index < candles.length; index += 1) {
    poc[index] = summary.poc;
    vah[index] = summary.vah;
    val[index] = summary.val;
  }
  return { poc, vah, val };
}

/** Auto anchor: the highest-volume bar, mirroring autoAnchoredVwap. */
export function autoProfileAnchor(candles: readonly Candle[]): number {
  let anchor = 0;
  let best = -Infinity;
  for (let index = 0; index < candles.length; index += 1) {
    const volume = candles[index]!.volume ?? Number.NaN;
    if (Number.isFinite(volume) && volume > best) {
      best = volume;
      anchor = index;
    }
  }
  return anchor;
}

/**
 * Median channel (official definition): rolling median of a source, its EMA,
 * and ATR-multiple bands around the median.
 */
export function medianChannel(
  candles: readonly Candle[],
  source: Series,
  length = 14,
  atrLength = 14,
  multiplier = 2,
): {
  median: NullableNumber[];
  emaLine: NullableNumber[];
  upper: NullableNumber[];
  lower: NullableNumber[];
} {
  const median = rollingMedian(source, length);
  const emaLine = ema(num(median), length);
  const atr = num(averageTrueRange(candles, atrLength));
  const upper = empty(candles.length);
  const lower = empty(candles.length);
  for (let index = 0; index < candles.length; index += 1) {
    const mid = median[index];
    const band = atr[index];
    if (mid === null || band === null) continue;
    const width = multiplier * (band ?? Number.NaN);
    upper[index] = mid + width;
    lower[index] = mid - width;
  }
  return { median, emaLine, upper, lower };
}

/**
 * Pivot Points High Low: classic floor pivots from the rolling highest high
 * and lowest low instead of the previous bar's range.
 */
export function pivotPointsHighLow(
  candles: readonly Candle[],
  window = 10,
): {
  pivot: NullableNumber[];
  r1: NullableNumber[];
  r2: NullableNumber[];
  s1: NullableNumber[];
  s2: NullableNumber[];
} {
  const pivot = empty(candles.length);
  const r1 = empty(candles.length);
  const r2 = empty(candles.length);
  const s1 = empty(candles.length);
  const s2 = empty(candles.length);
  if (!validPeriod(window)) return { pivot, r1, r2, s1, s2 };
  const high = highs(candles);
  const low = lows(candles);
  const highestHigh = num(rollingMax(high, window));
  const lowestLow = num(rollingMin(low, window));
  for (let index = 0; index < candles.length; index += 1) {
    const hh = highestHigh[index]!;
    const ll = lowestLow[index]!;
    const close = candles[index]!.close;
    if (!Number.isFinite(hh) || !Number.isFinite(ll) || !Number.isFinite(close))
      continue;
    const p = (hh + ll + close) / 3;
    pivot[index] = p;
    r1[index] = 2 * p - ll;
    s1[index] = 2 * p - hh;
    r2[index] = p + (hh - ll);
    s2[index] = p - (hh - ll);
  }
  return { pivot, r1, r2, s1, s2 };
}

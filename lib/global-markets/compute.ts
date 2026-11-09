/**
 * Pure calculations for the Global Markets page: period performance,
 * moving averages, RSI, MACD, a technical rating and classic pivot levels,
 * all from an instrument's daily bars plus its live price.
 */

export interface DailyBar {
  /** YYYY-MM-DD (UTC date of the bar). */
  readonly date: string;
  readonly high: number | null;
  readonly low: number | null;
  readonly close: number;
}

export interface Performance {
  readonly ytd: number | null;
  readonly w1: number | null;
  readonly m1: number | null;
  readonly m3: number | null;
  readonly m6: number | null;
  readonly y1: number | null;
  readonly y2: number | null;
  readonly y3: number | null;
  readonly y5: number | null;
}

export type TechnicalRating =
  | "Very Bullish"
  | "Bullish"
  | "Neutral"
  | "Bearish"
  | "Very Bearish";

export interface Technical {
  readonly sma20: number | null;
  readonly sma50: number | null;
  readonly sma200: number | null;
  readonly rsi14: number | null;
  readonly macd: number | null;
  readonly macdSignal: number | null;
  readonly rating: TechnicalRating | null;
}

export interface Pivots {
  readonly pivot: number;
  readonly r1: number;
  readonly r2: number;
  readonly r3: number;
  readonly s1: number;
  readonly s2: number;
  readonly s3: number;
}

export const EMPTY_PERFORMANCE: Performance = {
  ytd: null, w1: null, m1: null, m3: null, m6: null, y1: null, y2: null, y3: null, y5: null,
};

function shiftDate(date: string, days: number, months = 0, years = 0): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCFullYear(value.getUTCFullYear() - years);
  value.setUTCMonth(value.getUTCMonth() - months);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

/** Close of the last bar on or before `date`, or null when history starts later. */
function closeOnOrBefore(bars: readonly DailyBar[], date: string): number | null {
  let found: number | null = null;
  for (const bar of bars) {
    if (bar.date > date) break;
    found = bar.close;
  }
  return found;
}

function change(price: number, base: number | null): number | null {
  if (base === null || !(base > 0) || !Number.isFinite(price)) return null;
  return (price / base - 1) * 100;
}

/**
 * % change from the close on or before each lookback date to the live price.
 * YTD runs from the last close of the previous calendar year. A lookback
 * beyond the available history is null rather than a shorter period.
 */
export function computePerformance(
  bars: readonly DailyBar[],
  price: number | null,
  today: string,
): Performance {
  if (price === null || bars.length === 0) return EMPTY_PERFORMANCE;
  const first = bars[0]!.date;
  const at = (date: string): number | null =>
    date < first ? null : change(price, closeOnOrBefore(bars, date));
  const yearStart = `${today.slice(0, 4)}-01-01`;
  return {
    ytd: at(shiftDate(yearStart, 1)),
    w1: at(shiftDate(today, 7)),
    m1: at(shiftDate(today, 0, 1)),
    m3: at(shiftDate(today, 0, 3)),
    m6: at(shiftDate(today, 0, 6)),
    y1: at(shiftDate(today, 0, 0, 1)),
    y2: at(shiftDate(today, 0, 0, 2)),
    y3: at(shiftDate(today, 0, 0, 3)),
    y5: at(shiftDate(today, 0, 0, 5)),
  };
}

export function sma(values: readonly number[], period: number): number | null {
  if (values.length < period) return null;
  let sum = 0;
  for (let index = values.length - period; index < values.length; index += 1) sum += values[index]!;
  return sum / period;
}

function emaSeries(values: readonly number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const out = [ema];
  for (let index = period; index < values.length; index += 1) {
    ema = values[index]! * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

/** Wilder's 14-period RSI. */
export function rsi(values: readonly number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let index = 1; index <= period; index += 1) {
    const delta = values[index]! - values[index - 1]!;
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  gain /= period;
  loss /= period;
  for (let index = period + 1; index < values.length; index += 1) {
    const delta = values[index]! - values[index - 1]!;
    gain = (gain * (period - 1) + Math.max(delta, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-delta, 0)) / period;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
}

/** MACD (12, 26) and its 9-period signal line. */
export function macd(values: readonly number[]): { macd: number; signal: number } | null {
  const fast = emaSeries(values, 12);
  const slow = emaSeries(values, 26);
  if (slow.length === 0) return null;
  const offset = fast.length - slow.length;
  const line = slow.map((value, index) => fast[index + offset]! - value);
  const signal = emaSeries(line, 9);
  if (signal.length === 0) return null;
  return { macd: line.at(-1)!, signal: signal.at(-1)! };
}

/**
 * Six votes, +1 bullish / -1 bearish each: price vs the 20, 50 and 200-day
 * averages, the 50-day vs the 200-day (trend), MACD vs its signal, and RSI
 * above 60 / below 40. A total of +4 or more is Very Bullish, +2 Bullish,
 * -2 Bearish, -4 or less Very Bearish. Needs at least the 50-day average.
 */
export function technicalRating(input: {
  price: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
}): TechnicalRating | null {
  if (input.sma50 === null) return null;
  const vote = (condition: boolean | null): number => (condition === null ? 0 : condition ? 1 : -1);
  const score =
    vote(input.sma20 === null ? null : input.price > input.sma20) +
    vote(input.price > input.sma50) +
    vote(input.sma200 === null ? null : input.price > input.sma200) +
    vote(input.sma200 === null ? null : input.sma50 > input.sma200) +
    vote(input.macd === null || input.macdSignal === null ? null : input.macd > input.macdSignal) +
    (input.rsi14 === null ? 0 : input.rsi14 > 60 ? 1 : input.rsi14 < 40 ? -1 : 0);
  if (score >= 4) return "Very Bullish";
  if (score >= 2) return "Bullish";
  if (score <= -4) return "Very Bearish";
  if (score <= -2) return "Bearish";
  return "Neutral";
}

/**
 * History with the live quote folded in as the session's bar: it replaces a
 * bar already dated `sessionDate`, or is appended when history (refreshed
 * every few hours) does not have that session yet.
 */
export function withLiveBar(
  bars: readonly DailyBar[],
  quote: { price: number | null; high: number | null; low: number | null },
  sessionDate: string | null,
): DailyBar[] {
  if (quote.price === null || sessionDate === null || bars.length === 0) return [...bars];
  // FX and futures quotes get re-stamped over the weekend with an unchanged
  // price; that is not a session, so it must not become a (flat) daily bar.
  const weekday = new Date(`${sessionDate}T00:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return [...bars];
  const last = bars.at(-1)!;
  if (last.date > sessionDate) return [...bars];
  const live: DailyBar = {
    date: sessionDate,
    high: Math.max(quote.high ?? quote.price, quote.price, last.date === sessionDate ? (last.high ?? 0) : 0),
    low: Math.min(
      quote.low ?? quote.price,
      quote.price,
      last.date === sessionDate ? (last.low ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY,
    ),
    close: quote.price,
  };
  return last.date === sessionDate ? [...bars.slice(0, -1), live] : [...bars, live];
}

/** Bars must already include the live session (see withLiveBar). */
export function computeTechnical(bars: readonly DailyBar[], price: number | null): Technical | null {
  if (price === null || bars.length < 20) return null;
  const series = bars.map((bar) => bar.close);
  const averages = { sma20: sma(series, 20), sma50: sma(series, 50), sma200: sma(series, 200) };
  const rsi14 = rsi(series);
  const lines = macd(series);
  return {
    ...averages,
    rsi14,
    macd: lines?.macd ?? null,
    macdSignal: lines?.signal ?? null,
    rating: technicalRating({
      price,
      ...averages,
      rsi14,
      macd: lines?.macd ?? null,
      macdSignal: lines?.signal ?? null,
    }),
  };
}

/** Classic floor pivots from the previous completed session's high, low and close. */
export function classicPivots(high: number, low: number, close: number): Pivots {
  const pivot = (high + low + close) / 3;
  return {
    pivot,
    r1: 2 * pivot - low,
    s1: 2 * pivot - high,
    r2: pivot + (high - low),
    s2: pivot - (high - low),
    r3: high + 2 * (pivot - low),
    s3: low - 2 * (high - pivot),
  };
}

/**
 * Pivots for the session being traded come from the last completed one.
 * While a session is in progress that is the last bar before it; once it has
 * closed, its own bar is complete and gives the next session's pivots.
 * Bars must already include the live session (see withLiveBar).
 */
export function sessionPivots(
  bars: readonly DailyBar[],
  sessionDate: string | null,
  inProgress: boolean,
): Pivots | null {
  const usable = bars.filter((bar) => bar.high !== null && bar.low !== null && bar.high > 0 && bar.low > 0);
  const completed =
    inProgress && sessionDate !== null ? usable.filter((bar) => bar.date < sessionDate) : usable;
  const bar = completed.at(-1);
  return bar ? classicPivots(bar.high!, bar.low!, bar.close) : null;
}

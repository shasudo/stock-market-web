export const HISTORICAL_NO_DATA_MARKER = "NO_DATA";
export const MINIMUM_HISTORICAL_DATA_POINTS = 10;
const MINIMUM_TRADE_DATE_YEAR = 2000;
const IST_OFFSET_MILLISECONDS = 5.5 * 60 * 60 * 1_000;

export interface HistoricalSeries {
  readonly closes: readonly number[];
  readonly timestamps: readonly number[];
  readonly lastTimestamp: number;
  /**
   * Source indices that survived validation. Present only when at least one
   * candle was discarded, so the OHLCV parser can drop the same positions from
   * its parallel arrays and keep all six in step.
   */
  readonly keptIndices?: readonly number[];
  /** Candles discarded as malformed. */
  readonly droppedCandles?: number;
}

export interface HistoricalOhlcvSeries extends HistoricalSeries {
  readonly opens: readonly number[];
  readonly highs: readonly number[];
  readonly lows: readonly number[];
  readonly volumes: readonly number[];
}

/**
 * Parsing strictness. Off by default: intraday pattern analysis, backtests and
 * stored-series reads all require a complete, aligned candle set. Only the deep
 * historical backfill opts in, where a single bad print from the 2000s must not
 * discard a symbol's entire 25-year history.
 */
export interface HistoricalParseOptions {
  readonly tolerateBadCandles?: boolean;
}

export type HistoricalSeriesParseResult =
  | { readonly kind: "data"; readonly value: HistoricalSeries }
  | { readonly kind: "no-data" }
  | { readonly kind: "invalid"; readonly reason: string };

export type HistoricalOhlcvSeriesParseResult =
  | { readonly kind: "data"; readonly value: HistoricalOhlcvSeries }
  | { readonly kind: "no-data" }
  | { readonly kind: "invalid"; readonly reason: string };

type UnknownRecord = Record<string, unknown>;

export type HistoricalUpdateMode = "append" | "replace";

export interface DhanTradeDate {
  readonly date: string;
  readonly timestamp: number;
}

export function parseHistoricalSeriesResponse(
  payload: unknown,
  options: HistoricalParseOptions = {},
): HistoricalSeriesParseResult {
  const tolerate = options.tolerateBadCandles === true;
  if (!isUnknownRecord(payload)) {
    return { kind: "invalid", reason: "The response must be an object." };
  }

  if (
    typeof payload.errorCode === "string" ||
    typeof payload.errorMessage === "string"
  ) {
    return {
      kind: "invalid",
      reason: "The upstream service returned an error payload.",
    };
  }

  const deduped = dropDuplicateTimestamps(payload);
  const rawCloses = deduped.close;
  const rawTimestamps = deduped.timestamp;
  if (rawCloses === undefined && rawTimestamps === undefined) {
    return { kind: "no-data" };
  }

  if (!Array.isArray(rawCloses) || !Array.isArray(rawTimestamps)) {
    return {
      kind: "invalid",
      reason: "The response must include close and timestamp arrays together.",
    };
  }

  if (rawCloses.length === 0 && rawTimestamps.length === 0) {
    return { kind: "no-data" };
  }

  if (
    rawCloses.length === 0 ||
    rawTimestamps.length === 0 ||
    rawCloses.length !== rawTimestamps.length
  ) {
    return {
      kind: "invalid",
      reason:
        "The close and timestamp arrays must be non-empty and have equal lengths.",
    };
  }

  const closes: number[] = [];
  const timestamps: number[] = [];
  const keptIndices: number[] = [];
  let previousTimestamp = 0;

  // A single malformed candle used to invalidate the whole response. That was
  // survivable over a ten-year window, but full history reaches back ~25 years
  // into older, messier data, where one bad print would silently discard every
  // candle a symbol has. Bad candles are dropped individually instead; the
  // caller sees how many via droppedCandles.
  for (let index = 0; index < rawCloses.length; index += 1) {
    const close = rawCloses[index];
    const timestamp = rawTimestamps[index];
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) {
      if (!tolerate) {
        return {
          kind: "invalid",
          reason: "Every historical close must be a positive finite number.",
        };
      }
      continue;
    }
    if (
      typeof timestamp !== "number" ||
      !Number.isSafeInteger(timestamp) ||
      timestamp <= 0 ||
      timestamp <= previousTimestamp
    ) {
      if (!tolerate) {
        return {
          kind: "invalid",
          reason:
            "Historical timestamps must be strictly increasing positive integer seconds.",
        };
      }
      continue;
    }

    closes.push(close);
    timestamps.push(timestamp);
    keptIndices.push(index);
    previousTimestamp = timestamp;
  }

  if (closes.length === 0) {
    return {
      kind: "invalid",
      reason: "Every candle in the response was malformed.",
    };
  }

  const lastTimestamp = timestamps[timestamps.length - 1];
  if (lastTimestamp === undefined) {
    return {
      kind: "invalid",
      reason: "The response did not include a final timestamp.",
    };
  }

  const droppedCandles = rawCloses.length - closes.length;
  return {
    kind: "data",
    value:
      droppedCandles > 0
        ? { closes, timestamps, lastTimestamp, keptIndices, droppedCandles }
        : { closes, timestamps, lastTimestamp },
  };
}

/**
 * Dhan daily and intraday responses contain OHLCV alongside close/timestamp.
 * This parser deliberately requires a complete, aligned candle set so candle
 * patterns are never calculated from incomplete or mismatched history.
 */
export function parseHistoricalOhlcvSeriesResponse(
  payload: unknown,
  options: HistoricalParseOptions = {},
): HistoricalOhlcvSeriesParseResult {
  const tolerate = options.tolerateBadCandles === true;
  // Must dedupe here too, and hand the SAME normalized payload to the base
  // parser, or the open/high/low/volume arrays would still carry the dropped
  // rows and no longer line up with closes/timestamps.
  const normalized = dropDuplicateTimestamps(payload);
  const base = parseHistoricalSeriesResponse(normalized, options);
  if (base.kind !== "data") return base;

  // The base parser may have quarantined malformed candles. Drop the same
  // positions here before length-checking, or every array would look mismatched.
  const kept = base.value.keptIndices;
  const align = (value: unknown): unknown =>
    kept && Array.isArray(value) ? kept.map((index) => value[index]) : value;

  const opens = parseCandleArray(
    align(normalized.open),
    "open",
    base.value.closes.length,
  );
  const highs = parseCandleArray(
    align(normalized.high),
    "high",
    base.value.closes.length,
  );
  const lows = parseCandleArray(
    align(normalized.low),
    "low",
    base.value.closes.length,
  );
  const volumes = parseCandleArray(
    align(normalized.volume),
    "volume",
    base.value.closes.length,
    true,
  );

  if (typeof opens === "string") return { kind: "invalid", reason: opens };
  if (typeof highs === "string") return { kind: "invalid", reason: highs };
  if (typeof lows === "string") return { kind: "invalid", reason: lows };
  if (typeof volumes === "string") return { kind: "invalid", reason: volumes };

  const usable: number[] = [];
  for (let index = 0; index < base.value.closes.length; index += 1) {
    const open = opens[index];
    const high = highs[index];
    const low = lows[index];
    const close = base.value.closes[index];
    if (
      open === undefined ||
      high === undefined ||
      low === undefined ||
      close === undefined ||
      high < Math.max(open, close) ||
      low > Math.min(open, close)
    ) {
      if (!tolerate) {
        return {
          kind: "invalid",
          reason:
            "Every candle must have a high/low range enclosing open and close.",
        };
      }
      continue;
    }
    usable.push(index);
  }

  if (usable.length === 0) {
    return {
      kind: "invalid",
      reason: "No candle had a high/low range enclosing open and close.",
    };
  }

  if (usable.length === base.value.closes.length) {
    return {
      kind: "data",
      value: { ...base.value, opens, highs, lows, volumes },
    };
  }

  // Some candles were inconsistent. Keep the rest rather than discarding a
  // symbol's entire history for a handful of bad prints in the 2000s.
  const take = <T>(source: readonly T[]): T[] =>
    usable.map((index) => source[index] as T);
  const closes = take(base.value.closes);
  const timestamps = take(base.value.timestamps);
  const lastTimestamp = timestamps[timestamps.length - 1] as number;

  return {
    kind: "data",
    value: {
      closes,
      timestamps,
      lastTimestamp,
      opens: take(opens),
      highs: take(highs),
      lows: take(lows),
      volumes: take(volumes),
      droppedCandles:
        (base.value.droppedCandles ?? 0) +
        (base.value.closes.length - usable.length),
    },
  };
}

function parseCandleArray(
  value: unknown,
  field: string,
  expectedLength: number,
  acceptsZero = false,
): number[] | string {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    return `The ${field} array must have the same length as close.`;
  }

  const result: number[] = [];
  for (const rawValue of value) {
    if (
      typeof rawValue !== "number" ||
      !Number.isFinite(rawValue) ||
      (acceptsZero ? rawValue < 0 : rawValue <= 0)
    ) {
      return `Every historical ${field} must be a ${acceptsZero ? "non-negative" : "positive"} finite number.`;
    }
    result.push(rawValue);
  }
  return result;
}

/**
 * Dhan stamps a daily candle at IST midnight, i.e. 18:30:00 UTC on the PREVIOUS
 * calendar day, so formatting in UTC labels every candle one day early and
 * makes the stored lastDate disagree with the trade date on every quote. India
 * has no DST, so shifting by the fixed +05:30 offset is exact and avoids
 * depending on the runtime's ICU locale data.
 */
const CANDLE_ARRAY_KEYS = [
  "open",
  "high",
  "low",
  "close",
  "volume",
  "timestamp",
] as const;

/**
 * Collapses repeated timestamps, keeping the last occurrence.
 *
 * Dhan occasionally returns one duplicated session inside an otherwise good
 * series — securityId 100 had 2478 candles and a single repeated 2023-10-25.
 * The strictly-increasing check then rejected the whole ten-year response, so
 * those symbols never got history and were re-fetched on every run. Only exact
 * duplicates are collapsed; timestamps that actually move backwards still fail
 * validation, because that is real corruption rather than a repeated row.
 */
function dropDuplicateTimestamps(payload: unknown): UnknownRecord {
  if (!isUnknownRecord(payload)) return {};

  const timestamps = payload.timestamp;
  if (!Array.isArray(timestamps)) return payload;

  const keptIndexes: number[] = [];
  const positionByTimestamp = new Map<number, number>();
  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index];
    if (typeof timestamp !== "number") {
      keptIndexes.push(index);
      continue;
    }
    const existing = positionByTimestamp.get(timestamp);
    if (existing === undefined) {
      positionByTimestamp.set(timestamp, keptIndexes.length);
      keptIndexes.push(index);
    } else {
      keptIndexes[existing] = index;
    }
  }

  if (keptIndexes.length === timestamps.length) return payload;

  const result: UnknownRecord = { ...payload };
  for (const key of CANDLE_ARRAY_KEYS) {
    const values = payload[key];
    if (Array.isArray(values) && values.length === timestamps.length) {
      result[key] = keptIndexes.map((index) => values[index]);
    }
  }
  return result;
}

export function formatHistoricalDate(timestamp: number): string | null {
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return null;
  }

  const date = new Date(timestamp * 1_000 + IST_OFFSET_MILLISECONDS);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function parseDhanTradeDate(
  value: string | undefined,
  now: Date = new Date(),
): DhanTradeDate | null {
  const match = value?.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{2}:\d{2}:\d{2})?$/,
  );
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < MINIMUM_TRADE_DATE_YEAR) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getTime() > now.getTime() + 24 * 60 * 60 * 1_000
  ) {
    return null;
  }

  // Stamped at IST midnight, the way Dhan stamps its own daily candles, so a
  // candle the sync appends and the same candle the backfill later fetches
  // carry one timestamp. They used to differ by 5h30 (UTC midnight here), which
  // made every date-anchored lookup over a mixed series land one session off.
  return {
    date: date.toISOString().slice(0, 10),
    timestamp: istMidnightTimestamp(date.toISOString().slice(0, 10)),
  };
}

export function determineHistoricalUpdateMode(
  lastTimestamp: number | undefined,
  tradeDate: string,
): HistoricalUpdateMode | "skip" | null {
  const lastDate =
    lastTimestamp === undefined ? null : formatHistoricalDate(lastTimestamp);
  if (lastDate === null) {
    return null;
  }
  if (tradeDate === lastDate) {
    return "replace";
  }
  return tradeDate > lastDate ? "append" : "skip";
}

/** The IST calendar date ("YYYY-MM-DD") of an instant. India has no DST. */
export function istCalendarDate(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

/** Unix seconds of IST midnight on a "YYYY-MM-DD" date: Dhan's daily-candle stamp. */
export function istMidnightTimestamp(date: string): number {
  return Math.floor(
    (Date.parse(`${date}T00:00:00.000Z`) - IST_OFFSET_MILLISECONDS) / 1_000,
  );
}

/**
 * The close of the last stored session strictly before `date`, or null when
 * the series has no session before it. Sessions are compared by their IST
 * calendar date, so either timestamp convention in the array works.
 */
export function closeBeforeDate(
  series: Pick<HistoricalSeries, "closes" | "timestamps">,
  date: string,
): number | null {
  const cutoff = istMidnightTimestamp(date);
  // Both stamps a session can carry (IST midnight, or the older UTC midnight)
  // fall in [IST midnight, IST midnight + 24h), so "before the date" is
  // "before its IST midnight".
  let lo = 0;
  let hi = series.timestamps.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series.timestamps[mid] < cutoff) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return null;
  const close = series.closes[lo - 1];
  return typeof close === "number" && Number.isFinite(close) && close > 0
    ? close
    : null;
}

export interface HistoricalSeriesMergeResult {
  readonly series: HistoricalOhlcvSeries;
  /** Stored sessions the received series did not cover, kept as they were. */
  readonly kept: number;
  /** Sessions present in both, now carrying the received candle. */
  readonly replaced: number;
  /** Sessions only the received series had. */
  readonly added: number;
}

export interface DecemberSeasonality {
  /** Decembers with at least two sessions (a measurable return). */
  readonly years: number;
  /** Mean December return, percent. */
  readonly avg: number;
  /** Share of positive Decembers, percent. */
  readonly hitRate: number;
  readonly best: number;
  readonly worst: number;
}

/**
 * December seasonality over a stored candle series: for each December with
 * at least two sessions, the last close vs the first close, then the mean,
 * hit rate and extremes across those Decembers (all percent). Null when no
 * December is measurable. Dates are IST calendar dates, matching the rest
 * of the history screens.
 */
export function decemberSeasonality(
  closes: readonly number[],
  timestamps: readonly number[],
): DecemberSeasonality | null {
  const firstByYear = new Map<string, number>();
  const lastByYear = new Map<string, number>();
  const sessionsByYear = new Map<string, number>();
  const count = Math.min(closes.length, timestamps.length);
  for (let index = 0; index < count; index += 1) {
    const close = closes[index];
    const stamp = timestamps[index];
    if (
      typeof close !== "number" ||
      !Number.isFinite(close) ||
      close <= 0 ||
      typeof stamp !== "number"
    ) {
      continue;
    }
    const date = formatHistoricalDate(stamp);
    if (!date || date.slice(5, 7) !== "12") continue;
    const year = date.slice(0, 4);
    if (!firstByYear.has(year)) firstByYear.set(year, close);
    lastByYear.set(year, close);
    sessionsByYear.set(year, (sessionsByYear.get(year) ?? 0) + 1);
  }

  const returns: number[] = [];
  for (const [year, first] of firstByYear) {
    const last = lastByYear.get(year);
    if (last === undefined || (sessionsByYear.get(year) ?? 0) < 2) continue;
    returns.push(((last - first) / first) * 100);
  }

  if (returns.length === 0) return null;
  const positive = returns.filter((value) => value > 0).length;
  return {
    years: returns.length,
    avg: average(returns),
    hitRate: (positive / returns.length) * 100,
    best: Math.max(...returns),
    worst: Math.min(...returns),
  };
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Unions a stored series with one freshly received from Dhan, by session
 * date. The received candle wins wherever both have the session; stored
 * sessions outside the received range stay.
 *
 * Dhan honours the request's date window, so a ten-year fetch for a stock
 * listed in 1995 comes back shorter than what is stored. Treating a shorter
 * answer as a throttled reply and keeping the stored series wholesale meant
 * every candle the intraday sync had written wrong could never be repaired.
 * Merging repairs the covered window and keeps the older history.
 */
export function mergeHistoricalOhlcvSeries(
  stored: HistoricalOhlcvSeries | null,
  received: HistoricalOhlcvSeries,
): HistoricalSeriesMergeResult {
  if (!stored || stored.closes.length === 0) {
    return {
      series: received,
      kept: 0,
      replaced: 0,
      added: received.closes.length,
    };
  }

  const byDate = new Map<string, OhlcvCandle>();
  const readCandle = (
    series: HistoricalOhlcvSeries,
    index: number,
  ): [string, OhlcvCandle] | null => {
    const timestamp = series.timestamps[index];
    const date =
      timestamp === undefined ? null : formatHistoricalDate(timestamp);
    if (date === null) return null;
    return [
      date,
      {
        timestamp,
        open: series.opens[index],
        high: series.highs[index],
        low: series.lows[index],
        close: series.closes[index],
        volume: series.volumes[index],
      },
    ];
  };

  for (let index = 0; index < stored.closes.length; index += 1) {
    const entry = readCandle(stored, index);
    if (entry) byDate.set(entry[0], entry[1]);
  }
  const storedDates = byDate.size;

  let replaced = 0;
  for (let index = 0; index < received.closes.length; index += 1) {
    const entry = readCandle(received, index);
    if (!entry) continue;
    if (byDate.has(entry[0])) replaced += 1;
    byDate.set(entry[0], entry[1]);
  }

  const dates = [...byDate.keys()].sort();
  const timestamps: number[] = [];
  const opens: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const closes: number[] = [];
  const volumes: number[] = [];
  for (const date of dates) {
    const candle = byDate.get(date)!;
    timestamps.push(candle.timestamp);
    opens.push(candle.open);
    highs.push(candle.high);
    lows.push(candle.low);
    closes.push(candle.close);
    volumes.push(candle.volume);
  }

  return {
    series: {
      closes,
      timestamps,
      opens,
      highs,
      lows,
      volumes,
      lastTimestamp: timestamps[timestamps.length - 1]!,
    },
    kept: storedDates - replaced,
    replaced,
    added: dates.length - storedDates,
  };
}

export interface DateShift {
  readonly days?: number;
  readonly weeks?: number;
  readonly months?: number;
  readonly years?: number;
}

/**
 * Shifts a "YYYY-MM-DD" date. A month or year shift that lands on a day the
 * target month does not have (31 Mar - 1 month) clamps to that month's last
 * day rather than rolling into the next month.
 */
export function shiftDate(date: string, shift: DateShift): string {
  const base = new Date(`${date}T00:00:00.000Z`);
  const target = new Date(base.getTime());
  if (shift.months || shift.years) {
    const day = target.getUTCDate();
    target.setUTCDate(1);
    target.setUTCFullYear(
      target.getUTCFullYear() + (shift.years ?? 0),
      target.getUTCMonth() + (shift.months ?? 0),
    );
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
  }
  target.setUTCDate(
    target.getUTCDate() + (shift.days ?? 0) + (shift.weeks ?? 0) * 7,
  );
  return target.toISOString().slice(0, 10);
}

interface OhlcvCandle {
  readonly timestamp: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

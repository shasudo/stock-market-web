import {
  type CapabilitySource,
  type CapabilityStatus,
  type Candle,
  hasFiniteVolume,
  isValidCandle,
  normalizeCandles,
} from "./types";

/** Intervals Dhan can request directly through its historical REST API. */
export const DHAN_REST_INTERVALS = [
  "1min",
  "5min",
  "15min",
  "25min",
  "60min",
  "day",
] as const;

export type DhanRestInterval = (typeof DHAN_REST_INTERVALS)[number];

export type CandleIntervalUnit = "minute" | "hour" | "day" | "week" | "month";

export interface CandleInterval {
  readonly unit: CandleIntervalUnit;
  readonly size: number;
}

export type TimeframeAcquisition =
  | "native-rest"
  | "resampled-rest"
  | "tick-aggregation"
  | "daily-history-range"
  | "unavailable";

export interface TimeframeCapability {
  readonly id: string;
  readonly status: CapabilityStatus;
  readonly source: CapabilitySource;
  readonly acquisition: TimeframeAcquisition;
  readonly dhanInterval?: DhanRestInterval;
  readonly resampleInterval?: CandleInterval;
  readonly message: string;
}

export interface ResampleOptions {
  /** IANA timezone used for market-session boundaries. Defaults to NSE time. */
  readonly timeZone?: string;
  /** Minutes after midnight at which intraday bars are aligned. Defaults to 09:15. */
  readonly sessionStartMinutes?: number;
}

interface LocalDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

const DEFAULT_TIME_ZONE = "Asia/Kolkata";
const DEFAULT_SESSION_START_MINUTES = 9 * 60 + 15;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function supported(
  id: string,
  source: CapabilitySource,
  acquisition: TimeframeAcquisition,
  message: string,
  details: Pick<TimeframeCapability, "dhanInterval" | "resampleInterval"> = {},
): TimeframeCapability {
  return {
    id,
    status: "supported",
    source,
    acquisition,
    message,
    ...details,
  };
}

function needsLiveFeed(id: string, message: string): TimeframeCapability {
  return {
    id,
    status: "needs-live-feed",
    source: "dhan-live-feed",
    acquisition: "tick-aggregation",
    message,
  };
}

function needsManualInput(id: string, message: string): TimeframeCapability {
  return {
    id,
    status: "needs-manual-input",
    source: "unknown",
    acquisition: "unavailable",
    message,
  };
}

/**
 * Resolves the app's `tf-*` identifiers without importing UI configuration.
 * Dhan has native 1/5/15/25/60 minute and daily history. Other non-second
 * intervals are safe to produce by resampling those candles.
 */
export function resolveTimeframeCapability(id: string): TimeframeCapability {
  const normalized = id.trim().toLowerCase();
  const bare = normalized.startsWith("tf-") ? normalized.slice(3) : normalized;

  if (bare === "ytd" || bare === "max") {
    return supported(
      id,
      "dhan-rest",
      "daily-history-range",
      bare === "ytd"
        ? "Dhan daily history can be restricted to the current year."
        : "Dhan daily history can be loaded over the available maximum range.",
      { dhanInterval: "day" },
    );
  }

  const match = /^(\d+)(sec|min|hour|day|week|month|year)$/.exec(bare);
  if (!match) {
    return needsManualInput(
      id,
      "This is not a recognized timeframe identifier, so no data request is inferred.",
    );
  }

  const size = Number(match[1]);
  const unit = match[2];
  if (!Number.isSafeInteger(size) || size <= 0) {
    return needsManualInput(id, "Timeframe sizes must be positive integers.");
  }

  if (unit === "sec") {
    return needsLiveFeed(
      id,
      "Sub-minute bars must be built from Dhan live ticks; historical REST does not provide second candles.",
    );
  }

  if (unit === "min") {
    const nativeInterval = `${size}min` as DhanRestInterval;
    if (DHAN_REST_INTERVALS.includes(nativeInterval)) {
      return supported(
        id,
        "dhan-rest",
        "native-rest",
        `Dhan historical REST natively provides ${size}-minute candles.`,
        { dhanInterval: nativeInterval },
      );
    }

    const resampleSource = size % 5 === 0 ? "5min" : "1min";
    return supported(
      id,
      "dhan-rest",
      "resampled-rest",
      `Resample Dhan ${resampleSource === "5min" ? "5" : "1"}-minute historical candles into ${size}-minute bars.`,
      {
        dhanInterval: resampleSource,
        resampleInterval: { unit: "minute", size },
      },
    );
  }

  if (unit === "hour") {
    if (size === 1) {
      return supported(
        id,
        "dhan-rest",
        "native-rest",
        "Dhan historical REST natively provides 60-minute candles.",
        { dhanInterval: "60min" },
      );
    }

    if (size > 6) {
      // The cash session is 6h15m, so a bar longer than that is the whole
      // session under another name; showing it as an hourly bar would be
      // wrong rather than merely coarse.
      return needsManualInput(
        id,
        "NSE cash-session trading is shorter than this interval. Cross-session hour bars need an explicit aggregation rule, so this timeframe is disabled.",
      );
    }

    return supported(
      id,
      "dhan-rest",
      "resampled-rest",
      `Resample Dhan 60-minute historical candles into ${size}-hour bars.`,
      {
        dhanInterval: "60min",
        resampleInterval: { unit: "hour", size },
      },
    );
  }

  if (unit === "day") {
    if (size === 1) {
      return supported(
        id,
        "dhan-rest",
        "native-rest",
        "Dhan daily historical candles are available directly.",
        { dhanInterval: "day" },
      );
    }

    return supported(
      id,
      "dhan-rest",
      "resampled-rest",
      `Resample Dhan daily candles into ${size}-day bars.`,
      {
        dhanInterval: "day",
        resampleInterval: { unit: "day", size },
      },
    );
  }

  if (unit === "week" || unit === "month") {
    return supported(
      id,
      "dhan-rest",
      "resampled-rest",
      `Resample Dhan daily candles into ${size}-${unit} bars.`,
      {
        dhanInterval: "day",
        resampleInterval: { unit, size },
      },
    );
  }

  // `tf-1year` etc. in the picker are lookback ranges, not a Dhan candle
  // interval. Fetch daily history over the requested range and leave annual
  // aggregation explicit to the caller.
  return supported(
    id,
    "dhan-rest",
    "daily-history-range",
    `Load Dhan daily history for the requested ${size}-year lookback range.`,
    { dhanInterval: "day" },
  );
}

export function getCandleSessionKey(
  timestamp: number,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const parts = getLocalDateParts(timestamp, timeZone);
  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

/**
 * Produces valid, time-sorted aggregate candles without mutating the source.
 * Intraday bars are reset at each market day and aligned to 09:15 IST unless a
 * caller supplies a different session start. Missing volume stays missing;
 * resampling never invents a volume total from partial data.
 */
export function resampleCandles(
  candles: readonly Candle[],
  interval: CandleInterval,
  options: ResampleOptions = {},
): Candle[] {
  if (!Number.isSafeInteger(interval.size) || interval.size <= 0) return [];

  // Daily candles from the stored history are already valid and sorted; the
  // normaliser's copy-and-sort of every candle was most of the cost of
  // resampling a whole universe.
  const normalized = isNormalized(candles)
    ? candles
    : normalizeCandles(candles);
  if (normalized.length === 0) return [];

  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const requestedSessionStart = options.sessionStartMinutes;
  const sessionStartMinutes =
    requestedSessionStart !== undefined &&
    Number.isSafeInteger(requestedSessionStart) &&
    requestedSessionStart >= 0 &&
    requestedSessionStart < 24 * 60
      ? requestedSessionStart
      : DEFAULT_SESSION_START_MINUTES;
  const buckets = new Map<string, Candle[]>();

  for (const candle of normalized) {
    const key = candleBucketKey(
      candle,
      interval,
      timeZone,
      sessionStartMinutes,
    );
    const bucket = buckets.get(key);
    if (bucket) bucket.push(candle);
    else buckets.set(key, [candle]);
  }

  return [...buckets.values()]
    .map(aggregateCandles)
    .sort((left, right) => left.timestamp - right.timestamp);
}

function isNormalized(candles: readonly Candle[]): boolean {
  let previous = -Infinity;
  for (const candle of candles) {
    if (!isValidCandle(candle) || candle.timestamp <= previous) return false;
    previous = candle.timestamp;
  }
  return true;
}

function aggregateCandles(candles: readonly Candle[]): Candle {
  const first = candles[0];
  const last = candles[candles.length - 1];
  let high = first.high;
  let low = first.low;
  let totalVolume = 0;
  let allHaveVolume = true;

  for (const candle of candles) {
    high = Math.max(high, candle.high);
    low = Math.min(low, candle.low);
    if (hasFiniteVolume(candle)) totalVolume += candle.volume;
    else allHaveVolume = false;
  }

  return {
    timestamp: first.timestamp,
    open: first.open,
    high,
    low,
    close: last.close,
    ...(allHaveVolume ? { volume: totalVolume } : {}),
  };
}

function candleBucketKey(
  candle: Candle,
  interval: CandleInterval,
  timeZone: string,
  sessionStartMinutes: number,
): string {
  if (
    timeZone === DEFAULT_TIME_ZONE &&
    (interval.unit === "day" || interval.unit === "week")
  ) {
    // Only the IST calendar day matters for these buckets, and with a fixed
    // offset that is one division away from the timestamp.
    const dayOrdinal = Math.floor(
      (candle.timestamp + IST_OFFSET_MS) / 86_400_000,
    );
    if (interval.unit === "day") {
      return `day:${Math.floor(dayOrdinal / interval.size)}`;
    }
    const mondayOrdinal = dayOrdinal - ((dayOrdinal + 3) % 7);
    return `week:${Math.floor(mondayOrdinal / (interval.size * 7))}`;
  }

  const parts = getLocalDateParts(candle.timestamp, timeZone);
  const dayOrdinal = Math.floor(
    Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000,
  );

  if (interval.unit === "minute" || interval.unit === "hour") {
    const durationMinutes =
      interval.unit === "minute" ? interval.size : interval.size * 60;
    const minuteOfDay = parts.hour * 60 + parts.minute;
    const alignedMinute =
      minuteOfDay >= sessionStartMinutes
        ? minuteOfDay - sessionStartMinutes
        : minuteOfDay;
    const bucket = Math.floor(alignedMinute / durationMinutes);
    return `intraday:${getCandleSessionKey(candle.timestamp, timeZone)}:${bucket}`;
  }

  if (interval.unit === "day") {
    return `day:${Math.floor(dayOrdinal / interval.size)}`;
  }

  if (interval.unit === "week") {
    // 1970-01-05 was a Monday. This makes weekly buckets stable across calls.
    const mondayOrdinal = dayOrdinal - ((dayOrdinal + 3) % 7);
    return `week:${Math.floor(mondayOrdinal / (interval.size * 7))}`;
  }

  const monthOrdinal = parts.year * 12 + (parts.month - 1);
  return `month:${Math.floor(monthOrdinal / interval.size)}`;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1_000;

function getLocalDateParts(
  timestamp: number,
  timeZone: string,
): LocalDateParts {
  if (timeZone === DEFAULT_TIME_ZONE) {
    // India keeps a fixed +05:30 with no daylight saving, so the wall-clock
    // parts are plain arithmetic. Intl.DateTimeFormat#formatToParts costs a
    // few microseconds per call, which made resampling a stock universe's
    // daily candles into weekly bars take tens of seconds.
    const shifted = new Date(timestamp + IST_OFFSET_MS);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
    };
  }

  const formatter = getFormatter(timeZone);
  const values = new Map(
    formatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.get("year") ?? 1970,
    month: values.get("month") ?? 1,
    day: values.get("day") ?? 1,
    hour: values.get("hour") ?? 0,
    minute: values.get("minute") ?? 0,
  };
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
    return formatter;
  } catch {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
    return formatter;
  }
}

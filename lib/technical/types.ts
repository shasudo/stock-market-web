/**
 * A normalized OHLCV candle. Timestamps are Unix epoch milliseconds so the
 * values can be passed directly to Date/Intl without an implicit conversion.
 */
export interface Candle {
  readonly timestamp: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number | null;
}

export type NullableNumber = number | null;

/** A series may have gaps; indicator output keeps the input's index alignment. */
export type NumericSeries = readonly (number | null | undefined)[];

export type CapabilityStatus =
  "supported" | "needs-live-feed" | "needs-fundamentals" | "needs-manual-input";

export type CapabilitySource =
  | "local-candles"
  | "dhan-rest"
  | "dhan-live-feed"
  | "dhan-option-chain"
  | "fundamentals-provider"
  | "events-provider"
  | "external-market-data"
  | "manual-chart"
  | "manual-strategy"
  | "unknown";

export type SignalState =
  "detected" | "not-detected" | "insufficient-data" | "unsupported";

export type SignalDirection = "bullish" | "bearish" | "neutral";

export interface SignalResult {
  readonly id: string;
  readonly state: SignalState;
  readonly direction?: SignalDirection;
  readonly message: string;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidCandle(
  candle: Candle | null | undefined,
): candle is Candle {
  if (!candle || typeof candle !== "object") return false;

  const { timestamp, open, high, low, close, volume } = candle;
  if (
    !isFiniteNumber(timestamp) ||
    !isFiniteNumber(open) ||
    !isFiniteNumber(high) ||
    !isFiniteNumber(low) ||
    !isFiniteNumber(close) ||
    timestamp < 0 ||
    open <= 0 ||
    high <= 0 ||
    low <= 0 ||
    close <= 0 ||
    low > high ||
    high < Math.max(open, close) ||
    low > Math.min(open, close)
  ) {
    return false;
  }

  return (
    volume === undefined ||
    volume === null ||
    (isFiniteNumber(volume) && volume >= 0)
  );
}

export function hasFiniteVolume(candle: Candle): candle is Candle & {
  readonly volume: number;
} {
  return isFiniteNumber(candle.volume) && candle.volume >= 0;
}

/**
 * Drops malformed candles, sorts by time, and lets the final duplicate win.
 * The input is never mutated. A later duplicate normally represents a revised
 * candle from a market-data feed, so retaining it is the least surprising rule.
 */
export function normalizeCandles(candles: readonly Candle[]): Candle[] {
  const byTimestamp = new Map<number, Candle>();

  for (const candle of candles) {
    if (!isValidCandle(candle)) continue;
    byTimestamp.set(candle.timestamp, { ...candle });
  }

  return [...byTimestamp.values()].sort(
    (left, right) => left.timestamp - right.timestamp,
  );
}

export function toNullableNumber(value: unknown): NullableNumber {
  return isFiniteNumber(value) ? value : null;
}

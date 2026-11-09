import type { MarketHitFilter } from "./live-query";

/**
 * Sessions in a 52-week window. Exchange calendars average ~252 trading
 * sessions a year, which is also the window the history SQL screens with.
 */
export const HIT_52W_SESSIONS = 252;

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Whether today's session high touched the quoted 52-week high. The quote
 * feed's 52-week band already includes today, so a touch means today made
 * (or equalled) the year's high.
 */
export function isHit52HighLive(
  high: number | null | undefined,
  week52High: number | null | undefined,
): boolean {
  if (!isPositiveFinite(high) || !isPositiveFinite(week52High)) return false;
  return high >= week52High;
}

/** Mirror of {@link isHit52HighLive} for the 52-week low. */
export function isHit52LowLive(
  low: number | null | undefined,
  week52Low: number | null | undefined,
): boolean {
  if (!isPositiveFinite(low) || !isPositiveFinite(week52Low)) return false;
  return low <= week52Low;
}

/**
 * Whether today's session high touched the all-time high over the stock's
 * full stored candle history. The stored history already includes today's
 * session once the sync has written it, so a touch means today made (or
 * equalled) the record high. Missing data on either side never hits.
 */
export function isHitAthHighLive(
  high: number | null | undefined,
  ath: number | null | undefined,
): boolean {
  if (!isPositiveFinite(high) || !isPositiveFinite(ath)) return false;
  return high >= ath;
}

/** Mirror of {@link isHitAthHighLive} for the all-time low. */
export function isHitAthLowLive(
  low: number | null | undefined,
  atl: number | null | undefined,
): boolean {
  if (!isPositiveFinite(low) || !isPositiveFinite(atl)) return false;
  return low <= atl;
}

/**
 * Whether a row passes the `ath` screen, given flags evaluated for the
 * session the query runs against (today's live session).
 */
export function matchesAthFilter(
  ath: import("./live-query").MarketAthFilter,
  hitAthHigh: boolean,
  hitAthLow: boolean,
): boolean {
  if (ath === "high") return hitAthHigh;
  if (ath === "low") return hitAthLow;
  return true;
}

/**
 * Whether a row passes the `hit` screen, given flags evaluated for the
 * session the query runs against (today, or the custom-date reference day).
 */
export function matchesHitFilter(
  hit: MarketHitFilter,
  hitHigh: boolean,
  hitLow: boolean,
): boolean {
  if (hit === "high") return hitHigh;
  if (hit === "low") return hitLow;
  return true;
}

/**
 * The session a custom-date query evaluates 52-week hits on: the end of the
 * range when one is picked, otherwise the single start date.
 */
export function referenceDateForCustomHit(
  customDate: string | undefined,
  customEndDate: string | undefined,
): string | undefined {
  return customEndDate ?? customDate;
}

export interface TrailingHitEvaluation {
  readonly hitHigh: boolean;
  readonly hitLow: boolean;
}

/**
 * Flag comparison once the day values and trailing extremes are known (the
 * SQL layer computes the extremes; this keeps the comparison unit-tested).
 * Missing data on either side never hits.
 */
export function evaluateTrailingHitFromExtremes(
  dayHigh: number | null | undefined,
  dayLow: number | null | undefined,
  trailMaxHigh: number | null | undefined,
  trailMinLow: number | null | undefined,
): TrailingHitEvaluation {
  return {
    hitHigh:
      isPositiveFinite(dayHigh) &&
      isPositiveFinite(trailMaxHigh) &&
      dayHigh >= trailMaxHigh,
    hitLow:
      isPositiveFinite(dayLow) &&
      isPositiveFinite(trailMinLow) &&
      dayLow <= trailMinLow,
  };
}

/**
 * Hit evaluation over a trailing window ending on the reference session.
 * `highs`/`lows` run oldest-first and include the reference session last;
 * a hit means the reference session is the window's extreme. Empty or
 * non-positive windows never hit, so listings without backfilled history
 * simply do not match instead of raising.
 */
export function evaluateTrailingHit(
  dayHigh: number | null | undefined,
  dayLow: number | null | undefined,
  highs: readonly (number | null | undefined)[],
  lows: readonly (number | null | undefined)[],
): TrailingHitEvaluation {
  const validHighs = highs.filter(isPositiveFinite);
  const validLows = lows.filter(isPositiveFinite);
  return {
    hitHigh:
      isPositiveFinite(dayHigh) &&
      validHighs.length > 0 &&
      dayHigh >= Math.max(...validHighs),
    hitLow:
      isPositiveFinite(dayLow) &&
      validLows.length > 0 &&
      dayLow <= Math.min(...validLows),
  };
}

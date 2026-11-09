import { getCandleSessionKey } from "./timeframes";
import type { Candle, NullableNumber } from "./types";

/**
 * TradingView-style Session Volume Profile.
 *
 * Reference images:
 *  1. "Day Trading with Session Volume Profile" — each trading day draws its
 *     own horizontal volume-at-price histogram. The point of control (POC) is
 *     a red line, value-area high/low (VAH/VAL) are blue lines, histogram rows
 *     inside the value area are blue and rows outside are grey.
 *  2. TradingView "Session volume profile" chart type — one profile per
 *     session, POC as the longest row, value area shaded behind the rows.
 *  3. HexaTrades SVP Intraday — the same per-session profile plus session
 *     VWAP and previous-session POC/VAH/VAL/PDH/PDL/IBH/IBL extensions.
 *
 * This module computes the per-session profiles that the chart primitive
 * draws. Volume is conserved: each bar's volume is spread over the rows its
 * [low, high] range covers in proportion to how much of the range falls in
 * each row, and a bar is up volume when it closes at or above its open. The
 * value area then grows outward from the POC the way TradingView builds it:
 * compare the next two rows above with the next two below and take the
 * larger pair, until it holds `valueAreaPct` percent of the session volume.
 */

export interface SessionProfileOptions {
  readonly rows?: number;
  /** Percent of session volume inside VAH/VAL. TradingView default is 70. */
  readonly valueAreaPct?: number;
  readonly timeZone?: string;
  /** Length of the initial balance (IBH/IBL) from the session's first bar. */
  readonly initialBalanceMinutes?: number;
}

export interface SessionProfileBucket {
  /** Centre price of the row. */
  readonly price: number;
  /** Top edge of the row. */
  readonly top: number;
  /** Bottom edge of the row. */
  readonly bottom: number;
  readonly volume: number;
  readonly upVolume: number;
  readonly downVolume: number;
  readonly inValueArea: boolean;
}

export interface SessionProfile {
  readonly sessionKey: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly startTimestamp: number;
  readonly endTimestamp: number;
  readonly low: number;
  readonly high: number;
  readonly totalVolume: number;
  readonly poc: number | null;
  readonly vah: number | null;
  readonly val: number | null;
  readonly maxRowVolume: number;
  /** Largest |up − down| of any row, for the Delta histogram. */
  readonly maxRowDelta: number;
  /** High/low of the session's opening range (initial balance). */
  readonly ibHigh: number | null;
  readonly ibLow: number | null;
  readonly buckets: readonly SessionProfileBucket[];
}

export function normalizeProfileRows(rows: unknown, fallback = 24): number {
  const parsed = typeof rows === "string" ? Number(rows) : rows;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return fallback;
  return Math.min(200, Math.max(2, Math.round(parsed)));
}

export function normalizeValueAreaPct(
  value: unknown,
  fallback = 70,
): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return fallback;
  return Math.min(95, Math.max(50, parsed));
}

/**
 * Group candle indices into calendar-day sessions using the same session key
 * the VWAP indicator uses, so profiles and VWAP agree on boundaries.
 */
export function groupSessionIndices(
  candles: readonly Candle[],
  timeZone = "Asia/Kolkata",
): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  let currentKey: string | null = null;
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    if (!candle) continue;
    const key = getCandleSessionKey(candle.timestamp, timeZone);
    if (currentKey === null || key !== currentKey) {
      if (current.length > 0) groups.push(current);
      current = [];
      currentKey = key;
    }
    current.push(index);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * Compute one finished profile per session. Sessions without usable volume
 * still return their range with null POC/VAH/VAL so the caller can skip them.
 */
export function computeSessionProfiles(
  candles: readonly Candle[],
  options: SessionProfileOptions = {},
): SessionProfile[] {
  const rows = normalizeProfileRows(options.rows, 24);
  const valueAreaPct = normalizeValueAreaPct(options.valueAreaPct, 70);
  const timeZone = options.timeZone ?? "Asia/Kolkata";
  const target = valueAreaPct / 100;
  const ibWindowMs = Math.max(1, options.initialBalanceMinutes ?? 60) * 60_000;

  const profiles: SessionProfile[] = [];
  for (const indices of groupSessionIndices(candles, timeZone)) {
    const startIndex = indices[0]!;
    const endIndex = indices[indices.length - 1]!;
    let highest = -Infinity;
    let lowest = Infinity;
    let total = 0;
    let usable = true;
    let ibHigh = -Infinity;
    let ibLow = Infinity;
    const ibEnd = candles[startIndex]!.timestamp + ibWindowMs;
    for (const index of indices) {
      const bar = candles[index]!;
      if (bar.timestamp < ibEnd && Number.isFinite(bar.high) && Number.isFinite(bar.low)) {
        ibHigh = Math.max(ibHigh, bar.high);
        ibLow = Math.min(ibLow, bar.low);
      }
    }
    const ib = {
      ibHigh: Number.isFinite(ibHigh) ? ibHigh : null,
      ibLow: Number.isFinite(ibLow) ? ibLow : null,
    };
    for (const index of indices) {
      const bar = candles[index]!;
      if (
        !Number.isFinite(bar.high) ||
        !Number.isFinite(bar.low) ||
        !(bar.high > bar.low)
      ) {
        continue;
      }
      const volume = bar.volume ?? Number.NaN;
      if (!Number.isFinite(volume) || (volume as number) < 0) {
        usable = false;
        break;
      }
      total += volume as number;
      if (bar.high > highest) highest = bar.high;
      if (bar.low < lowest) lowest = bar.low;
    }
    const sessionKey = getCandleSessionKey(
      candles[startIndex]!.timestamp,
      timeZone,
    );
    if (!usable || total <= 0 || !(highest > lowest)) {
      profiles.push({
        sessionKey,
        startIndex,
        endIndex,
        startTimestamp: candles[startIndex]!.timestamp,
        endTimestamp: candles[endIndex]!.timestamp,
        low: Number.isFinite(lowest) ? lowest : 0,
        high: Number.isFinite(highest) ? highest : 0,
        totalVolume: 0,
        poc: null,
        vah: null,
        val: null,
        maxRowVolume: 0,
        maxRowDelta: 0,
        ...ib,
        buckets: [],
      });
      continue;
    }

    const width = (highest - lowest) / rows;
    const rowOf = (price: number): number =>
      Math.min(rows - 1, Math.max(0, Math.floor((price - lowest) / width)));
    const totals = new Array<number>(rows).fill(0);
    const upTotals = new Array<number>(rows).fill(0);
    const downTotals = new Array<number>(rows).fill(0);

    for (const index of indices) {
      const bar = candles[index]!;
      const volume = bar.volume as number;
      if (!(volume > 0) || !Number.isFinite(bar.high) || !Number.isFinite(bar.low)) continue;
      const up = bar.close >= bar.open;
      const add = (row: number, share: number): void => {
        totals[row]! += share;
        if (up) upTotals[row]! += share;
        else downTotals[row]! += share;
      };
      const range = bar.high - bar.low;
      if (!(range > 0)) {
        add(rowOf(bar.low), volume);
        continue;
      }
      const first = rowOf(bar.low);
      const last = rowOf(bar.high);
      if (first === last) {
        add(first, volume);
        continue;
      }
      for (let row = first; row <= last; row += 1) {
        const rowBottom = row === 0 ? -Infinity : lowest + row * width;
        const rowTop = row === rows - 1 ? Infinity : lowest + (row + 1) * width;
        const overlap = Math.min(bar.high, rowTop) - Math.max(bar.low, rowBottom);
        if (overlap > 0) add(row, (volume * overlap) / range);
      }
    }

    let pocRow = 0;
    for (let row = 0; row < rows; row += 1) {
      if (totals[row]! > totals[pocRow]!) pocRow = row;
    }

    // TradingView's value area: from the POC, compare the next two rows
    // above with the next two below and add the larger pair.
    const targetVolume = total * target;
    let covered = totals[pocRow]!;
    let top = pocRow;
    let bottom = pocRow;
    while (covered < targetVolume && (top + 1 < rows || bottom - 1 >= 0)) {
      const aboveRows = Math.min(2, rows - 1 - top);
      const belowRows = Math.min(2, bottom);
      let above = 0;
      for (let step = 1; step <= aboveRows; step += 1) above += totals[top + step]!;
      let below = 0;
      for (let step = 1; step <= belowRows; step += 1) below += totals[bottom - step]!;
      if (aboveRows > 0 && (above >= below || belowRows === 0)) {
        covered += above;
        top += aboveRows;
      } else if (belowRows > 0) {
        covered += below;
        bottom -= belowRows;
      } else {
        break;
      }
    }

    const poc = lowest + (pocRow + 0.5) * width;
    const vah = lowest + (top + 1) * width;
    const val = lowest + bottom * width;
    let maxRowVolume = 0;
    let maxRowDelta = 0;
    for (let row = 0; row < rows; row += 1) {
      maxRowVolume = Math.max(maxRowVolume, totals[row]!);
      maxRowDelta = Math.max(maxRowDelta, Math.abs(upTotals[row]! - downTotals[row]!));
    }

    const buckets: SessionProfileBucket[] = [];
    for (let row = 0; row < rows; row += 1) {
      buckets.push({
        price: lowest + (row + 0.5) * width,
        top: lowest + (row + 1) * width,
        bottom: lowest + row * width,
        volume: totals[row]!,
        upVolume: upTotals[row]!,
        downVolume: downTotals[row]!,
        inValueArea: row >= bottom && row <= top,
      });
    }

    profiles.push({
      sessionKey,
      startIndex,
      endIndex,
      startTimestamp: candles[startIndex]!.timestamp,
      endTimestamp: candles[endIndex]!.timestamp,
      low: lowest,
      high: highest,
      totalVolume: total,
      poc,
      vah,
      val,
      maxRowVolume,
      maxRowDelta,
      ...ib,
      buckets,
    });
  }
  return profiles;
}

/**
 * Flat per-session POC/VAH/VAL series for the existing line-plot renderer.
 * Every bar inside a session holds that session's finished POC/VAH/VAL, with
 * a one-bar null gap at each session start so lightweight-charts breaks the
 * line instead of drawing a diagonal between sessions — exactly how
 * TradingView draws one flat segment per session.
 */
export function sessionLevelSeries(
  candles: readonly Candle[],
  options: SessionProfileOptions = {},
): {
  poc: NullableNumber[];
  vah: NullableNumber[];
  val: NullableNumber[];
  profiles: SessionProfile[];
} {
  const profiles = computeSessionProfiles(candles, options);
  const poc: NullableNumber[] = Array.from(
    { length: candles.length },
    () => null,
  );
  const vah: NullableNumber[] = Array.from(
    { length: candles.length },
    () => null,
  );
  const val: NullableNumber[] = Array.from(
    { length: candles.length },
    () => null,
  );
  for (const profile of profiles) {
    if (profile.poc === null || profile.vah === null || profile.val === null) {
      continue;
    }
    for (let index = profile.startIndex; index <= profile.endIndex; index += 1) {
      // Leave the first bar of every later session null so the line breaks
      // between sessions instead of bridging them.
      if (index !== profile.startIndex || profile.startIndex === 0) {
        poc[index] = profile.poc;
        vah[index] = profile.vah;
        val[index] = profile.val;
      }
    }
  }
  return { poc, vah, val, profiles };
}

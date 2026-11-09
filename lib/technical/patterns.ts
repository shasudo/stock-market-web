import { type Candle, normalizeCandles, type SignalResult } from "./types";

const CANDLESTICK_ALIASES: Record<string, string> = {
  "engulfing-bullish": "bullish-engulfing",
  "engulfing-bearish": "bearish-engulfing",
};

/** Patterns intentionally implemented by this deterministic core. */
export const BASIC_CANDLESTICK_PATTERN_IDS = [
  "doji",
  "dragonfly-doji",
  "gravestone-doji",
  "hammer",
  "inverted-hammer",
  "shooting-star",
  "hanging-man",
  "bullish-engulfing",
  "bearish-engulfing",
  "engulfing-bullish",
  "engulfing-bearish",
  "bullish-harami",
  "bearish-harami",
  "marubozu",
  "bullish-marubozu",
  "bearish-marubozu",
  "spinning-top",
  "three-white-soldiers",
  "three-black-crows",
  "tweezer-top",
  "tweezer-bottom",
  "abandoned-baby-bearish",
  "abandoned-baby-bullish",
  "advance-block",
  "bearish-belt-hold",
  "bullish-belt-hold",
  "bearish-breakaway",
  "bullish-breakaway",
  "bearish-counterattack",
  "bullish-counterattack",
  "bearish-kicking",
  "bullish-kicking",
  "bearish-harami-cross",
  "bullish-harami-cross",
  "concealing-baby-swallow",
  "downside-gap-three-methods",
  "upside-gap-three-methods",
  "falling-three-methods",
  "rising-three-methods",
  "mat-hold",
  "three-inside-down",
  "three-inside-up",
  "three-outside-down",
  "three-outside-up",
  "three-line-strike-bearish",
  "three-line-strike-bullish",
  "in-neck",
  "on-neck",
  "thrusting",
  "bearish-long-line",
  "bullish-long-line",
  "bearish-short-line",
  "bullish-short-line",
  "bearish-meeting-lines",
  "bullish-meeting-lines",
  "bearish-separating-lines",
  "bullish-separating-lines",
  "closing-marubozu-bearish",
  "closing-marubozu-bullish",
  "dark-cloud-cover",
  "piercing-line",
  "evening-star",
  "morning-star",
  "doji-star-bearish",
  "doji-star-bullish",
  "evening-doji-star",
  "morning-doji-star",
  "four-price-doji",
  "long-legged-doji",
  "rickshaw-man",
  "high-wave",
  "tri-star-bearish",
  "tri-star-bullish",
  "tasuki-gap-bearish",
  "tasuki-gap-bullish",
  "downside-tasuki-gap",
  "upside-tasuki-gap",
  "homing-pigeon",
  "matching-low",
  "stick-sandwich",
  "takuri",
  "ladder-bottom",
  "stalled-pattern",
  "hikkake-bearish",
  "hikkake-bullish",
  "identical-three-crows",
  "three-stars-in-the-south",
  "unique-three-river-bottom",
  "upside-gap-two-crows",
] as const;

export const BASIC_CHART_SIGNAL_IDS = [
  "breakout",
  "breakdown",
  "gap-up",
  "gap-down",
  "support-breakout",
  "resistance-breakout",
  "channel-breakout",
  "range-breakout",
  "higher-high-higher-low",
  "lower-high-lower-low",
  "double-top",
  "double-bottom",
  "head-shoulders",
  "inverse-head-shoulders",
  "triangle",
  "flag",
  "ascending-triangle",
  "descending-triangle",
  "symmetrical-triangle",
  "bull-flag",
  "bear-flag",
  "bull-pennant",
  "bear-pennant",
  "rising-wedge",
  "falling-wedge",
  "rectangle",
  "bullish-rectangle",
  "bearish-rectangle",
  "triple-top",
  "triple-bottom",
  "rounding-top",
  "rounding-bottom",
  "cup-handle",
  "inverse-cup-handle",
  "diamond-top",
  "diamond-bottom",
  "broadening-formation",
  "megaphone",
  "v-top",
  "v-bottom",
  "island-reversal-bullish",
  "island-reversal-bearish",
  "runaway-gap",
  "exhaustion-gap",
  "trend-reversal",
  "trend-continuation",
] as const;

const supportedCandlesticks = new Set<string>(BASIC_CANDLESTICK_PATTERN_IDS);
const supportedChartSignals = new Set<string>(BASIC_CHART_SIGNAL_IDS);

export interface ChartSignalOptions {
  /** Number of completed candles used for a breakout or breakdown level. */
  readonly lookback?: number;
}

export function isBasicCandlestickPattern(id: string): boolean {
  return supportedCandlesticks.has(id);
}

export function isBasicChartSignal(id: string): boolean {
  return supportedChartSignals.has(id);
}

/**
 * Evaluates the final completed candle(s). A result of `not-detected` is never
 * returned for malformed or too-short data; those cases stay explicit.
 */
export function evaluateCandlestickPattern(
  id: string,
  sourceCandles: readonly Candle[],
): SignalResult {
  const canonicalId = CANDLESTICK_ALIASES[id] ?? id;
  if (!supportedCandlesticks.has(id)) {
    return unsupported(
      id,
      "This candlestick pattern is not implemented by the deterministic core.",
    );
  }

  const candles = normalizeCandles(sourceCandles);
  const needed = requiredCandlesForPattern(canonicalId);
  if (candles.length < needed) {
    return insufficient(
      id,
      `This pattern needs ${needed} valid completed candle${needed === 1 ? "" : "s"}.`,
    );
  }

  const detected = detectCandlestick(canonicalId, candles);
  return {
    id,
    state: detected ? "detected" : "not-detected",
    direction: candlestickDirection(canonicalId),
    message: detected
      ? `${displayPattern(canonicalId)} is present in the latest completed candle sequence.`
      : `${displayPattern(canonicalId)} is not present in the latest completed candle sequence.`,
  };
}

/** Whether a candlestick id is only another name for a canonical pattern. */
export function isCandlestickAlias(id: string): boolean {
  return id in CANDLESTICK_ALIASES;
}

/**
 * The candlestick ids among `ids` detected on the latest candles: exactly
 * the ids `evaluateCandlestickPattern` reports as "detected", but the
 * candles are normalised once for the whole list instead of once per id, so
 * a universe-wide scan of every pattern stays cheap.
 */
export function detectCandlestickPatterns(
  ids: readonly string[],
  sourceCandles: readonly Candle[],
): string[] {
  const candles = normalizeCandles(sourceCandles);
  return ids.filter((id) => {
    if (!supportedCandlesticks.has(id)) return false;
    const canonicalId = CANDLESTICK_ALIASES[id] ?? id;
    return (
      candles.length >= requiredCandlesForPattern(canonicalId) &&
      detectCandlestick(canonicalId, candles)
    );
  });
}

/**
 * The chart-signal ids among `ids` detected on the latest candles: exactly
 * the ids `evaluateChartSignal` (default lookback) reports as "detected",
 * with the candles normalised once for the whole list.
 */
export function detectChartSignals(
  ids: readonly string[],
  sourceCandles: readonly Candle[],
): string[] {
  const lookback = 20;
  const candles = normalizeCandles(sourceCandles);
  return ids.filter((id) => {
    if (!supportedChartSignals.has(id)) return false;
    const needed =
      id === "gap-up" || id === "gap-down" || isStructureSignal(id)
        ? 2
        : requiredChartCandles(id, lookback);
    return candles.length >= needed && detectChartSignal(id, candles, lookback);
  });
}

export function evaluateChartSignal(
  id: string,
  sourceCandles: readonly Candle[],
  options: ChartSignalOptions = {},
): SignalResult {
  if (!supportedChartSignals.has(id)) {
    return unsupported(
      id,
      "This chart pattern needs a separately configured detector or manually selected pivots.",
    );
  }

  const lookback = options.lookback ?? 20;
  if (!Number.isSafeInteger(lookback) || lookback < 2) {
    return insufficient(
      id,
      "Chart-signal lookback must be an integer of at least 2.",
    );
  }

  const candles = normalizeCandles(sourceCandles);
  const needed =
    id === "gap-up" || id === "gap-down" || isStructureSignal(id)
      ? 2
      : requiredChartCandles(id, lookback);
  if (candles.length < needed) {
    return insufficient(
      id,
      `This signal needs ${needed} valid completed candle${needed === 1 ? "" : "s"}.`,
    );
  }

  const detected = detectChartSignal(id, candles, lookback);
  return {
    id,
    state: detected ? "detected" : "not-detected",
    direction: chartDirection(id),
    message: detected
      ? `${displayPattern(id)} is present in the latest completed candle sequence.`
      : `${displayPattern(id)} is not present in the latest completed candle sequence.`,
  };
}

function detectCandlestick(id: string, candles: readonly Candle[]): boolean {
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];

  switch (id) {
    case "doji":
      return isDoji(current);
    case "dragonfly-doji":
      return (
        isDoji(current) &&
        lowerShadow(current) >= candleRange(current) * 0.6 &&
        upperShadow(current) <= candleRange(current) * 0.1
      );
    case "gravestone-doji":
      return (
        isDoji(current) &&
        upperShadow(current) >= candleRange(current) * 0.6 &&
        lowerShadow(current) <= candleRange(current) * 0.1
      );
    case "hammer":
      return isHammerShape(current) && hasDowntrend(candles);
    case "inverted-hammer":
      return isInvertedHammerShape(current) && hasDowntrend(candles);
    case "shooting-star":
      return isInvertedHammerShape(current) && hasUptrend(candles);
    case "hanging-man":
      return isHammerShape(current) && hasUptrend(candles);
    case "bullish-engulfing":
      return Boolean(previous) && isBullishEngulfing(previous, current);
    case "bearish-engulfing":
      return Boolean(previous) && isBearishEngulfing(previous, current);
    case "bullish-harami":
      return Boolean(previous) && isBullishHarami(previous, current);
    case "bearish-harami":
      return Boolean(previous) && isBearishHarami(previous, current);
    case "marubozu":
      return isMarubozu(current);
    case "bullish-marubozu":
      return isMarubozu(current) && current.close > current.open;
    case "bearish-marubozu":
      return isMarubozu(current) && current.close < current.open;
    case "spinning-top":
      return isSpinningTop(current);
    case "three-white-soldiers":
      return isThreeWhiteSoldiers(candles.slice(-3));
    case "three-black-crows":
      return isThreeBlackCrows(candles.slice(-3));
    case "tweezer-top":
      return Boolean(previous) && isTweezerTop(previous, current);
    case "tweezer-bottom":
      return Boolean(previous) && isTweezerBottom(previous, current);
    case "abandoned-baby-bearish":
      return isAbandonedBabyBearish(candles);
    case "abandoned-baby-bullish":
      return isAbandonedBabyBullish(candles);
    case "advance-block":
      return isAdvanceBlock(candles);
    case "bearish-belt-hold":
      return isBearishBeltHold(candles, current);
    case "bullish-belt-hold":
      return isBullishBeltHold(candles, current);
    case "bearish-breakaway":
      return isBearishBreakaway(candles);
    case "bullish-breakaway":
      return isBullishBreakaway(candles);
    case "bearish-counterattack":
      return (
        Boolean(previous) && isBearishCounterattack(candles, previous, current)
      );
    case "bullish-counterattack":
      return (
        Boolean(previous) && isBullishCounterattack(candles, previous, current)
      );
    case "bearish-kicking":
      return Boolean(previous) && isBearishKicking(candles, previous, current);
    case "bullish-kicking":
      return Boolean(previous) && isBullishKicking(candles, previous, current);
    case "bearish-harami-cross":
      return (
        Boolean(previous) && isBearishHaramiCross(candles, previous, current)
      );
    case "bullish-harami-cross":
      return (
        Boolean(previous) && isBullishHaramiCross(candles, previous, current)
      );
    case "concealing-baby-swallow":
      return isConcealingBabySwallow(candles);
    case "downside-gap-three-methods":
      return isDownsideGapThreeMethods(candles);
    case "upside-gap-three-methods":
      return isUpsideGapThreeMethods(candles);
    case "falling-three-methods":
      return isFallingThreeMethods(candles);
    case "rising-three-methods":
      return isRisingThreeMethods(candles);
    case "mat-hold":
      return isMatHold(candles);
    case "three-inside-down":
      return isThreeInsideDown(candles);
    case "three-inside-up":
      return isThreeInsideUp(candles);
    case "three-outside-down":
      return isThreeOutsideDown(candles);
    case "three-outside-up":
      return isThreeOutsideUp(candles);
    case "three-line-strike-bearish":
      return isThreeLineStrikeBearish(candles);
    case "three-line-strike-bullish":
      return isThreeLineStrikeBullish(candles);
    case "in-neck":
      return Boolean(previous) && isInNeck(candles, previous, current);
    case "on-neck":
      return Boolean(previous) && isOnNeck(candles, previous, current);
    case "thrusting":
      return Boolean(previous) && isThrusting(candles, previous, current);
    case "bearish-long-line":
      return isLongBlack(current);
    case "bullish-long-line":
      return isLongWhite(current);
    case "bearish-short-line":
      return current.close < current.open && isSmallBody(current);
    case "bullish-short-line":
      return current.close > current.open && isSmallBody(current);
    case "bearish-meeting-lines":
      return (
        Boolean(previous) && isBearishMeetingLines(candles, previous, current)
      );
    case "bullish-meeting-lines":
      return (
        Boolean(previous) && isBullishMeetingLines(candles, previous, current)
      );
    case "bearish-separating-lines":
      return (
        Boolean(previous) &&
        isBearishSeparatingLines(candles, previous, current)
      );
    case "bullish-separating-lines":
      return (
        Boolean(previous) &&
        isBullishSeparatingLines(candles, previous, current)
      );
    case "closing-marubozu-bearish":
      return isClosingMarubozuBearish(current);
    case "closing-marubozu-bullish":
      return isClosingMarubozuBullish(current);
    case "dark-cloud-cover":
      return Boolean(previous) && isDarkCloudCover(candles, previous, current);
    case "piercing-line":
      return Boolean(previous) && isPiercingLine(candles, previous, current);
    case "evening-star":
      return isEveningStar(candles);
    case "morning-star":
      return isMorningStar(candles);
    case "doji-star-bearish":
      return Boolean(previous) && isDojiStarBearish(candles, previous, current);
    case "doji-star-bullish":
      return Boolean(previous) && isDojiStarBullish(candles, previous, current);
    case "evening-doji-star":
      return isEveningDojiStar(candles);
    case "morning-doji-star":
      return isMorningDojiStar(candles);
    case "four-price-doji":
      return isFourPriceDoji(current);
    case "long-legged-doji":
      return isLongLeggedDoji(current);
    case "rickshaw-man":
      return isRickshawMan(current);
    case "high-wave":
      return isHighWave(current);
    case "tri-star-bearish":
      return isTriStarBearish(candles);
    case "tri-star-bullish":
      return isTriStarBullish(candles);
    case "tasuki-gap-bearish":
    case "downside-tasuki-gap":
      return isTasukiGapBearish(candles);
    case "tasuki-gap-bullish":
    case "upside-tasuki-gap":
      return isTasukiGapBullish(candles);
    case "homing-pigeon":
      return Boolean(previous) && isHomingPigeon(candles, previous, current);
    case "matching-low":
      return Boolean(previous) && isMatchingLow(candles, previous, current);
    case "stick-sandwich":
      return isStickSandwich(candles);
    case "takuri":
      return isTakuri(candles, current);
    case "ladder-bottom":
      return isLadderBottom(candles);
    case "stalled-pattern":
      return isStalledPattern(candles);
    case "hikkake-bearish":
      return isHikkakeBearish(candles);
    case "hikkake-bullish":
      return isHikkakeBullish(candles);
    case "identical-three-crows":
      return isIdenticalThreeCrows(candles);
    case "three-stars-in-the-south":
      return isThreeStarsInTheSouth(candles);
    case "unique-three-river-bottom":
      return isUniqueThreeRiverBottom(candles);
    case "upside-gap-two-crows":
      return isUpsideGapTwoCrows(candles);
    default:
      return false;
  }
}

function detectChartSignal(
  id: string,
  candles: readonly Candle[],
  lookback: number,
): boolean {
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];

  if (id === "gap-up") return current.low > previous.high;
  if (id === "gap-down") return current.high < previous.low;
  if (id === "higher-high-higher-low") {
    return current.high > previous.high && current.low > previous.low;
  }
  if (id === "lower-high-lower-low") {
    return current.high < previous.high && current.low < previous.low;
  }
  if (id === "double-top") return isDoubleTop(candles);
  if (id === "double-bottom") return isDoubleBottom(candles);
  if (id === "head-shoulders") return isHeadShoulders(candles);
  if (id === "inverse-head-shoulders") return isInverseHeadShoulders(candles);
  if (id === "triple-top") return isTripleTop(candles);
  if (id === "triple-bottom") return isTripleBottom(candles);
  if (id === "ascending-triangle") return isAscendingTriangle(candles);
  if (id === "descending-triangle") return isDescendingTriangle(candles);
  if (id === "symmetrical-triangle") return isSymmetricalTriangle(candles);
  if (id === "triangle") return isTriangle(candles);
  if (id === "bull-flag") return isBullFlag(candles);
  if (id === "bear-flag") return isBearFlag(candles);
  if (id === "flag") return isFlag(candles);
  if (id === "bull-pennant") return isBullPennant(candles);
  if (id === "bear-pennant") return isBearPennant(candles);
  if (id === "rising-wedge") return isRisingWedge(candles);
  if (id === "falling-wedge") return isFallingWedge(candles);
  if (id === "rectangle") return isRectangle(candles);
  if (id === "bullish-rectangle") return isBullishRectangle(candles);
  if (id === "bearish-rectangle") return isBearishRectangle(candles);
  if (id === "rounding-top") return isRoundingTop(candles);
  if (id === "rounding-bottom") return isRoundingBottom(candles);
  if (id === "cup-handle") return isCupHandle(candles);
  if (id === "inverse-cup-handle") return isInverseCupHandle(candles);
  if (id === "diamond-top") return isDiamondTop(candles);
  if (id === "diamond-bottom") return isDiamondBottom(candles);
  if (id === "broadening-formation") return isBroadeningFormation(candles);
  if (id === "megaphone") return isMegaphone(candles);
  if (id === "v-top") return isVTop(candles);
  if (id === "v-bottom") return isVBottom(candles);
  if (id === "island-reversal-bullish") return isIslandReversalBullish(candles);
  if (id === "island-reversal-bearish") return isIslandReversalBearish(candles);
  if (id === "runaway-gap") return isRunawayGap(candles);
  if (id === "exhaustion-gap") return isExhaustionGap(candles);
  if (id === "trend-reversal") return isTrendReversal(candles);
  if (id === "trend-continuation") return isTrendContinuation(candles);

  const priorCandles = candles.slice(-lookback - 1, -1);
  const priorHigh = Math.max(...priorCandles.map((candle) => candle.high));
  const priorLow = Math.min(...priorCandles.map((candle) => candle.low));
  const isBreakout = current.close > priorHigh;
  const isBreakdown = current.close < priorLow;

  if (id === "breakdown") return isBreakdown;
  if (
    id === "breakout" ||
    id === "support-breakout" ||
    id === "resistance-breakout" ||
    id === "channel-breakout" ||
    id === "range-breakout"
  ) {
    return isBreakout;
  }
  return false;
}

function requiredChartCandles(id: string, lookback: number): number {
  switch (id) {
    case "v-top":
    case "v-bottom":
    case "runaway-gap":
    case "exhaustion-gap":
      return 4;
    case "island-reversal-bullish":
    case "island-reversal-bearish":
    case "trend-reversal":
    case "trend-continuation":
      return 5;
    case "double-top":
    case "double-bottom":
      return 7;
    case "triangle":
    case "ascending-triangle":
    case "descending-triangle":
    case "symmetrical-triangle":
    case "flag":
    case "bull-flag":
    case "bear-flag":
    case "bull-pennant":
    case "bear-pennant":
    case "rectangle":
    case "bullish-rectangle":
    case "bearish-rectangle":
    case "broadening-formation":
    case "megaphone":
      return 8;
    case "head-shoulders":
    case "inverse-head-shoulders":
    case "triple-top":
    case "triple-bottom":
    case "rising-wedge":
    case "falling-wedge":
    case "rounding-top":
    case "rounding-bottom":
    case "diamond-top":
    case "diamond-bottom":
      return 10;
    case "cup-handle":
    case "inverse-cup-handle":
      return 12;
    default:
      return lookback + 1;
  }
}

function averageRange(candles: readonly Candle[]): number {
  if (candles.length === 0) return 0;
  return (
    candles.reduce((sum, candle) => sum + candleRange(candle), 0) /
    candles.length
  );
}

function slope(values: readonly number[]): number {
  const count = values.length;
  if (count < 2) return 0;
  const meanX = (count - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / count;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < count; index++) {
    numerator += (index - meanX) * (values[index] - meanY);
    denominator += (index - meanX) * (index - meanX);
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

function isSwingHighAt(highs: readonly number[], index: number): boolean {
  return (
    index > 0 &&
    index < highs.length - 1 &&
    highs[index] > highs[index - 1] &&
    highs[index] > highs[index + 1]
  );
}

function isSwingLowAt(lows: readonly number[], index: number): boolean {
  return (
    index > 0 &&
    index < lows.length - 1 &&
    lows[index] < lows[index - 1] &&
    lows[index] < lows[index + 1]
  );
}

function topPeaks(candles: readonly Candle[], tolerance: number): number[] {
  const highs = candles.map((candle) => candle.high);
  const highest = Math.max(...highs);
  const peaks: number[] = [];
  for (let index = 1; index < candles.length - 1; index++) {
    if (isSwingHighAt(highs, index) && highest - highs[index] <= tolerance) {
      peaks.push(index);
    }
  }
  return peaks;
}

function bottomTroughs(
  candles: readonly Candle[],
  tolerance: number,
): number[] {
  const lows = candles.map((candle) => candle.low);
  const lowest = Math.min(...lows);
  const troughs: number[] = [];
  for (let index = 1; index < candles.length - 1; index++) {
    if (isSwingLowAt(lows, index) && lows[index] - lowest <= tolerance) {
      troughs.push(index);
    }
  }
  return troughs;
}

function lowestLowBetween(
  candles: readonly Candle[],
  first: number,
  second: number,
): number {
  let trough = Number.POSITIVE_INFINITY;
  for (let index = first + 1; index < second; index++) {
    trough = Math.min(trough, candles[index].low);
  }
  return trough;
}

function highestHighBetween(
  candles: readonly Candle[],
  first: number,
  second: number,
): number {
  let peak = Number.NEGATIVE_INFINITY;
  for (let index = first + 1; index < second; index++) {
    peak = Math.max(peak, candles[index].high);
  }
  return peak;
}

function isDoubleTop(candles: readonly Candle[]): boolean {
  if (candles.length < 7 || !hasUptrend(candles)) return false;
  const window = candles.slice(-7);
  const tolerance = Math.max(averageRange(window) * 0.5, 1e-9);
  const peaks = topPeaks(window, tolerance);
  if (peaks.length < 2) return false;
  const first = peaks[peaks.length - 2];
  const second = peaks[peaks.length - 1];
  if (second - first < 2) return false;
  const trough = lowestLowBetween(window, first, second);
  const neckline = Math.min(window[first].high, window[second].high);
  if (!(trough < neckline)) return false;
  return window[window.length - 1].close < trough;
}

function isDoubleBottom(candles: readonly Candle[]): boolean {
  if (candles.length < 7 || !hasDowntrend(candles)) return false;
  const window = candles.slice(-7);
  const tolerance = Math.max(averageRange(window) * 0.5, 1e-9);
  const troughs = bottomTroughs(window, tolerance);
  if (troughs.length < 2) return false;
  const first = troughs[troughs.length - 2];
  const second = troughs[troughs.length - 1];
  if (second - first < 2) return false;
  const peak = highestHighBetween(window, first, second);
  const resistance = Math.max(window[first].low, window[second].low);
  if (!(peak > resistance)) return false;
  return window[window.length - 1].close > peak;
}

function isHeadShoulders(candles: readonly Candle[]): boolean {
  if (candles.length < 10 || !hasUptrend(candles)) return false;
  const window = candles.slice(-10);
  const highs = window.map((candle) => candle.high);
  const tolerance = Math.max(averageRange(window) * 0.75, 1e-9);
  const current = window[window.length - 1];
  for (let i = 1; i < window.length - 3; i++) {
    if (!isSwingHighAt(highs, i)) continue;
    for (let j = i + 2; j < window.length - 1; j++) {
      if (!isSwingHighAt(highs, j)) continue;
      if (!(highs[j] > highs[i])) continue;
      for (let k = j + 2; k < window.length - 1; k++) {
        if (!isSwingHighAt(highs, k)) continue;
        if (!(highs[j] > highs[k])) continue;
        if (!(Math.abs(highs[i] - highs[k]) <= tolerance)) continue;
        if (!(highs[j] - Math.max(highs[i], highs[k]) > tolerance * 0.5)) {
          continue;
        }
        const neckline = lowestLowBetween(window, i, k);
        if (current.close < neckline) return true;
      }
    }
  }
  return false;
}

function isInverseHeadShoulders(candles: readonly Candle[]): boolean {
  if (candles.length < 10 || !hasDowntrend(candles)) return false;
  const window = candles.slice(-10);
  const lows = window.map((candle) => candle.low);
  const tolerance = Math.max(averageRange(window) * 0.75, 1e-9);
  const current = window[window.length - 1];
  for (let i = 1; i < window.length - 3; i++) {
    if (!isSwingLowAt(lows, i)) continue;
    for (let j = i + 2; j < window.length - 1; j++) {
      if (!isSwingLowAt(lows, j)) continue;
      if (!(lows[j] < lows[i])) continue;
      for (let k = j + 2; k < window.length - 1; k++) {
        if (!isSwingLowAt(lows, k)) continue;
        if (!(lows[j] < lows[k])) continue;
        if (!(Math.abs(lows[i] - lows[k]) <= tolerance)) continue;
        if (!(Math.min(lows[i], lows[k]) - lows[j] > tolerance * 0.5)) {
          continue;
        }
        const neckline = highestHighBetween(window, i, k);
        if (current.close > neckline) return true;
      }
    }
  }
  return false;
}

function isTripleTop(candles: readonly Candle[]): boolean {
  if (candles.length < 10 || !hasUptrend(candles)) return false;
  const window = candles.slice(-10);
  const tolerance = Math.max(averageRange(window) * 0.5, 1e-9);
  const peaks = topPeaks(window, tolerance);
  if (peaks.length < 3) return false;
  const [first, second, third] = peaks.slice(-3);
  if (second - first < 2 || third - second < 2) return false;
  const trough = lowestLowBetween(window, first, third);
  const support = Math.min(
    window[first].high,
    window[second].high,
    window[third].high,
  );
  if (!(trough < support)) return false;
  return window[window.length - 1].close < trough;
}

function isTripleBottom(candles: readonly Candle[]): boolean {
  if (candles.length < 10 || !hasDowntrend(candles)) return false;
  const window = candles.slice(-10);
  const tolerance = Math.max(averageRange(window) * 0.5, 1e-9);
  const troughs = bottomTroughs(window, tolerance);
  if (troughs.length < 3) return false;
  const [first, second, third] = troughs.slice(-3);
  if (second - first < 2 || third - second < 2) return false;
  const peak = highestHighBetween(window, first, third);
  const resistance = Math.max(
    window[first].low,
    window[second].low,
    window[third].low,
  );
  if (!(peak > resistance)) return false;
  return window[window.length - 1].close > peak;
}

function isAscendingTriangle(candles: readonly Candle[]): boolean {
  if (candles.length < 8 || !hasUptrend(candles)) return false;
  const window = candles.slice(-8);
  const body = window.slice(0, 7);
  const current = window[window.length - 1];
  const bodyHighs = body.map((candle) => candle.high);
  const bodyLows = body.map((candle) => candle.low);
  const resistance = Math.max(...bodyHighs);
  const flatTop =
    resistance - Math.min(...bodyHighs) <= averageRange(body) * 0.75;
  const risingSupport =
    slope(bodyLows) > 0 && bodyLows[bodyLows.length - 1] > bodyLows[0];
  return flatTop && risingSupport && current.close > resistance;
}

function isDescendingTriangle(candles: readonly Candle[]): boolean {
  if (candles.length < 8 || !hasDowntrend(candles)) return false;
  const window = candles.slice(-8);
  const body = window.slice(0, 7);
  const current = window[window.length - 1];
  const bodyHighs = body.map((candle) => candle.high);
  const bodyLows = body.map((candle) => candle.low);
  const support = Math.min(...bodyLows);
  const flatBottom =
    Math.max(...bodyLows) - support <= averageRange(body) * 0.75;
  const fallingResistance =
    slope(bodyHighs) < 0 && bodyHighs[bodyHighs.length - 1] < bodyHighs[0];
  return flatBottom && fallingResistance && current.close < support;
}

function isSymmetricalTriangle(candles: readonly Candle[]): boolean {
  if (candles.length < 8) return false;
  const body = candles.slice(-8, -1);
  const bodyHighs = body.map((candle) => candle.high);
  const bodyLows = body.map((candle) => candle.low);
  const contracting =
    body[body.length - 1].high - body[body.length - 1].low <
    body[0].high - body[0].low;
  return slope(bodyHighs) < 0 && slope(bodyLows) > 0 && contracting;
}

function isTriangle(candles: readonly Candle[]): boolean {
  return (
    isAscendingTriangle(candles) ||
    isDescendingTriangle(candles) ||
    isSymmetricalTriangle(candles)
  );
}

function flagPoleRise(candles: readonly Candle[]): number {
  const window = candles.slice(-8);
  const pole = window.slice(0, 5);
  const rise = pole[pole.length - 1].close - pole[0].close;
  return rise > averageRange(window) * 2 ? rise : 0;
}

function flagPoleFall(candles: readonly Candle[]): number {
  const window = candles.slice(-8);
  const pole = window.slice(0, 5);
  const fall = pole[0].close - pole[pole.length - 1].close;
  return fall > averageRange(window) * 2 ? fall : 0;
}

function isBullFlag(candles: readonly Candle[]): boolean {
  if (candles.length < 8) return false;
  const rise = flagPoleRise(candles);
  if (!(rise > 0)) return false;
  const flag = candles.slice(-3);
  if (!(flag[flag.length - 1].close <= flag[0].close)) return false;
  const flagHigh = Math.max(...flag.map((candle) => candle.high));
  const flagLow = Math.min(...flag.map((candle) => candle.low));
  return flagHigh - flagLow <= rise * 0.5;
}

function isBearFlag(candles: readonly Candle[]): boolean {
  if (candles.length < 8) return false;
  const fall = flagPoleFall(candles);
  if (!(fall > 0)) return false;
  const flag = candles.slice(-3);
  if (!(flag[flag.length - 1].close >= flag[0].close)) return false;
  const flagHigh = Math.max(...flag.map((candle) => candle.high));
  const flagLow = Math.min(...flag.map((candle) => candle.low));
  return flagHigh - flagLow <= fall * 0.5;
}

function isFlag(candles: readonly Candle[]): boolean {
  return isBullFlag(candles) || isBearFlag(candles);
}

function isBullPennant(candles: readonly Candle[]): boolean {
  if (candles.length < 8) return false;
  const rise = flagPoleRise(candles);
  if (!(rise > 0)) return false;
  const pennant = candles.slice(-4);
  const pennantHighs = pennant.map((candle) => candle.high);
  const pennantLows = pennant.map((candle) => candle.low);
  const converging = slope(pennantHighs) < 0 && slope(pennantLows) > 0;
  const compact =
    Math.max(...pennantHighs) - Math.min(...pennantLows) <= rise * 0.5;
  return converging && compact;
}

function isBearPennant(candles: readonly Candle[]): boolean {
  if (candles.length < 8) return false;
  const fall = flagPoleFall(candles);
  if (!(fall > 0)) return false;
  const pennant = candles.slice(-4);
  const pennantHighs = pennant.map((candle) => candle.high);
  const pennantLows = pennant.map((candle) => candle.low);
  const converging = slope(pennantHighs) < 0 && slope(pennantLows) > 0;
  const compact =
    Math.max(...pennantHighs) - Math.min(...pennantLows) <= fall * 0.5;
  return converging && compact;
}

function isRisingWedge(candles: readonly Candle[]): boolean {
  if (candles.length < 10 || !hasUptrend(candles)) return false;
  const window = candles.slice(-10);
  const highs = window.map((candle) => candle.high);
  const lows = window.map((candle) => candle.low);
  const risingHighs = slope(highs);
  const risingLows = slope(lows);
  const converging =
    risingHighs > 0 && risingLows > 0 && risingHighs < risingLows;
  const narrowing =
    window[window.length - 1].high - window[window.length - 1].low <
    window[0].high - window[0].low;
  return converging && narrowing;
}

function isFallingWedge(candles: readonly Candle[]): boolean {
  if (candles.length < 10 || !hasDowntrend(candles)) return false;
  const window = candles.slice(-10);
  const highs = window.map((candle) => candle.high);
  const lows = window.map((candle) => candle.low);
  const fallingHighs = slope(highs);
  const fallingLows = slope(lows);
  const converging =
    fallingHighs < 0 && fallingLows < 0 && fallingHighs < fallingLows;
  const narrowing =
    window[window.length - 1].high - window[window.length - 1].low <
    window[0].high - window[0].low;
  return converging && narrowing;
}

function rectangleBounds(
  candles: readonly Candle[],
): { readonly highest: number; readonly lowest: number } | null {
  const window = candles.slice(-8);
  const highs = window.map((candle) => candle.high);
  const lows = window.map((candle) => candle.low);
  const highest = Math.max(...highs);
  const lowest = Math.min(...lows);
  const range = averageRange(window);
  if (!(highest - Math.min(...highs) <= range * 0.5)) return null;
  if (!(Math.max(...lows) - lowest <= range * 0.5)) return null;
  if (!(highest - lowest > range)) return null;
  return { highest, lowest };
}

function isRectangle(candles: readonly Candle[]): boolean {
  if (candles.length < 8) return false;
  return rectangleBounds(candles) !== null;
}

function isBullishRectangle(candles: readonly Candle[]): boolean {
  if (candles.length < 8 || !hasUptrend(candles)) return false;
  const bounds = rectangleBounds(candles);
  if (bounds === null) return false;
  const current = candles[candles.length - 1];
  return current.close > (bounds.highest + bounds.lowest) / 2;
}

function isBearishRectangle(candles: readonly Candle[]): boolean {
  if (candles.length < 8 || !hasDowntrend(candles)) return false;
  const bounds = rectangleBounds(candles);
  if (bounds === null) return false;
  const current = candles[candles.length - 1];
  return current.close < (bounds.highest + bounds.lowest) / 2;
}

function isRoundingTop(candles: readonly Candle[]): boolean {
  if (candles.length < 10) return false;
  const window = candles.slice(-10);
  const highs = window.map((candle) => candle.high);
  const peak = highs.indexOf(Math.max(...highs));
  if (peak < 2 || peak > 7) return false;
  if (!(slope(highs.slice(0, peak + 1)) > 0)) return false;
  if (!(slope(highs.slice(peak)) < 0)) return false;
  return window[window.length - 1].close < window[0].close;
}

function isRoundingBottom(candles: readonly Candle[]): boolean {
  if (candles.length < 10) return false;
  const window = candles.slice(-10);
  const lows = window.map((candle) => candle.low);
  const valley = lows.indexOf(Math.min(...lows));
  if (valley < 2 || valley > 7) return false;
  if (!(slope(lows.slice(0, valley + 1)) < 0)) return false;
  if (!(slope(lows.slice(valley)) > 0)) return false;
  return window[window.length - 1].close > window[0].close;
}

function isCupHandle(candles: readonly Candle[]): boolean {
  if (candles.length < 12) return false;
  const window = candles.slice(-12);
  const range = averageRange(window);
  const leftRim = Math.max(window[0].high, window[1].high, window[2].high);
  const rightRim = Math.max(window[7].high, window[8].high, window[9].high);
  const bottom = Math.min(...window.slice(2, 8).map((candle) => candle.low));
  if (!(leftRim - bottom > range)) return false;
  if (!(Math.abs(leftRim - rightRim) <= range * 0.75)) return false;
  const handle = window.slice(9);
  const handleLow = Math.min(...handle.map((candle) => candle.low));
  if (!(handleLow > bottom)) return false;
  const handleHigh = Math.max(...handle.map((candle) => candle.high));
  if (!(handleHigh <= rightRim + range * 0.5)) return false;
  return window[window.length - 1].close >= rightRim - range * 0.5;
}

function isInverseCupHandle(candles: readonly Candle[]): boolean {
  if (candles.length < 12) return false;
  const window = candles.slice(-12);
  const range = averageRange(window);
  const leftRim = Math.min(window[0].low, window[1].low, window[2].low);
  const rightRim = Math.min(window[7].low, window[8].low, window[9].low);
  const top = Math.max(...window.slice(2, 8).map((candle) => candle.high));
  if (!(top - leftRim > range)) return false;
  if (!(Math.abs(leftRim - rightRim) <= range * 0.75)) return false;
  const handle = window.slice(9);
  const handleHigh = Math.max(...handle.map((candle) => candle.high));
  if (!(handleHigh < top)) return false;
  const handleLow = Math.min(...handle.map((candle) => candle.low));
  if (!(handleLow >= rightRim - range * 0.5)) return false;
  return window[window.length - 1].close <= rightRim + range * 0.5;
}

function isDiamondTop(candles: readonly Candle[]): boolean {
  if (candles.length < 10 || !hasUptrend(candles)) return false;
  const window = candles.slice(-10);
  return (
    window[4].high > window[0].high &&
    window[4].low < window[0].low &&
    window[9].high < window[4].high &&
    window[9].low > window[4].low
  );
}

function isDiamondBottom(candles: readonly Candle[]): boolean {
  if (candles.length < 10 || !hasDowntrend(candles)) return false;
  const window = candles.slice(-10);
  return (
    window[4].high > window[0].high &&
    window[4].low < window[0].low &&
    window[9].high < window[4].high &&
    window[9].low > window[4].low
  );
}

function isExpandingRange(candles: readonly Candle[]): boolean {
  const window = candles.slice(-8);
  const highs = window.map((candle) => candle.high);
  const lows = window.map((candle) => candle.low);
  const highest = Math.max(...highs);
  const lowest = Math.min(...lows);
  return (
    window[window.length - 1].high > window[0].high &&
    window[window.length - 1].low < window[0].low &&
    highs.lastIndexOf(highest) >= 4 &&
    lows.lastIndexOf(lowest) >= 4
  );
}

function isBroadeningFormation(candles: readonly Candle[]): boolean {
  if (candles.length < 8) return false;
  return isExpandingRange(candles);
}

function isMegaphone(candles: readonly Candle[]): boolean {
  if (candles.length < 8 || !hasUptrend(candles)) return false;
  return isExpandingRange(candles);
}

function isVTop(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  return isLongBlack(current) && current.close < previous.open;
}

function isVBottom(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  return isLongWhite(current) && current.close > previous.open;
}

function isIslandReversalBullish(candles: readonly Candle[]): boolean {
  if (candles.length < 5 || !hasDowntrend(candles)) return false;
  const before = candles[candles.length - 3];
  const island = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    island.high < before.low &&
    current.low > island.high &&
    current.close > current.open
  );
}

function isIslandReversalBearish(candles: readonly Candle[]): boolean {
  if (candles.length < 5 || !hasUptrend(candles)) return false;
  const before = candles[candles.length - 3];
  const island = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    island.low > before.high &&
    current.high < island.low &&
    current.close < current.open
  );
}

function isRunawayGap(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const range = candleRange(current);
  return (
    current.low > previous.high &&
    current.close > current.open &&
    range > 0 &&
    body(current) >= range * 0.5
  );
}

function isExhaustionGap(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  return current.low > previous.high && current.close < current.open;
}

function isTrendReversal(candles: readonly Candle[]): boolean {
  if (candles.length < 5 || !hasUptrend(candles)) return false;
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  return current.close < previous.close && current.close < current.open;
}

function isTrendContinuation(candles: readonly Candle[]): boolean {
  if (candles.length < 5 || !hasUptrend(candles)) return false;
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  return current.close > previous.close && current.close > current.open;
}

function requiredCandlesForPattern(id: string): number {
  if (
    id === "bullish-engulfing" ||
    id === "bearish-engulfing" ||
    id === "bullish-harami" ||
    id === "bearish-harami" ||
    id === "tweezer-top" ||
    id === "tweezer-bottom"
  ) {
    return 2;
  }
  if (id === "three-white-soldiers" || id === "three-black-crows") return 3;
  if (
    id === "hammer" ||
    id === "inverted-hammer" ||
    id === "shooting-star" ||
    id === "hanging-man"
  ) {
    return 4;
  }
  if (id === "bearish-breakaway" || id === "bullish-breakaway") return 5;
  if (
    id === "falling-three-methods" ||
    id === "rising-three-methods" ||
    id === "mat-hold" ||
    id === "ladder-bottom" ||
    id === "hikkake-bearish" ||
    id === "hikkake-bullish"
  ) {
    return 5;
  }
  if (
    id === "downside-gap-three-methods" ||
    id === "upside-gap-three-methods" ||
    id === "three-inside-down" ||
    id === "three-inside-up" ||
    id === "three-outside-down" ||
    id === "three-outside-up" ||
    id === "three-line-strike-bearish" ||
    id === "three-line-strike-bullish" ||
    id === "in-neck" ||
    id === "on-neck" ||
    id === "thrusting" ||
    id === "bearish-meeting-lines" ||
    id === "bullish-meeting-lines" ||
    id === "bearish-separating-lines" ||
    id === "bullish-separating-lines" ||
    id === "dark-cloud-cover" ||
    id === "piercing-line" ||
    id === "evening-star" ||
    id === "morning-star" ||
    id === "doji-star-bearish" ||
    id === "doji-star-bullish" ||
    id === "evening-doji-star" ||
    id === "morning-doji-star" ||
    id === "tri-star-bearish" ||
    id === "tri-star-bullish" ||
    id === "tasuki-gap-bearish" ||
    id === "tasuki-gap-bullish" ||
    id === "downside-tasuki-gap" ||
    id === "upside-tasuki-gap" ||
    id === "homing-pigeon" ||
    id === "matching-low" ||
    id === "stick-sandwich" ||
    id === "takuri" ||
    id === "stalled-pattern" ||
    id === "identical-three-crows" ||
    id === "three-stars-in-the-south" ||
    id === "unique-three-river-bottom" ||
    id === "upside-gap-two-crows"
  ) {
    return 4;
  }
  if (
    id === "abandoned-baby-bearish" ||
    id === "abandoned-baby-bullish" ||
    id === "advance-block" ||
    id === "bearish-belt-hold" ||
    id === "bullish-belt-hold" ||
    id === "bearish-counterattack" ||
    id === "bullish-counterattack" ||
    id === "bearish-kicking" ||
    id === "bullish-kicking" ||
    id === "bearish-harami-cross" ||
    id === "bullish-harami-cross" ||
    id === "concealing-baby-swallow"
  ) {
    return 4;
  }
  return 1;
}

function candleRange(candle: Candle): number {
  return candle.high - candle.low;
}

function body(candle: Candle): number {
  return Math.abs(candle.close - candle.open);
}

function upperShadow(candle: Candle): number {
  return candle.high - Math.max(candle.open, candle.close);
}

function lowerShadow(candle: Candle): number {
  return Math.min(candle.open, candle.close) - candle.low;
}

function isDoji(candle: Candle): boolean {
  const range = candleRange(candle);
  return range > 0 && body(candle) <= range * 0.1;
}

function isHammerShape(candle: Candle): boolean {
  const range = candleRange(candle);
  if (range <= 0) return false;
  const minimumBody = Math.max(body(candle), range * 0.05);
  return (
    body(candle) <= range * 0.4 &&
    lowerShadow(candle) >= minimumBody * 2 &&
    upperShadow(candle) <= minimumBody
  );
}

function isInvertedHammerShape(candle: Candle): boolean {
  const range = candleRange(candle);
  if (range <= 0) return false;
  const minimumBody = Math.max(body(candle), range * 0.05);
  return (
    body(candle) <= range * 0.4 &&
    upperShadow(candle) >= minimumBody * 2 &&
    lowerShadow(candle) <= minimumBody
  );
}

function isMarubozu(candle: Candle): boolean {
  const range = candleRange(candle);
  return range > 0 && body(candle) / range >= 0.95;
}

function isSpinningTop(candle: Candle): boolean {
  const range = candleRange(candle);
  if (range <= 0 || body(candle) / range > 0.3) return false;
  const minimumShadow = Math.max(body(candle), range * 0.1);
  return (
    upperShadow(candle) >= minimumShadow && lowerShadow(candle) >= minimumShadow
  );
}

function isBullishEngulfing(previous: Candle, current: Candle): boolean {
  return (
    previous.close < previous.open &&
    current.close > current.open &&
    current.open <= previous.close &&
    current.close >= previous.open
  );
}

function isBearishEngulfing(previous: Candle, current: Candle): boolean {
  return (
    previous.close > previous.open &&
    current.close < current.open &&
    current.open >= previous.close &&
    current.close <= previous.open
  );
}

function isBullishHarami(previous: Candle, current: Candle): boolean {
  return (
    previous.close < previous.open &&
    current.close > current.open &&
    current.open >= previous.close &&
    current.close <= previous.open
  );
}

function isBearishHarami(previous: Candle, current: Candle): boolean {
  return (
    previous.close > previous.open &&
    current.close < current.open &&
    current.open <= previous.close &&
    current.close >= previous.open
  );
}

function isThreeWhiteSoldiers(candles: readonly Candle[]): boolean {
  if (candles.length !== 3) return false;
  const [first, second, third] = candles;
  return (
    first.close > first.open &&
    second.close > second.open &&
    third.close > third.open &&
    second.close > first.close &&
    third.close > second.close &&
    second.open >= Math.min(first.open, first.close) &&
    second.open <= Math.max(first.open, first.close) &&
    third.open >= Math.min(second.open, second.close) &&
    third.open <= Math.max(second.open, second.close)
  );
}

function isThreeBlackCrows(candles: readonly Candle[]): boolean {
  if (candles.length !== 3) return false;
  const [first, second, third] = candles;
  return (
    first.close < first.open &&
    second.close < second.open &&
    third.close < third.open &&
    second.close < first.close &&
    third.close < second.close &&
    second.open >= Math.min(first.open, first.close) &&
    second.open <= Math.max(first.open, first.close) &&
    third.open >= Math.min(second.open, second.close) &&
    third.open <= Math.max(second.open, second.close)
  );
}

function isTweezerTop(previous: Candle, current: Candle): boolean {
  const tolerance = (candleRange(previous) + candleRange(current)) * 0.1;
  return (
    previous.close > previous.open &&
    current.close < current.open &&
    Math.abs(previous.high - current.high) <= tolerance
  );
}

function isTweezerBottom(previous: Candle, current: Candle): boolean {
  const tolerance = (candleRange(previous) + candleRange(current)) * 0.1;
  return (
    previous.close < previous.open &&
    current.close > current.open &&
    Math.abs(previous.low - current.low) <= tolerance
  );
}

function isLongWhite(candle: Candle): boolean {
  const range = candleRange(candle);
  return range > 0 && candle.close > candle.open && body(candle) >= range * 0.6;
}

function isLongBlack(candle: Candle): boolean {
  const range = candleRange(candle);
  return range > 0 && candle.close < candle.open && body(candle) >= range * 0.6;
}

function isSmallBody(candle: Candle): boolean {
  const range = candleRange(candle);
  return range > 0 && body(candle) <= range * 0.4;
}

function openInsideBody(candle: Candle, prior: Candle): boolean {
  const low = Math.min(prior.open, prior.close);
  const high = Math.max(prior.open, prior.close);
  return candle.open >= low && candle.open <= high;
}

function isAbandonedBabyBearish(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isLongWhite(prev2) &&
    isDoji(prev) &&
    prev.low > prev2.high &&
    isLongBlack(current) &&
    current.high < prev.low
  );
}

function isAbandonedBabyBullish(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isLongBlack(prev2) &&
    isDoji(prev) &&
    prev.high < prev2.low &&
    isLongWhite(current) &&
    current.low > prev.high
  );
}

function isAdvanceBlock(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const first = candles[candles.length - 3];
  const second = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (
    first.close <= first.open ||
    second.close <= second.open ||
    current.close <= current.open
  ) {
    return false;
  }
  if (!(second.close > first.close && current.close > second.close)) {
    return false;
  }
  if (!openInsideBody(second, first) || !openInsideBody(current, second)) {
    return false;
  }
  if (!(body(second) < body(first) && body(current) < body(second))) {
    return false;
  }
  const secondRange = candleRange(second);
  const currentRange = candleRange(current);
  return (
    secondRange > 0 &&
    currentRange > 0 &&
    upperShadow(second) >= secondRange * 0.3 &&
    upperShadow(current) >= currentRange * 0.3
  );
}

function isBearishBeltHold(
  candles: readonly Candle[],
  current: Candle,
): boolean {
  const range = candleRange(current);
  return (
    hasUptrend(candles) &&
    isLongBlack(current) &&
    range > 0 &&
    upperShadow(current) <= range * 0.1
  );
}

function isBullishBeltHold(
  candles: readonly Candle[],
  current: Candle,
): boolean {
  const range = candleRange(current);
  return (
    hasDowntrend(candles) &&
    isLongWhite(current) &&
    range > 0 &&
    lowerShadow(current) <= range * 0.1
  );
}

function isBearishBreakaway(candles: readonly Candle[]): boolean {
  if (candles.length < 5 || !hasUptrend(candles)) return false;
  const prev4 = candles[candles.length - 5];
  const prev3 = candles[candles.length - 4];
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isLongWhite(prev4) &&
    prev3.close > prev3.open &&
    prev3.open > prev4.close &&
    isSmallBody(prev2) &&
    isSmallBody(prev) &&
    prev2.close > prev3.close &&
    prev.close > prev2.close &&
    isLongBlack(current) &&
    current.close > prev4.close &&
    current.close < prev3.open
  );
}

function isBullishBreakaway(candles: readonly Candle[]): boolean {
  if (candles.length < 5 || !hasDowntrend(candles)) return false;
  const prev4 = candles[candles.length - 5];
  const prev3 = candles[candles.length - 4];
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isLongBlack(prev4) &&
    prev3.close < prev3.open &&
    prev3.open < prev4.close &&
    isSmallBody(prev2) &&
    isSmallBody(prev) &&
    prev2.close < prev3.close &&
    prev.close < prev2.close &&
    isLongWhite(current) &&
    current.close > prev3.open &&
    current.close < prev4.close
  );
}

function isBearishCounterattack(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  const tolerance = (candleRange(previous) + candleRange(current)) * 0.1;
  return (
    hasUptrend(candles) &&
    isLongWhite(previous) &&
    isLongBlack(current) &&
    current.open > previous.close &&
    Math.abs(current.close - previous.close) <= tolerance
  );
}

function isBullishCounterattack(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  const tolerance = (candleRange(previous) + candleRange(current)) * 0.1;
  return (
    hasDowntrend(candles) &&
    isLongBlack(previous) &&
    isLongWhite(current) &&
    current.open < previous.close &&
    Math.abs(current.close - previous.close) <= tolerance
  );
}

function isBearishKicking(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  return (
    hasUptrend(candles) &&
    isMarubozu(previous) &&
    previous.close > previous.open &&
    isMarubozu(current) &&
    current.close < current.open &&
    current.high < previous.low
  );
}

function isBullishKicking(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  return (
    hasDowntrend(candles) &&
    isMarubozu(previous) &&
    previous.close < previous.open &&
    isMarubozu(current) &&
    current.close > current.open &&
    current.low > previous.high
  );
}

function isBearishHaramiCross(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  return (
    hasUptrend(candles) &&
    isLongWhite(previous) &&
    isDoji(current) &&
    current.open > previous.open &&
    current.open < previous.close &&
    current.close > previous.open &&
    current.close < previous.close
  );
}

function isBullishHaramiCross(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  return (
    hasDowntrend(candles) &&
    isLongBlack(previous) &&
    isDoji(current) &&
    current.open > previous.close &&
    current.open < previous.open &&
    current.close > previous.close &&
    current.close < previous.open
  );
}

function isConcealingBabySwallow(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev3 = candles[candles.length - 4];
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isLongBlack(prev3) &&
    prev2.close < prev2.open &&
    prev2.high < prev3.low &&
    prev.close < prev.open &&
    prev.open >= Math.min(prev2.open, prev2.close) &&
    prev.open <= Math.max(prev2.open, prev2.close) &&
    prev.close < prev2.close &&
    current.close < current.open &&
    current.close < prev.close
  );
}

function isDownsideGapThreeMethods(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isLongBlack(prev2) &&
    isLongBlack(prev) &&
    prev.open < prev2.close &&
    current.close > current.open &&
    current.open >= prev.close &&
    current.open <= prev.open &&
    current.close >= prev2.close &&
    current.close <= prev2.open
  );
}

function isUpsideGapThreeMethods(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isLongWhite(prev2) &&
    isLongWhite(prev) &&
    prev.open > prev2.close &&
    current.close < current.open &&
    current.open >= prev.open &&
    current.open <= prev.close &&
    current.close >= prev2.open &&
    current.close <= prev2.close
  );
}

function bodiesInside(
  candles: readonly Candle[],
  low: number,
  high: number,
): boolean {
  return candles.every(
    (candle) =>
      isSmallBody(candle) &&
      candle.open > low &&
      candle.open < high &&
      candle.close > low &&
      candle.close < high,
  );
}

function isFallingThreeMethods(candles: readonly Candle[]): boolean {
  if (candles.length < 5 || !hasDowntrend(candles)) return false;
  const prev4 = candles[candles.length - 5];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isLongBlack(prev4)) return false;
  if (!bodiesInside(candles.slice(-4, -1), prev4.close, prev4.open)) {
    return false;
  }
  return (
    isLongBlack(current) &&
    current.open <= prev.close &&
    current.close < prev4.close
  );
}

function isRisingThreeMethods(candles: readonly Candle[]): boolean {
  if (candles.length < 5 || !hasUptrend(candles)) return false;
  const prev4 = candles[candles.length - 5];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isLongWhite(prev4)) return false;
  if (!bodiesInside(candles.slice(-4, -1), prev4.open, prev4.close)) {
    return false;
  }
  return (
    isLongWhite(current) &&
    current.open >= prev.close &&
    current.close > prev4.close
  );
}

function isMatHold(candles: readonly Candle[]): boolean {
  if (candles.length < 5 || !hasUptrend(candles)) return false;
  const prev4 = candles[candles.length - 5];
  const prev3 = candles[candles.length - 4];
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isLongWhite(prev4)) return false;
  if (!isSmallBody(prev3) || !(prev3.open > prev4.close)) return false;
  if (
    !isSmallBody(prev2) ||
    !isSmallBody(prev) ||
    prev2.close <= prev4.close ||
    prev.close <= prev4.close
  ) {
    return false;
  }
  const highestHigh = Math.max(prev4.high, prev3.high, prev2.high, prev.high);
  return isLongWhite(current) && current.close > highestHigh;
}

function isThreeInsideDown(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isLongWhite(prev2) &&
    prev.close < prev.open &&
    prev.open <= prev2.close &&
    prev.close >= prev2.open &&
    current.close < current.open &&
    current.close < prev.close
  );
}

function isThreeInsideUp(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isLongBlack(prev2) &&
    prev.close > prev.open &&
    prev.open >= prev2.close &&
    prev.close <= prev2.open &&
    current.close > current.open &&
    current.close > prev.close
  );
}

function isThreeOutsideDown(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isSmallBody(prev2) &&
    prev2.close > prev2.open &&
    isLongBlack(prev) &&
    isBearishEngulfing(prev2, prev) &&
    current.close < current.open &&
    current.close < prev.close
  );
}

function isThreeOutsideUp(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isSmallBody(prev2) &&
    prev2.close < prev2.open &&
    isLongWhite(prev) &&
    isBullishEngulfing(prev2, prev) &&
    current.close > current.open &&
    current.close > prev.close
  );
}

function isThreeLineStrikeBearish(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const prev3 = candles[candles.length - 4];
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (
    !isLongWhite(prev3) ||
    !isLongWhite(prev2) ||
    !isLongWhite(prev) ||
    !(prev2.close > prev3.close && prev.close > prev2.close)
  ) {
    return false;
  }
  if (!openInsideBody(prev2, prev3) || !openInsideBody(prev, prev2)) {
    return false;
  }
  return (
    isLongBlack(current) &&
    current.open >= prev.close &&
    current.close <= prev3.open
  );
}

function isThreeLineStrikeBullish(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev3 = candles[candles.length - 4];
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (
    !isLongBlack(prev3) ||
    !isLongBlack(prev2) ||
    !isLongBlack(prev) ||
    !(prev2.close < prev3.close && prev.close < prev2.close)
  ) {
    return false;
  }
  if (!openInsideBody(prev2, prev3) || !openInsideBody(prev, prev2)) {
    return false;
  }
  return (
    isLongWhite(current) &&
    current.open <= prev.close &&
    current.close >= prev3.open
  );
}

function isInNeck(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  const range = candleRange(previous);
  return (
    hasDowntrend(candles) &&
    isLongBlack(previous) &&
    current.close > current.open &&
    current.open < previous.close &&
    current.close >= previous.close &&
    range > 0 &&
    current.close - previous.close <= range * 0.1
  );
}

function isOnNeck(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  const range = candleRange(previous);
  return (
    hasDowntrend(candles) &&
    isLongBlack(previous) &&
    current.close > current.open &&
    current.open < previous.close &&
    range > 0 &&
    Math.abs(current.close - previous.low) <= range * 0.1
  );
}

function isThrusting(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  return (
    hasDowntrend(candles) &&
    isLongBlack(previous) &&
    current.close > current.open &&
    current.open < previous.close &&
    current.close > previous.close &&
    current.close <= (previous.open + previous.close) / 2
  );
}

function closesEqual(first: Candle, second: Candle): boolean {
  return (
    Math.abs(first.close - second.close) <=
    (candleRange(first) + candleRange(second)) * 0.1
  );
}

function opensEqual(first: Candle, second: Candle): boolean {
  return (
    Math.abs(first.open - second.open) <=
    (candleRange(first) + candleRange(second)) * 0.1
  );
}

function isBearishMeetingLines(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  return (
    hasUptrend(candles) &&
    isLongWhite(previous) &&
    isLongBlack(current) &&
    closesEqual(previous, current)
  );
}

function isBullishMeetingLines(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  return (
    hasDowntrend(candles) &&
    isLongBlack(previous) &&
    isLongWhite(current) &&
    closesEqual(previous, current)
  );
}

function isBearishSeparatingLines(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  return (
    hasDowntrend(candles) &&
    isLongBlack(previous) &&
    current.close > current.open &&
    opensEqual(previous, current)
  );
}

function isBullishSeparatingLines(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  return (
    hasUptrend(candles) &&
    isLongWhite(previous) &&
    current.close < current.open &&
    opensEqual(previous, current)
  );
}

function isClosingMarubozuBearish(current: Candle): boolean {
  const range = candleRange(current);
  return (
    isLongBlack(current) &&
    range > 0 &&
    current.close - current.low <= range * 0.1
  );
}

function isClosingMarubozuBullish(current: Candle): boolean {
  const range = candleRange(current);
  return (
    isLongWhite(current) &&
    range > 0 &&
    current.high - current.close <= range * 0.1
  );
}

function isDarkCloudCover(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  const midpoint = (previous.open + previous.close) / 2;
  return (
    hasUptrend(candles) &&
    isLongWhite(previous) &&
    current.close < current.open &&
    current.open > previous.high &&
    current.close < midpoint &&
    current.close > previous.open
  );
}

function isPiercingLine(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  const midpoint = (previous.open + previous.close) / 2;
  return (
    hasDowntrend(candles) &&
    isLongBlack(previous) &&
    current.close > current.open &&
    current.open < previous.low &&
    current.close > midpoint &&
    current.close < previous.open
  );
}

function isEveningStar(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isLongWhite(prev2)) return false;
  if (!isSmallBody(prev) || !(prev.low > prev2.high)) return false;
  const midpoint = (prev2.open + prev2.close) / 2;
  return current.close < current.open && current.close < midpoint;
}

function isMorningStar(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isLongBlack(prev2)) return false;
  if (!isSmallBody(prev) || !(prev.high < prev2.low)) return false;
  const midpoint = (prev2.open + prev2.close) / 2;
  return current.close > current.open && current.close > midpoint;
}

function isDojiStarBearish(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  return (
    hasUptrend(candles) &&
    isLongWhite(previous) &&
    isDoji(current) &&
    current.low > previous.high
  );
}

function isDojiStarBullish(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  return (
    hasDowntrend(candles) &&
    isLongBlack(previous) &&
    isDoji(current) &&
    current.high < previous.low
  );
}

function isEveningDojiStar(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isLongWhite(prev2)) return false;
  if (!isDoji(prev) || !(prev.low > prev2.high)) return false;
  const midpoint = (prev2.open + prev2.close) / 2;
  return current.close < current.open && current.close < midpoint;
}

function isMorningDojiStar(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isLongBlack(prev2)) return false;
  if (!isDoji(prev) || !(prev.high < prev2.low)) return false;
  const midpoint = (prev2.open + prev2.close) / 2;
  return current.close > current.open && current.close > midpoint;
}

function isFourPriceDoji(current: Candle): boolean {
  return (
    current.open === current.high &&
    current.high === current.low &&
    current.low === current.close
  );
}

function longShadows(current: Candle, fraction: number): boolean {
  const range = candleRange(current);
  return (
    range > 0 &&
    upperShadow(current) >= range * fraction &&
    lowerShadow(current) >= range * fraction
  );
}

function isLongLeggedDoji(current: Candle): boolean {
  return isDoji(current) && longShadows(current, 0.4);
}

function isRickshawMan(current: Candle): boolean {
  const range = candleRange(current);
  return (
    isDoji(current) &&
    range > 0 &&
    body(current) <= range * 0.05 &&
    longShadows(current, 0.4)
  );
}

function isHighWave(current: Candle): boolean {
  const range = candleRange(current);
  return range > 0 && body(current) <= range * 0.3 && longShadows(current, 0.4);
}

function isTriStarBearish(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isDoji(prev2) &&
    isDoji(prev) &&
    prev.low > prev2.high &&
    isDoji(current) &&
    current.high < prev.low
  );
}

function isTriStarBullish(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  return (
    isDoji(prev2) &&
    isDoji(prev) &&
    prev.high < prev2.low &&
    isDoji(current) &&
    current.low > prev.high
  );
}

function isTasukiGapBearish(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isLongBlack(prev2)) return false;
  if (!(current.close > current.open)) return false;
  if (!(prev.close > prev.open && prev.high < prev2.low)) return false;
  return openInsideBody(current, prev) && current.close < prev2.low;
}

function isTasukiGapBullish(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isLongWhite(prev2)) return false;
  if (!(current.close < current.open)) return false;
  if (!(prev.close > prev.open && prev.low > prev2.high)) return false;
  return openInsideBody(current, prev) && current.close > prev2.high;
}

function isHomingPigeon(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  const low = previous.close;
  const high = previous.open;
  return (
    hasDowntrend(candles) &&
    isLongBlack(previous) &&
    current.close < current.open &&
    isSmallBody(current) &&
    current.open < high &&
    current.open > low &&
    current.close < high &&
    current.close > low
  );
}

function isMatchingLow(
  candles: readonly Candle[],
  previous: Candle,
  current: Candle,
): boolean {
  const tolerance = (candleRange(previous) + candleRange(current)) * 0.1;
  return (
    hasDowntrend(candles) &&
    previous.close < previous.open &&
    current.close < current.open &&
    Math.abs(current.low - previous.low) <= tolerance
  );
}

function isStickSandwich(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!(prev2.close < prev2.open && prev.close > prev.open)) return false;
  if (!(current.close < current.open)) return false;
  return closesEqual(current, prev2);
}

function isTakuri(candles: readonly Candle[], current: Candle): boolean {
  const range = candleRange(current);
  return (
    hasDowntrend(candles) &&
    isDoji(current) &&
    range > 0 &&
    lowerShadow(current) >= range * 0.6 &&
    upperShadow(current) <= range * 0.1
  );
}

function isLadderBottom(candles: readonly Candle[]): boolean {
  if (candles.length < 5 || !hasDowntrend(candles)) return false;
  const prev4 = candles[candles.length - 5];
  const prev3 = candles[candles.length - 4];
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (
    !isLongBlack(prev4) ||
    !isLongBlack(prev3) ||
    !isLongBlack(prev2) ||
    !(prev3.close < prev4.close && prev2.close < prev3.close)
  ) {
    return false;
  }
  if (
    !isSmallBody(prev) ||
    prev.close >= prev.open ||
    !(prev.open > prev2.close)
  ) {
    return false;
  }
  return (
    current.close > current.open &&
    current.open > prev.open &&
    current.close >= prev4.open
  );
}

function isStalledPattern(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (
    !isLongWhite(prev2) ||
    !isLongWhite(prev) ||
    !(prev.close > prev2.close)
  ) {
    return false;
  }
  if (!openInsideBody(prev, prev2)) return false;
  return (
    current.close > current.open &&
    isSmallBody(current) &&
    openInsideBody(current, prev)
  );
}

function isInsideDay(outer: Candle, inner: Candle): boolean {
  return inner.high < outer.high && inner.low > outer.low;
}

function isHikkakeBearish(candles: readonly Candle[]): boolean {
  if (candles.length < 5) return false;
  const prev3 = candles[candles.length - 4];
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isInsideDay(prev3, prev2)) return false;
  if (!(prev.close < prev2.low)) return false;
  return current.close > prev2.high;
}

function isHikkakeBullish(candles: readonly Candle[]): boolean {
  if (candles.length < 5) return false;
  const prev3 = candles[candles.length - 4];
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isInsideDay(prev3, prev2)) return false;
  if (!(prev.close > prev2.high)) return false;
  return current.close < prev2.low;
}

function opensMatch(first: Candle, second: Candle): boolean {
  return (
    Math.abs(first.open - second.close) <=
    (candleRange(first) + candleRange(second)) * 0.1
  );
}

function isIdenticalThreeCrows(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (
    !isLongBlack(prev2) ||
    !isLongBlack(prev) ||
    !isLongBlack(current) ||
    !(prev.close < prev2.close && current.close < prev.close)
  ) {
    return false;
  }
  return opensMatch(prev, prev2) && opensMatch(current, prev);
}

function isThreeStarsInTheSouth(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isLongBlack(prev2)) return false;
  if (
    !(prev.close < prev.open) ||
    prev.open <= prev2.close ||
    prev.open >= prev2.open ||
    !(prev.low > prev2.low) ||
    !(body(prev) < body(prev2))
  ) {
    return false;
  }
  return (
    isMarubozu(current) &&
    current.close < current.open &&
    current.high < prev.high &&
    current.low > prev.low
  );
}

function isUniqueThreeRiverBottom(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasDowntrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isLongBlack(prev2)) return false;
  if (
    !(prev.close < prev.open) ||
    !isSmallBody(prev) ||
    !(prev.close < prev2.close)
  ) {
    return false;
  }
  return (
    current.close > current.open &&
    isSmallBody(current) &&
    current.open < prev.open &&
    current.close > prev.close &&
    current.close < prev2.close
  );
}

function isUpsideGapTwoCrows(candles: readonly Candle[]): boolean {
  if (candles.length < 4 || !hasUptrend(candles)) return false;
  const prev2 = candles[candles.length - 3];
  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];
  if (!isLongWhite(prev2)) return false;
  if (
    !(prev.close < prev.open) ||
    !(prev.low > prev2.high) ||
    !(current.close < current.open)
  ) {
    return false;
  }
  return (
    openInsideBody(current, prev) &&
    current.close >= prev.close &&
    current.close <= prev.open &&
    current.close > prev2.high
  );
}

function hasUptrend(candles: readonly Candle[]): boolean {
  const history = candles.slice(-4, -1);
  return history.length === 3 && history[2].close > history[0].close;
}

function hasDowntrend(candles: readonly Candle[]): boolean {
  const history = candles.slice(-4, -1);
  return history.length === 3 && history[2].close < history[0].close;
}

function candlestickDirection(id: string): "bullish" | "bearish" | "neutral" {
  if (
    id === "bullish-engulfing" ||
    id === "bullish-harami" ||
    id === "hammer" ||
    id === "inverted-hammer" ||
    id === "three-white-soldiers" ||
    id === "tweezer-bottom" ||
    id === "bullish-marubozu" ||
    id === "abandoned-baby-bullish" ||
    id === "bullish-belt-hold" ||
    id === "bullish-breakaway" ||
    id === "bullish-counterattack" ||
    id === "bullish-kicking" ||
    id === "bullish-harami-cross" ||
    id === "concealing-baby-swallow" ||
    id === "upside-gap-three-methods" ||
    id === "rising-three-methods" ||
    id === "mat-hold" ||
    id === "three-inside-up" ||
    id === "three-outside-up" ||
    id === "three-line-strike-bullish" ||
    id === "bullish-long-line" ||
    id === "bullish-short-line" ||
    id === "bullish-meeting-lines" ||
    id === "bullish-separating-lines" ||
    id === "closing-marubozu-bullish" ||
    id === "piercing-line" ||
    id === "morning-star" ||
    id === "doji-star-bullish" ||
    id === "morning-doji-star" ||
    id === "tri-star-bullish" ||
    id === "tasuki-gap-bullish" ||
    id === "upside-tasuki-gap" ||
    id === "homing-pigeon" ||
    id === "matching-low" ||
    id === "stick-sandwich" ||
    id === "takuri" ||
    id === "ladder-bottom" ||
    id === "hikkake-bullish" ||
    id === "three-stars-in-the-south" ||
    id === "unique-three-river-bottom"
  ) {
    return "bullish";
  }
  if (
    id === "bearish-engulfing" ||
    id === "bearish-harami" ||
    id === "shooting-star" ||
    id === "hanging-man" ||
    id === "three-black-crows" ||
    id === "tweezer-top" ||
    id === "bearish-marubozu" ||
    id === "abandoned-baby-bearish" ||
    id === "advance-block" ||
    id === "bearish-belt-hold" ||
    id === "bearish-breakaway" ||
    id === "bearish-counterattack" ||
    id === "bearish-kicking" ||
    id === "bearish-harami-cross" ||
    id === "downside-gap-three-methods" ||
    id === "falling-three-methods" ||
    id === "three-inside-down" ||
    id === "three-outside-down" ||
    id === "three-line-strike-bearish" ||
    id === "in-neck" ||
    id === "on-neck" ||
    id === "thrusting" ||
    id === "bearish-long-line" ||
    id === "bearish-short-line" ||
    id === "bearish-meeting-lines" ||
    id === "bearish-separating-lines" ||
    id === "closing-marubozu-bearish" ||
    id === "dark-cloud-cover" ||
    id === "evening-star" ||
    id === "doji-star-bearish" ||
    id === "evening-doji-star" ||
    id === "tri-star-bearish" ||
    id === "tasuki-gap-bearish" ||
    id === "downside-tasuki-gap" ||
    id === "stalled-pattern" ||
    id === "hikkake-bearish" ||
    id === "identical-three-crows" ||
    id === "upside-gap-two-crows"
  ) {
    return "bearish";
  }
  return "neutral";
}

function chartDirection(id: string): "bullish" | "bearish" {
  if (
    id === "breakdown" ||
    id === "gap-down" ||
    id === "lower-high-lower-low" ||
    id === "double-top" ||
    id === "head-shoulders" ||
    id === "descending-triangle" ||
    id === "bear-flag" ||
    id === "bear-pennant" ||
    id === "rising-wedge" ||
    id === "bearish-rectangle" ||
    id === "triple-top" ||
    id === "rounding-top" ||
    id === "inverse-cup-handle" ||
    id === "diamond-top" ||
    id === "broadening-formation" ||
    id === "v-top" ||
    id === "island-reversal-bearish" ||
    id === "exhaustion-gap" ||
    id === "trend-reversal"
  ) {
    return "bearish";
  }
  return "bullish";
}

function isStructureSignal(id: string): boolean {
  return id === "higher-high-higher-low" || id === "lower-high-lower-low";
}

function displayPattern(id: string): string {
  return id.replaceAll("-", " ");
}

function insufficient(id: string, message: string): SignalResult {
  return { id, state: "insufficient-data", message };
}

function unsupported(id: string, message: string): SignalResult {
  return { id, state: "unsupported", message };
}

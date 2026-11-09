import type { Candle, NullableNumber } from "@/lib/technical/types";
import type { IndicatorDefinition, IndicatorInputs } from "@/lib/technical/indicator-schema";
import { requireIndicatorDefinition } from "@/lib/technical/indicator-catalog";
import { evaluateCandlestickPattern } from "@/lib/technical/patterns";
import type { SeriesRef } from "./types";

/** Fixed lookback window for pattern detection at each bar — every
 * supported candlestick pattern needs at most a few trailing candles, so a
 * small constant window keeps this O(n) instead of re-slicing from the
 * start of history on every bar. */
const PATTERN_WINDOW = 5;

export function computeSeriesRef(
  candles: readonly Candle[],
  ref: SeriesRef,
): NullableNumber[] {
  if (ref.kind === "price") {
    return candles.map((candle) => candle[ref.source]);
  }

  const definition = requireIndicatorDefinition(ref.indicatorId);
  const inputs: IndicatorInputs = { ...defaultInputs(definition), ...ref.inputs };
  const seriesMap = definition.compute(candles, inputs);
  return seriesMap[ref.plotKey] ?? candles.map(() => null);
}

export function computePatternSeries(
  candles: readonly Candle[],
  patternId: string,
): boolean[] {
  return candles.map((_, index) => {
    const windowStart = Math.max(0, index - PATTERN_WINDOW + 1);
    const window = candles.slice(windowStart, index + 1);
    const result = evaluateCandlestickPattern(patternId, window);
    return result.state === "detected";
  });
}

function defaultInputs(definition: IndicatorDefinition): IndicatorInputs {
  return Object.fromEntries(
    definition.inputs.map((field) => [field.id, field.defaultValue]),
  );
}

import type { Candle, NullableNumber } from "@/lib/technical/types";
import { crossesAbove, crossesBelow } from "@/lib/technical/indicators";
import { computePatternSeries, computeSeriesRef } from "./series";
import type { ComparisonOperator, StrategyCondition } from "./types";

/** Every condition in a leg must be true on the same bar (AND) for the leg
 * to fire — there is no OR support; that covers the common retail-strategy
 * case without a full expression-tree UI. */
export function evaluateLegConditions(
  candles: readonly Candle[],
  conditions: readonly StrategyCondition[],
): boolean[] {
  if (conditions.length === 0) {
    return candles.map(() => false);
  }

  const perConditionSeries = conditions.map((condition) =>
    evaluateCondition(candles, condition),
  );

  return candles.map((_, index) =>
    perConditionSeries.every((series) => series[index] === true),
  );
}

function evaluateCondition(
  candles: readonly Candle[],
  condition: StrategyCondition,
): boolean[] {
  if (condition.kind === "pattern") {
    return computePatternSeries(candles, condition.patternId);
  }

  const { right } = condition;
  const leftSeries = computeSeriesRef(candles, condition.left);
  const rightSeries =
    right.kind === "value" ? candles.map(() => right.value) : computeSeriesRef(candles, right);

  return combineWithOperator(leftSeries, rightSeries, condition.operator);
}

function combineWithOperator(
  left: readonly NullableNumber[],
  right: readonly NullableNumber[],
  operator: ComparisonOperator,
): boolean[] {
  switch (operator) {
    case "crossesAbove":
      return crossesAbove(left, right).map((value) => value === true);
    case "crossesBelow":
      return crossesBelow(left, right).map((value) => value === true);
    case "greaterThan":
      return left.map(
        (value, index) =>
          value !== null && right[index] !== null && value > (right[index] as number),
      );
    case "lessThan":
      return left.map(
        (value, index) =>
          value !== null && right[index] !== null && value < (right[index] as number),
      );
    case "equals":
      return left.map(
        (value, index) =>
          value !== null && right[index] !== null && value === right[index],
      );
    default: {
      const exhaustiveCheck: never = operator;
      throw new Error(`Unhandled comparison operator: ${String(exhaustiveCheck)}`);
    }
  }
}

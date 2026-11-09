import type { IndicatorInputValue } from "@/lib/technical/indicator-schema";

export const COMPARISON_OPERATORS = [
  "greaterThan",
  "lessThan",
  "crossesAbove",
  "crossesBelow",
  "equals",
] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

export const PRICE_FIELDS = ["open", "high", "low", "close"] as const;
export type PriceField = (typeof PRICE_FIELDS)[number];

export type SeriesRef =
  | { readonly kind: "price"; readonly source: PriceField }
  | {
      readonly kind: "indicator";
      readonly indicatorId: string;
      readonly plotKey: string;
      readonly inputs: Readonly<Record<string, IndicatorInputValue>>;
    };

export type ConditionTarget = { readonly kind: "value"; readonly value: number } | SeriesRef;

export type StrategyCondition =
  | {
      readonly id: string;
      readonly kind: "comparison";
      readonly left: SeriesRef;
      readonly operator: ComparisonOperator;
      readonly right: ConditionTarget;
    }
  | {
      readonly id: string;
      readonly kind: "pattern";
      readonly patternId: string;
    };

export type StopLossConfig =
  | { readonly kind: "none" }
  | { readonly kind: "percent"; readonly percent: number }
  | { readonly kind: "atrMultiple"; readonly atrLength: number; readonly multiple: number };

export type PartialBookingConfig =
  | { readonly kind: "none" }
  | { readonly kind: "targetPercent"; readonly percent: number; readonly bookFraction: number };

export const STRATEGY_LEG_KEYS = ["buy", "exit"] as const;
export type StrategyLegKey = (typeof STRATEGY_LEG_KEYS)[number];

export interface StrategyLegs {
  readonly buy: readonly StrategyCondition[];
  readonly exit: readonly StrategyCondition[];
  readonly initialStopLoss: StopLossConfig;
  readonly trailingStopLoss: StopLossConfig;
  readonly partialBooking: PartialBookingConfig;
}

export function emptyStrategyLegs(): StrategyLegs {
  return {
    buy: [],
    exit: [],
    initialStopLoss: { kind: "none" },
    trailingStopLoss: { kind: "none" },
    partialBooking: { kind: "none" },
  };
}

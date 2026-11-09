/**
 * The CP Signal options the Screening Table can evaluate for real, as daily
 * candle rules. Everything else in that dropdown is still a label the user
 * pins on a curated entry by hand.
 *
 * A rule is written the way it is specified — "1 Day Ago Open Less Than
 * 2 Days Ago Open" is `[day(1, "open"), "<", day(2, "open")]` — and the same
 * definition drives the SQL screen (candle-pattern-sql.ts) and the in-memory
 * evaluator below, so the two cannot drift apart.
 */

export const DAILY_CANDLE_PATTERN_IDS = ["red-jc-type-2-wnt"] as const;

export type DailyCandlePatternId = (typeof DAILY_CANDLE_PATTERN_IDS)[number];

export type CandleField = "open" | "high" | "low" | "close";

/**
 * One value of the candle `daysAgo` sessions back. Day 0 is the session in
 * progress (its close is the last traded price), or the last session once the
 * market has closed.
 */
export interface CandleValueRef {
  readonly daysAgo: number;
  readonly field: CandleField;
}

export type ComparisonOperator = "<" | ">";

/** `left <operator> right`, in the order the rule reads. */
export type CandleComparison = readonly [
  CandleValueRef,
  ComparisonOperator,
  CandleValueRef,
];

export interface DailyCandlePattern {
  readonly id: DailyCandlePatternId;
  /** The CP Signal option, exactly as the VGS Reddy Strategies page shows it. */
  readonly label: string;
  /** Every comparison must hold for a stock to match. */
  readonly conditions: readonly CandleComparison[];
}

export interface DailyCandle {
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

const day = (daysAgo: number, field: CandleField): CandleValueRef => ({
  daysAgo,
  field,
});

export const DAILY_CANDLE_PATTERNS: readonly DailyCandlePattern[] = [
  {
    id: "red-jc-type-2-wnt",
    label: "RED JC Type 2 WNT",
    // Three red sessions in a row: yesterday opened inside the body of the
    // day before, and today opened below yesterday's close.
    conditions: [
      [day(2, "close"), "<", day(2, "open")],
      [day(1, "open"), "<", day(2, "open")],
      [day(1, "open"), ">", day(2, "close")],
      [day(1, "close"), "<", day(1, "open")],
      [day(0, "open"), "<", day(1, "close")],
      [day(0, "close"), "<", day(0, "open")],
    ],
  },
];

const patternById = new Map<DailyCandlePatternId, DailyCandlePattern>(
  DAILY_CANDLE_PATTERNS.map((pattern) => [pattern.id, pattern]),
);
const patternIdByLabel = new Map<string, DailyCandlePatternId>(
  DAILY_CANDLE_PATTERNS.map((pattern) => [pattern.label, pattern.id]),
);

export function isDailyCandlePatternId(
  value: string,
): value is DailyCandlePatternId {
  return patternById.has(value as DailyCandlePatternId);
}

export function getDailyCandlePattern(
  id: DailyCandlePatternId,
): DailyCandlePattern {
  const pattern = patternById.get(id);
  if (!pattern) {
    throw new Error(`Unknown daily candle pattern "${id}".`);
  }
  return pattern;
}

/** The pattern behind a CP Signal option, or undefined for a label-only one. */
export function dailyCandlePatternIdForLabel(
  label: string,
): DailyCandlePatternId | undefined {
  return patternIdByLabel.get(label);
}

/** Sessions a screen has to read, today included, to evaluate these patterns. */
export function dailyCandlePatternSessions(
  patterns: readonly DailyCandlePattern[],
): number {
  let furthestDay = 0;
  for (const pattern of patterns) {
    for (const [left, , right] of pattern.conditions) {
      furthestDay = Math.max(furthestDay, left.daysAgo, right.daysAgo);
    }
  }
  return furthestDay + 1;
}

/**
 * Whether `candles` (index 0 = today, 1 = one session back, ...) satisfy the
 * pattern. A missing candle or a value that is not a positive number can
 * never match, the same way the SQL screen treats a NULL or zero.
 */
export function matchesDailyCandlePattern(
  pattern: DailyCandlePattern,
  candles: readonly (DailyCandle | null | undefined)[],
): boolean {
  const valueOf = (ref: CandleValueRef): number | null => {
    const value = candles[ref.daysAgo]?.[ref.field];
    return typeof value === "number" && Number.isFinite(value) && value > 0
      ? value
      : null;
  };

  return pattern.conditions.every(([left, operator, right]) => {
    const leftValue = valueOf(left);
    const rightValue = valueOf(right);
    if (leftValue === null || rightValue === null) return false;
    return operator === "<" ? leftValue < rightValue : leftValue > rightValue;
  });
}

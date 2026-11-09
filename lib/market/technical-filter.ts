/**
 * Technical column filters — the "RSI ≤ 20" style conditions a user pins on
 * an added column — and the rules that decide whether such a filter can run
 * over the whole universe on the server or only over the rows on screen.
 *
 * Free of server imports so the browser applies exactly the same matching
 * rules to the columns it still has to filter locally (live-feed and
 * intraday timeframes, whose candles exist only for the stocks on screen).
 */
import {
  ADD_COLUMN_GROUPS,
  ADD_TIMEFRAMES,
  type AddedColumnDefinition,
} from "@/lib/screener-columns";
import {
  resolveColumnCapability,
  resolveTimeframeCapability,
} from "@/lib/technical";

/** The part of a resolved column value that filtering and sorting read. */
export interface TechnicalValueLike {
  readonly state: string;
  readonly display: string;
  readonly numericValue?: number;
}

export const TECHNICAL_FILTER_OPERATORS = [
  "gt",
  "lt",
  "gte",
  "lte",
  "between",
  "equals",
  "bullish",
  "bearish",
  "detected",
  "none",
] as const;

export type TechnicalFilterOperator =
  (typeof TECHNICAL_FILTER_OPERATORS)[number];

export interface TechnicalColumnFilter {
  readonly columnId: string;
  readonly operator: TechnicalFilterOperator;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly preset?: string;
  readonly label?: string;
}

/** At most this many technical conditions per request. */
export const MAX_TECHNICAL_FILTERS = 12;

/** The key added-column values are stored under: `<segment>:<securityId>`. */
export function instrumentKeyOf(row: {
  readonly securityId: number;
  readonly exchangeSegment: string;
}): string {
  return `${row.exchangeSegment}:${row.securityId}`;
}

const timeframeById = new Map<string, (typeof ADD_TIMEFRAMES)[number]>(
  ADD_TIMEFRAMES.map((tf) => [tf.id, tf]),
);
const groupById = new Map<string, (typeof ADD_COLUMN_GROUPS)[number]>(
  ADD_COLUMN_GROUPS.map((group) => [group.id, group]),
);

/**
 * Rebuilds a column definition from its id (`<timeframe>:change` or
 * `<timeframe>:<group>:<item>`), or null when any part is unknown.
 */
export function parseAddedColumnId(id: string): AddedColumnDefinition | null {
  const parts = id.split(":");
  const timeframe = timeframeById.get(parts[0] ?? "");
  if (!timeframe) return null;

  if (parts.length === 2 && parts[1] === "change") {
    return {
      id,
      timeframeId: timeframe.id,
      timeframeLabel: timeframe.label,
      label: timeframe.changeLabel,
      groupId: null,
      groupLabel: "Timeframe",
      itemId: null,
      kind: "change",
    };
  }

  if (parts.length !== 3) return null;
  const group = groupById.get(parts[1]!);
  const item = group?.items.find((entry) => entry.id === parts[2]);
  if (!group || !item) return null;
  return {
    id,
    timeframeId: timeframe.id,
    timeframeLabel: timeframe.label,
    label: item.label,
    groupId: group.id,
    groupLabel: group.label,
    itemId: item.id,
    kind: "option",
  };
}

/**
 * Whether the server can evaluate this column for every stock at once. That
 * needs a timeframe served from the stored daily history (daily and coarser,
 * or the change/return columns over it) and a value computed from candles or
 * the stored quote. Sub-minute and intraday timeframes only exist for the
 * stocks on screen, and fundamentals and option-chain fields are not part of
 * the in-memory universe.
 */
export function isUniverseScreenableColumn(
  column: AddedColumnDefinition,
): boolean {
  const timeframe = resolveTimeframeCapability(column.timeframeId);
  if (timeframe.status !== "supported") return false;
  // Minute and hour timeframes come from Dhan's intraday REST candles, which
  // are only ever fetched for the stocks on screen.
  if (timeframe.dhanInterval !== "day") return false;
  if (column.kind === "change") return true;
  if (!column.groupId || !column.itemId) return false;

  const capability = resolveColumnCapability(
    column.groupId,
    column.itemId,
    column.timeframeId,
  );
  return (
    capability.status === "supported" &&
    (capability.source === "local-candles" || capability.source === "dhan-rest")
  );
}

const POSITIVE_SIGNALS = ["yes", "detected", "bullish", "long", "buy"];
const NEGATIVE_SIGNALS = ["bearish", "short", "sell"];

function hasSignal(display: string, needles: readonly string[]): boolean {
  return needles.some(
    (needle) => display === needle || display.includes(needle),
  );
}

/**
 * Whether a resolved column value satisfies a filter. A missing or non-ready
 * value never matches, so a stock without enough history drops out of a
 * numeric screen rather than sorting to one end of it.
 */
export function matchesTechnicalFilter(
  value: TechnicalValueLike | undefined,
  filter: TechnicalColumnFilter,
): boolean {
  if (!value || value.state !== "ready") return false;
  const numeric = value.numericValue;
  const display = value.display.trim().toLowerCase();

  switch (filter.operator) {
    case "gt":
      return (
        numeric !== undefined &&
        filter.minValue !== undefined &&
        numeric > filter.minValue
      );
    case "gte":
      return (
        numeric !== undefined &&
        filter.minValue !== undefined &&
        numeric >= filter.minValue
      );
    case "lt":
      return (
        numeric !== undefined &&
        filter.maxValue !== undefined &&
        numeric < filter.maxValue
      );
    case "lte":
      return (
        numeric !== undefined &&
        filter.maxValue !== undefined &&
        numeric <= filter.maxValue
      );
    case "between":
      if (numeric === undefined) return false;
      if (filter.minValue !== undefined && numeric < filter.minValue)
        return false;
      if (filter.maxValue !== undefined && numeric > filter.maxValue)
        return false;
      return true;
    case "equals":
      return (
        numeric !== undefined &&
        filter.minValue !== undefined &&
        Math.abs(numeric - filter.minValue) <= 0.001
      );
    case "detected":
    case "bullish":
      return hasSignal(display, POSITIVE_SIGNALS);
    case "bearish":
      return hasSignal(display, NEGATIVE_SIGNALS);
    case "none":
      return !hasSignal(display, POSITIVE_SIGNALS);
  }
}

/**
 * Orders two column values for a sort on that column: numbers first by
 * value, then text by display, with missing values last regardless of
 * direction (the caller flips only the comparison of present values).
 */
export function compareTechnicalValues(
  left: TechnicalValueLike | undefined,
  right: TechnicalValueLike | undefined,
  order: "asc" | "desc",
): number {
  const leftPresent = left?.state === "ready";
  const rightPresent = right?.state === "ready";
  if (!leftPresent && !rightPresent) return 0;
  if (!leftPresent) return 1;
  if (!rightPresent) return -1;

  const sign = order === "asc" ? 1 : -1;
  const leftNumber = left.numericValue;
  const rightNumber = right.numericValue;
  if (leftNumber !== undefined && rightNumber !== undefined) {
    return sign * (leftNumber - rightNumber);
  }
  if (leftNumber !== undefined) return -1;
  if (rightNumber !== undefined) return 1;
  return sign * left.display.localeCompare(right.display);
}

/** Serialises filters for the `technicals` query parameter. */
export function encodeTechnicalFilters(
  filters: readonly TechnicalColumnFilter[],
): string {
  return JSON.stringify(
    filters.map(({ columnId, operator, minValue, maxValue }) => ({
      columnId,
      operator,
      ...(minValue === undefined ? {} : { minValue }),
      ...(maxValue === undefined ? {} : { maxValue }),
    })),
  );
}

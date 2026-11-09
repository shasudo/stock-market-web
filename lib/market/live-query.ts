import { z } from "zod";
import { ValidationError, type ErrorDetails } from "@/lib/errors";
import type { AddedColumnDefinition } from "@/lib/screener-columns";
import {
  isDailyCandlePatternId,
  type DailyCandlePatternId,
} from "./candle-patterns";
import {
  isUniverseScreenableColumn,
  MAX_TECHNICAL_FILTERS,
  parseAddedColumnId,
  TECHNICAL_FILTER_OPERATORS,
  type TechnicalColumnFilter,
} from "./technical-filter";
import {
  DEFAULT_PATTERN_TIMEFRAME,
  isCandlestickSummaryId,
  isChartPatternSummaryId,
  isPatternSummaryTimeframe,
  MAX_PATTERN_TIMEFRAMES,
} from "./pattern-summary";

export const marketExchanges = ["NSE", "BSE", "Both"] as const;
export const marketViewFilters = [
  "all",
  "gainers",
  "losers",
  "unchanged",
] as const;
export const marketHitFilters = ["all", "high", "low"] as const;
export const marketAthFilters = ["all", "high", "low"] as const;
export const sortDirections = ["asc", "desc"] as const;

// Three ways to scope a query, all resolved into `exchange` + two flags:
//   NSE / BSE       — every row on that exchange, dual-listed or not
//   Both / Merged   — both exchanges, raw or collapsed to one row per company
//   Only NSE / BSE  — exclusively listed there, i.e. absent from the other
const acceptedExchangeInputs = [
  "NSE",
  "BSE",
  "Both",
  "Merged",
  "Only NSE",
  "Only BSE",
] as const;

const directSortFields = [
  "pctChange",
  "netChange",
  "volume",
  "name",
  "lastPrice",
  "prevClose",
  "marketCap",
  // Plain LiveQuote text columns, so a table can offer a real whole-result
  // sort on the descriptive columns too, not only on the numeric ones.
  "tradingSymbol",
  "exchange",
  "sector",
  "industry",
  "series",
  "priceBand",
] as const;

const percentChangeSortFields = [
  "% Chag",
  "% 5Min Chag",
  "% 15Min Chag",
  "% 30Min Chag",
  "% 1Hour Chag",
  "% 2Hours Chag",
  "% 2D Chag",
  "% 3D Chag",
  "% 4D Chag",
  "% 5D Chag",
  "% 1W Chag",
  "% 2W Chag",
  "% 3W Chag",
  "% 4W Chag",
  "% 5W Chag",
  "% 1M Chag",
  "% 2M Chag",
  "% 3M Chag",
  "% 4M Chag",
  "% 5M Chag",
  "% 6M Chag",
  "% 7M Chag",
  "% 8M Chag",
  "% 9M Chag",
  "% 10M Chag",
  "% 11M Chag",
  "% 1Y Chag",
  "% 2Y Chag",
  "% 3Y Chag",
  "% 4Y Chag",
  "% 5Y Chag",
  "% 10Y Chag",
  "% Max Chag",
  "% Cust Date Chag",
  "% YTD Chag",
  "% 2YTD Chag",
  "% 3YTD Chag",
  "% 4YTD Chag",
  "% 5YTD Chag",
  "% 10 YTD Chag",
  "% 52W Chag",
  "% ATH&L Chag",
] as const;

export const marketSortFields = [
  ...directSortFields,
  ...percentChangeSortFields,
] as const;

export type MarketExchange = (typeof marketExchanges)[number];
export type MarketViewFilter = (typeof marketViewFilters)[number];
export type MarketHitFilter = (typeof marketHitFilters)[number];
export type MarketAthFilter = (typeof marketAthFilters)[number];
export type SortDirection = (typeof sortDirections)[number];
export type MarketSortField = (typeof marketSortFields)[number];

export interface MarketLiveQuery {
  readonly exchange: MarketExchange;
  /** Collapse dual-listed companies to one row (the "Merged" exchange input). */
  readonly merged: boolean;
  /** Keep only stocks absent from the other exchange (the "Only …" inputs). */
  readonly exclusive: boolean;
  readonly filter: MarketViewFilter;
  /**
   * Keep only stocks that made a fresh 52-week high (`high`) or low (`low`)
   * on the evaluated session — today for a live query, or the reference
   * date of a custom-date query. `all` disables the screen.
   */
  readonly hit: MarketHitFilter;
  /**
   * Keep only stocks that made a fresh all-time high (`high`) or low (`low`)
   * on the evaluated session — the session high/low touched the extreme over
   * the stock's full stored candle history. `all` disables the screen.
   */
  readonly ath: MarketAthFilter;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: MarketSortField;
  readonly order: SortDirection;
  readonly search?: string;
  readonly sectors: readonly string[];
  readonly industries: readonly string[];
  readonly marketCaps: readonly string[];
  readonly priceBands: readonly string[];
  readonly series: readonly string[];
  /** Exact trading-symbol lookup, e.g. for a caller's own curated list of stocks. */
  readonly symbols: readonly string[];
  /**
   * Keep only equity rows whose symbol is an F&O underlying — the cash-market
   * stocks that have derivatives, not the derivative contracts themselves.
   */
  readonly fnoOnly: boolean;
  /**
   * Also list exchange-traded funds. Off by default: movers, breadth and the
   * screeners are equity views; Total Market Performance turns it on.
   */
  readonly includeEtfs: boolean;
  /**
   * Keep only stocks whose last daily candles match at least one of these
   * patterns (see candle-patterns.ts); empty means no candle screen.
   */
  readonly patterns: readonly DailyCandlePatternId[];
  readonly marketCapMin?: number;
  readonly marketCapMax?: number;
  readonly priceMin?: number;
  readonly priceMax?: number;
  readonly changeMin?: number;
  readonly changeMax?: number;
  readonly volumeMin?: number;
  readonly customDate?: string;
  readonly customEndDate?: string;
  /**
   * Conditions on added technical columns, applied to the whole universe
   * before paging (see technical-filter.ts). Each column must be one the
   * server can evaluate for every stock.
   */
  readonly technicals: readonly TechnicalColumnFilter[];
  /**
   * When the sort key is an added technical column rather than a LiveQuote
   * field, the column to order by; `sort` then holds the default.
   */
  readonly technicalSort?: AddedColumnDefinition;
  /**
   * Timeframes the Candlestick / Chart Patterns summary columns are scanned
   * on (see pattern-summary.ts); empty when the page does not show them.
   * Defaults to the daily timeframe when a pattern filter is given alone.
   */
  readonly patternTimeframes: readonly string[];
  /** Keep only stocks showing any of these candlestick patterns. */
  readonly candlestickPatterns: readonly string[];
  /** Keep only stocks showing any of these chart patterns. */
  readonly chartPatterns: readonly string[];
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;
const MAX_FILTER_VALUES = 50;
const MAX_FILTER_VALUE_LENGTH = 100;
const MAX_SEARCH_LENGTH = 100;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const emptyStringToUndefined = (value: unknown): unknown =>
  value === "" || value === undefined ? undefined : value;

const optionalFiniteNumber = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().finite().optional(),
);

const splitCommaSeparated = (value: unknown): string[] => {
  if (typeof value !== "string") {
    return [];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
};

const commaSeparatedValues = z.preprocess(
  splitCommaSeparated,
  z
    .array(z.string().min(1).max(MAX_FILTER_VALUE_LENGTH))
    .max(MAX_FILTER_VALUES),
);

const technicalFilterSchema = z
  .object({
    columnId: z.string().min(1).max(200),
    operator: z.enum(TECHNICAL_FILTER_OPERATORS),
    minValue: z.number().finite().optional(),
    maxValue: z.number().finite().optional(),
  })
  .superRefine((filter, context) => {
    if (!screenableColumn(filter.columnId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["columnId"],
        message: `"${filter.columnId}" cannot be screened across the universe`,
      });
    }
  });

/**
 * `technicals` arrives as a JSON array in one query parameter; an unreadable
 * value is a caller bug and is reported rather than treated as "no filter".
 */
const technicalFilters = z.preprocess((value: unknown): unknown => {
  if (value === undefined || value === "") return [];
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}, z.array(technicalFilterSchema).max(MAX_TECHNICAL_FILTERS));

// Pattern ids are ours, not free text: an unknown one is a bug in the caller
// and is reported rather than silently screening nothing.
const dailyCandlePatternIds = z.preprocess(
  splitCommaSeparated,
  z
    .array(z.string().max(MAX_FILTER_VALUE_LENGTH))
    .max(MAX_FILTER_VALUES)
    .superRefine((values, context) => {
      for (const value of values) {
        if (!isDailyCandlePatternId(value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown candle pattern "${value}"`,
          });
        }
      }
    })
    .transform((values) => values.filter(isDailyCandlePatternId)),
);

/** A comma-separated list of known ids; an unknown id is a caller bug. */
const knownIds = (
  isKnown: (id: string) => boolean,
  kind: string,
  max: number,
) =>
  z.preprocess(
    splitCommaSeparated,
    z
      .array(z.string().max(MAX_FILTER_VALUE_LENGTH))
      .max(max)
      .superRefine((values, context) => {
        for (const value of values) {
          if (!isKnown(value)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Unknown ${kind} "${value}"`,
            });
          }
        }
      }),
  );

const optionalIsoDate = z
  .preprocess(
    emptyStringToUndefined,
    z
      .string()
      .regex(ISO_DATE_PATTERN, "Expected an ISO date in YYYY-MM-DD format")
      .optional(),
  )
  .refine(
    (value) => value === undefined || isCalendarDate(value),
    "Expected a real calendar date",
  );

type ExchangeInput = (typeof acceptedExchangeInputs)[number];

const toMarketExchange = (value: ExchangeInput): MarketExchange =>
  value === "Merged" ? "Both" : (value.replace("Only ", "") as MarketExchange);

const marketExchangeInputSchema = z
  .enum(acceptedExchangeInputs)
  .transform(toMarketExchange);

const marketLiveQuerySchema = z
  .object({
    exchange: z.enum(acceptedExchangeInputs).default("NSE"),
    filter: z.enum(marketViewFilters).default("all"),
    hit: z.enum(marketHitFilters).default("all"),
    ath: z.enum(marketAthFilters).default("all"),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .default(DEFAULT_PAGE_SIZE),
    sort: z.string().trim().max(200).default("pctChange"),
    order: z.enum(sortDirections).default("desc"),
    search: z
      .string()
      .trim()
      .max(MAX_SEARCH_LENGTH)
      .optional()
      .transform((value) => value || undefined),
    sectors: commaSeparatedValues,
    industries: commaSeparatedValues,
    marketCaps: commaSeparatedValues,
    priceBands: commaSeparatedValues,
    series: commaSeparatedValues,
    symbols: commaSeparatedValues,
    fnoOnly: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    etfs: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    patterns: dailyCandlePatternIds,
    marketCapMin: optionalFiniteNumber.refine(
      (value) => value === undefined || value >= 0,
      "Market-cap minimum must be zero or greater",
    ),
    marketCapMax: optionalFiniteNumber.refine(
      (value) => value === undefined || value >= 0,
      "Market-cap maximum must be zero or greater",
    ),
    priceMin: optionalFiniteNumber,
    priceMax: optionalFiniteNumber,
    changeMin: optionalFiniteNumber,
    changeMax: optionalFiniteNumber,
    volumeMin: optionalFiniteNumber.refine(
      (value) => value === undefined || value >= 0,
      "Minimum volume must be zero or greater",
    ),
    customDate: optionalIsoDate,
    customEndDate: optionalIsoDate,
    technicals: technicalFilters,
    patternTimeframes: knownIds(
      isPatternSummaryTimeframe,
      "pattern timeframe",
      MAX_PATTERN_TIMEFRAMES,
    ),
    candlestickPatterns: knownIds(
      isCandlestickSummaryId,
      "candlestick pattern",
      MAX_FILTER_VALUES,
    ),
    chartPatterns: knownIds(
      isChartPatternSummaryId,
      "chart pattern",
      MAX_FILTER_VALUES,
    ),
  })
  .superRefine((query, context) => {
    validateRange(
      query.marketCapMin,
      query.marketCapMax,
      "marketCapMin",
      context,
    );
    validateRange(query.priceMin, query.priceMax, "priceMin", context);
    validateRange(query.changeMin, query.changeMax, "changeMin", context);

    if (query.customEndDate && !query.customDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customEndDate"],
        message: "A start date is required when an end date is supplied",
      });
    }

    if (
      query.customDate &&
      query.customEndDate &&
      query.customEndDate < query.customDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customEndDate"],
        message: "The end date must not be earlier than the start date",
      });
    }
  })
  .superRefine((query, context) => {
    if (!isMarketSortField(query.sort) && !screenableColumn(query.sort)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sort"],
        message: `"${query.sort}" is not a sortable column`,
      });
    }
  })
  .transform((query): MarketLiveQuery => {
    const technicalSort = isMarketSortField(query.sort)
      ? undefined
      : (screenableColumn(query.sort) ?? undefined);
    return {
      ...query,
      sort: isMarketSortField(query.sort) ? query.sort : "pctChange",
      technicalSort,
      exchange: toMarketExchange(query.exchange),
      merged: query.exchange === "Merged",
      exclusive: query.exchange.startsWith("Only "),
      includeEtfs: query.etfs,
      patternTimeframes:
        query.patternTimeframes.length === 0 &&
        (query.candlestickPatterns.length > 0 || query.chartPatterns.length > 0)
          ? [DEFAULT_PATTERN_TIMEFRAME]
          : query.patternTimeframes,
    };
  });

function isMarketSortField(value: string): value is MarketSortField {
  return (marketSortFields as readonly string[]).includes(value);
}

/** The column behind an added-column id, if the server can screen on it. */
function screenableColumn(id: string): AddedColumnDefinition | null {
  const column = parseAddedColumnId(id);
  return column && isUniverseScreenableColumn(column) ? column : null;
}

export function parseMarketLiveQuery(
  searchParams: URLSearchParams,
): MarketLiveQuery {
  const result = marketLiveQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!result.success) {
    throw new ValidationError(
      "Invalid market query parameters",
      formatValidationErrors(result.error),
    );
  }
  return result.data;
}

export function parseMarketExchange(
  rawExchange: string | null,
): MarketExchange {
  const result = marketExchangeInputSchema.safeParse(rawExchange ?? "NSE");
  if (!result.success) {
    throw new ValidationError(
      "Invalid exchange parameter",
      formatValidationErrors(result.error),
    );
  }
  return result.data;
}

export function createMarketLiveCacheKey(query: MarketLiveQuery): string {
  return JSON.stringify(query);
}

export function isPercentChangeSortField(sort: MarketSortField): boolean {
  return (percentChangeSortFields as readonly string[]).includes(sort);
}

function isCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function validateRange(
  minimum: number | undefined,
  maximum: number | undefined,
  minimumField: string,
  context: z.RefinementCtx,
): void {
  if (minimum === undefined || maximum === undefined || minimum <= maximum) {
    return;
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: [minimumField],
    message: "The minimum must not exceed the maximum",
  });
}

function formatValidationErrors(error: z.ZodError): ErrorDetails {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "query";
    (details[field] ??= []).push(issue.message);
  }
  return details;
}

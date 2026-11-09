import { z } from "zod";
import { ValidationError, type ErrorDetails } from "@/lib/errors";
import {
  parseMarketLiveQuery,
  type MarketLiveQuery,
} from "@/lib/market/live-query";

// The same universe scopes /api/market/live understands, so the Historical
// Data page reads the exact rows the market table shows for that scope.
export const historicalExchangeInputs = [
  "NSE",
  "BSE",
  "Both",
  "Merged",
  "Only NSE",
  "Only BSE",
] as const;

export const historicalPeriods = [
  "10d",
  "1m",
  "3m",
  "6m",
  "1y",
  "3y",
  "5y",
] as const;

export const historicalSortFields = [
  "date",
  "company",
  "preClose",
  "open",
  "high",
  "low",
  "close",
  "netChange",
  "pctChange",
  "volume",
] as const;

export type HistoricalExchangeInput = (typeof historicalExchangeInputs)[number];
export type HistoricalPeriod = (typeof historicalPeriods)[number];
export type HistoricalSortField = (typeof historicalSortFields)[number];

export interface HistoricalDataQuery {
  /** Universe scope, already resolved the way /api/market/live resolves it. */
  readonly universe: MarketLiveQuery;
  /** Preset window; null when an explicit `from` date was supplied. */
  readonly period: HistoricalPeriod | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: HistoricalSortField;
  readonly order: "asc" | "desc";
}

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;
const MAX_FILTER_VALUES = 50;
const MAX_FILTER_VALUE_LENGTH = 100;
const MAX_SEARCH_LENGTH = 100;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const emptyStringToUndefined = (value: unknown): unknown =>
  value === "" || value === undefined ? undefined : value;

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

// Sent as repeated params (sectors=a&sectors=b) rather than comma-joined:
// NSE sector names such as "Agricultural, Commercial & Construction Vehicles"
// contain commas themselves.
const filterValues = z
  .array(z.string().trim().min(1).max(MAX_FILTER_VALUE_LENGTH))
  .max(MAX_FILTER_VALUES)
  .transform((values) => [...new Set(values)]);

const historicalDataQuerySchema = z
  .object({
    exchange: z.enum(historicalExchangeInputs).default("NSE"),
    fnoOnly: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    search: z
      .string()
      .trim()
      .max(MAX_SEARCH_LENGTH)
      .optional()
      .transform((value) => value || undefined),
    // Exact trading symbols (comma-joined) for the stock-first picker flow.
    // Unlike `search` this is an exact match, so picking RELIANCE never
    // pulls in every other Reliance-group company.
    symbols: z
      .string()
      .trim()
      .max(MAX_SEARCH_LENGTH)
      .optional()
      .transform((value) =>
        value
          ? [
              ...new Set(
                value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              ),
            ]
          : [],
      ),
    sectors: filterValues,
    industries: filterValues,
    period: z.preprocess(
      emptyStringToUndefined,
      z.enum(historicalPeriods).optional(),
    ),
    from: optionalIsoDate,
    to: optionalIsoDate,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .default(DEFAULT_PAGE_SIZE),
    sort: z.enum(historicalSortFields).default("date"),
    order: z.enum(["asc", "desc"]).default("desc"),
  })
  .superRefine((query, context) => {
    if (query.to && !query.from) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "A start date is required when an end date is supplied",
      });
    }
    if (query.from && query.to && query.to < query.from) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "The end date must not be earlier than the start date",
      });
    }
    if (query.from && query.period) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["period"],
        message: "Supply either a period or a date range, not both",
      });
    }
  });

export function parseHistoricalDataQuery(
  searchParams: URLSearchParams,
): HistoricalDataQuery {
  const result = historicalDataQuerySchema.safeParse({
    ...Object.fromEntries(searchParams.entries()),
    sectors: searchParams.getAll("sectors"),
    industries: searchParams.getAll("industries"),
  });
  if (!result.success) {
    throw new ValidationError(
      "Invalid historical data query parameters",
      formatValidationErrors(result.error),
    );
  }

  const query = result.data;
  const universe: MarketLiveQuery = {
    // Re-uses the live query's exchange resolution (Merged / Only NSE ...),
    // search trimming and fnoOnly handling; the array filters are supplied
    // separately because their parser is comma-delimited.
    ...parseMarketLiveQuery(
      new URLSearchParams({
        exchange: query.exchange,
        fnoOnly: String(query.fnoOnly),
        ...(query.search ? { search: query.search } : {}),
        ...(query.symbols.length ? { symbols: query.symbols.join(",") } : {}),
      }),
    ),
    sectors: query.sectors,
    industries: query.industries,
  };

  return {
    universe,
    period: query.from ? null : (query.period ?? "10d"),
    from: query.from ?? null,
    to: query.to ?? null,
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    order: query.order,
  };
}

export function createHistoricalDataCacheKey(
  query: HistoricalDataQuery,
): string {
  return JSON.stringify(query);
}

function isCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function formatValidationErrors(error: z.ZodError): ErrorDetails {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "query";
    (details[field] ??= []).push(issue.message);
  }
  return details;
}

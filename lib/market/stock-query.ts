import { ValidationError } from "@/lib/errors";
import { parseMarketExchange, type MarketExchange } from "./live-query";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;

export interface StockMoversQuery {
  readonly exchange: MarketExchange;
  readonly page: number;
  readonly pageSize: number;
}

export function parseStockMoversQuery(
  searchParams: URLSearchParams,
): StockMoversQuery {
  return {
    exchange: parseMarketExchange(searchParams.get("exchange")),
    page: parsePositiveInteger(
      searchParams.get("page"),
      "page",
      DEFAULT_PAGE,
      undefined,
    ),
    pageSize: parsePositiveInteger(
      searchParams.get("pageSize"),
      "pageSize",
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    ),
  };
}

function parsePositiveInteger(
  rawValue: string | null,
  fieldName: string,
  defaultValue: number,
  maximum: number | undefined,
): number {
  if (rawValue === null || rawValue.trim() === "") {
    return defaultValue;
  }

  const normalizedValue = rawValue.trim();
  if (!/^\d+$/.test(normalizedValue)) {
    throw new ValidationError(`Invalid ${fieldName} parameter`, {
      [fieldName]: ["Expected a positive whole number"],
    });
  }

  const parsedValue = Number(normalizedValue);
  if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
    throw new ValidationError(`Invalid ${fieldName} parameter`, {
      [fieldName]: ["Expected a positive whole number"],
    });
  }

  if (maximum !== undefined && parsedValue > maximum) {
    throw new ValidationError(`Invalid ${fieldName} parameter`, {
      [fieldName]: [`Must not exceed ${maximum}`],
    });
  }

  return parsedValue;
}

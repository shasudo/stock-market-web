import { unwrapApiEnvelope } from "@/lib/api-envelope";
import {
  getMarketApiErrorMessage,
  INVALID_MARKET_RESPONSE_MESSAGE,
  isMarketLiveResponse,
  type MarketLiveResponse,
  type MarketStockData,
} from "./client-contract";

export type LiveMarketExchange =
  "NSE" | "BSE" | "Both" | "Merged" | "Only NSE" | "Only BSE";
export type LiveMarketFilter = "all" | "gainers" | "losers" | "unchanged";
export type LiveMarketSort =
  | "pctChange"
  | "netChange"
  | "volume"
  | "name"
  | "lastPrice"
  | "prevClose"
  | "marketCap";
export type LiveMarketSortDirection = "asc" | "desc";

export interface LiveMarketRequest {
  readonly exchange: LiveMarketExchange;
  readonly filter: LiveMarketFilter;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: LiveMarketSort;
  readonly order: LiveMarketSortDirection;
  readonly search?: string;
  readonly priceBands?: readonly string[];
  /** Keep only F&O-underlying cash-market stocks. */
  readonly fnoOnly?: boolean;
}

const LIVE_MARKET_ENDPOINT = "/api/market/live";
export const LIVE_MARKET_UNAVAILABLE_MESSAGE =
  "Live market data is temporarily unavailable. Please try again shortly.";

export class LiveMarketClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LiveMarketClientError";
  }
}

export async function fetchLiveMarketData(
  request: LiveMarketRequest,
  signal?: AbortSignal,
): Promise<MarketLiveResponse> {
  const response = await fetch(createLiveMarketUrl(request), {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new LiveMarketClientError(
      getMarketApiErrorMessage(body, LIVE_MARKET_UNAVAILABLE_MESSAGE),
    );
  }

  if (!isMarketLiveResponse(body)) {
    throw new LiveMarketClientError(INVALID_MARKET_RESPONSE_MESSAGE);
  }

  return body;
}

const ALL_STOCKS_PAGE_SIZE = 500;
const ALL_STOCKS_PAGE_CONCURRENCY = 3;
const ALL_STOCKS_MAX_PAGES = 20;

export interface FetchAllLiveMarketStocksRequest {
  readonly exchange: LiveMarketExchange;
  readonly filter?: LiveMarketFilter;
  readonly sort?: LiveMarketSort;
  readonly order?: LiveMarketSortDirection;
  readonly fnoOnly?: boolean;
}

/**
 * Walks every page of /api/market/live for a request (mirrors the
 * page-batching this app already does in ScreenerPage's fetchAllMoverStocks,
 * just against the typed client instead of raw apiClient).
 */
export async function fetchAllLiveMarketStocks(
  request: FetchAllLiveMarketStocksRequest,
  signal?: AbortSignal,
): Promise<readonly MarketStockData[]> {
  const base: LiveMarketRequest = {
    exchange: request.exchange,
    filter: request.filter ?? "all",
    page: 1,
    pageSize: ALL_STOCKS_PAGE_SIZE,
    sort: request.sort ?? "name",
    order: request.order ?? "asc",
    ...(request.fnoOnly ? { fnoOnly: true } : {}),
  };

  const firstPage = await fetchLiveMarketData(base, signal);
  const stocks = [...firstPage.stocks];
  const totalPages = firstPage.pagination.totalPages;

  if (totalPages > ALL_STOCKS_MAX_PAGES) {
    throw new LiveMarketClientError(
      "Too many stocks were returned to load safely. Narrow the request and try again.",
    );
  }

  const remainingPageNumbers = Array.from(
    { length: Math.max(0, totalPages - 1) },
    (_, index) => index + 2,
  );

  for (
    let startingIndex = 0;
    startingIndex < remainingPageNumbers.length;
    startingIndex += ALL_STOCKS_PAGE_CONCURRENCY
  ) {
    const pageNumbers = remainingPageNumbers.slice(
      startingIndex,
      startingIndex + ALL_STOCKS_PAGE_CONCURRENCY,
    );
    const pageResponses = await Promise.all(
      pageNumbers.map((page) => fetchLiveMarketData({ ...base, page }, signal)),
    );

    for (const pageResponse of pageResponses) {
      stocks.push(...pageResponse.stocks);
    }
  }

  return stocks;
}

export function getLiveMarketClientErrorMessage(error: unknown): string {
  return error instanceof LiveMarketClientError
    ? error.message
    : LIVE_MARKET_UNAVAILABLE_MESSAGE;
}

export function isLiveMarketRequestAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function createLiveMarketUrl(request: LiveMarketRequest): string {
  const parameters = new URLSearchParams({
    exchange: request.exchange,
    filter: request.filter,
    page: String(request.page),
    pageSize: String(request.pageSize),
    sort: request.sort,
    order: request.order,
  });

  const search = request.search?.trim();
  if (search) {
    parameters.set("search", search);
  }

  if (request.priceBands && request.priceBands.length > 0) {
    parameters.set("priceBands", request.priceBands.join(","));
  }

  if (request.fnoOnly) {
    parameters.set("fnoOnly", "true");
  }

  return `${LIVE_MARKET_ENDPOINT}?${parameters.toString()}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return unwrapApiEnvelope(await response.json());
  } catch {
    throw new LiveMarketClientError(
      response.ok
        ? INVALID_MARKET_RESPONSE_MESSAGE
        : LIVE_MARKET_UNAVAILABLE_MESSAGE,
    );
  }
}

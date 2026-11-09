import { unwrapApiEnvelope } from "@/lib/api-envelope";
/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export interface HistoricalDataWindow {
  /** First calendar day of the window; null for a "last N sessions" preset. */
  readonly from: string | null;
  readonly to: string;
  /** Sessions per stock for a "last N sessions" preset, otherwise null. */
  readonly sessions: number | null;
}

export interface HistoricalDataRowDTO {
  readonly date: string;
  /** Dhan security id; with `exchange` it identifies the listing (a symbol can carry several series on one exchange). */
  readonly securityId: number;
  readonly exchange: string;
  readonly tradingSymbol: string;
  readonly companyName: string;
  readonly preClose: number | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly close: number;
  readonly netChange: number | null;
  readonly percentChange: number | null;
  readonly volume: number | null;
}

export interface HistoricalDataResponse {
  readonly rows: readonly HistoricalDataRowDTO[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalRows: number;
    readonly totalPages: number;
  };
  readonly window: HistoricalDataWindow;
  /** Stocks in the universe that have at least one candle in the window. */
  readonly stockCount: number;
}

import type {
  HistoricalExchangeInput,
  HistoricalPeriod,
  HistoricalSortField,
} from "./historical-data-query";
export type {
  HistoricalExchangeInput,
  HistoricalPeriod,
  HistoricalSortField,
} from "./historical-data-query";

export interface HistoricalDataRequest {
  readonly exchange: HistoricalExchangeInput;
  readonly fnoOnly: boolean;
  readonly sectors: readonly string[];
  readonly industries: readonly string[];
  readonly search?: string;
  /** Exact trading symbols; when set, the universe is only these listings. */
  readonly symbols?: readonly string[];
  /** Ignored when `from` is set. */
  readonly period: HistoricalPeriod;
  readonly from?: string;
  readonly to?: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: HistoricalSortField;
  readonly order: "asc" | "desc";
}

const HISTORICAL_DATA_ENDPOINT = "/api/market-data/historical";
export const HISTORICAL_DATA_UNAVAILABLE_MESSAGE =
  "Historical data is temporarily unavailable. Please try again shortly.";

export class HistoricalDataClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "HistoricalDataClientError";
  }
}

export async function fetchHistoricalData(
  request: HistoricalDataRequest,
  signal?: AbortSignal,
): Promise<HistoricalDataResponse> {
  const response = await fetch(createHistoricalDataUrl(request), {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));

  if (!response.ok) {
    throw new HistoricalDataClientError(getErrorMessage(body));
  }
  if (!isHistoricalDataResponse(body)) {
    throw new HistoricalDataClientError(HISTORICAL_DATA_UNAVAILABLE_MESSAGE);
  }

  return body;
}

export function createHistoricalDataUrl(
  request: HistoricalDataRequest,
): string {
  const parameters = new URLSearchParams({
    exchange: request.exchange,
    fnoOnly: String(request.fnoOnly),
    page: String(request.page),
    pageSize: String(request.pageSize),
    sort: request.sort,
    order: request.order,
  });

  if (request.from) {
    parameters.set("from", request.from);
    if (request.to) parameters.set("to", request.to);
  } else {
    parameters.set("period", request.period);
  }

  const search = request.search?.trim();
  if (search) parameters.set("search", search);
  if (request.symbols?.length) {
    parameters.set("symbols", request.symbols.join(","));
  }

  // Repeated params: NSE sector names can contain commas.
  for (const sector of request.sectors) parameters.append("sectors", sector);
  for (const industry of request.industries) {
    parameters.append("industries", industry);
  }

  return `${HISTORICAL_DATA_ENDPOINT}?${parameters.toString()}`;
}

export function getHistoricalDataClientErrorMessage(error: unknown): string {
  return error instanceof HistoricalDataClientError
    ? error.message
    : HISTORICAL_DATA_UNAVAILABLE_MESSAGE;
}

export function isHistoricalDataRequestAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function getErrorMessage(body: unknown): string {
  if (
    isRecord(body) &&
    typeof body.message === "string" &&
    body.message.trim()
  ) {
    return body.message;
  }
  return HISTORICAL_DATA_UNAVAILABLE_MESSAGE;
}

function isHistoricalDataResponse(
  value: unknown,
): value is HistoricalDataResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.rows) &&
    isRecord(value.pagination) &&
    typeof value.pagination.totalRows === "number" &&
    typeof value.pagination.totalPages === "number" &&
    isRecord(value.window) &&
    typeof value.window.to === "string" &&
    typeof value.stockCount === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export interface InstrumentQuoteDTO {
  readonly securityId: number;
  readonly exchange: string;
  readonly tradingSymbol: string;
  readonly displayName: string;
  readonly lastPrice: number;
  readonly prevClose: number;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly netChange: number;
  readonly pctChange: number;
  /**
   * Stored-history columns for the index tables (previous session, 1W/1M/1Y
   * closes and trailing 52-week extremes). Null when the index has no
   * usable stored history yet — the table shows "-" instead of a fake value.
   */
  readonly prevDay: number | null;
  readonly oneWeekAgo: number | null;
  readonly oneMonthAgo: number | null;
  readonly oneYearAgo: number | null;
  readonly fiftyTwoWeekHigh: number | null;
  readonly fiftyTwoWeekLow: number | null;
}

export type IndexQuoteDTO = InstrumentQuoteDTO;

export type EtfQuoteDTO = InstrumentQuoteDTO;

export type TickerQuoteDTO = InstrumentQuoteDTO;

export interface IndexQuotesResponse {
  readonly indices: readonly IndexQuoteDTO[];
  readonly lastSyncAt: string | null;
}

export interface EtfQuotesResponse {
  readonly etfs: readonly EtfQuoteDTO[];
  readonly lastSyncAt: string | null;
}

export interface TickerQuotesResponse {
  readonly ticker: readonly TickerQuoteDTO[];
  readonly lastSyncAt: string | null;
}

const INDICES_ENDPOINT = "/api/market-data/indices";
const ETFS_ENDPOINT = "/api/market-data/etfs";
const TICKER_ENDPOINT = "/api/market-data/ticker";
export const INDEX_QUOTES_UNAVAILABLE_MESSAGE =
  "Index data is temporarily unavailable. Please try again shortly.";
export const ETF_QUOTES_UNAVAILABLE_MESSAGE =
  "ETF data is temporarily unavailable. Please try again shortly.";
export const TICKER_QUOTES_UNAVAILABLE_MESSAGE =
  "Ticker data is temporarily unavailable. Please try again shortly.";

export class IndexQuoteClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "IndexQuoteClientError";
  }
}

export async function fetchIndexQuoteSnapshot(
  signal?: AbortSignal,
): Promise<IndexQuotesResponse> {
  const response = await fetch(INDICES_ENDPOINT, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new IndexQuoteClientError(
      getErrorMessage(body, INDEX_QUOTES_UNAVAILABLE_MESSAGE),
    );
  }
  if (!isIndexQuotesResponse(body)) {
    throw new IndexQuoteClientError(INDEX_QUOTES_UNAVAILABLE_MESSAGE);
  }

  return body;
}

export function getIndexQuoteClientErrorMessage(error: unknown): string {
  return error instanceof IndexQuoteClientError
    ? error.message
    : INDEX_QUOTES_UNAVAILABLE_MESSAGE;
}

export function isIndexQuoteRequestAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function fetchEtfQuoteSnapshot(
  signal?: AbortSignal,
): Promise<EtfQuotesResponse> {
  const response = await fetch(ETFS_ENDPOINT, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new IndexQuoteClientError(getErrorMessage(body, ETF_QUOTES_UNAVAILABLE_MESSAGE));
  }
  if (!isEtfQuotesResponse(body)) {
    throw new IndexQuoteClientError(ETF_QUOTES_UNAVAILABLE_MESSAGE);
  }

  return body;
}

function isEtfQuotesResponse(value: unknown): value is EtfQuotesResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.etfs) &&
    value.etfs.every(isIndexQuoteDTO) &&
    (value.lastSyncAt === null || typeof value.lastSyncAt === "string")
  );
}

export async function fetchTickerQuoteSnapshot(
  signal?: AbortSignal,
): Promise<TickerQuotesResponse> {
  const response = await fetch(TICKER_ENDPOINT, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new IndexQuoteClientError(
      getErrorMessage(body, TICKER_QUOTES_UNAVAILABLE_MESSAGE),
    );
  }
  if (!isTickerQuotesResponse(body)) {
    throw new IndexQuoteClientError(TICKER_QUOTES_UNAVAILABLE_MESSAGE);
  }

  return body;
}

function isTickerQuotesResponse(
  value: unknown,
): value is TickerQuotesResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.ticker) &&
    value.ticker.every(isIndexQuoteDTO) &&
    (value.lastSyncAt === null || typeof value.lastSyncAt === "string")
  );
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (isRecord(body) && typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }
  return fallback;
}

function isIndexQuotesResponse(value: unknown): value is IndexQuotesResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.indices) &&
    value.indices.every(isIndexQuoteDTO) &&
    (value.lastSyncAt === null || typeof value.lastSyncAt === "string")
  );
}

export function isIndexQuoteDTO(value: unknown): value is IndexQuoteDTO {
  return (
    isRecord(value) &&
    typeof value.securityId === "number" &&
    typeof value.exchange === "string" &&
    typeof value.tradingSymbol === "string" &&
    typeof value.displayName === "string" &&
    typeof value.lastPrice === "number" &&
    typeof value.prevClose === "number" &&
    typeof value.netChange === "number" &&
    typeof value.pctChange === "number" &&
    isNullableNumber(value.prevDay) &&
    isNullableNumber(value.oneWeekAgo) &&
    isNullableNumber(value.oneMonthAgo) &&
    isNullableNumber(value.oneYearAgo) &&
    isNullableNumber(value.fiftyTwoWeekHigh) &&
    isNullableNumber(value.fiftyTwoWeekLow)
  );
}

function isNullableNumber(value: unknown): value is number | null {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

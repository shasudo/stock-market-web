/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export interface DealView {
  readonly investorId: string;
  readonly investorName: string;
  readonly category: SuperInvestorCategory | null;
  readonly dealType: "bulk" | "block";
  readonly symbol: string;
  readonly companyName: string;
  readonly dealDate: string;
  readonly clientName: string;
  readonly transactionType: "BUY" | "SELL";
  readonly quantity: number;
  readonly price: number;
  readonly lastPrice: number | null;
  readonly dayChangePct: number | null;
}

export const SUPER_INVESTOR_SOURCE = {
  name: "NSE & BSE shareholding-pattern filings (SEBI LODR Reg. 31 XBRL)",
  url: "https://www.nseindia.com/companies-listing/corporate-filings-shareholding-pattern",
} as const;

export interface InvestorHistoryResponse {
  readonly id: string;
  readonly name: string;
  readonly history: StakeHistory;
}
const MAX_DEAL_SCAN_PAGES = 20;

interface CachedSnapshot {
  readonly snapshot: SuperInvestorSnapshot;
  readonly loadedAt: number;
  readonly version: number;
}

interface CachedQuotes {
  readonly quotes: QuoteLookup;
  readonly syncedAt: Date | null;
  readonly loadedAt: number;
}

export interface SuperInvestorMeta {
  readonly source: typeof SUPER_INVESTOR_SOURCE;
  readonly latestAsOfDate: string | null;
  readonly latestFiledAt: string | null;
  readonly companyCount: number;
  readonly snapshotBuiltAt: string | null;
  readonly quotesSyncedAt: string | null;
}

import type {
  ChangeSortKey,
  CommonSortKey,
  InvestorSortKey,
  SortState,
} from "./sorting";
import type {
  CommonStockView,
  InvestorDetail,
  InvestorSummary,
  KeyChangeView,
} from "./aggregate";
import type { SuperInvestorCategory } from "./classify";
export type {
  CommonStockView,
  InvestorDetail,
  InvestorSummary,
  KeyChangeView,
};
export type { InvestorHoldingView, HoldingChange } from "./aggregate";
export type {
  StakeHistory,
  StakeHistoryRow,
  StakeHistoryCell,
  StakeHistoryQuarter,
} from "./history";
import type { QuoteLookup, SuperInvestorSnapshot } from "./aggregate";
import type { StakeHistory } from "./history";

export const SUPER_INVESTORS_UNAVAILABLE_MESSAGE =
  "Super-investor data is temporarily unavailable. Please try again shortly.";

/** LiveQuote is rewritten once a minute; polling faster than this buys nothing. */
export const SUPER_INVESTORS_POLL_MS = 15_000;

const BASE = "/api/market-data/super-investors";

export class SuperInvestorClientError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SuperInvestorClientError";
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      body !== null &&
      typeof body === "object" &&
      typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : SUPER_INVESTORS_UNAVAILABLE_MESSAGE;
    throw new SuperInvestorClientError(message, response.status);
  }
  if (body === null || typeof body !== "object" || !("meta" in body)) {
    throw new SuperInvestorClientError(
      SUPER_INVESTORS_UNAVAILABLE_MESSAGE,
      response.status,
    );
  }
  return body as T;
}

export interface InvestorListResponse {
  readonly meta: SuperInvestorMeta;
  readonly investors: readonly InvestorSummary[];
  readonly total: number;
}

function withSort(query: URLSearchParams, sort: SortState<string> | null | undefined): URLSearchParams {
  if (sort) {
    query.set("sort", sort.key);
    query.set("order", sort.dir);
  }
  return query;
}

export function fetchSuperInvestors(
  params: {
    category: SuperInvestorCategory;
    search?: string;
    limit?: number;
    sort?: SortState<InvestorSortKey> | null;
  },
  signal?: AbortSignal,
): Promise<InvestorListResponse> {
  const query = withSort(new URLSearchParams({ category: params.category }), params.sort);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.limit) query.set("limit", String(params.limit));
  return getJson(`${BASE}?${query.toString()}`, signal);
}

export interface InvestorDetailResponse {
  readonly meta: SuperInvestorMeta;
  readonly investor: InvestorDetail;
  readonly deals: readonly DealView[];
}

export function fetchSuperInvestor(
  id: string,
  signal?: AbortSignal,
): Promise<InvestorDetailResponse> {
  return getJson(`${BASE}/${encodeURIComponent(id)}`, signal);
}

/** History changes once a quarter; it is fetched once per open, not polled. */
export async function fetchSuperInvestorHistory(
  id: string,
  signal?: AbortSignal,
): Promise<InvestorHistoryResponse> {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/history`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (
    !response.ok ||
    body === null ||
    typeof body !== "object" ||
    !("history" in body)
  ) {
    throw new SuperInvestorClientError(
      body !== null &&
        typeof body === "object" &&
        typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : SUPER_INVESTORS_UNAVAILABLE_MESSAGE,
      response.status,
    );
  }
  return body as InvestorHistoryResponse;
}

export function fetchSuperInvestorChanges(
  category: SuperInvestorCategory,
  signal?: AbortSignal,
  sort?: SortState<ChangeSortKey> | null,
): Promise<{ meta: SuperInvestorMeta; changes: readonly KeyChangeView[] }> {
  const query = withSort(new URLSearchParams({ category }), sort);
  return getJson(`${BASE}/changes?${query.toString()}`, signal);
}

export function fetchSuperInvestorCommonStocks(
  category: SuperInvestorCategory,
  signal?: AbortSignal,
  sort?: SortState<CommonSortKey> | null,
): Promise<{ meta: SuperInvestorMeta; stocks: readonly CommonStockView[] }> {
  const query = withSort(new URLSearchParams({ category }), sort);
  return getJson(`${BASE}/common?${query.toString()}`, signal);
}

export function fetchSuperInvestorDeals(signal?: AbortSignal): Promise<{
  meta: SuperInvestorMeta;
  deals: readonly DealView[];
  trackedSince: string | null;
}> {
  return getJson(`${BASE}/deals`, signal);
}

export function getSuperInvestorErrorMessage(error: unknown): string {
  return error instanceof SuperInvestorClientError
    ? error.message
    : SUPER_INVESTORS_UNAVAILABLE_MESSAGE;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

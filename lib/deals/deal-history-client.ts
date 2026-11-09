"use client";

import { unwrapApiEnvelope } from "@/lib/api-envelope";

/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export type DealHistoryType = "bulk" | "block" | "all";

export interface DealHistoryItem {
  readonly symbol: string;
  readonly companyName: string;
  readonly dealDate: string;
  readonly clientName: string;
  readonly transactionType: "BUY" | "SELL";
  readonly quantity: number;
  readonly price: number;
  readonly dealType: "bulk" | "block";
}

export interface DealHistoryPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly totalDeals: number;
  readonly totalPages: number;
}

export interface DealHistoryResponse {
  readonly deals: readonly DealHistoryItem[];
  readonly pagination: DealHistoryPagination;
  readonly lastSyncAt: string | null;
}




export const DEAL_HISTORY_UNAVAILABLE_MESSAGE =
  "Deal history is temporarily unavailable. Please try again shortly.";

export class DealHistoryClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DealHistoryClientError";
  }
}

export interface DealHistoryParams {
  readonly dealType: DealHistoryType;
  readonly page: number;
  readonly pageSize?: number;
  readonly search?: string;
  readonly from?: string;
  readonly to?: string;
  readonly sort?: string;
}

export async function fetchDealHistory(
  params: DealHistoryParams,
  signal?: AbortSignal,
): Promise<DealHistoryResponse> {
  const query = new URLSearchParams({
    dealType: params.dealType,
    page: String(params.page),
  });
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.search) query.set("search", params.search);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.sort) query.set("sort", params.sort);

  const response = await fetch(
    `/api/market-data/deals/history?${query.toString()}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    },
  );
  const body: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));
  if (!response.ok) {
    throw new DealHistoryClientError(getErrorMessage(body));
  }
  if (!isDealHistoryResponse(body)) {
    throw new DealHistoryClientError(DEAL_HISTORY_UNAVAILABLE_MESSAGE);
  }
  return body;
}

export function getDealHistoryClientErrorMessage(error: unknown): string {
  return error instanceof DealHistoryClientError
    ? error.message
    : DEAL_HISTORY_UNAVAILABLE_MESSAGE;
}

export function isDealHistoryRequestAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function getErrorMessage(body: unknown): string {
  if (
    body !== null &&
    typeof body === "object" &&
    "message" in body &&
    typeof (body as Record<string, unknown>).message === "string" &&
    ((body as Record<string, unknown>).message as string).trim()
  ) {
    return ((body as Record<string, unknown>).message as string).trim();
  }
  return DEAL_HISTORY_UNAVAILABLE_MESSAGE;
}

function isDealHistoryResponse(value: unknown): value is DealHistoryResponse {
  return (
    value !== null &&
    typeof value === "object" &&
    Array.isArray((value as Record<string, unknown>).deals) &&
    typeof (value as Record<string, unknown>).pagination === "object"
  );
}

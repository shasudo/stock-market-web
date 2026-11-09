"use client";

/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export interface FiiDiiDailyDTO {
  readonly tradeDate: string;
  readonly source: FiiDiiSource;
  readonly fiiBuy: number;
  readonly fiiSell: number;
  readonly fiiNet: number;
  readonly diiBuy: number;
  readonly diiSell: number;
  readonly diiNet: number;
}

export interface FiiDiiMonthlyDTO {
  readonly month: string;
  readonly year: number;
  readonly tradingDays: number;
  readonly fiiBuy: number;
  readonly fiiSell: number;
  readonly fiiNet: number;
  readonly diiBuy: number;
  readonly diiSell: number;
  readonly diiNet: number;
}

export interface FiiDiiResponse {
  readonly daily: readonly FiiDiiDailyDTO[];
  readonly monthly: readonly FiiDiiMonthlyDTO[];
  readonly lastSyncAt: string | null;
  readonly sources: readonly FiiDiiSource[];
}


import type { FiiDiiSource } from "@/lib/fii-dii/nse-client";

export const FII_DII_UNAVAILABLE_MESSAGE =
  "FII/DII data is temporarily unavailable. Please try again shortly.";

export class FiiDiiClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "FiiDiiClientError";
  }
}

export async function fetchFiiDii(
  source: FiiDiiSource,
  signal?: AbortSignal,
): Promise<FiiDiiResponse> {
  const response = await fetch(
    `/api/market-data/fii-dii?source=${source}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    },
  );
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new FiiDiiClientError(getErrorMessage(body));
  }
  if (!isFiiDiiResponse(body)) {
    throw new FiiDiiClientError(FII_DII_UNAVAILABLE_MESSAGE);
  }
  return body;
}

export function getFiiDiiClientErrorMessage(error: unknown): string {
  return error instanceof FiiDiiClientError
    ? error.message
    : FII_DII_UNAVAILABLE_MESSAGE;
}

export function isFiiDiiRequestAborted(error: unknown): boolean {
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
  return FII_DII_UNAVAILABLE_MESSAGE;
}

function isFiiDiiResponse(value: unknown): value is FiiDiiResponse {
  return (
    value !== null &&
    typeof value === "object" &&
    Array.isArray((value as Record<string, unknown>).daily) &&
    Array.isArray((value as Record<string, unknown>).monthly)
  );
}

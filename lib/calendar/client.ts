"use client";

import { unwrapApiEnvelope } from "@/lib/api-envelope";

import type { EarningsResponse } from "@/lib/calendar/calendar";
import type { IpoCalendarResponse } from "@/lib/calendar/ipo";
import type { EconomicCalendarResponse } from "@/lib/calendar/economic";

export const EARNINGS_UNAVAILABLE_MESSAGE =
  "Earnings calendar is temporarily unavailable. Please try again shortly.";

export class EarningsClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EarningsClientError";
  }
}

export async function fetchEarnings(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<EarningsResponse> {
  const response = await fetch(
    `/api/market-data/earnings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    },
  );
  const body: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));
  if (!response.ok) {
    throw new EarningsClientError(getErrorMessage(body));
  }
  if (!isEarningsResponse(body)) {
    throw new EarningsClientError(EARNINGS_UNAVAILABLE_MESSAGE);
  }
  return body;
}

export function getEarningsClientErrorMessage(error: unknown): string {
  return error instanceof EarningsClientError
    ? error.message
    : EARNINGS_UNAVAILABLE_MESSAGE;
}

export function isEarningsRequestAborted(error: unknown): boolean {
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
  return EARNINGS_UNAVAILABLE_MESSAGE;
}

function isEarningsResponse(value: unknown): value is EarningsResponse {
  return (
    value !== null &&
    typeof value === "object" &&
    Array.isArray((value as Record<string, unknown>).events)
  );
}

export const IPO_CALENDAR_UNAVAILABLE_MESSAGE =
  "IPO calendar is temporarily unavailable. Please try again shortly.";

export class IpoCalendarClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "IpoCalendarClientError";
  }
}

export async function fetchIpoCalendar(
  signal?: AbortSignal,
): Promise<IpoCalendarResponse> {
  const response = await fetch("/api/market-data/ipo-calendar", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));
  if (!response.ok) {
    throw new IpoCalendarClientError(IPO_CALENDAR_UNAVAILABLE_MESSAGE);
  }
  if (
    body === null ||
    typeof body !== "object" ||
    !Array.isArray((body as Record<string, unknown>).issues)
  ) {
    throw new IpoCalendarClientError(IPO_CALENDAR_UNAVAILABLE_MESSAGE);
  }
  return body as IpoCalendarResponse;
}

export function isIpoCalendarRequestAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export const ECONOMIC_CALENDAR_UNAVAILABLE_MESSAGE =
  "Economic calendar is temporarily unavailable. Please try again shortly.";

export class EconomicCalendarClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EconomicCalendarClientError";
  }
}

export async function fetchEconomicCalendar(
  options?: { from?: string; to?: string },
  signal?: AbortSignal,
): Promise<EconomicCalendarResponse> {
  const params = new URLSearchParams();
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  const query = params.toString();
  const response = await fetch(
    `/api/market-data/economic-calendar${query ? `?${query}` : ""}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    },
  );
  const body: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));
  if (!response.ok) {
    throw new EconomicCalendarClientError(
      ECONOMIC_CALENDAR_UNAVAILABLE_MESSAGE,
    );
  }
  if (
    body === null ||
    typeof body !== "object" ||
    !Array.isArray((body as Record<string, unknown>).events)
  ) {
    throw new EconomicCalendarClientError(
      ECONOMIC_CALENDAR_UNAVAILABLE_MESSAGE,
    );
  }
  return body as EconomicCalendarResponse;
}

export function isEconomicCalendarRequestAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

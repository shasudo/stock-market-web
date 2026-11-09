import { unwrapApiEnvelope } from "@/lib/api-envelope";
/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export interface CorporateActionDTO {
  readonly symbol: string;
  readonly companyName: string;
  readonly eventDate: string;
  readonly purpose: string;
  readonly recordDate: string | null;
}

export interface CircuitHitDTO {
  readonly symbol: string;
  readonly companyName: string;
  readonly highOrLow: "H" | "L";
}

export const SCRAPED_EVENTS_UNAVAILABLE_MESSAGE =
  "This data is temporarily unavailable. Please try again shortly.";

export class ScrapedEventClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ScrapedEventClientError";
  }
}

export interface ScrapedEventsResponse<T> {
  readonly events: readonly T[];
  readonly lastSyncAt: string | null;
}

export async function fetchScrapedEvents<T>(
  endpoint: string,
  signal?: AbortSignal,
): Promise<ScrapedEventsResponse<T>> {
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));

  if (!response.ok) {
    throw new ScrapedEventClientError(getErrorMessage(body));
  }
  if (!isScrapedEventsResponse<T>(body)) {
    throw new ScrapedEventClientError(SCRAPED_EVENTS_UNAVAILABLE_MESSAGE);
  }

  return body;
}

export function getScrapedEventClientErrorMessage(error: unknown): string {
  return error instanceof ScrapedEventClientError
    ? error.message
    : SCRAPED_EVENTS_UNAVAILABLE_MESSAGE;
}

export function isScrapedEventRequestAborted(error: unknown): boolean {
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
  return SCRAPED_EVENTS_UNAVAILABLE_MESSAGE;
}

function isScrapedEventsResponse<T>(
  value: unknown,
): value is ScrapedEventsResponse<T> {
  return (
    isRecord(value) &&
    Array.isArray(value.events) &&
    (value.lastSyncAt === null || typeof value.lastSyncAt === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

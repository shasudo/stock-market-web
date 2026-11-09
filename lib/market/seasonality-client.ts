import { unwrapApiEnvelope } from "@/lib/api-envelope";
/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export interface SeasonalityRow {
  readonly securityId: number;
  readonly exchangeSegment: string;
  readonly years: number;
  readonly avg: number;
  readonly hitRate: number;
  readonly best: number;
  readonly worst: number;
}

export interface SeasonalityResponse {
  readonly stats: readonly SeasonalityRow[];
  readonly lastSyncAt: string | null;
}



const SEASONALITY_ENDPOINT = "/api/market/seasonality";
export const SEASONALITY_UNAVAILABLE_MESSAGE =
  "Seasonality data is temporarily unavailable. Please try again shortly.";

export class SeasonalityClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SeasonalityClientError";
  }
}

export async function fetchSeasonality(
  exchange: "NSE" | "BSE",
  signal?: AbortSignal,
): Promise<SeasonalityResponse> {
  const response = await fetch(
    `${SEASONALITY_ENDPOINT}?exchange=${exchange}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    },
  );
  const body: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));

  if (!response.ok) {
    throw new SeasonalityClientError(
      getErrorMessage(body, SEASONALITY_UNAVAILABLE_MESSAGE),
    );
  }
  if (!isSeasonalityResponse(body)) {
    throw new SeasonalityClientError(SEASONALITY_UNAVAILABLE_MESSAGE);
  }

  return body;
}

export function getSeasonalityErrorMessage(error: unknown): string {
  return error instanceof SeasonalityClientError
    ? error.message
    : SEASONALITY_UNAVAILABLE_MESSAGE;
}

export function isSeasonalityRequestAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function isSeasonalityResponse(
  value: unknown,
): value is SeasonalityResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.stats) &&
    value.stats.every(isSeasonalityRow) &&
    (value.lastSyncAt === null || typeof value.lastSyncAt === "string")
  );
}

function isSeasonalityRow(value: unknown): value is SeasonalityRow {
  return (
    isRecord(value) &&
    typeof value.securityId === "number" &&
    typeof value.exchangeSegment === "string" &&
    typeof value.years === "number" &&
    typeof value.avg === "number" &&
    typeof value.hitRate === "number" &&
    typeof value.best === "number" &&
    typeof value.worst === "number"
  );
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (isRecord(body) && typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

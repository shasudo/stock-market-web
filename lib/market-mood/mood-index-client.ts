/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export interface MoodComparison {
  readonly label: string;
  readonly date: string | null;
  readonly score: number | null;
}

export interface MoodHistoryPoint {
  /** IST trading date, YYYY-MM-DD. */
  readonly date: string;
  readonly score: number;
}

export interface MoodIndexResponse {
  readonly score: number | null;
  readonly zone: MoodZoneKey | null;
  readonly factors: readonly MoodFactorScore[];
  /** When the market data behind breadth and prices was last synced. */
  readonly lastSyncAt: string | null;
  readonly generatedAt: string;
  /** Oldest first, at most one point per trading day. */
  readonly history: readonly MoodHistoryPoint[];
  readonly comparisons: readonly MoodComparison[];
}


import type { MoodFactorScore, MoodZoneKey } from "./mood-index";

export type MoodIndexSnapshot = MoodIndexResponse;

export class MoodIndexClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MoodIndexClientError";
  }
}

const UNAVAILABLE_MESSAGE =
  "Market Mood Index is temporarily unavailable. Please try again shortly.";

export async function fetchMoodIndex(
  signal?: AbortSignal,
): Promise<MoodIndexSnapshot> {
  const response = await fetch("/api/market-data/mood-index", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new MoodIndexClientError(getErrorMessage(body));
  }
  if (
    !isRecord(body) ||
    (typeof body.score !== "number" && body.score !== null) ||
    !Array.isArray(body.factors) ||
    !Array.isArray(body.history) ||
    !Array.isArray(body.comparisons)
  ) {
    throw new MoodIndexClientError(UNAVAILABLE_MESSAGE);
  }

  return body as unknown as MoodIndexSnapshot;
}

export function getMoodIndexClientErrorMessage(error: unknown): string {
  return error instanceof MoodIndexClientError
    ? error.message
    : UNAVAILABLE_MESSAGE;
}

export function isMoodIndexRequestAborted(error: unknown): boolean {
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
  return UNAVAILABLE_MESSAGE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

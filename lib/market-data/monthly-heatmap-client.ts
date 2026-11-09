import { unwrapApiEnvelope } from "@/lib/api-envelope";
import type { MonthlyHeatmap } from "./monthly-heatmap";

export const MONTHLY_HEATMAP_UNAVAILABLE_MESSAGE =
  "Monthly data is temporarily unavailable. Please try again shortly.";

export class MonthlyHeatmapClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MonthlyHeatmapClientError";
  }
}

export async function fetchMonthlyHeatmap(
  endpoint: string,
  signal?: AbortSignal,
): Promise<MonthlyHeatmap> {
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));

  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.message === "string" && body.message.trim()
        ? body.message
        : MONTHLY_HEATMAP_UNAVAILABLE_MESSAGE;
    throw new MonthlyHeatmapClientError(message);
  }
  if (!isMonthlyHeatmap(body)) {
    throw new MonthlyHeatmapClientError(MONTHLY_HEATMAP_UNAVAILABLE_MESSAGE);
  }
  return body;
}

export function getMonthlyHeatmapErrorMessage(error: unknown): string {
  return error instanceof MonthlyHeatmapClientError
    ? error.message
    : MONTHLY_HEATMAP_UNAVAILABLE_MESSAGE;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isMonthlyHeatmap(value: unknown): value is MonthlyHeatmap {
  return (
    isRecord(value) &&
    (value.kind === "return" || value.kind === "level") &&
    Array.isArray(value.rows) &&
    Array.isArray(value.stats)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

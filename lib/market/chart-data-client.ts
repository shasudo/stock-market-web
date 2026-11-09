import { unwrapApiEnvelope } from "@/lib/api-envelope";
/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export interface ChartDataDTO {
  readonly symbol: string;
  readonly displayName: string;
  readonly exchange: string;
  readonly timeframe: ChartTimeframe;
  readonly candles: readonly ChartCandle[];
  readonly quote: ChartQuote;
  readonly marketOpen: boolean;
  /** Market is open but the latest quote is older than a few minutes. */
  readonly delayed: boolean;
  /** "loading" means intraday candles are warming; the client should re-poll. */
  readonly status: "ready" | "loading" | "empty";
  readonly message?: string;
  readonly generatedAt: string;
}

import type { ChartCandle, ChartQuote, ChartTimeframe } from "./chart-candles";

export class ChartDataClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ChartDataClientError";
  }
}

export async function fetchChartData(
  request: {
    readonly symbol: string;
    readonly exchange?: string;
    readonly timeframe: ChartTimeframe;
    /** Fetch only the newest N candles (live polling). */
    readonly tail?: number;
  },
  signal?: AbortSignal,
): Promise<ChartDataDTO> {
  const params = new URLSearchParams({
    symbol: request.symbol,
    timeframe: request.timeframe,
  });
  if (request.exchange) params.set("exchange", request.exchange);
  if (request.tail) params.set("tail", String(request.tail));

  const response = await fetch(`/api/market-data/chart?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const body: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : "Chart data is temporarily unavailable.";
    throw new ChartDataClientError(message);
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { candles?: unknown }).candles)
  ) {
    throw new ChartDataClientError("Chart data is temporarily unavailable.");
  }
  return body as ChartDataDTO;
}

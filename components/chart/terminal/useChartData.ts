"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchChartData,
  type ChartDataDTO,
} from "@/lib/market/chart-data-client";
import type { ChartCandle, ChartTimeframe } from "@/lib/market/chart-candles";

const OPEN_POLL_MS = 5_000;
const CLOSED_POLL_MS = 60_000;
const LOADING_POLL_MS = 2_000;
const TAIL_CANDLES = 4;

export interface ChartDataState {
  /** Everything except the candles, which are merged as polls arrive. */
  readonly meta: Omit<ChartDataDTO, "candles"> | null;
  readonly candles: readonly ChartCandle[];
  readonly status: "loading" | "ready" | "empty" | "error";
  readonly error: string | null;
  readonly updatedAt: Date | null;
}

interface Stored {
  readonly key: string;
  readonly meta: Omit<ChartDataDTO, "candles">;
  readonly candles: readonly ChartCandle[];
}

interface Failure {
  readonly key: string;
  readonly message: string;
}

export function mergeTail(
  existing: readonly ChartCandle[],
  tail: readonly ChartCandle[],
): readonly ChartCandle[] {
  if (tail.length === 0) return existing;
  const merged = [...existing];
  for (const candle of tail) {
    const last = merged[merged.length - 1];
    if (last && candle.time === last.time) {
      merged[merged.length - 1] = candle;
    } else if (!last || candle.time > last.time) {
      merged.push(candle);
    }
  }
  return merged;
}

/**
 * Loads a symbol's candles once, then keeps only the newest few fresh. Polling
 * pauses while `paused` (replay) or the tab is hidden, and resumes at once when
 * the tab comes back.
 */
export function useChartData(options: {
  readonly symbol: string;
  readonly exchange?: string;
  readonly timeframe: ChartTimeframe;
  readonly paused?: boolean;
}): ChartDataState {
  const { symbol, exchange, timeframe, paused = false } = options;
  const key = `${symbol}|${exchange ?? ""}|${timeframe}`;
  const [stored, setStored] = useState<Stored | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const storedRef = useRef<Stored | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const run = async (): Promise<void> => {
      let delay = CLOSED_POLL_MS;
      const skip =
        pausedRef.current ||
        (typeof document !== "undefined" &&
          document.hidden &&
          storedRef.current?.key === key);
      if (!skip) {
        try {
          const current = storedRef.current;
          const tail = current?.key === key && current.candles.length > 0;
          const response = await fetchChartData(
            {
              symbol,
              exchange,
              timeframe,
              ...(tail ? { tail: TAIL_CANDLES } : {}),
            },
            controller.signal,
          );
          if (cancelled) return;
          const { candles, ...meta } = response;
          if (response.status === "loading") {
            delay = LOADING_POLL_MS;
          } else {
            const next: Stored = {
              key,
              meta,
              candles: tail ? mergeTail(current!.candles, candles) : candles,
            };
            storedRef.current = next;
            setStored(next);
            setFailure(null);
            setUpdatedAt(new Date());
            delay = response.marketOpen ? OPEN_POLL_MS : CLOSED_POLL_MS;
          }
        } catch (caught) {
          if (cancelled || controller.signal.aborted) return;
          setFailure({
            key,
            message:
              caught instanceof Error
                ? caught.message
                : "Chart data is unavailable.",
          });
          delay = CLOSED_POLL_MS / 2;
        }
      } else {
        delay = OPEN_POLL_MS;
      }
      if (!cancelled) timer = setTimeout(() => void run(), delay);
    };

    const onVisible = (): void => {
      if (document.hidden) return;
      if (timer) clearTimeout(timer);
      void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    void run();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [symbol, exchange, timeframe, key]);

  const current = stored?.key === key ? stored : null;
  const error = failure?.key === key ? failure.message : null;
  const status: ChartDataState["status"] =
    error && !current
      ? "error"
      : !current
        ? "loading"
        : current.meta.status === "empty"
          ? "empty"
          : "ready";

  return {
    meta: current?.meta ?? null,
    candles: current?.candles ?? [],
    status,
    error,
    updatedAt,
  };
}

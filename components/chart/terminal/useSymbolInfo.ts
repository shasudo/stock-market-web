"use client";

import { useEffect, useState } from "react";
import apiClient, { isRecord, isSuccessfulApiResponse } from "@/lib/api-client";
import { fetchChartData } from "@/lib/market/chart-data-client";
import type { ChartCandle } from "@/lib/market/chart-candles";

const CACHE_TTL_MS = 5 * 60_000;
const dailyCache = new Map<
  string,
  { at: number; candles: readonly ChartCandle[] }
>();

/** Full daily history, for performance and seasonality whatever timeframe is on screen. */
export function useDailyHistory(symbol: string): {
  readonly candles: readonly ChartCandle[];
  readonly loading: boolean;
} {
  const [state, setState] = useState<{
    symbol: string;
    candles: readonly ChartCandle[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = dailyCache.get(symbol);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      queueMicrotask(() => {
        if (!cancelled) setState({ symbol, candles: cached.candles });
      });
      return () => {
        cancelled = true;
      };
    }
    void fetchChartData({ symbol, timeframe: "D" })
      .then((response) => {
        if (cancelled) return;
        dailyCache.set(symbol, { at: Date.now(), candles: response.candles });
        setState({ symbol, candles: response.candles });
      })
      .catch(() => {
        if (!cancelled) setState({ symbol, candles: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const ready = state?.symbol === symbol;
  return { candles: ready ? state.candles : [], loading: !ready };
}

export interface StockInfo {
  readonly sector: string | null;
  readonly industry: string | null;
  readonly week52High: number | null;
  readonly week52Low: number | null;
  /** Synced fundamentals; null when no snapshot exists for the symbol. */
  readonly marketCap: number | null;
  readonly trailingPe: number | null;
  readonly forwardPe: number | null;
  readonly eps: number | null;
  readonly dividendYield: number | null;
  readonly beta: number | null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Sector, 52-week range and synced fundamentals; absent for indices, which
 * the stock API does not know.
 */
export function useStockInfo(symbol: string): StockInfo | null {
  const [state, setState] = useState<{
    symbol: string;
    info: StockInfo | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const encoded = encodeURIComponent(symbol);
    void Promise.allSettled([
      apiClient.get<unknown>(`/api/stocks/${encoded}`),
      apiClient.get<unknown>(`/api/stocks/${encoded}/fundamentals`),
    ])
      .then(([stockResult, fundamentalsResult]) => {
        if (cancelled) return;
        const data =
          stockResult.status === "fulfilled" &&
          isSuccessfulApiResponse(stockResult.value.data)
            ? stockResult.value.data.data
            : null;
        const stock =
          isRecord(data) && isRecord(data.stock) ? data.stock : null;
        const fundamentalsData =
          fundamentalsResult.status === "fulfilled" &&
          isSuccessfulApiResponse(fundamentalsResult.value.data)
            ? fundamentalsResult.value.data.data
            : null;
        const fundamentals =
          isRecord(fundamentalsData) && isRecord(fundamentalsData.fundamentals)
            ? fundamentalsData.fundamentals
            : null;
        setState({
          symbol,
          info: stock
            ? {
                sector: typeof stock.sector === "string" ? stock.sector : null,
                industry:
                  typeof stock.industry === "string" ? stock.industry : null,
                week52High: finiteNumber(stock.week52High),
                week52Low: finiteNumber(stock.week52Low),
                marketCap: finiteNumber(fundamentals?.marketCap),
                trailingPe: finiteNumber(fundamentals?.trailingPe),
                forwardPe: finiteNumber(fundamentals?.forwardPe),
                eps: finiteNumber(fundamentals?.eps),
                dividendYield: finiteNumber(fundamentals?.dividendYield),
                beta: finiteNumber(fundamentals?.beta),
              }
            : null,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ symbol, info: null });
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return state?.symbol === symbol ? state.info : null;
}

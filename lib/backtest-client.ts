import apiClient, { isSuccessfulApiResponse, isRecord } from "@/lib/api-client";
import type { SimulationSummary } from "@/lib/backtest/simulator";

export interface BacktestTradeDTO {
  readonly entryDate: string;
  readonly entryPrice: number;
  readonly exitDate: string | null;
  readonly exitPrice: number | null;
  readonly exitReason: string | null;
  readonly quantity: number;
  readonly pnl: number | null;
  readonly pnlPercent: number | null;
}

export interface BacktestRunDTO {
  readonly id: string;
  readonly strategyId: string;
  readonly symbol: string;
  readonly exchangeSegment: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly initialCapital: number;
  readonly status: string;
  readonly summary: SimulationSummary | null;
  readonly trades: readonly BacktestTradeDTO[];
  readonly createdAt: string;
}

export interface RunBacktestRequest {
  readonly strategyId: string;
  readonly symbol: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly initialCapital: number;
}

function isBacktestRunDTO(value: unknown): value is BacktestRunDTO {
  return isRecord(value) && typeof value.id === "string" && Array.isArray(value.trades);
}

export async function runBacktest(input: RunBacktestRequest): Promise<BacktestRunDTO> {
  const response = await apiClient.post<unknown>("/api/backtest-runs", input);
  if (
    !isSuccessfulApiResponse(response.data) ||
    !isRecord(response.data.data) ||
    !isBacktestRunDTO(response.data.data.run)
  ) {
    throw new Error("The server returned an unexpected backtest response.");
  }
  return response.data.data.run;
}

export async function fetchBacktestRuns(strategyId: string): Promise<BacktestRunDTO[]> {
  const response = await apiClient.get<unknown>(
    `/api/backtest-runs?strategyId=${encodeURIComponent(strategyId)}`,
  );
  if (
    !isSuccessfulApiResponse(response.data) ||
    !isRecord(response.data.data) ||
    !Array.isArray(response.data.data.runs)
  ) {
    throw new Error("The server returned an unexpected backtest-runs response.");
  }
  return response.data.data.runs.filter(isBacktestRunDTO);
}

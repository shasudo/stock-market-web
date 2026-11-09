import apiClient, { isSuccessfulApiResponse, isRecord } from "@/lib/api-client";
import type { StrategyLegs } from "@/lib/backtest/types";

export interface StrategyDefinitionDTO {
  readonly id: string;
  readonly name: string;
  readonly timeframe: string;
  readonly instrument: string;
  readonly tradingType: string;
  readonly legs: StrategyLegs;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SaveStrategyRequest {
  readonly name: string;
  readonly timeframe: string;
  readonly instrument: string;
  readonly tradingType: string;
  readonly legs: StrategyLegs;
}

function isStrategyDTO(value: unknown): value is StrategyDefinitionDTO {
  return isRecord(value) && typeof value.id === "string" && typeof value.legs === "object";
}

export async function fetchStrategies(): Promise<StrategyDefinitionDTO[]> {
  const response = await apiClient.get<unknown>("/api/strategies");
  if (
    !isSuccessfulApiResponse(response.data) ||
    !isRecord(response.data.data) ||
    !Array.isArray(response.data.data.strategies)
  ) {
    throw new Error("The server returned an unexpected strategies response.");
  }
  return response.data.data.strategies.filter(isStrategyDTO);
}

export async function createStrategy(
  input: SaveStrategyRequest,
): Promise<StrategyDefinitionDTO> {
  const response = await apiClient.post<unknown>("/api/strategies", input);
  return extractStrategy(response.data);
}

export async function updateStrategy(
  id: string,
  input: SaveStrategyRequest,
): Promise<StrategyDefinitionDTO> {
  const response = await apiClient.put<unknown>(
    `/api/strategies/${encodeURIComponent(id)}`,
    input,
  );
  return extractStrategy(response.data);
}

export async function deleteStrategy(id: string): Promise<void> {
  await apiClient.delete<unknown>(`/api/strategies/${encodeURIComponent(id)}`);
}

function extractStrategy(data: unknown): StrategyDefinitionDTO {
  if (
    !isSuccessfulApiResponse(data) ||
    !isRecord(data.data) ||
    !isStrategyDTO(data.data.strategy)
  ) {
    throw new Error("The server returned an unexpected strategy response.");
  }
  return data.data.strategy;
}

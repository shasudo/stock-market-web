export type StockBackDestination = "back" | "/dashboard";

export function resolveStockBackDestination(
  historyLength: number,
): StockBackDestination {
  return historyLength > 1 ? "back" : "/dashboard";
}

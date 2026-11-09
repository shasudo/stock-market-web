export interface ScreenerConfig {
  loadingMessage: string;
  tableType:
    | "gainers"
    | "losers"
    | "52wkHigh"
    | "52wkLow"
    | "onlyBuyers"
    | "onlySellers"
    | "priceShockers"
    | "volumeShockers"
    | "mostActiveByValue"
    | "allTimeHigh"
    | "allTimeLow";

  dataSource: "gainers" | "losers" | "all";

  filter?:
    | "onlyBuyers"
    | "onlySellers"
    | "52wkHigh"
    | "52wkLow"
    | "allTimeHigh"
    | "allTimeLow"
    | "priceShockers"
    | "volumeShockers"
    | "mostActiveByValue";

  // Set when this screen's filter can never return rows against the
  // current data source — shown to the user instead of a silent empty table.
  unavailableReason?: string;
}

export type ScreenerType = keyof typeof screenerConfigs;

export const screenerConfigs = {
  gainers: {
    loadingMessage: "Loading top gainers...",
    tableType: "gainers" as const,
    dataSource: "gainers" as const,
  },
  losers: {
    loadingMessage: "Loading top losers...",
    tableType: "losers" as const,
    dataSource: "losers" as const,
  },
  "52-week-high": {
    loadingMessage: "Loading 52 week high stocks...",
    tableType: "52wkHigh" as const,
    dataSource: "gainers" as const,
    filter: "52wkHigh" as const,
  },
  "52-week-low": {
    loadingMessage: "Loading 52 week low stocks...",
    tableType: "52wkLow" as const,
    dataSource: "losers" as const,
    filter: "52wkLow" as const,
  },
  "all-time-high": {
    loadingMessage: "Loading all time high stocks...",
    tableType: "allTimeHigh" as const,
    dataSource: "gainers" as const,
    filter: "allTimeHigh" as const,
  },
  "all-time-low": {
    loadingMessage: "Loading all time low stocks...",
    tableType: "allTimeLow" as const,
    dataSource: "losers" as const,
    filter: "allTimeLow" as const,
  },
  "only-buyers": {
    loadingMessage: "Loading only buyers stocks...",
    tableType: "onlyBuyers" as const,
    dataSource: "gainers" as const,
    filter: "onlyBuyers" as const,
  },
  "only-sellers": {
    loadingMessage: "Loading only sellers stocks...",
    tableType: "onlySellers" as const,
    dataSource: "losers" as const,
    filter: "onlySellers" as const,
  },
  "price-shockers": {
    loadingMessage: "Loading price shockers...",
    tableType: "priceShockers" as const,
    dataSource: "all" as const,
    filter: "priceShockers" as const,
  },
  "volume-shockers": {
    loadingMessage: "Loading volume shockers...",
    tableType: "volumeShockers" as const,
    dataSource: "all" as const,
    filter: "volumeShockers" as const,
  },
  "most-active-by-value": {
    loadingMessage: "Loading most active stocks...",
    tableType: "mostActiveByValue" as const,
    dataSource: "all" as const,
    filter: "mostActiveByValue" as const,
  },
} satisfies Record<string, ScreenerConfig>;

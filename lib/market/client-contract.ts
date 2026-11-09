import type {
  PatternHit,
  PatternOptionCount,
  PatternSummaryPayload,
  RowPatternSummary,
} from "./pattern-summary";

export interface MarketStockData {
  readonly id: string;
  readonly securityId: number;
  readonly exchange: string;
  readonly exchangeSegment: string;
  readonly companyName: string;
  readonly tradingSymbol: string;
  readonly sector: string;
  readonly industry: string;
  readonly group: string;
  readonly faceValue: number;
  readonly priceBand: string;
  readonly marketCap: string;
  readonly preClose: number;
  readonly open?: number;
  readonly high?: number;
  readonly low?: number;
  readonly cmp: number;
  readonly netChange: number;
  readonly customNetChange?: number | null;
  readonly percentChange: number;
  readonly percentChanges: Readonly<Record<string, number | null>>;
  readonly week52High?: number;
  readonly week52Low?: number;
  readonly hit52High?: boolean;
  readonly hit52Low?: boolean;
  readonly ath?: number;
  readonly atl?: number;
  readonly hitAthHigh?: boolean;
  readonly hitAthLow?: boolean;
  readonly volume?: number;
}

export interface MarketPaginationInfo {
  readonly page: number;
  readonly pageSize: number;
  readonly totalStocks: number;
  readonly totalPages: number;
}

export interface MarketStatsData {
  readonly totalGainers: number;
  readonly totalLosers: number;
  readonly totalUnchanged: number;
  readonly avgGain: number;
  readonly avgLoss: number;
  readonly topGainer: MarketLeader | null;
  readonly topLoser: MarketLeader | null;
}

export interface MarketLeader {
  readonly company: string;
  readonly symbol: string;
  readonly sector: string;
  readonly ltp: number;
  readonly percentInChange: number;
}

export interface MarketFilteredCounts {
  readonly total: number;
  readonly gainers: number;
  readonly losers: number;
  readonly unchanged: number;
  readonly highHits: number;
  readonly lowHits: number;
}

export interface MarketSyncStatus {
  readonly isRunning: boolean;
  readonly historicalPopulating: boolean;
  readonly historicalProgress: {
    readonly completed: number;
    readonly total: number;
  };
  readonly cachedCount: number;
}

export interface MarketLiveResponse {
  readonly stocks: readonly MarketStockData[];
  readonly pagination: MarketPaginationInfo;
  readonly stats: MarketStatsData;
  readonly filteredCounts: MarketFilteredCounts;
  readonly lastSyncAt: string | null;
  readonly syncStatus: MarketSyncStatus;
  /** Candlestick / Chart Patterns summary, when the request asked for it. */
  readonly patternSummary?: PatternSummaryPayload;
}

export interface MarketFilterOptions {
  readonly sectors: readonly string[];
  readonly industries: readonly string[];
  readonly sectorIndustries?: Readonly<Record<string, readonly string[]>>;
  readonly marketCaps: readonly string[];
  readonly priceBands: readonly string[];
  readonly series: readonly string[];
}

export type MarketAddedColumnValueState =
  | "ready"
  | "insufficient-data"
  | "warming-live-feed"
  | "warming-intraday"
  | "awaiting-fundamentals"
  | "requires-provider"
  | "awaiting-option-chain"
  | "disabled";

export interface MarketAddedColumnValue {
  readonly state: MarketAddedColumnValueState;
  readonly display: string;
  readonly numericValue?: number;
  readonly message?: string;
}

export interface MarketColumnValuesResponse {
  readonly values: Readonly<
    Record<string, Readonly<Record<string, MarketAddedColumnValue>>>
  >;
  readonly columnCount: number;
}

export const INVALID_MARKET_RESPONSE_MESSAGE =
  "The market-data service returned an invalid response.";

export function getMarketApiErrorMessage(
  value: unknown,
  fallback: string,
): string {
  if (!isRecord(value)) {
    return fallback;
  }

  if (typeof value.message === "string" && value.message.trim().length > 0) {
    return value.message;
  }

  return typeof value.error === "string" && value.error.trim().length > 0
    ? value.error
    : fallback;
}

export function isMarketLiveResponse(
  value: unknown,
): value is MarketLiveResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.stocks) &&
    value.stocks.every(isMarketStockData) &&
    isMarketPaginationInfo(value.pagination) &&
    isMarketStatsData(value.stats) &&
    isMarketFilteredCounts(value.filteredCounts) &&
    (value.lastSyncAt === null || typeof value.lastSyncAt === "string") &&
    isMarketSyncStatus(value.syncStatus) &&
    // Java sends explicit null for absent optionals; the retired backend
    // omitted the key. Accept both.
    (value.patternSummary === undefined ||
      value.patternSummary === null ||
      isPatternSummaryPayload(value.patternSummary))
  );
}

function isPatternHit(value: unknown): value is PatternHit {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isStringArray(value.timeframeIds)
  );
}

function isRowPatternSummary(value: unknown): value is RowPatternSummary {
  return (
    isRecord(value) &&
    (value.state === "ready" || value.state === "no-data") &&
    Array.isArray(value.candlesticks) &&
    value.candlesticks.every(isPatternHit) &&
    Array.isArray(value.chartPatterns) &&
    value.chartPatterns.every(isPatternHit)
  );
}

function isPatternOptionCount(value: unknown): value is PatternOptionCount {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.label === "string" &&
    isNonNegativeInteger(value.count)
  );
}

export function isPatternSummaryPayload(
  value: unknown,
): value is PatternSummaryPayload {
  return (
    isRecord(value) &&
    isStringArray(value.timeframeIds) &&
    isRecord(value.rows) &&
    Object.values(value.rows).every(isRowPatternSummary) &&
    isRecord(value.options) &&
    Array.isArray(value.options.candlesticks) &&
    value.options.candlesticks.every(isPatternOptionCount) &&
    Array.isArray(value.options.chartPatterns) &&
    value.options.chartPatterns.every(isPatternOptionCount) &&
    isNonNegativeInteger(value.scanned) &&
    isNonNegativeInteger(value.withoutData)
  );
}

export function isMarketFilterOptions(
  value: unknown,
): value is MarketFilterOptions {
  return (
    isRecord(value) &&
    isStringArray(value.sectors) &&
    isStringArray(value.industries) &&
    isStringArray(value.marketCaps) &&
    isStringArray(value.priceBands) &&
    isStringArray(value.series) &&
    (value.sectorIndustries === undefined ||
      (isRecord(value.sectorIndustries) &&
        Object.values(value.sectorIndustries).every(isStringArray)))
  );
}

export function isMarketColumnValuesResponse(
  value: unknown,
): value is MarketColumnValuesResponse {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.columnCount) &&
    isRecord(value.values) &&
    Object.values(value.values).every(
      (row) =>
        isRecord(row) && Object.values(row).every(isMarketAddedColumnValue),
    )
  );
}

export interface PatternCompanyMatch {
  readonly securityId: number;
  readonly exchange: string;
  readonly tradingSymbol: string;
  readonly companyName: string;
  readonly lastPrice: number;
  readonly pctChange: number;
  readonly volume: number;
  readonly matchedTimeframes: readonly string[];
}

export interface PatternCompaniesResponse {
  readonly supported: boolean;
  readonly groupId: string;
  readonly itemId: string;
  readonly evaluatedTimeframes: readonly string[];
  readonly skippedTimeframes: readonly string[];
  readonly scanned: number;
  readonly matchCount: number;
  readonly truncated: boolean;
  readonly matches: readonly PatternCompanyMatch[];
  readonly message?: string;
}

function isPatternCompanyMatch(value: unknown): value is PatternCompanyMatch {
  return (
    isRecord(value) &&
    isPositiveInteger(value.securityId) &&
    isNonEmptyString(value.exchange) &&
    isNonEmptyString(value.tradingSymbol) &&
    typeof value.companyName === "string" &&
    isFiniteNumber(value.lastPrice) &&
    isFiniteNumber(value.pctChange) &&
    isFiniteNumber(value.volume) &&
    Array.isArray(value.matchedTimeframes) &&
    value.matchedTimeframes.every(
      (entry): entry is string => typeof entry === "string",
    )
  );
}

export function isPatternCompaniesResponse(
  value: unknown,
): value is PatternCompaniesResponse {
  return (
    isRecord(value) &&
    typeof value.supported === "boolean" &&
    typeof value.groupId === "string" &&
    typeof value.itemId === "string" &&
    Array.isArray(value.evaluatedTimeframes) &&
    value.evaluatedTimeframes.every(
      (entry): entry is string => typeof entry === "string",
    ) &&
    Array.isArray(value.skippedTimeframes) &&
    value.skippedTimeframes.every(
      (entry): entry is string => typeof entry === "string",
    ) &&
    isNonNegativeInteger(value.scanned) &&
    isNonNegativeInteger(value.matchCount) &&
    typeof value.truncated === "boolean" &&
    Array.isArray(value.matches) &&
    value.matches.every(isPatternCompanyMatch) &&
    (value.message === undefined || typeof value.message === "string")
  );
}

function isMarketStockData(value: unknown): value is MarketStockData {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isPositiveInteger(value.securityId) &&
    isNonEmptyString(value.exchange) &&
    isNonEmptyString(value.exchangeSegment) &&
    typeof value.companyName === "string" &&
    typeof value.tradingSymbol === "string" &&
    typeof value.sector === "string" &&
    typeof value.industry === "string" &&
    typeof value.group === "string" &&
    isFiniteNumber(value.faceValue) &&
    typeof value.priceBand === "string" &&
    typeof value.marketCap === "string" &&
    isFiniteNumber(value.preClose) &&
    (value.open === undefined || isFiniteNumber(value.open)) &&
    (value.high === undefined || isFiniteNumber(value.high)) &&
    (value.low === undefined || isFiniteNumber(value.low)) &&
    isFiniteNumber(value.cmp) &&
    isFiniteNumber(value.netChange) &&
    (value.customNetChange === undefined ||
      value.customNetChange === null ||
      isFiniteNumber(value.customNetChange)) &&
    isFiniteNumber(value.percentChange) &&
    isNullableNumberRecord(value.percentChanges) &&
    (value.week52High === undefined || isFiniteNumber(value.week52High)) &&
    (value.week52Low === undefined || isFiniteNumber(value.week52Low)) &&
    (value.hit52High === undefined || typeof value.hit52High === "boolean") &&
    (value.hit52Low === undefined || typeof value.hit52Low === "boolean") &&
    (value.ath === undefined || isFiniteNumber(value.ath)) &&
    (value.atl === undefined || isFiniteNumber(value.atl)) &&
    (value.hitAthHigh === undefined ||
      typeof value.hitAthHigh === "boolean") &&
    (value.hitAthLow === undefined || typeof value.hitAthLow === "boolean") &&
    (value.volume === undefined || isFiniteNumber(value.volume))
  );
}

function isMarketAddedColumnValue(
  value: unknown,
): value is MarketAddedColumnValue {
  return (
    isRecord(value) &&
    isAddedColumnState(value.state) &&
    typeof value.display === "string" &&
    value.display.trim().length > 0 &&
    (value.numericValue === undefined || isFiniteNumber(value.numericValue)) &&
    (value.message === undefined || typeof value.message === "string")
  );
}

function isMarketPaginationInfo(value: unknown): value is MarketPaginationInfo {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.page) &&
    value.page >= 1 &&
    isNonNegativeInteger(value.pageSize) &&
    value.pageSize >= 1 &&
    isNonNegativeInteger(value.totalStocks) &&
    isNonNegativeInteger(value.totalPages)
  );
}

function isMarketStatsData(value: unknown): value is MarketStatsData {
  return (
    isRecord(value) &&
    isFiniteNumber(value.totalGainers) &&
    isFiniteNumber(value.totalLosers) &&
    isFiniteNumber(value.totalUnchanged) &&
    isFiniteNumber(value.avgGain) &&
    isFiniteNumber(value.avgLoss) &&
    (value.topGainer === null || isMarketLeader(value.topGainer)) &&
    (value.topLoser === null || isMarketLeader(value.topLoser))
  );
}

function isMarketLeader(value: unknown): value is MarketLeader {
  return (
    isRecord(value) &&
    typeof value.company === "string" &&
    typeof value.symbol === "string" &&
    typeof value.sector === "string" &&
    isFiniteNumber(value.ltp) &&
    isFiniteNumber(value.percentInChange)
  );
}

function isMarketFilteredCounts(value: unknown): value is MarketFilteredCounts {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.total) &&
    isNonNegativeInteger(value.gainers) &&
    isNonNegativeInteger(value.losers) &&
    isNonNegativeInteger(value.unchanged) &&
    isNonNegativeInteger(value.highHits) &&
    isNonNegativeInteger(value.lowHits)
  );
}

function isMarketSyncStatus(value: unknown): value is MarketSyncStatus {
  return (
    isRecord(value) &&
    typeof value.isRunning === "boolean" &&
    typeof value.historicalPopulating === "boolean" &&
    isRecord(value.historicalProgress) &&
    isNonNegativeInteger(value.historicalProgress.completed) &&
    isNonNegativeInteger(value.historicalProgress.total) &&
    isNonNegativeInteger(value.cachedCount)
  );
}

function isNullableNumberRecord(
  value: unknown,
): value is Readonly<Record<string, number | null>> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) => entry === null || isFiniteNumber(entry),
    )
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isAddedColumnState(
  value: unknown,
): value is MarketAddedColumnValueState {
  return (
    value === "ready" ||
    value === "insufficient-data" ||
    value === "warming-live-feed" ||
    value === "warming-intraday" ||
    value === "awaiting-fundamentals" ||
    value === "requires-provider" ||
    value === "awaiting-option-chain" ||
    value === "disabled"
  );
}

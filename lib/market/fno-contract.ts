// Wire contract for GET /api/market-data/fno/contracts — the flat, paginated
// F&O stock-derivative browse behind the Screening Table's "F&O Stocks"
// segment. Sibling to client-contract.ts (the equity /api/market/live
// contract), same structural-type-guard validation style.

export interface FnoContractData {
  readonly id: string;
  readonly securityId: number;
  readonly exchange: string;
  readonly exchangeSegment: string;
  readonly underlyingSymbol: string;
  readonly tradingSymbol: string;
  readonly displayName: string;
  readonly instrumentType: string;
  readonly optionType: string | null;
  readonly strikePrice: number | null;
  readonly expiryDate: string;
  readonly lotSize: number;
  readonly lastPrice: number | null;
  readonly netChange: number | null;
  readonly pctChange: number | null;
  readonly openInterest: number | null;
}

export interface FnoContractPaginationInfo {
  readonly page: number;
  readonly pageSize: number;
  readonly totalContracts: number;
  readonly totalPages: number;
}

export interface FnoContractListResponse {
  readonly contracts: readonly FnoContractData[];
  readonly pagination: FnoContractPaginationInfo;
}

export function isFnoContractListResponse(
  value: unknown,
): value is FnoContractListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.contracts) &&
    value.contracts.every(isFnoContractData) &&
    isFnoContractPaginationInfo(value.pagination)
  );
}

function isFnoContractData(value: unknown): value is FnoContractData {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isPositiveInteger(value.securityId) &&
    isNonEmptyString(value.exchange) &&
    isNonEmptyString(value.exchangeSegment) &&
    isNonEmptyString(value.underlyingSymbol) &&
    typeof value.tradingSymbol === "string" &&
    typeof value.displayName === "string" &&
    isNonEmptyString(value.instrumentType) &&
    (value.optionType === null || typeof value.optionType === "string") &&
    (value.strikePrice === null || isFiniteNumber(value.strikePrice)) &&
    isNonEmptyString(value.expiryDate) &&
    isFiniteNumber(value.lotSize) &&
    (value.lastPrice === null || isFiniteNumber(value.lastPrice)) &&
    (value.netChange === null || isFiniteNumber(value.netChange)) &&
    (value.pctChange === null || isFiniteNumber(value.pctChange)) &&
    (value.openInterest === null || isFiniteNumber(value.openInterest))
  );
}

function isFnoContractPaginationInfo(
  value: unknown,
): value is FnoContractPaginationInfo {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.page) &&
    value.page >= 1 &&
    isNonNegativeInteger(value.pageSize) &&
    value.pageSize >= 1 &&
    isNonNegativeInteger(value.totalContracts) &&
    isNonNegativeInteger(value.totalPages)
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

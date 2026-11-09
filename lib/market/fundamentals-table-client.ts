import { unwrapApiEnvelope } from "@/lib/api-envelope";
/** Relocated from the retired server module of the same domain.
 *  The shape is unchanged; Java serves it now, this file only types it. */
export interface FundamentalsTableRow {
  readonly symbol: string;
  readonly exchange: string;
  readonly pe: number | null;
  readonly eps: number | null;
  readonly bookValue: number | null;
  readonly roe: number | null;
  readonly profitMargin: number | null;
  readonly operatingMargin: number | null;
  readonly dividendYield: number | null;
  readonly beta: number | null;
  readonly revenueTtm: number | null;
  /** Latest annual revenue (₹ crore) and its period date, from statements. */
  readonly revenueAnnual: number | null;
  readonly revenueAnnualDate: string | null;
  readonly netIncomeAnnual: number | null;
}

export interface FundamentalsTableResponse {
  readonly rows: readonly FundamentalsTableRow[];
  readonly lastSyncAt: string | null;
}



const FUNDAMENTALS_TABLE_ENDPOINT = "/api/market/fundamentals-table";
export const FUNDAMENTALS_TABLE_UNAVAILABLE_MESSAGE =
  "Fundamentals data is temporarily unavailable. Please try again shortly.";

export class FundamentalsTableClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "FundamentalsTableClientError";
  }
}

export async function fetchFundamentalsTable(
  exchange: "NSE" | "BSE",
  signal?: AbortSignal,
): Promise<FundamentalsTableResponse> {
  const response = await fetch(
    `${FUNDAMENTALS_TABLE_ENDPOINT}?exchange=${exchange}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    },
  );
  const body: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));

  if (!response.ok) {
    throw new FundamentalsTableClientError(
      getErrorMessage(body, FUNDAMENTALS_TABLE_UNAVAILABLE_MESSAGE),
    );
  }
  if (!isFundamentalsTableResponse(body)) {
    throw new FundamentalsTableClientError(
      FUNDAMENTALS_TABLE_UNAVAILABLE_MESSAGE,
    );
  }

  return body;
}

export function getFundamentalsTableErrorMessage(error: unknown): string {
  return error instanceof FundamentalsTableClientError
    ? error.message
    : FUNDAMENTALS_TABLE_UNAVAILABLE_MESSAGE;
}

export function isFundamentalsTableRequestAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function isFundamentalsTableResponse(
  value: unknown,
): value is FundamentalsTableResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.rows) &&
    value.rows.every(isFundamentalsTableRow) &&
    (value.lastSyncAt === null || typeof value.lastSyncAt === "string")
  );
}

function isFundamentalsTableRow(
  value: unknown,
): value is FundamentalsTableRow {
  return (
    isRecord(value) &&
    typeof value.symbol === "string" &&
    typeof value.exchange === "string" &&
    isNullableNumber(value.pe) &&
    isNullableNumber(value.eps) &&
    isNullableNumber(value.bookValue) &&
    isNullableNumber(value.roe) &&
    isNullableNumber(value.profitMargin) &&
    isNullableNumber(value.operatingMargin) &&
    isNullableNumber(value.dividendYield) &&
    isNullableNumber(value.beta) &&
    isNullableNumber(value.revenueTtm) &&
    isNullableNumber(value.revenueAnnual) &&
    (value.revenueAnnualDate === null ||
      value.revenueAnnualDate === undefined ||
      typeof value.revenueAnnualDate === "string") &&
    isNullableNumber(value.netIncomeAnnual)
  );
}

function isNullableNumber(value: unknown): value is number | null {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (isRecord(body) && typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

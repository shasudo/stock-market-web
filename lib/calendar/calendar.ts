export interface EarningsDTO {
  readonly symbol: string;
  readonly companyName: string;
  readonly eventDate: string;
  readonly epsEstimate: number | null;
  readonly timing: string | null;
  readonly ltp: number | null;
  readonly pctChange: number | null;
  readonly marketCap: number | null;
}

export interface EarningsResponse {
  readonly events: readonly EarningsDTO[];
  readonly lastSyncAt: string | null;
}

export type {
  CorporateActionCategory as CorporateCategory,
  CorporateActionCategory,
} from "../corporate-actions";
export { CORPORATE_ACTION_CATEGORIES as CORPORATE_CATEGORIES } from "../corporate-actions";

/** Pulls the analyst EPS estimate / timing out of a MarketEvent data blob. */
export function parseEarningsData(data: unknown): {
  epsEstimate: number | null;
  timing: string | null;
} {
  if (typeof data !== "object" || data === null) {
    return { epsEstimate: null, timing: null };
  }
  const record = data as Record<string, unknown>;
  const rawEstimate = record.estimate;
  const epsEstimate =
    typeof rawEstimate === "number" && Number.isFinite(rawEstimate)
      ? rawEstimate
      : null;
  const rawTiming = record.timing;
  const timing =
    typeof rawTiming === "string" && rawTiming.trim() !== ""
      ? rawTiming.trim()
      : null;
  return { epsEstimate, timing };
}

interface EarningRow {
  readonly tradingSymbol: string;
  readonly exchange: string;
  readonly eventDate: Date;
}

/**
 * NSE and BSE rows for the same symbol/date are the same event reported
 * twice — keep one, preferring the NSE row.
 */
export function dedupeEarningRows<T extends EarningRow>(rows: readonly T[]): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.tradingSymbol}|${row.eventDate.toISOString().slice(0, 10)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
    } else if (existing.exchange !== "NSE" && row.exchange === "NSE") {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values());
}

/**
 * Backwards-compatible alias — the canonical classifier lives in
 * lib/corporate-actions.ts and both calendar surfaces share it.
 */
export { classifyCorporateAction as categorizeCorporatePurpose } from "../corporate-actions";

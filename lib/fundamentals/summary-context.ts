import type { FinancialStatementPeriod, FundamentalMetrics } from "./types";
import type {
  PriceHistoryPoint,
  QuickRatioContext,
  QuickRatioQuote,
} from "./quick-ratios";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asPeriods = (value: unknown): readonly FinancialStatementPeriod[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is FinancialStatementPeriod =>
      isRecord(entry) &&
      typeof entry.date === "string" &&
      isRecord(entry.values),
  );
};

export interface SummaryQuoteInput {
  readonly lastPrice?: unknown;
  readonly high?: unknown;
  readonly low?: unknown;
  readonly volume?: unknown;
  readonly week52High?: unknown;
  readonly week52Low?: unknown;
  readonly marketCapValue?: unknown;
}

export interface SummaryContextInput {
  /** The parsed `data` JSON of a FundamentalSnapshot row (or null). */
  readonly data: Record<string, unknown> | null;
  readonly faceValue?: unknown;
  readonly quote?: SummaryQuoteInput | null;
  readonly history?: readonly PriceHistoryPoint[];
}

/**
 * Builds the QuickRatioContext that powers every Screener-style summary
 * number (key ratios, peer rows, statement tables) from one fundamentals
 * snapshot plus the live quote. Shared by the quick-ratios, statements and
 * peers routes so all three always agree.
 */
export function buildSummaryContext(
  input: SummaryContextInput,
): QuickRatioContext {
  const data = input.data;
  const metrics = (
    data !== null && isRecord(data.metrics) ? data.metrics : {}
  ) as FundamentalMetrics;
  const financials =
    data !== null && isRecord(data.financials) ? data.financials : null;
  const income = isRecord(financials?.incomeStatement)
    ? financials.incomeStatement
    : null;
  const balance = isRecord(financials?.balanceSheet)
    ? financials.balanceSheet
    : null;
  const cash = isRecord(financials?.cashFlow) ? financials.cashFlow : null;

  const quote: QuickRatioQuote = {
    price: num(input.quote?.lastPrice),
    dayHigh: num(input.quote?.high),
    dayLow: num(input.quote?.low),
    volume: num(input.quote?.volume),
    week52High: num(input.quote?.week52High),
    week52Low: num(input.quote?.week52Low),
    marketCap: num(input.quote?.marketCapValue),
  };

  return {
    metrics,
    annualIncome: asPeriods(income?.yearly),
    annualBalance: asPeriods(balance?.yearly),
    annualCash: asPeriods(cash?.yearly),
    quarterlyIncome: asPeriods(income?.quarterly),
    quarterlyBalance: asPeriods(balance?.quarterly),
    quarterlyCash: asPeriods(cash?.quarterly),
    quote,
    history: input.history ?? [],
    faceValue: num(input.faceValue),
  };
}

/** Newest-first by period date; providers are not trusted to order rows. */
export function newestFirst(
  periods: readonly FinancialStatementPeriod[],
): FinancialStatementPeriod[] {
  return [...periods].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
}

export function toHistoryPoints(
  timestamps: unknown,
  closes: unknown,
): PriceHistoryPoint[] {
  const points: PriceHistoryPoint[] = [];
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return points;
  const count = Math.min(timestamps.length, closes.length);
  for (let i = 0; i < count; i += 1) {
    const ts = timestamps[i];
    const close = closes[i];
    if (
      typeof ts === "number" &&
      Number.isFinite(ts) &&
      typeof close === "number" &&
      Number.isFinite(close) &&
      close > 0
    ) {
      points.push({ ts, close });
    }
  }
  points.sort((a, b) => a.ts - b.ts);
  return points;
}

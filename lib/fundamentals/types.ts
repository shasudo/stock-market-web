/**
 * Provider-neutral models for data that is not supplied by a trading broker.
 *
 * Values are optional when the upstream source does not publish them for a
 * ticker. Consumers should treat an omitted value as unavailable, rather than
 * as zero.
 */

/**
 * Intentionally open-ended so another provider can implement the same boundary
 * without changing the application contract.
 */
export type FundamentalsProviderId = string;

export const FUNDAMENTALS_CAPABILITIES = [
  "company-profile",
  "valuation",
  "financial-statements",
  "earnings",
  "dividends",
  "splits",
  "institutional-ownership",
  "fund-ownership",
  "analyst-ratings",
  "insider-transactions",
] as const;

export type FundamentalsCapability = (typeof FUNDAMENTALS_CAPABILITIES)[number];

export interface DateRange {
  /** Inclusive ISO-8601 calendar date (YYYY-MM-DD). */
  readonly from?: string;
  /** Inclusive ISO-8601 calendar date (YYYY-MM-DD). */
  readonly to?: string;
}

export interface CompanyProfile {
  /** Provider-qualified ticker, for example RELIANCE.NSE. */
  readonly ticker: string;
  readonly code?: string;
  readonly name?: string;
  readonly type?: string;
  readonly exchange?: string;
  readonly primaryTicker?: string;
  readonly currencyCode?: string;
  readonly countryCode?: string;
  readonly countryName?: string;
  readonly sector?: string;
  readonly industry?: string;
  /** Provider's more specific industry classification, when published. */
  readonly subIndustry?: string;
  readonly isin?: string;
  readonly fiscalYearEnd?: string;
  readonly ipoDate?: string;
  /** Business description (EODHD General.Description / Yahoo longBusinessSummary). */
  readonly description?: string;
  /** Company website (EODHD General.WebURL / Yahoo website). */
  readonly website?: string;
  readonly updatedAt?: string;
}

/**
 * Common screener values exposed directly by a fundamentals data provider.
 * More detailed balance-sheet, income-statement, and cash-flow fields live in
 * {@link FinancialStatements} so the provider does not silently invent ratios.
 */
export interface FundamentalMetrics {
  readonly marketCapitalization?: number;
  readonly enterpriseValue?: number;
  readonly enterpriseValueRevenue?: number;
  readonly enterpriseValueEbitda?: number;
  readonly trailingPe?: number;
  readonly forwardPe?: number;
  readonly pegRatio?: number;
  readonly priceSales?: number;
  readonly priceBook?: number;
  readonly bookValue?: number;
  readonly earningsPerShare?: number;
  readonly dilutedEpsTtm?: number;
  readonly ebitda?: number;
  readonly revenueTtm?: number;
  readonly revenuePerShareTtm?: number;
  readonly grossProfitTtm?: number;
  readonly quarterlyRevenueGrowthYoy?: number;
  readonly quarterlyEarningsGrowthYoy?: number;
  readonly profitMargin?: number;
  readonly operatingMarginTtm?: number;
  readonly returnOnAssetsTtm?: number;
  readonly returnOnEquityTtm?: number;
  readonly dividendPerShare?: number;
  readonly dividendYield?: number;
  readonly forwardAnnualDividendRate?: number;
  readonly forwardAnnualDividendYield?: number;
  readonly payoutRatio?: number;
  readonly sharesOutstanding?: number;
  readonly sharesFloat?: number;
  readonly percentInsiders?: number;
  /** Percentage points as published by EODHD (for example, 65.732). */
  readonly percentInstitutions?: number;
  readonly beta?: number;
  readonly fiftyTwoWeekHigh?: number;
  readonly fiftyTwoWeekLow?: number;
  readonly fiftyDayMovingAverage?: number;
  readonly twoHundredDayMovingAverage?: number;
}

export interface AnalystRatings {
  /** Provider rating scale; EODHD currently returns a numeric aggregate. */
  readonly rating?: number;
  readonly targetPrice?: number;
  readonly strongBuy?: number;
  readonly buy?: number;
  readonly hold?: number;
  readonly sell?: number;
  readonly strongSell?: number;
}

export interface OwnershipHolding {
  readonly holder: string;
  readonly reportedDate?: string;
  /** Percent of the issuer's shares, when reported by the provider. */
  readonly ownershipPercent?: number;
  /** Percent of the holder's assets, when reported by the provider. */
  readonly assetsPercent?: number;
  readonly shares?: number;
  readonly shareChange?: number;
  readonly shareChangePercent?: number;
}

export interface InsiderTransaction {
  readonly owner?: string;
  readonly transactionDate?: string;
  readonly transactionType?: string;
  readonly shares?: number;
  readonly value?: number;
  readonly price?: number;
}

export interface OwnershipSnapshot {
  readonly institutionalHolders: readonly OwnershipHolding[];
  readonly fundHolders: readonly OwnershipHolding[];
  readonly insiderTransactions: readonly InsiderTransaction[];
}

export type FinancialStatementValue = number | null;

export interface FinancialStatementPeriod {
  readonly date: string;
  readonly filingDate?: string;
  readonly currencySymbol?: string;
  /**
   * Original provider line item names, normalized to finite numbers or null.
   * Keeping the names avoids provider-specific assumptions in consumers.
   */
  readonly values: Readonly<Record<string, FinancialStatementValue>>;
}

export interface FinancialStatementSeries {
  readonly currencySymbol?: string;
  readonly quarterly: readonly FinancialStatementPeriod[];
  readonly yearly: readonly FinancialStatementPeriod[];
}

export interface FinancialStatements {
  readonly balanceSheet?: FinancialStatementSeries;
  readonly incomeStatement?: FinancialStatementSeries;
  readonly cashFlow?: FinancialStatementSeries;
}

export interface EarningsEvent {
  readonly ticker: string;
  readonly reportDate: string;
  readonly fiscalDate?: string;
  readonly timing?: string;
  readonly currency?: string;
  readonly actual?: number;
  readonly estimate?: number;
  readonly difference?: number;
  readonly surprisePercent?: number;
}

export interface DividendEvent {
  readonly ticker: string;
  /**
   * The date published by the provider. Its meaning is made explicit rather
   * than assuming a generic dividend date is a payment or ex-dividend date.
   */
  readonly date: string;
  readonly dateKind: "dividend" | "ex-dividend";
  readonly declarationDate?: string;
  readonly recordDate?: string;
  readonly paymentDate?: string;
  readonly period?: string;
  readonly amount?: number;
  readonly unadjustedAmount?: number;
  readonly currency?: string;
}

export interface StockSplit {
  readonly ticker: string;
  readonly date: string;
  readonly ratio?: number;
  readonly newShares?: number;
  readonly oldShares?: number;
}

export interface CorporateEvents {
  readonly ticker: string;
  readonly fetchedAt: string;
  readonly earnings: readonly EarningsEvent[];
  readonly dividends: readonly DividendEvent[];
  readonly splits: readonly StockSplit[];
}

export interface CompanyFundamentals {
  readonly provider: FundamentalsProviderId;
  readonly fetchedAt: string;
  readonly profile: CompanyProfile;
  readonly metrics: FundamentalMetrics;
  readonly analystRatings?: AnalystRatings;
  readonly ownership?: OwnershipSnapshot;
  readonly earningsHistory: readonly EarningsEvent[];
  readonly financials?: FinancialStatements;
  readonly nextDividendDate?: string;
  readonly nextExDividendDate?: string;
  readonly lastSplitDate?: string;
  readonly lastSplitFactor?: string;
}

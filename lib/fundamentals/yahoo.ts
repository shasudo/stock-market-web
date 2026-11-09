import {
  FundamentalsConfigurationError,
  FundamentalsProviderRequestError,
  type FundamentalsProvider,
} from "./provider";
import type {
  AnalystRatings,
  CompanyFundamentals,
  CompanyProfile,
  CorporateEvents,
  DateRange,
  DividendEvent,
  EarningsEvent,
  FinancialStatementPeriod,
  FinancialStatementSeries,
  FinancialStatements,
  FundamentalMetrics,
  FundamentalsCapability,
  OwnershipHolding,
  OwnershipSnapshot,
  StockSplit,
} from "./types";
import type {
  DefaultKeyStatistics,
  FinancialData,
  Ownership,
  QuoteSummaryResult,
  RecommendationTrend,
  SummaryDetail,
} from "yahoo-finance2/modules/quoteSummary";
import type {
  ChartEventDividend,
  ChartEventSplit,
  ChartResultArray,
} from "yahoo-finance2/modules/chart";
import type {
  FundamentalsTimeSeriesResult,
  FundamentalsTimeSeriesOptions,
} from "yahoo-finance2/modules/fundamentalsTimeSeries";

/**
 * The real yahoo-finance2 client structurally satisfies this. Narrowed to the
 * three methods this provider needs so tests can inject a fake without
 * depending on the library's full surface.
 */
export interface YahooFinanceClient {
  quoteSummary(
    symbol: string,
    options: { modules: string[] },
  ): Promise<QuoteSummaryResult>;
  chart(
    symbol: string,
    options: {
      period1: Date | string;
      period2?: Date | string;
      events?: string;
      return?: "array";
    },
  ): Promise<ChartResultArray>;
  fundamentalsTimeSeries(
    symbol: string,
    options: FundamentalsTimeSeriesOptions,
  ): Promise<FundamentalsTimeSeriesResult[]>;
}

const YAHOO_DEFAULT_EXCHANGE = "NSE";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EARLIEST_HISTORY_DATE = "1990-01-01";

/** These load in one request; if it fails, the ticker has no usable data. */
const CORE_MODULES = [
  "assetProfile",
  "quoteType",
  "price",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "calendarEvents",
];

/**
 * Best-effort supplementary data. Fetched as a second request so a symbol
 * missing one of these (funds, newly listed companies, thin ownership
 * coverage) does not take down the core profile and valuation metrics.
 */
const EXTENDED_MODULES = [
  "recommendationTrend",
  "institutionOwnership",
  "fundOwnership",
  "insiderTransactions",
  "earningsHistory",
];

export const YAHOO_FUNDAMENTALS_CAPABILITIES = [
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
] as const satisfies readonly FundamentalsCapability[];

/**
 * Yahoo Finance's data API is unofficial and undocumented (no published SLA,
 * no signup, no key). It can rate-limit, reshape, or block requests without
 * notice. Use it when avoiding a paid provider matters more than guaranteed
 * uptime.
 */
export const YAHOO_ENVIRONMENT_VARIABLES = [
  "FUNDAMENTALS_PROVIDER",
  "FUNDAMENTALS_DEFAULT_EXCHANGE",
  "FUNDAMENTALS_REQUEST_TIMEOUT_MS",
] as const;

export interface YahooFundamentalsConfiguration {
  readonly defaultExchange: string;
  readonly requestTimeoutMs: number;
}

export interface YahooFundamentalsProviderOptions extends YahooFundamentalsConfiguration {
  /** Injectable for tests; defaults to a lazily-created yahoo-finance2 client. */
  readonly client?: YahooFinanceClient;
}

/**
 * Yahoo needs no credentials, so it is available whenever it is the selected
 * (or default) provider. It never throws.
 */
export function isYahooFundamentalsConfigured(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const selectedProvider = optionalEnvironmentValue(
    environment.FUNDAMENTALS_PROVIDER,
  )?.toLowerCase();
  return selectedProvider === undefined || selectedProvider === "yahoo";
}

export function readYahooFundamentalsConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): YahooFundamentalsConfiguration {
  const selectedProvider = optionalEnvironmentValue(
    environment.FUNDAMENTALS_PROVIDER,
  )?.toLowerCase();
  if (selectedProvider !== undefined && selectedProvider !== "yahoo") {
    throw new FundamentalsConfigurationError(
      'FUNDAMENTALS_PROVIDER must be "yahoo" when creating the Yahoo fundamentals provider',
    );
  }

  const defaultExchange = normalizeExchange(
    optionalEnvironmentValue(environment.FUNDAMENTALS_DEFAULT_EXCHANGE) ??
      YAHOO_DEFAULT_EXCHANGE,
  );
  const requestTimeoutMs = parseTimeout(
    optionalEnvironmentValue(environment.FUNDAMENTALS_REQUEST_TIMEOUT_MS),
  );

  return { defaultExchange, requestTimeoutMs };
}

export function createYahooFundamentalsProviderFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): YahooFundamentalsProvider {
  return new YahooFundamentalsProvider(
    readYahooFundamentalsConfiguration(environment),
  );
}

/**
 * Converts the app's ticker conventions (RELIANCE.NSE / RELIANCE.NS /
 * RELIANCE.BSE / RELIANCE.BO / bare RELIANCE) into Yahoo's own suffixes
 * (RELIANCE.NS / RELIANCE.BO).
 */
export function toYahooTicker(
  ticker: string,
  defaultExchange = YAHOO_DEFAULT_EXCHANGE,
): string {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (normalizedTicker.length === 0) {
    throw new FundamentalsConfigurationError("A non-empty ticker is required");
  }
  if (/[/?#\s]/.test(normalizedTicker)) {
    throw new FundamentalsConfigurationError(
      `Ticker "${ticker}" contains unsupported characters`,
    );
  }

  const separatorIndex = normalizedTicker.lastIndexOf(".");
  const code =
    separatorIndex > 0
      ? normalizedTicker.slice(0, separatorIndex)
      : normalizedTicker;
  const suppliedExchange =
    separatorIndex > 0 ? normalizedTicker.slice(separatorIndex + 1) : undefined;

  if (code.length === 0) {
    throw new FundamentalsConfigurationError("A ticker code is required");
  }

  return `${code}.${mapExchangeToYahooSuffix(suppliedExchange ?? defaultExchange)}`;
}

export class YahooFundamentalsProvider implements FundamentalsProvider {
  public readonly id = "yahoo" as const;
  public readonly capabilities = YAHOO_FUNDAMENTALS_CAPABILITIES;

  private readonly defaultExchange: string;
  private readonly requestTimeoutMs: number;
  private client: YahooFinanceClient | undefined;

  public constructor(options: YahooFundamentalsProviderOptions) {
    this.defaultExchange = normalizeExchange(options.defaultExchange);
    this.requestTimeoutMs = parseTimeout(String(options.requestTimeoutMs));
    this.client = options.client;
  }

  public async getFundamentals(ticker: string): Promise<CompanyFundamentals> {
    const yahooTicker = this.normalizeTicker(ticker);
    const client = await this.getClient();

    // Core, extended and statement requests are independent: one round trip
    // instead of three keeps each symbol's refresh inside the cron budget.
    const [core, extended, financials] = await Promise.all([
      this.withTimeout(
        client.quoteSummary(yahooTicker, { modules: CORE_MODULES }),
        "quoteSummary (core)",
      ),
      this.bestEffort(
        client.quoteSummary(yahooTicker, { modules: EXTENDED_MODULES }),
      ),
      this.fetchFinancialStatements(yahooTicker),
    ]);

    return {
      provider: this.id,
      fetchedAt: new Date().toISOString(),
      profile: mapProfile(core, yahooTicker),
      metrics: mapMetrics(core),
      analystRatings: mapAnalystRatings(
        core.financialData,
        extended?.recommendationTrend,
      ),
      ownership: mapOwnership(extended),
      earningsHistory: mapEarningsHistory(
        extended?.earningsHistory,
        yahooTicker,
      ),
      financials,
      nextDividendDate: toIsoDateOrUndefined(core.calendarEvents?.dividendDate),
      nextExDividendDate: toIsoDateOrUndefined(
        core.calendarEvents?.exDividendDate,
      ),
      lastSplitDate: epochSecondsToIsoDateOrUndefined(
        core.defaultKeyStatistics?.lastSplitDate,
      ),
      lastSplitFactor: core.defaultKeyStatistics?.lastSplitFactor ?? undefined,
    };
  }

  public async getEarnings(ticker: string): Promise<readonly EarningsEvent[]> {
    const yahooTicker = this.normalizeTicker(ticker);
    const client = await this.getClient();
    const result = await this.withTimeout(
      client.quoteSummary(yahooTicker, { modules: ["calendarEvents"] }),
      "quoteSummary (calendarEvents)",
    );
    return mapUpcomingEarnings(result.calendarEvents, yahooTicker);
  }

  public async getDividends(
    ticker: string,
    range?: DateRange,
  ): Promise<readonly DividendEvent[]> {
    const yahooTicker = this.normalizeTicker(ticker);
    const chart = await this.fetchChartEvents(yahooTicker, "div", range);
    return mapDividends(chart.events?.dividends, yahooTicker);
  }

  public async getSplits(
    ticker: string,
    range?: DateRange,
  ): Promise<readonly StockSplit[]> {
    const yahooTicker = this.normalizeTicker(ticker);
    const chart = await this.fetchChartEvents(yahooTicker, "split", range);
    return mapSplits(chart.events?.splits, yahooTicker);
  }

  public async getCorporateEvents(
    ticker: string,
    range?: DateRange,
  ): Promise<CorporateEvents> {
    const yahooTicker = this.normalizeTicker(ticker);
    const [earnings, chart] = await Promise.all([
      this.getEarnings(yahooTicker),
      this.fetchChartEvents(yahooTicker, "div|split", range),
    ]);

    return {
      ticker: yahooTicker,
      fetchedAt: new Date().toISOString(),
      earnings,
      dividends: mapDividends(chart.events?.dividends, yahooTicker),
      splits: mapSplits(chart.events?.splits, yahooTicker),
    };
  }

  private normalizeTicker(ticker: string): string {
    return toYahooTicker(ticker, this.defaultExchange);
  }

  private async getClient(): Promise<YahooFinanceClient> {
    if (this.client) return this.client;
    const { default: YahooFinance } = await import("yahoo-finance2");
    this.client = new YahooFinance({
      suppressNotices: ["yahooSurvey"],
    }) as unknown as YahooFinanceClient;
    return this.client;
  }

  private async fetchChartEvents(
    yahooTicker: string,
    events: string,
    range: DateRange | undefined,
  ): Promise<ChartResultArray> {
    const client = await this.getClient();
    const { period1, period2 } = toChartPeriod(range);
    return this.withTimeout(
      client.chart(yahooTicker, { period1, period2, events, return: "array" }),
      `chart (${events})`,
    );
  }

  private async fetchFinancialStatements(
    yahooTicker: string,
  ): Promise<FinancialStatements | undefined> {
    const [balanceSheet, incomeStatement, cashFlow] = await Promise.all([
      this.fetchStatementSeries(yahooTicker, "balance-sheet"),
      this.fetchStatementSeries(yahooTicker, "financials"),
      this.fetchStatementSeries(yahooTicker, "cash-flow"),
    ]);

    if (
      balanceSheet === undefined &&
      incomeStatement === undefined &&
      cashFlow === undefined
    ) {
      return undefined;
    }

    return { balanceSheet, incomeStatement, cashFlow };
  }

  private async fetchStatementSeries(
    yahooTicker: string,
    module: "balance-sheet" | "financials" | "cash-flow",
  ): Promise<FinancialStatementSeries | undefined> {
    const [quarterly, yearly] = await Promise.all([
      this.fetchStatementPeriods(yahooTicker, module, "quarterly"),
      this.fetchStatementPeriods(yahooTicker, module, "annual"),
    ]);

    if (quarterly.length === 0 && yearly.length === 0) return undefined;
    return { quarterly, yearly };
  }

  private async fetchStatementPeriods(
    yahooTicker: string,
    module: "balance-sheet" | "financials" | "cash-flow",
    type: "quarterly" | "annual",
  ): Promise<readonly FinancialStatementPeriod[]> {
    const client = await this.getClient();
    const results = await this.bestEffort(
      client.fundamentalsTimeSeries(yahooTicker, {
        module,
        type,
        period1: EARLIEST_HISTORY_DATE,
        period2: new Date().toISOString().slice(0, 10),
      }),
    );

    return (results ?? [])
      .map(toFinancialStatementPeriod)
      .filter(
        (period): period is FinancialStatementPeriod => period !== undefined,
      )
      .sort((left, right) => right.date.localeCompare(left.date));
  }

  /** Times out and rethrows as a provider error; used for required calls. */
  private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new FundamentalsProviderRequestError(
            `Yahoo ${label} timed out after ${this.requestTimeoutMs}ms`,
          ),
        );
      }, this.requestTimeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } catch (error) {
      if (error instanceof FundamentalsProviderRequestError) throw error;
      throw new FundamentalsProviderRequestError(
        `Yahoo ${label} request failed: ${errorMessage(error)}`,
      );
    } finally {
      clearTimeout(timeoutHandle!);
    }
  }

  /** Swallows failure and returns undefined for optional/supplementary data. */
  private async bestEffort<T>(promise: Promise<T>): Promise<T | undefined> {
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error("timed out")),
        this.requestTimeoutMs,
      );
    });

    try {
      return await Promise.race([promise, timeout]);
    } catch {
      return undefined;
    } finally {
      clearTimeout(timeoutHandle!);
    }
  }
}

function mapExchangeToYahooSuffix(exchange: string): string {
  const normalized = exchange.trim().toUpperCase();
  if (normalized === "NSE" || normalized === "NS") return "NS";
  if (normalized === "BSE" || normalized === "BO") return "BO";
  return normalized;
}

function normalizeExchange(value: string): string {
  const exchange = value.trim().toUpperCase();
  if (!/^[A-Z0-9_]+$/.test(exchange)) {
    throw new FundamentalsConfigurationError(
      "FUNDAMENTALS_DEFAULT_EXCHANGE must contain only letters, digits, or underscores",
    );
  }
  return exchange;
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined) return 15_000;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120_000) {
    throw new FundamentalsConfigurationError(
      "FUNDAMENTALS_REQUEST_TIMEOUT_MS must be an integer between 1 and 120000",
    );
  }
  return timeout;
}

function optionalEnvironmentValue(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function toChartPeriod(range: DateRange | undefined): {
  period1: string;
  period2: string;
} {
  if (range?.from !== undefined && !DATE_PATTERN.test(range.from)) {
    throw new FundamentalsConfigurationError(
      "Corporate-event range.from must use YYYY-MM-DD",
    );
  }
  if (range?.to !== undefined && !DATE_PATTERN.test(range.to)) {
    throw new FundamentalsConfigurationError(
      "Corporate-event range.to must use YYYY-MM-DD",
    );
  }
  if (
    range?.from !== undefined &&
    range?.to !== undefined &&
    range.from > range.to
  ) {
    throw new FundamentalsConfigurationError(
      "Corporate-event range.from must not be after range.to",
    );
  }

  return {
    period1: range?.from ?? EARLIEST_HISTORY_DATE,
    period2: range?.to ?? new Date().toISOString().slice(0, 10),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toIsoDateOrUndefined(value: Date | undefined): string | undefined {
  if (value === undefined || Number.isNaN(value.getTime())) return undefined;
  return value.toISOString().slice(0, 10);
}

function epochSecondsToIsoDateOrUndefined(
  value: number | undefined,
): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return toIsoDateOrUndefined(new Date(value * 1000));
}

function percent(value: number | undefined): number | undefined {
  return value === undefined ? undefined : value * 100;
}

function mapProfile(
  core: QuoteSummaryResult,
  requestedTicker: string,
): CompanyProfile {
  const assetProfile = core.assetProfile;
  const quoteType = core.quoteType;
  const price = core.price;

  return {
    ticker: requestedTicker,
    code: quoteType?.symbol ?? price?.symbol,
    name:
      price?.longName ?? price?.shortName ?? quoteType?.longName ?? undefined,
    type: quoteType?.quoteType,
    exchange: price?.exchangeName ?? quoteType?.exchange,
    primaryTicker: quoteType?.symbol,
    currencyCode: price?.currency,
    countryName: assetProfile?.country,
    sector: assetProfile?.sector,
    industry: assetProfile?.industry,
    description: assetProfile?.longBusinessSummary ?? undefined,
    website: assetProfile?.website ?? undefined,
    ipoDate: toIsoDateOrUndefined(
      quoteType?.firstTradeDateEpochUtc ?? undefined,
    ),
    updatedAt: new Date().toISOString(),
  };
}

function mapMetrics(core: QuoteSummaryResult): FundamentalMetrics {
  const summaryDetail: SummaryDetail | undefined = core.summaryDetail;
  const keyStats: DefaultKeyStatistics | undefined = core.defaultKeyStatistics;
  const financialData: FinancialData | undefined = core.financialData;
  const marketCap = summaryDetail?.marketCap ?? core.price?.marketCap;

  return {
    marketCapitalization: marketCap,
    enterpriseValue: keyStats?.enterpriseValue,
    enterpriseValueRevenue: keyStats?.enterpriseToRevenue,
    enterpriseValueEbitda: keyStats?.enterpriseToEbitda,
    trailingPe: summaryDetail?.trailingPE,
    forwardPe: summaryDetail?.forwardPE ?? keyStats?.forwardPE,
    pegRatio: keyStats?.pegRatio,
    priceSales: summaryDetail?.priceToSalesTrailing12Months,
    priceBook: keyStats?.priceToBook,
    bookValue: keyStats?.bookValue,
    earningsPerShare: keyStats?.trailingEps,
    ebitda: financialData?.ebitda,
    revenueTtm: financialData?.totalRevenue,
    revenuePerShareTtm: financialData?.revenuePerShare,
    grossProfitTtm: financialData?.grossProfits,
    quarterlyRevenueGrowthYoy: financialData?.revenueGrowth,
    quarterlyEarningsGrowthYoy:
      financialData?.earningsGrowth ?? keyStats?.earningsQuarterlyGrowth,
    profitMargin: financialData?.profitMargins ?? keyStats?.profitMargins,
    operatingMarginTtm: financialData?.operatingMargins,
    returnOnAssetsTtm: financialData?.returnOnAssets,
    returnOnEquityTtm: financialData?.returnOnEquity,
    dividendPerShare: summaryDetail?.dividendRate,
    dividendYield: percent(summaryDetail?.dividendYield),
    forwardAnnualDividendRate: summaryDetail?.dividendRate,
    forwardAnnualDividendYield: percent(summaryDetail?.dividendYield),
    payoutRatio: percent(summaryDetail?.payoutRatio),
    sharesOutstanding: keyStats?.sharesOutstanding,
    sharesFloat: keyStats?.floatShares,
    percentInsiders: percent(keyStats?.heldPercentInsiders),
    percentInstitutions: percent(keyStats?.heldPercentInstitutions),
    beta: keyStats?.beta ?? summaryDetail?.beta,
    fiftyTwoWeekHigh: summaryDetail?.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: summaryDetail?.fiftyTwoWeekLow,
    fiftyDayMovingAverage: summaryDetail?.fiftyDayAverage,
    twoHundredDayMovingAverage: summaryDetail?.twoHundredDayAverage,
  };
}

function mapAnalystRatings(
  financialData: FinancialData | undefined,
  recommendationTrend: RecommendationTrend | undefined,
): AnalystRatings | undefined {
  const latest = recommendationTrend?.trend?.[0];

  const parsed: AnalystRatings = {
    rating: financialData?.recommendationMean,
    targetPrice: financialData?.targetMeanPrice,
    strongBuy: latest?.strongBuy,
    buy: latest?.buy,
    hold: latest?.hold,
    sell: latest?.sell,
    strongSell: latest?.strongSell,
  };

  return hasDefinedValue(parsed) ? parsed : undefined;
}

function mapOwnership(
  extended: QuoteSummaryResult | undefined,
): OwnershipSnapshot | undefined {
  if (extended === undefined) return undefined;

  const institutionalHolders = mapOwnershipList(extended.institutionOwnership);
  const fundHolders = mapOwnershipList(extended.fundOwnership);
  const insiderTransactions = (extended.insiderTransactions?.transactions ?? [])
    .map((transaction) => ({
      owner: transaction.filerName || undefined,
      transactionDate: toIsoDateOrUndefined(transaction.startDate),
      transactionType: transaction.transactionText || undefined,
      shares: transaction.shares,
      value: transaction.value,
    }))
    .filter((transaction) => transaction.owner !== undefined);

  if (
    institutionalHolders.length === 0 &&
    fundHolders.length === 0 &&
    insiderTransactions.length === 0
  ) {
    return undefined;
  }

  return { institutionalHolders, fundHolders, insiderTransactions };
}

function mapOwnershipList(
  ownership: Ownership | undefined,
): readonly OwnershipHolding[] {
  return (ownership?.ownershipList ?? [])
    .map((holding): OwnershipHolding | undefined => {
      if (!holding.organization) return undefined;
      return {
        holder: holding.organization,
        reportedDate: toIsoDateOrUndefined(holding.reportDate),
        ownershipPercent: percent(holding.pctHeld),
        shares: holding.position,
        shareChangePercent: holding.pctChange,
      };
    })
    .filter((holding): holding is OwnershipHolding => holding !== undefined);
}

function mapEarningsHistory(
  extended: QuoteSummaryResult["earningsHistory"] | undefined,
  requestedTicker: string,
): readonly EarningsEvent[] {
  return (extended?.history ?? [])
    .map((entry): EarningsEvent | undefined => {
      const reportDate = toIsoDateOrUndefined(entry.quarter ?? undefined);
      if (reportDate === undefined) return undefined;
      return {
        ticker: requestedTicker,
        reportDate,
        currency: entry.currency,
        actual: entry.epsActual ?? undefined,
        estimate: entry.epsEstimate ?? undefined,
        difference: entry.epsDifference ?? undefined,
        surprisePercent: entry.surprisePercent ?? undefined,
      };
    })
    .filter((event): event is EarningsEvent => event !== undefined)
    .sort((left, right) => right.reportDate.localeCompare(left.reportDate));
}

function mapUpcomingEarnings(
  calendarEvents: QuoteSummaryResult["calendarEvents"] | undefined,
  requestedTicker: string,
): readonly EarningsEvent[] {
  const earnings = calendarEvents?.earnings;
  if (earnings === undefined) return [];

  return earnings.earningsDate
    .map((date) => toIsoDateOrUndefined(date))
    .filter((reportDate): reportDate is string => reportDate !== undefined)
    .map((reportDate): EarningsEvent => ({
      ticker: requestedTicker,
      reportDate,
      estimate: earnings.earningsAverage,
    }))
    .sort((left, right) => right.reportDate.localeCompare(left.reportDate));
}

function mapDividends(
  dividends: readonly ChartEventDividend[] | undefined,
  requestedTicker: string,
): readonly DividendEvent[] {
  return (dividends ?? [])
    .map((event): DividendEvent | undefined => {
      const date = toIsoDateOrUndefined(event.date);
      if (date === undefined) return undefined;
      return {
        ticker: requestedTicker,
        date,
        dateKind: "ex-dividend",
        amount: event.amount,
      };
    })
    .filter((event): event is DividendEvent => event !== undefined)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function mapSplits(
  splits: readonly ChartEventSplit[] | undefined,
  requestedTicker: string,
): readonly StockSplit[] {
  return (splits ?? [])
    .map((event): StockSplit | undefined => {
      const date = toIsoDateOrUndefined(event.date);
      if (date === undefined) return undefined;
      return {
        ticker: requestedTicker,
        date,
        newShares: event.numerator,
        oldShares: event.denominator,
        ratio:
          event.denominator !== 0
            ? event.numerator / event.denominator
            : undefined,
      };
    })
    .filter((event): event is StockSplit => event !== undefined)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function toFinancialStatementPeriod(
  result: FundamentalsTimeSeriesResult,
): FinancialStatementPeriod | undefined {
  const date = toIsoDateOrUndefined((result as { date?: Date }).date);
  if (date === undefined) return undefined;

  const values: Record<string, number | null> = {};
  for (const [key, rawValue] of Object.entries(result)) {
    if (key === "date" || key === "TYPE" || key === "periodType") continue;
    values[key] =
      typeof rawValue === "number" && Number.isFinite(rawValue)
        ? rawValue
        : null;
  }

  return { date, values };
}

function hasDefinedValue(value: object): boolean {
  return Object.values(value).some((entry) => entry !== undefined);
}

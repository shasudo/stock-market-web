import {
  FundamentalsConfigurationError,
  FundamentalsProviderRequestError,
  FundamentalsProviderResponseError,
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
  InsiderTransaction,
  OwnershipHolding,
  OwnershipSnapshot,
  StockSplit,
} from "./types";

const EODHD_DEFAULT_BASE_URL = "https://eodhd.com";
const EODHD_DEFAULT_EXCHANGE = "NSE";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type UnknownRecord = Record<string, unknown>;

export const EODHD_FUNDAMENTALS_CAPABILITIES = [
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
 * These India-specific data sets are not documented by EODHD's global
 * fundamentals or calendar endpoints. Keep their screen columns disabled
 * until another provider is connected.
 */
export const EODHD_UNSUPPORTED_INDIAN_EQUITY_FIELDS = [
  "promoter holding and promoter pledge",
  "FII/DII and public shareholding classifications",
  "bonus issues and rights issues",
  "board-meeting dates",
  "bulk deals and block deals",
  "Indian credit-rating changes",
] as const;

/**
 * EODHD exposes these sections, but the vendor documents that not every
 * ticker reports every field. Treat missing data as unavailable per symbol.
 */
export const EODHD_BEST_EFFORT_FIELDS = [
  "analyst ratings and price targets",
  "institutional and fund ownership",
  "insider transactions",
  "earnings estimates and surprises",
  "extended dividend dates and payment details",
] as const;

export const EODHD_ENVIRONMENT_VARIABLES = [
  "FUNDAMENTALS_PROVIDER",
  "EODHD_API_TOKEN",
  "EODHD_BASE_URL",
  "FUNDAMENTALS_DEFAULT_EXCHANGE",
  "FUNDAMENTALS_REQUEST_TIMEOUT_MS",
] as const;

export interface EodhdFundamentalsConfiguration {
  readonly apiToken: string;
  readonly baseUrl: string;
  readonly defaultExchange: string;
  readonly requestTimeoutMs: number;
}

export interface EodhdFundamentalsProviderOptions extends EodhdFundamentalsConfiguration {
  /** Injectable for tests; defaults to the runtime Fetch implementation. */
  readonly fetchImplementation?: typeof fetch;
}

/**
 * Returns true only when the EODHD provider has been selected (or left as the
 * default) and an API token is present. It never throws, so callers can use it
 * for an optional provider integration.
 */
export function isEodhdFundamentalsConfigured(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const selectedProvider = optionalEnvironmentValue(
    environment.FUNDAMENTALS_PROVIDER,
  )?.toLowerCase();
  const token = optionalEnvironmentValue(environment.EODHD_API_TOKEN);

  return (
    token !== undefined &&
    (selectedProvider === undefined || selectedProvider === "eodhd")
  );
}

/**
 * Reads EODHD settings only when a provider instance is actually needed.
 * Importing this module remains safe without credentials.
 */
export function readEodhdFundamentalsConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): EodhdFundamentalsConfiguration {
  const selectedProvider = optionalEnvironmentValue(
    environment.FUNDAMENTALS_PROVIDER,
  )?.toLowerCase();
  if (selectedProvider !== undefined && selectedProvider !== "eodhd") {
    throw new FundamentalsConfigurationError(
      'FUNDAMENTALS_PROVIDER must be "eodhd" when creating the EODHD provider',
    );
  }

  const apiToken = optionalEnvironmentValue(environment.EODHD_API_TOKEN);
  if (apiToken === undefined) {
    throw new FundamentalsConfigurationError(
      "EODHD_API_TOKEN is required to use the EODHD fundamentals provider",
    );
  }

  const baseUrl = normalizeBaseUrl(
    optionalEnvironmentValue(environment.EODHD_BASE_URL) ??
      EODHD_DEFAULT_BASE_URL,
  );
  const defaultExchange = normalizeExchange(
    optionalEnvironmentValue(environment.FUNDAMENTALS_DEFAULT_EXCHANGE) ??
      EODHD_DEFAULT_EXCHANGE,
  );
  const requestTimeoutMs = parseTimeout(
    optionalEnvironmentValue(environment.FUNDAMENTALS_REQUEST_TIMEOUT_MS),
  );

  return { apiToken, baseUrl, defaultExchange, requestTimeoutMs };
}

export function createEodhdFundamentalsProviderFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): EodhdFundamentalsProvider {
  return new EodhdFundamentalsProvider(
    readEodhdFundamentalsConfiguration(environment),
  );
}

/**
 * Converts the app's Yahoo-style Indian tickers (RELIANCE.NS / RELIANCE.BO)
 * into EODHD's exchange format (RELIANCE.NSE / RELIANCE.BSE). Already
 * EODHD-qualified tickers are preserved.
 */
export function toEodhdTicker(
  ticker: string,
  defaultExchange = EODHD_DEFAULT_EXCHANGE,
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

  const exchange = normalizeExchange(
    mapYahooExchange(suppliedExchange) ?? defaultExchange,
  );
  return `${code}.${exchange}`;
}

export class EodhdFundamentalsProvider implements FundamentalsProvider {
  public readonly id = "eodhd" as const;
  public readonly capabilities = EODHD_FUNDAMENTALS_CAPABILITIES;

  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly defaultExchange: string;
  private readonly requestTimeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  public constructor(options: EodhdFundamentalsProviderOptions) {
    if (options.apiToken.trim().length === 0) {
      throw new FundamentalsConfigurationError(
        "EODHD_API_TOKEN must not be empty",
      );
    }

    this.apiToken = options.apiToken.trim();
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.defaultExchange = normalizeExchange(options.defaultExchange);
    this.requestTimeoutMs = parseTimeout(String(options.requestTimeoutMs));
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  public async getFundamentals(ticker: string): Promise<CompanyFundamentals> {
    const eodhdTicker = this.normalizeTicker(ticker);
    const payload = await this.request(
      `/api/v1.1/fundamentals/${encodeURIComponent(eodhdTicker)}`,
    );

    return parseFundamentals(payload, eodhdTicker);
  }

  public async getEarnings(ticker: string): Promise<readonly EarningsEvent[]> {
    const eodhdTicker = this.normalizeTicker(ticker);
    const payload = await this.request("/api/calendar/earnings", {
      symbols: eodhdTicker,
    });

    return parseCalendarEarnings(payload, eodhdTicker);
  }

  public async getDividends(
    ticker: string,
    range?: DateRange,
  ): Promise<readonly DividendEvent[]> {
    const eodhdTicker = this.normalizeTicker(ticker);
    const payload = await this.request(
      `/api/div/${encodeURIComponent(eodhdTicker)}`,
      toRangeQuery(range),
    );

    return parseDividends(payload, eodhdTicker);
  }

  public async getSplits(
    ticker: string,
    range?: DateRange,
  ): Promise<readonly StockSplit[]> {
    const eodhdTicker = this.normalizeTicker(ticker);
    const payload = await this.request(
      `/api/splits/${encodeURIComponent(eodhdTicker)}`,
      toRangeQuery(range),
    );

    return parseSplits(payload, eodhdTicker);
  }

  public async getCorporateEvents(
    ticker: string,
    range?: DateRange,
  ): Promise<CorporateEvents> {
    const eodhdTicker = this.normalizeTicker(ticker);
    const [earnings, dividends, splits] = await Promise.all([
      this.getEarnings(eodhdTicker),
      this.getCorporateDividends(eodhdTicker, range),
      this.getCalendarSplits(eodhdTicker, range),
    ]);

    return {
      ticker: eodhdTicker,
      fetchedAt: new Date().toISOString(),
      earnings,
      dividends,
      splits,
    };
  }

  private normalizeTicker(ticker: string): string {
    return toEodhdTicker(ticker, this.defaultExchange);
  }

  /**
   * EODHD's historical /div endpoint explicitly exposes ex-dividend dates,
   * whereas the calendar endpoint exposes generic dividend dates (including
   * upcoming records). Preserve both meanings so a caller never treats one as
   * the other.
   */
  private async getCorporateDividends(
    ticker: string,
    range?: DateRange,
  ): Promise<readonly DividendEvent[]> {
    const [exDividends, dividends] = await Promise.all([
      this.getDividends(ticker, range),
      this.getCalendarDividends(ticker, range),
    ]);
    return [...exDividends, ...dividends];
  }

  private async getCalendarDividends(
    ticker: string,
    range?: DateRange,
  ): Promise<readonly DividendEvent[]> {
    const eodhdTicker = this.normalizeTicker(ticker);
    const payload = await this.request("/api/calendar/dividends", {
      "filter[symbol]": eodhdTicker,
      ...toCalendarDividendRangeQuery(range),
      "page[limit]": "1000",
    });
    return parseCalendarDividends(payload, eodhdTicker);
  }

  private async getCalendarSplits(
    ticker: string,
    range?: DateRange,
  ): Promise<readonly StockSplit[]> {
    const eodhdTicker = this.normalizeTicker(ticker);
    const payload = await this.request("/api/calendar/splits", {
      symbols: eodhdTicker,
      ...toRangeQuery(range),
    });
    return parseCalendarSplits(payload, eodhdTicker);
  }

  private async request(
    path: string,
    query: Readonly<Record<string, string>> = {},
  ): Promise<unknown> {
    const url = new URL(path, this.baseUrl);
    url.searchParams.set("api_token", this.apiToken);
    url.searchParams.set("fmt", "json");
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      this.requestTimeoutMs,
    );

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        headers: { Accept: "application/json" },
        signal: abortController.signal,
      });
    } catch {
      const reason = abortController.signal.aborted
        ? `timed out after ${this.requestTimeoutMs}ms`
        : "could not reach the provider";
      throw new FundamentalsProviderRequestError(`EODHD request ${reason}`);
    } finally {
      clearTimeout(timeout);
    }

    const body = await response.text();
    if (!response.ok) {
      throw new FundamentalsProviderRequestError(
        `EODHD returned HTTP ${response.status}: ${responseErrorMessage(body)}`,
        response.status,
      );
    }

    if (body.trim().length === 0) {
      throw new FundamentalsProviderResponseError(
        "EODHD returned an empty response",
      );
    }

    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new FundamentalsProviderResponseError(
        "EODHD returned invalid JSON",
      );
    }
  }
}

function parseFundamentals(
  payload: unknown,
  requestedTicker: string,
): CompanyFundamentals {
  const root = requireRecord(payload, "fundamentals response");
  assertNoProviderError(root);

  const general = requireRecord(root.General, "fundamentals General section");
  const splitsDividends = asRecord(root.SplitsDividends);

  return {
    provider: "eodhd",
    fetchedAt: new Date().toISOString(),
    profile: parseProfile(general, requestedTicker),
    metrics: parseMetrics(root),
    analystRatings: parseAnalystRatings(root.AnalystRatings),
    ownership: parseOwnership(root.Holders, root.InsiderTransactions),
    earningsHistory: parseEarningsHistory(root.Earnings, requestedTicker),
    financials: parseFinancials(root.Financials),
    nextDividendDate: getString(splitsDividends, "DividendDate"),
    nextExDividendDate: getString(splitsDividends, "ExDividendDate"),
    lastSplitDate: getString(splitsDividends, "LastSplitDate"),
    lastSplitFactor: getString(splitsDividends, "LastSplitFactor"),
  };
}

function parseProfile(
  general: UnknownRecord,
  requestedTicker: string,
): CompanyProfile {
  return {
    ticker: requestedTicker,
    code: getString(general, "Code"),
    name: getString(general, "Name"),
    type: getString(general, "Type"),
    exchange: getString(general, "Exchange"),
    primaryTicker: getString(general, "PrimaryTicker"),
    currencyCode: getString(general, "CurrencyCode"),
    countryCode: getString(general, "CountryISO"),
    countryName: getString(general, "CountryName"),
    sector: getString(general, "Sector"),
    industry: getString(general, "Industry"),
    subIndustry: getString(general, "GicSubIndustry"),
    isin: getString(general, "ISIN"),
    fiscalYearEnd: getString(general, "FiscalYearEnd"),
    ipoDate: getString(general, "IPODate"),
    description: getString(general, "Description"),
    website: getString(general, "WebURL"),
    updatedAt: getString(general, "UpdatedAt"),
  };
}

function parseMetrics(root: UnknownRecord): FundamentalMetrics {
  const highlights = asRecord(root.Highlights);
  const valuation = asRecord(root.Valuation);
  const sharesStats = asRecord(root.SharesStats);
  const technicals = asRecord(root.Technicals);
  const splitsDividends = asRecord(root.SplitsDividends);

  return {
    marketCapitalization: getNumber(highlights, "MarketCapitalization"),
    enterpriseValue: getNumber(valuation, "EnterpriseValue"),
    enterpriseValueRevenue: getNumber(valuation, "EnterpriseValueRevenue"),
    enterpriseValueEbitda: getNumber(valuation, "EnterpriseValueEbitda"),
    trailingPe: getNumber(valuation, "TrailingPE"),
    forwardPe: getNumber(valuation, "ForwardPE"),
    pegRatio: getNumber(highlights, "PEGRatio"),
    priceSales: getNumber(valuation, "PriceSalesTTM"),
    priceBook: getNumber(valuation, "PriceBookMRQ"),
    bookValue: getNumber(highlights, "BookValue"),
    earningsPerShare: getNumber(highlights, "EarningsShare"),
    dilutedEpsTtm: getNumber(highlights, "DilutedEpsTTM"),
    ebitda: getNumber(highlights, "EBITDA"),
    revenueTtm: getNumber(highlights, "RevenueTTM"),
    revenuePerShareTtm: getNumber(highlights, "RevenuePerShareTTM"),
    grossProfitTtm: getNumber(highlights, "GrossProfitTTM"),
    quarterlyRevenueGrowthYoy: getNumber(
      highlights,
      "QuarterlyRevenueGrowthYOY",
    ),
    quarterlyEarningsGrowthYoy: getNumber(
      highlights,
      "QuarterlyEarningsGrowthYOY",
    ),
    profitMargin: getNumber(highlights, "ProfitMargin"),
    operatingMarginTtm: getNumber(highlights, "OperatingMarginTTM"),
    returnOnAssetsTtm: getNumber(highlights, "ReturnOnAssetsTTM"),
    returnOnEquityTtm: getNumber(highlights, "ReturnOnEquityTTM"),
    dividendPerShare: getNumber(highlights, "DividendShare"),
    dividendYield: getNumber(highlights, "DividendYield"),
    forwardAnnualDividendRate: getNumber(
      splitsDividends,
      "ForwardAnnualDividendRate",
    ),
    forwardAnnualDividendYield: getNumber(
      splitsDividends,
      "ForwardAnnualDividendYield",
    ),
    payoutRatio: getNumber(splitsDividends, "PayoutRatio"),
    sharesOutstanding: getNumber(sharesStats, "SharesOutstanding"),
    sharesFloat: getNumber(sharesStats, "SharesFloat"),
    percentInsiders: getNumber(sharesStats, "PercentInsiders"),
    percentInstitutions: getNumber(sharesStats, "PercentInstitutions"),
    beta: getNumber(technicals, "Beta"),
    fiftyTwoWeekHigh: getNumber(technicals, "52WeekHigh"),
    fiftyTwoWeekLow: getNumber(technicals, "52WeekLow"),
    fiftyDayMovingAverage: getNumber(technicals, "50DayMA"),
    twoHundredDayMovingAverage: getNumber(technicals, "200DayMA"),
  };
}

function parseAnalystRatings(value: unknown): AnalystRatings | undefined {
  const ratings = asRecord(value);
  if (ratings === undefined) {
    return undefined;
  }

  const parsed: AnalystRatings = {
    rating: getNumber(ratings, "Rating"),
    targetPrice: getNumber(ratings, "TargetPrice"),
    strongBuy: getNumber(ratings, "StrongBuy"),
    buy: getNumber(ratings, "Buy"),
    hold: getNumber(ratings, "Hold"),
    sell: getNumber(ratings, "Sell"),
    strongSell: getNumber(ratings, "StrongSell"),
  };

  return hasDefinedValue(parsed) ? parsed : undefined;
}

function parseOwnership(
  value: unknown,
  insiderTransactionsValue: unknown,
): OwnershipSnapshot | undefined {
  const holders = asRecord(value) ?? {};

  const institutionalHolders = recordsFromCollection(holders.Institutions)
    .map(parseOwnershipHolding)
    .filter((holding): holding is OwnershipHolding => holding !== undefined);
  const fundHolders = recordsFromCollection(holders.Funds)
    .map(parseOwnershipHolding)
    .filter((holding): holding is OwnershipHolding => holding !== undefined);
  const insiderTransactions = recordsFromCollection(
    insiderTransactionsValue ?? holders.InsiderTransactions,
  )
    .map(parseInsiderTransaction)
    .filter(
      (transaction): transaction is NonNullable<typeof transaction> =>
        transaction !== undefined,
    );

  if (
    institutionalHolders.length === 0 &&
    fundHolders.length === 0 &&
    insiderTransactions.length === 0
  ) {
    return undefined;
  }

  return { institutionalHolders, fundHolders, insiderTransactions };
}

function parseOwnershipHolding(
  value: UnknownRecord,
): OwnershipHolding | undefined {
  const holder = getString(value, "name") ?? getString(value, "Name");
  if (holder === undefined) {
    return undefined;
  }

  return {
    holder,
    reportedDate: getString(value, "date") ?? getString(value, "Date"),
    ownershipPercent:
      getNumber(value, "totalShares") ?? getNumber(value, "TotalShares"),
    assetsPercent:
      getNumber(value, "totalAssets") ?? getNumber(value, "TotalAssets"),
    shares:
      getNumber(value, "currentShares") ?? getNumber(value, "CurrentShares"),
    shareChange: getNumber(value, "change") ?? getNumber(value, "Change"),
    shareChangePercent:
      getNumber(value, "change_p") ?? getNumber(value, "ChangeP"),
  };
}

function parseInsiderTransaction(
  value: UnknownRecord,
): InsiderTransaction | undefined {
  const parsed = {
    owner:
      getString(value, "ownerName") ??
      getString(value, "owner_name") ??
      getString(value, "name"),
    transactionDate:
      getString(value, "transactionDate") ??
      getString(value, "transaction_date") ??
      getString(value, "date"),
    transactionType:
      getString(value, "transactionType") ??
      getString(value, "transaction_type"),
    shares: getNumber(value, "shares") ?? getNumber(value, "transactionShares"),
    value: getNumber(value, "value") ?? getNumber(value, "transactionValue"),
    price: getNumber(value, "price") ?? getNumber(value, "transactionPrice"),
  };

  return hasDefinedValue(parsed) ? parsed : undefined;
}

function parseEarningsHistory(
  value: unknown,
  requestedTicker: string,
): readonly EarningsEvent[] {
  const earnings = asRecord(value);
  const history =
    earnings === undefined ? undefined : asRecord(earnings.History);
  if (history === undefined) {
    return [];
  }

  return recordsFromCollection(history)
    .map((event) => parseEarningsEvent(event, requestedTicker))
    .filter((event): event is EarningsEvent => event !== undefined)
    .sort((left, right) => right.reportDate.localeCompare(left.reportDate));
}

function parseFinancials(value: unknown): FinancialStatements | undefined {
  const financials = asRecord(value);
  if (financials === undefined) {
    return undefined;
  }

  const parsed: FinancialStatements = {
    balanceSheet: parseFinancialStatementSeries(financials.Balance_Sheet),
    incomeStatement: parseFinancialStatementSeries(financials.Income_Statement),
    cashFlow: parseFinancialStatementSeries(financials.Cash_Flow),
  };

  return hasDefinedValue(parsed) ? parsed : undefined;
}

function parseFinancialStatementSeries(
  value: unknown,
): FinancialStatementSeries | undefined {
  const series = asRecord(value);
  if (series === undefined) {
    return undefined;
  }

  return {
    currencySymbol: getString(series, "currency_symbol"),
    quarterly: parseFinancialStatementPeriods(series.quarterly),
    yearly: parseFinancialStatementPeriods(series.yearly),
  };
}

function parseFinancialStatementPeriods(
  value: unknown,
): readonly FinancialStatementPeriod[] {
  return recordEntries(value)
    .map(([fallbackDate, period]): FinancialStatementPeriod | undefined => {
      const date = getString(period, "date") ?? fallbackDate;
      if (!DATE_PATTERN.test(date)) {
        return undefined;
      }

      const values: Record<string, number | null> = {};
      for (const [key, rawValue] of Object.entries(period)) {
        if (
          key === "date" ||
          key === "filing_date" ||
          key === "currency_symbol"
        ) {
          continue;
        }
        values[key] = toFinancialStatementNumber(rawValue);
      }

      return {
        date,
        filingDate: getString(period, "filing_date"),
        currencySymbol: getString(period, "currency_symbol"),
        values,
      };
    })
    .filter(
      (period): period is FinancialStatementPeriod => period !== undefined,
    )
    .sort((left, right) => right.date.localeCompare(left.date));
}

function parseCalendarEarnings(
  payload: unknown,
  requestedTicker: string,
): readonly EarningsEvent[] {
  const root = requireRecord(payload, "earnings calendar response");
  assertNoProviderError(root);

  return recordsFromCollection(root.earnings)
    .map((event) => parseEarningsEvent(event, requestedTicker))
    .filter((event): event is EarningsEvent => event !== undefined)
    .sort((left, right) => right.reportDate.localeCompare(left.reportDate));
}

function parseEarningsEvent(
  value: UnknownRecord,
  requestedTicker: string,
): EarningsEvent | undefined {
  const reportDate =
    getString(value, "reportDate") ??
    getString(value, "report_date") ??
    getString(value, "date");
  if (reportDate === undefined) {
    return undefined;
  }

  return {
    ticker:
      getString(value, "code") ?? getString(value, "Code") ?? requestedTicker,
    reportDate,
    fiscalDate: getString(value, "date"),
    timing:
      getString(value, "beforeAfterMarket") ??
      getString(value, "before_after_market"),
    currency: getString(value, "currency"),
    actual: getNumber(value, "epsActual") ?? getNumber(value, "actual"),
    estimate: getNumber(value, "epsEstimate") ?? getNumber(value, "estimate"),
    difference:
      getNumber(value, "epsDifference") ?? getNumber(value, "difference"),
    surprisePercent:
      getNumber(value, "surprisePercent") ?? getNumber(value, "percent"),
  };
}

function parseDividends(
  payload: unknown,
  requestedTicker: string,
): readonly DividendEvent[] {
  if (!Array.isArray(payload)) {
    const root = requireRecord(payload, "dividends response");
    assertNoProviderError(root);
    throw new FundamentalsProviderResponseError(
      "EODHD dividends response did not contain an array",
    );
  }

  return payload
    .map(asRecord)
    .filter((event): event is UnknownRecord => event !== undefined)
    .map((event): DividendEvent | undefined => {
      const date = getString(event, "date");
      if (date === undefined) {
        return undefined;
      }

      return {
        ticker: requestedTicker,
        date,
        dateKind: "ex-dividend",
        declarationDate: getString(event, "declarationDate"),
        recordDate: getString(event, "recordDate"),
        paymentDate: getString(event, "paymentDate"),
        period: getString(event, "period"),
        amount: getNumber(event, "value"),
        unadjustedAmount: getNumber(event, "unadjustedValue"),
        currency: getString(event, "currency"),
      };
    })
    .filter((event): event is DividendEvent => event !== undefined)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function parseCalendarDividends(
  payload: unknown,
  requestedTicker: string,
): readonly DividendEvent[] {
  const root = requireRecord(payload, "dividend calendar response");
  assertNoProviderError(root);
  if (!Array.isArray(root.data)) {
    throw new FundamentalsProviderResponseError(
      "EODHD dividend calendar response did not contain a data array",
    );
  }

  return root.data
    .map(asRecord)
    .filter((event): event is UnknownRecord => event !== undefined)
    .map((event): DividendEvent | undefined => {
      const date = getString(event, "date");
      if (date === undefined) return undefined;
      return {
        ticker:
          getString(event, "symbol") ??
          getString(event, "code") ??
          requestedTicker,
        date,
        // The calendar documentation calls this a "Dividend date". It does
        // not establish that it is a payment or an ex-dividend date.
        dateKind: "dividend",
      };
    })
    .filter((event): event is DividendEvent => event !== undefined)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function parseCalendarSplits(
  payload: unknown,
  requestedTicker: string,
): readonly StockSplit[] {
  const root = requireRecord(payload, "split calendar response");
  assertNoProviderError(root);
  if (!Array.isArray(root.splits)) {
    throw new FundamentalsProviderResponseError(
      "EODHD split calendar response did not contain a splits array",
    );
  }

  return root.splits
    .map(asRecord)
    .filter((event): event is UnknownRecord => event !== undefined)
    .map((event) => parseSplit(event, requestedTicker))
    .filter((event): event is StockSplit => event !== undefined)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function parseSplits(
  payload: unknown,
  requestedTicker: string,
): readonly StockSplit[] {
  if (!Array.isArray(payload)) {
    const root = requireRecord(payload, "splits response");
    assertNoProviderError(root);
    throw new FundamentalsProviderResponseError(
      "EODHD splits response did not contain an array",
    );
  }

  return payload
    .map(asRecord)
    .filter((event): event is UnknownRecord => event !== undefined)
    .map((event) => parseSplit(event, requestedTicker))
    .filter((event): event is StockSplit => event !== undefined)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function parseSplit(
  value: UnknownRecord,
  requestedTicker: string,
): StockSplit | undefined {
  const date = getString(value, "date") ?? getString(value, "split_date");
  if (date === undefined) {
    return undefined;
  }

  let newShares =
    getNumber(value, "new_shares") ?? getNumber(value, "newShares");
  let oldShares =
    getNumber(value, "old_shares") ?? getNumber(value, "oldShares");

  if (newShares === undefined || oldShares === undefined) {
    const split = getString(value, "split");
    const parts = split?.split("/");
    if (parts?.length === 2) {
      newShares ??= toFiniteNumber(parts[0]);
      oldShares ??= toFiniteNumber(parts[1]);
    }
  }

  return {
    ticker: requestedTicker,
    date,
    newShares,
    oldShares,
    ratio:
      newShares !== undefined && oldShares !== undefined && oldShares !== 0
        ? newShares / oldShares
        : undefined,
  };
}

function toRangeQuery(range: DateRange | undefined): Record<string, string> {
  if (range === undefined) {
    return {};
  }

  if (range.from !== undefined && !DATE_PATTERN.test(range.from)) {
    throw new FundamentalsConfigurationError(
      "Corporate-event range.from must use YYYY-MM-DD",
    );
  }
  if (range.to !== undefined && !DATE_PATTERN.test(range.to)) {
    throw new FundamentalsConfigurationError(
      "Corporate-event range.to must use YYYY-MM-DD",
    );
  }
  if (
    range.from !== undefined &&
    range.to !== undefined &&
    range.from > range.to
  ) {
    throw new FundamentalsConfigurationError(
      "Corporate-event range.from must not be after range.to",
    );
  }

  return {
    ...(range.from === undefined ? {} : { from: range.from }),
    ...(range.to === undefined ? {} : { to: range.to }),
  };
}

function toCalendarDividendRangeQuery(
  range: DateRange | undefined,
): Record<string, string> {
  const normalized = toRangeQuery(range);
  return {
    ...(normalized.from === undefined
      ? {}
      : { "filter[date_from]": normalized.from }),
    ...(normalized.to === undefined
      ? {}
      : { "filter[date_to]": normalized.to }),
  };
}

function optionalEnvironmentValue(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function normalizeBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new FundamentalsConfigurationError(
      "EODHD_BASE_URL must be a valid HTTP(S) URL",
    );
  }
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

function mapYahooExchange(exchange: string | undefined): string | undefined {
  if (exchange === "NS") {
    return "NSE";
  }
  if (exchange === "BO") {
    return "BSE";
  }
  return exchange;
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined) {
    return 15_000;
  }
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120_000) {
    throw new FundamentalsConfigurationError(
      "FUNDAMENTALS_REQUEST_TIMEOUT_MS must be an integer between 1 and 120000",
    );
  }
  return timeout;
}

function requireRecord(value: unknown, context: string): UnknownRecord {
  const record = asRecord(value);
  if (record === undefined) {
    throw new FundamentalsProviderResponseError(
      `EODHD ${context} was not a JSON object`,
    );
  }
  return record;
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function assertNoProviderError(record: UnknownRecord): void {
  const message =
    getString(record, "error") ??
    getString(record, "Error") ??
    getString(record, "message") ??
    getString(record, "Message");
  if (message !== undefined) {
    throw new FundamentalsProviderResponseError(
      `EODHD returned an error: ${message}`,
    );
  }
}

function getString(
  record: UnknownRecord | undefined,
  key: string,
): string | undefined {
  const value = record?.[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === "NA" ? undefined : trimmed;
}

function getNumber(
  record: UnknownRecord | undefined,
  key: string,
): number | undefined {
  return toFiniteNumber(record?.[key]);
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value === "NA"
  ) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toFinancialStatementNumber(value: unknown): number | null {
  return toFiniteNumber(value) ?? null;
}

function recordsFromCollection(value: unknown): readonly UnknownRecord[] {
  return recordEntries(value).map(([, record]) => record);
}

function recordEntries(
  value: unknown,
): readonly (readonly [string, UnknownRecord])[] {
  if (Array.isArray(value)) {
    return value
      .map((entry, index) => {
        const record = asRecord(entry);
        return record === undefined
          ? undefined
          : ([String(index), record] as const);
      })
      .filter(
        (entry): entry is readonly [string, UnknownRecord] =>
          entry !== undefined,
      );
  }

  const record = asRecord(value);
  if (record === undefined) {
    return [];
  }
  return Object.entries(record)
    .map(([key, entry]) => {
      const nested = asRecord(entry);
      return nested === undefined ? undefined : ([key, nested] as const);
    })
    .filter(
      (entry): entry is readonly [string, UnknownRecord] => entry !== undefined,
    );
}

function hasDefinedValue(value: object): boolean {
  return Object.values(value).some((entry) => entry !== undefined);
}

function responseErrorMessage(body: string): string {
  try {
    const parsed = asRecord(JSON.parse(body) as unknown);
    const message =
      parsed === undefined
        ? undefined
        : (getString(parsed, "error") ??
          getString(parsed, "Error") ??
          getString(parsed, "message") ??
          getString(parsed, "Message"));
    if (message !== undefined) {
      return message;
    }
  } catch {
    // Fall through to the bounded plain-text response below.
  }

  const normalized = body.replace(/\s+/g, " ").trim();
  return normalized.length === 0
    ? "no response body"
    : normalized.slice(0, 300);
}

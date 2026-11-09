import type {
  CompanyFundamentals,
  CorporateEvents,
  DateRange,
  DividendEvent,
  EarningsEvent,
  FundamentalsCapability,
  FundamentalsProviderId,
  StockSplit,
} from "./types";

/** A replaceable boundary for non-broker fundamentals and corporate-event data. */
export interface FundamentalsProvider {
  readonly id: FundamentalsProviderId;
  readonly capabilities: readonly FundamentalsCapability[];

  getFundamentals(ticker: string): Promise<CompanyFundamentals>;
  getEarnings(ticker: string): Promise<readonly EarningsEvent[]>;
  getDividends(
    ticker: string,
    range?: DateRange,
  ): Promise<readonly DividendEvent[]>;
  getSplits(ticker: string, range?: DateRange): Promise<readonly StockSplit[]>;
  getCorporateEvents(
    ticker: string,
    range?: DateRange,
  ): Promise<CorporateEvents>;
}

export class FundamentalsConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "FundamentalsConfigurationError";
  }
}

export class FundamentalsProviderRequestError extends Error {
  public constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "FundamentalsProviderRequestError";
  }
}

export class FundamentalsProviderResponseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "FundamentalsProviderResponseError";
  }
}

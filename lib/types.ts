/** Wire mirrors of the Java ApiResponse envelope and the market DTOs the
 *  terminal reads. Field names match the backend exactly; presentation
 *  formatting lives in lib/format.ts. */

export interface ApiEnvelope<T> {
  success: boolean;
  message: string | null;
  data: T | null;
  errors: Record<string, string[]> | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: string | null;

  constructor(status: number, message: string, body: string | null = null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export interface NseIndexRow {
  name: string;
  symbol: string;
  group: string;
  tabs: string[];
  last: number | null;
  change: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null;
  advances: number | null;
  declines: number | null;
  unchanged: number | null;
  change1w: number | null;
  change1m: number | null;
  change1y: number | null;
  hasConstituents: boolean;
}

export interface IndexListResponse {
  indices: NseIndexRow[];
  marketAdvances: number | null;
  marketDeclines: number | null;
  marketUnchanged: number | null;
  asOf: string | null;
  generatedAt: string | null;
  degraded: boolean;
}

export interface BseIndexRow {
  securityId: number;
  name: string;
  tabs: string[];
  last: number | null;
  change: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  high52: number | null;
  low52: number | null;
}

export interface BseIndexResponse {
  indices: BseIndexRow[];
  advancing: number | null;
  declining: number | null;
  lastSyncAt: string | null;
  historyPending: boolean;
  generatedAt: string | null;
}

export interface IpoItem {
  symbol: string | null;
  companyName: string;
  segment: string | null;
  status: string | null;
  openDate: string | null;
  closeDate: string | null;
  listingDate: string | null;
  priceLow: number | null;
  priceHigh: number | null;
  issuePrice: number | null;
  lotSize: number | null;
  issueSizeCr: number | null;
}

export interface IpoResponse {
  open: IpoItem[];
  upcoming: IpoItem[];
  closed: IpoItem[];
  listed: IpoItem[];
  generatedAt: string | null;
  pending: boolean;
  degraded: string[];
}

export interface ChainLeg {
  ltp: number | null;
  change: number | null;
  changePct: number | null;
  oi: number | null;
  oiChange: number | null;
  oiChangePct: number | null;
  volume: number | null;
  iv: number | null;
  bid: number | null;
  ask: number | null;
  bidQty: number | null;
  askQty: number | null;
}

export interface ChainRow {
  strike: number;
  call: ChainLeg | null;
  put: ChainLeg | null;
}

export interface ChainResponse {
  symbol: string;
  expiry: string;
  underlyingValue: number | null;
  asOf: string | null;
  rows: ChainRow[];
  totals: { callOi: number; putOi: number; callVolume: number; putVolume: number } | null;
  pcr: number | null;
  volumePcr: number | null;
  maxPain: number | null;
  atmStrike: number | null;
  expiries: string[];
  lotSize: number | null;
}

export interface InstrumentQuote {
  securityId: number;
  exchange: string;
  tradingSymbol: string;
  displayName: string;
  lastPrice: number;
  prevClose: number;
  open: number | null;
  high: number | null;
  low: number | null;
  netChange: number;
  pctChange: number;
  prevDay: number | null;
  oneWeekAgo: number | null;
  oneMonthAgo: number | null;
  oneYearAgo: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

export interface IndexQuotesResponse {
  indices: InstrumentQuote[];
  lastSyncAt: string | null;
}

export interface StockQuote {
  id: string;
  securityId: number;
  exchange: string;
  exchangeSegment: string;
  companyName: string;
  tradingSymbol: string;
  sector: string | null;
  industry: string | null;
  group: string | null;
  faceValue: number | null;
  priceBand: string | null;
  marketCap: string | null;
  preClose: number | null;
  cmp: number | null;
  netChange: number | null;
  percentChange: number | null;
  week52High: number | null;
  week52Low: number | null;
  volume: number | null;
  ath: boolean | null;
  atl: boolean | null;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalStocks: number;
  totalPages: number;
}

export interface LiveMarketResponse {
  stocks: StockQuote[];
  pagination: Pagination;
  stats: {
    totalGainers: number;
    totalLosers: number;
    totalUnchanged: number;
    avgGain: number;
    avgLoss: number;
  } | null;
  filteredCounts: {
    total: number;
    gainers: number;
    losers: number;
    unchanged: number;
    highHits: number;
    lowHits: number;
  } | null;
  lastSyncAt: string | null;
  syncStatus: string | null;
}

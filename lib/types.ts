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
  readonly fields: Record<string, string[]> | null;

  constructor(
    status: number,
    message: string,
    body: string | null = null,
    fields: Record<string, string[]> | null = null,
  ) {
    super(message);
    this.status = status;
    this.body = body;
    this.fields = fields;
  }
}

export interface UserView {
  id: string;
  username: string;
}

export interface SessionView {
  user: UserView;
  accessToken: string;
}

export interface RefreshView {
  accessToken: string;
}

export interface WatchlistStock {
  id: string;
  watchlistId: string;
  tradingSymbol: string;
  sector: string | null;
  industry: string | null;
  category: string | null;
  listType: string | null;
  ltp: number | null;
  entryPrice: number | null;
  stopLoss: number | null;
  target1: number | null;
  netChange: number | null;
  pctChange: number | null;
}

export interface WatchlistFolder {
  id: string;
  name: string;
  isDefault: boolean;
  stocks: WatchlistStock[];
}

export interface WatchlistsResponse {
  watchlists: WatchlistFolder[];
  watchlist: WatchlistFolder | null;
}

export type AlertDirection = "above" | "below";

export interface AlertView {
  id: string;
  tradingSymbol: string;
  displayName: string;
  targetPrice: number;
  direction: AlertDirection;
  status: string;
  source: string | null;
  category: string | null;
  triggeredAt: string | null;
  createdAt: string | null;
  ltp: number | null;
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

export interface SnapshotFuture {
  securityId: number;
  symbol: string;
  name: string | null;
  isIndex: boolean;
  sector: string | null;
  expiry: string;
  lotSize: number;
  ltp: number | null;
  change: number | null;
  changePct: number | null;
  oi: number | null;
  oiChangePct: number | null;
  volume: number | null;
  spot: number | null;
  basis: number | null;
  buildup: string | null;
}

export interface SnapshotResponse {
  futures: SnapshotFuture[];
  session: { date: string; live: boolean; referenceDate: string } | null;
  generatedAt: string | null;
  degraded: string[];
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

export interface DealEvent {
  symbol: string | null;
  companyName: string | null;
  eventDate: string | null;
  clientName: string | null;
  transactionType: string | null;
  quantity: number | null;
  price: number | null;
}

export interface DealsResponse {
  events: DealEvent[];
  lastSyncAt: string | null;
}

export interface CorporateEvent {
  symbol: string | null;
  companyName: string | null;
  eventDate: string | null;
  purpose: string | null;
  recordDate: string | null;
}

export interface CorporateResponse {
  events: CorporateEvent[];
  lastSyncAt: string | null;
}

export interface CircuitEvent {
  symbol: string | null;
  companyName: string | null;
  highOrLow: string | null;
}

export interface CircuitResponse {
  events: CircuitEvent[];
  lastSyncAt: string | null;
}

export interface FiiDiiDay {
  tradeDate: string;
  source: string | null;
  fiiBuy: number | null;
  fiiSell: number | null;
  fiiNet: number | null;
  diiBuy: number | null;
  diiSell: number | null;
  diiNet: number | null;
}

export interface FiiDiiMonth {
  month: number;
  year: number;
  tradingDays: number | null;
  fiiBuy: number | null;
  fiiSell: number | null;
  fiiNet: number | null;
  diiBuy: number | null;
  diiSell: number | null;
  diiNet: number | null;
}

export interface FiiDiiResponse {
  daily: FiiDiiDay[];
  monthly: FiiDiiMonth[];
  lastSyncAt: string | null;
  sources: string[];
}

export interface EtfResponse {
  etfs: InstrumentQuote[];
  lastSyncAt: string | null;
}

export interface NiftyMonthCell {
  value: number | null;
  change: number | null;
  source: string | null;
  partial: boolean;
}

export interface NiftyMonthlyResponse {
  kind: string | null;
  rows: Array<{ year: number; months: Array<NiftyMonthCell | null>; total: NiftyMonthCell | null }>;
  stats: Array<{ label: string; months: Array<number | null>; total: number | null }>;
  asOf: string | null;
  latestValue: number | null;
}

export interface PePoint {
  date: string;
  pe: number | null;
  constituentCount: number | null;
}

export interface PeResponse {
  indexSymbol: string | null;
  points: PePoint[];
  historyBeginsAt: string | null;
}

export interface EarningsEvent {
  symbol: string | null;
  companyName: string | null;
  eventDate: string | null;
  epsEstimate: number | null;
  timing: string | null;
  ltp: number | null;
  pctChange: number | null;
  marketCap: number | null;
}

export interface EarningsResponse {
  events: EarningsEvent[];
  lastSyncAt: string | null;
}

export interface EconEvent {
  id: string;
  title: string;
  country: string | null;
  countryName: string | null;
  date: string | null;
  time: string | null;
  impact: string | null;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

export interface EconResponse {
  events: EconEvent[];
  lastSyncAt: string | null;
}

export interface Investor {
  id: string;
  name: string;
  category: string | null;
  holdingsCount: number | null;
  value: number | null;
  dayChange: number | null;
  dayChangePct: number | null;
  topPerformer: string | null;
}

export interface InvestorsResponse {
  investors: Investor[];
  total: number | null;
}

export interface GlobalRow {
  id: string;
  name: string;
  symbol: string | null;
  country: string | null;
  currency: string | null;
  price: number | null;
  change: number | null;
  changePct: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  updatedAt: string | null;
  marketState: string | null;
}

export interface GlobalMarketsResponse {
  sections: Array<{
    id: string;
    label: string;
    groups: Array<{ id: string; label: string; rows: GlobalRow[] }>;
  }>;
  generatedAt: string | null;
}

export interface MoodFactor {
  key: string;
  label: string;
  score: number;
  detail: string | null;
}

export interface MoodResponse {
  score: number | null;
  zone: string | null;
  factors: MoodFactor[];
  asOf: string | null;
  generatedAt: string | null;
}

export interface FnoUnderlying {
  symbol: string;
  exchangeSegment: string | null;
  expiries: string[];
}

export interface FnoUnderlyingsResponse {
  underlyings: FnoUnderlying[];
}

export interface DealHistoryItem {
  symbol: string | null;
  companyName: string | null;
  dealDate: string | null;
  clientName: string | null;
  transactionType: string | null;
  quantity: number | null;
  price: number | null;
  dealType: string | null;
}

export interface DealHistoryResponse {
  deals: DealHistoryItem[];
  pagination: { page: number; pageSize: number; totalDeals: number; totalPages: number };
  lastSyncAt: string | null;
}

export interface BreadthSlice {
  advanced: number;
  declined: number;
  unchanged: number;
  total: number;
}

export interface BreadthResponse {
  advanceDecline: {
    futures: BreadthSlice;
    calls: BreadthSlice;
    puts: BreadthSlice;
    optionsDate: string | null;
  } | null;
  volumeBreakup: {
    date: string | null;
    segments: Array<{
      segment: string;
      contracts: number | null;
      turnoverCr: number | null;
      oiContracts: number | null;
      share: number | null;
    }>;
  } | null;
  generatedAt: string | null;
}

export interface HistRow {
  date: string;
  securityId: number;
  exchange: string;
  tradingSymbol: string;
  companyName: string;
  preClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  netChange: number | null;
  percentChange: number | null;
  volume: number | null;
}

export interface HistResponse {
  rows: HistRow[];
  pagination: { page: number; pageSize: number; totalRows: number; totalPages: number };
  window: { from: string | null; to: string | null; sessions: number | null } | null;
  stockCount: number | null;
}

export interface PeerRow {
  symbol: string;
  name: string | null;
  isSelf: boolean;
  cmp: number | null;
  pe: number | null;
  mcap: number | null;
  divYield: number | null;
  roce: number | null;
  qtrLabel: string | null;
  qtrSales: number | null;
  qtrSalesVar: number | null;
  qtrProfit: number | null;
  qtrProfitVar: number | null;
}

export interface PeersResponse {
  symbol: string;
  sector: string | null;
  industry: string | null;
  peers: PeerRow[];
}

export interface FundamentalsResponse {
  fundamentals: {
    marketCap: number | null;
    trailingPe: number | null;
    forwardPe: number | null;
    eps: number | null;
    dividendYield: number | null;
    beta: number | null;
    fetchedAt: string | null;
  } | null;
}

export interface RatiosResponse {
  values: Record<string, number | null>;
  isFno: boolean;
  isIndex: boolean;
  resolvedSymbol: string | null;
  keyPoints: string[];
  fetchedAt: string | null;
}

export interface HoldingQuarter {
  asOfDate: string;
  promoters: number | null;
  fiis: number | null;
  diis: number | null;
  government: number | null;
  publicShare: number | null;
  others: number | null;
  shareholders: number | null;
}

export interface HolderRow {
  category: string;
  key: string;
  name: string;
  values: Record<string, number | null>;
}

export interface ShareholdingResponse {
  symbol: string;
  quarters: HoldingQuarter[];
  holders: HolderRow[];
}

export interface StatementRow {
  date: string;
  values: Record<string, number | null>;
}

export interface StatementsResponse {
  symbol: string;
  annual: { income: StatementRow[]; balance: StatementRow[]; cash: StatementRow[] };
  quarterly: { income: StatementRow[]; balance: StatementRow[]; cash: StatementRow[] };
}

export interface StockEventItem {
  subject: string | null;
  eventDate: string | null;
  kind: string | null;
  exDate: string | null;
  recordDate: string | null;
}

export interface StockEventsResponse {
  events: StockEventItem[];
}

export interface DocItem {
  kind?: string | null;
  subject?: string | null;
  summary?: string | null;
  category?: string | null;
  label?: string | null;
  date?: string | null;
  exDate?: string | null;
  filedAt?: string | null;
  fromYear?: number | null;
  toYear?: number | null;
  url?: string | null;
  fileSize?: string | null;
}

export interface DocumentsResponse {
  symbol: string | null;
  actions: DocItem[];
  announcements: DocItem[];
  annualReports: DocItem[];
  creditRatings: DocItem[];
  concalls: DocItem[];
  unavailable: string[];
}

export interface EnrichedTrade {
  id: string;
  mode: string;
  tradingType: string | null;
  openedAt: string | null;
  instrument: string | null;
  tradingSymbol: string;
  sector: string | null;
  industry: string | null;
  quantity: number;
  entryPrice: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  target3: number | null;
  exitPrice: number | null;
  ltp: number | null;
}

export interface TradesResponse {
  trades: EnrichedTrade[];
}

export interface HoldingItem {
  id: string;
  tradingSymbol: string;
  displayName: string | null;
  quantity: number;
  avgPrice: number;
}

export interface HoldingsResponse {
  holdings: HoldingItem[];
}

export interface NoteItem {
  id: string;
  title: string;
  content: string | null;
  color: string | null;
  tags: string[];
  isPinned: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface NotesResponse {
  notes: NoteItem[];
}

export interface DiaryEntry {
  id: string;
  entryDate: string | null;
  title: string;
  content: string | null;
  mood: string | null;
  tags: string[];
}

export interface DiaryResponse {
  entries: DiaryEntry[];
}

export interface UserEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  category: string | null;
  location: string | null;
}

export interface UserEventsResponse {
  events: UserEvent[];
}

export interface FundRow {
  symbol: string;
  exchange: string | null;
  pe: number | null;
  eps: number | null;
  bookValue: number | null;
  roe: number | null;
  profitMargin: number | null;
  operatingMargin: number | null;
  dividendYield: number | null;
  beta: number | null;
  revenueTtm: number | null;
}

export interface FundTableResponse {
  rows: FundRow[];
  lastSyncAt: string | null;
}

export interface StrategyView {
  id: string;
  name: string;
  allocationPercent: number;
  allocationRupees: number;
  usedFunds: number;
  unusedFunds: number;
}

export interface ExperienceNoteView {
  id: string;
  positive: string | null;
  negative: string | null;
}

export interface PortfolioFull {
  id: string;
  marketCondition: string;
  totalCapital: number;
  strategies: StrategyView[];
  experienceNotes: ExperienceNoteView[];
  updatedAt: string | null;
}

export interface ChartCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartQuote {
  lastPrice: number;
  prevClose: number;
  open: number | null;
  high: number | null;
  low: number | null;
  netChange: number;
  pctChange: number;
  volume: number | null;
  syncedAt: string | null;
}

export interface ChartResponse {
  symbol: string | null;
  displayName: string | null;
  exchange: string | null;
  timeframe: string | null;
  candles: ChartCandle[];
  quote: ChartQuote | null;
  marketOpen: boolean;
  delayed: boolean;
  status: string | null;
  message: string | null;
  generatedAt: string | null;
}

export interface PatternMatch {
  securityId: number;
  exchange: string | null;
  tradingSymbol: string;
  companyName: string | null;
  lastPrice: number;
  pctChange: number;
  volume: number | null;
  matchedTimeframes: string[];
}

export interface PatternResponse {
  supported: boolean;
  groupId: string | null;
  itemId: string | null;
  evaluatedTimeframes: string[];
  skippedTimeframes: string[];
  scanned: number;
  matchCount: number;
  truncated: boolean;
  matches: PatternMatch[];
  message: string | null;
}

export interface StrategyDef {
  id: string;
  name: string;
  timeframe: string | null;
  instrument: string | null;
  tradingType: string | null;
  legs: unknown;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BacktestTrade {
  entryDate: string | null;
  entryPrice: number;
  exitDate: string | null;
  exitPrice: number | null;
  exitReason: string | null;
  quantity: number;
  pnl: number | null;
  pnlPercent: number | null;
}

export interface BacktestRun {
  id: string;
  strategyId: string | null;
  symbol: string | null;
  exchangeSegment: string | null;
  fromDate: string | null;
  toDate: string | null;
  initialCapital: number;
  status: string | null;
  summary: Record<string, number | string | boolean | null> | null;
  trades: BacktestTrade[];
  createdAt: string | null;
}

export interface UnlistedFeed {
  configured: boolean;
  name: string | null;
  lastSyncAt: string | null;
}

export interface UnlistedResponse {
  companies: Array<{ slug: string; name: string }>;
  feed: UnlistedFeed | null;
  generatedAt: string | null;
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

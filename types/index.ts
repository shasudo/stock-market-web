export interface IUser {
  id: string;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPublic {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export type MarketCondition =
  | "Bull Market"
  | "Bullish to Bearish"
  | "Side Ways Market"
  | "Bear Market"
  | "Bearish to Bullish";

export interface IStrategy {
  name: string;
  allocationPercent: number;
  allocationRupees: number;
  usedFunds: number;
  unusedFunds: number;
}

export interface IPortfolio {
  id: string;
  userId: string;
  marketCondition: MarketCondition;
  strategies: IStrategy[];
  createdAt: Date;
  updatedAt: Date;
}

export type WatchlistCategory =
  "intraday" | "fno" | "swing" | "positional" | "multibagger";

export interface IWatchlistStock {
  id?: string;
  sNo: number;
  date: Date;
  sourceFrom: string;
  segments: string;
  tradingSymbol: string;
  sector: string;
  industry: string;
  ltp: number;
  entryPrice: number;
  stopLoss: number;
  target: number;
  redFlags: string;
  note: string;
  category: WatchlistCategory;
  addedAt: Date;
}

export interface IWatchlist {
  id: string;
  userId: string;
  name: string;
  stocks: IWatchlistStock[];
  createdAt: Date;
  updatedAt: Date;
}

export type NoteColor =
  "slate" | "zinc" | "stone" | "neutral" | "gray" | "dark";

export interface INote {
  id: string;
  userId: string;
  title: string;
  content: string;
  color: NoteColor;
  isPinned: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Stock {
  sNo: number;
  company: string;
  sector: string;
  industry: string;
  group: string;
  faceValue: number;
  priceBand: string;
  mktCapital: number;
  preClose: number;
  ltp: number;
  netChange: number;
  percentInChange: number;
}

export interface TopGainerLoserStock {
  id: string;
  stockName: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  daysHigh: number;
  daysLow: number;
  open: number;
  vwap: number;
  sparklineData: number[];
}

export interface StockStats {
  totalGainers: number;
  totalLosers: number;
  avgGain: number;
  avgLoss: number;
  topGainer: Stock | null;
  topLoser: Stock | null;
}

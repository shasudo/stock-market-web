import axios from "axios";
import type { DailyBar } from "./compute";

export type MarketState = "open" | "closed" | "pre" | "post";

/** One provider quote, normalised. Missing / zero fields are null, never 0. */
export interface ProviderQuote {
  readonly price: number | null;
  readonly change: number | null;
  readonly changePct: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly open: number | null;
  readonly prevClose: number | null;
  readonly high52: number | null;
  readonly low52: number | null;
  /** ISO timestamp of the last trade / print. */
  readonly updatedAt: string | null;
  readonly marketState: MarketState | null;
  readonly currency: string | null;
}

const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = "Mozilla/5.0";

function positive(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[%,+]/g, "")) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function finite(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[%,+]/g, "")) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value < 1e12 ? value * 1000 : value)
        : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ---------- Yahoo Finance ----------

interface YahooQuoteLike {
  readonly symbol?: string;
  readonly regularMarketPrice?: number;
  readonly regularMarketChange?: number;
  readonly regularMarketChangePercent?: number;
  readonly regularMarketDayHigh?: number;
  readonly regularMarketDayLow?: number;
  readonly regularMarketOpen?: number;
  readonly regularMarketPreviousClose?: number;
  readonly fiftyTwoWeekHigh?: number;
  readonly fiftyTwoWeekLow?: number;
  readonly regularMarketTime?: Date | number | string;
  readonly marketState?: string;
  readonly currency?: string;
}

const YAHOO_STATE: Readonly<Record<string, MarketState>> = {
  REGULAR: "open",
  PRE: "pre",
  PREPRE: "pre",
  POST: "post",
  POSTPOST: "post",
  CLOSED: "closed",
};

export function mapYahooQuote(raw: YahooQuoteLike): ProviderQuote {
  const price = positive(raw.regularMarketPrice);
  const prevClose = positive(raw.regularMarketPreviousClose);
  const change =
    finite(raw.regularMarketChange) ?? (price !== null && prevClose !== null ? price - prevClose : null);
  return {
    price,
    change,
    changePct:
      finite(raw.regularMarketChangePercent) ??
      (change !== null && prevClose !== null ? (change / prevClose) * 100 : null),
    high: positive(raw.regularMarketDayHigh),
    low: positive(raw.regularMarketDayLow),
    open: positive(raw.regularMarketOpen),
    prevClose,
    high52: positive(raw.fiftyTwoWeekHigh),
    low52: positive(raw.fiftyTwoWeekLow),
    updatedAt: toIso(raw.regularMarketTime),
    marketState: raw.marketState ? (YAHOO_STATE[raw.marketState] ?? null) : null,
    currency: raw.currency ?? null,
  };
}

interface YahooClient {
  quote(symbols: string[], query: object, options: object): Promise<YahooQuoteLike[]>;
  chart(
    symbol: string,
    options: { period1: Date; interval: "1d" },
  ): Promise<{
    meta?: { gmtoffset?: number };
    quotes: { date: Date; high?: number | null; low?: number | null; close?: number | null }[];
  }>;
}

let yahooClient: Promise<YahooClient> | null = null;
function yahoo(): Promise<YahooClient> {
  yahooClient ??= import("yahoo-finance2").then(
    ({ default: YahooFinance }) =>
      new YahooFinance({ suppressNotices: ["yahooSurvey"] }) as unknown as YahooClient,
  );
  return yahooClient;
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), REQUEST_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function fetchYahooQuotes(symbols: readonly string[]): Promise<Map<string, ProviderQuote>> {
  const client = await yahoo();
  const result = new Map<string, ProviderQuote>();
  for (let index = 0; index < symbols.length; index += 50) {
    const batch = symbols.slice(index, index + 50);
    const quotes = await withTimeout(
      client.quote([...batch], { return: "array" }, { validateResult: false }),
      "Yahoo quotes",
    );
    for (const quote of quotes) {
      if (quote.symbol) result.set(quote.symbol, mapYahooQuote(quote));
    }
  }
  return result;
}

export async function fetchYahooHistory(symbol: string, from: Date): Promise<DailyBar[]> {
  const client = await yahoo();
  const chart = await withTimeout(client.chart(symbol, { period1: from, interval: "1d" }), `Yahoo ${symbol} history`);
  const offsetMs = (chart.meta?.gmtoffset ?? 0) * 1000;
  const bars = new Map<string, DailyBar>();
  for (const quote of chart.quotes) {
    const close = positive(quote.close);
    if (close === null) continue;
    const date = new Date(quote.date.getTime() + offsetMs).toISOString().slice(0, 10);
    bars.set(date, { date, high: positive(quote.high), low: positive(quote.low), close });
  }
  return [...bars.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------- CNBC (government bond yields) ----------

const CNBC_QUOTE_URL =
  "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol";
const CNBC_BARS_URL = "https://ts-api.cnbc.com/harmony/app/bars";

interface CnbcQuoteLike {
  readonly symbol?: string;
  readonly last?: string;
  readonly change?: string;
  readonly high?: string;
  readonly low?: string;
  readonly open?: string;
  readonly yrhiprice?: string;
  readonly yrloprice?: string;
  readonly last_time?: string;
}

/**
 * CNBC's change_pct for bonds is the bond *price* change; the page shows the
 * yield's own % change, so it is recomputed from last and change.
 */
export function mapCnbcQuote(raw: CnbcQuoteLike): ProviderQuote {
  const price = positive(raw.last);
  const change = finite(raw.change);
  const prevClose = price !== null && change !== null ? price - change : null;
  return {
    price,
    change,
    changePct: change !== null && prevClose !== null && prevClose > 0 ? (change / prevClose) * 100 : null,
    high: positive(raw.high),
    low: positive(raw.low),
    open: positive(raw.open),
    prevClose: prevClose !== null && prevClose > 0 ? prevClose : null,
    high52: positive(raw.yrhiprice),
    low52: positive(raw.yrloprice),
    updatedAt: toIso(raw.last_time),
    marketState: null,
    currency: null,
  };
}

export async function fetchCnbcQuotes(symbols: readonly string[]): Promise<Map<string, ProviderQuote>> {
  const result = new Map<string, ProviderQuote>();
  for (let index = 0; index < symbols.length; index += 40) {
    const batch = symbols.slice(index, index + 40);
    const response = await axios.get<unknown>(CNBC_QUOTE_URL, {
      params: {
        symbols: batch.join("|"),
        requestMethod: "itv",
        noform: 0,
        partnerId: 2,
        fund: 1,
        exthrs: 1,
        output: "json",
        events: 1,
      },
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      timeout: REQUEST_TIMEOUT_MS,
    });
    const quotes = (response.data as { FormattedQuoteResult?: { FormattedQuote?: CnbcQuoteLike[] } })
      ?.FormattedQuoteResult?.FormattedQuote;
    if (!Array.isArray(quotes)) continue;
    for (const quote of quotes) {
      if (quote.symbol && quote.last) result.set(quote.symbol, mapCnbcQuote(quote));
    }
  }
  return result;
}

function cnbcStamp(date: Date): string {
  return `${date.toISOString().slice(0, 10).replace(/-/g, "")}000000`;
}

export function parseCnbcBars(payload: unknown): DailyBar[] {
  const bars = (payload as { barData?: { priceBars?: unknown } })?.barData?.priceBars;
  if (!Array.isArray(bars)) return [];
  const result: DailyBar[] = [];
  for (const bar of bars as { high?: string; low?: string; close?: string; tradeTime?: string }[]) {
    const close = positive(bar.close);
    const stamp = bar.tradeTime ?? "";
    if (close === null || !/^\d{8}/.test(stamp)) continue;
    result.push({
      date: `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`,
      high: positive(bar.high),
      low: positive(bar.low),
      close,
    });
  }
  return result.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export async function fetchCnbcHistory(symbol: string, from: Date, to: Date): Promise<DailyBar[]> {
  const url = `${CNBC_BARS_URL}/${encodeURIComponent(symbol)}/1D/${cnbcStamp(from)}/${cnbcStamp(to)}/adjusted/EST5EDT.json`;
  const response = await axios.get<unknown>(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    timeout: REQUEST_TIMEOUT_MS,
  });
  return parseCnbcBars(response.data);
}

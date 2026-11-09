import { logger, serializeError } from "@/lib/logger";
import {
  GLOBAL_MARKETS_CATALOG,
  MCX_GROUP_ID,
  catalogHistoryRefs,
  catalogSymbols,
  historyRef,
  type CatalogInstrument,
  type GlobalSectionId,
  type InstrumentKind,
  type QuoteSource,
} from "./catalog";
import {
  EMPTY_PERFORMANCE,
  computePerformance,
  computeTechnical,
  sessionPivots,
  withLiveBar,
  type DailyBar,
  type Performance,
  type Pivots,
  type Technical,
} from "./compute";
import type { MarketState, ProviderQuote } from "./providers";

export interface GlobalMarketRow {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly kind: InstrumentKind;
  readonly country: string | null;
  readonly decimals: number;
  readonly currency: string | null;
  readonly price: number | null;
  readonly change: number | null;
  readonly changePct: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly open: number | null;
  readonly prevClose: number | null;
  readonly high52: number | null;
  readonly low52: number | null;
  readonly updatedAt: string | null;
  readonly marketState: MarketState | null;
  readonly performance: Performance;
  readonly technical: Technical | null;
  readonly pivots: Pivots | null;
  /** Where the quote came from, for the footnote. */
  readonly source: QuoteSource | "mcx";
}

export interface GlobalMarketGroup {
  readonly id: string;
  readonly label: string;
  readonly rows: readonly GlobalMarketRow[];
}

export interface GlobalMarketSection {
  readonly id: GlobalSectionId;
  readonly label: string;
  readonly groups: readonly GlobalMarketGroup[];
}

export interface GlobalMarketsResponse {
  readonly sections: readonly GlobalMarketSection[];
  readonly generatedAt: string;
  /** History (performance, technicals, pivots) is still loading for some rows. */
  readonly historyPending: boolean;
  /** Providers whose last quote refresh failed (rows keep their last good values). */
  readonly degraded: readonly string[];
}

export interface McxQuote {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly prevClose: number | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly change: number | null;
  readonly changePct: number | null;
  readonly updatedAt: string | null;
}

export interface GlobalMarketsDependencies {
  readonly fetchYahooQuotes: (symbols: readonly string[]) => Promise<Map<string, ProviderQuote>>;
  readonly fetchCnbcQuotes: (symbols: readonly string[]) => Promise<Map<string, ProviderQuote>>;
  readonly fetchYahooHistory: (symbol: string, from: Date) => Promise<DailyBar[]>;
  readonly fetchCnbcHistory: (symbol: string, from: Date, to: Date) => Promise<DailyBar[]>;
  readonly loadMcxQuotes: () => Promise<McxQuote[]>;
  readonly now?: () => Date;
}

const QUOTE_TTL_MS = 60_000;
const HISTORY_TTL_MS = 6 * 60 * 60_000;
const HISTORY_RETRY_MS = 15 * 60_000;
const HISTORY_YEARS = 5;
const HISTORY_PAD_DAYS = 14;
const HISTORY_CONCURRENCY = 4;

interface HistoryEntry {
  readonly bars: readonly DailyBar[];
  readonly at: number;
}

function historyKey(source: QuoteSource, symbol: string): string {
  return `${source}:${symbol}`;
}

/** A print this recent (with no market state from the provider) means the session is still trading. */
const LIVE_PRINT_MS = 30 * 60_000;

function sessionDate(updatedAt: string | null): string | null {
  return updatedAt ? updatedAt.slice(0, 10) : null;
}

export function sessionInProgress(quote: ProviderQuote | undefined, now: Date): boolean {
  if (!quote) return false;
  if (quote.marketState !== null) return quote.marketState === "open" || quote.marketState === "pre";
  if (!quote.updatedAt) return false;
  return now.getTime() - Date.parse(quote.updatedAt) < LIVE_PRINT_MS;
}

/**
 * Live quotes for every instrument on the page, refreshed at most once a
 * minute, with performance / technicals / pivots computed from daily history
 * that is refreshed in the background every few hours. A provider that fails
 * keeps serving its last good quotes and is reported as degraded.
 */
export class GlobalMarketsService {
  private quotes = new Map<string, ProviderQuote>();
  private quotesAt = 0;
  private quotesInflight: Promise<void> | null = null;
  private degraded: string[] = [];
  private mcx: McxQuote[] = [];
  private readonly history = new Map<string, HistoryEntry>();
  private readonly historyFailedAt = new Map<string, number>();
  private historyInflight: Promise<void> | null = null;

  public constructor(private readonly dependencies: GlobalMarketsDependencies) {}

  public async getSnapshot(): Promise<GlobalMarketsResponse> {
    const now = this.now();
    if (now.getTime() - this.quotesAt >= QUOTE_TTL_MS || this.quotes.size === 0) {
      this.quotesInflight ??= this.refreshQuotes(now).finally(() => {
        this.quotesInflight = null;
      });
      await this.quotesInflight;
    }
    const pending = this.staleHistory(now);
    if (pending.length > 0 && !this.historyInflight) {
      this.historyInflight = this.refreshHistory(pending, now).finally(() => {
        this.historyInflight = null;
      });
    }
    return this.build(now, pending.length > 0);
  }

  /** Resolves when any running history refresh finishes (for tests and warm-up). */
  public async settled(): Promise<void> {
    await this.historyInflight;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private async refreshQuotes(now: Date): Promise<void> {
    const degraded: string[] = [];
    const [yahoo, cnbc, mcx] = await Promise.allSettled([
      this.dependencies.fetchYahooQuotes(catalogSymbols("yahoo")),
      this.dependencies.fetchCnbcQuotes(catalogSymbols("cnbc")),
      this.dependencies.loadMcxQuotes(),
    ]);
    const merged = new Map(this.quotes);
    const take = (label: string, source: QuoteSource, result: PromiseSettledResult<Map<string, ProviderQuote>>): void => {
      if (result.status === "fulfilled" && result.value.size > 0) {
        for (const [symbol, quote] of result.value) merged.set(historyKey(source, symbol), quote);
      } else {
        degraded.push(label);
        logger.warn("Global markets quote refresh failed", {
          endpoint: "market-data/global-markets",
          provider: label,
          error: result.status === "rejected" ? serializeError(result.reason) : "empty response",
        });
      }
    };
    take("Yahoo Finance", "yahoo", yahoo);
    take("CNBC", "cnbc", cnbc);
    if (mcx.status === "fulfilled") {
      this.mcx = mcx.value;
    } else {
      degraded.push("MCX");
    }
    this.quotes = merged;
    this.quotesAt = now.getTime();
    this.degraded = degraded;
  }

  private staleHistory(now: Date): { source: QuoteSource; symbol: string }[] {
    const stale: { source: QuoteSource; symbol: string }[] = [];
    for (const { source, symbol } of catalogHistoryRefs()) {
      const key = historyKey(source, symbol);
      const entry = this.history.get(key);
      const failedAt = this.historyFailedAt.get(key);
      if (entry && now.getTime() - entry.at < HISTORY_TTL_MS) continue;
      if (failedAt !== undefined && now.getTime() - failedAt < HISTORY_RETRY_MS) continue;
      stale.push({ source, symbol });
    }
    return stale;
  }

  private async refreshHistory(items: { source: QuoteSource; symbol: string }[], now: Date): Promise<void> {
    const from = new Date(now.getTime());
    from.setUTCFullYear(from.getUTCFullYear() - HISTORY_YEARS);
    from.setUTCDate(from.getUTCDate() - HISTORY_PAD_DAYS);
    let cursor = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const item = items[cursor];
        cursor += 1;
        if (!item) return;
        const key = historyKey(item.source, item.symbol);
        try {
          const bars =
            item.source === "yahoo"
              ? await this.dependencies.fetchYahooHistory(item.symbol, from)
              : await this.dependencies.fetchCnbcHistory(item.symbol, from, now);
          this.history.set(key, { bars, at: this.now().getTime() });
          this.historyFailedAt.delete(key);
        } catch (error) {
          this.historyFailedAt.set(key, this.now().getTime());
          logger.warn("Global markets history refresh failed", {
            endpoint: "market-data/global-markets",
            symbol: key,
            error: serializeError(error),
          });
        }
      }
    };
    await Promise.all(Array.from({ length: HISTORY_CONCURRENCY }, worker));
  }

  private buildRow(instrument: CatalogInstrument, now: Date): GlobalMarketRow {
    const today = now.toISOString().slice(0, 10);
    const quote = this.quotes.get(historyKey(instrument.source, instrument.symbol));
    const ref = historyRef(instrument);
    const history = this.history.get(historyKey(ref.source, ref.symbol))?.bars ?? [];
    const price = quote?.price ?? null;
    const session = sessionDate(quote?.updatedAt ?? null);
    const bars = withLiveBar(history, { price, high: quote?.high ?? null, low: quote?.low ?? null }, session);
    return {
      id: instrument.id,
      name: instrument.name,
      symbol: instrument.symbol,
      kind: instrument.kind,
      country: instrument.country,
      decimals: instrument.decimals,
      currency: quote?.currency ?? null,
      price,
      change: quote?.change ?? null,
      changePct: quote?.changePct ?? null,
      high: quote?.high ?? null,
      low: quote?.low ?? null,
      open: quote?.open ?? null,
      prevClose: quote?.prevClose ?? null,
      high52: quote?.high52 ?? null,
      low52: quote?.low52 ?? null,
      updatedAt: quote?.updatedAt ?? null,
      marketState: quote?.marketState ?? null,
      performance: bars.length > 0 ? computePerformance(bars, price, today) : EMPTY_PERFORMANCE,
      technical: computeTechnical(bars, price),
      pivots: sessionPivots(bars, session, sessionInProgress(quote, now)),
      source: instrument.source,
    };
  }

  private mcxRows(): GlobalMarketRow[] {
    return this.mcx.map((quote) => ({
      id: `mcx-${quote.id}`,
      name: quote.name,
      symbol: quote.id,
      kind: "commodity" as const,
      country: "IN",
      decimals: 2,
      currency: "INR",
      price: quote.price,
      change: quote.change,
      changePct: quote.changePct,
      high: quote.high,
      low: quote.low,
      open: quote.open,
      prevClose: quote.prevClose,
      high52: null,
      low52: null,
      updatedAt: quote.updatedAt,
      marketState: null,
      performance: EMPTY_PERFORMANCE,
      technical: null,
      pivots: null,
      source: "mcx" as const,
    }));
  }

  private build(now: Date, historyPending: boolean): GlobalMarketsResponse {
    const sections: GlobalMarketSection[] = GLOBAL_MARKETS_CATALOG.map((section) => {
      const groups: GlobalMarketGroup[] = section.groups.map((group) => ({
        id: group.id,
        label: group.label,
        rows: group.instruments.map((instrument) => this.buildRow(instrument, now)),
      }));
      if (section.id === "commodities") {
        const rows = this.mcxRows();
        if (rows.length > 0) groups.push({ id: MCX_GROUP_ID, label: "MCX Futures (INR)", rows });
      }
      return { id: section.id, label: section.label, groups };
    });
    return {
      sections,
      generatedAt: now.toISOString(),
      historyPending,
      degraded: this.degraded,
    };
  }
}

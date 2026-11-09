import { logger, serializeError } from "@/lib/logger";
import {
  computeTechnical,
  sessionPivots,
  withLiveBar,
  type DailyBar,
  type Pivots,
  type Technical,
} from "@/lib/global-markets/compute";
import {
  BREADTH_BUCKETS,
  bucketOf,
  parseAllIndices,
  parseConstituentCsv,
  type BreadthBucket,
  type ConstituentListing,
  type IndexRow,
} from "./catalog";
import { INDEX_CONSTITUENT_FILES } from "./constituent-files";

export interface ConstituentQuote {
  readonly securityId: number;
  readonly exchangeSegment: string;
  readonly price: number;
  readonly prevClose: number | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly change: number | null;
  readonly changePct: number | null;
  readonly volume: number | null;
  readonly averagePrice: number | null;
  readonly high52: number | null;
  readonly low52: number | null;
  readonly marketCapValue: number | null;
  readonly marketCapLabel: string | null;
  readonly percentChanges: Readonly<Record<string, number | null>>;
  readonly syncedAt: string;
}

export interface ConstituentFundamentals {
  readonly pe: number | null;
  readonly pb: number | null;
  readonly dividendYield: number | null;
  readonly eps: number | null;
  readonly bookValue: number | null;
  readonly beta: number | null;
}

export interface ConstituentRow {
  readonly symbol: string;
  readonly name: string;
  readonly industry: string;
  readonly price: number | null;
  readonly change: number | null;
  readonly changePct: number | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly prevClose: number | null;
  readonly volume: number | null;
  /** Traded value (₹) = volume × average traded price. */
  readonly value: number | null;
  readonly high52: number | null;
  readonly low52: number | null;
  readonly marketCapCr: number | null;
  readonly marketCapLabel: string | null;
  readonly performance: {
    readonly w1: number | null;
    readonly m1: number | null;
    readonly m3: number | null;
    readonly m6: number | null;
    readonly ytd: number | null;
    readonly y1: number | null;
    readonly y3: number | null;
    readonly y5: number | null;
  };
  readonly fundamentals: ConstituentFundamentals | null;
  readonly technical: Technical | null;
  readonly pivots: Pivots | null;
  readonly updatedAt: string | null;
}

export interface IndexListResponse {
  readonly indices: readonly IndexRow[];
  readonly marketAdvances: number | null;
  readonly marketDeclines: number | null;
  readonly marketUnchanged: number | null;
  readonly asOf: string | null;
  readonly generatedAt: string;
  readonly degraded: boolean;
}

export interface IndexDetailResponse {
  readonly index: IndexRow | null;
  readonly constituents: readonly ConstituentRow[];
  readonly breadth: readonly { key: BreadthBucket; label: string; count: number }[];
  /** Constituents with no live quote in the market feed. */
  readonly unquoted: readonly string[];
  /** The index has no published constituent list (e.g. India VIX). */
  readonly noConstituents: boolean;
  readonly generatedAt: string;
}

export interface IndicesServiceDependencies {
  readonly fetchAllIndices: () => Promise<unknown>;
  readonly fetchConstituentCsv: (file: string) => Promise<string>;
  readonly loadQuotes: (symbols: readonly string[]) => Promise<Map<string, ConstituentQuote>>;
  readonly loadFundamentals: (symbols: readonly string[]) => Promise<Map<string, ConstituentFundamentals>>;
  /** Daily bars for one security from the in-memory history, or [] when not loaded. */
  readonly loadHistory: (securityIds: readonly { securityId: number; exchangeSegment: string }[]) => Promise<Map<number, DailyBar[]>>;
  readonly now?: () => Date;
}

const LIST_TTL_MS = 30_000;
const DETAIL_TTL_MS = 30_000;
const CSV_TTL_MS = 12 * 60 * 60_000;
const FUNDAMENTALS_TTL_MS = 30 * 60_000;
const LIVE_PRINT_MS = 30 * 60_000;

function pct(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * NSE's index board (all indices, live) and, for any index, its full
 * constituent list joined with the app's live quotes, stored period returns,
 * fundamentals snapshot and daily history (for technicals and pivots).
 */
export class IndicesService {
  private list: { value: IndexListResponse; at: number } | null = null;
  private listInflight: Promise<void> | null = null;
  private readonly csv = new Map<string, { value: ConstituentListing[]; at: number }>();
  private readonly details = new Map<string, { value: IndexDetailResponse; at: number }>();
  private fundamentals: { value: Map<string, ConstituentFundamentals>; at: number; key: string } | null = null;

  public constructor(private readonly dependencies: IndicesServiceDependencies) {}

  public async getIndices(): Promise<IndexListResponse> {
    const now = this.now();
    if (!this.list || now.getTime() - this.list.at >= LIST_TTL_MS) {
      this.listInflight ??= this.refreshList(now).finally(() => {
        this.listInflight = null;
      });
      await this.listInflight;
    }
    if (!this.list) {
      return {
        indices: [],
        marketAdvances: null,
        marketDeclines: null,
        marketUnchanged: null,
        asOf: null,
        generatedAt: now.toISOString(),
        degraded: true,
      };
    }
    return this.list.value;
  }

  public async getIndex(name: string): Promise<IndexDetailResponse> {
    const key = name.trim().toUpperCase();
    const now = this.now();
    const cached = this.details.get(key);
    if (cached && now.getTime() - cached.at < DETAIL_TTL_MS) return cached.value;

    const list = await this.getIndices();
    const index = list.indices.find((row) => row.name.toUpperCase() === key) ?? null;
    const file = INDEX_CONSTITUENT_FILES[key];
    if (!file) {
      const value: IndexDetailResponse = {
        index,
        constituents: [],
        breadth: BREADTH_BUCKETS.map((bucket) => ({ ...bucket, count: 0 })),
        unquoted: [],
        noConstituents: true,
        generatedAt: now.toISOString(),
      };
      this.details.set(key, { value, at: now.getTime() });
      return value;
    }

    const listings = await this.constituents(file, now);
    const symbols = listings.map((listing) => listing.symbol);
    const [quotes, fundamentals] = await Promise.all([
      this.dependencies.loadQuotes(symbols),
      this.loadFundamentals(symbols, now),
    ]);
    const history = await this.dependencies
      .loadHistory([...quotes.values()].map((quote) => ({ securityId: quote.securityId, exchangeSegment: quote.exchangeSegment })))
      .catch((error: unknown) => {
        logger.warn("Index constituent history unavailable", { endpoint: "indices", error: serializeError(error) });
        return new Map<number, DailyBar[]>();
      });

    const counts = new Map<BreadthBucket, number>(BREADTH_BUCKETS.map((bucket) => [bucket.key, 0]));
    const unquoted: string[] = [];
    const constituents = listings.map((listing): ConstituentRow => {
      const quote = quotes.get(listing.symbol) ?? null;
      if (!quote) unquoted.push(listing.symbol);
      if (quote?.changePct !== null && quote?.changePct !== undefined) {
        const bucket = bucketOf(quote.changePct);
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      }
      const sessionDate = quote ? new Date(Date.parse(quote.syncedAt) + 19_800_000).toISOString().slice(0, 10) : null;
      const bars = quote
        ? withLiveBar(history.get(quote.securityId) ?? [], { price: quote.price, high: quote.high, low: quote.low }, sessionDate)
        : [];
      const live = quote !== null && now.getTime() - Date.parse(quote.syncedAt) < LIVE_PRINT_MS;
      const changes = quote?.percentChanges ?? {};
      return {
        symbol: listing.symbol,
        name: listing.companyName,
        industry: listing.industry,
        price: quote?.price ?? null,
        change: quote?.change ?? null,
        changePct: quote?.changePct ?? null,
        open: quote?.open ?? null,
        high: quote?.high ?? null,
        low: quote?.low ?? null,
        prevClose: quote?.prevClose ?? null,
        volume: quote?.volume ?? null,
        value: quote?.volume && quote.averagePrice ? quote.volume * quote.averagePrice : null,
        high52: quote?.high52 ?? null,
        low52: quote?.low52 ?? null,
        marketCapCr: quote?.marketCapValue ? quote.marketCapValue / 1e7 : null,
        marketCapLabel: quote?.marketCapLabel ?? null,
        performance: {
          w1: pct(changes["% 1W Chag"]),
          m1: pct(changes["% 1M Chag"]),
          m3: pct(changes["% 3M Chag"]),
          m6: pct(changes["% 6M Chag"]),
          ytd: pct(changes["% YTD Chag"]),
          y1: pct(changes["% 1Y Chag"]),
          y3: pct(changes["% 3Y Chag"]),
          y5: pct(changes["% 5Y Chag"]),
        },
        fundamentals: fundamentals.get(listing.symbol) ?? null,
        technical: quote ? computeTechnical(bars, quote.price) : null,
        pivots: quote ? sessionPivots(bars, sessionDate, live) : null,
        updatedAt: quote?.syncedAt ?? null,
      };
    });

    const value: IndexDetailResponse = {
      index,
      constituents,
      breadth: BREADTH_BUCKETS.map((bucket) => ({ ...bucket, count: counts.get(bucket.key) ?? 0 })),
      unquoted,
      noConstituents: false,
      generatedAt: now.toISOString(),
    };
    this.details.set(key, { value, at: now.getTime() });
    return value;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private async refreshList(now: Date): Promise<void> {
    try {
      const payload = await this.dependencies.fetchAllIndices();
      const indices = parseAllIndices(payload);
      if (indices.length === 0) throw new Error("NSE returned no indices");
      const body = payload as { advances?: unknown; declines?: unknown; unchanged?: unknown; timestamp?: unknown };
      const count = (value: unknown) => (typeof value === "number" ? value : typeof value === "string" ? Number(value) || null : null);
      this.list = {
        value: {
          indices,
          marketAdvances: count(body.advances),
          marketDeclines: count(body.declines),
          marketUnchanged: count(body.unchanged),
          asOf: typeof body.timestamp === "string" ? body.timestamp : null,
          generatedAt: now.toISOString(),
          degraded: false,
        },
        at: now.getTime(),
      };
    } catch (error) {
      logger.warn("NSE index board refresh failed", { endpoint: "indices", error: serializeError(error) });
      if (this.list) {
        // Keep the last good board; retry on the next TTL window.
        this.list = { value: { ...this.list.value, degraded: true }, at: now.getTime() };
      }
    }
  }

  private async constituents(file: string, now: Date): Promise<ConstituentListing[]> {
    const cached = this.csv.get(file);
    if (cached && now.getTime() - cached.at < CSV_TTL_MS) return cached.value;
    try {
      const value = parseConstituentCsv(await this.dependencies.fetchConstituentCsv(file));
      if (value.length === 0) throw new Error(`empty constituent list ${file}`);
      this.csv.set(file, { value, at: now.getTime() });
      return value;
    } catch (error) {
      logger.warn("Index constituent list download failed", { endpoint: "indices", file, error: serializeError(error) });
      if (cached) return cached.value;
      throw error;
    }
  }

  private async loadFundamentals(symbols: readonly string[], now: Date): Promise<Map<string, ConstituentFundamentals>> {
    const key = symbols.join(",");
    if (this.fundamentals && this.fundamentals.key === key && now.getTime() - this.fundamentals.at < FUNDAMENTALS_TTL_MS) {
      return this.fundamentals.value;
    }
    try {
      const value = await this.dependencies.loadFundamentals(symbols);
      this.fundamentals = { value, at: now.getTime(), key };
      return value;
    } catch (error) {
      logger.warn("Index constituent fundamentals unavailable", { endpoint: "indices", error: serializeError(error) });
      return new Map();
    }
  }
}

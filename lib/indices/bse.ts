import { logger, serializeError } from "@/lib/logger";
import { computePerformance, type DailyBar, type Performance } from "@/lib/global-markets/compute";
import type { IndexTab } from "./catalog";

/**
 * BSE indices: live values from the Dhan index feed the app already syncs,
 * with 52-week range and period returns from each index's daily history.
 * BSE does not publish index constituents in a form a server can read (its
 * API blocks automated requests), so there is no stock-level breakdown.
 */

export interface BseIndexQuote {
  readonly securityId: number;
  readonly name: string;
  readonly last: number;
  readonly prevClose: number | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly change: number | null;
  readonly changePct: number | null;
  readonly updatedAt: string | null;
}

export interface BseIndexRow {
  readonly securityId: number;
  readonly name: string;
  readonly tabs: readonly IndexTab[];
  readonly last: number;
  readonly change: number | null;
  readonly changePct: number | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly prevClose: number | null;
  readonly high52: number | null;
  readonly low52: number | null;
  /** % below the 52-week high (negative) and above the 52-week low. */
  readonly fromHigh52: number | null;
  readonly fromLow52: number | null;
  readonly performance: Performance;
  readonly updatedAt: string | null;
  readonly historyLoaded: boolean;
}

export interface BseIndicesResponse {
  readonly indices: readonly BseIndexRow[];
  readonly advancing: number;
  readonly declining: number;
  readonly lastSyncAt: string | null;
  /** Daily history is still loading for some indices (52W / returns fill in). */
  readonly historyPending: number;
  readonly generatedAt: string;
}

export interface BseIndicesDependencies {
  readonly loadQuotes: () => Promise<BseIndexQuote[]>;
  readonly loadHistory: (securityIds: readonly number[]) => Promise<Map<number, DailyBar[]>>;
  /** Fetches one index's daily history into storage (Dhan, rate-limited). */
  readonly ensureHistory: (securityId: number) => Promise<void>;
  readonly now?: () => Date;
}

/** Dhan's short names for a few BSE indices → the names BSE uses. */
const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  Sensex: "SENSEX",
  BSELVI: "BSE Low Volatility",
  BSEQUI: "BSE Quality",
  CARBON: "BSE Carbonex",
  "BSE DSI": "BSE Dividend Stability",
};

export const BSE_KEY_INDICES: readonly string[] = [
  "SENSEX",
  "BSE Sensex 50",
  "Sensex Next 50 Index",
  "BSE 100",
  "BSE 200",
  "BSE 500",
  "BSE 150 MidCap",
  "BSE 250 Small Cap",
  "BSE BANKEX",
  "BSE AllCap",
  "BSE 1000",
];

const SECTORAL =
  /\b(auto|bankex|basic materials|capital goods|consumer durables|consumer discretionary|energy|fmcg|finance|healthcare|\bit\b|industrials|metals|oil and gas|power|realty|teck|telecom|utilities|private banks|psu bank|capital markets|focused it|service sector|india technology)\b/i;

export function bseDisplayName(raw: string): string {
  return DISPLAY_NAMES[raw] ?? raw;
}

export function bseTabsFor(name: string): IndexTab[] {
  const tabs: IndexTab[] = ["all"];
  if (BSE_KEY_INDICES.includes(name)) tabs.push("key");
  const sectoral = SECTORAL.test(name);
  if (sectoral) tabs.push("sectoral");
  if (/^SENSEX$|sensex 50|sensex 60|sensex equal|sensex sixty|bse 100\b|largecap|large mid|dollex 30|dollex 100|india leaders/i.test(name)) tabs.push("largeCap");
  if (/midcap|mid small|large mid/i.test(name)) tabs.push("midCap");
  if (/small ?cap|mid small|sme ipo/i.test(name)) tabs.push("smallCap");
  if (!sectoral && !BSE_KEY_INDICES.includes(name)) tabs.push("other");
  return tabs;
}

function istDate(date: Date): string {
  return new Date(date.getTime() + 19_800_000).toISOString().slice(0, 10);
}

export function rangeStats(bars: readonly DailyBar[], last: number, today: string): { high52: number | null; low52: number | null } {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
  const year = bars.filter((bar) => bar.date >= cutoff);
  if (year.length === 0) return { high52: null, low52: null };
  const highs = year.map((bar) => bar.high ?? bar.close);
  const lows = year.map((bar) => bar.low ?? bar.close);
  return { high52: Math.max(last, ...highs), low52: Math.min(last, ...lows) };
}

/** An index whose history load came back empty is retried after this long. */
const HISTORY_RETRY_MS = 60 * 60_000;

/**
 * A quote synced outside a session (weekend, holiday, after the settle) is
 * stored with zero change; when its value is the last daily close, the day's
 * move is that close against the one before it.
 */
export function sessionMove(
  quote: Pick<BseIndexQuote, "last" | "change" | "changePct">,
  bars: readonly DailyBar[],
): { change: number | null; changePct: number | null } {
  if ((quote.changePct ?? 0) !== 0 || bars.length < 2) {
    return { change: quote.change, changePct: quote.changePct };
  }
  const last = bars.at(-1)!;
  const previous = bars.at(-2)!;
  if (Math.abs(last.close - quote.last) > Math.max(0.01, quote.last * 1e-6) || !(previous.close > 0)) {
    return { change: quote.change, changePct: quote.changePct };
  }
  const change = last.close - previous.close;
  return { change, changePct: (change / previous.close) * 100 };
}

export class BseIndicesService {
  private cached: { value: BseIndicesResponse; at: number } | null = null;
  private warming = false;
  /** securityId → when its history load was last attempted. */
  private readonly attempted = new Map<number, number>();

  public constructor(private readonly dependencies: BseIndicesDependencies) {}

  public async getIndices(): Promise<BseIndicesResponse> {
    const now = this.dependencies.now?.() ?? new Date();
    if (this.cached && now.getTime() - this.cached.at < 30_000) return this.cached.value;
    const quotes = await this.dependencies.loadQuotes();
    const history = await this.dependencies.loadHistory(quotes.map((quote) => quote.securityId)).catch((error: unknown) => {
      logger.warn("BSE index history read failed", { endpoint: "indices/bse", error: serializeError(error) });
      return new Map<number, DailyBar[]>();
    });
    const today = istDate(now);
    const indices = quotes.map((quote): BseIndexRow => {
      const name = bseDisplayName(quote.name);
      const bars = history.get(quote.securityId) ?? [];
      const { high52, low52 } = rangeStats(bars, quote.last, today);
      const move = sessionMove(quote, bars);
      return {
        securityId: quote.securityId,
        name,
        tabs: bseTabsFor(name),
        last: quote.last,
        change: move.change,
        changePct: move.changePct,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        prevClose: quote.prevClose,
        high52,
        low52,
        fromHigh52: high52 ? ((quote.last - high52) / high52) * 100 : null,
        fromLow52: low52 ? ((quote.last - low52) / low52) * 100 : null,
        performance: computePerformance(bars, quote.last, today),
        updatedAt: quote.updatedAt,
        historyLoaded: bars.length > 0,
      };
    });
    const missing = indices.filter((row) => !row.historyLoaded).map((row) => row.securityId);
    this.warm(missing, now.getTime());
    const lastSyncAt = quotes.map((quote) => quote.updatedAt).filter((value): value is string => value !== null).sort().at(-1) ?? null;
    const value: BseIndicesResponse = {
      indices,
      advancing: indices.filter((row) => (row.changePct ?? 0) > 0).length,
      declining: indices.filter((row) => (row.changePct ?? 0) < 0).length,
      lastSyncAt,
      historyPending: this.warming ? missing.length : missing.filter((id) => !this.attempted.has(id)).length,
      generatedAt: now.toISOString(),
    };
    this.cached = { value, at: now.getTime() };
    return value;
  }

  /** Loads missing histories one index at a time in the background. */
  private warm(securityIds: readonly number[], now: number): void {
    const todo = securityIds.filter((id) => {
      const last = this.attempted.get(id);
      return last === undefined || now - last >= HISTORY_RETRY_MS;
    });
    if (this.warming || todo.length === 0) return;
    this.warming = true;
    void (async () => {
      for (const id of todo) {
        this.attempted.set(id, now);
        try {
          await this.dependencies.ensureHistory(id);
        } catch (error) {
          logger.warn("BSE index history load failed", { endpoint: "indices/bse", securityId: id, error: serializeError(error) });
        }
      }
      this.warming = false;
      this.cached = null;
    })();
  }
}

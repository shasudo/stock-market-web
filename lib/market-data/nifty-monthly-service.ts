import { logger, serializeError } from "@/lib/logger";
import { ServiceUnavailableError } from "@/lib/errors";
import { NIFTY_MONTHLY_RETURN_ARCHIVE } from "./nifty-monthly-archive";
import {
  buildReturnHeatmap,
  istDateKey,
  type DatedValue,
  type MonthlyHeatmap,
} from "./monthly-heatmap";

export const NIFTY_YAHOO_TICKER = "^NSEI";
const HISTORY_START = "2007-01-01";
const HISTORY_TTL_MS = 6 * 60 * 60_000;
const LIVE_TTL_MS = 60_000;
const LIVE_LOOKBACK_DAYS = 10;
const REQUEST_TIMEOUT_MS = 20_000;

/** The slice of yahoo-finance2's chart() result this service reads. */
export interface IndexChartResult {
  readonly meta?: {
    readonly regularMarketPrice?: number;
    readonly regularMarketTime?: Date | string | number;
  };
  readonly quotes: readonly {
    readonly date: Date;
    readonly close?: number | null;
  }[];
}

export type IndexChartFetcher = (
  ticker: string,
  options: { period1: string | Date; interval: "1d" },
) => Promise<IndexChartResult>;

export interface NiftyMonthlyServiceDependencies {
  readonly fetchChart: IndexChartFetcher;
  readonly now?: () => Date;
}

interface CacheEntry {
  readonly closes: readonly DatedValue[];
  readonly fetchedAt: number;
}

function toDate(value: Date | string | number | undefined): Date | null {
  if (value === undefined) return null;
  const date =
    value instanceof Date
      ? value
      : new Date(typeof value === "number" && value < 1e12 ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Daily closes keyed by IST date, plus the live price as today's close. */
export function chartToDailyCloses(result: IndexChartResult): DatedValue[] {
  const byDate = new Map<string, number>();
  for (const quote of result.quotes) {
    if (typeof quote.close !== "number" || !Number.isFinite(quote.close)) continue;
    byDate.set(istDateKey(quote.date), quote.close);
  }
  const price = result.meta?.regularMarketPrice;
  const time = toDate(result.meta?.regularMarketTime);
  if (typeof price === "number" && Number.isFinite(price) && price > 0 && time) {
    const day = istDateKey(time);
    const lastDay = [...byDate.keys()].sort().at(-1);
    if (!lastDay || day >= lastDay) byDate.set(day, price);
  }
  return [...byDate]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS}ms`)),
      REQUEST_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * NIFTY 50 monthly return sheet. The long daily history is refreshed every
 * few hours; the last couple of weeks (including today's live price) every
 * minute, so the current month and year-to-date update during the session.
 * A failed refresh keeps serving the last good data.
 */
export class NiftyMonthlyService {
  private history: CacheEntry | null = null;
  private live: CacheEntry | null = null;
  private historyInflight: Promise<CacheEntry> | null = null;
  private liveInflight: Promise<CacheEntry> | null = null;

  public constructor(private readonly dependencies: NiftyMonthlyServiceDependencies) {}

  public async getHeatmap(): Promise<MonthlyHeatmap> {
    const now = this.now();
    const [history, live] = await Promise.all([
      this.getHistory(now),
      this.getLive(now),
    ]);

    const merged = new Map<string, number>();
    for (const point of history?.closes ?? []) merged.set(point.date, point.value);
    for (const point of live?.closes ?? []) merged.set(point.date, point.value);

    if (merged.size === 0) {
      throw new ServiceUnavailableError(
        "Live NIFTY 50 prices are unavailable right now. Please try again shortly.",
      );
    }

    return buildReturnHeatmap({
      closes: [...merged].map(([date, value]) => ({ date, value })),
      archive: NIFTY_MONTHLY_RETURN_ARCHIVE,
      now,
    });
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private async getHistory(now: Date): Promise<CacheEntry | null> {
    if (this.history && now.getTime() - this.history.fetchedAt < HISTORY_TTL_MS) {
      return this.history;
    }
    this.historyInflight ??= this.fetch(HISTORY_START, now).finally(() => {
      this.historyInflight = null;
    });
    try {
      this.history = await this.historyInflight;
    } catch (error) {
      logger.warn("NIFTY monthly history fetch failed", {
        endpoint: "market-data/nifty-monthly",
        error: serializeError(error),
      });
    }
    return this.history;
  }

  private async getLive(now: Date): Promise<CacheEntry | null> {
    if (this.live && now.getTime() - this.live.fetchedAt < LIVE_TTL_MS) {
      return this.live;
    }
    const from = new Date(now.getTime() - LIVE_LOOKBACK_DAYS * 86_400_000);
    this.liveInflight ??= this.fetch(from, now).finally(() => {
      this.liveInflight = null;
    });
    try {
      this.live = await this.liveInflight;
    } catch (error) {
      logger.warn("NIFTY live price fetch failed", {
        endpoint: "market-data/nifty-monthly",
        error: serializeError(error),
      });
    }
    return this.live;
  }

  private async fetch(period1: string | Date, now: Date): Promise<CacheEntry> {
    const result = await withTimeout(
      this.dependencies.fetchChart(NIFTY_YAHOO_TICKER, { period1, interval: "1d" }),
      "NIFTY chart",
    );
    const closes = chartToDailyCloses(result);
    if (closes.length === 0) throw new Error("NIFTY chart returned no closes");
    return { closes, fetchedAt: now.getTime() };
  }
}

export async function createYahooIndexChartFetcher(): Promise<IndexChartFetcher> {
  const { default: YahooFinance } = await import("yahoo-finance2");
  const client = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
  return (ticker, options) =>
    client.chart(ticker, options) as unknown as Promise<IndexChartResult>;
}

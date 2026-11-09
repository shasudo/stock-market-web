import { logger, serializeError } from "@/lib/logger";
import {
  ipoTimeline,
  istToday,
  nseIssueUrl,
  parseBoardRows,
  parseHolidays,
  parseIpoDetail,
  parseSebiDraftFilings,
  statusFor,
  type BoardRow,
  type DraftFiling,
  type IpoDetail,
  type IpoIssue,
  type IpoListing,
} from "./parse";

export interface IpoBoardResponse {
  readonly open: readonly IpoIssue[];
  readonly upcoming: readonly IpoIssue[];
  /** Bidding closed, not yet listed (or listed in the last few days without a candle yet). */
  readonly closed: readonly IpoIssue[];
  readonly listed: readonly IpoIssue[];
  readonly drafts: readonly DraftFiling[];
  readonly generatedAt: string;
  /** Some issue details are still loading in the background. */
  readonly pending: boolean;
  /** Upstream sections that failed on the last refresh (last good data is served). */
  readonly degraded: readonly string[];
}

export interface ListingQuote {
  readonly openPrice: number | null;
  readonly closePrice: number | null;
  readonly lastPrice: number | null;
  readonly dayChangePct: number | null;
}

export interface IpoServiceDependencies {
  readonly fetchJson: (url: string) => Promise<unknown>;
  readonly fetchText: (url: string) => Promise<string>;
  /** Listing-day candle and live quote per symbol, from the app's own market data. */
  readonly loadListings: (
    issues: readonly { symbol: string; listingDate: string }[],
  ) => Promise<Map<string, ListingQuote>>;
  readonly now?: () => Date;
}

const NSE = "https://www.nseindia.com/api";
const SEBI_PUBLIC_ISSUES =
  "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=15&smid=10";

const BOARD_TTL_MS = 3 * 60_000;
const PAST_TTL_MS = 20 * 60_000;
const HOLIDAY_TTL_MS = 24 * 60 * 60_000;
const DRAFT_TTL_MS = 60 * 60_000;
const LISTING_TTL_MS = 60_000;
const DETAIL_TTL_MS: Readonly<Record<IpoIssue["status"], number>> = {
  open: 5 * 60_000,
  upcoming: 30 * 60_000,
  closed: 30 * 60_000,
  listed: 24 * 60 * 60_000,
};
const DETAIL_RETRY_MS = 10 * 60_000;
/** A source that has never loaded is not retried more often than this. */
const SOURCE_RETRY_MS = 60_000;
const DETAIL_CONCURRENCY = 3;
const CLOSED_WINDOW_DAYS = 30;
const LISTED_LIMIT = 60;

interface Cached<T> {
  value: T;
  at: number;
}

function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

function pct(price: number | null, base: number | null): number | null {
  return price !== null && base !== null && base > 0 ? ((price - base) / base) * 100 : null;
}

/**
 * The IPO board: NSE's open, upcoming and past issues merged by symbol, each
 * issue enriched with its NSE issue sheet (lot, size, registrar, documents,
 * consolidated subscription), the SEBI T+3 timeline, and for listed issues
 * the listing-day candle and live price. Every upstream is cached on its own
 * TTL; a failing one keeps its last good data and is reported as degraded.
 */
export class IpoService {
  private current: Cached<BoardRow[]> | null = null;
  private upcoming: Cached<BoardRow[]> | null = null;
  private past: Cached<BoardRow[]> | null = null;
  private holidays: Cached<Set<string>> | null = null;
  private drafts: Cached<DraftFiling[]> | null = null;
  private listings: Cached<Map<string, ListingQuote>> | null = null;
  private listingsKey = "";
  private readonly details = new Map<string, Cached<IpoDetail | null>>();
  private readonly detailFailedAt = new Map<string, number>();
  private detailsInflight: Promise<void> | null = null;
  private degraded = new Set<string>();
  private readonly sourceFailedAt = new Map<string, number>();

  public constructor(private readonly dependencies: IpoServiceDependencies) {}

  public async getBoard(): Promise<IpoBoardResponse> {
    const now = this.now();
    await Promise.all([
      this.refresh("Current issues", () => this.current, (v) => (this.current = v), BOARD_TTL_MS, async () =>
        parseBoardRows(await this.dependencies.fetchJson(`${NSE}/ipo-current-issue`)),
      ),
      this.refresh("Upcoming issues", () => this.upcoming, (v) => (this.upcoming = v), BOARD_TTL_MS, async () =>
        parseBoardRows(await this.dependencies.fetchJson(`${NSE}/all-upcoming-issues?category=ipo`)),
      ),
      this.refresh("Past issues", () => this.past, (v) => (this.past = v), PAST_TTL_MS, async () => {
        const rows = parseBoardRows(await this.dependencies.fetchJson(`${NSE}/public-past-issues`));
        if (rows.length === 0) throw new Error("NSE returned no past issues");
        return rows;
      }),
      this.refresh("Holidays", () => this.holidays, (v) => (this.holidays = v), HOLIDAY_TTL_MS, async () =>
        parseHolidays(await this.dependencies.fetchJson(`${NSE}/holiday-master?type=trading`)),
      ),
      this.refresh("SEBI draft filings", () => this.drafts, (v) => (this.drafts = v), DRAFT_TTL_MS, async () =>
        parseSebiDraftFilings(await this.dependencies.fetchText(SEBI_PUBLIC_ISSUES)),
      ),
    ]);

    const today = istToday(now);
    const rows = this.mergeRows();
    const classified = rows.map((row) => ({
      row,
      status: statusFor(row.openDate, row.closeDate, row.listingDate ?? this.detailListingDate(row.symbol), today),
    }));

    const open = classified.filter((entry) => entry.status === "open");
    const upcoming = classified.filter((entry) => entry.status === "upcoming");
    const closed = classified.filter(
      (entry) =>
        entry.status === "closed" &&
        entry.row.closeDate !== null &&
        daysBetween(entry.row.closeDate, today) <= CLOSED_WINDOW_DAYS,
    );
    const listed = classified
      .filter((entry) => entry.status === "listed")
      .sort((a, b) =>
        (b.row.listingDate ?? this.detailListingDate(b.row.symbol) ?? "").localeCompare(
          a.row.listingDate ?? this.detailListingDate(a.row.symbol) ?? "",
        ),
      )
      .slice(0, LISTED_LIMIT);

    // Details for the live sections are awaited (a handful of issues); the
    // listed section fills in the background and the page polls for it.
    const needed = [...open, ...upcoming, ...closed].filter((entry) => this.detailStale(entry.row.symbol, entry.status, now));
    if (needed.length > 0) await this.loadDetails(needed.map((entry) => ({ symbol: entry.row.symbol, segment: entry.row.segment, status: entry.status })));
    const listedStale = listed.filter((entry) => this.detailStale(entry.row.symbol, entry.status, now));
    if (listedStale.length > 0 && !this.detailsInflight) {
      this.detailsInflight = this.loadDetails(
        listedStale.map((entry) => ({ symbol: entry.row.symbol, segment: entry.row.segment, status: entry.status })),
      ).finally(() => {
        this.detailsInflight = null;
      });
    }

    const listingQuotes = await this.loadListingQuotes(
      listed.map((entry) => ({
        symbol: entry.row.symbol,
        listingDate: entry.row.listingDate ?? this.detailListingDate(entry.row.symbol) ?? today,
      })),
      now,
    );

    const holidays = this.holidays?.value ?? new Set<string>();
    const build = (entry: { row: BoardRow; status: IpoIssue["status"] }) =>
      this.buildIssue(entry.row, entry.status, holidays, listingQuotes.get(entry.row.symbol) ?? null);

    return {
      open: open.map(build).sort((a, b) => (a.closeDate ?? "").localeCompare(b.closeDate ?? "")),
      upcoming: upcoming.map(build).sort((a, b) => (a.openDate ?? "9999").localeCompare(b.openDate ?? "9999")),
      closed: closed.map(build).sort((a, b) => (b.closeDate ?? "").localeCompare(a.closeDate ?? "")),
      listed: listed.map(build),
      drafts: (this.drafts?.value ?? []).slice(0, 50),
      generatedAt: now.toISOString(),
      pending: listedStale.length > 0,
      degraded: [...this.degraded],
    };
  }

  /** Resolves when background detail loading finishes (tests / warm-up). */
  public async settled(): Promise<void> {
    await this.detailsInflight;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private async refresh<T>(
    label: string,
    read: () => Cached<T> | null,
    write: (value: Cached<T>) => void,
    ttl: number,
    load: () => Promise<T>,
  ): Promise<void> {
    const cached = read();
    const now = this.now().getTime();
    if (cached && now - cached.at < ttl) return;
    const failedAt = this.sourceFailedAt.get(label);
    if (!cached && failedAt !== undefined && now - failedAt < SOURCE_RETRY_MS) return;
    try {
      write({ value: await load(), at: now });
      this.degraded.delete(label);
      this.sourceFailedAt.delete(label);
    } catch (error) {
      this.degraded.add(label);
      this.sourceFailedAt.set(label, now);
      logger.warn("IPO board source failed", {
        endpoint: "market-data/ipo",
        source: label,
        error: serializeError(error),
      });
      // Keep serving the last good copy; retry after a shorter wait.
      if (cached) write({ value: cached.value, at: now - ttl + DETAIL_RETRY_MS });
    }
  }

  /** Past issues, then upcoming, then current: later boards carry fresher fields and win. */
  private mergeRows(): BoardRow[] {
    const bySymbol = new Map<string, BoardRow>();
    for (const row of [...(this.past?.value ?? []), ...(this.upcoming?.value ?? []), ...(this.current?.value ?? [])]) {
      const existing = bySymbol.get(row.symbol);
      bySymbol.set(
        row.symbol,
        existing
          ? {
              ...existing,
              ...Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null)),
            } as BoardRow
          : row,
      );
    }
    return [...bySymbol.values()];
  }

  private detailListingDate(symbol: string): string | null {
    return this.details.get(symbol)?.value?.listingDate ?? null;
  }

  private detailStale(symbol: string, status: IpoIssue["status"], now: Date): boolean {
    const cached = this.details.get(symbol);
    if (cached && now.getTime() - cached.at < DETAIL_TTL_MS[status]) return false;
    const failedAt = this.detailFailedAt.get(symbol);
    return !(failedAt !== undefined && now.getTime() - failedAt < DETAIL_RETRY_MS);
  }

  private async loadDetails(
    items: readonly { symbol: string; segment: BoardRow["segment"]; status: IpoIssue["status"] }[],
  ): Promise<void> {
    let cursor = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const item = items[cursor];
        cursor += 1;
        if (!item) return;
        try {
          const series = item.segment === "SME" ? "SME" : "EQ";
          const payload = await this.dependencies.fetchJson(
            `${NSE}/ipo-detail?symbol=${encodeURIComponent(item.symbol)}&series=${series}`,
          );
          this.details.set(item.symbol, { value: parseIpoDetail(payload), at: this.now().getTime() });
          this.detailFailedAt.delete(item.symbol);
        } catch (error) {
          this.detailFailedAt.set(item.symbol, this.now().getTime());
          logger.warn("IPO detail fetch failed", {
            endpoint: "market-data/ipo",
            symbol: item.symbol,
            error: serializeError(error),
          });
        }
      }
    };
    await Promise.all(Array.from({ length: DETAIL_CONCURRENCY }, worker));
  }

  private async loadListingQuotes(
    issues: readonly { symbol: string; listingDate: string }[],
    now: Date,
  ): Promise<Map<string, ListingQuote>> {
    const key = issues.map((issue) => `${issue.symbol}:${issue.listingDate}`).join(",");
    if (this.listings && this.listingsKey === key && now.getTime() - this.listings.at < LISTING_TTL_MS) {
      return this.listings.value;
    }
    try {
      const value = await this.dependencies.loadListings(issues);
      this.listings = { value, at: now.getTime() };
      this.listingsKey = key;
      this.degraded.delete("Listing prices");
      return value;
    } catch (error) {
      this.degraded.add("Listing prices");
      logger.warn("IPO listing prices failed", { endpoint: "market-data/ipo", error: serializeError(error) });
      return this.listings?.value ?? new Map();
    }
  }

  private buildIssue(
    row: BoardRow,
    status: IpoIssue["status"],
    holidays: ReadonlySet<string>,
    quote: ListingQuote | null,
  ): IpoIssue {
    const detail = this.details.get(row.symbol)?.value ?? null;
    const priceLow = row.priceLow ?? detail?.priceLow ?? null;
    const priceHigh = row.priceHigh ?? detail?.priceHigh ?? null;
    const listingDate = row.listingDate ?? detail?.listingDate ?? null;
    const issuePrice = row.issuePrice ?? (status === "listed" ? priceHigh : null);
    const lotSize = detail?.lotSize ?? null;
    const subscription =
      detail?.subscription ??
      (row.subscriptionTotal !== null && row.subscriptionTotal > 0
        ? { qib: null, nii: null, bnii: null, snii: null, retail: null, employee: null, shareholder: null, total: row.subscriptionTotal }
        : null);
    const listing: IpoListing | null =
      status === "listed" && quote
        ? {
            openPrice: quote.openPrice,
            closePrice: quote.closePrice,
            listingGainPct: pct(quote.openPrice, issuePrice),
            lastPrice: quote.lastPrice,
            dayChangePct: quote.dayChangePct,
            currentGainPct: pct(quote.lastPrice, issuePrice),
          }
        : null;
    return {
      symbol: row.symbol,
      companyName: row.companyName,
      segment: row.segment,
      status,
      openDate: row.openDate,
      closeDate: row.closeDate,
      listingDate,
      priceLow,
      priceHigh,
      issuePrice,
      lotSize,
      minInvestment: lotSize !== null && priceHigh !== null ? lotSize * priceHigh : null,
      issueSizeCr: detail?.issueSizeCr ?? row.issueSizeCr,
      faceValue: detail?.faceValue ?? null,
      issueType: detail?.issueType ?? null,
      registrar: detail?.registrar ?? null,
      leadManagers: detail?.leadManagers ?? null,
      industry: detail?.industry ?? null,
      documents: detail?.documents ?? [],
      subscription,
      timeline: ipoTimeline(row.openDate, row.closeDate, listingDate, holidays),
      listing,
      nseUrl: nseIssueUrl(row.symbol, row.segment),
    };
  }
}

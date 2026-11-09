import { logger, serializeError } from "@/lib/logger";
import { ResourceNotFoundError, ValidationError } from "@/lib/errors";
import {
  advanceDecline,
  buildFuturesBoard,
  nseDate,
  optionBreadth,
  parseActiveOptions,
  parseAnnouncements,
  parseBanList,
  parseBhavcopyCsv,
  parseContractInfo,
  parseCorporateActions,
  parseFuturesPacket,
  parseOptionChain,
  volumeBreakup,
  type ActiveOption,
  type AdvanceDecline,
  type Announcement,
  type Bhavcopy,
  type CorporateAction,
  type FutureContract,
  type FutureRow,
  type FuturesPacket,
  type OptionChain,
  type SegmentVolume,
  type SpotQuote,
} from "./parse";

export const FNO_INDEX_SYMBOLS: readonly string[] = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50", "NIFTYFPI"];

/** Index futures → the NSE index they settle against. */
export const FNO_INDEX_NAMES: Readonly<Record<string, string>> = {
  NIFTY: "NIFTY 50",
  BANKNIFTY: "NIFTY BANK",
  FINNIFTY: "NIFTY FINANCIAL SERVICES",
  MIDCPNIFTY: "NIFTY MIDCAP SELECT",
  NIFTYNXT50: "NIFTY NEXT 50",
};

/** Indices the sector table can narrow to (by constituents). */
export const SECTOR_TABLE_INDICES: readonly string[] = ["NIFTY 50", "NIFTY BANK", "NIFTY IT", "NIFTY FINANCIAL SERVICES"];

export function isFnoIndex(symbol: string): boolean {
  return FNO_INDEX_SYMBOLS.includes(symbol.toUpperCase());
}

export interface FnoSnapshotResponse {
  readonly futures: readonly FutureRow[];
  readonly session: {
    /** Session the prices belong to (ISO, IST). */
    readonly date: string | null;
    /** Live exchange quotes (true) or the published session close (false). */
    readonly live: boolean;
    /** Session open interest and volume are compared against. */
    readonly referenceDate: string | null;
  };
  readonly advanceDecline: {
    readonly futures: AdvanceDecline;
    readonly calls: AdvanceDecline | null;
    readonly puts: AdvanceDecline | null;
    /** Session the option counts come from (NSE's bhavcopy). */
    readonly optionsDate: string | null;
  };
  readonly volumeBreakup: { readonly date: string | null; readonly segments: readonly SegmentVolume[] };
  readonly activeCalls: readonly ActiveOption[];
  readonly activePuts: readonly ActiveOption[];
  readonly ban: { readonly tradeDate: string | null; readonly symbols: readonly string[] };
  readonly announcements: readonly Announcement[];
  readonly corporateActions: readonly CorporateAction[];
  readonly indexMembers: Readonly<Record<string, readonly string[]>>;
  readonly generatedAt: string;
  /** Sources whose last refresh failed. */
  readonly degraded: readonly string[];
}

export interface OptionChainResponse extends OptionChain {
  readonly expiries: readonly string[];
  /** Futures expiries (near / next / far) for the quick tabs. */
  readonly monthlyExpiries: readonly string[];
  readonly lotSize: number;
}

export interface FnoSnapshotDependencies {
  readonly loadFutureContracts: () => Promise<FutureContract[]>;
  readonly fetchFuturesPackets: (securityIds: readonly number[]) => Promise<Map<number, unknown>>;
  /** The UDiFF F&O bhavcopy CSV for a date, or null when NSE has none. */
  readonly fetchBhavcopy: (isoDate: string) => Promise<string | null>;
  readonly loadStockSpots: (symbols: readonly string[]) => Promise<Map<string, SpotQuote>>;
  /** NSE index values keyed by NSE index name. */
  readonly loadIndexSpots: () => Promise<Map<string, SpotQuote>>;
  readonly loadIndexMembers: (indexName: string) => Promise<string[]>;
  readonly fetchNseJson: (url: string) => Promise<unknown>;
  readonly fetchText: (url: string) => Promise<string>;
  readonly now?: () => Date;
}

const NSE_API = "https://www.nseindia.com/api";
const SNAPSHOT_TTL_MS = 30_000;
const CHAIN_TTL_MS = 30_000;
const EXPIRIES_TTL_MS = 60 * 60_000;
const ACTIVE_TTL_MS = 60_000;
const ANNOUNCEMENTS_TTL_MS = 5 * 60_000;
const ACTIONS_TTL_MS = 60 * 60_000;
const BAN_TTL_MS = 30 * 60_000;
const MEMBERS_TTL_MS = 12 * 60 * 60_000;
const CONTRACTS_TTL_MS = 60 * 60_000;
/** A date whose bhavcopy NSE has not published yet is asked again after this. */
const BHAV_MISS_TTL_MS = 15 * 60_000;
const BHAV_LOOKBACK_DAYS = 10;
const SYMBOL = /^[A-Z0-9&-]{1,20}$/;

interface Cached<T> {
  value: T;
  at: number;
}

function istDate(date: Date): string {
  return new Date(date.getTime() + 19_800_000).toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function ddMmYyyy(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}-${month}-${year}`;
}

/**
 * Moneycontrol-style F&O snapshot: the full futures board (live from Dhan,
 * open interest against NSE's previous-session bhavcopy), option chains from
 * NSE, most active options, breadth, ban list and F&O company news.
 */
export class FnoSnapshotService {
  private snapshot: Cached<FnoSnapshotResponse> | null = null;
  private inflight: Promise<FnoSnapshotResponse> | null = null;
  private contracts: Cached<FutureContract[]> | null = null;
  private readonly bhav = new Map<string, Cached<Bhavcopy | null>>();
  private readonly chains = new Map<string, Cached<OptionChainResponse>>();
  private readonly expiries = new Map<string, Cached<string[]>>();
  private readonly sources = new Map<string, Cached<unknown>>();

  public constructor(private readonly dependencies: FnoSnapshotDependencies) {}

  public async getSnapshot(): Promise<FnoSnapshotResponse> {
    const now = this.now();
    if (this.snapshot && now.getTime() - this.snapshot.at < SNAPSHOT_TTL_MS) return this.snapshot.value;
    this.inflight ??= this.build(now).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  public async getOptionChain(rawSymbol: string, rawExpiry: string | null): Promise<OptionChainResponse> {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!SYMBOL.test(symbol)) throw new ValidationError("Unknown F&O symbol.");
    const contracts = (await this.futureContracts()).filter((contract) => contract.symbol === symbol);
    if (contracts.length === 0) throw new ResourceNotFoundError(`${symbol} has no F&O contracts.`);
    const monthlyExpiries = [...new Set(contracts.map((contract) => contract.expiry))].sort().slice(0, 3);
    const lotSize = contracts.find((contract) => contract.lotSize > 0)?.lotSize ?? 1;

    const now = this.now();
    const expiries = await this.optionExpiries(symbol, now);
    const expiry = rawExpiry && expiries.includes(rawExpiry) ? rawExpiry : (expiries[0] ?? null);
    if (!expiry) throw new ResourceNotFoundError(`NSE lists no option expiries for ${symbol}.`);

    const key = `${symbol}|${expiry}`;
    const cached = this.chains.get(key);
    if (cached && now.getTime() - cached.at < CHAIN_TTL_MS) return cached.value;
    const type = isFnoIndex(symbol) ? "Indices" : "Equity";
    try {
      const payload = await this.dependencies.fetchNseJson(
        `${NSE_API}/option-chain-v3?type=${type}&symbol=${encodeURIComponent(symbol)}&expiry=${nseDate(expiry)}`,
      );
      const chain = parseOptionChain(payload, symbol, expiry);
      if (!chain) throw new Error("NSE returned no option chain");
      const shares = (value: number | null) => (value === null ? null : value * lotSize);
      const toShares = (leg: OptionChain["rows"][number]["call"]) =>
        leg ? { ...leg, oi: shares(leg.oi), oiChange: shares(leg.oiChange), volume: shares(leg.volume) } : null;
      const value: OptionChainResponse = {
        ...chain,
        rows: chain.rows.map((row) => ({ strike: row.strike, call: toShares(row.call), put: toShares(row.put) })),
        totals: {
          callOi: chain.totals.callOi * lotSize,
          putOi: chain.totals.putOi * lotSize,
          callVolume: chain.totals.callVolume * lotSize,
          putVolume: chain.totals.putVolume * lotSize,
        },
        expiries,
        monthlyExpiries,
        lotSize,
      };
      this.chains.set(key, { value, at: now.getTime() });
      if (this.chains.size > 200) this.chains.delete(this.chains.keys().next().value!);
      return value;
    } catch (error) {
      logger.warn("NSE option chain unavailable", { endpoint: "fno/chain", symbol, expiry, error: serializeError(error) });
      if (cached) return cached.value;
      throw error;
    }
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private async build(now: Date): Promise<FnoSnapshotResponse> {
    const degraded: string[] = [];
    const contracts = await this.futureContracts();
    const stockSymbols = [...new Set(contracts.map((contract) => contract.symbol).filter((symbol) => !isFnoIndex(symbol)))];
    const symbolSet = new Set(stockSymbols);

    const [packets, bhavs, stockSpots, indexSpots] = await Promise.all([
      this.dependencies
        .fetchFuturesPackets(contracts.map((contract) => contract.securityId))
        .catch((error: unknown) => {
          logger.warn("Dhan futures quotes unavailable", { endpoint: "fno/snapshot", error: serializeError(error) });
          return new Map<number, unknown>();
        }),
      this.latestBhavcopies(now),
      this.dependencies.loadStockSpots(stockSymbols).catch((error: unknown) => {
        logger.warn("F&O stock spot prices unavailable", { endpoint: "fno/snapshot", error: serializeError(error) });
        degraded.push("cash prices");
        return new Map<string, SpotQuote>();
      }),
      this.dependencies.loadIndexSpots().catch((error: unknown) => {
        logger.warn("F&O index spot values unavailable", { endpoint: "fno/snapshot", error: serializeError(error) });
        degraded.push("index values");
        return new Map<string, SpotQuote>();
      }),
    ]);

    const parsed = new Map<number, FuturesPacket>();
    for (const [id, raw] of packets) {
      const packet = parseFuturesPacket(raw);
      if (packet) parsed.set(id, packet);
    }
    if (parsed.size === 0) degraded.push("live futures quotes");

    const [latest, previous] = bhavs;
    const tradeDates = [...parsed.values()].map((packet) => packet.tradeDate).filter((date): date is string => date !== null).sort();
    const liveDate = tradeDates.at(-1) ?? null;
    const sessionDate = liveDate ?? latest?.date ?? null;
    const sessionBhav = latest && sessionDate !== null && latest.date >= sessionDate ? latest : null;
    const referenceBhav = sessionBhav ? previous : latest;

    const spots = new Map<string, SpotQuote>(stockSpots);
    for (const [future, indexName] of Object.entries(FNO_INDEX_NAMES)) {
      const quote = indexSpots.get(indexName);
      if (quote) spots.set(future, quote);
    }

    const futures = buildFuturesBoard({
      contracts,
      packets: parsed,
      sessionBhav,
      referenceBhav,
      spots,
      isIndex: isFnoIndex,
    });

    const optionsBhav = sessionBhav ?? latest;
    const breadth = optionsBhav ? optionBreadth(optionsBhav) : null;

    const [activeCalls, activePuts, ban, announcements, corporateActions, indexMembers] = await Promise.all([
      this.source("active calls", ACTIVE_TTL_MS, now, degraded, [] as ActiveOption[], async () =>
        parseActiveOptions(await this.dependencies.fetchNseJson(`${NSE_API}/snapshot-derivatives-equity?index=calls`)).slice(0, 20),
      ),
      this.source("active puts", ACTIVE_TTL_MS, now, degraded, [] as ActiveOption[], async () =>
        parseActiveOptions(await this.dependencies.fetchNseJson(`${NSE_API}/snapshot-derivatives-equity?index=puts`)).slice(0, 20),
      ),
      this.source("ban list", BAN_TTL_MS, now, degraded, { tradeDate: null, symbols: [] as string[] }, async () =>
        parseBanList(await this.dependencies.fetchText("https://nsearchives.nseindia.com/content/fo/fo_secban.csv")),
      ),
      this.source("announcements", ANNOUNCEMENTS_TTL_MS, now, degraded, [] as Announcement[], async () => {
        const today = istDate(now);
        const payload = await this.dependencies.fetchNseJson(
          `${NSE_API}/corporate-announcements?index=equities&from_date=${ddMmYyyy(shiftDate(today, -3))}&to_date=${ddMmYyyy(today)}`,
        );
        return parseAnnouncements(payload, symbolSet);
      }),
      this.source("corporate actions", ACTIONS_TTL_MS, now, degraded, [] as CorporateAction[], async () => {
        const today = istDate(now);
        const payload = await this.dependencies.fetchNseJson(
          `${NSE_API}/corporates-corporateActions?index=equities&from_date=${ddMmYyyy(shiftDate(today, -7))}&to_date=${ddMmYyyy(shiftDate(today, 30))}`,
        );
        return parseCorporateActions(payload, symbolSet);
      }),
      this.source("index members", MEMBERS_TTL_MS, now, degraded, {} as Record<string, string[]>, async () => {
        const entries = await Promise.all(
          SECTOR_TABLE_INDICES.map(async (name) => [name, await this.dependencies.loadIndexMembers(name)] as const),
        );
        return Object.fromEntries(entries);
      }),
    ]);

    const value: FnoSnapshotResponse = {
      futures,
      session: { date: sessionDate, live: parsed.size > 0, referenceDate: referenceBhav?.date ?? null },
      advanceDecline: {
        futures: advanceDecline(futures.filter((row) => row.series === "near").map((row) => row.change)),
        calls: breadth?.calls ?? null,
        puts: breadth?.puts ?? null,
        optionsDate: optionsBhav?.date ?? null,
      },
      volumeBreakup: { date: optionsBhav?.date ?? null, segments: optionsBhav ? volumeBreakup(optionsBhav) : [] },
      activeCalls,
      activePuts,
      ban,
      announcements,
      corporateActions,
      indexMembers,
      generatedAt: now.toISOString(),
      degraded,
    };
    this.snapshot = { value, at: now.getTime() };
    return value;
  }

  /** A cached side source: keeps its last good value when a refresh fails. */
  private async source<T>(name: string, ttl: number, now: Date, degraded: string[], empty: T, load: () => Promise<T>): Promise<T> {
    const cached = this.sources.get(name) as Cached<T> | undefined;
    if (cached && now.getTime() - cached.at < ttl) return cached.value;
    try {
      const value = await load();
      this.sources.set(name, { value, at: now.getTime() });
      return value;
    } catch (error) {
      logger.warn("F&O snapshot source unavailable", { endpoint: "fno/snapshot", source: name, error: serializeError(error) });
      degraded.push(name);
      if (cached) {
        this.sources.set(name, { value: cached.value, at: now.getTime() - ttl + 60_000 });
        return cached.value;
      }
      return empty;
    }
  }

  private async futureContracts(): Promise<FutureContract[]> {
    const now = this.now().getTime();
    if (this.contracts && now - this.contracts.at < CONTRACTS_TTL_MS && this.contracts.value.length > 0) return this.contracts.value;
    const today = istDate(this.now());
    const value = (await this.dependencies.loadFutureContracts()).filter((contract) => contract.expiry >= today);
    this.contracts = { value, at: now };
    return value;
  }

  private async optionExpiries(symbol: string, now: Date): Promise<string[]> {
    const cached = this.expiries.get(symbol);
    if (cached && now.getTime() - cached.at < EXPIRIES_TTL_MS && cached.value.length > 0) return cached.value;
    try {
      const today = istDate(now);
      const value = parseContractInfo(
        await this.dependencies.fetchNseJson(`${NSE_API}/option-chain-contract-info?symbol=${encodeURIComponent(symbol)}`),
      ).filter((date) => date >= today);
      this.expiries.set(symbol, { value, at: now.getTime() });
      return value;
    } catch (error) {
      if (cached) return cached.value;
      throw error;
    }
  }

  /** The two most recent published bhavcopies on or before today. */
  private async latestBhavcopies(now: Date): Promise<[Bhavcopy | null, Bhavcopy | null]> {
    const found: Bhavcopy[] = [];
    let date = istDate(now);
    for (let step = 0; step < BHAV_LOOKBACK_DAYS && found.length < 2; step += 1, date = shiftDate(date, -1)) {
      const bhav = await this.bhavOn(date, now);
      if (bhav) found.push(bhav);
    }
    return [found[0] ?? null, found[1] ?? null];
  }

  private async bhavOn(date: string, now: Date): Promise<Bhavcopy | null> {
    const cached = this.bhav.get(date);
    if (cached && (cached.value !== null || now.getTime() - cached.at < BHAV_MISS_TTL_MS)) return cached.value;
    try {
      const csv = await this.dependencies.fetchBhavcopy(date);
      const value = csv ? parseBhavcopyCsv(csv) : null;
      this.bhav.set(date, { value, at: now.getTime() });
      for (const key of [...this.bhav.keys()].sort().slice(0, Math.max(0, this.bhav.size - BHAV_LOOKBACK_DAYS - 2))) {
        this.bhav.delete(key);
      }
      return value;
    } catch (error) {
      logger.warn("NSE F&O bhavcopy unavailable", { endpoint: "fno/snapshot", date, error: serializeError(error) });
      return cached?.value ?? null;
    }
  }
}

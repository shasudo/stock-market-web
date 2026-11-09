import axios from "axios";
import { logger } from "@/lib/logger";

export type IpoStatus = "Upcoming" | "Open" | "Closed";

export interface IpoDTO {
  readonly symbol: string;
  readonly companyName: string;
  /** `YYYY-MM-DD` in Asia/Kolkata, when published. */
  readonly openDate: string | null;
  readonly closeDate: string | null;
  readonly priceBandLow: number | null;
  readonly priceBandHigh: number | null;
  readonly issueSizeCr: number | null;
  readonly status: IpoStatus;
  /** Subscription multiple (times bid), when published. */
  readonly subscription: number | null;
  /** Mainline vs SME, when the listing series says so. */
  readonly segment: "Mainline" | "SME" | null;
}

export interface IpoCalendarResponse {
  readonly issues: readonly IpoDTO[];
  /** When the upstream NSE snapshot was taken. */
  readonly lastSyncAt: string | null;
}

const NSE_BASE = "https://www.nseindia.com/api";
const USER_AGENT = "Mozilla/5.0";
const REQUEST_TIMEOUT_MS = 25_000;
/** NSE's board changes through the day; refetch at most this often. */
const CACHE_TTL_MS = 15 * 60 * 1_000;

interface CacheEntry {
  readonly at: number;
  readonly payload: IpoCalendarResponse;
}

let cache: CacheEntry | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return null;
};

const firstText = (row: Record<string, unknown>, ...keys: string[]): string | null => {
  for (const key of keys) {
    const value = text(row[key]);
    if (value !== null) return value;
  }
  return null;
};

const firstNumber = (
  row: Record<string, unknown>,
  ...keys: string[]
): number | null => {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const cleaned = raw.replace(/[₹,\s]/g, "");
      if (cleaned.length > 0) {
        const parsed = Number(cleaned);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  }
  return null;
};

/**
 * NSE publishes most IPO dates as `26-Mar-2024`; accept ISO too so a format
 * change degrades to a missing date, never a wrong one.
 */
export function parseNseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(trimmed);
  if (dmy) {
    const months: Record<string, string> = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };
    const month = months[dmy[2]!.toLowerCase()];
    if (!month) return null;
    return `${dmy[3]}-${month}-${dmy[1]!.padStart(2, "0")}`;
  }
  return null;
}

function parsePriceBand(row: Record<string, unknown>): {
  low: number | null;
  high: number | null;
} {
  const low = firstNumber(row, "priceBandLow", "issuePriceLow", "floorPrice");
  const high = firstNumber(row, "priceBandHigh", "issuePriceHigh", "capPrice");
  if (low !== null && high !== null) return { low, high };
  const band = firstText(row, "priceBand", "issuePrice", "price");
  if (band !== null) {
    const cleaned = band.replace(/[₹,\s]/g, "");
    const match = cleaned.match(/([\d.]+)(?:-|to|–)([\d.]+)/);
    if (match) {
      const first = Number(match[1]);
      const second = Number(match[2]);
      if (Number.isFinite(first) && Number.isFinite(second)) {
        return { low: Math.min(first, second), high: Math.max(first, second) };
      }
    }
    const single = Number(cleaned);
    if (Number.isFinite(single)) return { low: single, high: single };
  }
  return { low, high };
}

function istToday(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .slice(0, 10);
}

/**
 * Tolerant NSE row parser: field names drift between the current-issue and
 * upcoming-issue endpoints, so every field tries its known aliases and
 * unknown rows keep what IS present instead of being dropped.
 */
export function toIpoDTO(row: unknown, today: string): IpoDTO | null {
  if (!isRecord(row)) return null;
  const symbol = firstText(row, "symbol", "nseSymbol", "securitySymbol", "smSymbol");
  const companyName = firstText(row, "companyName", "company", "nameOfCompany");
  if (symbol === null || companyName === null) return null;

  const openDate = parseNseDate(
    firstText(row, "issueStartDate", "openDate", "issueOpenDate", "biddingStartDate", "ipoStartDate", "startDate") ?? undefined,
  );
  const closeDate = parseNseDate(
    firstText(row, "issueEndDate", "closeDate", "issueCloseDate", "biddingEndDate", "ipoEndDate", "endDate") ?? undefined,
  );
  const { low, high } = parsePriceBand(row);
  const subscription = firstNumber(row, "noOfTime", "subscription", "timesSubscribed");
  const series = firstText(row, "series");
  const segment =
    series !== null && /sme/i.test(series)
      ? ("SME" as const)
      : series !== null && /eq/i.test(series)
        ? ("Mainline" as const)
        : null;

  let status: IpoStatus = "Upcoming";
  if (openDate !== null && closeDate !== null) {
    status = today < openDate ? "Upcoming" : today > closeDate ? "Closed" : "Open";
  } else {
    const raw = firstText(row, "status");
    if (raw !== null && /open|live|ongoing/i.test(raw)) status = "Open";
    else if (raw !== null && /clos/i.test(raw)) status = "Closed";
  }

  return {
    symbol,
    companyName,
    openDate,
    closeDate,
    priceBandLow: low,
    priceBandHigh: high,
    issueSizeCr: firstNumber(row, "issueSize", "issueSizeCr", "issueSizeRsCr"),
    status,
    subscription,
    segment,
  };
}

async function downloadBoard(path: string): Promise<unknown[]> {
  const response = await axios.get<unknown>(`${NSE_BASE}${path}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    timeout: REQUEST_TIMEOUT_MS,
  });
  return Array.isArray(response.data) ? response.data : [];
}

export async function getIpoCalendar(options?: {
  readonly now?: () => number;
}): Promise<IpoCalendarResponse> {
  const now = options?.now?.() ?? Date.now();
  if (cache !== null && now - cache.at < CACHE_TTL_MS) return cache.payload;

  const today = istToday();
  const [current, upcoming] = await Promise.all([
    downloadBoard("/ipo-current-issue").catch((error: unknown) => {
      logger.warn("NSE current-issue board failed", { error: String(error) });
      return [];
    }),
    downloadBoard("/all-upcoming-issues?category=ipo").catch(
      (error: unknown) => {
        logger.warn("NSE upcoming-issues board failed", { error: String(error) });
        return [];
      },
    ),
  ]);

  const bySymbol = new Map<string, IpoDTO>();
  for (const row of [...upcoming, ...current]) {
    const dto = toIpoDTO(row, today);
    // Current-issue rows carry subscription counts; they win on collisions.
    if (dto !== null && !bySymbol.has(dto.symbol)) bySymbol.set(dto.symbol, dto);
  }
  for (const row of current) {
    const dto = toIpoDTO(row, today);
    if (dto !== null) bySymbol.set(dto.symbol, dto);
  }

  const payload: IpoCalendarResponse = {
    issues: [...bySymbol.values()].sort((a, b) =>
      (a.openDate ?? "9999") < (b.openDate ?? "9999") ? -1 : 1,
    ),
    lastSyncAt: new Date(now).toISOString(),
  };
  cache = { at: now, payload };
  return payload;
}

/** Test hook: bypass the TTL cache. */
export function clearIpoCalendarCache(): void {
  cache = null;
}

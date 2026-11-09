import axios from "axios";

export type EconomicImpact = "High" | "Medium" | "Low" | "Holiday";

export interface EconomicEventDTO {
  readonly id: string;
  readonly title: string;
  readonly country: string;
  readonly countryName: string;
  /** `YYYY-MM-DD` in Asia/Kolkata. */
  readonly date: string;
  /** `HH:MM` in Asia/Kolkata, or null for all-day entries. */
  readonly time: string | null;
  readonly impact: EconomicImpact;
  readonly actual: string | null;
  readonly forecast: string | null;
  readonly previous: string | null;
}

export interface EconomicCalendarResponse {
  readonly events: readonly EconomicEventDTO[];
  /** When the upstream weekly file was pulled. */
  readonly lastSyncAt: string | null;
}

const FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const REQUEST_TIMEOUT_MS = 25_000;
/** The publisher refreshes the weekly file a few times a day. */
const CACHE_TTL_MS = 30 * 60 * 1_000;

const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  USD: "United States",
  EUR: "Euro Area",
  GBP: "United Kingdom",
  JPY: "Japan",
  AUD: "Australia",
  NZD: "New Zealand",
  CAD: "Canada",
  CHF: "Switzerland",
  CNY: "China",
  IND: "India",
  INR: "India",
  ZAF: "South Africa",
  ZAR: "South Africa",
  SGD: "Singapore",
  HKD: "Hong Kong",
  KRW: "South Korea",
  MXN: "Mexico",
  BRL: "Brazil",
};

interface CacheEntry {
  readonly at: number;
  readonly payload: EconomicCalendarResponse;
}

let cache: CacheEntry | null = null;

const text = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return null;
};

function toIstParts(iso: string): { date: string; time: string } | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  return {
    date: instant.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
    time: instant.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function toImpact(value: unknown): EconomicImpact {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "high") return "High";
    if (normalized === "medium") return "Medium";
    if (normalized === "holiday") return "Holiday";
  }
  return "Low";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * One weekly-feed row into a display DTO. Rows without a title, country or
 * parseable timestamp are dropped; every published field is carried through
 * verbatim (Actual included once the release prints).
 */
export function toEconomicEventDTO(
  row: unknown,
  index: number,
): EconomicEventDTO | null {
  if (!isRecord(row)) return null;
  const title = text(row.title);
  const country = text(row.country);
  const rawDate = text(row.date);
  if (title === null || country === null || rawDate === null) return null;
  const parts = toIstParts(rawDate);
  if (parts === null) return null;
  const code = country.toUpperCase();
  return {
    id: `${parts.date}|${parts.time}|${code}|${title}|${index}`,
    title,
    country: code,
    countryName: COUNTRY_NAMES[code] ?? code,
    date: parts.date,
    time: /^00:00$/.test(parts.time) ? null : parts.time,
    impact: toImpact(row.impact),
    actual: text(row.actual),
    forecast: text(row.forecast),
    previous: text(row.previous),
  };
}

export async function getEconomicCalendar(options?: {
  readonly now?: () => number;
}): Promise<EconomicCalendarResponse> {
  const now = options?.now?.() ?? Date.now();
  if (cache !== null && now - cache.at < CACHE_TTL_MS) return cache.payload;

  const response = await axios.get<unknown>(FEED_URL, {
    timeout: REQUEST_TIMEOUT_MS,
  });
  const rows = Array.isArray(response.data) ? response.data : [];
  const events = rows
    .map((row, index) => toEconomicEventDTO(row, index))
    .filter((event): event is EconomicEventDTO => event !== null)
    .sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.time === b.time ? 0 : (a.time ?? "") < (b.time ?? "") ? -1 : 1,
    );

  const payload: EconomicCalendarResponse = {
    events,
    lastSyncAt: new Date(now).toISOString(),
  };
  cache = { at: now, payload };
  return payload;
}

/** Test hook: bypass the TTL cache. */
export function clearEconomicCalendarCache(): void {
  cache = null;
}

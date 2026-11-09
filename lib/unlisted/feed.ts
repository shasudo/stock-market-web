import axios from "axios";
import type { ImportRow } from "./types";

/**
 * Partner price feed, switched on by environment variables once a dealer
 * (InCred Money, Altius, Planify, Unlisted Zone, ...) grants API access:
 *
 *   UNLISTED_PRICE_FEED_URL    JSON endpoint
 *   UNLISTED_PRICE_FEED_TOKEN  optional, sent as "Authorization: Bearer <token>"
 *   UNLISTED_PRICE_FEED_NAME   label shown as the price source (default "partner")
 *
 * Expected payload: an array (or { data: [...] }) of objects with a company
 * name and price, and optionally symbol, isin, sector and a date. Common
 * field spellings are accepted; a partner with a different shape needs only
 * a mapping change in `mapFeedRow`.
 */
export interface FeedConfig {
  readonly url: string;
  readonly token: string | null;
  readonly name: string;
}

export function readFeedConfig(env: Readonly<Record<string, string | undefined>> = process.env): FeedConfig | null {
  const url = env.UNLISTED_PRICE_FEED_URL?.trim();
  if (!url || !/^https:\/\//i.test(url)) return null;
  return {
    url,
    token: env.UNLISTED_PRICE_FEED_TOKEN?.trim() || null,
    name: (env.UNLISTED_PRICE_FEED_NAME?.trim() || "partner").slice(0, 40),
  };
}

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export function mapFeedRow(raw: unknown): ImportRow | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const name = text(pick(row, "name", "companyName", "company", "company_name", "title"), 160);
  const rawPrice = pick(row, "price", "lastPrice", "last_price", "ltp", "sellPrice", "sell_price", "rate");
  const price = typeof rawPrice === "number" ? rawPrice : typeof rawPrice === "string" ? Number(rawPrice.replace(/[₹,\s]/g, "")) : NaN;
  if (!name || !Number.isFinite(price) || price <= 0) return null;
  const rawDate = pick(row, "asOf", "as_of", "date", "updatedAt", "updated_at", "priceDate");
  const asOf = typeof rawDate === "string" || typeof rawDate === "number" ? new Date(rawDate) : null;
  return {
    name,
    symbol: text(pick(row, "symbol", "code", "ticker"), 30),
    sector: text(pick(row, "sector", "industry"), 80),
    isin: text(pick(row, "isin", "ISIN"), 12),
    price: Math.round(price * 100) / 100,
    asOf: asOf && !Number.isNaN(asOf.getTime()) ? asOf : null,
  };
}

export async function fetchFeedRows(config: FeedConfig): Promise<ImportRow[]> {
  const response = await axios.get<unknown>(config.url, {
    headers: {
      Accept: "application/json",
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
    },
    timeout: 30_000,
  });
  const body = response.data;
  const list = Array.isArray(body)
    ? body
    : body !== null && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: unknown[] }).data
      : [];
  return list.map(mapFeedRow).filter((row): row is ImportRow => row !== null);
}

import axios from "axios";
import { CircuitBreaker, retry } from "@/lib/resilience";

/**
 * NSE lists every shareholding-pattern filing on this endpoint; each entry
 * links the XBRL instance on nsearchives. Both answer plain requests from
 * the server today. When NSE starts refusing them (403 / bot challenge) the
 * sync fails loudly and the page keeps serving the last parsed quarter — it
 * never retries around a block.
 */
const SHAREHOLDING_MASTER_URL =
  "https://www.nseindia.com/api/corporate-share-holdings-master";
/** The JSON form of this endpoint stops at 70 rows; the CSV export returns the whole range. */
const HISTORICAL_DEALS_URL =
  "https://www.nseindia.com/api/historicalOR/bulk-block-short-deals";
const USER_AGENT = "Mozilla/5.0";
const REQUEST_TIMEOUT_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 120_000,
});

export interface NseShareholdingFilingEntry {
  readonly recordId: string;
  readonly symbol: string;
  readonly companyName: string;
  readonly asOfDate: Date;
  readonly broadcastAt: Date;
  readonly xbrlUrl: string;
}

async function request<T>(
  url: string,
  responseType: "json" | "text",
): Promise<T>;
async function request<T>(
  url: string,
  responseType: "json" | "text",
  options: { readonly notFoundAsNull: true },
): Promise<T | null>;
/**
 * `notFoundAsNull` turns a 404 into `null` inside the breaker: a file NSE
 * never published is a fact about that file, not an outage, and must not
 * count towards opening the circuit.
 */
async function request<T>(
  url: string,
  responseType: "json" | "text",
  options: { readonly notFoundAsNull?: boolean } = {},
): Promise<T | null> {
  return breaker.execute(() =>
    retry(
      async () => {
        const response = await axios.get<T>(url, {
          headers: {
            "User-Agent": USER_AGENT,
            Accept:
              responseType === "json" ? "application/json" : "application/xml",
          },
          timeout: REQUEST_TIMEOUT_MS,
          responseType,
          validateStatus: (status) =>
            status === 200 ||
            (options.notFoundAsNull === true && status === 404),
        });
        return response.status === 404 ? null : response.data;
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1_000,
        maxDelayMs: 5_000,
        shouldRetry: (error) =>
          axios.isAxiosError(error) &&
          (error.response === undefined || error.response.status >= 500) &&
          error.response?.status !== 503,
      },
    ),
  );
}

function formatDdMmYyyy(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${date.getUTCFullYear()}`;
}

export type NseFilingSegment = "equities" | "sme";

/** Filings broadcast between `from` and `to` (inclusive, by submission date). */
export async function fetchShareholdingFilings(
  from: Date,
  to: Date,
  segment: NseFilingSegment = "equities",
): Promise<NseShareholdingFilingEntry[]> {
  const url = `${SHAREHOLDING_MASTER_URL}?index=${segment}&from_date=${formatDdMmYyyy(from)}&to_date=${formatDdMmYyyy(to)}`;
  const body = await request<unknown>(url, "json");
  return parseShareholdingMasterResponse(body);
}

export type NseDealKind = "bulk" | "block";

/** Bulk or block deals between two dates, as NSE's historical CSV export. */
export async function fetchHistoricalDealsCsv(
  kind: NseDealKind,
  from: Date,
  to: Date,
): Promise<string> {
  const url = `${HISTORICAL_DEALS_URL}?optionType=${kind}_deals&from=${formatDdMmYyyy(from)}&to=${formatDdMmYyyy(to)}&csv=true`;
  return request<string>(url, "text");
}

/**
 * The historical export pads its headers ("Date ", "Buy / Sell ") and starts
 * with a BOM; rewrite the header row to the daily bulk.csv names so one
 * parser reads both.
 */
export function normalizeHistoricalDealsCsv(csv: string): string {
  const text = csv.replace(/^\uFEFF/, "");
  const newline = text.indexOf("\n");
  if (newline < 0) return text;
  const header = text
    .slice(0, newline)
    .split(",")
    .map((cell) => {
      const name = cell.replace(/"/g, "").trim();
      return name === "Buy / Sell" ? "Buy/Sell" : name;
    })
    .join(",");
  return `${header}${text.slice(newline)}`;
}

/** The filing's XBRL, or null when NSE never published the file (404). */
export async function fetchShareholdingXbrl(
  url: string,
): Promise<string | null> {
  if (
    !/^https:\/\/nsearchives\.nseindia\.com\/corporate\/xbrl\/[\w.-]+\.xml$/.test(
      url,
    )
  ) {
    throw new Error(`Unexpected XBRL location: ${url}`);
  }
  return request<string>(url, "text", { notFoundAsNull: true });
}

const MONTHS: Readonly<Record<string, number>> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

/** "30-SEP-2026" → UTC midnight. */
export function parseNseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = MONTHS[match[2]!.toUpperCase()];
  if (month === undefined) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
}

/** "21-OCT-2026 16:25:15" (IST) → instant. */
export function parseNseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match =
    /^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(
      value.trim(),
    );
  if (!match) return parseNseDate(value);
  const month = MONTHS[match[2]!.toUpperCase()];
  if (month === undefined) return null;
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  return new Date(
    Date.UTC(
      Number(match[3]),
      month,
      Number(match[1]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    ) - istOffsetMs,
  );
}

export function parseShareholdingMasterResponse(
  body: unknown,
): NseShareholdingFilingEntry[] {
  const rows = Array.isArray(body)
    ? body
    : body !== null &&
        typeof body === "object" &&
        Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: unknown[] }).data
      : null;
  if (rows === null) {
    throw new Error("NSE shareholding list returned an unexpected payload.");
  }

  const entries: NseShareholdingFilingEntry[] = [];
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const recordId = record.recordId;
    const symbol = record.symbol;
    const xbrlUrl = record.xbrl;
    const asOfDate = parseNseDate(record.date);
    const broadcastAt =
      parseNseTimestamp(record.broadcastDate) ??
      parseNseDate(record.submissionDate);
    if (
      (typeof recordId !== "string" && typeof recordId !== "number") ||
      typeof symbol !== "string" ||
      !symbol.trim() ||
      typeof xbrlUrl !== "string" ||
      !xbrlUrl.endsWith(".xml") ||
      asOfDate === null ||
      broadcastAt === null
    ) {
      continue;
    }
    entries.push({
      recordId: String(recordId),
      symbol: symbol.trim().toUpperCase(),
      companyName:
        typeof record.name === "string" ? record.name.trim() : symbol,
      asOfDate,
      broadcastAt,
      xbrlUrl: xbrlUrl.trim(),
    });
  }
  return entries;
}

/** Consecutive, non-overlapping [from, to] day windows covering the last `totalDays`, newest first. */
export function buildDateWindows(
  now: Date,
  totalDays: number,
  windowDays: number,
): { from: Date; to: Date }[] {
  const windows: { from: Date; to: Date }[] = [];
  let to = now;
  const earliest = now.getTime() - totalDays * DAY_MS;
  while (to.getTime() > earliest) {
    const from = new Date(
      Math.max(earliest, to.getTime() - (windowDays - 1) * DAY_MS),
    );
    windows.push({ from, to });
    to = new Date(from.getTime() - DAY_MS);
  }
  return windows;
}

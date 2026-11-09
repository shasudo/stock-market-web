import axios from "axios";
import { CircuitBreaker, retry } from "@/lib/resilience";

/**
 * BSE's public RSS feed of the latest shareholding-pattern filings (its own
 * "BSE LATEST SHAREHOLDING PATTERNS" channel). It lists only the newest ~20
 * filings and takes no parameters, so it is polled on every cron run and
 * history accrues from the day polling starts. Each item links an
 * inline-XBRL rendition of the filing under /XBRLFILES/SHPXBRLDataXML/.
 *
 * BSE's JSON API (api.bseindia.com) refuses automated requests; this client
 * only reads the RSS feed and the files it links, both served to plain
 * requests, and never retries around a refusal.
 */
const FEED_URL =
  "https://www.bseindia.com/Data/XML/ShareholdingPattern_Feed.aspx";
const FILE_BASE = "https://www.bseindia.com";
const USER_AGENT = "Mozilla/5.0";
const REQUEST_TIMEOUT_MS = 30_000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 120_000,
});

export interface BseShareholdingFeedItem {
  readonly scripCode: string;
  readonly companyName: string;
  readonly fileName: string;
  readonly url: string;
  readonly asOfDate: Date;
  readonly filedAt: Date;
  readonly revised: boolean;
}

async function get(
  url: string,
  notFoundAsNull: boolean,
): Promise<string | null> {
  return breaker.execute(() =>
    retry(
      async () => {
        const response = await axios.get<string>(url, {
          headers: { "User-Agent": USER_AGENT },
          timeout: REQUEST_TIMEOUT_MS,
          responseType: "text",
          validateStatus: (status) =>
            status === 200 || (notFoundAsNull && status === 404),
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

export async function fetchBseShareholdingFeed(): Promise<
  BseShareholdingFeedItem[]
> {
  const xml = await get(FEED_URL, false);
  return parseBseShareholdingFeed(xml ?? "");
}

/** The filing's inline XBRL, or null when BSE no longer serves it (404). */
export async function fetchBseShareholdingXbrl(
  url: string,
): Promise<string | null> {
  if (!isBseShareholdingUrl(url)) {
    throw new Error(`Unexpected BSE XBRL location: ${url}`);
  }
  return get(url, true);
}

export function isBseShareholdingUrl(url: string): boolean {
  return /^https:\/\/www\.bseindia\.com\/XBRLFILES\/SHPXBRLDataXML\/[\w.-]+\.html$/.test(
    url,
  );
}

const ITEM_PATTERN = /<item>([\s\S]*?)<\/item>/g;

function tag(body: string, name: string): string {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(body);
  return decodeEntities(match?.[1] ?? "").trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** "30-09-2026" → UTC midnight. */
function parseDdMmYyyy(value: string | undefined): Date | null {
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec((value ?? "").trim());
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function descriptionField(
  description: string,
  field: string,
): string | undefined {
  for (const part of description.split("|")) {
    const [key, ...rest] = part.split(":");
    if (key?.trim().toUpperCase() === field) return rest.join(":").trim();
  }
  return undefined;
}

/**
 * File names carry the upload time without zero padding:
 * <scrip>_<d><m><yyyy><h><m><s>_SP.html, e.g. 540359_5112026191427 (5-11-2026
 * 19:14:27) or 532755_211202619575 (21-1-2026, time ambiguous). With the date
 * known, the time is used only when exactly six digits are left; otherwise the
 * filing date alone orders revisions.
 */
function withUploadTime(filedDate: Date, fileName: string): Date {
  const stamp = /_(\d+)_SP\.html$/.exec(fileName)?.[1] ?? "";
  const prefix = `${filedDate.getUTCDate()}${filedDate.getUTCMonth() + 1}${filedDate.getUTCFullYear()}`;
  if (!stamp.startsWith(prefix)) return filedDate;
  const time = /^(\d{2})(\d{2})(\d{2})$/.exec(stamp.slice(prefix.length));
  if (!time) return filedDate;
  const [hours, minutes, seconds] = [
    Number(time[1]),
    Number(time[2]),
    Number(time[3]),
  ];
  if (hours > 23 || minutes > 59 || seconds > 59) return filedDate;
  return new Date(
    filedDate.getTime() +
      ((hours * 60 + minutes) * 60 + seconds) * 1000 -
      IST_OFFSET_MS,
  );
}

export function parseBseShareholdingFeed(
  xml: string,
): BseShareholdingFeedItem[] {
  if (!/<rss\b/i.test(xml)) {
    throw new Error("BSE shareholding feed returned an unexpected payload.");
  }
  const items: BseShareholdingFeedItem[] = [];
  for (const match of xml.matchAll(ITEM_PATTERN)) {
    const body = match[1] ?? "";
    const title = tag(body, "title");
    const link = tag(body, "link");
    const description = tag(body, "description");

    const titleMatch = /^(.*?)\s*\((\d{5,7})\)\s*$/.exec(title);
    const fileName = link.split("/").pop() ?? "";
    const url = link.startsWith("http")
      ? link
      : `${FILE_BASE}${link.startsWith("/") ? "" : "/"}${link}`;
    const asOfDate = parseDdMmYyyy(descriptionField(description, "AS ON DATE"));
    const revised = /revised/i.test(
      descriptionField(description, "STATUS") ?? "",
    );
    const filedDate =
      parseDdMmYyyy(descriptionField(description, "REVISED FILING DATE")) ??
      parseDdMmYyyy(descriptionField(description, "SUBMISSION_DT"));
    if (!titleMatch || !asOfDate || !filedDate || !isBseShareholdingUrl(url))
      continue;

    const filedAt = withUploadTime(filedDate, fileName);

    items.push({
      scripCode: titleMatch[2]!,
      companyName: titleMatch[1]!.trim(),
      fileName,
      url,
      asOfDate,
      filedAt,
      revised,
    });
  }
  return items;
}

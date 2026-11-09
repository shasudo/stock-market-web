/**
 * Per-company corporate actions and filings from NSE's public company
 * endpoints (corporate actions, announcements, annual reports). Pure parsing
 * here; the network client is in nse-company-client.ts.
 */

export type CorporateActionKind =
  | "dividend"
  | "bonus"
  | "split"
  | "rights"
  | "buyback"
  | "demerger"
  | "other";

export interface CorporateActionItem {
  readonly kind: CorporateActionKind;
  readonly subject: string;
  /** YYYY-MM-DD, or null when NSE has none ("-"). */
  readonly exDate: string | null;
  readonly recordDate: string | null;
}

export interface FilingItem {
  /** ISO timestamp (IST offset) of the exchange broadcast. */
  readonly date: string;
  readonly category: string;
  readonly summary: string;
  readonly url: string | null;
  readonly fileSize: string | null;
}

export interface ConcallItem extends FilingItem {
  readonly label: "Transcript" | "Recording" | "Presentation" | "Notes";
}

export interface AnnualReportItem {
  readonly fromYear: number;
  readonly toYear: number;
  readonly url: string;
  readonly filedAt: string | null;
}

export interface CompanyDocumentsResponse {
  readonly symbol: string;
  readonly actions: readonly CorporateActionItem[];
  readonly announcements: readonly FilingItem[];
  readonly annualReports: readonly AnnualReportItem[];
  readonly creditRatings: readonly FilingItem[];
  readonly concalls: readonly ConcallItem[];
  /** Sections whose NSE request failed this time (shown as unavailable). */
  readonly unavailable: readonly ("actions" | "announcements" | "annualReports")[];
  readonly fetchedAt: string;
}

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const NSE_DATE = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/** "05-Jun-2026" → "2026-06-05"; anything else (incl. "-") → null. */
export function parseNseDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = NSE_DATE.exec(value.trim());
  if (!match) return null;
  const month = MONTHS[match[2]!.toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
}

/** "06-Nov-2026 19:10:58" (IST) → "2026-11-06T19:10:58+05:30"; null if unparseable. */
export function parseNseTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = NSE_DATE.exec(value.trim());
  if (!match) return null;
  const day = parseNseDay(`${match[1]}-${match[2]}-${match[3]}`);
  if (!day) return null;
  const time = `${match[4] ?? "00"}:${match[5] ?? "00"}:${match[6] ?? "00"}`;
  return `${day}T${time}+05:30`;
}

export function classifyCorporateAction(subject: string): CorporateActionKind {
  const text = subject.toLowerCase();
  if (/dividend|distribution/.test(text)) return "dividend";
  if (/bonus/.test(text)) return "bonus";
  if (/split|sub-?division/.test(text)) return "split";
  if (/rights/.test(text)) return "rights";
  if (/buy ?back/.test(text)) return "buyback";
  if (/demerger|scheme of arrangement|spin/.test(text)) return "demerger";
  return "other";
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function httpsUrl(value: unknown): string | null {
  const url = text(value);
  return /^https:\/\/[\w.-]+\.nseindia\.com\//.test(url) ? url : null;
}

export function parseCorporateActions(payload: unknown): CorporateActionItem[] {
  if (!Array.isArray(payload)) return [];
  const items: CorporateActionItem[] = [];
  for (const raw of payload) {
    const row = record(raw);
    const subject = text(row?.subject);
    if (!row || !subject) continue;
    items.push({
      kind: classifyCorporateAction(subject),
      subject,
      exDate: parseNseDay(row.exDate),
      recordDate: parseNseDay(row.recDate),
    });
  }
  return items.sort((a, b) => (b.exDate ?? "").localeCompare(a.exDate ?? ""));
}

export function parseAnnouncements(payload: unknown): FilingItem[] {
  if (!Array.isArray(payload)) return [];
  const items: FilingItem[] = [];
  for (const raw of payload) {
    const row = record(raw);
    const date = parseNseTimestamp(row?.an_dt) ?? parseNseTimestamp(row?.sort_date);
    if (!row || !date) continue;
    items.push({
      date,
      category: text(row.desc) || "Announcement",
      summary: text(row.attchmntText),
      url: httpsUrl(row.attchmntFile),
      fileSize: text(row.attFileSize) || null,
    });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export function parseAnnualReports(payload: unknown): AnnualReportItem[] {
  const rows = record(payload)?.data;
  if (!Array.isArray(rows)) return [];
  const items: AnnualReportItem[] = [];
  for (const raw of rows) {
    const row = record(raw);
    const url = httpsUrl(row?.fileName);
    const fromYear = Number(row?.fromYr);
    const toYear = Number(row?.toYr);
    if (!row || !url || !Number.isInteger(fromYear) || !Number.isInteger(toYear)) continue;
    items.push({
      fromYear,
      toYear,
      url,
      filedAt: parseNseTimestamp(row.broadcast_dttm),
    });
  }
  // Keep the latest filing per financial year (a revised report replaces the first).
  const byYear = new Map<number, AnnualReportItem>();
  for (const item of items) {
    const existing = byYear.get(item.toYear);
    if (!existing || (item.filedAt ?? "") > (existing.filedAt ?? "")) byYear.set(item.toYear, item);
  }
  return [...byYear.values()].sort((a, b) => b.toYear - a.toYear);
}

const CONCALL_CATEGORY = /analysts?\/institutional investor meet|con\.? ?call/i;
const CREDIT_RATING_CATEGORY = /credit rating/i;

export function concallLabel(item: FilingItem): ConcallItem["label"] {
  const haystack = `${item.summary} ${item.url ?? ""}`.toLowerCase();
  if (haystack.includes("transcript")) return "Transcript";
  if (/recording|audio|video|webcast/.test(haystack)) return "Recording";
  if (/presentation|\bppt\b/.test(haystack)) return "Presentation";
  return "Notes";
}

export function buildCompanyDocuments(input: {
  readonly symbol: string;
  readonly actions: unknown;
  readonly announcements: unknown;
  readonly annualReports: unknown;
  readonly unavailable: CompanyDocumentsResponse["unavailable"];
  readonly fetchedAt: Date;
}): CompanyDocumentsResponse {
  const announcements = parseAnnouncements(input.announcements);
  return {
    symbol: input.symbol,
    actions: parseCorporateActions(input.actions),
    announcements,
    annualReports: parseAnnualReports(input.annualReports),
    creditRatings: announcements.filter((item) => CREDIT_RATING_CATEGORY.test(item.category)),
    // Meeting intimations far outnumber the useful files; keep transcripts,
    // recordings and presentations only.
    concalls: announcements
      .filter((item) => CONCALL_CATEGORY.test(item.category) && item.url !== null)
      .map((item) => ({ ...item, label: concallLabel(item) }))
      .filter((item) => item.label !== "Notes"),
    unavailable: input.unavailable,
    fetchedAt: input.fetchedAt.toISOString(),
  };
}

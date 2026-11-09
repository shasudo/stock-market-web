/**
 * Pure parsers for NSE's IPO endpoints and SEBI's draft-offer listing, plus
 * the SEBI T+3 timeline. No network here; see service.ts.
 */

export type IpoSegment = "Mainboard" | "SME";
export type IpoStatus = "open" | "upcoming" | "closed" | "listed";

export interface IpoSubscription {
  readonly qib: number | null;
  readonly nii: number | null;
  /** NII bidding above ₹10 lakh. */
  readonly bnii: number | null;
  /** NII bidding ₹2–10 lakh. */
  readonly snii: number | null;
  readonly retail: number | null;
  readonly employee: number | null;
  readonly shareholder: number | null;
  readonly total: number | null;
}

export interface IpoDocument {
  readonly label: string;
  readonly url: string;
}

export interface IpoDetail {
  readonly lotSize: number | null;
  readonly faceValue: number | null;
  readonly priceLow: number | null;
  readonly priceHigh: number | null;
  readonly issueSizeCr: number | null;
  readonly issueType: string | null;
  readonly registrar: string | null;
  readonly leadManagers: string | null;
  readonly industry: string | null;
  readonly listingDate: string | null;
  readonly documents: readonly IpoDocument[];
  readonly subscription: IpoSubscription | null;
}

export interface IpoListing {
  /** Listing-day open and close from the exchange's daily candles. */
  readonly openPrice: number | null;
  readonly closePrice: number | null;
  /** Listing-day open vs issue price. */
  readonly listingGainPct: number | null;
  readonly lastPrice: number | null;
  readonly dayChangePct: number | null;
  /** Live price vs issue price. */
  readonly currentGainPct: number | null;
}

export interface IpoTimeline {
  readonly open: string | null;
  readonly close: string | null;
  readonly allotment: string | null;
  readonly refund: string | null;
  readonly dematCredit: string | null;
  readonly listing: string | null;
  /** Dates computed from the T+3 schedule rather than published by the exchange. */
  readonly tentative: boolean;
}

export interface IpoIssue {
  readonly symbol: string;
  readonly companyName: string;
  readonly segment: IpoSegment;
  readonly status: IpoStatus;
  readonly openDate: string | null;
  readonly closeDate: string | null;
  readonly listingDate: string | null;
  readonly priceLow: number | null;
  readonly priceHigh: number | null;
  /** Final issue price once the basis of allotment is set. */
  readonly issuePrice: number | null;
  readonly lotSize: number | null;
  /** One lot at the upper price band (₹). */
  readonly minInvestment: number | null;
  readonly issueSizeCr: number | null;
  readonly faceValue: number | null;
  readonly issueType: string | null;
  readonly registrar: string | null;
  readonly leadManagers: string | null;
  readonly industry: string | null;
  readonly documents: readonly IpoDocument[];
  readonly subscription: IpoSubscription | null;
  readonly timeline: IpoTimeline;
  readonly listing: IpoListing | null;
  /** NSE's issue page for this IPO. */
  readonly nseUrl: string;
}

export interface DraftFiling {
  /** YYYY-MM-DD */
  readonly date: string;
  readonly company: string;
  /** DRHP, UDRHP, Addendum to DRHP, ... */
  readonly documentType: string;
  readonly url: string;
}

const MONTHS: Readonly<Record<string, string>> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "29-OCT-2026" / "29-Oct-2026" / "Nov 04, 2026" → "2026-10-29"; "-" → null. */
export function parseDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  let match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(text);
  if (match) {
    const month = MONTHS[match[2]!.toLowerCase()];
    return month ? `${match[3]}-${month}-${match[1]!.padStart(2, "0")}` : null;
  }
  match = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})$/.exec(text);
  if (match) {
    const month = MONTHS[match[1]!.toLowerCase()];
    return month ? `${match[3]}-${month}-${match[2]!.padStart(2, "0")}` : null;
  }
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[₹,\s]|Rs\.?/gi, "");
  if (!cleaned || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text && text !== "-" ? text : null;
}

/** "Rs.78 to Rs.82" / "Rs. 78/- to Rs. 82/- per Equity Share" / "82" → [78, 82]. */
export function parsePriceRange(value: unknown): { low: number | null; high: number | null } {
  if (typeof value !== "string") return { low: null, high: null };
  const numbers = [...value.replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)/g)]
    .map((match) => Number(match[1]))
    .filter((n) => Number.isFinite(n) && n > 0);
  // "Rs. 10 per Equity Share" style face values never reach here; a range has
  // its two prices first.
  if (numbers.length === 0) return { low: null, high: null };
  if (numbers.length === 1) return { low: numbers[0]!, high: numbers[0]! };
  return { low: Math.min(numbers[0]!, numbers[1]!), high: Math.max(numbers[0]!, numbers[1]!) };
}

function segmentOf(value: unknown): IpoSegment {
  return typeof value === "string" && /sme|emerge|^st$|^sm$/i.test(value.trim()) ? "SME" : "Mainboard";
}

export function istToday(now = new Date()): string {
  return new Date(now.getTime() + 19_800_000).toISOString().slice(0, 10);
}

export function statusFor(
  openDate: string | null,
  closeDate: string | null,
  listingDate: string | null,
  today: string,
): IpoStatus {
  if (listingDate !== null && listingDate <= today) return "listed";
  if (openDate !== null && today < openDate) return "upcoming";
  if (closeDate !== null && today > closeDate) return "closed";
  if (openDate !== null) return "open";
  return "upcoming";
}

const MAX_LISTING_GAP_DAYS = 45;

function daysApart(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

export interface BoardRow {
  readonly symbol: string;
  readonly companyName: string;
  readonly segment: IpoSegment;
  readonly openDate: string | null;
  readonly closeDate: string | null;
  readonly listingDate: string | null;
  readonly priceLow: number | null;
  readonly priceHigh: number | null;
  readonly issuePrice: number | null;
  readonly issueSizeCr: number | null;
  readonly subscriptionTotal: number | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Rows from ipo-current-issue, all-upcoming-issues and public-past-issues (field names differ). */
export function parseBoardRows(payload: unknown): BoardRow[] {
  const rows = Array.isArray(payload) ? payload : (record(payload)?.data as unknown);
  if (!Array.isArray(rows)) return [];
  const result: BoardRow[] = [];
  for (const raw of rows) {
    const row = record(raw);
    if (!row) continue;
    const symbol = str(row.symbol);
    const companyName = str(row.companyName) ?? str(row.company);
    if (!symbol || !companyName) continue;
    // public-past-issues also lists debt, InvIT and REIT offers.
    const securityType = str(row.securityType);
    if (securityType !== null && !/^(equity|sme)$/i.test(securityType)) continue;
    const band = parsePriceRange(row.priceRange ?? row.issuePrice ?? row.priceBand);
    const issuePrice = num(row.issuePrice);
    const closeDate = parseDay(row.ipoEndDate ?? row.issueEndDate);
    let listingDate = parseDay(row.listingDate);
    // A listing months after bidding closed is a data slip, not this issue's listing.
    if (listingDate && closeDate && daysApart(closeDate, listingDate) > MAX_LISTING_GAP_DAYS) listingDate = null;
    result.push({
      symbol,
      companyName,
      segment: segmentOf(securityType ?? row.series),
      openDate: parseDay(row.ipoStartDate ?? row.issueStartDate),
      closeDate,
      listingDate,
      priceLow: band.low,
      priceHigh: band.high,
      // past-issues gives the final price; the boards give the band in issuePrice.
      issuePrice: row.priceRange !== undefined ? issuePrice : null,
      issueSizeCr: null,
      subscriptionTotal: num(row.noOfTime),
    });
  }
  return result;
}

/**
 * "Rs. 1,830.57 million" → 183.057; "₹ 500 crore" → 500; "Rs. 41.20 Lakhs" →
 * 0.412. SME sheets often give only share counts ("Fresh Issue of up to
 * 23,26,000 equity shares and Offer for Sale of up to 5,54,000 Equity
 * Shares"): those are summed (parenthetical market-maker / anchor portions
 * excluded) and priced at the upper band.
 */
export function parseIssueSizeCr(value: unknown, priceHigh: number | null = null): number | null {
  if (typeof value !== "string") return null;
  const match = /(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?|million|mn|lakhs?|lacs?|billion)/i.exec(value);
  if (!match) {
    if (priceHigh === null || priceHigh <= 0) return null;
    const outside = value.replace(/\([^)]*\)/g, " ");
    const shares = [...outside.matchAll(/([\d,]{4,})\s*equity shares/gi)]
      .map((found) => Number(found[1]!.replace(/,/g, "")))
      .filter((count) => Number.isFinite(count) && count > 0);
    if (shares.length === 0) return null;
    return (shares.reduce((sum, count) => sum + count, 0) * priceHigh) / 1e7;
  }
  const amount = Number(match[1]!.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;
  const unit = match[2]!.toLowerCase();
  if (unit.startsWith("cr")) return amount;
  if (unit.startsWith("mil") || unit === "mn") return amount / 10;
  if (unit.startsWith("bil")) return amount * 100;
  return amount / 100;
}

function times(value: unknown): number | null {
  const parsed = num(value);
  return parsed === null ? null : Math.round(parsed * 100) / 100;
}

/** Consolidated subscription (NSE + BSE) from ipo-detail's activeCat table. */
export function parseSubscription(activeCat: unknown): IpoSubscription | null {
  const rows = record(activeCat)?.dataList;
  if (!Array.isArray(rows)) return null;
  const pick = (test: (category: string, srNo: string) => boolean): number | null => {
    for (const raw of rows) {
      const row = record(raw);
      const category = str(row?.category) ?? "";
      const srNo = str(row?.srNo) ?? "";
      if (row && test(category, srNo)) {
        const value = times(row.noOfTotalMeant);
        if (value !== null) return value;
      }
    }
    return null;
  };
  const subscription: IpoSubscription = {
    qib: pick((category) => /^qualified institutional/i.test(category)),
    nii: pick((category) => /^non institutional investors$/i.test(category)),
    bnii: pick((category) => /non institutional.*more than ten lakh/i.test(category)),
    snii: pick((category) => /non institutional.*two lakh/i.test(category)),
    retail: pick((category) => /^retail individual/i.test(category)),
    employee: pick((category) => /^employee/i.test(category)),
    shareholder: pick((category) => /^shareholder/i.test(category)),
    total: pick((category, srNo) => /^total$/i.test(category) || (srNo === "" && /total/i.test(category))),
  };
  return Object.values(subscription).some((value) => value !== null) ? subscription : null;
}

const DOCUMENT_TITLES: readonly [RegExp, string][] = [
  [/^red herring prospectus/i, "Red Herring Prospectus"],
  [/^prospectus/i, "Prospectus"],
  [/^ratios/i, "Basis of Issue Price"],
  [/^anchor allocation/i, "Anchor Allocation"],
  [/^sample application/i, "Application Forms"],
];

/** ipo-detail: the issue sheet (title/value pairs), consolidated subscription and metadata. */
export function parseIpoDetail(payload: unknown): IpoDetail | null {
  const body = record(payload);
  if (!body) return null;
  const sheet = new Map<string, string>();
  const documents: IpoDocument[] = [];
  const list = record(body.issueInfo)?.dataList;
  if (Array.isArray(list)) {
    for (const raw of list) {
      const row = record(raw);
      const title = str(row?.title);
      const value = typeof row?.value === "string" ? row.value.replace(/^"|"$/g, "").trim() : "";
      if (!title || !value) continue;
      sheet.set(title.toLowerCase(), value);
      for (const [pattern, label] of DOCUMENT_TITLES) {
        if (pattern.test(title) && /^https:\/\/[\w.-]+\.nseindia\.com\//.test(value)) {
          documents.push({ label, url: value });
        }
      }
    }
  }
  const get = (key: string): string | null => str(sheet.get(key));
  const band = parsePriceRange(get("price range"));
  const meta = record(body.metaInfo);
  const lot = get("bid lot") ?? get("lot size") ?? get("market lot") ?? get("minimum order quantity");
  return {
    lotSize: lot ? num(/[\d,]+/.exec(lot)?.[0]) : null,
    faceValue: num(/\d+(?:\.\d+)?/.exec(get("face value") ?? "")?.[0]),
    priceLow: band.low,
    priceHigh: band.high,
    issueSizeCr: parseIssueSizeCr(get("issue size"), band.high),
    issueType: get("issue type"),
    registrar: get("name of the registrar"),
    leadManagers: get("book running lead managers") ?? get("lead managers"),
    industry: str(meta?.industry),
    listingDate: parseDay(meta?.listingDate),
    documents,
    subscription: (() => {
      const consolidated = parseSubscription(body.activeCat);
      if (consolidated && (consolidated.total ?? 0) > 0) return consolidated;
      // SME issues publish an all-zero category table; the demand graph has the real multiple.
      const total =
        times(record(body.demandGraphALL)?.noOfTimesIssueSubscribed) ??
        times(record(body.demandGraph)?.noOfTimesIssueSubscribed);
      // An all-zero table with no demand data means NSE published no bids, not "0x".
      if (total === null || total <= 0) return null;
      return { qib: null, nii: null, bnii: null, snii: null, retail: null, employee: null, shareholder: null, total };
    })(),
  };
}

/** NSE holiday-master (type=trading): capital-market trading holidays as YYYY-MM-DD. */
export function parseHolidays(payload: unknown): Set<string> {
  const rows = record(payload)?.CM;
  const days = new Set<string>();
  if (!Array.isArray(rows)) return days;
  for (const raw of rows) {
    const day = parseDay(record(raw)?.tradingDate);
    if (day) days.add(day);
  }
  return days;
}

function addTradingDays(date: string, count: number, holidays: ReadonlySet<string>): string {
  const day = new Date(`${date}T00:00:00Z`);
  let added = 0;
  while (added < count) {
    day.setUTCDate(day.getUTCDate() + 1);
    const weekday = day.getUTCDay();
    const iso = day.toISOString().slice(0, 10);
    if (weekday !== 0 && weekday !== 6 && !holidays.has(iso)) added += 1;
  }
  return day.toISOString().slice(0, 10);
}

/**
 * SEBI's T+3 timeline (mandatory for issues opening from 1 Dec 2023), T being
 * the close date: basis of allotment T+1, refunds and demat credit T+2,
 * listing T+3, counted in trading days. A published listing date wins.
 */
export function ipoTimeline(
  openDate: string | null,
  closeDate: string | null,
  listingDate: string | null,
  holidays: ReadonlySet<string>,
): IpoTimeline {
  if (!closeDate) {
    return { open: openDate, close: null, allotment: null, refund: null, dematCredit: null, listing: listingDate, tentative: true };
  }
  return {
    open: openDate,
    close: closeDate,
    allotment: addTradingDays(closeDate, 1, holidays),
    refund: addTradingDays(closeDate, 2, holidays),
    dematCredit: addTradingDays(closeDate, 2, holidays),
    listing: listingDate ?? addTradingDays(closeDate, 3, holidays),
    tentative: listingDate === null,
  };
}

function decode(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DRAFT_TYPES: readonly [RegExp, string][] = [
  [/\baddendum\b/i, "Addendum to DRHP"],
  [/\budrhp\b|updated draft red herring/i, "UDRHP"],
  [/\bdrhp\b|draft red herring/i, "DRHP"],
  [/\bdraft letter of offer\b/i, "Draft Letter of Offer"],
];

/**
 * SEBI "Public Issues" filings listing: keep draft offer documents (DRHP,
 * UDRHP, addenda) and split the company name from the document title.
 */
export function parseSebiDraftFilings(html: string): DraftFiling[] {
  const filings: DraftFiling[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = row[1] ?? "";
    const date = parseDay(decode(/<td[^>]*>([\s\S]*?)<\/td>/i.exec(cells)?.[1] ?? ""));
    const anchor = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(cells);
    if (!date || !anchor) continue;
    const href = anchor[1]!;
    const url = href.startsWith("http") ? href : `https://www.sebi.gov.in${href.startsWith("/") ? "" : "/"}${href}`;
    if (!/^https:\/\/www\.sebi\.gov\.in\//.test(url)) continue;
    // SEBI puts the filing title in the link's title attribute, followed by a
    // nested link to the abridged prospectus; the text before "<br" is the title.
    const titleAttribute = /title="([^"]*)"/i.exec(cells)?.[1] ?? /title='([^']*)'/i.exec(cells)?.[1] ?? "";
    const title = decode(titleAttribute.split(/<br/i)[0] ?? "") || decode(anchor[2] ?? "");
    const type = DRAFT_TYPES.find(([pattern]) => pattern.test(title));
    if (!type) continue;
    const company = title
      .replace(/\s*[-–]\s*(addendum.*|udrhp.*|drhp.*|draft.*)$/i, "")
      .replace(/\s+(addendum.*|udrhp.*|drhp.*|draft red herring.*)$/i, "")
      .trim();
    filings.push({ date, company: company || title, documentType: type[1], url });
  }
  return filings;
}

export function nseIssueUrl(symbol: string, segment: IpoSegment): string {
  return `https://www.nseindia.com/market-data/issue-information?symbol=${encodeURIComponent(symbol)}&series=${segment === "SME" ? "SME" : "EQ"}&type=Active`;
}

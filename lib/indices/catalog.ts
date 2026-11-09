/**
 * NSE index list from NSE's public allIndices feed, grouped into the tabs
 * Moneycontrol's Indian Indices terminal uses. Pure parsing; no network.
 */
import { INDEX_CONSTITUENT_FILES } from "./constituent-files";

export type IndexTab =
  | "key"
  | "sectoral"
  | "other"
  | "largeCap"
  | "midCap"
  | "smallCap"
  | "all";

export interface IndexRow {
  readonly name: string;
  readonly symbol: string;
  /** NSE's own group, e.g. "SECTORAL INDICES". */
  readonly group: string;
  readonly tabs: readonly IndexTab[];
  readonly last: number | null;
  readonly change: number | null;
  readonly changePct: number | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly prevClose: number | null;
  readonly yearHigh: number | null;
  readonly yearLow: number | null;
  readonly pe: number | null;
  readonly pb: number | null;
  readonly dividendYield: number | null;
  readonly advances: number | null;
  readonly declines: number | null;
  readonly unchanged: number | null;
  readonly change1w: number | null;
  readonly change1m: number | null;
  readonly change1y: number | null;
  readonly hasConstituents: boolean;
}

/** Moneycontrol's "Key Indices", in its order, by NSE name. */
export const KEY_INDICES: readonly string[] = [
  "NIFTY 50",
  "NIFTY BANK",
  "NIFTY MIDCAP 100",
  "NIFTY NEXT 50",
  "NIFTY 100",
  "NIFTY 200",
  "NIFTY 500",
  "NIFTY SMALLCAP 100",
  "NIFTY MIDCAP 50",
  "NIFTY SMALLCAP 50",
  "INDIA VIX",
  "NIFTY TOTAL MARKET",
];

function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/,/g, "")) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function positive(value: unknown): number | null {
  const parsed = num(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function pctFrom(last: number | null, base: unknown): number | null {
  const then = positive(base);
  return last !== null && then !== null ? ((last - then) / then) * 100 : null;
}

export function tabsFor(name: string, group: string): IndexTab[] {
  const upper = name.toUpperCase();
  const tabs: IndexTab[] = ["all"];
  if (KEY_INDICES.includes(upper)) tabs.push("key");
  if (group === "SECTORAL INDICES") tabs.push("sectoral");
  if (group === "THEMATIC INDICES" || group === "STRATEGY INDICES") tabs.push("other");
  const broad = group === "BROAD MARKET INDICES" || group === "INDICES ELIGIBLE IN DERIVATIVES";
  if (/LARGEMIDCAP/.test(upper)) tabs.push("largeCap", "midCap");
  else if (/SMALLCAP|SMLCAP|MICROCAP/.test(upper)) tabs.push("smallCap");
  else if (/MIDCAP|MID SMALL|MIDSMALL/.test(upper)) tabs.push("midCap");
  else if (broad && /\b(NIFTY 50|NEXT 50|NIFTY 100|NIFTY 200|LARGEMIDCAP 250|TOP 10|TOP 15|TOP 20)\b/.test(upper)) tabs.push("largeCap");
  return tabs;
}

/** NSE allIndices → index rows (fixed-income indices are left out). */
export function parseAllIndices(payload: unknown): IndexRow[] {
  const rows = (payload as { data?: unknown })?.data;
  if (!Array.isArray(rows)) return [];
  const result: IndexRow[] = [];
  for (const raw of rows) {
    if (raw === null || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const name = typeof row.index === "string" ? row.index.trim() : "";
    const group = typeof row.key === "string" ? row.key.trim() : "";
    if (!name || group === "FIXED INCOME INDICES") continue;
    const last = positive(row.last);
    result.push({
      name,
      symbol: typeof row.indexSymbol === "string" ? row.indexSymbol : name,
      group,
      tabs: tabsFor(name, group),
      last,
      change: num(row.variation),
      changePct: num(row.percentChange),
      open: positive(row.open),
      high: positive(row.high),
      low: positive(row.low),
      prevClose: positive(row.previousClose),
      yearHigh: positive(row.yearHigh),
      yearLow: positive(row.yearLow),
      pe: positive(row.pe),
      pb: positive(row.pb),
      dividendYield: positive(row.dy),
      advances: num(row.advances),
      declines: num(row.declines),
      unchanged: num(row.unchanged),
      change1w: pctFrom(last, row.oneWeekAgoVal ?? row.oneWeekAgo),
      change1m: num(row.perChange30d) ?? pctFrom(last, row.oneMonthAgoVal),
      change1y: num(row.perChange365d) ?? pctFrom(last, row.oneYearAgoVal),
      hasConstituents: name.toUpperCase() in INDEX_CONSTITUENT_FILES,
    });
  }
  return result;
}

export interface ConstituentListing {
  readonly symbol: string;
  readonly companyName: string;
  readonly industry: string;
}

/** NSE constituent CSV: "Company Name,Industry,Symbol,Series,ISIN Code". */
export function parseConstituentCsv(csv: string): ConstituentListing[] {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const header = lines[0]!.split(",").map((cell) => cell.trim().toLowerCase());
  const at = (name: string) => header.indexOf(name);
  const result: ConstituentListing[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(1)) {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) {
        cells.push(current.trim());
        current = "";
      } else current += char;
    }
    cells.push(current.trim());
    const symbol = cells[at("symbol")]?.toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    result.push({
      symbol,
      companyName: cells[at("company name")] || symbol,
      industry: cells[at("industry")] || "",
    });
  }
  return result;
}

export type BreadthBucket = "lt-5" | "-5to-3" | "-3to0" | "0to3" | "3to5" | "gt5";

export const BREADTH_BUCKETS: readonly { key: BreadthBucket; label: string }[] = [
  { key: "lt-5", label: "< -5%" },
  { key: "-5to-3", label: "-5% to -3%" },
  { key: "-3to0", label: "-3% to 0%" },
  { key: "0to3", label: "0% to 3%" },
  { key: "3to5", label: "3% to 5%" },
  { key: "gt5", label: "> 5%" },
];

export function bucketOf(changePct: number): BreadthBucket {
  if (changePct < -5) return "lt-5";
  if (changePct < -3) return "-5to-3";
  if (changePct < 0) return "-3to0";
  if (changePct <= 3) return "0to3";
  if (changePct <= 5) return "3to5";
  return "gt5";
}

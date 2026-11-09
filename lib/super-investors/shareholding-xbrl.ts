/**
 * Reader for the SEBI LODR Reg. 31 shareholding-pattern XBRL instance that
 * every listed company files each quarter (BSE's in-bse-shp taxonomy, which
 * NSE republishes on nsearchives). Only the named-holder tables matter here:
 * every promoter / promoter-group entity, and every public holder with more
 * than 1% of the company (the disclosure threshold set by the regulation).
 *
 * The instance is flat: each named holder is one typed-dimension member with
 * two contexts, a duration one carrying the name and an instant one carrying
 * the share counts. Both share the same dimension + typed value, which is
 * what links them, so the parser never relies on the generator's context-id
 * naming.
 */

export interface ShareholdingXbrlHolder {
  /** Axis local name without the "DetailsOfSharesHeldBy…" prefix / "Axis" suffix. */
  readonly table: string;
  readonly name: string;
  readonly shares: number;
  /** Percent of total shares, 0–100. */
  readonly percent: number;
  readonly isPromoter: boolean;
  /** "Bodies Corporate", "HUF", "Clearing Members"… when the table has one. */
  readonly subCategory: string | null;
  /** NumberOfShareholders on the row — >1 means an aggregate line, not a person. */
  readonly holderCount: number | null;
  /** "Category" rows in the "any other" tables are totals, not holders. */
  readonly isCategoryRow: boolean;
}

export interface ShareholdingXbrlDocument {
  readonly scripCode: string | null;
  readonly asOfDate: string | null;
  readonly totalShares: number | null;
  readonly holders: readonly ShareholdingXbrlHolder[];
}

interface ContextInfo {
  readonly memberKey: string | null;
  readonly axis: string | null;
  readonly explicitMembers: readonly string[];
}

// Attributes are double-quoted in NSE's XBRL and single-quoted in BSE's
// inline-XBRL (XHTML) renditions, so every pattern accepts both.
const CONTEXT_PATTERN =
  /<(?:[\w-]+:)?context\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:[\w-]+:)?context>/g;
const TYPED_MEMBER_PATTERN =
  /<(?:[\w-]+:)?typedMember\b[^>]*\bdimension=["'](?:[\w-]+:)?([^"']+)["'][^>]*>\s*<(?:[\w-]+:)?[\w-]+>([\s\S]*?)<\/(?:[\w-]+:)?[\w-]+>/;
const EXPLICIT_MEMBER_PATTERN =
  /<(?:[\w-]+:)?explicitMember\b[^>]*>\s*(?:[\w-]+:)?([^<\s]+)\s*<\/(?:[\w-]+:)?explicitMember>/g;
const FACT_PATTERN =
  /<([\w-]+):([\w-]+)\b([^>]*\bcontextRef=["']([^"']+)["'][^>]*?)(?:\/>|>([\s\S]*?)<\/\1:\2>)/g;
/** Inline XBRL: <ix:nonFraction name='in-bse-shp:X' contextRef='C' scale='-2'>64.66</ix:nonFraction>. */
const INLINE_FACT_PATTERN =
  /<ix:(nonFraction|nonNumeric)\b([^>]*)>([\s\S]*?)<\/ix:\1>/g;
const INSTANT_PATTERN = /<(?:[\w-]+:)?instant>\s*([0-9-]+)\s*</;
const IDENTIFIER_PATTERN = /<(?:[\w-]+:)?identifier\b[^>]*>\s*([^<\s]+)\s*</;

const NON_FACT_PREFIXES = new Set([
  "xbrli",
  "link",
  "xbrldi",
  "xbrldt",
  "xl",
  "ix",
]);

interface RawFact {
  readonly prefix: string;
  readonly name: string;
  readonly contextRef: string;
  readonly value: string;
}

function readAttribute(attributes: string, name: string): string | null {
  const match = new RegExp(`\\b${name}=["']([^"']*)["']`).exec(attributes);
  return match?.[1] ?? null;
}

function* readFacts(xml: string): Generator<RawFact> {
  for (const match of xml.matchAll(FACT_PATTERN)) {
    const [, prefix, name, , contextRef, rawValue] = match;
    if (!prefix || !name || !contextRef || NON_FACT_PREFIXES.has(prefix)) {
      continue;
    }
    yield { prefix, name, contextRef, value: decodeXml(rawValue ?? "").trim() };
  }

  for (const match of xml.matchAll(INLINE_FACT_PATTERN)) {
    const [, kind, attributes = "", inner = ""] = match;
    const qualified = readAttribute(attributes, "name");
    const contextRef = readAttribute(attributes, "contextRef");
    if (!qualified || !contextRef) continue;
    const [prefix, name] = qualified.includes(":")
      ? qualified.split(":", 2)
      : ["", qualified];
    if (!prefix || !name) continue;
    let value = decodeXml(inner.replace(/<[^>]+>/g, "")).trim();
    if (kind === "nonFraction") {
      const numeric = Number(value.replace(/,/g, ""));
      const scale = Number(readAttribute(attributes, "scale") ?? "0");
      const negative = readAttribute(attributes, "sign") === "-";
      if (Number.isFinite(numeric)) {
        const scaled = numeric * 10 ** (Number.isFinite(scale) ? scale : 0);
        value = String(negative ? -scaled : scaled);
      }
    }
    yield { prefix, name, contextRef, value };
  }
}

/**
 * Promoter-side tables (Table II of the pattern). TypeOfPromoterShareholding
 * also flags these rows, but older filings sometimes omit it, so the table
 * name is the primary signal.
 */
const PROMOTER_TABLES = new Set([
  "IndividualsOrHUF",
  "OthersIndianShareholders",
  "CentralGovernmentOrStateGovernments",
  "FinancialInstitutionsOrBanks",
  "NonResidentIndividualsOrForeignIndividuals",
  "OtherForeignShareholders",
  "Government",
  "Institutions",
  "ForeignPortfolioInvestor",
]);

export function normalizeTableName(axis: string): string {
  return axis
    .replace(/Axis$/, "")
    .replace(/^DetailsOfSharesHeldBy/, "")
    .replace(/^DetailsSharesHeldBy/, "")
    .replace(/^DetailsOf/, "");
}

export function parseShareholdingXbrl(xml: string): ShareholdingXbrlDocument {
  const contexts = new Map<string, ContextInfo>();
  let scripCode: string | null = null;
  let asOfDate: string | null = null;

  for (const match of xml.matchAll(CONTEXT_PATTERN)) {
    const [, id, body] = match;
    if (!id || body === undefined) continue;
    const typed = TYPED_MEMBER_PATTERN.exec(body);
    const explicitMembers = [...body.matchAll(EXPLICIT_MEMBER_PATTERN)]
      .map((member) => member[1])
      .filter((member): member is string => Boolean(member));
    contexts.set(id, {
      memberKey: typed
        ? `${typed[1]}|${decodeXml(typed[2] ?? "").trim()}`
        : null,
      axis: typed?.[1] ?? null,
      explicitMembers,
    });

    if (scripCode === null) {
      scripCode = IDENTIFIER_PATTERN.exec(body)?.[1] ?? null;
    }
    if (asOfDate === null && !typed && explicitMembers.length === 0) {
      asOfDate = INSTANT_PATTERN.exec(body)?.[1] ?? null;
    }
  }

  const rows = new Map<string, { axis: string; facts: Map<string, string> }>();
  let totalShares: number | null = null;

  for (const { name, contextRef, value } of readFacts(xml)) {
    const context = contexts.get(contextRef);
    if (!context) continue;

    if (
      name === "NumberOfShares" &&
      context.memberKey === null &&
      context.explicitMembers.includes("ShareholdingPatternMember")
    ) {
      totalShares = toNumber(value);
      continue;
    }

    if (context.memberKey === null || context.axis === null) continue;
    let row = rows.get(context.memberKey);
    if (!row) {
      row = { axis: context.axis, facts: new Map() };
      rows.set(context.memberKey, row);
    }
    if (!row.facts.has(name)) row.facts.set(name, value);
  }

  const holders: ShareholdingXbrlHolder[] = [];
  for (const { axis, facts } of rows.values()) {
    const name = cleanHolderName(facts.get("NameOfTheShareholder") ?? "");
    if (!name) continue;
    const shares = toNumber(facts.get("NumberOfShares")) ?? 0;
    const table = normalizeTableName(axis);
    const reportedFraction = toNumber(
      facts.get("ShareholdingAsAPercentageOfTotalNumberOfShares"),
    );
    const percent =
      totalShares !== null && totalShares > 0
        ? (shares / totalShares) * 100
        : reportedFraction !== null
          ? reportedFraction * 100
          : 0;
    // Named "WhetherACategoryOrMoreThan" in the 2025 taxonomy and
    // "WhetherACategoryOrMoreThan1PercentageOfShareHolding" before it.
    const whetherCategory =
      [...facts.entries()].find(([name]) =>
        name.startsWith("WhetherACategoryOrMoreThan"),
      )?.[1] ?? "";

    holders.push({
      table,
      name,
      shares,
      percent: roundTo(percent, 4),
      isPromoter:
        PROMOTER_TABLES.has(table) || facts.has("TypeOfPromoterShareholding"),
      subCategory:
        facts.get("CategoryOfOtherIndianShareholders") ??
        facts.get("CategoryOfOtherNonInstitutions") ??
        facts.get("CategoryOfOtherForeignShareholders") ??
        null,
      holderCount: toNumber(facts.get("NumberOfShareholders")),
      isCategoryRow: /^category$/i.test(whetherCategory.trim()),
    });
  }

  return { scripCode, asOfDate, totalShares, holders };
}

function cleanHolderName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s.,-]+|[\s.,-]+$/g, "")
    .trim();
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const XML_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (entity, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    }
    if (code.startsWith("#")) {
      return String.fromCodePoint(parseInt(code.slice(1), 10));
    }
    return XML_ENTITIES[code.toLowerCase()] ?? entity;
  });
}

/**
 * Category totals of a shareholding pattern, as % of total shares — the
 * Promoters / FIIs / DIIs / Government / Public / Others split screener-style
 * summaries show, plus the number of shareholders.
 */
export interface ShareholdingCategories {
  readonly asOfDate: string | null;
  readonly totalShares: number | null;
  readonly promoters: number | null;
  readonly fiis: number | null;
  readonly diis: number | null;
  readonly government: number | null;
  readonly public: number | null;
  readonly others: number | null;
  readonly shareholders: number | null;
}

/** Foreign institution rows of the pre-2022 taxonomy, which has no InstitutionsForeign total. */
const LEGACY_FOREIGN_INSTITUTION_MEMBERS = [
  "InstitutionsForeignPortfolioInvestorMember",
  "ForeignPortfolioInvestorMember",
  "ForeignVentureCapitalInvestorsMember",
  "ForeignInstitutionalInvestorsMember",
] as const;

/**
 * Reads the category rows of Table I (one explicit member per context, no
 * typed holder member). Percentages are the ones the filing reports, which
 * SEBI computes excluding depository-receipt shares — the figures NSE and
 * screener sites show. The 2020 taxonomy reports them as 57.62, the 2022 one
 * as 0.5762; both are normalised to percent. A category with no reported
 * percentage falls back to its share count over total shares. The 2020
 * taxonomy has one Institutions total, so DIIs there are Institutions less
 * the foreign institution rows.
 */
export function parseShareholdingCategories(xml: string): ShareholdingCategories {
  const memberOf = new Map<string, string>();
  let asOfDate: string | null = null;
  for (const match of xml.matchAll(CONTEXT_PATTERN)) {
    const [, id, body] = match;
    if (!id || body === undefined) continue;
    const typed = TYPED_MEMBER_PATTERN.exec(body);
    const explicitMembers = [...body.matchAll(EXPLICIT_MEMBER_PATTERN)]
      .map((member) => member[1])
      .filter((member): member is string => Boolean(member));
    if (!typed && explicitMembers.length === 1) {
      memberOf.set(id, explicitMembers[0]!);
    }
    if (asOfDate === null && !typed && explicitMembers.length === 0) {
      asOfDate = INSTANT_PATTERN.exec(body)?.[1] ?? null;
    }
  }

  const shares = new Map<string, number>();
  const reported = new Map<string, number>();
  const holders = new Map<string, number>();
  for (const { name, contextRef, value } of readFacts(xml)) {
    const member = memberOf.get(contextRef);
    if (!member) continue;
    const parsed = toNumber(value.replace(/,/g, ""));
    if (parsed === null) continue;
    const target =
      name === "NumberOfShares"
        ? shares
        : name === "ShareholdingAsAPercentageOfTotalNumberOfShares"
          ? reported
          : name === "NumberOfShareholders"
            ? holders
            : null;
    if (target && !target.has(member)) target.set(member, parsed);
  }

  const totalShares = shares.get("ShareholdingPatternMember") ?? null;
  const promoterReported = reported.get("ShareholdingOfPromoterAndPromoterGroupMember");
  const publicReported = reported.get("PublicShareholdingMember");
  const scale =
    reported.get("ShareholdingPatternMember") ??
    (promoterReported !== undefined &&
    publicReported !== undefined &&
    promoterReported + publicReported <= 1.5
      ? 1
      : 100);

  const percentOf = (member: string): number | null => {
    const value = reported.get(member);
    if (value !== undefined) return (value / scale) * 100;
    const count = shares.get(member);
    if (count === undefined || totalShares === null || totalShares <= 0) return null;
    return (count / totalShares) * 100;
  };
  const firstPercent = (...members: string[]): number | null => {
    for (const member of members) {
      const value = percentOf(member);
      if (value !== null) return value;
    }
    return null;
  };
  const round = (value: number | null): number | null =>
    value === null ? null : roundTo(value, 4);

  const promoters = firstPercent("ShareholdingOfPromoterAndPromoterGroupMember");
  let fiis = firstPercent("InstitutionsForeignMember");
  let diis = firstPercent("InstitutionsDomesticMember");
  if (fiis === null && diis === null) {
    const institutions = firstPercent("InstitutionsMember");
    const legacy = LEGACY_FOREIGN_INSTITUTION_MEMBERS.map(percentOf).filter(
      (value): value is number => value !== null,
    );
    const legacyForeign = legacy.reduce((sum, value) => sum + value, 0);
    fiis = institutions === null && legacy.length === 0 ? null : legacyForeign;
    diis = institutions === null ? null : Math.max(0, institutions - legacyForeign);
  }
  const government = firstPercent("GovernmentsMember", "GovermentsMember");
  const publicShare = firstPercent("NonInstitutionsMember");
  // Employee benefit trusts carry a reported percentage; depository-receipt
  // holdings do not and sit outside the 100% SEBI reports.
  const others = reported.has("SharesHeldByNonPromoterNonPublicShareholdersMember")
    ? percentOf("SharesHeldByNonPromoterNonPublicShareholdersMember")
    : null;

  return {
    asOfDate,
    totalShares,
    promoters: round(promoters),
    fiis: round(fiis),
    diis: round(diis),
    government: round(government ?? (promoters === null ? null : 0)),
    public: round(publicShare),
    others: round(others),
    shareholders: holders.get("ShareholdingPatternMember") ?? null,
  };
}

/** ShareholdingFiling column values for parsed category totals. */
export function toCategoryColumns(categories: ShareholdingCategories): {
  promotersPct: number | null;
  fiisPct: number | null;
  diisPct: number | null;
  governmentPct: number | null;
  publicPct: number | null;
  othersPct: number | null;
  shareholderCount: number | null;
  categoriesAt: Date;
} {
  return {
    promotersPct: categories.promoters,
    fiisPct: categories.fiis,
    diisPct: categories.diis,
    governmentPct: categories.government,
    publicPct: categories.public,
    othersPct: categories.others,
    shareholderCount:
      categories.shareholders !== null && Number.isSafeInteger(categories.shareholders)
        ? categories.shareholders
        : null,
    categoriesAt: new Date(),
  };
}

import type { ShareholdingXbrlHolder } from "./shareholding-xbrl";

export const SUPER_INVESTOR_CATEGORIES = [
  "promoter",
  "public",
  "corporate",
  "angel",
  "dii",
  "fii",
] as const;

export type SuperInvestorCategory = (typeof SUPER_INVESTOR_CATEGORIES)[number];

export const SUPER_INVESTOR_CATEGORY_LABELS: Readonly<
  Record<SuperInvestorCategory, string>
> = {
  promoter: "Promoter",
  public: "Individuals",
  corporate: "Corporates",
  angel: "AIFs & Angel Funds",
  dii: "DIIs",
  fii: "FIIs",
};

export const SUPER_INVESTOR_CATEGORY_DESCRIPTIONS: Readonly<
  Record<SuperInvestorCategory, string>
> = {
  promoter:
    "Promoter and promoter-group entities, across every company they promote",
  public: "Individual investors and HUFs holding more than 1% of a company",
  corporate:
    "Companies, investment firms and LLPs (outside the promoter group) holding more than 1%",
  angel:
    "SEBI-registered alternative investment funds, including angel and venture capital funds, holding more than 1%",
  dii: "Mutual funds, insurers, banks and pension funds holding more than 1%",
  fii: "Foreign portfolio investors, FDI and foreign institutions holding more than 1%",
};

/** Threshold the regulation uses for naming a public holder. */
const PUBLIC_DISCLOSURE_PERCENT = 0.995;

/**
 * Order matters: the foreign tables share words with the domestic ones
 * ("OtherInstitutionsForeign", "SovereignWealthFundsForeign").
 */
const PUBLIC_TABLE_RULES: readonly (readonly [
  RegExp,
  SuperInvestorCategory | null,
])[] = [
  [
    /CustodianOrDRHolder|InvestorEducationAndProtectionFund|RelativesOfPromoters|Directors|KeyManagerialPersonnel|AssociateCompanies|EmployeeBenefit|Government|ClearingMember/,
    null,
  ],
  [
    /Foreign(PortfolioInvestor|DirectInvestment|VentureCapital|InstitutionalInvestor)|InstitutionsForeign|SovereignWealthFundsForeign|OverseasDepositor|ForeignBank/,
    "fii",
  ],
  [/AlternativeInvestmentFund|VentureCapital/, "angel"],
  [
    /MutualFund|Insurance|Banks|ProvidentFund|PensionFund|NBFC|FinancialInstitution|SovereignWealthFundsDomestic|AssetReconstruction|InstitutionsDomestic/,
    "dii",
  ],
  [/BodiesCorporate/, "corporate"],
  // Before the Sep-2022 taxonomy the >Rs 2 lakh table had no "Resident" prefix.
  [
    /ResidentIndividual|IndividualShareholdersHolding|NonResidentIndian|ForeignNational/,
    "public",
  ],
];

/**
 * Category for a parsed holder row, or null when the row is not a named
 * investor (an aggregate line, an IEPF/custodian/escrow account, a promoter
 * relative, or a public row below the 1% disclosure threshold).
 */
export function classifyHolder(
  holder: ShareholdingXbrlHolder,
): SuperInvestorCategory | null {
  if (holder.shares <= 0) return null;
  if (holder.isCategoryRow) return null;
  if (holder.holderCount !== null && holder.holderCount > 1) return null;
  if (isGenericHolderName(holder.name)) return null;

  if (holder.isPromoter) return "promoter";
  if (holder.percent < PUBLIC_DISCLOSURE_PERCENT) return null;

  if (holder.table === "OtherNonInstitutions") {
    const subCategory = (holder.subCategory ?? "").toUpperCase();
    // Older filings list named NRIs / foreign nationals here instead of their own tables.
    if (
      /HUF|HINDU UNDIVIDED|NON-RESIDENT|NON RESIDENT|\bNRI\b|FOREIGN NATIONAL|INDIVIDUAL/.test(
        subCategory,
      )
    ) {
      return "public";
    }
    if (/BODIES CORPORATE|LLP|LIMITED LIABILITY/.test(subCategory)) {
      return "corporate";
    }
    return null;
  }

  for (const [pattern, category] of PUBLIC_TABLE_RULES) {
    if (pattern.test(holder.table)) return category;
  }
  return null;
}

const GENERIC_NAME_PATTERN =
  /^(FOREIGN INSTITUTION(AL)? INVESTORS?|FII|FPI|FDI|NRI|HUF|CLEARING MEMBERS?|TRUSTS?|DIRECTORS?|OTHERS?|BODIES CORPORATE|IEPF|NA|N A|NIL|-)$/;

function isGenericHolderName(name: string): boolean {
  const key = normalizeInvestorName(name);
  if (key.length < 2) return true;
  return (
    GENERIC_NAME_PATTERN.test(key) ||
    /^FDI\b|\(REPATRIABLE\)|UNCLAIMED|SUSPENSE|ESCROW/.test(name.toUpperCase())
  );
}

const TITLE_PREFIX = /^(MR|MRS|MS|MISS|SHRI|SHREE|SMT|KUM|KUMARI|DR|LATE)\s+/;
const CORPORATE_SUFFIX =
  /\s+(LIMITED|LTD|PRIVATE|PVT|COMPANY|CO|INC|LLC|PLC|THE|CORPORATION|CORP)$/;

/**
 * Key two filings of the same holder collapse onto: upper-case, punctuation
 * dropped, honorifics and trailing corporate suffixes removed. It deliberately
 * does not guess at people — "ASHISH KACHOLIA" and "ASHISH RAMESHCHANDRA
 * KACHOLIA" stay separate rather than risk merging two different people.
 */
export function normalizeInvestorName(name: string): string {
  let key = name
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let previous = "";
  while (previous !== key) {
    previous = key;
    key = key.replace(TITLE_PREFIX, "").replace(CORPORATE_SUFFIX, "").trim();
  }
  return key;
}

interface InvestorGroupRule {
  readonly name: string;
  readonly pattern: RegExp;
}

const MUTUAL_FUND_HOUSES: readonly InvestorGroupRule[] = [
  { name: "SBI Mutual Fund", pattern: /\bSBI\b/ },
  { name: "HDFC Mutual Fund", pattern: /\bHDFC\b/ },
  { name: "ICICI Prudential Mutual Fund", pattern: /\bICICI\b/ },
  {
    name: "Nippon India Mutual Fund",
    pattern: /\bNIPPON\b|RELIANCE CAPITAL TRUSTEE/,
  },
  { name: "Kotak Mutual Fund", pattern: /\bKOTAK\b/ },
  { name: "Axis Mutual Fund", pattern: /\bAXIS\b/ },
  {
    name: "Aditya Birla Sun Life Mutual Fund",
    pattern: /ADITYA BIRLA|\bABSL\b|BIRLA SUN LIFE/,
  },
  { name: "DSP Mutual Fund", pattern: /\bDSP\b/ },
  { name: "UTI Mutual Fund", pattern: /\bUTI\b/ },
  { name: "Mirae Asset Mutual Fund", pattern: /\bMIRAE\b/ },
  {
    name: "Franklin Templeton Mutual Fund",
    pattern: /\bFRANKLIN\b|\bTEMPLETON\b/,
  },
  { name: "Tata Mutual Fund", pattern: /\bTATA\b/ },
  { name: "Quant Mutual Fund", pattern: /\bQUANT\b/ },
  { name: "Motilal Oswal Mutual Fund", pattern: /\bMOTILAL\b/ },
  { name: "PPFAS Mutual Fund", pattern: /PARAG PARIKH|\bPPFAS\b/ },
  { name: "Invesco Mutual Fund", pattern: /\bINVESCO\b/ },
  { name: "Canara Robeco Mutual Fund", pattern: /CANARA ROBECO/ },
  { name: "Sundaram Mutual Fund", pattern: /\bSUNDARAM\b/ },
  { name: "Edelweiss Mutual Fund", pattern: /\bEDELWEISS\b/ },
  { name: "Bandhan Mutual Fund", pattern: /\bBANDHAN\b|\bIDFC\b/ },
  { name: "HSBC Mutual Fund", pattern: /\bHSBC\b|\bL AND T\b/ },
  { name: "Baroda BNP Paribas Mutual Fund", pattern: /\bBARODA\b|BNP PARIBAS/ },
  { name: "LIC Mutual Fund", pattern: /\bLIC\b/ },
  { name: "WhiteOak Capital Mutual Fund", pattern: /WHITE ?OAK/ },
  { name: "Bajaj Finserv Mutual Fund", pattern: /BAJAJ FINSERV/ },
  { name: "Union Mutual Fund", pattern: /\bUNION\b/ },
  { name: "Mahindra Manulife Mutual Fund", pattern: /MAHINDRA MANULIFE/ },
  { name: "360 ONE Mutual Fund", pattern: /\b360 ONE\b|IIFL MUTUAL/ },
  { name: "Helios Mutual Fund", pattern: /\bHELIOS\b/ },
  { name: "Old Bridge Mutual Fund", pattern: /OLD BRIDGE/ },
  { name: "ITI Mutual Fund", pattern: /\bITI\b/ },
  { name: "JM Financial Mutual Fund", pattern: /\bJM FINANCIAL\b/ },
  { name: "PGIM India Mutual Fund", pattern: /\bPGIM\b/ },
  { name: "Samco Mutual Fund", pattern: /\bSAMCO\b/ },
  { name: "Groww Mutual Fund", pattern: /\bGROWW\b/ },
  { name: "Navi Mutual Fund", pattern: /\bNAVI\b/ },
  { name: "Quantum Mutual Fund", pattern: /\bQUANTUM\b/ },
  { name: "Shriram Mutual Fund", pattern: /\bSHRIRAM\b/ },
  { name: "Trust Mutual Fund", pattern: /\bTRUST MF\b|\bTRUSTMF\b/ },
  { name: "NJ Mutual Fund", pattern: /\bNJ\b/ },
  { name: "Zerodha Mutual Fund", pattern: /\bZERODHA\b/ },
];

const NAMED_GROUPS: readonly InvestorGroupRule[] = [
  {
    name: "Life Insurance Corporation of India",
    pattern:
      /LIFE INSURANCE CORPORATION OF INDIA|^LICI\b|^LIC OF INDIA\b|^LIC\b(?! MUTUAL| MF)/,
  },
  {
    name: "Government of India",
    pattern:
      /PRESIDENT OF INDIA|^CENTRAL GOVERNMENT|^GOVERNMENT OF INDIA|DEPARTMENT OF INVESTMENT AND PUBLIC ASSET/,
  },
  { name: "Government of Singapore", pattern: /^GOVERNMENT OF SINGAPORE/ },
  {
    name: "Monetary Authority of Singapore",
    pattern: /^MONETARY AUTHORITY OF SINGAPORE/,
  },
  {
    name: "Norges Bank (Government Pension Fund Global)",
    pattern: /GOVERNMENT PENSION FUND GLOBAL|^NORGES BANK/,
  },
  {
    name: "Abu Dhabi Investment Authority",
    pattern: /ABU DHABI INVESTMENT AUTHORITY/,
  },
  {
    name: "Kuwait Investment Authority",
    pattern: /KUWAIT INVESTMENT AUTHORITY/,
  },
  { name: "Vanguard", pattern: /^VANGUARD\b/ },
  { name: "BlackRock (iShares)", pattern: /^ISHARES\b|^BLACKROCK\b/ },
  {
    name: "Capital Group",
    pattern:
      /^SMALLCAP WORLD FUND|^NEW WORLD FUND|^EUROPACIFIC GROWTH|^AMERICAN FUNDS\b|^CAPITAL GROUP\b/,
  },
  { name: "Goldman Sachs", pattern: /^GOLDMAN SACHS\b/ },
  { name: "Morgan Stanley", pattern: /^MORGAN STANLEY\b/ },
  { name: "Societe Generale", pattern: /^SOCIETE GENERALE\b/ },
  { name: "Nomura", pattern: /^NOMURA\b/ },
  { name: "Fidelity", pattern: /^FIDELITY\b/ },
  { name: "Citigroup Global Markets", pattern: /^CITIGROUP GLOBAL MARKETS\b/ },
  {
    name: "BNP Paribas Financial Markets",
    pattern: /^BNP PARIBAS (FINANCIAL MARKETS|ARBITRAGE)\b/,
  },
];

export interface InvestorIdentity {
  readonly key: string;
  readonly name: string;
}

/**
 * Collapses a filed holder name into the investor it belongs to. Mutual-fund
 * schemes roll up to their fund house (filings name schemes, not AMCs), a few
 * well-known institutions with many filed spellings roll up to one name, and
 * everyone else is keyed on their normalized name.
 */
export function resolveInvestorIdentity(
  holder: Pick<ShareholdingXbrlHolder, "name" | "table">,
): InvestorIdentity {
  const normalized = normalizeInvestorName(holder.name);

  // "MutualFundsOrUTI" since 2025, "MutualFundsOrUti" in older filings.
  if (holder.table.toLowerCase() === "mutualfundsoruti") {
    const house = MUTUAL_FUND_HOUSES.find((rule) =>
      rule.pattern.test(normalized),
    );
    if (house) return identityFor(house.name);
    const beforeMutualFund = /^(.+?)\s+MUTUAL FUND\b/.exec(normalized)?.[1];
    if (beforeMutualFund)
      return identityFor(`${toTitleCase(beforeMutualFund)} Mutual Fund`);
  }

  const group = NAMED_GROUPS.find((rule) => rule.pattern.test(normalized));
  if (group) return identityFor(group.name);

  return { key: normalized, name: toDisplayName(holder.name) };
}

/** Investor key for a bulk/block-deal client name, grouped the same way filed holder names are. */
export function resolveDealClientKey(clientName: string): string {
  const table = /MUTUAL FUND|\bMF\b/i.test(clientName)
    ? "MutualFundsOrUTI"
    : "";
  return resolveInvestorIdentity({ name: clientName, table }).key;
}

function identityFor(name: string): InvestorIdentity {
  return { key: normalizeInvestorName(name), name };
}

/** URL-safe id for an investor key (keys are already [A-Z0-9 ]). */
export function investorSlug(key: string): string {
  return key.toLowerCase().replace(/\s+/g, "-");
}

export function investorKeyFromSlug(slug: string): string {
  return slug.toUpperCase().replace(/-+/g, " ").trim();
}

const KEEP_UPPER = new Set([
  "LLP",
  "FII",
  "HUF",
  "AIF",
  "LIC",
  "SBI",
  "HDFC",
  "ICICI",
  "UTI",
  "DSP",
  "PPFAS",
  "FPI",
  "II",
  "III",
  "IV",
  "VI",
  "LP",
  "PCC",
  "RCC",
  "NPS",
  "PTE",
  "AG",
  "SA",
  "LTD",
  "PVT",
]);

function toDisplayName(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const isShouting = cleaned === cleaned.toUpperCase();
  return isShouting ? toTitleCase(cleaned) : cleaned;
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => {
      const bare = word.replace(/[^a-z]/g, "").toUpperCase();
      if (KEEP_UPPER.has(bare)) return word.toUpperCase();
      return word.replace(
        /^([^a-z]*)([a-z])/,
        (_, lead: string, first: string) => `${lead}${first.toUpperCase()}`,
      );
    })
    .join(" ");
}

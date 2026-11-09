import type { FundamentalsProviderId } from "./types";
import { resolveFundamentalsProviderId } from "./provider-id";

/**
 * Keep these coverage maps separate from the transport adapters so the
 * browser can explain why a column is disabled without importing credentials
 * or making a provider request.
 */
const EODHD_SUPPORTED_FILTERING_IDS = new Set<string>([
  "market-cap-range",
  "sector-filter",
  "industry",
  "sub-industry",
  "enterprise-value",
  "pe-ratio",
  "forward-pe",
  "peg-ratio",
  "pb-ratio",
  "ps-ratio",
  "ev-ebitda",
  "ev-sales",
  "earnings-yield",
  "book-value",
  "dividend-yield",
  "dividend-payout",
  "sales",
  "sales-growth",
  "quarterly-sales-growth",
  "profit",
  "eps",
  "ebitda",
  "gross-margin",
  "operating-margin",
  "net-profit-margin",
  "roe",
  "roa",
  "debt",
  "debt-equity",
  "current-ratio",
  "cash-flow-operations",
  "free-cash-flow",
  "institutional-holding",
  "insider-trading",
  "earnings-date",
  "results-announcement",
  "dividend-date",
  "ex-dividend-date",
  "split-date",
  "analyst-rating",
  "target-price-upside",
]);

const EODHD_UNSUPPORTED_REASONS: Readonly<Record<string, string>> = {
  "promoter-holding":
    "EODHD does not publish India-specific promoter shareholding data.",
  "promoter-pledge":
    "EODHD does not publish India-specific promoter pledge data.",
  "promoter-holding-change":
    "EODHD does not publish India-specific promoter shareholding data.",
  "fii-holding":
    "EODHD does not classify Indian holdings as FII, DII, or public.",
  "fii-holding-change":
    "EODHD does not classify Indian holdings as FII, DII, or public.",
  "dii-holding":
    "EODHD does not classify Indian holdings as FII, DII, or public.",
  "dii-holding-change":
    "EODHD does not classify Indian holdings as FII, DII, or public.",
  "public-holding":
    "EODHD does not classify Indian holdings as FII, DII, or public.",
  "bonus-date": "EODHD does not publish Indian bonus-issue dates.",
  "rights-issue-date": "EODHD does not publish Indian rights-issue dates.",
  "board-meeting-date": "EODHD does not publish Indian board-meeting dates.",
  "bulk-deal": "EODHD does not publish NSE/BSE bulk-deal activity.",
  "block-deal": "EODHD does not publish NSE/BSE block-deal activity.",
  "credit-rating-change":
    "EODHD does not publish Indian credit-rating changes.",
  "delivery-volume":
    "EODHD does not provide exchange delivery-volume data for this screener.",
  "delivery-percentage":
    "EODHD does not provide exchange delivery-volume data for this screener.",
  "profit-growth":
    "EODHD's documented growth metric is EPS growth, not net-profit growth, so this field stays disabled rather than being mislabeled.",
  "quarterly-profit-growth":
    "EODHD's documented growth metric is EPS growth, not quarterly net-profit growth, so this field stays disabled rather than being mislabeled.",
  "mutual-fund-holding":
    "EODHD returns individual fund holders, not a verified aggregate mutual-fund holding percentage.",
};

/**
 * Returns a user-facing reason when the current provider cannot supply an
 * option. Unknown fundamentals are also disabled intentionally: the app does
 * not label a column as data-backed until it has an explicit field mapping.
 */
export function getEodhdUnsupportedScreenerColumnReason(
  groupId: string,
  itemId: string,
): string | undefined {
  const explicitReason = EODHD_UNSUPPORTED_REASONS[itemId];
  if (explicitReason) return explicitReason;
  if (groupId !== "filterings") return undefined;
  if (EODHD_SUPPORTED_FILTERING_IDS.has(itemId)) return undefined;
  return "This screener field has no verified EODHD mapping yet, so it is disabled instead of returning a fabricated value.";
}

/**
 * Yahoo Finance covers the same categories as EODHD (it is the same class of
 * global fundamentals data, not an India-specific filing source), so it
 * shares the same gaps for India-specific ownership/corporate-action fields.
 * "sub-industry" is additionally unavailable: Yahoo's profile module has no
 * GICS sub-industry classification.
 */
const YAHOO_SUPPORTED_FILTERING_IDS = new Set<string>(
  [...EODHD_SUPPORTED_FILTERING_IDS].filter((id) => id !== "sub-industry"),
);

const YAHOO_UNSUPPORTED_REASONS: Readonly<Record<string, string>> = {
  ...EODHD_UNSUPPORTED_REASONS,
  "sub-industry":
    "Yahoo Finance's company profile does not publish a GICS sub-industry classification.",
  "promoter-holding":
    "Yahoo Finance does not publish India-specific promoter shareholding data.",
  "promoter-pledge":
    "Yahoo Finance does not publish India-specific promoter pledge data.",
  "promoter-holding-change":
    "Yahoo Finance does not publish India-specific promoter shareholding data.",
  "fii-holding":
    "Yahoo Finance does not classify Indian holdings as FII, DII, or public.",
  "fii-holding-change":
    "Yahoo Finance does not classify Indian holdings as FII, DII, or public.",
  "dii-holding":
    "Yahoo Finance does not classify Indian holdings as FII, DII, or public.",
  "dii-holding-change":
    "Yahoo Finance does not classify Indian holdings as FII, DII, or public.",
  "public-holding":
    "Yahoo Finance does not classify Indian holdings as FII, DII, or public.",
  "bonus-date": "Yahoo Finance does not publish Indian bonus-issue dates.",
  "rights-issue-date":
    "Yahoo Finance does not publish Indian rights-issue dates.",
  "board-meeting-date":
    "Yahoo Finance does not publish Indian board-meeting dates.",
  "bulk-deal": "Yahoo Finance does not publish NSE/BSE bulk-deal activity.",
  "block-deal": "Yahoo Finance does not publish NSE/BSE block-deal activity.",
  "credit-rating-change":
    "Yahoo Finance does not publish Indian credit-rating changes.",
  "delivery-volume":
    "Yahoo Finance does not provide exchange delivery-volume data for this screener.",
  "delivery-percentage":
    "Yahoo Finance does not provide exchange delivery-volume data for this screener.",
  "profit-growth":
    "The app's shared fundamentals schema tracks EPS growth, not net-profit growth, so this field stays disabled rather than being mislabeled.",
  "quarterly-profit-growth":
    "The app's shared fundamentals schema tracks EPS growth, not quarterly net-profit growth, so this field stays disabled rather than being mislabeled.",
  "mutual-fund-holding":
    "Yahoo Finance returns individual fund holders, not a verified aggregate mutual-fund holding percentage.",
};

function getYahooUnsupportedScreenerColumnReason(
  groupId: string,
  itemId: string,
): string | undefined {
  const explicitReason = YAHOO_UNSUPPORTED_REASONS[itemId];
  if (explicitReason) return explicitReason;
  if (groupId !== "filterings") return undefined;
  if (YAHOO_SUPPORTED_FILTERING_IDS.has(itemId)) return undefined;
  return "This screener field has no verified Yahoo Finance mapping yet, so it is disabled instead of returning a fabricated value.";
}

/**
 * Provider-aware version of the per-provider reason lookups above. Screens
 * should call this instead of the EODHD-specific function so the disabled
 * reason (and which fields are disabled at all) reflects whichever
 * fundamentals provider is actually configured.
 */
export function getFundamentalsUnsupportedScreenerColumnReason(
  groupId: string,
  itemId: string,
  providerId: FundamentalsProviderId = resolveFundamentalsProviderId(),
): string | undefined {
  return providerId === "eodhd"
    ? getEodhdUnsupportedScreenerColumnReason(groupId, itemId)
    : getYahooUnsupportedScreenerColumnReason(groupId, itemId);
}

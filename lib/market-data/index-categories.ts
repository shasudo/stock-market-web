// Which real indices populate the "Indices in F&O" / "Broad Market" /
// "Sectoral Indices" tabs. NSE/BSE don't tag this in the scrip master
// itself, so this is a curated name allow-list (same curation the old mock
// data encoded, now applied to real index quotes instead of fake ones).

const FNO_ELIGIBLE_DISPLAY_NAMES = [
  "nifty 50",
  "nifty next 50",
  "nifty bank",
  "nifty financial services 25/50",
  "nifty midcap select",
];

const BROAD_MARKET_DISPLAY_NAMES = [
  "nifty 100",
  "nifty 200",
  "nifty 500",
  "nifty midcap 100",
  "nifty smallcap 100",
  "india vix",
  "nifty midcap 150",
  "nifty smallcap 50",
  "nifty smallcap 250",
  "nifty midsmallcap 400",
  "sensex",
];

const SECTORAL_DISPLAY_NAMES = [
  "nifty auto",
  "nifty fmcg",
  "nifty it",
  "nifty media",
  "nifty metal",
  "nifty pharma",
  "nifty psu bank",
  "nifty private bank",
  "nifty realty",
  "bse bankex",
];

export type IndexCategory = "indicesFno" | "broadMarket" | "sectoralIndices";

/**
 * Whether an index appears on any of the market-data index tabs, and so gets
 * its stored history topped up in the background when the indices endpoint
 * notices it missing or stale. Bounds the top-up to the few dozen displayed
 * indices instead of the whole ~200-index master.
 */
export function isWatchedIndex(displayName: string): boolean {
  const normalized = normalize(displayName);
  return (
    FNO_ELIGIBLE_DISPLAY_NAMES.includes(normalized) ||
    BROAD_MARKET_DISPLAY_NAMES.includes(normalized) ||
    SECTORAL_DISPLAY_NAMES.includes(normalized)
  );
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function filterIndicesByCategory<T extends { displayName: string }>(
  indices: readonly T[],
  category: IndexCategory,
): T[] {
  const allowList =
    category === "indicesFno"
      ? FNO_ELIGIBLE_DISPLAY_NAMES
      : category === "broadMarket"
        ? BROAD_MARKET_DISPLAY_NAMES
        : SECTORAL_DISPLAY_NAMES;

  const allowed = new Set(allowList);
  return indices.filter((index) => allowed.has(normalize(index.displayName)));
}

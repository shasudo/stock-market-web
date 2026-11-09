/**
 * Shared symbol normalization for the stock-detail path.
 *
 * Screens, chart and summary routes each resolved symbols slightly
 * differently (exact match here, alias list there), so "NIFTY" loaded a
 * header via one route while the ratios routes found nothing. These pure
 * helpers keep every route on the same canonical spelling.
 */

/** Canonical index spellings as stored in InstrumentQuote display names. */
const INDEX_CANONICAL: Readonly<Record<string, string>> = {
  NIFTY: "NIFTY 50",
  "NIFTY 50": "NIFTY 50",
  NIFTY50: "NIFTY 50",
  BANKNIFTY: "NIFTY BANK",
  "NIFTY BANK": "NIFTY BANK",
  SENSEX: "BSE SENSEX",
  "BSE SENSEX": "BSE SENSEX",
};

/** IndexPeSnapshot keys per canonical index spelling. */
const INDEX_PE_KEYS: Readonly<Record<string, string>> = {
  "NIFTY 50": "NIFTY50",
};

/**
 * Trim, uppercase, drop an NSE:/BSE: prefix or .NS/.BO suffix and collapse
 * separators, so " nifty_50 ", "NSE:NIFTY" and "nifty 50" all match.
 */
export function normalizeLookupSymbol(input: string): string {
  let value = input.trim().toUpperCase();
  const colon = value.indexOf(":");
  if (colon > -1) {
    const prefix = value.slice(0, colon).trim();
    if (prefix === "NSE" || prefix === "BSE") {
      value = value.slice(colon + 1).trim();
    }
  }
  if (value.endsWith(".NS") || value.endsWith(".BO")) {
    value = value.slice(0, -3);
  }
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/** Canonical index spelling for a normalized symbol, if it names an index. */
export function canonicalIndexSymbol(normalized: string): string | null {
  return INDEX_CANONICAL[normalized] ?? null;
}

/**
 * Every spelling worth trying in the database for one user input:
 * the normalized form plus spaceless/underscore variants plus known index
 * aliases (NIFTY <-> NIFTY 50, SENSEX <-> BSE SENSEX, ...).
 */
export function lookupSymbolAliases(input: string): string[] {
  const normalized = normalizeLookupSymbol(input);
  if (normalized.length === 0) return [];
  const aliases = new Set<string>([normalized]);
  const spaceless = normalized.replace(/ /g, "");
  if (spaceless.length > 0) aliases.add(spaceless);
  const underscored = normalized.replace(/ /g, "_");
  if (underscored !== normalized) aliases.add(underscored);
  const canonical = canonicalIndexSymbol(normalized);
  if (canonical !== null) {
    aliases.add(canonical);
    const canonicalSpaceless = canonical.replace(/ /g, "");
    aliases.add(canonicalSpaceless);
    aliases.add(canonical.replace(/ /g, "_"));
  }
  for (const [alias, target] of Object.entries(INDEX_CANONICAL)) {
    if (target === (canonical ?? normalized)) aliases.add(alias);
  }
  return [...aliases];
}

/**
 * IndexPeSnapshot key for an index symbol (or its display name), or null
 * when this symbol has no computed index P/E.
 */
export function resolveIndexPeKey(
  normalizedSymbol: string,
  displayName?: string | null,
): string | null {
  const direct =
    INDEX_PE_KEYS[normalizedSymbol] ??
    (canonicalIndexSymbol(normalizedSymbol) !== null
      ? INDEX_PE_KEYS[canonicalIndexSymbol(normalizedSymbol) as string]
      : undefined);
  if (direct !== undefined) return direct;
  if (displayName) {
    const display = normalizeLookupSymbol(displayName);
    const viaDisplay =
      INDEX_PE_KEYS[display] ??
      (canonicalIndexSymbol(display) !== null
        ? INDEX_PE_KEYS[canonicalIndexSymbol(display) as string]
        : undefined);
    if (viaDisplay !== undefined) return viaDisplay;
  }
  return null;
}

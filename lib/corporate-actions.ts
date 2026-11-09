/**
 * Canonical buckets for NSE bhavcopy corporate-action purposes. The PURPOSE
 * field is free text ("INTDIV - RS 5 PER SH", "FV SPLT FRM RS 5 TO RE 1"),
 * so this keyword mapping is the single source of truth for every calendar
 * surface — the corporate-action page and the results-calendar corporate tab
 * must never diverge on what a row means.
 */
export type CorporateActionCategory =
  | "Dividends"
  | "Interest"
  | "Distributions"
  | "Buyback"
  | "Bonus"
  | "Split"
  | "Rights"
  | "Other";

export const CORPORATE_ACTION_CATEGORIES: readonly CorporateActionCategory[] =
  [
    "Dividends",
    "Interest",
    "Distributions",
    "Buyback",
    "Bonus",
    "Split",
    "Rights",
    "Other",
  ];

export function classifyCorporateAction(
  purpose: string,
): CorporateActionCategory {
  const text = purpose.toUpperCase();
  if (text.includes("BUY BACK") || text.includes("BUYBACK")) return "Buyback";
  if (text.includes("BONUS")) return "Bonus";
  if (
    text.includes("SPLIT") ||
    text.includes("SPLT") ||
    text.includes("FACE VALUE")
  )
    return "Split";
  if (text.includes("RIGHT")) return "Rights";
  // REIT/InvIT payouts ("DISTRIBUTION - RS 1.67", "DISTRIBUTN - RS 2 PU").
  if (text.includes("DISTRIBUT")) return "Distributions";
  // Debt servicing, not an equity dividend.
  if (text.includes("INTEREST")) return "Interest";
  if (text.includes("DIV")) return "Dividends";
  return "Other";
}

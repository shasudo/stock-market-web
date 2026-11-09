// Pure classification only — no DB/network imports, so this stays trivially
// unit-testable without DATABASE_URL or a live Dhan token (mirrors
// lib/dhan/fnoContractMaster.ts's pure-parsing convention).
//
// NSE's scrip master only tags F&O contracts generically as FUT/OP, unlike
// BSE's FUTSTK/FUTIDX/OPTSTK/OPTIDX split — so telling a stock derivative
// from an index derivative on NSE requires knowing which underlyings are
// indices. Best-effort as of implementation; update if NSE's index F&O
// product list changes.
const NSE_FNO_INDEX_UNDERLYINGS = new Set([
  "NIFTY",
  "BANKNIFTY",
  "FINNIFTY",
  "MIDCPNIFTY",
  "NIFTYNXT50",
  "NIFTYFPI",
]);

export function isNseFnoIndexUnderlying(underlyingSymbol: string): boolean {
  return NSE_FNO_INDEX_UNDERLYINGS.has(underlyingSymbol.toUpperCase());
}

export function nseFnoIndexUnderlyings(): string[] {
  return Array.from(NSE_FNO_INDEX_UNDERLYINGS);
}

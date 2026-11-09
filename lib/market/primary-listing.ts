const STALE_LISTING_MS = 24 * 60 * 60 * 1_000;

interface ListingRow {
  readonly exchange: string;
  readonly syncedAt: Date;
}

/**
 * A symbol can be listed on both exchanges, and Dhan can stop quoting a
 * listing it moved to another series. NSE is the primary, most liquid
 * listing, so it wins unless its quote is more than a day behind the newest
 * one; the stock page and the chart both use this so they quote one price.
 */
export function pickPrimaryListing<T extends ListingRow>(
  rows: readonly T[],
): T | undefined {
  let newest: T | undefined;
  let nse: T | undefined;
  for (const row of rows) {
    if (!newest || row.syncedAt > newest.syncedAt) newest = row;
    if (row.exchange === "NSE" && (!nse || row.syncedAt > nse.syncedAt)) {
      nse = row;
    }
  }
  if (!newest) return undefined;
  if (
    nse &&
    newest.syncedAt.getTime() - nse.syncedAt.getTime() < STALE_LISTING_MS
  ) {
    return nse;
  }
  return newest;
}

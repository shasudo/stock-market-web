/**
 * In-process counter the read service compares against its cached snapshot.
 * The cron route runs inside the same server process, so bumping this after
 * an ingest makes the next page request rebuild from the database instead of
 * waiting out the snapshot's TTL.
 */
let version = 0;

export function bumpSuperInvestorDataVersion(): void {
  version += 1;
}

export function getSuperInvestorDataVersion(): number {
  return version;
}

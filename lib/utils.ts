import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { isMarketOpen } from "@/lib/market-hours";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Matches the dashboard's own threshold: a sync older than this is presented
// as stale even though the last fetch itself succeeded.
const STALE_AFTER_MS = 5 * 60_000;

export interface SyncFreshness {
  /** Formatted sync time of the data, or null when it has never synced. */
  readonly label: string | null;
  readonly isStale: boolean;
}

/**
 * The timestamp shown beside a price must come from the data's own sync time,
 * never from the viewer's clock — a browser-side `new Date()` next to a
 * four-day-old quote certifies stale data as current. The date is always
 * included so days-old data cannot read as a time from today.
 */
export function describeSyncFreshness(
  lastSyncAt: string | Date | null | undefined,
  nowMs: number = Date.now(),
): SyncFreshness {
  const syncedAtMs =
    lastSyncAt === null || lastSyncAt === undefined
      ? Number.NaN
      : new Date(lastSyncAt).getTime();

  if (!Number.isFinite(syncedAtMs)) {
    return { label: null, isStale: true };
  }

  return {
    label:
      new Date(syncedAtMs).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }) + " IST",
    // Only while the session is running: quotes are supposed to sit still
    // overnight and at weekends, so warning then would leave the marker amber
    // for most of the week and train everyone to ignore the one case that
    // matters — a feed that has stopped during trading hours.
    isStale:
      nowMs - syncedAtMs > STALE_AFTER_MS && isMarketOpen(new Date(nowMs)),
  };
}

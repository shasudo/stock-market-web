import type { ReactElement } from "react";
import { cn, describeSyncFreshness } from "@/lib/utils";

interface DataFreshnessProps {
  readonly lastSyncAt: string | null;
  readonly prefix?: string;
  readonly className?: string;
}

/**
 * Prices on these screens come from the last completed sync, which can be days
 * old after a failed cron. Rendering that timestamp — and making an old one
 * look old — is the only thing stopping stale quotes from reading as live.
 */
export function DataFreshness({
  lastSyncAt,
  prefix = "As of",
  className,
}: DataFreshnessProps): ReactElement | null {
  const { label, isStale } = describeSyncFreshness(lastSyncAt);

  // Nothing has synced yet (or the fetch has not landed): the surface is empty
  // too, so there is no price here to date — a marker would only be noise.
  if (label === null) {
    return null;
  }

  // The warning colour is merged after className on purpose: a caller tuning
  // the resting colour for a dark surface must not be able to repaint the
  // stale state back into something that reads as normal.
  return (
    <span
      className={cn(
        "text-xs whitespace-nowrap text-muted-foreground",
        className,
        isStale && "text-amber-600",
      )}
      title={isStale ? `This data has not refreshed since ${label}` : undefined}
    >
      {isStale ? "⚠ " : ""}
      {`${prefix} ${label}`}
    </span>
  );
}

export default DataFreshness;

interface UnofficialSourceBadgeProps {
  readonly lastSyncAt?: string | null;
  readonly label?: string;
}

/**
 * Mounted on every page fed by lib/scrape/* — this data comes from NSE's
 * public static archive (nsearchives.nseindia.com), not an official
 * supported API. No ToS grant for programmatic use, and the file layout
 * can change without notice. Kept as a persistent disclosure, not a
 * one-time note, per the plan's honesty requirement for this data class.
 */
export default function UnofficialSourceBadge({
  lastSyncAt,
  label = "Unofficial NSE source — may be delayed or occasionally unavailable",
}: UnofficialSourceBadgeProps) {
  const syncedLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      })
    : null;

  return (
    <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-amber-800">
      <span aria-hidden="true">⚠</span>
      <span>
        {label}
        {syncedLabel ? ` · Last synced ${syncedLabel} IST` : ""}
      </span>
    </div>
  );
}

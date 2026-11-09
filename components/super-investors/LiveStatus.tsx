"use client";

import { formatTime } from "./format";

/** Pulse + timestamps: when LiveQuote last synced, and when this view last polled it. */
export function LiveStatus({
  refreshing,
  updatedAt,
  quotesSyncedAt,
}: {
  readonly refreshing: boolean;
  readonly updatedAt: number | null;
  readonly quotesSyncedAt: string | null;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full rounded-full bg-success opacity-75 ${refreshing ? "animate-ping" : ""}`}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <span>
        Prices as of{" "}
        <span className="font-mono num-font text-foreground">
          {formatTime(quotesSyncedAt)}
        </span>{" "}
        IST
      </span>
      <span className="hidden sm:inline">
        · checked{" "}
        <span className="font-mono num-font">{formatTime(updatedAt)}</span>
      </span>
    </div>
  );
}

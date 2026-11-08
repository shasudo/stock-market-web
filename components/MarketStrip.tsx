"use client";

import { apiGet } from "@/lib/api";
import { istClockLabel, sessionState } from "@/lib/market-time";
import { signedPct, signOf } from "@/lib/format";
import type { IndexListResponse } from "@/lib/types";
import { useIstClock, usePoll } from "@/hooks/usePoll";
import { cn } from "@/lib/cn";

const WATCH = ["NIFTY 50", "NIFTY BANK", "INDIA VIX"];

/** The always-visible top strip: key indices, breadth, IST clock, session. */
export function MarketStrip() {
  const { data, stale } = usePoll(() => apiGet<IndexListResponse>("/market-data/indices/nse"), 30_000);
  const now = useIstClock();
  const session = sessionState(now);

  const rows = (data?.indices ?? []).filter((r) => WATCH.includes(r.name) && r.last != null);

  return (
    <header className="flex h-12 items-center gap-4 overflow-x-auto border-b border-line bg-surface px-4">
      {rows.map((row) => {
        const sign = signOf(row.changePct);
        return (
          <div key={row.name} className="flex shrink-0 items-baseline gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {row.name.replace("NIFTY ", "")}
            </span>
            <span className="tnum tnum-strong text-[13px]">
              {row.last?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
            <span className={cn("tnum text-xs", sign > 0 ? "text-up" : sign < 0 ? "text-down" : "text-muted")}>
              {signedPct(row.changePct)}
            </span>
          </div>
        );
      })}
      {data != null && (
        <span className="tnum shrink-0 text-[11px] text-faint">
          ▲{data.marketAdvances ?? "—"} ▼{data.marketDeclines ?? "—"}
        </span>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {stale && (
          <span className="rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">STALE</span>
        )}
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
            session === "LIVE" && "bg-up-tint text-up",
            session === "PRE-OPEN" && "bg-warn-tint text-warn",
            session === "CLOSED" && "bg-down-tint text-down",
          )}
        >
          {session}
        </span>
        <span className="tnum text-xs text-muted">{istClockLabel(now)} IST</span>
      </div>
    </header>
  );
}

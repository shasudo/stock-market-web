"use client";

import { useState } from "react";
import Link from "next/link";
import { usePoll } from "@/hooks/usePoll";
import { apiGet } from "@/lib/api";
import { inr as fmtPrice, int as fmtNum, signedPct as fmtPctSigned } from "@/lib/format";
import type { ChartResponse } from "@/lib/types";
import { OVERLAYS, PriceChart, type OverlayId } from "@/components/chart/PriceChart";
import { DataStamp } from "@/components/numbers";
import { StaleBadge } from "@/components/market/shared";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "D", "W", "M"] as const;

function tfLabel(tf: string): string {
  switch (tf) {
    case "1m": return "1 min";
    case "5m": return "5 min";
    case "15m": return "15 min";
    case "30m": return "30 min";
    case "1H": return "1 hour";
    case "D": return "Daily";
    case "W": return "Weekly";
    case "M": return "Monthly";
    default: return tf;
  }
}

/** Keyed body: remounts per timeframe so the poller fetcher stays fresh. */
function ChartBody({ symbol, timeframe, overlays }: { symbol: string; timeframe: string; overlays: OverlayId[] }) {
  const { data, stale, failed } = usePoll(
    () => apiGet<ChartResponse>(
      `/market-data/chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`,
    ),
    30_000,
  );
  const quote = data?.quote ?? null;
  const up = (quote?.netChange ?? 0) >= 0;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-faint">Chart</p>
          <h1 className="font-mono text-2xl font-bold tracking-tight">
            {data?.displayName ?? data?.symbol ?? symbol}
          </h1>
          <p className="mt-0.5 text-xs text-faint">
            {data?.exchange ?? "—"} · {tfLabel(timeframe)}
            {data?.delayed === true ? " · delayed feed" : ""}
            {data?.marketOpen === true ? " · market open" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-bold tabular-nums">
            {quote ? fmtPrice(quote.lastPrice) : "—"}
          </p>
          <p className={`font-mono text-xs tabular-nums ${up ? "text-up" : "text-down"}`}>
            {quote ? `${quote.netChange >= 0 ? "+" : ""}${fmtNum(quote.netChange)} (${fmtPctSigned(quote.pctChange)})` : "—"}
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-line bg-surface p-3">
        {data == null && !failed ? (
          <div className="skeleton h-[420px] w-full rounded-lg" aria-label="Loading chart" />
        ) : failed || data == null || data.candles.length === 0 ? (
          <p className="py-16 text-center text-sm text-faint">
            {data?.message ?? "No candles for this timeframe."}
          </p>
        ) : (
          <PriceChart candles={data.candles} overlays={overlays} />
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-2">
            {stale ? <StaleBadge /> : null}
            <DataStamp label={data?.generatedAt} className="border-0 px-0 py-0" />
          </span>
          <p className="text-[11px] text-faint">Volume · {overlays.length} overlay{overlays.length === 1 ? "" : "s"}</p>
        </div>
      </section>

      {quote ? (
        <section className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Session">
          {[
            ["Open", fmtPrice(quote.open)],
            ["High", fmtPrice(quote.high)],
            ["Low", fmtPrice(quote.low)],
            ["Prev close", fmtPrice(quote.prevClose)],
            ["Volume", fmtNum(quote.volume)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-surface px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-faint">{label}</p>
              <p className="font-mono text-sm font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}

/** Full chart terminal for a symbol: timeframe rail + candles + quote. */
export function ChartView({ symbol, defaultOverlays }: { symbol: string; defaultOverlays?: OverlayId[] }) {
  const [timeframe, setTimeframe] = useState<string>("D");
  const [overlays, setOverlays] = useState<OverlayId[]>(defaultOverlays ?? ["sma20", "sma50"]);

  function toggle(id: OverlayId) {
    setOverlays((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Timeframe">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            role="tab"
            aria-selected={timeframe === tf}
            onClick={() => setTimeframe(tf)}
            className={`rounded-md border px-2.5 py-1 font-mono text-xs tabular-nums ${timeframe === tf ? "border-accent bg-accent-dim text-accent" : "border-line text-muted hover:text-fg"}`}
          >
            {tf}
          </button>
        ))}
        <Link
          href={`/stock/${encodeURIComponent(symbol)}`}
          className="ml-auto rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-fg"
        >
          Terminal →
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Overlays">
        {OVERLAYS.map((o) => {
          const on = overlays.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.id)}
              className={`rounded-full border px-2.5 py-1 font-mono text-xs tabular-nums ${on ? "border-accent bg-accent-dim text-accent" : "border-line text-faint"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <ChartBody key={timeframe} symbol={symbol} timeframe={timeframe} overlays={overlays} />
    </div>
  );
}

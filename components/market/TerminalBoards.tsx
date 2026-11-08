"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { apiGet } from "@/lib/api";
import type { HistResponse, LiveMarketResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { StockTable } from "../StockTable";
import { StaleBadge } from "./shared";
import { cn } from "@/lib/cn";

function pageShell(title: string, blurb: string, stale: boolean, children: React.ReactNode) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">{title}</h1>
        <p className="text-xs text-muted">{blurb}</p>
        {stale && <StaleBadge />}
      </div>
      {children}
    </div>
  );
}

function bandOf(priceBand: string | null): number | null {
  if (priceBand == null || priceBand === "No Band") return null;
  const n = parseFloat(priceBand);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Band hitters: stocks pressing their upper or lower circuit. */
export function BandHittersView() {
  const { data, stale, failed } = usePoll(
    () => apiGet<LiveMarketResponse>("/market/live?exchange=NSE&filter=all&page=1&pageSize=500"),
    30_000,
  );
  const rows = data?.stocks ?? [];
  const upper = rows.filter((s) => {
    const band = bandOf(s.priceBand);
    return band != null && (s.percentChange ?? 0) >= band * 0.9;
  });
  const lower = rows.filter((s) => {
    const band = bandOf(s.priceBand);
    return band != null && (s.percentChange ?? 0) <= -band * 0.9;
  });

  return pageShell(
    "Band hitters",
    "Within 10% of the circuit — breakouts and breakdowns live here.",
    stale,
    data == null && !failed ? (
      <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-6" aria-label="Loading">
        <div className="skeleton h-5 w-full" />
        <div className="skeleton h-5 w-2/3" />
      </div>
    ) : (
      <>
        <h2 className="tnum px-1 text-[11px] font-bold uppercase tracking-widest text-faint">
          Upper band · {upper.length}
        </h2>
        <StockTable
          rows={upper}
          loading={false}
          empty={<EmptyState title="Nothing pressing the upper circuit right now." />}
          stamp={null}
        />
        <h2 className="tnum px-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-faint">
          Lower band · {lower.length}
        </h2>
        <StockTable
          rows={lower}
          loading={false}
          empty={<EmptyState title="Nothing pressing the lower circuit right now." />}
          stamp={<DataStamp label={data?.lastSyncAt ?? null} />}
        />
      </>
    ),
  );
}

const PERIODS = ["10d", "1m", "3m", "6m", "1y", "3y", "5y"] as const;
type Period = (typeof PERIODS)[number];

/** Historical data: per-symbol OHLCV windows with search and paging. */
export function HistoricalView() {
  const router = useRouter();
  const params = useSearchParams();
  const symbol = params.get("symbol") ?? "";
  const rawPeriod = params.get("period") ?? "1m";
  const period: Period = (PERIODS as readonly string[]).includes(rawPeriod) ? (rawPeriod as Period) : "1m";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.replace(qs === "" ? "/market-data/historical-data" : `/market-data/historical-data?${qs}`, {
      scroll: false,
    });
  }

  const path =
    symbol.trim() === ""
      ? null
      : `/market-data/historical?exchange=NSE&fnoOnly=false&period=${period}&page=${page}&pageSize=50&sort=date&order=desc&symbols=${encodeURIComponent(symbol.trim().toUpperCase())}`;
  const { data, stale, failed } = usePoll(
    () => (path == null ? Promise.resolve(null) : apiGet<HistResponse>(path)),
    300_000,
  );

  return pageShell(
    "Historical data",
    "Per-symbol OHLCV windows for backtests and research.",
    stale,
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={symbol}
          onChange={(e) => set({ symbol: e.target.value.toUpperCase(), page: null })}
          placeholder="Symbol — RELIANCE"
          aria-label="Symbol"
          className="tnum h-9 w-44 rounded-md border border-line bg-surface px-3 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <div role="group" aria-label="Period" className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => set({ period: p, page: null })}
              aria-pressed={period === p}
              className={cn(
                "tnum min-h-[32px] rounded-full border px-3 text-xs font-medium",
                period === p ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-fg",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {symbol.trim() === "" ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState title="Type a symbol to pull its history." />
        </div>
      ) : (
        <section aria-label="History" className="overflow-hidden rounded-md border border-line bg-surface">
          <DataTable
            columns={[
              {
                key: "date",
                header: "Date",
                render: (r) => <span className="tnum text-muted">{r.date.slice(0, 10)}</span>,
              },
              {
                key: "close",
                header: "Close",
                align: "right",
                render: (r) => <span className="tnum tnum-strong">{r.close}</span>,
              },
              {
                key: "chg",
                header: "Chg",
                align: "right",
                render: (r) => <Num value={r.netChange} />,
              },
              {
                key: "pct",
                header: "%",
                align: "right",
                render: (r) => <ChangePill value={r.percentChange} />,
              },
              {
                key: "high",
                header: "High",
                align: "right",
                render: (r) => <span className="tnum text-muted">{r.high ?? "—"}</span>,
              },
              {
                key: "low",
                header: "Low",
                align: "right",
                render: (r) => <span className="tnum text-muted">{r.low ?? "—"}</span>,
              },
              {
                key: "vol",
                header: "Vol",
                align: "right",
                render: (r) => (
                  <span className="tnum text-muted">
                    {r.volume?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                  </span>
                ),
              },
            ]}
            rows={data?.rows ?? []}
            rowKey={(r) => `${r.date}-${r.securityId}`}
            loading={data == null && !failed}
            empty={<EmptyState title={`No ${period} history for ${symbol.trim().toUpperCase()} — backfill fills this grid.`} />}
          />
          <div className="flex items-center justify-between border-t border-line px-4 py-2">
            <div className="tnum text-xs text-muted">
              Page {data?.pagination.page ?? page} of {data?.pagination.totalPages ?? "—"} ·{" "}
              {data?.pagination.totalRows ?? 0} sessions
              {data?.window?.sessions != null && ` · ${data.window.sessions} sessions/stock`}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => set({ page: String(Math.max(1, page - 1)) })}
                className="min-h-[32px] rounded-md border border-line px-3 text-xs font-medium disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={data != null && page >= data.pagination.totalPages}
                onClick={() => set({ page: String(page + 1) })}
                className="min-h-[32px] rounded-md border border-line px-3 text-xs font-medium disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}
    </>,
  );
}

export function HistoricalRoute() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading…</div>}>
      <HistoricalView />
    </Suspense>
  );
}

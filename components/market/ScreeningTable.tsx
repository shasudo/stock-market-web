"use client";

import { useState } from "react";
import Link from "next/link";
import { usePoll } from "@/hooks/usePoll";
import { apiGet } from "@/lib/api";
import { inr as fmtPrice, int as fmtNum, signedPct as fmtPctSigned } from "@/lib/format";
import type { LiveMarketResponse } from "@/lib/types";
import { DataStamp } from "@/components/numbers";
import { StaleBadge } from "@/components/market/shared";

const EXCHANGES = ["NSE", "BSE"] as const;
const SORTS = [
  { id: "percentChange-desc", label: "% change ↓" },
  { id: "percentChange-asc", label: "% change ↑" },
  { id: "volume-desc", label: "Volume ↓" },
  { id: "cmp-desc", label: "Price ↓" },
  { id: "cmp-asc", label: "Price ↑" },
] as const;

function Results({ query }: { query: string }) {
  const { data, stale, failed } = usePoll(() => apiGet<LiveMarketResponse>(`/market/live?${query}`), 15_000);
  const rows = data?.stocks ?? [];
  const head = (
    <div className="flex items-center justify-between border-b border-line px-3 py-2">
      <p className="text-sm font-semibold tabular-nums">
        {data == null ? "Results" : `${data.pagination.totalStocks.toLocaleString("en-IN")} rows`}
      </p>
      <span className="flex items-center gap-2">
        {stale ? <StaleBadge /> : null}
        <DataStamp label={data?.lastSyncAt} className="border-0 px-0 py-0" />
      </span>
    </div>
  );

  if (data == null && !failed) {
    return (
      <>
        {head}
        <div className="space-y-2 px-3 py-3" aria-label="Loading rows">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-9 w-full rounded" />)}
        </div>
      </>
    );
  }
  if (failed || rows.length === 0) {
    return (
      <>
        {head}
        <p className="px-3 py-8 text-center text-sm text-faint">No rows match.</p>
      </>
    );
  }
  return (
    <>
      {head}
      <div className="overflow-x-auto">
      <table className="w-full min-w-160 text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
            <th className="px-3 py-2 font-medium">Symbol</th>
            <th className="px-3 py-2 text-right font-medium">Price</th>
            <th className="px-3 py-2 text-right font-medium">Change</th>
            <th className="px-3 py-2 text-right font-medium">Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const up = (r.percentChange ?? 0) >= 0;
            return (
              <tr key={`${r.exchange}-${r.tradingSymbol}`} className="border-b border-line last:border-0 hover:bg-raised">
                <td className="px-3 py-2">
                  <Link href={`/stock/${encodeURIComponent(r.tradingSymbol)}`} className="font-mono font-semibold hover:text-accent">
                    {r.tradingSymbol}
                  </Link>
                  <span className="block max-w-56 truncate text-xs text-faint">{r.companyName}</span>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtPrice(r.cmp)}</td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${up ? "text-up" : "text-down"}`}>
                  {fmtPctSigned(r.percentChange)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtNum(r.volume)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}

/** Full screening table: exchange + filter + sort + paging over /market/live. */
export function ScreeningTable({ initialFilter = "" }: { initialFilter?: string }) {
  const [exchange, setExchange] = useState<string>("NSE");
  const [filter, setFilter] = useState<string>(initialFilter);
  const [sort, setSort] = useState<string>("percentChange-desc");
  const [page, setPage] = useState(1);

  const [sortKey, sortDir] = sort.split("-");
  const params = new URLSearchParams({ exchange, page: String(page), pageSize: "50" });
  if (filter.trim() !== "") params.set("filter", filter.trim());
  if (sortKey) {
    params.set("sort", sortKey);
    params.set("order", sortDir === "asc" ? "asc" : "desc");
  }
  const query = params.toString();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="space-y-1">
          <span className="block text-[11px] uppercase tracking-wider text-faint">Exchange</span>
          <select
            value={exchange}
            onChange={(e) => { setExchange(e.target.value); setPage(1); }}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          >
            {EXCHANGES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] uppercase tracking-wider text-faint">Filter</span>
          <input
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
            placeholder="e.g. gainers, volume-shockers"
            className="w-52 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] uppercase tracking-wider text-faint">Sort</span>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          >
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-surface" aria-label="Screening results">
        <Results key={query} query={query} />
        <div className="flex items-center justify-between border-t border-line px-3 py-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-line px-3 py-1 text-xs disabled:opacity-40"
          >
            ← Prev
          </button>
          <p className="font-mono text-xs tabular-nums text-faint">Page {page}</p>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-line px-3 py-1 text-xs"
          >
            Next →
          </button>
        </div>
      </section>
    </div>
  );
}

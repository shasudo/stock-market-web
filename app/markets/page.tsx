"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { inr, int } from "@/lib/format";
import type { LiveMarketResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "@/components/numbers";
import { DataTable, EmptyState } from "@/components/DataTable";
import { cn } from "@/lib/cn";

type Exchange = "NSE" | "BSE";

/** Markets: the one screener table of the terminal. Search, exchange, paging. */
export default function MarketsPage() {
  const [exchange, setExchange] = useState<Exchange>("NSE");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const { data, stale, failed } = usePoll(
    () => apiGet<LiveMarketResponse>(`/market/live?exchange=${exchange}&page=${page}&pageSize=50`),
    15_000,
  );

  const q = query.trim().toLowerCase();
  const stocks = (data?.stocks ?? []).filter(
    (s) =>
      q === "" ||
      s.companyName.toLowerCase().includes(q) ||
      s.tradingSymbol.toLowerCase().includes(q),
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="market-search">
          Search stocks
        </label>
        <input
          id="market-search"
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — / focuses here"
          className="h-9 w-64 rounded-md border border-line bg-surface px-3 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <div role="group" aria-label="Exchange" className="flex rounded-md border border-line p-0.5">
          {(["NSE", "BSE"] as Exchange[]).map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setExchange(ex);
                setPage(1);
              }}
              aria-pressed={exchange === ex}
              className={cn(
                "min-h-[32px] rounded-sm px-3 text-[13px] font-medium",
                exchange === ex ? "bg-accent/10 text-accent" : "text-muted hover:text-fg",
              )}
            >
              {ex}
            </button>
          ))}
        </div>
        {stale && (
          <span className="rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">
            STALE — showing last good data
          </span>
        )}
        {data?.stats != null && (
          <span className="tnum ml-auto text-xs text-muted">
            ▲{data.stats.totalGainers} ▼{data.stats.totalLosers} — {data.stats.totalUnchanged} flat
          </span>
        )}
      </div>

      <section aria-label="Stocks" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          stickyFirst
          columns={[
            {
              key: "company",
              header: "Company",
              render: (s) => (
                <Link href={`/stock/${s.tradingSymbol}`} className="font-medium hover:text-accent">
                  {s.companyName}
                  <span className="tnum ml-2 text-[11px] font-normal text-faint">{s.tradingSymbol}</span>
                </Link>
              ),
            },
            {
              key: "ltp",
              header: "LTP",
              align: "right",
              render: (s) => <span className="tnum tnum-strong">{s.cmp == null ? "—" : inr(s.cmp)}</span>,
            },
            {
              key: "chg",
              header: "Chg",
              align: "right",
              render: (s) => <Num value={s.netChange} />,
            },
            {
              key: "pct",
              header: "%",
              align: "right",
              render: (s) => <ChangePill value={s.percentChange} />,
            },
            {
              key: "vol",
              header: "Vol",
              align: "right",
              render: (s) => <span className="tnum text-muted">{int(s.volume)}</span>,
            },
            {
              key: "w52h",
              header: "52W H",
              align: "right",
              render: (s) => <span className="tnum text-muted">{s.week52High == null ? "—" : int(s.week52High)}</span>,
            },
            {
              key: "w52l",
              header: "52W L",
              align: "right",
              render: (s) => <span className="tnum text-muted">{s.week52Low == null ? "—" : int(s.week52Low)}</span>,
            },
            {
              key: "cap",
              header: "Mkt cap",
              align: "right",
              render: (s) => <span className="tnum text-muted">{s.marketCap ?? "—"}</span>,
            },
          ]}
          rows={stocks}
          rowKey={(s) => s.tradingSymbol}
          loading={data == null && !failed}
          empty={
            <EmptyState
              title="No stocks match — clear search or wait for the next sync."
              action={
                q !== "" ? (
                  <button type="button" onClick={() => setQuery("")} className="text-sm font-medium text-accent">
                    Clear search
                  </button>
                ) : undefined
              }
            />
          }
        />
        <div className="flex items-center justify-between border-t border-line px-4 py-2">
          <div className="tnum text-xs text-muted">
            Page {data?.pagination.page ?? page} of {data?.pagination.totalPages ?? "—"} ·{" "}
            {data?.pagination.totalStocks ?? 0} stocks
          </div>
          <DataStamp label={data?.lastSyncAt} className="border-0 px-0 py-0" />
        </div>
        <div className="flex gap-2 border-t border-line px-4 py-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="min-h-[36px] rounded-md border border-line px-3 text-sm font-medium disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={data != null && page >= data.pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="min-h-[36px] rounded-md border border-line px-3 text-sm font-medium disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}

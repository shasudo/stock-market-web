"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api";
import type { LiveMarketResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { DataStamp } from "../numbers";
import { EmptyState } from "../DataTable";
import { StockTable } from "../StockTable";
import { ExchangeToggle, StaleBadge, type Exchange } from "./shared";

/** The screener: searchable, paged live table. Exchange and page are owned by the caller (URL). */
export function MarketStocksView({
  exchange,
  page,
  onExchange,
  onPage,
}: {
  exchange: Exchange;
  page: number;
  onExchange: (e: Exchange) => void;
  onPage: (p: number) => void;
}) {
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
    (s) => q === "" || s.companyName.toLowerCase().includes(q) || s.tradingSymbol.toLowerCase().includes(q),
  );

  return (
    <>
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
        <ExchangeToggle value={exchange} onChange={onExchange} />
        {stale && <StaleBadge />}
        {data?.stats != null && (
          <span className="tnum ml-auto text-xs text-muted">
            ▲{data.stats.totalGainers} ▼{data.stats.totalLosers} — {data.stats.totalUnchanged} flat
          </span>
        )}
      </div>

      <StockTable
        rows={stocks}
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
        stamp={
          <div className="flex items-center justify-between border-t border-line px-4 py-2">
            <div className="tnum text-xs text-muted">
              Page {data?.pagination.page ?? page} of {data?.pagination.totalPages ?? "—"} ·{" "}
              {data?.pagination.totalStocks ?? 0} stocks
            </div>
            <DataStamp label={data?.lastSyncAt} className="border-0 px-0 py-0" />
          </div>
        }
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          className="min-h-[36px] rounded-md border border-line bg-surface px-3 text-sm font-medium disabled:opacity-40"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={data != null && page >= data.pagination.totalPages}
          onClick={() => onPage(page + 1)}
          className="min-h-[36px] rounded-md border border-line bg-surface px-3 text-sm font-medium disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </>
  );
}

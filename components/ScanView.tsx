"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { LiveMarketResponse, StockQuote } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { DataStamp } from "./numbers";
import { EmptyState } from "./DataTable";
import { StockTable } from "./StockTable";
import { cn } from "@/lib/cn";

export type ScanKind =
  | "gainers"
  | "losers"
  | "52-week-high"
  | "52-week-low"
  | "all-time-high"
  | "all-time-low"
  | "only-buyers"
  | "only-sellers"
  | "price-shockers"
  | "volume-shockers"
  | "most-active-by-value";

interface ScanDef {
  title: string;
  blurb: string;
  /** Server-side query tail (after exchange). Null = client-filtered from `all`. */
  query: string | null;
  filter?: (rows: StockQuote[]) => StockQuote[];
}

const CLIENT_PAGES = 5;
const CLIENT_SIZE = 100;

function bandOf(s: StockQuote): number | null {
  if (s.priceBand == null || s.priceBand === "No Band") return null;
  const n = parseFloat(s.priceBand);
  return Number.isFinite(n) ? n : null;
}

const SCANS: Record<ScanKind, ScanDef> = {
  gainers: {
    title: "Gainers",
    blurb: "Top advances by % change, NSE and BSE.",
    query: "filter=gainers&sort=pctChange&order=desc",
  },
  losers: {
    title: "Losers",
    blurb: "Top declines by % change, NSE and BSE.",
    query: "filter=losers&sort=pctChange&order=asc",
  },
  "52-week-high": {
    title: "52-week highs",
    blurb: "Stocks trading at their one-year peak.",
    query: "filter=all&hit=high&ath=all&sort=pctChange&order=desc",
  },
  "52-week-low": {
    title: "52-week lows",
    blurb: "Stocks trading at their one-year trough.",
    query: "filter=all&hit=low&ath=all&sort=pctChange&order=desc",
  },
  "all-time-high": {
    title: "All-time highs",
    blurb: "Stocks at lifetime peaks — trend leaders and breakouts.",
    query: "filter=all&hit=all&ath=high&sort=pctChange&order=desc",
  },
  "all-time-low": {
    title: "All-time lows",
    blurb: "Stocks at lifetime troughs — distress or deep value.",
    query: "filter=all&hit=all&ath=low&sort=pctChange&order=desc",
  },
  "only-buyers": {
    title: "Only buyers",
    blurb: "Locked at the upper circuit — demand with no supply.",
    query: null,
    filter: (rows) =>
      rows.filter((s) => {
        const band = bandOf(s);
        return band != null && (s.percentChange ?? 0) >= band;
      }),
  },
  "only-sellers": {
    title: "Only sellers",
    blurb: "Locked at the lower circuit — supply with no demand.",
    query: null,
    filter: (rows) =>
      rows.filter((s) => {
        const band = bandOf(s);
        return band != null && Math.abs(s.percentChange ?? 0) >= band;
      }),
  },
  "price-shockers": {
    title: "Price shockers",
    blurb: "Moves of 5% or more in either direction, ranked by shock.",
    query: null,
    filter: (rows) =>
      rows
        .filter((s) => Math.abs(s.percentChange ?? 0) >= 5)
        .sort((a, b) => Math.abs(b.percentChange ?? 0) - Math.abs(a.percentChange ?? 0)),
  },
  "volume-shockers": {
    title: "Volume shockers",
    blurb: "Top 100 by traded volume — where attention is going.",
    query: null,
    filter: (rows) =>
      rows
        .filter((s) => (s.volume ?? 0) > 0)
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
        .slice(0, 100),
  },
  "most-active-by-value": {
    title: "Most active by value",
    blurb: "Top 100 by rupee turnover — where the money moved.",
    query: null,
    filter: (rows) =>
      rows
        .filter((s) => (s.volume ?? 0) > 0)
        .sort((a, b) => (b.cmp ?? 0) * (b.volume ?? 0) - (a.cmp ?? 0) * (a.volume ?? 0))
        .slice(0, 100),
  },
};

async function fetchClientScan(exchange: string): Promise<{ stocks: StockQuote[]; lastSyncAt: string | null }> {
  const pages = await Promise.all(
    Array.from({ length: CLIENT_PAGES }, (_, i) =>
      apiGet<LiveMarketResponse>(
        `/market/live?exchange=${exchange}&filter=all&page=${i + 1}&pageSize=${CLIENT_SIZE}`,
      ),
    ),
  );
  return {
    stocks: pages.flatMap((p) => p.stocks),
    lastSyncAt: pages[0]?.lastSyncAt ?? null,
  };
}

/** One scan page: server-filtered when the backend owns it, client-filtered otherwise. */
export function ScanView({ scan }: { scan: ScanKind }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const def = SCANS[scan];
  const rawEx = params.get("exchange") ?? "NSE";
  const exchange = rawEx === "BSE" ? "BSE" : "NSE";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.replace(qs === "" ? pathname : `${pathname}?${qs}`, { scroll: false });
  }

  const serverPath =
    def.query == null
      ? null
      : `/market/live?exchange=${exchange}&${def.query}&page=${page}&pageSize=50`;
  const server = usePoll(() => (serverPath == null ? Promise.resolve(null) : apiGet<LiveMarketResponse>(serverPath)), 15_000);
  const client = usePoll(
    () => (def.query == null ? fetchClientScan(exchange) : Promise.resolve(null)),
    30_000,
  );

  const stale = server.stale || client.stale;
  const failed = def.query == null ? client.failed : server.failed;
  const loaded = def.query == null ? client.data != null : server.data != null;

  const rows =
    def.query == null
      ? (def.filter?.(client.data?.stocks ?? []) ?? [])
      : (server.data?.stocks ?? []);
  const pagination = server.data?.pagination;
  const stamp = (server.data ?? client.data)?.lastSyncAt ?? null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">{def.title}</h1>
        <p className="text-xs text-muted">{def.blurb}</p>
        <div role="group" aria-label="Exchange" className="ml-auto flex rounded-md border border-line p-0.5">
          {(["NSE", "BSE"] as const).map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => set({ exchange: ex, page: null })}
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
          <span className="rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">STALE</span>
        )}
      </div>

      <StockTable
        rows={rows}
        loading={!loaded && !failed}
        empty={<EmptyState title={`${def.title} are empty right now — they fill on the next sync.`} />}
        stamp={
          <div className="flex items-center justify-between border-t border-line px-4 py-2">
            <div className="tnum text-xs text-muted">
              {pagination != null
                ? `Page ${pagination.page} of ${pagination.totalPages} · ${pagination.totalStocks} stocks`
                : `${rows.length} stocks`}
            </div>
            <DataStamp label={stamp} className="border-0 px-0 py-0" />
          </div>
        }
      />

      {pagination != null && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => set({ page: String(Math.max(1, page - 1)) })}
            className="min-h-[36px] rounded-md border border-line bg-surface px-3 text-sm font-medium disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => set({ page: String(page + 1) })}
            className="min-h-[36px] rounded-md border border-line bg-surface px-3 text-sm font-medium disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { use } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { inr, istDate } from "@/lib/format";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "@/components/numbers";
import { EmptyState } from "@/components/DataTable";

interface StockDetail {
  symbol: string;
  displayName: string;
  sector: string | null;
  industry: string | null;
  lastPrice: number;
  prevClose: number;
  open: number | null;
  high: number | null;
  low: number | null;
  netChange: number;
  pctChange: number;
  week52High: number | null;
  week52Low: number | null;
  syncedAt: string | null;
}

/** Stock detail header: price block + day range + 52W range, one stamp line. */
export default function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const upper = symbol.toUpperCase();
  const { data, failed } = usePoll(
    () => apiGet<{ stock: StockDetail }>(`/stocks/${encodeURIComponent(upper)}`),
    15_000,
  );
  const stock = data?.stock ?? null;

  if (stock == null) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <div className="rounded-md border border-line bg-surface">
          <EmptyState
            title={!failed ? "Loading…" : `No quote for ${upper} — it fills on the next sync.`}
            action={
              <Link href="/markets" className="text-sm font-medium text-accent">
                Back to Markets
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const facts: Array<[string, string]> = [
    ["Open", stock.open == null ? "—" : inr(stock.open)],
    ["High", stock.high == null ? "—" : inr(stock.high)],
    ["Low", stock.low == null ? "—" : inr(stock.low)],
    ["Prev close", inr(stock.prevClose)],
    ["52W high", stock.week52High == null ? "—" : inr(stock.week52High)],
    ["52W low", stock.week52Low == null ? "—" : inr(stock.week52Low)],
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <section aria-label="Price header" className="rounded-md border border-line bg-surface">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4 pb-2">
          <h1 className="text-xl font-extrabold tracking-tight">{stock.displayName}</h1>
          <span className="tnum text-xs text-muted">{stock.symbol}</span>
          {stock.sector != null && <span className="text-xs text-muted">{stock.sector}</span>}
          <span className="tnum tnum-strong ml-auto text-2xl">{inr(stock.lastPrice)}</span>
          <Num value={stock.netChange} strong />
          <ChangePill value={stock.pctChange} />
        </div>
        <dl className="grid grid-cols-2 gap-px p-4 pt-2 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="py-1">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
              <dd className="tnum text-sm">{value}</dd>
            </div>
          ))}
        </dl>
        <DataStamp label={stock.syncedAt != null ? `live ${istDate(stock.syncedAt)}` : null} />
      </section>
    </div>
  );
}

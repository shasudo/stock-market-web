"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import type { FundRow, FundTableResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { DataStamp, Num } from "@/components/numbers";
import { DataTable, EmptyState } from "@/components/DataTable";
import { StaleBadge } from "@/components/market/shared";

function inrShort(v: number | null): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e7) return `${(v / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`;
  if (a >= 1e5) return `${(v / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 1 })} L`;
  return v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/** Market performance: the fundamental table — valuation and quality per listing. */
function MarketTerminalInner() {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";

  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.replace(qs === "" ? "/market" : `/market?${qs}`, { scroll: false });
  }

  const { data, stale, failed } = usePoll(() => apiGet<FundTableResponse>("/market/fundamentals-table"), 300_000);

  const q = query.trim().toLowerCase();
  const rows = (data?.rows ?? [])
    .filter((r) => q === "" || r.symbol.toLowerCase().includes(q))
    .slice(0, 200);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">Market performance</h1>
        <p className="text-xs text-muted">Valuation and quality per listing — search to narrow.</p>
        {stale && <StaleBadge />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search symbol — / focuses"
          aria-label="Search fundamentals"
          className="h-9 w-64 rounded-md border border-line bg-surface px-3 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        {data != null && (
          <span className="tnum text-xs text-muted">
            {data.rows.length.toLocaleString("en-IN")} listings{q === "" ? " · showing 200" : ""}
          </span>
        )}
      </div>
      <section aria-label="Fundamentals" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          stickyFirst
          columns={[
            {
              key: "symbol",
              header: "Symbol",
              render: (r: FundRow) => (
                <Link href={`/stock/${r.symbol}`} className="font-medium hover:text-accent">
                  {r.symbol}
                </Link>
              ),
            },
            {
              key: "pe",
              header: "PE",
              align: "right",
              render: (r: FundRow) => (
                <span className="tnum">{r.pe == null ? "—" : r.pe.toFixed(1)}</span>
              ),
            },
            {
              key: "eps",
              header: "EPS",
              align: "right",
              render: (r: FundRow) => (
                <span className="tnum text-muted">{r.eps == null ? "—" : r.eps.toFixed(1)}</span>
              ),
            },
            {
              key: "bv",
              header: "BV",
              align: "right",
              render: (r: FundRow) => (
                <span className="tnum text-muted">{r.bookValue == null ? "—" : r.bookValue.toFixed(1)}</span>
              ),
            },
            {
              key: "roe",
              header: "ROE",
              align: "right",
              render: (r: FundRow) => <Num value={r.roe} />,
            },
            {
              key: "pm",
              header: "Margin",
              align: "right",
              render: (r: FundRow) => <Num value={r.profitMargin} />,
            },
            {
              key: "yield",
              header: "Div %",
              align: "right",
              render: (r: FundRow) => (
                <span className="tnum text-muted">{r.dividendYield == null ? "—" : r.dividendYield.toFixed(2)}</span>
              ),
            },
            {
              key: "beta",
              header: "Beta",
              align: "right",
              render: (r: FundRow) => (
                <span className="tnum text-muted">{r.beta == null ? "—" : r.beta.toFixed(2)}</span>
              ),
            },
            {
              key: "rev",
              header: "Rev TTM",
              align: "right",
              render: (r: FundRow) => <span className="tnum text-muted">{inrShort(r.revenueTtm)}</span>,
            },
            {
              key: "exch",
              header: "Ex",
              render: (r: FundRow) => <span className="tnum text-xs text-faint">{r.exchange ?? "—"}</span>,
            },
          ]}
          rows={rows}
          rowKey={(r) => `${r.exchange ?? ""}-${r.symbol}`}
          loading={data == null && !failed}
          empty={<EmptyState title="No fundamentals yet — the table fills on the next sync." />}
        />
        <DataStamp label={data?.lastSyncAt ?? null} />
      </section>
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading…</div>}>
      <MarketTerminalInner />
    </Suspense>
  );
}

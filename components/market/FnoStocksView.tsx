"use client";

import Link from "next/link";
import { apiGet } from "@/lib/api";
import type { FnoUnderlyingsResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { DataStamp } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { StaleBadge } from "./shared";

/** F&O stocks: every underlying with live expiries, jumping to its chain. */
export function FnoStocksView() {
  const { data, stale, failed } = usePoll(
    () => apiGet<FnoUnderlyingsResponse>("/market-data/fno/underlyings"),
    300_000,
  );
  const rows = [...(data?.underlyings ?? [])].sort((a, b) => a.symbol.localeCompare(b.symbol));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">F&O stocks</h1>
        <p className="text-xs text-muted">Derivatives-eligible underlyings and their expiries.</p>
        {stale && <StaleBadge />}
      </div>
      <section aria-label="F&O underlyings" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          stickyFirst
          columns={[
            {
              key: "symbol",
              header: "Underlying",
              render: (r) => (
                <Link href={`/fno?symbol=${r.symbol}`} className="font-medium hover:text-accent">
                  {r.symbol}
                </Link>
              ),
            },
            {
              key: "segment",
              header: "Segment",
              render: (r) => <span className="text-xs text-muted">{r.exchangeSegment ?? "—"}</span>,
            },
            {
              key: "expiries",
              header: "Expiries",
              align: "right",
              render: (r) => <span className="tnum text-muted">{r.expiries.length}</span>,
            },
            {
              key: "near",
              header: "Near expiry",
              align: "right",
              render: (r) => <span className="tnum text-muted">{r.expiries[0] ?? "—"}</span>,
            },
          ]}
          rows={rows}
          rowKey={(r) => r.symbol}
          loading={data == null && !failed}
          empty={<EmptyState title="No F&O underlyings yet — contracts load on the next sync." />}
        />
        <DataStamp label={null} />
      </section>
    </div>
  );
}

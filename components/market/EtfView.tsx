"use client";

import Link from "next/link";
import { apiGet } from "@/lib/api";
import type { EtfResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";

/** ETFs: exchange-traded funds with the same quote board as stocks. */
export function EtfView() {
  const { data, stale, failed } = usePoll(() => apiGet<EtfResponse>("/market-data/etfs"), 30_000);
  const rows = data?.etfs ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">ETFs</h1>
        <p className="text-xs text-muted">Index, gold and smart-beta funds.</p>
        {stale && (
          <span className="ml-auto rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">
            STALE
          </span>
        )}
      </div>
      <section aria-label="ETFs" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          stickyFirst
          columns={[
            {
              key: "name",
              header: "Fund",
              render: (e) => (
                <span>
                  <span className="font-medium">{e.displayName}</span>
                  <Link
                    href={`/stock/${e.tradingSymbol}`}
                    className="tnum ml-2 text-[11px] font-normal text-faint hover:text-accent"
                  >
                    {e.tradingSymbol}
                  </Link>
                </span>
              ),
            },
            {
              key: "last",
              header: "Last",
              align: "right",
              render: (e) => <span className="tnum tnum-strong">{e.lastPrice}</span>,
            },
            {
              key: "chg",
              header: "Chg",
              align: "right",
              render: (e) => <Num value={e.netChange} />,
            },
            {
              key: "pct",
              header: "%",
              align: "right",
              render: (e) => <ChangePill value={e.pctChange} />,
            },
            {
              key: "high52",
              header: "52W H",
              align: "right",
              render: (e) => (
                <span className="tnum text-muted">
                  {e.fiftyTwoWeekHigh?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                </span>
              ),
            },
            {
              key: "low52",
              header: "52W L",
              align: "right",
              render: (e) => (
                <span className="tnum text-muted">
                  {e.fiftyTwoWeekLow?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                </span>
              ),
            },
          ]}
          rows={rows}
          rowKey={(e) => `${e.exchange}-${e.tradingSymbol}`}
          loading={data == null && !failed}
          empty={<EmptyState title="No ETF quotes yet — they fill on the next sync." />}
        />
        <DataStamp label={data?.lastSyncAt ?? null} />
      </section>
    </div>
  );
}

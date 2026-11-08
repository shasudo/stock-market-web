"use client";

import { apiGet } from "@/lib/api";
import type { FiiDiiResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { DataStamp, Num } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { cn } from "@/lib/cn";

function cr(v: number | null): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  const s = a >= 1e7 ? `${(v / 1e7).toFixed(2)} Cr` : v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return s;
}

/** FII/DII cash flows: daily tape plus monthly totals. */
export function FlowsView() {
  const { data, stale, failed } = usePoll(() => apiGet<FiiDiiResponse>("/market-data/fii-dii"), 300_000);

  const daily = [...(data?.daily ?? [])].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate)).slice(0, 30);
  const monthly = [...(data?.monthly ?? [])].sort((a, b) => b.year - a.year || b.month - a.month).slice(0, 12);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">FII / DII flows</h1>
        <p className="text-xs text-muted">Cash-market buying and selling, ₹ crore.</p>
        {stale && (
          <span className="ml-auto rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">
            STALE
          </span>
        )}
      </div>

      <section aria-label="Daily flows" className="overflow-hidden rounded-md border border-line bg-surface">
        <h2 className="px-4 pt-3 text-sm font-semibold">Daily</h2>
        <DataTable
          columns={[
            {
              key: "date",
              header: "Date",
              render: (d) => <span className="tnum text-muted">{d.tradeDate}</span>,
            },
            {
              key: "fii",
              header: "FII net",
              align: "right",
              render: (d) => <Num value={d.fiiNet} strong />,
            },
            {
              key: "dii",
              header: "DII net",
              align: "right",
              render: (d) => <Num value={d.diiNet} strong />,
            },
            {
              key: "fiib",
              header: "FII buy",
              align: "right",
              render: (d) => <span className="tnum text-muted">{cr(d.fiiBuy)}</span>,
            },
            {
              key: "fiis",
              header: "FII sell",
              align: "right",
              render: (d) => <span className="tnum text-muted">{cr(d.fiiSell)}</span>,
            },
            {
              key: "diib",
              header: "DII buy",
              align: "right",
              render: (d) => <span className="tnum text-muted">{cr(d.diiBuy)}</span>,
            },
            {
              key: "diis",
              header: "DII sell",
              align: "right",
              render: (d) => <span className="tnum text-muted">{cr(d.diiSell)}</span>,
            },
          ]}
          rows={daily}
          rowKey={(d) => `${d.tradeDate}-${d.source ?? ""}`}
          loading={data == null && !failed}
          empty={<EmptyState title="No flow data yet — postings land after market hours." />}
        />
        <DataStamp label={data?.lastSyncAt ?? null} />
      </section>

      <section aria-label="Monthly flows" className="overflow-hidden rounded-md border border-line bg-surface">
        <h2 className="px-4 pt-3 text-sm font-semibold">Monthly</h2>
        <DataTable
          columns={[
            {
              key: "month",
              header: "Month",
              render: (m) => (
                <span className={cn("tnum text-muted")}>
                  {m.year}-{String(m.month).padStart(2, "0")}
                </span>
              ),
            },
            {
              key: "fii",
              header: "FII net",
              align: "right",
              render: (m) => <Num value={m.fiiNet} strong />,
            },
            {
              key: "dii",
              header: "DII net",
              align: "right",
              render: (m) => <Num value={m.diiNet} strong />,
            },
            {
              key: "days",
              header: "Sessions",
              align: "right",
              render: (m) => <span className="tnum text-muted">{m.tradingDays ?? "—"}</span>,
            },
          ]}
          rows={monthly}
          rowKey={(m) => `${m.year}-${m.month}`}
          loading={data == null && !failed}
          empty={<EmptyState title="No monthly totals yet." />}
        />
      </section>
    </div>
  );
}

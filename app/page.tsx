"use client";

import Link from "next/link";
import { apiGet } from "@/lib/api";
import { istDate } from "@/lib/format";
import type { IndexListResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "@/components/numbers";
import { DataTable, EmptyState } from "@/components/DataTable";
import { MoodPanel } from "@/components/market/MoodPanel";

interface FiiDii {
  fiiNet: number | null;
  diiNet: number | null;
  date: string | null;
}

/** Today: what kind of day is it, in ten seconds. Indices + mood + flows. */
export default function TodayPage() {
  const indices = usePoll(() => apiGet<IndexListResponse>("/market-data/indices/nse"), 30_000);

  const rows = (indices.data?.indices ?? []).filter((r) => r.last != null).slice(0, 12);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <MoodPanel compact />

      <section aria-label="Key indices" className="overflow-hidden rounded-md border border-line bg-surface">
        <h2 className="px-4 pt-3 text-sm font-semibold">Key indices</h2>
        <DataTable
          columns={[
            {
              key: "name",
              header: "Index",
              render: (r) => (
                <Link href={`/markets?view=indices`} className="font-medium hover:text-accent">
                  {r.name}
                </Link>
              ),
            },
            {
              key: "last",
              header: "Last",
              align: "right",
              render: (r) => (
                <span className="tnum tnum-strong">
                  {r.last?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </span>
              ),
            },
            {
              key: "change",
              header: "Chg",
              align: "right",
              render: (r) => <Num value={r.change} />,
            },
            {
              key: "pct",
              header: "%",
              align: "right",
              render: (r) => <ChangePill value={r.changePct} />,
            },
            {
              key: "high52",
              header: "52W H",
              align: "right",
              render: (r) => (
                <span className="tnum text-muted">
                  {r.yearHigh?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                </span>
              ),
            },
            {
              key: "low52",
              header: "52W L",
              align: "right",
              render: (r) => (
                <span className="tnum text-muted">
                  {r.yearLow?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                </span>
              ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.name}
          loading={indices.data == null && !indices.failed}
          empty={
            <EmptyState
              title="No index data yet — history and quotes fill in after the next sync."
              action={
                <Link href="/markets" className="text-sm font-medium text-accent">
                  Open Markets
                </Link>
              }
            />
          }
        />
        <DataStamp
          label={
            indices.data?.generatedAt != null
              ? `generated ${istDate(indices.data.generatedAt)}`
              : (indices.data?.asOf ?? null)
          }
        />
      </section>

      <MarketFlows />
    </div>
  );
}

function MarketFlows() {
  const flows = usePoll(() => apiGet<FiiDii>("/market-data/fii-dii"), 300_000);
  const d = flows.data;
  return (
    <section aria-label="FII DII flows" className="rounded-md border border-line bg-surface">
      <h2 className="px-4 pt-3 text-sm font-semibold">FII / DII cash</h2>
      <div className="grid grid-cols-2 gap-px px-4 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">FII net (₹ cr)</p>
          <p className="tnum tnum-strong text-xl">
            {d?.fiiNet == null ? "—" : d.fiiNet.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">DII net (₹ cr)</p>
          <p className="tnum tnum-strong text-xl">
            {d?.diiNet == null ? "—" : d.diiNet.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>
      <DataStamp label={d?.date != null ? istDate(d.date) : null} />
    </section>
  );
}

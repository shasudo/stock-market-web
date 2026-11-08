"use client";

import Link from "next/link";
import { apiGet } from "@/lib/api";
import { istDate } from "@/lib/format";
import type { IndexListResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "@/components/numbers";
import { DataTable, EmptyState } from "@/components/DataTable";

interface MoodResponse {
  score: number | null;
  zone: string | null;
  asOf: string | null;
  generatedAt: string | null;
}

interface FiiDii {
  fiiNet: number | null;
  diiNet: number | null;
  date: string | null;
}

/** Today: what kind of day is it, in ten seconds. Indices + mood + flows. */
export default function TodayPage() {
  const indices = usePoll(() => apiGet<IndexListResponse>("/market-data/indices/nse"), 30_000);
  const mood = usePoll(() => apiGet<MoodResponse>("/market-data/mood-index"), 60_000);

  const rows = (indices.data?.indices ?? []).filter((r) => r.last != null).slice(0, 12);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <section aria-label="Market mood" className="rounded-md border border-line bg-surface">
        <div className="flex items-baseline justify-between px-4 pt-3">
          <h2 className="text-sm font-semibold">Market mood</h2>
          {mood.data?.zone != null && (
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold capitalize text-accent">
              {mood.data.zone.replace(/([a-z])([A-Z])/g, "$1 $2")}
            </span>
          )}
        </div>
        <div className="px-4 py-3">
          {mood.data?.score != null ? (
            <p className="tnum tnum-strong text-3xl">{mood.data.score.toFixed(0)}</p>
          ) : (
            <p className="tnum text-3xl text-faint">—</p>
          )}
          <p className="mt-1 text-xs text-muted">Breadth-driven 0–100 gauge. Rebuilt as history lands.</p>
        </div>
        <DataStamp label={mood.data?.generatedAt ?? mood.data?.asOf} />
      </section>

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

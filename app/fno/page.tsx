"use client";

import { apiGet } from "@/lib/api";
import { inr } from "@/lib/format";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "@/components/numbers";
import { DataTable, EmptyState } from "@/components/DataTable";

interface SnapshotFuture {
  securityId: number;
  symbol: string;
  name: string | null;
  isIndex: boolean;
  sector: string | null;
  expiry: string;
  lotSize: number;
  ltp: number | null;
  change: number | null;
  changePct: number | null;
  oi: number | null;
  oiChangePct: number | null;
  volume: number | null;
  spot: number | null;
  basis: number | null;
  buildup: string | null;
}

interface SnapshotResponse {
  futures: SnapshotFuture[];
  session: { date: string; live: boolean; referenceDate: string } | null;
  generatedAt: string | null;
  degraded: string[];
}

/** F&O: near-month futures board with OI buildup. Null legs render as —. */
export default function FnoPage() {
  const { data, stale, failed } = usePoll(() => apiGet<SnapshotResponse>("/market-data/fno/snapshot"), 30_000);
  const rows = (data?.futures ?? []).filter((f) => f.ltp != null);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-base font-semibold">F&O snapshot</h1>
        {data?.session != null && (
          <span className="tnum text-xs text-muted">
            {data.session.date}
            {data.session.live ? " · live" : ` · ref ${data.session.referenceDate}`}
          </span>
        )}
        {stale && (
          <span className="rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">STALE</span>
        )}
        {data != null && data.degraded.length > 0 && (
          <span className="text-xs text-muted">degraded: {data.degraded.join(", ")}</span>
        )}
      </div>

      <section aria-label="Futures" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          stickyFirst
          columns={[
            {
              key: "symbol",
              header: "Contract",
              render: (f) => (
                <span>
                  <span className="font-medium">{f.symbol}</span>
                  <span className="tnum ml-2 text-[11px] font-normal text-faint">{f.expiry}</span>
                </span>
              ),
            },
            {
              key: "ltp",
              header: "LTP",
              align: "right",
              render: (f) => <span className="tnum tnum-strong">{f.ltp == null ? "—" : inr(f.ltp)}</span>,
            },
            {
              key: "chg",
              header: "Chg",
              align: "right",
              render: (f) => <Num value={f.change} />,
            },
            {
              key: "pct",
              header: "%",
              align: "right",
              render: (f) => <ChangePill value={f.changePct} />,
            },
            {
              key: "oi",
              header: "OI",
              align: "right",
              render: (f) => (
                <span className="tnum text-muted">
                  {f.oi == null ? "—" : f.oi.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              ),
            },
            {
              key: "oichg",
              header: "OI %",
              align: "right",
              render: (f) => <Num value={f.oiChangePct} />,
            },
            {
              key: "spot",
              header: "Spot",
              align: "right",
              render: (f) => <span className="tnum text-muted">{f.spot == null ? "—" : inr(f.spot)}</span>,
            },
            {
              key: "buildup",
              header: "Buildup",
              render: (f) =>
                f.buildup == null ? (
                  <span className="text-muted">—</span>
                ) : (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    {f.buildup}
                  </span>
                ),
            },
          ]}
          rows={rows}
          rowKey={(f) => `${f.symbol}-${f.expiry}`}
          loading={data == null && !failed}
          empty={<EmptyState title="No futures quoted — the board fills on the next sync." />}
        />
        <DataStamp label={data?.generatedAt} />
      </section>
    </div>
  );
}

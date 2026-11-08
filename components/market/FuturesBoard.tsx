"use client";

import { apiGet } from "@/lib/api";
import { inr } from "@/lib/format";
import type { SnapshotFuture, SnapshotResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { StaleBadge } from "./shared";

/** Futures snapshot board: near-month contracts with OI buildup. */
export function FuturesBoard({ title = "F&O snapshot" }: { title?: string }) {
  const { data, stale, failed } = usePoll(() => apiGet<SnapshotResponse>("/market-data/fno/snapshot"), 30_000);
  const rows = (data?.futures ?? []).filter((f) => f.ltp != null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-base font-semibold">{title}</h1>
        {data?.session != null && (
          <span className="tnum text-xs text-muted">
            {data.session.date}
            {data.session.live ? " · live" : ` · ref ${data.session.referenceDate}`}
          </span>
        )}
        {stale && <StaleBadge />}
        {data != null && data.degraded.length > 0 && (
          <span className="text-xs text-muted">degraded: {data.degraded.join(", ")}</span>
        )}
      </div>

      <section aria-label="Futures" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          stickyFirst
          columns={futuresColumns()}
          rows={rows}
          rowKey={(f) => `${f.symbol}-${f.expiry}`}
          loading={data == null && !failed}
          empty={<EmptyState title="No futures quoted — the board fills on the next sync." />}
        />
        <DataStamp label={data?.generatedAt ?? null} />
      </section>
    </>
  );
}

export function futuresColumns() {
  return [
    {
      key: "symbol",
      header: "Contract",
      render: (f: SnapshotFuture) => (
        <span>
          <span className="font-medium">{f.symbol}</span>
          <span className="tnum ml-2 text-[11px] font-normal text-faint">{f.expiry}</span>
        </span>
      ),
    },
    {
      key: "ltp",
      header: "LTP",
      align: "right" as const,
      render: (f: SnapshotFuture) => (
        <span className="tnum tnum-strong">{f.ltp == null ? "—" : inr(f.ltp)}</span>
      ),
    },
    {
      key: "chg",
      header: "Chg",
      align: "right" as const,
      render: (f: SnapshotFuture) => <Num value={f.change} />,
    },
    {
      key: "pct",
      header: "%",
      align: "right" as const,
      render: (f: SnapshotFuture) => <ChangePill value={f.changePct} />,
    },
    {
      key: "oi",
      header: "OI",
      align: "right" as const,
      render: (f: SnapshotFuture) => (
        <span className="tnum text-muted">
          {f.oi == null ? "—" : f.oi.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
      ),
    },
    {
      key: "oichg",
      header: "OI %",
      align: "right" as const,
      render: (f: SnapshotFuture) => <Num value={f.oiChangePct} />,
    },
    {
      key: "spot",
      header: "Spot",
      align: "right" as const,
      render: (f: SnapshotFuture) => (
        <span className="tnum text-muted">{f.spot == null ? "—" : inr(f.spot)}</span>
      ),
    },
    {
      key: "buildup",
      header: "Buildup",
      render: (f: SnapshotFuture) =>
        f.buildup == null ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">{f.buildup}</span>
        ),
    },
  ];
}

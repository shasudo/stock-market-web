"use client";

import Link from "next/link";
import type { PeersResponse, RatiosResponse, UserView } from "@/lib/types";
import { ChangePill, DataStamp, Num } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { useTerminalData } from "./useStockTerminal";

function Gate({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-line bg-surface">
      <EmptyState
        title={`Sign in to see ${label}.`}
        action={
          <Link href="/login" className="text-sm font-medium text-accent">
            Sign in
          </Link>
        }
      />
    </div>
  );
}

/** Peers: same-sector comparison with quarterly trend. */
export function PeersTerminal({ user, checked, symbol }: { user: UserView | null; checked: boolean; symbol: string }) {
  const { data, failed, loading, gated } = useTerminalData<PeersResponse>(
    user, checked, `/stocks/${encodeURIComponent(symbol)}/peers`, 300_000,
  );
  if (gated) return <Gate label="peer comparison" />;
  const rows = (data?.peers ?? []).filter((p) => p.cmp != null);

  return (
    <section aria-label="Peers" className="overflow-hidden rounded-md border border-line bg-surface">
      {data?.sector != null && (
        <p className="px-4 pt-3 text-xs text-muted">
          {data.sector}
          {data.industry != null && ` · ${data.industry}`}
        </p>
      )}
      <DataTable
        stickyFirst
        columns={[
          {
            key: "name",
            header: "Peer",
            render: (p) => (
              <Link
                href={`/stock/${p.symbol}`}
                className={p.isSelf ? "font-bold text-accent" : "font-medium hover:text-accent"}
              >
                {p.name ?? p.symbol}
                {!p.isSelf && (
                  <span className="tnum ml-2 text-[11px] font-normal text-faint">{p.symbol}</span>
                )}
              </Link>
            ),
          },
          {
            key: "cmp",
            header: "Price",
            align: "right",
            render: (p) => <span className="tnum tnum-strong">{p.cmp?.toLocaleString("en-IN") ?? "—"}</span>,
          },
          {
            key: "pe",
            header: "PE",
            align: "right",
            render: (p) => <span className="tnum text-muted">{p.pe?.toFixed(1) ?? "—"}</span>,
          },
          {
            key: "roce",
            header: "ROCE",
            align: "right",
            render: (p) => <Num value={p.roce} />,
          },
          {
            key: "yield",
            header: "Div %",
            align: "right",
            render: (p) => <span className="tnum text-muted">{p.divYield?.toFixed(2) ?? "—"}</span>,
          },
          {
            key: "qsales",
            header: "Qtr sales",
            align: "right",
            render: (p) => (
              <span className="tnum text-muted">
                {p.qtrSales == null ? "—" : `${(p.qtrSales / 1e7).toFixed(0)} Cr`}
              </span>
            ),
          },
          {
            key: "qprofit",
            header: "Qtr profit",
            align: "right",
            render: (p) => (
              <span className="tnum text-muted">
                {p.qtrProfit == null ? "—" : `${(p.qtrProfit / 1e7).toFixed(0)} Cr`}
              </span>
            ),
          },
        ]}
        rows={rows}
        rowKey={(p) => p.symbol}
        loading={loading}
        empty={
          <EmptyState
            title={failed ? "Peers are unreachable right now." : "No peer data for this symbol."}
          />
        }
      />
    </section>
  );
}

/** Ratios: key points narrative plus the full metric grid. */
export function RatiosTerminal({
  user,
  checked,
  symbol,
}: {
  user: UserView | null;
  checked: boolean;
  symbol: string;
}) {
  const { data, failed, loading, gated } = useTerminalData<RatiosResponse>(
    user, checked, `/stocks/${encodeURIComponent(symbol)}/quick-ratios`, 300_000,
  );
  if (gated) return <Gate label="key ratios" />;

  const entries = Object.entries(data?.values ?? {}).sort(([a], [b]) => a.localeCompare(b));

  function fmt(key: string, v: number | null): string {
    if (v == null) return "—";
    if (/sales|profit|capitalization|debt$|market/i.test(key) && Math.abs(v) >= 1e7)
      return `${(v / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
    return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

  return (
    <div className="flex flex-col gap-3">
      {(data?.keyPoints ?? []).length > 0 && (
        <section aria-label="Key points" className="rounded-md border border-line bg-surface px-4 py-3">
          <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] text-muted">
            {(data?.keyPoints ?? []).map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
          <DataStamp label={data?.fetchedAt ?? null} className="border-0 px-0 pb-0" />
        </section>
      )}
      <section aria-label="Ratios" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          columns={[
            {
              key: "metric",
              header: "Metric",
              render: ([k]) => <span className="font-medium capitalize">{k.replace(/-/g, " ")}</span>,
            },
            {
              key: "value",
              header: "Value",
              align: "right",
              render: ([k, v]) => <span className="tnum">{fmt(k, v)}</span>,
            },
          ]}
          rows={entries}
          rowKey={([k]) => k}
          loading={loading}
          empty={
            <EmptyState title={failed ? "Ratios are unreachable right now." : "No ratios for this symbol."} />
          }
        />
      </section>
    </div>
  );
}

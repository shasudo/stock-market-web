"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { inr } from "@/lib/format";
import type { ChainResponse, ChainRow } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "@/components/numbers";
import { DataTable, EmptyState } from "@/components/DataTable";
import { cn } from "@/lib/cn";

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

const UNDERLYINGS = ["NIFTY", "BANKNIFTY"];

/** F&O: near-month futures board plus a per-expiry option chain. */
export default function FnoPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading F&O…</div>}>
      <FnoInner />
    </Suspense>
  );
}

function FnoInner() {
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

      <ChainView />
    </div>
  );
}

function ChainView() {
  const router = useRouter();
  const params = useSearchParams();
  const rawSymbol = params.get("symbol") ?? "NIFTY";
  const symbol = UNDERLYINGS.includes(rawSymbol) ? rawSymbol : "NIFTY";
  const expiry = params.get("expiry") ?? "";
  const full = params.get("full") === "1";

  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.replace(qs === "" ? "/fno" : `/fno?${qs}`, { scroll: false });
  }

  const path =
    expiry === ""
      ? `/market-data/fno/snapshot/chain?symbol=${symbol}`
      : `/market-data/fno/snapshot/chain?symbol=${symbol}&expiry=${encodeURIComponent(expiry)}`;
  const { data, stale, failed } = usePoll(() => apiGet<ChainResponse>(path), 30_000);

  const rows = data?.rows ?? [];
  const atmIdx = data?.atmStrike == null ? -1 : rows.findIndex((r) => r.strike === data.atmStrike);
  const windowed =
    !full && atmIdx >= 0 ? rows.slice(Math.max(0, atmIdx - 10), Math.min(rows.length, atmIdx + 11)) : rows;

  const stats: Array<[string, string]> = [
    ["Underlying", data?.underlyingValue == null ? "—" : inr(data.underlyingValue)],
    ["PCR (OI)", data?.pcr?.toFixed(2) ?? "—"],
    ["PCR (Vol)", data?.volumePcr?.toFixed(2) ?? "—"],
    ["Max pain", data?.maxPain == null ? "—" : inr(data.maxPain)],
    ["Lot", data?.lotSize?.toString() ?? "—"],
  ];

  return (
    <section aria-label="Option chain" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">Option chain</h2>
        <div role="group" aria-label="Underlying" className="flex rounded-md border border-line bg-surface p-0.5">
          {UNDERLYINGS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => set({ symbol: u, expiry: null })}
              aria-pressed={symbol === u}
              className={cn(
                "min-h-[32px] rounded-sm px-3 text-[13px] font-medium",
                symbol === u ? "bg-accent/10 text-accent" : "text-muted hover:text-fg",
              )}
            >
              {u}
            </button>
          ))}
        </div>
        {data != null && data.expiries.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted">
            Expiry
            <select
              value={data.expiry}
              onChange={(e) => set({ expiry: e.target.value })}
              className="tnum h-8 rounded-md border border-line bg-surface px-2 text-[13px] text-fg outline-none focus:border-accent"
            >
              {data.expiries.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
        )}
        {stale && (
          <span className="rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">STALE</span>
        )}
        <span className="tnum ml-auto hidden text-xs text-muted sm:inline">
          {stats.map(([k, v]) => `${k} ${v}`).join(" · ")}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          columns={[
            {
              key: "callOi",
              header: "Call OI",
              align: "right",
              render: (r: ChainRow) => <OiCell value={r.call?.oi} />,
            },
            {
              key: "callVol",
              header: "Call Vol",
              align: "right",
              render: (r: ChainRow) => <OiCell value={r.call?.volume} />,
            },
            {
              key: "callLtp",
              header: "Call LTP",
              align: "right",
              render: (r: ChainRow) => (
                <span className="tnum">{r.call?.ltp == null ? "—" : inr(r.call.ltp)}</span>
              ),
            },
            {
              key: "strike",
              header: "Strike",
              align: "right",
              render: (r: ChainRow) => (
                <span
                  className={cn(
                    "tnum tnum-strong",
                    data?.atmStrike === r.strike && "rounded-sm bg-accent/10 px-1.5 py-0.5 text-accent",
                  )}
                >
                  {r.strike.toLocaleString("en-IN")}
                </span>
              ),
            },
            {
              key: "putLtp",
              header: "Put LTP",
              align: "right",
              render: (r: ChainRow) => <span className="tnum">{r.put?.ltp == null ? "—" : inr(r.put.ltp)}</span>,
            },
            {
              key: "putVol",
              header: "Put Vol",
              align: "right",
              render: (r: ChainRow) => <OiCell value={r.put?.volume} />,
            },
            {
              key: "putOi",
              header: "Put OI",
              align: "right",
              render: (r: ChainRow) => <OiCell value={r.put?.oi} />,
            },
          ]}
          rows={windowed}
          rowKey={(r) => String(r.strike)}
          loading={data == null && !failed}
          empty={<EmptyState title="No chain for this expiry — it fills on the next sync." />}
        />
        <div className="flex items-center justify-between border-t border-line px-4 py-2">
          <div className="tnum text-xs text-muted">
            {windowed.length} of {rows.length} strikes
            {rows.length > windowed.length && (
              <button
                type="button"
                onClick={() => set({ full: "1" })}
                className="ml-2 font-medium text-accent"
              >
                Show all
              </button>
            )}
            {full && rows.length > 0 && (
              <button type="button" onClick={() => set({ full: null })} className="ml-2 font-medium text-accent">
                Around ATM
              </button>
            )}
          </div>
          <DataStamp label={data?.asOf} className="border-0 px-0 py-0" />
        </div>
      </div>
    </section>
  );
}

function OiCell({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted">—</span>;
  const compact =
    value >= 1e7
      ? `${(value / 1e7).toFixed(2)} Cr`
      : value >= 1e5
        ? `${(value / 1e5).toFixed(2)} L`
        : value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return <span className="tnum text-muted">{compact}</span>;
}

"use client";

import { apiGet } from "@/lib/api";
import type { BseIndexResponse, IndexListResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { ExchangeToggle, StaleBadge, type Exchange } from "./shared";
import { cn } from "@/lib/cn";

/** Indices terminal: NSE breadth rows with group chips, or the compact BSE board.
 *  `group` presets the old F&O / broad-market / sectoral lists; `lockExchange`
 *  fixes the exchange for the same-URL wrappers. */
export function IndicesTerminal({
  exchange,
  tab,
  group = null,
  lockExchange = false,
  onExchange,
  onTab,
}: {
  exchange: Exchange;
  tab: string;
  group?: string | null;
  lockExchange?: boolean;
  onExchange: (e: Exchange) => void;
  onTab: (t: string) => void;
}) {
  const { data, stale, failed } = usePoll(
    () =>
      apiGet<IndexListResponse | BseIndexResponse>(
        exchange === "NSE" ? "/market-data/indices/nse" : "/market-data/indices/bse",
      ),
    30_000,
  );

  const nse = exchange === "NSE" ? (data as IndexListResponse | null) : null;
  const bse = exchange === "BSE" ? (data as BseIndexResponse | null) : null;

  const allRows = nse?.indices ?? [];
  const tabs =
    group != null
      ? []
      : Array.from(new Set(allRows.flatMap((r) => r.tabs))).filter((t) => t !== "all").sort();
  const rows = allRows.filter(
    (r) =>
      r.last != null &&
      (group == null || r.group === group) &&
      (tab === "all" || group != null || r.tabs.includes(tab)),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!lockExchange && <ExchangeToggle value={exchange} onChange={onExchange} />}
        {tabs.length > 0 && (
          <div role="group" aria-label="Index group" className="flex flex-wrap gap-1">
            {["all", ...tabs].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTab(t)}
                aria-pressed={tab === t}
                className={cn(
                  "min-h-[32px] rounded-full border px-3 text-xs font-medium capitalize",
                  tab === t ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-fg",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {stale && <StaleBadge />}
        {bse != null && (
          <span className="tnum ml-auto text-xs text-muted">
            ▲{bse.advancing ?? "—"} ▼{bse.declining ?? "—"}
          </span>
        )}
      </div>

      <section aria-label="Indices" className="overflow-hidden rounded-md border border-line bg-surface">
        {exchange === "NSE" ? (
          <DataTable
            stickyFirst
            columns={[
              {
                key: "name",
                header: "Index",
                render: (r) => <span className="font-medium">{r.name}</span>,
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
                key: "chg",
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
            loading={nse == null && !failed}
            empty={<EmptyState title="No index data yet — quotes fill in after the next sync." />}
          />
        ) : (
          <DataTable
            stickyFirst
            columns={[
              {
                key: "name",
                header: "Index",
                render: (r) => <span className="font-medium">{r.name}</span>,
              },
              {
                key: "last",
                header: "Last",
                align: "right",
                render: (r) => (
                  <span className="tnum tnum-strong">
                    {r.last?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"}
                  </span>
                ),
              },
              {
                key: "chg",
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
                    {r.high52?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                  </span>
                ),
              },
              {
                key: "low52",
                header: "52W L",
                align: "right",
                render: (r) => (
                  <span className="tnum text-muted">
                    {r.low52?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                  </span>
                ),
              },
            ]}
            rows={bse?.indices ?? []}
            rowKey={(r) => r.name}
            loading={bse == null && !failed}
            empty={<EmptyState title="No BSE index data yet — quotes fill in after the next sync." />}
          />
        )}
        <DataStamp
          label={
            (nse != null && (nse.generatedAt ?? nse.asOf)) || (bse != null && (bse.generatedAt ?? bse.lastSyncAt)) || null
          }
        />
      </section>
    </>
  );
}

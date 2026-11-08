"use client";

import { apiGet } from "@/lib/api";
import type { GlobalMarketsResponse, InvestorsResponse, UnlistedResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";

/** Super investors: tracked portfolios, holdings value and day change. */
export function InvestorsView() {
  const { data, stale, failed } = usePoll(() => apiGet<InvestorsResponse>("/market-data/super-investors"), 300_000);
  const rows = [...(data?.investors ?? [])].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">Super investors</h1>
        <p className="text-xs text-muted">Tracked portfolios by disclosed holdings value.</p>
        {stale && (
          <span className="ml-auto rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">
            STALE
          </span>
        )}
      </div>
      <section aria-label="Super investors" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          stickyFirst
          columns={[
            {
              key: "name",
              header: "Investor",
              render: (r) => (
                <span>
                  <span className="font-medium">{r.name}</span>
                  {r.category != null && (
                    <span className="tnum ml-2 text-[11px] font-normal capitalize text-faint">{r.category}</span>
                  )}
                </span>
              ),
            },
            {
              key: "holdings",
              header: "Stocks",
              align: "right",
              render: (r) => <span className="tnum text-muted">{r.holdingsCount ?? "—"}</span>,
            },
            {
              key: "value",
              header: "Value (Cr)",
              align: "right",
              render: (r) => (
                <span className="tnum tnum-strong">
                  {r.value == null ? "—" : r.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              ),
            },
            {
              key: "day",
              header: "Day",
              align: "right",
              render: (r) => <Num value={r.dayChange} />,
            },
            {
              key: "daypct",
              header: "Day %",
              align: "right",
              render: (r) => <ChangePill value={r.dayChangePct} />,
            },
            {
              key: "top",
              header: "Top mover",
              render: (r) => <span className="tnum text-muted">{r.topPerformer ?? "—"}</span>,
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          loading={data == null && !failed}
          empty={<EmptyState title="No investor data yet — shareholding filings fill this board." />}
        />
      </section>
    </div>
  );
}

/** Global markets: indices, commodities, currencies, bonds and ADRs. */
export function GlobalView() {
  const { data, stale, failed } = usePoll(
    () => apiGet<GlobalMarketsResponse>("/market-data/global-markets"),
    120_000,
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">Global markets</h1>
        <p className="text-xs text-muted">Overnight context before the open.</p>
        {stale && (
          <span className="ml-auto rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">
            STALE
          </span>
        )}
      </div>
      {data == null && !failed ? (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-6" aria-label="Loading">
          <div className="skeleton h-5 w-full" />
          <div className="skeleton h-5 w-full" />
        </div>
      ) : (data?.sections ?? []).length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState title="No global coverage yet — the feed fills this board." />
        </div>
      ) : (
        (data?.sections ?? []).map((s) => (
          <section key={s.id} aria-label={s.label} className="flex flex-col gap-3">
            <h2 className="px-1 text-sm font-semibold">{s.label}</h2>
            {s.groups.map((g) => (
              <div key={g.id} className="overflow-hidden rounded-md border border-line bg-surface">
                <h3 className="px-4 pt-3 text-[13px] font-medium text-muted">{g.label}</h3>
                <DataTable
                  columns={[
                    {
                      key: "name",
                      header: "Market",
                      render: (r) => (
                        <span>
                          <span className="font-medium">{r.name}</span>
                          {r.symbol != null && (
                            <span className="tnum ml-2 text-[11px] font-normal text-faint">{r.symbol}</span>
                          )}
                        </span>
                      ),
                    },
                    {
                      key: "price",
                      header: "Last",
                      align: "right",
                      render: (r) => (
                        <span className="tnum tnum-strong">{r.price?.toLocaleString("en-IN") ?? "—"}</span>
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
                      key: "state",
                      header: "State",
                      render: (r) => (
                        <span className="text-xs capitalize text-muted">{r.marketState ?? "—"}</span>
                      ),
                    },
                  ]}
                  rows={g.rows}
                  rowKey={(r) => r.id}
                  loading={false}
                  empty={null}
                />
              </div>
            ))}
          </section>
        ))
      )}
      <DataStamp label={data?.generatedAt ?? null} />
    </div>
  );
}

/** Unlisted shares: pre-IPO board. Honest about the feed state. */
export function UnlistedView() {
  const { data, failed } = usePoll(() => apiGet<UnlistedResponse>("/market-data/unlisted-shares"), 300_000);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
      <h1 className="px-1 text-base font-semibold">Unlisted shares</h1>
      <div className="rounded-md border border-line bg-surface">
        <EmptyState
          title={
            data == null && !failed
              ? "Loading…"
              : data?.feed?.configured !== true
                ? "Unlisted feed is not configured — this board activates with the feed."
                : "No unlisted companies in this window."
          }
        />
      </div>
      <DataStamp label={data?.generatedAt ?? null} />
    </div>
  );
}

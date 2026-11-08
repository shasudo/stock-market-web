"use client";

import Link from "next/link";
import { apiGet } from "@/lib/api";
import type { EarningsResponse, EconResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { cn } from "@/lib/cn";

const IMPACT: Record<string, string> = {
  high: "bg-down-tint text-down",
  medium: "bg-warn-tint text-warn",
  low: "bg-accent/10 text-accent",
};

/** Results calendar: earnings season plus the macro week. */
export function CalendarView() {
  const earnings = usePoll(() => apiGet<EarningsResponse>("/market-data/earnings"), 300_000);
  const econ = usePoll(() => apiGet<EconResponse>("/market-data/economic-calendar"), 300_000);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">Results calendar</h1>
        <p className="text-xs text-muted">Earnings season and the macro week.</p>
        {(earnings.stale || econ.stale) && (
          <span className="ml-auto rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">
            STALE
          </span>
        )}
      </div>

      <section aria-label="Earnings" className="overflow-hidden rounded-md border border-line bg-surface">
        <h2 className="px-4 pt-3 text-sm font-semibold">Earnings</h2>
        <DataTable
          stickyFirst
          columns={[
            {
              key: "company",
              header: "Company",
              render: (e) => (
                <span>
                  <span className="font-medium">{e.companyName ?? e.symbol ?? "—"}</span>
                  {e.symbol != null && (
                    <Link
                      href={`/stock/${e.symbol}`}
                      className="tnum ml-2 text-[11px] font-normal text-faint hover:text-accent"
                    >
                      {e.symbol}
                    </Link>
                  )}
                </span>
              ),
            },
            {
              key: "date",
              header: "Date",
              align: "right",
              render: (e) => <span className="tnum text-muted">{e.eventDate ?? "—"}</span>,
            },
            {
              key: "timing",
              header: "Timing",
              render: (e) => <span className="text-xs capitalize text-muted">{e.timing ?? "—"}</span>,
            },
            {
              key: "eps",
              header: "EPS est",
              align: "right",
              render: (e) => <span className="tnum">{e.epsEstimate ?? "—"}</span>,
            },
            {
              key: "ltp",
              header: "LTP",
              align: "right",
              render: (e) => <span className="tnum text-muted">{e.ltp ?? "—"}</span>,
            },
            {
              key: "pct",
              header: "%",
              align: "right",
              render: (e) => <ChangePill value={e.pctChange} />,
            },
          ]}
          rows={[...(earnings.data?.events ?? [])].sort((a, b) =>
            (a.eventDate ?? "").localeCompare(b.eventDate ?? ""),
          )}
          rowKey={(e, i) => `${e.symbol ?? ""}-${e.eventDate ?? i}`}
          loading={earnings.data == null && !earnings.failed}
          empty={<EmptyState title="No earnings scheduled in this window." />}
        />
        <DataStamp label={earnings.data?.lastSyncAt ?? null} />
      </section>

      <section aria-label="Macro week" className="overflow-hidden rounded-md border border-line bg-surface">
        <h2 className="px-4 pt-3 text-sm font-semibold">Macro week</h2>
        <DataTable
          columns={[
            {
              key: "event",
              header: "Event",
              render: (e) => (
                <span>
                  <span className="font-medium">{e.title}</span>
                  <span className="tnum ml-2 text-[11px] font-normal text-faint">
                    {e.countryName ?? e.country ?? ""}
                  </span>
                </span>
              ),
            },
            {
              key: "when",
              header: "When",
              align: "right",
              render: (e) => (
                <span className="tnum text-muted">
                  {[e.date, e.time].filter(Boolean).join(" ") || "—"}
                </span>
              ),
            },
            {
              key: "impact",
              header: "Impact",
              render: (e) => (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    (e.impact != null && IMPACT[e.impact.toLowerCase()]) || "bg-accent/10 text-accent",
                  )}
                >
                  {e.impact ?? "—"}
                </span>
              ),
            },
            {
              key: "actual",
              header: "Actual",
              align: "right",
              render: (e) => <span className="tnum">{e.actual ?? "—"}</span>,
            },
            {
              key: "forecast",
              header: "Fcst",
              align: "right",
              render: (e) => <span className="tnum text-muted">{e.forecast ?? "—"}</span>,
            },
            {
              key: "prev",
              header: "Prev",
              align: "right",
              render: (e) => <span className="tnum text-muted">{e.previous ?? "—"}</span>,
            },
          ]}
          rows={econ.data?.events ?? []}
          rowKey={(e) => e.id}
          loading={econ.data == null && !econ.failed}
          empty={<EmptyState title="No macro events in this window." />}
        />
        <DataStamp label={econ.data?.lastSyncAt ?? null} />
      </section>
    </div>
  );
}

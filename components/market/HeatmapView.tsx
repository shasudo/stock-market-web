"use client";

import { apiGet } from "@/lib/api";
import type { NiftyMonthlyResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { DataStamp } from "../numbers";
import { EmptyState } from "../DataTable";
import { cn } from "@/lib/cn";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function cellClass(v: number | null): string {
  if (v == null) return "text-faint";
  if (v > 0) return "text-up";
  if (v < 0) return "text-down";
  return "text-muted";
}

/** Nifty monthly returns: the seasonality heatmap as a plain table. */
export function HeatmapView() {
  const { data, stale, failed } = usePoll(() => apiGet<NiftyMonthlyResponse>("/market-data/nifty-monthly"), 300_000);
  const rows = [...(data?.rows ?? [])].sort((a, b) => b.year - a.year);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">Nifty monthly returns</h1>
        <p className="text-xs text-muted">
          Month-end close ÷ previous month-end close − 1, %.
          {data?.latestValue != null && (
            <span className="tnum"> Latest {data.latestValue.toLocaleString("en-IN")}</span>
          )}
        </p>
        {stale && (
          <span className="ml-auto rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">
            STALE
          </span>
        )}
      </div>

      <section aria-label="Monthly returns" className="overflow-hidden rounded-md border border-line bg-surface">
        {data == null && !failed ? (
          <div className="flex flex-col gap-2 p-6" aria-label="Loading">
            <div className="skeleton h-5 w-full" />
            <div className="skeleton h-5 w-full" />
            <div className="skeleton h-5 w-2/3" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No monthly history yet — archive backfill fills this grid." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="sticky left-0 bg-surface px-3 py-2 text-xs font-semibold text-muted">Year</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="tnum px-2 py-2 text-right text-xs font-semibold text-muted">
                      {m}
                    </th>
                  ))}
                  <th className="tnum px-3 py-2 text-right text-xs font-semibold text-muted">CY</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} className="border-b border-line last:border-0">
                    <td className="tnum sticky left-0 bg-surface px-3 py-1.5 font-semibold">{r.year}</td>
                    {MONTHS.map((_, i) => {
                      const c = r.months[i] ?? null;
                      return (
                        <td key={i} className={cn("tnum whitespace-nowrap px-2 py-1.5 text-right", cellClass(c?.value ?? null))}>
                          {c?.value == null ? "—" : `${c.partial ? "~" : ""}${c.value.toFixed(2)}`}
                        </td>
                      );
                    })}
                    <td className={cn("tnum whitespace-nowrap px-3 py-1.5 text-right font-semibold", cellClass(r.total?.value ?? null))}>
                      {r.total?.value == null ? "—" : `${r.total.partial ? "~" : ""}${r.total.value.toFixed(2)}`}
                    </td>
                  </tr>
                ))}
                {(data?.stats ?? []).map((s) => (
                  <tr key={s.label} className="border-t border-line bg-bg">
                    <td className="sticky left-0 bg-bg px-3 py-1.5 text-xs font-semibold text-muted">{s.label}</td>
                    {MONTHS.map((_, i) => (
                      <td key={i} className="tnum whitespace-nowrap px-2 py-1.5 text-right text-xs text-muted">
                        {s.months[i] == null ? "—" : s.months[i]!.toFixed(2)}
                      </td>
                    ))}
                    <td className="tnum whitespace-nowrap px-3 py-1.5 text-right text-xs font-semibold text-muted">
                      {s.total == null ? "—" : s.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DataStamp label={data?.asOf ?? null} />
      </section>
      <p className="px-1 text-[11px] text-faint">~ marks a partial month or year. Median, SD and Avg use completed months only.</p>
    </div>
  );
}

"use client";

import { apiGet } from "@/lib/api";
import type { PeResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { DataStamp } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";

/** Index PE: trailing history plus the current read. */
export function PeView() {
  const { data, stale, failed } = usePoll(() => apiGet<PeResponse>("/market-data/pe"), 300_000);
  const points = [...(data?.points ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const pes = points.map((p) => p.pe).filter((v): v is number => v != null);
  const latest = points[0]?.pe ?? null;
  const min = pes.length > 0 ? Math.min(...pes) : null;
  const max = pes.length > 0 ? Math.max(...pes) : null;
  const avg = pes.length > 0 ? pes.reduce((a, b) => a + b, 0) / pes.length : null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">{data?.indexSymbol ?? "Index"} PE</h1>
        <p className="tnum text-xs text-muted">
          {latest == null ? (
            "no current read"
          ) : (
            <>
              now <span className="tnum-strong text-fg">{latest.toFixed(2)}</span>
              {min != null && max != null && (
                <span>
                  {" "}
                  · range {min.toFixed(1)}–{max.toFixed(1)}
                  {avg != null && <> · avg {avg.toFixed(1)}</>}
                </span>
              )}
            </>
          )}
        </p>
        {stale && (
          <span className="ml-auto rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">
            STALE
          </span>
        )}
      </div>

      <section aria-label="PE history" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          columns={[
            {
              key: "date",
              header: "Date",
              render: (p) => <span className="tnum text-muted">{p.date}</span>,
            },
            {
              key: "pe",
              header: "PE",
              align: "right",
              render: (p) => <span className="tnum tnum-strong">{p.pe?.toFixed(2) ?? "—"}</span>,
            },
            {
              key: "n",
              header: "Constituents",
              align: "right",
              render: (p) => <span className="tnum text-muted">{p.constituentCount ?? "—"}</span>,
            },
          ]}
          rows={points.slice(0, 60)}
          rowKey={(p) => p.date}
          loading={data == null && !failed}
          empty={<EmptyState title="No PE history yet — the series builds with the next sync." />}
        />
        <DataStamp label={data?.historyBeginsAt != null ? `since ${data.historyBeginsAt}` : null} />
      </section>
    </div>
  );
}

"use client";

import { apiGet } from "@/lib/api";
import type { IpoItem, IpoResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { DataStamp } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { StaleBadge } from "./shared";

/** IPO board: listed issues plus pipeline counts. */
export function IpoBoard() {
  const { data, stale, failed } = usePoll(() => apiGet<IpoResponse>("/market-data/ipo"), 300_000);

  const listed = [...(data?.listed ?? [])].sort((a, b) => (b.listingDate ?? "").localeCompare(a.listingDate ?? ""));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {stale && <StaleBadge />}
        {data != null && (
          <p className="tnum text-xs text-muted">
            {data.open.length} open · {data.upcoming.length} upcoming · {data.closed.length} closed ·{" "}
            {data.listed.length} listed
            {data.pending ? " · full calendar pending" : ""}
          </p>
        )}
      </div>

      <section aria-label="IPOs" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          stickyFirst
          columns={[
            {
              key: "company",
              header: "Company",
              render: (r: IpoItem) => (
                <span>
                  <span className="font-medium">{r.companyName}</span>
                  {r.segment != null && (
                    <span className="tnum ml-2 text-[11px] font-normal text-faint">{r.segment}</span>
                  )}
                </span>
              ),
            },
            {
              key: "listed",
              header: "Listed",
              align: "right",
              render: (r: IpoItem) => <span className="tnum text-muted">{r.listingDate ?? "—"}</span>,
            },
            {
              key: "band",
              header: "Band",
              align: "right",
              render: (r: IpoItem) => (
                <span className="tnum text-muted">
                  {r.priceLow == null ? "—" : `${r.priceLow}–${r.priceHigh ?? "—"}`}
                </span>
              ),
            },
            {
              key: "issue",
              header: "Issue",
              align: "right",
              render: (r: IpoItem) => <span className="tnum">{r.issuePrice ?? "—"}</span>,
            },
            {
              key: "size",
              header: "Size (Cr)",
              align: "right",
              render: (r: IpoItem) => (
                <span className="tnum text-muted">
                  {r.issueSizeCr?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (r: IpoItem) => <span className="text-xs capitalize text-muted">{r.status ?? "—"}</span>,
            },
          ]}
          rows={listed}
          rowKey={(r) => `${r.companyName}-${r.listingDate ?? r.symbol ?? ""}`}
          loading={data == null && !failed}
          empty={
            <EmptyState
              title={
                data?.pending
                  ? "IPO calendar is still being built — listed issues appear here first."
                  : "No listed issues in this window."
              }
            />
          }
        />
        <DataStamp label={data?.generatedAt ?? null} />
      </section>
    </>
  );
}

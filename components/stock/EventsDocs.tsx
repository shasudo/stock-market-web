"use client";

import Link from "next/link";
import type { DocumentsResponse, StockEventsResponse, UserView } from "@/lib/types";
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

/** Company events: actions and filings on this symbol. */
export function StockEventsTerminal({
  user,
  checked,
  symbol,
}: {
  user: UserView | null;
  checked: boolean;
  symbol: string;
}) {
  const { data, failed, loading, gated } = useTerminalData<StockEventsResponse>(
    user, checked, `/stocks/${encodeURIComponent(symbol)}/events`, 300_000,
  );
  if (gated) return <Gate label="company events" />;

  return (
    <section aria-label="Company events" className="overflow-hidden rounded-md border border-line bg-surface">
      <DataTable
        columns={[
          {
            key: "subject",
            header: "Event",
            render: (e) => <span className="font-medium">{e.subject ?? e.kind ?? "—"}</span>,
          },
          {
            key: "date",
            header: "Date",
            align: "right",
            render: (e) => (
              <span className="tnum text-muted">
                {(e.eventDate ?? e.exDate ?? e.recordDate ?? "")?.slice(0, 10) || "—"}
              </span>
            ),
          },
        ]}
        rows={data?.events ?? []}
        rowKey={(_, i) => String(i)}
        loading={loading}
        empty={
          <EmptyState title={failed ? "Events are unreachable right now." : "No company events in this window."} />
        }
      />
    </section>
  );
}

function docRows(
  title: string,
  docs: { subject?: string | null; summary?: string | null; label?: string | null; category?: string | null; date?: string | null; exDate?: string | null; filedAt?: string | null; fromYear?: number | null; toYear?: number | null; url?: string | null; fileSize?: string | null }[],
) {
  if (docs.length === 0) return null;
  return (
    <section aria-label={title} className="overflow-hidden rounded-md border border-line bg-surface">
      <h2 className="px-4 pt-3 text-sm font-semibold">{title}</h2>
      <DataTable
        columns={[
          {
            key: "doc",
            header: "Document",
            render: (d) => (
              <span>
                <span className="font-medium">{d.subject ?? d.summary ?? d.label ?? "—"}</span>
                {(d.category ?? d.fromYear != null) && (
                  <span className="tnum ml-2 text-[11px] font-normal text-faint">
                    {d.fromYear != null ? `${d.fromYear}–${d.toYear ?? ""}` : d.category}
                  </span>
                )}
              </span>
            ),
          },
          {
            key: "date",
            header: "Date",
            align: "right",
            render: (d) => (
              <span className="tnum text-muted">
                {(d.date ?? d.exDate ?? d.filedAt ?? "")?.slice(0, 10) || "—"}
              </span>
            ),
          },
          {
            key: "open",
            header: "",
            align: "right",
            render: (d) =>
              d.url == null ? (
                <span className="text-muted">—</span>
              ) : (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] font-medium text-accent hover:underline"
                >
                  Open{d.fileSize != null && ` · ${d.fileSize}`}
                </a>
              ),
          },
        ]}
        rows={docs}
        rowKey={(_, i) => `${title}-${i}`}
        loading={false}
        empty={null}
      />
    </section>
  );
}

/** Documents: actions, announcements, reports, ratings and concalls. */
export function DocsTerminal({
  user,
  checked,
  symbol,
}: {
  user: UserView | null;
  checked: boolean;
  symbol: string;
}) {
  const { data, failed, loading, gated } = useTerminalData<DocumentsResponse>(
    user, checked, `/stocks/${encodeURIComponent(symbol)}/documents`, 300_000,
  );
  if (gated) return <Gate label="company documents" />;

  if (loading) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-6" aria-label="Loading">
        <div className="skeleton h-5 w-full" />
        <div className="skeleton h-5 w-2/3" />
      </div>
    );
  }
  if (failed || data == null) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <EmptyState title="Documents are unreachable right now." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {docRows("Corporate actions", data.actions)}
      {docRows("Announcements", data.announcements)}
      {docRows("Annual reports", data.annualReports)}
      {docRows("Credit ratings", data.creditRatings)}
      {docRows("Concall transcripts", data.concalls)}
      {(data.unavailable ?? []).length > 0 && (
        <p className="px-1 text-[11px] text-faint">Unavailable: {data.unavailable.join(", ")}</p>
      )}
      {data.actions.length === 0 &&
        data.announcements.length === 0 &&
        data.annualReports.length === 0 &&
        data.creditRatings.length === 0 &&
        data.concalls.length === 0 && (
          <div className="rounded-md border border-line bg-surface">
            <EmptyState title="No documents filed in this window." />
          </div>
        )}
    </div>
  );
}

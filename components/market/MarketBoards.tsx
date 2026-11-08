"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { apiGet } from "@/lib/api";
import type { BreadthResponse, DealHistoryResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { DataStamp } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { StaleBadge } from "./shared";
import { cn } from "@/lib/cn";

type DealType = "all" | "block" | "bulk";

function pageShell(title: string, blurb: string, stale: boolean, children: React.ReactNode) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">{title}</h1>
        <p className="text-xs text-muted">{blurb}</p>
        {stale && <StaleBadge />}
      </div>
      {children}
    </div>
  );
}

/** Intraday deals: the full deal tape with type tabs, search and paging. */
export function DealHistoryView() {
  const router = useRouter();
  const params = useSearchParams();
  const rawType = params.get("dealType") ?? "all";
  const dealType: DealType = rawType === "block" || rawType === "bulk" ? rawType : "all";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const search = params.get("search") ?? "";

  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.replace(
      qs === "" ? "/market-data/intraday-deals" : `/market-data/intraday-deals?${qs}`,
      { scroll: false },
    );
  }

  const path =
    `/market-data/deals/history?dealType=${dealType}&page=${page}&pageSize=50` +
    (search === "" ? "" : `&search=${encodeURIComponent(search)}`);
  const { data, stale, failed } = usePoll(() => apiGet<DealHistoryResponse>(path), 60_000);
  const pagination = data?.pagination;

  const body = (
    <section aria-label="Deal history" className="overflow-hidden rounded-md border border-line bg-surface">
      <DataTable
        stickyFirst
        columns={[
          {
            key: "company",
            header: "Company",
            render: (d) => (
              <span>
                <span className="font-medium">{d.companyName ?? d.symbol ?? "—"}</span>
                {d.symbol != null && (
                  <Link
                    href={`/stock/${d.symbol}`}
                    className="tnum ml-2 text-[11px] font-normal text-faint hover:text-accent"
                  >
                    {d.symbol}
                  </Link>
                )}
              </span>
            ),
          },
          {
            key: "type",
            header: "Type",
            render: (d) => <span className="text-xs capitalize text-muted">{d.dealType ?? "—"}</span>,
          },
          {
            key: "side",
            header: "Side",
            align: "right",
            render: (d) => (
              <span className={cn("text-[13px]", d.transactionType === "BUY" ? "text-up" : d.transactionType === "SELL" ? "text-down" : "")}>
                {d.transactionType ?? "—"}
              </span>
            ),
          },
          {
            key: "client",
            header: "Client",
            render: (d) => <span className="text-[13px] text-muted">{d.clientName ?? "—"}</span>,
          },
          {
            key: "qty",
            header: "Qty",
            align: "right",
            render: (d) => (
              <span className="tnum text-muted">
                {d.quantity?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
              </span>
            ),
          },
          {
            key: "price",
            header: "Price",
            align: "right",
            render: (d) => <span className="tnum">{d.price ?? "—"}</span>,
          },
          {
            key: "date",
            header: "Date",
            align: "right",
            render: (d) => <span className="tnum text-muted">{d.dealDate?.slice(0, 10) ?? "—"}</span>,
          },
        ]}
        rows={data?.deals ?? []}
        rowKey={(d, i) => `${d.symbol ?? ""}-${d.dealDate ?? ""}-${d.clientName ?? i}`}
        loading={data == null && !failed}
        empty={<EmptyState title="No deals match — clear search or wait for the next posting." />}
      />
      <div className="flex items-center justify-between border-t border-line px-4 py-2">
        <div className="tnum text-xs text-muted">
          Page {pagination?.page ?? page} of {pagination?.totalPages ?? "—"} ·{" "}
          {pagination?.totalDeals ?? 0} deals
        </div>
        <DataStamp label={data?.lastSyncAt ?? null} className="border-0 px-0 py-0" />
      </div>
    </section>
  );

  return pageShell(
    "Deal history",
    "Bulk and block tape, most recent first.",
    stale,
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Deal type" className="flex rounded-md border border-line bg-surface p-0.5">
          {(["all", "block", "bulk"] as DealType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set({ dealType: t, page: null })}
              aria-pressed={dealType === t}
              className={cn(
                "min-h-[32px] rounded-sm px-3 text-[13px] font-medium capitalize",
                dealType === t ? "bg-accent/10 text-accent" : "text-muted hover:text-fg",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => set({ search: e.target.value, page: null })}
          placeholder="Search symbol or client"
          aria-label="Search deals"
          className="h-9 w-56 rounded-md border border-line bg-surface px-3 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
      </div>
      {body}
      {pagination != null && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => set({ page: String(Math.max(1, page - 1)) })}
            className="min-h-[36px] rounded-md border border-line bg-surface px-3 text-sm font-medium disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => set({ page: String(page + 1) })}
            className="min-h-[36px] rounded-md border border-line bg-surface px-3 text-sm font-medium disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </>,
  );
}

export function DealHistoryRoute() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading…</div>}>
      <DealHistoryView />
    </Suspense>
  );
}

/** Breadth: advances vs declines across futures and options, plus volume split. */
export function BreadthView() {
  const { data, stale, failed } = usePoll(() => apiGet<BreadthResponse>("/market-data/fno/snapshot"), 300_000);
  const adv = data?.advanceDecline;

  function slice(label: string, s: { advanced: number; declined: number; unchanged: number; total: number } | undefined) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-line bg-surface px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="tnum tnum-strong text-xl">
          <span className="text-up">▲{s?.advanced ?? "—"}</span>
          <span className="text-faint"> / </span>
          <span className="text-down">▼{s?.declined ?? "—"}</span>
        </p>
        <p className="tnum text-[11px] text-faint">
          {s?.unchanged ?? "—"} unchanged · {s?.total ?? "—"} total
        </p>
      </div>
    );
  }

  return pageShell(
    "Market breadth",
    "Advances vs declines — where the day actually went.",
    stale,
    <>
      {data == null && !failed ? (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-6" aria-label="Loading">
          <div className="skeleton h-5 w-full" />
          <div className="skeleton h-5 w-2/3" />
        </div>
      ) : adv == null ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState title="No breadth data yet — it fills with the next snapshot." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {slice("Futures", adv.futures)}
            {slice("Calls", adv.calls)}
            {slice("Puts", adv.puts)}
          </div>
          <section aria-label="Volume split" className="overflow-hidden rounded-md border border-line bg-surface">
            <h2 className="px-4 pt-3 text-sm font-semibold">Volume split</h2>
            <DataTable
              columns={[
                {
                  key: "segment",
                  header: "Segment",
                  render: (s) => <span className="font-medium">{s.segment}</span>,
                },
                {
                  key: "contracts",
                  header: "Contracts",
                  align: "right",
                  render: (s) => (
                    <span className="tnum text-muted">
                      {s.contracts?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                    </span>
                  ),
                },
                {
                  key: "turnover",
                  header: "Turnover (Cr)",
                  align: "right",
                  render: (s) => (
                    <span className="tnum">
                      {s.turnoverCr?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                    </span>
                  ),
                },
                {
                  key: "oi",
                  header: "OI",
                  align: "right",
                  render: (s) => (
                    <span className="tnum text-muted">
                      {s.oiContracts?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                    </span>
                  ),
                },
                {
                  key: "share",
                  header: "Share",
                  align: "right",
                  render: (s) => (
                    <span className="tnum text-muted">
                      {s.share == null ? "—" : `${(s.share * 100).toFixed(1)}%`}
                    </span>
                  ),
                },
              ]}
              rows={data?.volumeBreakup?.segments ?? []}
              rowKey={(s) => s.segment}
              loading={false}
              empty={null}
            />
            <DataStamp label={data?.generatedAt ?? adv.optionsDate} />
          </section>
        </>
      )}
    </>,
  );
}

"use client";

import Link from "next/link";
import { apiGet } from "@/lib/api";
import type { CircuitResponse, CorporateResponse, DealsResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { DataStamp } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";

export type DealsKind = "block" | "bulk" | "corporate" | "circuit";

const META: Record<DealsKind, { title: string; blurb: string; path: string }> = {
  block: {
    title: "Block deals",
    blurb: "Negotiated trades above the block window threshold.",
    path: "/market-data/block-deals",
  },
  bulk: {
    title: "Bulk deals",
    blurb: "Single trades over 0.5% of listed shares.",
    path: "/market-data/bulk-deals",
  },
  corporate: {
    title: "Corporate actions",
    blurb: "Dividends, splits, bonuses and record dates.",
    path: "/market-data/corporate-action",
  },
  circuit: {
    title: "Circuit changes",
    blurb: "Revised price bands — breakouts and breakdowns live here.",
    path: "/market-data/circuit-changes",
  },
};

interface DealRow {
  symbol: string | null;
  companyName: string | null;
  eventDate: string | null;
  clientName: string | null;
  transactionType: string | null;
  quantity: number | null;
  price: number | null;
  purpose: string | null;
  recordDate: string | null;
  highOrLow: string | null;
}

/** Block / bulk / corporate-action / circuit deal boards. */
export function DealsView({ kind }: { kind: DealsKind }) {
  const meta = META[kind];
  const { data, stale, failed } = usePoll(async () => {
    if (kind === "corporate") {
      const d = await apiGet<CorporateResponse>(meta.path);
      return {
        lastSyncAt: d.lastSyncAt,
        events: d.events.map(
          (e): DealRow => ({
            symbol: e.symbol,
            companyName: e.companyName,
            eventDate: e.eventDate,
            clientName: null,
            transactionType: null,
            quantity: null,
            price: null,
            purpose: e.purpose,
            recordDate: e.recordDate,
            highOrLow: null,
          }),
        ),
      };
    }
    if (kind === "circuit") {
      const d = await apiGet<CircuitResponse>(meta.path);
      return {
        lastSyncAt: d.lastSyncAt,
        events: d.events.map(
          (e): DealRow => ({
            symbol: e.symbol,
            companyName: e.companyName,
            eventDate: null,
            clientName: null,
            transactionType: null,
            quantity: null,
            price: null,
            purpose: null,
            recordDate: null,
            highOrLow: e.highOrLow,
          }),
        ),
      };
    }
    const d = await apiGet<DealsResponse>(meta.path);
    return {
      lastSyncAt: d.lastSyncAt,
      events: d.events.map(
        (e): DealRow => ({
          symbol: e.symbol,
          companyName: e.companyName,
          eventDate: e.eventDate,
          clientName: e.clientName,
          transactionType: e.transactionType,
          quantity: e.quantity,
          price: e.price,
          purpose: null,
          recordDate: null,
          highOrLow: null,
        }),
      ),
    };
  }, 60_000);

  const events = data?.events ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">{meta.title}</h1>
        <p className="text-xs text-muted">{meta.blurb}</p>
        {stale && (
          <span className="ml-auto rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">
            STALE
          </span>
        )}
      </div>
      <section aria-label={meta.title} className="overflow-hidden rounded-md border border-line bg-surface">
        {kind === "corporate" ? (
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
                key: "purpose",
                header: "Purpose",
                render: (e) => <span className="text-[13px]">{e.purpose ?? "—"}</span>,
              },
              {
                key: "date",
                header: "Ex date",
                align: "right",
                render: (e) => <span className="tnum text-muted">{e.eventDate ?? "—"}</span>,
              },
              {
                key: "record",
                header: "Record",
                align: "right",
                render: (e) => <span className="tnum text-muted">{e.recordDate ?? "—"}</span>,
              },
            ]}
            rows={events}
            rowKey={(_, i) => String(i)}
            loading={data == null && !failed}
            empty={<EmptyState title="No corporate actions in this window." />}
          />
        ) : kind === "circuit" ? (
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
                key: "band",
                header: "Band",
                align: "right",
                render: (e) => (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium capitalize text-accent">
                    {e.highOrLow ?? "—"}
                  </span>
                ),
              },
            ]}
            rows={events}
            rowKey={(_, i) => String(i)}
            loading={data == null && !failed}
            empty={<EmptyState title="No circuit revisions in this window." />}
          />
        ) : (
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
                key: "client",
                header: "Client",
                render: (e) => <span className="text-[13px] text-muted">{e.clientName ?? "—"}</span>,
              },
              {
                key: "type",
                header: "Side",
                align: "right",
                render: (e) => <span className="text-[13px] capitalize">{e.transactionType ?? "—"}</span>,
              },
              {
                key: "qty",
                header: "Qty",
                align: "right",
                render: (e) => (
                  <span className="tnum text-muted">
                    {e.quantity?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                  </span>
                ),
              },
              {
                key: "price",
                header: "Price",
                align: "right",
                render: (e) => <span className="tnum">{e.price ?? "—"}</span>,
              },
              {
                key: "date",
                header: "Date",
                align: "right",
                render: (e) => <span className="tnum text-muted">{e.eventDate ?? "—"}</span>,
              },
            ]}
            rows={events}
            rowKey={(_, i) => String(i)}
            loading={data == null && !failed}
            empty={<EmptyState title="No deals in this window — the board fills after settlement postings." />}
          />
        )}
        <DataStamp label={data?.lastSyncAt ?? null} />
      </section>
    </div>
  );
}

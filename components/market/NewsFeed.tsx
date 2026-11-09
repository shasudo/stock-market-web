"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePoll } from "@/hooks/usePoll";
import { apiGet } from "@/lib/api";
import { inr as fmtPrice, int as fmtNum } from "@/lib/format";
import type { CorporateResponse, DealsResponse } from "@/lib/types";
import { DataStamp } from "@/components/numbers";
import { StaleBadge } from "@/components/market/shared";
import { EmptyState } from "@/components/DataTable";

type Kind = "Corporate action" | "Bulk deal" | "Block deal";

interface FlowItem {
  id: string;
  kind: Kind;
  symbol: string;
  company: string;
  date: string;
  title: string;
  detail: string | null;
}

function dealTitle(client: string | null, side: string | null, label: string): string {
  const verb = side === "SELL" ? "Sold" : "Bought";
  return `${label} · ${verb}${client ? ` ${client}` : ""}`;
}

function dealDetail(qty: number | null, price: number | null): string | null {
  if (qty == null || price == null) return null;
  return `${fmtNum(qty)} @ ${fmtPrice(price)}`;
}

const KIND_DOT: Record<Kind, string> = {
  "Corporate action": "bg-accent",
  "Bulk deal": "bg-up",
  "Block deal": "bg-warn",
};

/** Chronological feed: corporate actions + bulk + block deals. */
export function NewsFeed() {
  const actions = usePoll(() => apiGet<CorporateResponse>("/market-data/corporate-action"), 60_000);
  const bulk = usePoll(() => apiGet<DealsResponse>("/market-data/bulk-deals"), 60_000);
  const block = usePoll(() => apiGet<DealsResponse>("/market-data/block-deals"), 60_000);
  const [kind, setKind] = useState<"All" | Kind>("All");
  const [query, setQuery] = useState("");

  const items = useMemo<FlowItem[]>(() => {
    const out: FlowItem[] = [];
    (actions.data?.events ?? []).forEach((e, i) => {
      if (!e.symbol || !e.eventDate || Number.isNaN(Date.parse(e.eventDate))) return;
      out.push({
        id: `ca-${e.symbol}-${e.eventDate}-${i}`,
        kind: "Corporate action",
        symbol: e.symbol,
        company: e.companyName ?? e.symbol,
        date: e.eventDate,
        title: e.purpose?.trim() !== "" ? (e.purpose as string) : "Corporate action",
        detail: e.recordDate ? `Record date ${e.recordDate}` : null,
      });
    });
    const deals: Array<{ list: DealsResponse | null; kind: Kind; label: string }> = [
      { list: bulk.data, kind: "Bulk deal", label: "Bulk deal" },
      { list: block.data, kind: "Block deal", label: "Block deal" },
    ];
    for (const { list, kind: k, label } of deals) {
      (list?.events ?? []).forEach((e, i) => {
        if (!e.symbol || !e.eventDate || Number.isNaN(Date.parse(e.eventDate))) return;
        out.push({
          id: `${k}-${e.symbol}-${e.eventDate}-${i}`,
          kind: k,
          symbol: e.symbol,
          company: e.companyName ?? e.symbol,
          date: e.eventDate,
          title: dealTitle(e.clientName, e.transactionType, label),
          detail: dealDetail(e.quantity, e.price),
        });
      });
    }
    const q = query.trim().toLowerCase();
    return out
      .filter((it) => (kind === "All" || it.kind === kind) && (q === "" || it.symbol.toLowerCase().includes(q) || it.company.toLowerCase().includes(q)))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [actions.data, bulk.data, block.data, kind, query]);

  const loading = actions.data == null && bulk.data == null && block.data == null
    && !actions.failed && !bulk.failed && !block.failed;
  const failed = actions.failed && bulk.failed && block.failed;
  const stale = actions.stale || bulk.stale || block.stale;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5" role="tablist" aria-label="Kind">
          {(["All", "Corporate action", "Bulk deal", "Block deal"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-full border px-2.5 py-1 text-xs ${kind === k ? "border-accent bg-accent-dim text-accent" : "border-line text-muted hover:text-fg"}`}
            >
              {k}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter symbol or company"
          className="ml-auto w-52 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          aria-label="Filter feed"
        />
        {stale ? <StaleBadge /> : null}
      </div>

      {loading ? (
        <div className="space-y-2" aria-label="Loading news">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-14 w-full rounded-lg" />)}
        </div>
      ) : failed || items.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState title={failed ? "News feed is unavailable." : "No items match."} />
        </div>
      ) : (
        <ol className="overflow-hidden rounded-xl border border-line bg-surface">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-3 border-b border-line px-3 py-2.5 last:border-0">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOT[it.kind]}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <Link href={`/stock/${encodeURIComponent(it.symbol)}`} className="font-mono font-semibold hover:text-accent">
                    {it.symbol}
                  </Link>
                  <span className="text-muted"> · {it.title}</span>
                </p>
                <p className="truncate text-xs text-faint">
                  {it.company}
                  {it.detail ? ` · ${it.detail}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] uppercase tracking-wider text-faint">{it.kind}</p>
                <p className="font-mono text-xs tabular-nums text-muted">
                  {new Date(it.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <DataStamp label={actions.data?.lastSyncAt ?? bulk.data?.lastSyncAt ?? null} className="border-0 px-0 py-0" />
    </div>
  );
}

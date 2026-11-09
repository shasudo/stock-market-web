"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import apiClient from "@/lib/api-client";

interface FlowItem {
  readonly id: string;
  readonly kind: "Corporate action" | "Bulk deal" | "Block deal";
  readonly symbol: string;
  readonly company: string;
  readonly date: string;
  readonly title: string;
  readonly detail: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toItems(
  payload: unknown,
  kind: FlowItem["kind"],
  prefix: (entry: Record<string, unknown>) => string,
  detail: (entry: Record<string, unknown>) => string | null,
): FlowItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.events)) return [];
  const items: FlowItem[] = [];
  payload.events.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    const symbol = typeof raw.symbol === "string" ? raw.symbol : "";
    const date = typeof raw.eventDate === "string" ? raw.eventDate : "";
    if (!symbol || !date || Number.isNaN(new Date(date).getTime())) return;
    items.push({
      id: `${kind}-${symbol}-${date}-${index}`,
      kind,
      symbol,
      company: typeof raw.companyName === "string" ? raw.companyName : symbol,
      date,
      title: `${prefix(raw)}`.trim(),
      detail: detail(raw),
    });
  });
  return items;
}

function dealTitle(entry: Record<string, unknown>, label: string): string {
  const side = entry.transactionType === "SELL" ? "Sold" : "Bought";
  const client =
    typeof entry.clientName === "string" && entry.clientName !== ""
      ? ` ${entry.clientName}`
      : "";
  return `${label} · ${side}${client}`;
}

function dealDetail(entry: Record<string, unknown>): string | null {
  if (typeof entry.quantity !== "number" || typeof entry.price !== "number") {
    return null;
  }
  return `${entry.quantity.toLocaleString("en-IN")} @ ₹${entry.price.toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const KIND_STYLES: Record<FlowItem["kind"], string> = {
  "Corporate action": "bg-[#E3EFFD] text-[#2962FF]",
  "Bulk deal": "bg-[#E7F6F0] text-[#089981]",
  "Block deal": "bg-[#FFF4E5] text-[#B26A00]",
};

/**
 * TradingView-style News Flow: the latest NSE corporate actions plus bulk
 * and block deals in one chronological feed.
 */
export default function NewsFlowPage() {
  const [items, setItems] = useState<readonly FlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<"All" | FlowItem["kind"]>("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([
      apiClient.get<unknown>("/api/market-data/corporate-action"),
      apiClient.get<unknown>("/api/market-data/bulk-deals"),
      apiClient.get<unknown>("/api/market-data/block-deals"),
    ]).then(([actions, bulk, block]) => {
      if (cancelled) return;
      const merged: FlowItem[] = [
        ...toItems(
          actions.status === "fulfilled" ? actions.value.data : null,
          "Corporate action",
          (entry) =>
            typeof entry.purpose === "string" && entry.purpose !== ""
              ? entry.purpose
              : "Corporate action",
          (entry) =>
            typeof entry.recordDate === "string" && entry.recordDate !== ""
              ? `Record date ${entry.recordDate}`
              : null,
        ),
        ...toItems(
          bulk.status === "fulfilled" ? bulk.value.data : null,
          "Bulk deal",
          (entry) => dealTitle(entry, "Bulk deal"),
          dealDetail,
        ),
        ...toItems(
          block.status === "fulfilled" ? block.value.data : null,
          "Block deal",
          (entry) => dealTitle(entry, "Block deal"),
          dealDetail,
        ),
      ];
      merged.sort((a, b) => (a.date < b.date ? 1 : -1));
      setItems(merged);
      setFailed(merged.length === 0);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toUpperCase();
    return items.filter(
      (item) =>
        (kind === "All" || item.kind === kind) &&
        (!needle ||
          item.symbol.toUpperCase().includes(needle) ||
          item.company.toUpperCase().includes(needle) ||
          item.title.toUpperCase().includes(needle)),
    );
  }, [items, kind, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#131722]">News Flow</h1>
          <p className="text-[13px] text-[#787B86]">
            Latest corporate actions, bulk and block deals
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-[#F0F3FA] p-1">
          {(
            ["All", "Corporate action", "Bulk deal", "Block deal"] as const
          ).map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={kind === entry}
              onClick={() => setKind(entry)}
              className={`rounded-md px-2.5 py-1.5 text-[13px] font-semibold transition-colors ${
                kind === entry
                  ? "bg-card text-[#131722] shadow-sm"
                  : "text-[#787B86] hover:text-[#131722]"
              }`}
            >
              {entry === "All" ? "All" : entry.replace(" deal", "s")}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search symbol, company or headline…"
          aria-label="Search news flow"
          className="w-full max-w-md rounded-md border border-[#E0E3EB] bg-[#F8F9FD] px-3 py-2 text-[13px] outline-none placeholder:text-[#9598A1] focus:border-[#2962FF]"
        />
      </div>
      {loading ? (
        <p className="py-10 text-center text-[13px] text-[#787B86]">Loading…</p>
      ) : failed ? (
        <p className="py-10 text-center text-[13px] text-[#787B86]">
          Couldn&apos;t load the news flow right now.
        </p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[#787B86]">
          Nothing matches your filters.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[#F0F3FA]">
          {visible.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3">
              <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-bold ${KIND_STYLES[item.kind]}`}
              >
                {item.kind === "Corporate action" ? "Action" : item.kind}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/chart/${encodeURIComponent(item.symbol)}`}
                  className="text-[13.5px] font-semibold text-[#131722] hover:text-[#2962FF]"
                >
                  {item.symbol}
                </Link>
                <span className="truncate text-[12.5px] text-[#787B86]">
                  {" "}
                  · {item.company}
                </span>
                <p className="pt-0.5 text-[13px] leading-snug text-[#131722]">
                  {item.title}
                </p>
                <p className="pt-0.5 text-[12px] text-[#787B86]">
                  {formatDate(item.date)}
                  {item.detail ? ` · ${item.detail}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

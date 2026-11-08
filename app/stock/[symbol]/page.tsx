"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { istDate } from "@/lib/format";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "@/components/numbers";
import { EmptyState } from "@/components/DataTable";
import { inr } from "@/lib/format";
import { useTerminalSession } from "@/components/stock/useStockTerminal";
import { PeersTerminal, RatiosTerminal } from "@/components/stock/PeersRatios";
import { FinancialsTerminal, HoldingsTerminal } from "@/components/stock/HoldingsFinancials";
import { DocsTerminal, StockEventsTerminal } from "@/components/stock/EventsDocs";
import { cn } from "@/lib/cn";

interface StockDetail {
  symbol: string;
  displayName: string;
  sector: string | null;
  industry: string | null;
  lastPrice: number;
  prevClose: number;
  open: number | null;
  high: number | null;
  low: number | null;
  netChange: number;
  pctChange: number;
  week52High: number | null;
  week52Low: number | null;
  syncedAt: string | null;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "peers", label: "Peers" },
  { id: "ratios", label: "Ratios" },
  { id: "holdings", label: "Holdings" },
  { id: "financials", label: "Financials" },
  { id: "events", label: "Events" },
  { id: "docs", label: "Docs" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Stock detail: quote header plus six signed-in terminals. */
export default function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl p-4 text-sm text-muted">Loading…</div>}>
      <StockInner symbol={symbol} />
    </Suspense>
  );
}

function StockInner({ symbol }: { symbol: string }) {
  const upper = symbol.toUpperCase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") ?? "overview";
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "overview";

  const { data, failed } = usePoll(
    () => apiGet<{ stock: StockDetail }>(`/stocks/${encodeURIComponent(upper)}`),
    15_000,
  );
  const { user, checked } = useTerminalSession();
  const stock = data?.stock ?? null;

  function setTab(t: TabId) {
    const sp = new URLSearchParams(searchParams.toString());
    if (t === "overview") sp.delete("tab");
    else sp.set("tab", t);
    const qs = sp.toString();
    router.replace(qs === "" ? `/stock/${upper}` : `/stock/${upper}?${qs}`, { scroll: false });
  }

  if (stock == null) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <div className="rounded-md border border-line bg-surface">
          <EmptyState
            title={!failed ? "Loading…" : `No quote for ${upper} — it fills on the next sync.`}
            action={
              <Link href="/markets" className="text-sm font-medium text-accent">
                Back to Markets
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const facts: Array<[string, string]> = [
    ["Open", stock.open == null ? "—" : inr(stock.open)],
    ["High", stock.high == null ? "—" : inr(stock.high)],
    ["Low", stock.low == null ? "—" : inr(stock.low)],
    ["Prev close", inr(stock.prevClose)],
    ["52W high", stock.week52High == null ? "—" : inr(stock.week52High)],
    ["52W low", stock.week52Low == null ? "—" : inr(stock.week52Low)],
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <section aria-label="Price header" className="rounded-md border border-line bg-surface">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4 pb-2">
          <h1 className="text-xl font-extrabold tracking-tight">{stock.displayName}</h1>
          <span className="tnum text-xs text-muted">{stock.symbol}</span>
          {stock.sector != null && <span className="text-xs text-muted">{stock.sector}</span>}
          <span className="tnum tnum-strong ml-auto text-2xl">{inr(stock.lastPrice)}</span>
          <Num value={stock.netChange} strong />
          <ChangePill value={stock.pctChange} />
        </div>
        {tab === "overview" && (
          <dl className="grid grid-cols-2 gap-px p-4 pt-2 sm:grid-cols-3">
            {facts.map(([label, value]) => (
              <div key={label} className="py-1">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
                <dd className="tnum text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <DataStamp label={stock.syncedAt != null ? `live ${istDate(stock.syncedAt)}` : null} />
      </section>

      <div role="tablist" aria-label="Stock terminals" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "min-h-[36px] shrink-0 border-b-2 px-3 text-[13px] font-semibold",
              tab === t.id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <p className="px-1 text-xs text-muted">
          Six terminals above — peers, ratios, holdings, financials, events and filings. Signed-in terminals load
          with your session.
        </p>
      )}
      {tab === "peers" && <PeersTerminal user={user} checked={checked} symbol={upper} />}
      {tab === "ratios" && <RatiosTerminal user={user} checked={checked} symbol={upper} />}
      {tab === "holdings" && <HoldingsTerminal user={user} checked={checked} symbol={upper} />}
      {tab === "financials" && <FinancialsTerminal user={user} checked={checked} symbol={upper} />}
      {tab === "events" && <StockEventsTerminal user={user} checked={checked} symbol={upper} />}
      {tab === "docs" && <DocsTerminal user={user} checked={checked} symbol={upper} />}
    </div>
  );
}

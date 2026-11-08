"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Exchange } from "@/components/market/shared";
import { MarketStocksView } from "@/components/market/MarketStocksView";
import { IndicesTerminal } from "@/components/market/IndicesTerminal";
import { IpoBoard } from "@/components/market/IpoBoard";
import { cn } from "@/lib/cn";

type View = "stocks" | "indices" | "ipo";

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "stocks", label: "Stocks" },
  { id: "indices", label: "Indices" },
  { id: "ipo", label: "IPO" },
];

/** Markets: the tab shell. The boards live in components/market and are shared
 *  with the same-URL market-data wrappers. */
export default function MarketsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading markets…</div>}>
      <MarketsInner />
    </Suspense>
  );
}

function MarketsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const rawView = params.get("view") ?? "stocks";
  const view: View = rawView === "indices" || rawView === "ipo" ? rawView : "stocks";
  const rawEx = params.get("exchange") ?? "NSE";
  const exchange: Exchange = rawEx === "BSE" ? "BSE" : "NSE";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const tab = params.get("tab") ?? "all";

  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.replace(qs === "" ? "/markets" : `/markets?${qs}`, { scroll: false });
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div role="tablist" aria-label="Market views" className="flex gap-1 border-b border-line">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => set({ view: v.id, page: null, tab: null })}
            className={cn(
              "min-h-[36px] border-b-2 px-3 text-[13px] font-semibold",
              view === v.id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "stocks" && (
        <MarketStocksView
          exchange={exchange}
          page={page}
          onExchange={(e) => set({ exchange: e, page: null })}
          onPage={(p) => set({ page: String(p) })}
        />
      )}
      {view === "indices" && (
        <IndicesTerminal
          exchange={exchange}
          tab={tab}
          onExchange={(e) => set({ exchange: e })}
          onTab={(t) => set({ tab: t === "all" ? null : t })}
        />
      )}
      {view === "ipo" && <IpoBoard />}
    </div>
  );
}

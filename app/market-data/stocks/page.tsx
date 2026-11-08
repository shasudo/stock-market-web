"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MarketStocksView } from "@/components/market/MarketStocksView";
import type { Exchange } from "@/components/market/shared";

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const exchange: Exchange = params.get("exchange") === "BSE" ? "BSE" : "NSE";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.replace(qs === "" ? "/market-data/stocks" : `/market-data/stocks?${qs}`, { scroll: false });
  }
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">All stocks</h1>
        <p className="text-xs text-muted">Every listing on NSE and BSE.</p>
      </div>
      <MarketStocksView
        exchange={exchange}
        page={page}
        onExchange={(e) => set({ exchange: e, page: null })}
        onPage={(p) => set({ page: String(p) })}
      />
    </div>
  );
}

export default function StocksTerminalPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading…</div>}>
      <Inner />
    </Suspense>
  );
}

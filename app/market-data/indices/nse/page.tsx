"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IndicesTerminal } from "@/components/market/IndicesTerminal";
import type { Exchange } from "@/components/market/shared";

const EXCHANGE: Exchange = "NSE";
const GROUP: string | null = null;
const TITLE = "NSE indices";
const BLURB = "Breadth rows, 52-week ranges and valuation.";
const PATH = "/market-data/indices/nse";

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "all";
  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.replace(qs === "" ? PATH : `${PATH}?${qs}`, { scroll: false });
  }
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">{TITLE}</h1>
        <p className="text-xs text-muted">{BLURB}</p>
      </div>
      <IndicesTerminal
        exchange={EXCHANGE}
        tab={tab}
        group={GROUP}
        lockExchange
        onExchange={() => {}}
        onTab={(t) => set({ tab: t === "all" ? null : t })}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading…</div>}>
      <Inner />
    </Suspense>
  );
}

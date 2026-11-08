"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSession } from "@/components/mine/session";
import { RatiosTerminal } from "@/components/stock/PeersRatios";
import Link from "next/link";
import { EmptyState } from "@/components/DataTable";

/** Screens: symbol-first ratio lookup — the screener's answer page. */
function ScreensInner() {
  const router = useRouter();
  const params = useSearchParams();
  const symbol = (params.get("symbol") ?? "RELIANCE").toUpperCase();
  const { user, checked } = useSession();

  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.replace(qs === "" ? "/screens" : `/screens?${qs}`, { scroll: false });
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2 px-1">
        <h1 className="text-base font-semibold">Screens</h1>
        <p className="text-xs text-muted">Ratio-first lookup before you run a full screen.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={params.get("symbol") ?? "RELIANCE"}
          onChange={(e) => set({ symbol: e.target.value.toUpperCase() })}
          placeholder="Symbol — RELIANCE"
          aria-label="Symbol"
          className="tnum h-9 w-44 rounded-md border border-line bg-surface px-3 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <Link href={`/stock/${symbol}`} className="text-sm font-medium text-accent">
          Full quote →
        </Link>
      </div>
      {checked && user == null ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState
            title="Sign in to see ratios."
            action={
              <Link href="/login" className="text-sm font-medium text-accent">
                Sign in
              </Link>
            }
          />
        </div>
      ) : (
        <RatiosTerminal user={user} checked={checked} symbol={symbol} />
      )}
    </div>
  );
}

export default function ScreensPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl p-4 text-sm text-muted">Loading…</div>}>
      <ScreensInner />
    </Suspense>
  );
}

import { Suspense } from "react";
import { TradingBoard } from "@/components/mine/TradingBoard";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl p-4 text-sm text-muted">Loading…</div>}>
      <TradingBoard mode="live" title="Live trading" blurb="Real book — reconcile with your broker." />
    </Suspense>
  );
}

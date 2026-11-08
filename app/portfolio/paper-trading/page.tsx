import { Suspense } from "react";
import { TradingBoard } from "@/components/mine/TradingBoard";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl p-4 text-sm text-muted">Loading…</div>}>
      <TradingBoard mode="paper" title="Paper trading" blurb="Positions with play money, marked to LTP." />
    </Suspense>
  );
}

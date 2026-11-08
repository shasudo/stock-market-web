import { Suspense } from "react";
import { FnoStocksView } from "@/components/market/FnoStocksView";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading…</div>}>
      <FnoStocksView />
    </Suspense>
  );
}

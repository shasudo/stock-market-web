import { Suspense } from "react";
import { DealsView } from "@/components/market/DealsView";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading…</div>}>
      <DealsView kind="circuit" />
    </Suspense>
  );
}

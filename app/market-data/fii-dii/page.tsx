import { Suspense } from "react";
import { FlowsView } from "@/components/market/FlowsView";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading…</div>}>
      <FlowsView />
    </Suspense>
  );
}

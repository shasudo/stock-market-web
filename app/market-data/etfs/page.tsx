import { Suspense } from "react";
import { EtfView } from "@/components/market/EtfView";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading…</div>}>
      <EtfView />
    </Suspense>
  );
}

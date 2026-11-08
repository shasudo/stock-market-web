import { Suspense } from "react";
import { SectorView } from "@/components/market/SectorView";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading…</div>}>
      <SectorView by="sector" title="Sectoral indices" blurb="Sector rotation across both exchanges." />
    </Suspense>
  );
}

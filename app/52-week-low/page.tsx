import { Suspense } from "react";
import { ScanView, type ScanKind } from "@/components/ScanView";

const SCAN: ScanKind = "52-week-low";

/** Mirrors the old app route; the scan board is shared and terminal-styled. */
export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading…</div>}>
      <ScanView scan={SCAN} />
    </Suspense>
  );
}

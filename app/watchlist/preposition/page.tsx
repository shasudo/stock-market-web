import { Suspense } from "react";
import { WatchlistBoard } from "@/components/mine/WatchlistBoard";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl p-4 text-sm text-muted">Loading…</div>}>
      <WatchlistBoard listType="preposition" title="Preposition" blurb="Staged entries waiting for a trigger." />
    </Suspense>
  );
}

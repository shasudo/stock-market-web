import { Suspense } from "react";
import { IpoBoard } from "@/components/market/IpoBoard";

export default function IpoTerminalPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading…</div>}>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
        <div className="flex flex-wrap items-baseline gap-2 px-1">
          <h1 className="text-base font-semibold">IPO board</h1>
          <p className="text-xs text-muted">Pipeline and listed issues.</p>
        </div>
        <IpoBoard />
      </div>
    </Suspense>
  );
}

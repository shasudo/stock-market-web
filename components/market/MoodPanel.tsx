"use client";

import { apiGet } from "@/lib/api";
import type { MoodResponse } from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { DataStamp } from "../numbers";

/** Market mood: 0–100 gauge plus the breadth factors behind it. */
export function MoodPanel({ compact = false }: { compact?: boolean }) {
  const { data } = usePoll(() => apiGet<MoodResponse>("/market-data/mood-index"), 60_000);

  return (
    <section aria-label="Market mood" className="rounded-md border border-line bg-surface">
      <div className="flex items-baseline justify-between px-4 pt-3">
        <h2 className="text-sm font-semibold">Market mood</h2>
        {data?.zone != null && (
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold capitalize text-accent">
            {data.zone.replace(/([a-z])([A-Z])/g, "$1 $2")}
          </span>
        )}
      </div>
      <div className="px-4 py-3">
        {data?.score != null ? (
          <p className="tnum tnum-strong text-3xl">{data.score.toFixed(0)}</p>
        ) : (
          <p className="tnum text-3xl text-faint">—</p>
        )}
        <p className="mt-1 text-xs text-muted">Breadth-driven 0–100 gauge. Rebuilt as history lands.</p>
      </div>
      {!compact && (data?.factors ?? []).length > 0 && (
        <ul className="border-t border-line">
          {(data?.factors ?? []).map((f) => (
            <li key={f.key} className="flex items-baseline gap-3 px-4 py-2">
              <span className="w-32 shrink-0 text-xs font-medium text-muted">{f.label}</span>
              <span className="tnum tnum-strong w-12 shrink-0 text-right text-sm">{f.score.toFixed(0)}</span>
              <span className="truncate text-xs text-faint">{f.detail ?? ""}</span>
            </li>
          ))}
        </ul>
      )}
      <DataStamp label={data?.generatedAt ?? data?.asOf ?? null} />
    </section>
  );
}

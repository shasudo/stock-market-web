"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import apiClient, { isSuccessfulApiResponse } from "@/lib/api-client";

/** Per-symbol events. Shape mirrors the old route contract and Java's
 *  SymbolEvent record: corporate actions, deals, next dividend. */
export interface SymbolEvent {
  readonly id: string;
  readonly kind: "corporate-action" | "bulk-deal" | "block-deal" | "dividend";
  readonly date: string;
  readonly title: string;
  readonly detail: string | null;
}

export function formatEventDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const KIND_LABEL: Record<SymbolEvent["kind"], string> = {
  "corporate-action": "Corporate action",
  "bulk-deal": "Bulk deal",
  "block-deal": "Block deal",
  dividend: "Dividend",
};

export function useSymbolEvents(symbol: string): {
  readonly events: readonly SymbolEvent[];
  readonly loading: boolean;
} {
  const [state, setState] = useState<{
    symbol: string;
    events: readonly SymbolEvent[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiClient
      .get<unknown>(`/api/stocks/${encodeURIComponent(symbol)}/events`)
      .then((response) => {
        if (cancelled) return;
        const data = isSuccessfulApiResponse(response.data)
          ? response.data.data
          : null;
        const events =
          data &&
          typeof data === "object" &&
          Array.isArray((data as { events?: unknown }).events)
            ? (data as { events: unknown[] }).events.filter(
                (entry): entry is SymbolEvent =>
                  typeof entry === "object" &&
                  entry !== null &&
                  typeof (entry as SymbolEvent).id === "string" &&
                  typeof (entry as SymbolEvent).title === "string" &&
                  typeof (entry as SymbolEvent).date === "string",
              )
            : [];
        setState({ symbol, events });
      })
      .catch(() => {
        if (!cancelled) setState({ symbol, events: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (!state || state.symbol !== symbol) {
    return { events: [], loading: true };
  }
  return { events: state.events, loading: false };
}

/** TradingView-style docked News tab: per-symbol announcements and deals. */
export default function NewsPanel({ symbol }: { symbol: string }) {
  const { events, loading } = useSymbolEvents(symbol);

  return (
    <section aria-label="News" className="px-3 py-2">
      <p className="pb-1 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
        {symbol} · Announcements
      </p>
      {loading ? (
        <p className="py-4 text-[13px] text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <p className="py-4 text-[13px] text-muted-foreground">
          No announcements for {symbol} yet.
        </p>
      ) : (
        <ul className="flex flex-col">
          {events.map((event) => (
            <li
              key={event.id}
              className="border-b border-border py-2 last:border-0"
            >
              <p className="text-[12.5px] font-semibold leading-snug text-foreground">
                {event.title}
              </p>
              <p className="pt-0.5 text-[11.5px] text-muted-foreground">
                {KIND_LABEL[event.kind]} · {formatEventDate(event.date)}
                {event.detail ? ` · ${event.detail}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/calendar"
        className="mt-1 inline-block py-1 text-[12.5px] font-semibold text-primary hover:underline"
      >
        More events ›
      </Link>
    </section>
  );
}

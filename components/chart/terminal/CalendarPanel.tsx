"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { formatEventDate } from "./NewsPanel";

interface CorporateAction {
  readonly symbol: string;
  readonly companyName: string;
  readonly eventDate: string;
  readonly purpose: string;
  readonly recordDate: string | null;
}

function isCorporateAction(value: unknown): value is CorporateAction {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CorporateAction).symbol === "string" &&
    typeof (value as CorporateAction).eventDate === "string" &&
    typeof (value as CorporateAction).purpose === "string"
  );
}

interface CalendarPanelProps {
  readonly onSelect: (symbol: string) => void;
}

/** TradingView-style docked Calendar tab: upcoming corporate actions. */
export default function CalendarPanel({ onSelect }: CalendarPanelProps) {
  const [rows, setRows] = useState<readonly CorporateAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void apiClient
      .get<unknown>("/api/market-data/corporate-action")
      .then((response) => {
        if (cancelled) return;
        const data = (response.data ?? {}) as {
          events?: unknown;
        };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = Array.isArray(data.events)
          ? data.events
              .filter(isCorporateAction)
              .filter((event) => {
                const at = new Date(event.eventDate);
                return !Number.isNaN(at.getTime()) && at >= today;
              })
              .sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1))
              .slice(0, 20)
          : [];
        setRows(upcoming);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-label="Calendar" className="px-3 py-2">
      <p className="pb-1 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
        Upcoming actions
      </p>
      {loading ? (
        <p className="py-4 text-[13px] text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-[13px] text-muted-foreground">
          No upcoming corporate actions.
        </p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((event, index) => (
            <li
              key={`${event.symbol}-${event.eventDate}-${index}`}
              className="border-b border-border py-2 last:border-0"
            >
              <button
                type="button"
                onClick={() => onSelect(event.symbol)}
                className="block w-full text-left"
              >
                <p className="text-[12.5px] font-semibold leading-snug text-foreground hover:text-primary">
                  {event.symbol} · {event.purpose}
                </p>
                <p className="pt-0.5 text-[11.5px] text-muted-foreground">
                  {formatEventDate(event.eventDate)}
                  {event.recordDate ? ` · Record ${event.recordDate}` : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/calendar"
        className="mt-1 inline-block py-1 text-[12.5px] font-semibold text-primary hover:underline"
      >
        Open full calendar ›
      </Link>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import apiClient, { isSuccessfulApiResponse } from "@/lib/api-client";
import { DOWN_COLOR, UP_COLOR, formatNumber, signed } from "./ui";

interface Mover {
  readonly tradingSymbol: string;
  readonly cmp: number;
  readonly percentChange: number;
}

function isMover(value: unknown): value is Mover {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Mover).tradingSymbol === "string" &&
    typeof (value as Mover).cmp === "number" &&
    typeof (value as Mover).percentChange === "number"
  );
}

interface ScreenerPanelProps {
  readonly onSelect: (symbol: string) => void;
}

/** TradingView-style docked Screener tab: top movers plus full screener. */
export default function ScreenerPanel({ onSelect }: ScreenerPanelProps) {
  const [tab, setTab] = useState<"gainers" | "losers">("gainers");
  const [view, setView] = useState<{
    tab: "gainers" | "losers";
    rows: readonly Mover[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiClient
      .get<unknown>(`/api/stocks/${tab}?pageSize=10`)
      .then((response) => {
        if (cancelled) return;
        const data = isSuccessfulApiResponse(response.data)
          ? response.data.data
          : null;
        setView({
          tab,
          rows: Array.isArray(data) ? data.filter(isMover).slice(0, 10) : [],
        });
      })
      .catch(() => {
        if (!cancelled) setView({ tab, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const rows = view?.tab === tab ? view.rows : [];
  const loading = view?.tab !== tab;

  return (
    <section
      aria-label="Screener"
      className="flex min-h-0 flex-1 flex-col px-3 py-2"
    >
      <div
        role="tablist"
        aria-label="Movers"
        className="flex shrink-0 gap-1 rounded-lg bg-muted p-1"
      >
        {(
          [
            { id: "gainers", label: "Top gainers" },
            { id: "losers", label: "Top losers" },
          ] as const
        ).map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-[13px] font-semibold transition-colors ${
              tab === entry.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Movers aren&apos;t available right now.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {rows.map((row) => {
            const up = row.percentChange >= 0;
            return (
              <li key={row.tradingSymbol}>
                <button
                  type="button"
                  onClick={() => onSelect(row.tradingSymbol)}
                  className="grid w-full grid-cols-[1.4fr_1fr_0.8fr] items-center gap-1 rounded px-1 py-1.5 text-left hover:bg-muted"
                >
                  <span className="truncate text-[12.5px] font-semibold text-foreground">
                    {row.tradingSymbol}
                  </span>
                  <span className="text-right font-mono text-[12.5px] text-foreground">
                    {formatNumber(row.cmp)}
                  </span>
                  <span
                    className="text-right font-mono text-[12.5px] font-semibold"
                    style={{ color: up ? UP_COLOR : DOWN_COLOR }}
                  >
                    {signed(row.percentChange)}%
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        href="/screeners/screening-table"
        className="shrink-0 border-t border-border py-2 text-center text-[12.5px] font-semibold text-primary hover:underline"
      >
        Open full screener ›
      </Link>
    </section>
  );
}

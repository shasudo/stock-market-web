"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, History, Loader2 } from "lucide-react";
import type { BacktestResult } from "@/lib/screener/runner";
import { cn } from "@/lib/utils";

export const BACKTEST_RANGES: readonly { readonly label: string; readonly sessions: number }[] = [
  { label: "1 week", sessions: 5 },
  { label: "2 weeks", sessions: 10 },
  { label: "1 month", sessions: 21 },
  { label: "3 months", sessions: 63 },
  { label: "6 months", sessions: 126 },
];

const PALETTE = [
  "#60a5fa", "#f472b6", "#86efac", "#fbbf24", "#a78bfa", "#fb7185", "#facc15", "#2dd4bf",
  "#f87171", "#34d399", "#c084fc", "#38bdf8", "#fb923c", "#a3e635", "#e879f9", "#22d3ee",
  "#fca5a5", "#93c5fd", "#fde047", "#5eead4", "#d8b4fe", "#fdba74", "#bef264", "#67e8f9",
];

interface BacktestPanelProps {
  readonly result: BacktestResult | null;
  readonly loading: boolean;
  readonly sessions: number;
  readonly onSessionsChange: (sessions: number) => void;
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function BacktestPanel({ result, loading, sessions, onSessionsChange }: BacktestPanelProps) {
  const [view, setView] = useState<"bars" | "stocks">("bars");
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const sectors = useMemo(() => {
    const totals = new Map<string, number>();
    for (const day of result?.days ?? []) {
      for (const [sector, count] of Object.entries(day.sectors)) totals.set(sector, (totals.get(sector) ?? 0) + count);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([sector]) => sector);
  }, [result]);

  const color = (sector: string): string => PALETTE[sectors.indexOf(sector) % PALETTE.length]!;
  const days = result?.days ?? [];
  const visibleCount = (day: BacktestResult["days"][number]): number =>
    Object.entries(day.sectors).reduce((total, [sector, count]) => total + (hidden.has(sector) ? 0 : count), 0);
  const maxCount = Math.max(1, ...days.map(visibleCount));
  const selectedDay = days.find((day) => day.date === selected) ?? null;

  const downloadCsv = (): void => {
    const lines = [["Date", "Symbol", "Name", "Sector", "Close", "% Change"].join(",")];
    for (const day of days) {
      for (const stock of day.stocks) {
        lines.push([day.date, stock.symbol, `"${stock.name.replace(/"/g, '""')}"`, `"${stock.sector}"`, stock.close, stock.pctChange ?? ""].join(","));
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "backtest-history.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-foreground">
          <History className="h-4 w-4 text-purple" /> Backtest history
        </h2>
        <select
          value={sessions}
          onChange={(event) => onSessionsChange(Number(event.target.value))}
          className="rounded-lg border border-border px-2 py-1 text-xs font-bold text-foreground"
        >
          {BACKTEST_RANGES.map((range) => (
            <option key={range.sessions} value={range.sessions}>
              {range.label}
            </option>
          ))}
        </select>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {result && !loading && (
          <span className="text-[11px] font-semibold text-muted-foreground">computed in {(result.elapsedMs / 1000).toFixed(1)}s</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex rounded-lg bg-muted p-0.5">
            {(["bars", "stocks"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-bold capitalize",
                  view === value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={days.length === 0}
            onClick={downloadCsv}
            className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-border disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </button>
        </div>
      </div>
      <p className="mt-2 rounded-lg bg-purple/10 px-3 py-1.5 text-xs font-medium text-purple">
        Each bar is how many stocks this scan returned at that session&apos;s close. Click a bar to see the stocks.
      </p>

      {!result && !loading && (
        <div className="py-10 text-center text-sm text-muted-foreground">Run a backtest to see the scan&apos;s history.</div>
      )}

      {result && view === "bars" && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sectors.map((sector) => (
              <button
                key={sector}
                type="button"
                onClick={() => {
                  const next = new Set(hidden);
                  if (next.has(sector)) next.delete(sector);
                  else next.add(sector);
                  setHidden(next);
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border",
                  hidden.has(sector) && "opacity-40 line-through",
                )}
              >
                <span className="h-2.5 w-3.5 rounded-sm" style={{ background: color(sector) }} />
                {sector}
              </button>
            ))}
          </div>
          <div className="mt-3 flex h-56 items-end gap-[3px] border-b border-l border-border pl-1">
            {days.map((day) => {
              const total = visibleCount(day);
              return (
                <button
                  key={day.date}
                  type="button"
                  title={`${day.date}: ${total} stocks`}
                  onClick={() => setSelected(day.date === selected ? null : day.date)}
                  className={cn(
                    "group relative flex h-full min-w-0 flex-1 flex-col-reverse rounded-t-sm",
                    selected === day.date && "ring-2 ring-ring ring-offset-1 ring-offset-background",
                  )}
                >
                  {Object.entries(day.sectors)
                    .filter(([sector]) => !hidden.has(sector))
                    .sort((a, b) => sectors.indexOf(a[0]) - sectors.indexOf(b[0]))
                    .map(([sector, count]) => (
                      <span key={sector} style={{ height: `${(count / maxCount) * 100}%`, background: color(sector) }} />
                    ))}
                  <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground group-hover:block">
                    {total}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex gap-[3px] pl-1">
            {days.map((day, index) => (
              <span key={day.date} className="min-w-0 flex-1 truncate text-center text-[9px] font-semibold text-muted-foreground">
                {days.length <= 21 || index % Math.ceil(days.length / 15) === 0 ? formatDate(day.date) : ""}
              </span>
            ))}
          </div>
        </>
      )}

      {result && (view === "stocks" || selectedDay) && (
        <div className="mt-4 max-h-[420px] overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Sector</th>
                <th className="px-3 py-2 text-right">Close</th>
                <th className="px-3 py-2 text-right">% Chg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(selectedDay && view === "bars" ? [selectedDay] : [...days].reverse()).flatMap((day) =>
                day.stocks.map((stock) => (
                  <tr key={`${day.date}:${stock.symbol}`} className="hover:bg-primary/5">
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{day.date}</td>
                    <td className="px-3 py-1.5">
                      <Link href={`/chart/${encodeURIComponent(stock.symbol)}`} target="_blank" className="font-bold text-primary hover:underline">
                        {stock.symbol}
                      </Link>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-1.5 text-foreground">{stock.name}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{stock.sector}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{stock.close.toLocaleString("en-IN")}</td>
                    <td
                      className={cn(
                        "px-3 py-1.5 text-right font-mono font-bold",
                        (stock.pctChange ?? 0) >= 0 ? "text-success" : "text-error",
                      )}
                    >
                      {stock.pctChange === null ? "–" : `${stock.pctChange.toFixed(2)}%`}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { inr as fmtPrice, int as fmtNum, signedPct as fmtPctSigned } from "@/lib/format";
import type { PatternMatch, PatternResponse } from "@/lib/types";

const GROUPS = [
  { id: "chart-patterns", label: "Chart patterns" },
  { id: "candlesticks", label: "Candlesticks" },
] as const;

const ITEMS: Record<string, string[]> = {
  "chart-patterns": [
    "breakout", "breakdown", "gap-up", "gap-down", "support-breakout",
    "resistance-breakout", "double-top", "double-bottom", "head-shoulders",
    "inverse-head-shoulders", "flag", "triangle", "cup-handle", "rectangle",
  ],
  candlesticks: [
    "doji", "hammer", "inverted-hammer", "shooting-star", "hanging-man",
    "bullish-engulfing", "bearish-engulfing", "bullish-harami", "bearish-harami",
    "marubozu", "spinning-top", "three-white-soldiers", "three-black-crows",
    "tweezer-top", "tweezer-bottom",
  ],
};

function pretty(id: string): string {
  return id.split("-").map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(" ");
}

function MatchRow({ m }: { m: PatternMatch }) {
  const up = m.pctChange >= 0;
  return (
    <Link
      href={`/stock/${encodeURIComponent(m.tradingSymbol)}`}
      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-line px-3 py-2 last:border-0 hover:bg-surface"
    >
      <span className="min-w-0">
        <span className="block truncate font-mono text-sm font-semibold">{m.tradingSymbol}</span>
        <span className="block truncate text-xs text-faint">
          {[m.companyName, m.exchange, ...(m.matchedTimeframes ?? [])].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="text-right font-mono text-sm tabular-nums">{fmtPrice(m.lastPrice)}</span>
      <span className={`text-right font-mono text-sm tabular-nums ${up ? "text-up" : "text-down"}`}>
        {fmtPctSigned(m.pctChange)}
        <span className="block text-[11px] text-faint">Vol {fmtNum(m.volume)}</span>
      </span>
    </Link>
  );
}

/** Pattern screener: pick a group + pattern, POST scan, list matches. */
export function PatternScreener() {
  const [groupId, setGroupId] = useState<string>("chart-patterns");
  const [itemId, setItemId] = useState<string>("breakout");
  const [result, setResult] = useState<PatternResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<PatternResponse>("/market/pattern-companies", { groupId, itemId });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={run} className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="block text-[11px] uppercase tracking-wider text-faint">Group</span>
          <select
            value={groupId}
            onChange={(e) => {
              const g = e.target.value;
              setGroupId(g);
              setItemId(ITEMS[g]?.[0] ?? "");
            }}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          >
            {GROUPS.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] uppercase tracking-wider text-faint">Pattern</span>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="max-w-64 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          >
            {(ITEMS[groupId] ?? []).map((id) => (
              <option key={id} value={id}>{pretty(id)}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Scanning…" : "Scan"}
        </button>
      </form>

      {error ? <p className="text-sm text-down">{error}</p> : null}

      {result ? (
        <section className="overflow-hidden rounded-xl border border-line bg-surface" aria-label="Matches">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <p className="text-sm font-semibold">
              {result.matchCount} match{result.matchCount === 1 ? "" : "es"}
              {result.truncated ? " (truncated)" : ""}
            </p>
            <p className="font-mono text-xs tabular-nums text-faint">Scanned {result.scanned}</p>
          </div>
          {!result.supported ? (
            <p className="px-3 py-8 text-center text-sm text-faint">
              {result.message ?? "This pattern is not supported yet."}
            </p>
          ) : result.matches.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-faint">No matches right now.</p>
          ) : (
            <div>{result.matches.map((m) => <MatchRow key={`${m.securityId}-${m.tradingSymbol}`} m={m} />)}</div>
          )}
        </section>
      ) : null}
    </div>
  );
}

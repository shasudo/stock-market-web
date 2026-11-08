"use client";

import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { ApiError } from "@/lib/types";
import { inr as fmtPrice, int as fmtNum, signedPct as fmtPctSigned } from "@/lib/format";
import type { BacktestRun, BacktestTrade, StrategyDef } from "@/lib/types";
import { EmptyState } from "@/components/DataTable";
import { SessionGate, useSession } from "@/components/mine/session";

const DEFAULT_LEGS = JSON.stringify({ type: "screener", rules: [] }, null, 2);

function errText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : "Request failed.";
}

function Trades({ trades }: { trades: BacktestTrade[] }) {
  if (trades.length === 0) return <p className="py-3 text-center text-xs text-faint">No trades.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-140 text-xs">
        <thead>
          <tr className="border-b border-line text-left uppercase tracking-wider text-faint">
            <th className="px-2 py-1.5 font-medium">Entry</th>
            <th className="px-2 py-1.5 text-right font-medium">In</th>
            <th className="px-2 py-1.5 text-right font-medium">Exit</th>
            <th className="px-2 py-1.5 text-right font-medium">Out</th>
            <th className="px-2 py-1.5 text-right font-medium">Qty</th>
            <th className="px-2 py-1.5 text-right font-medium">P&amp;L</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {trades.map((t, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              <td className="px-2 py-1.5">{t.entryDate ?? "—"}</td>
              <td className="px-2 py-1.5 text-right">{fmtPrice(t.entryPrice)}</td>
              <td className="px-2 py-1.5">{t.exitDate ?? "—"}</td>
              <td className="px-2 py-1.5 text-right">{fmtPrice(t.exitPrice)}</td>
              <td className="px-2 py-1.5 text-right">{fmtNum(t.quantity)}</td>
              <td className={`px-2 py-1.5 text-right ${(t.pnl ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                {t.pnl == null ? "—" : `${fmtNum(t.pnl)} (${fmtPctSigned(t.pnlPercent)})`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RunCard({ run }: { run: BacktestRun }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(run.summary ?? {});
  return (
    <div className="rounded-lg border border-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left"
      >
        <span className="font-mono text-xs font-semibold">{run.symbol ?? run.id}</span>
        <span className="font-mono text-xs tabular-nums text-faint">
          {run.fromDate ?? "?"} → {run.toDate ?? "?"}
        </span>
        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
          {run.status ?? "done"}
        </span>
        <span className="ml-auto font-mono text-xs tabular-nums text-faint">{run.trades.length} trades</span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-line px-3 py-2">
          {entries.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              {entries.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2">
                  <dt className="text-[11px] text-faint">{k}</dt>
                  <dd className="font-mono text-xs tabular-nums">{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <Trades trades={run.trades} />
        </div>
      ) : null}
    </div>
  );
}

function StrategyCard({ strategy, onDeleted }: { strategy: StrategyDef; onDeleted: () => void }) {
  const [runs, setRuns] = useState<BacktestRun[] | null>(null);
  const [showRuns, setShowRuns] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ symbol: "NIFTY", fromDate: "", toDate: "", initialCapital: "100000" });

  const loadRuns = useCallback(async () => {
    try {
      const res = await apiGet<{ runs: BacktestRun[] }>(
        `/backtest-runs?strategyId=${encodeURIComponent(strategy.id)}`,
      );
      setRuns(res.runs);
    } catch (err) {
      setError(errText(err));
    }
  }, [strategy.id]);

  useEffect(() => {
    if (showRuns && runs == null) void loadRuns();
  }, [showRuns, runs, loadRuns]);

  async function runBacktest(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    try {
      await apiPost<{ run: BacktestRun }>("/backtest-runs", {
        strategyId: strategy.id,
        symbol: form.symbol.trim().toUpperCase(),
        fromDate: form.fromDate,
        toDate: form.toDate,
        initialCapital: Number(form.initialCapital),
      });
      await loadRuns();
    } catch (err) {
      setError(errText(err));
    } finally {
      setRunning(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete strategy "${strategy.name}"?`)) return;
    try {
      await apiDelete<{ deleted: boolean }>(`/strategies/${encodeURIComponent(strategy.id)}`, {});
      onDeleted();
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">{strategy.name}</p>
        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-muted">
          {strategy.timeframe ?? "?"} · {strategy.instrument ?? "?"} · {strategy.tradingType ?? "?"}
        </span>
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setShowRuns((s) => !s)}
            className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-fg"
          >
            {showRuns ? "Hide runs" : "Backtests"}
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            className="rounded-md border border-line px-2.5 py-1 text-xs text-down"
          >
            Delete
          </button>
        </span>
      </div>

      {error ? <p className="mt-2 text-xs text-down">{error}</p> : null}

      {showRuns ? (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <form onSubmit={runBacktest} className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wider text-faint">Symbol</span>
              <input
                value={form.symbol}
                onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                required
                className="w-28 rounded-md border border-line bg-raised px-2 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wider text-faint">From</span>
              <input
                type="date"
                value={form.fromDate}
                onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))}
                required
                className="rounded-md border border-line bg-raised px-2 py-1.5 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wider text-faint">To</span>
              <input
                type="date"
                value={form.toDate}
                onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
                required
                className="rounded-md border border-line bg-raised px-2 py-1.5 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wider text-faint">Capital ₹</span>
              <input
                type="number"
                min={1}
                value={form.initialCapital}
                onChange={(e) => setForm((f) => ({ ...f, initialCapital: e.target.value }))}
                required
                className="w-28 rounded-md border border-line bg-raised px-2 py-1.5 font-mono text-xs tabular-nums"
              />
            </label>
            <button
              type="submit"
              disabled={running}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {running ? "Running…" : "Run backtest"}
            </button>
          </form>
          {runs == null ? (
            <div className="skeleton h-16 w-full rounded-lg" aria-label="Loading runs" />
          ) : runs.length === 0 ? (
            <p className="py-3 text-center text-xs text-faint">No runs yet — run one above.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => <RunCard key={r.id} run={r} />)}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Standalone strategy create form (reused by the builder page). */
export function StrategyCreateForm({ onCreated }: { onCreated: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", timeframe: "D", instrument: "NSE", tradingType: "swing", legs: DEFAULT_LEGS });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      let legs: unknown;
      try {
        legs = JSON.parse(form.legs) as unknown;
      } catch {
        throw new Error("Legs must be valid JSON.");
      }
      await apiPost<{ strategy: StrategyDef }>("/strategies", {
        name: form.name.trim(),
        timeframe: form.timeframe.trim(),
        instrument: form.instrument.trim(),
        tradingType: form.tradingType.trim(),
        legs,
      });
      setForm({ name: "", timeframe: "D", instrument: "NSE", tradingType: "swing", legs: DEFAULT_LEGS });
      onCreated();
    } catch (err) {
      setError(errText(err));
    } finally {
      setCreating(false);
    }
  }

  return (
        <form onSubmit={create} className="space-y-2 rounded-xl border border-line bg-surface p-3">
          <p className="text-sm font-semibold">New strategy</p>
          <div className="grid gap-2 sm:grid-cols-4">
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wider text-faint">Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                maxLength={120}
                placeholder="Breakout swing"
                className="w-full rounded-md border border-line bg-raised px-2 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wider text-faint">Timeframe</span>
              <input
                value={form.timeframe}
                onChange={(e) => setForm((f) => ({ ...f, timeframe: e.target.value }))}
                required
                maxLength={40}
                className="w-full rounded-md border border-line bg-raised px-2 py-1.5 font-mono text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wider text-faint">Instrument</span>
              <input
                value={form.instrument}
                onChange={(e) => setForm((f) => ({ ...f, instrument: e.target.value }))}
                required
                maxLength={40}
                className="w-full rounded-md border border-line bg-raised px-2 py-1.5 font-mono text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wider text-faint">Trading type</span>
              <input
                value={form.tradingType}
                onChange={(e) => setForm((f) => ({ ...f, tradingType: e.target.value }))}
                required
                maxLength={40}
                className="w-full rounded-md border border-line bg-raised px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="block text-[11px] uppercase tracking-wider text-faint">Legs (JSON)</span>
            <textarea
              value={form.legs}
              onChange={(e) => setForm((f) => ({ ...f, legs: e.target.value }))}
              required
              rows={3}
              spellCheck={false}
              className="w-full rounded-md border border-line bg-raised px-2 py-1.5 font-mono text-xs"
            />
          </label>
          {error ? <p className="text-xs text-down">{error}</p> : null}
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {creating ? "Saving…" : "Save strategy"}
          </button>
        </form>
  );
}

/** Strategies + backtests board. Auth-gated. */
export function StrategiesBoard({ title }: { title: string }) {
  const { user, checked } = useSession();
  const [strategies, setStrategies] = useState<StrategyDef[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ strategies: StrategyDef[] }>("/strategies");
      setStrategies(res.strategies);
    } catch (err) {
      setError(errText(err));
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  return (
    <SessionGate checked={checked} user={user} title={title}>
      <div className="space-y-4">
        <StrategyCreateForm onCreated={() => void load()} />
        {error ? <p className="text-xs text-down">{error}</p> : null}
        {strategies == null ? (
          <div className="space-y-2" aria-label="Loading strategies">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 w-full rounded-xl" />)}
          </div>
        ) : strategies.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface">
            <EmptyState title="No strategies yet." />
          </div>
        ) : (
          <div className="space-y-3">
            {strategies.map((s) => <StrategyCard key={s.id} strategy={s} onDeleted={() => void load()} />)}
          </div>
        )}
      </div>
    </SessionGate>
  );
}

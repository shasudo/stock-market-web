"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { ApiError } from "@/lib/types";
import { int as fmtNum } from "@/lib/format";
import type { BacktestRun, StrategyDef } from "@/lib/types";
import { EmptyState } from "@/components/DataTable";
import { SessionGate, useSession } from "@/components/mine/session";
import { RunCard, StrategyCreateForm } from "@/components/mine/StrategiesBoard";

function errText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : "Request failed.";
}

interface StrategyRuns {
  strategy: StrategyDef;
  runs: BacktestRun[];
}

function useAllRuns(user: unknown) {
  const [data, setData] = useState<StrategyRuns[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ strategies: StrategyDef[] }>("/strategies");
      const grouped = await Promise.all(
        res.strategies.map(async (strategy) => {
          try {
            const r = await apiGet<{ runs: BacktestRun[] }>(
              `/backtest-runs?strategyId=${encodeURIComponent(strategy.id)}`,
            );
            return { strategy, runs: r.runs };
          } catch {
            return { strategy, runs: [] as BacktestRun[] };
          }
        }),
      );
      setData(grouped);
    } catch (err) {
      setError(errText(err));
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  return { data, error, load };
}

function RunsSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading runs">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-lg" />)}
    </div>
  );
}

/** Builder page board: create form only; runs live with the strategies. */
export function StrategyBuilderBoard({ title }: { title: string }) {
  const { user, checked } = useSession();
  const [saved, setSaved] = useState(0);
  return (
    <SessionGate checked={checked} user={user} title={title}>
      <div className="space-y-3">
        <StrategyCreateForm onCreated={() => setSaved((n) => n + 1)} />
        {saved > 0 ? (
          <p className="text-xs text-muted">
            Saved. <Link href="/screeners/vgsreddy-strategies" className="text-accent">Open strategies to run backtests →</Link>
          </p>
        ) : null}
      </div>
    </SessionGate>
  );
}

/** Flat list of every backtest run across strategies. */
export function AllRunsBoard({ title }: { title: string }) {
  const { user, checked } = useSession();
  const { data, error } = useAllRuns(user);
  const flat = (data ?? []).flatMap((g) =>
    g.runs.map((run) => ({ strategy: g.strategy, run })),
  );
  return (
    <SessionGate checked={checked} user={user} title={title}>
      {error ? <p className="text-xs text-down">{error}</p> : null}
      {data == null ? (
        <RunsSkeleton />
      ) : flat.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState title="No backtest runs yet." />
        </div>
      ) : (
        <div className="space-y-2">
          {flat.map(({ strategy, run }) => (
            <div key={run.id} className="space-y-1">
              <p className="px-1 text-[11px] uppercase tracking-wider text-faint">{strategy.name}</p>
              <RunCard run={run} />
            </div>
          ))}
        </div>
      )}
    </SessionGate>
  );
}

/** Runs grouped under each strategy heading. */
export function GroupedRunsBoard({ title }: { title: string }) {
  const { user, checked } = useSession();
  const { data, error } = useAllRuns(user);
  return (
    <SessionGate checked={checked} user={user} title={title}>
      {error ? <p className="text-xs text-down">{error}</p> : null}
      {data == null ? (
        <RunsSkeleton />
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState title="No strategies yet." />
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((g) => (
            <section key={g.strategy.id} aria-label={g.strategy.name}>
              <p className="mb-1.5 px-1 text-sm font-semibold">
                {g.strategy.name}
                <span className="ml-2 font-mono text-xs font-normal tabular-nums text-faint">
                  {g.runs.length} run{g.runs.length === 1 ? "" : "s"}
                </span>
              </p>
              {g.runs.length === 0 ? (
                <p className="rounded-lg border border-line bg-surface px-3 py-3 text-center text-xs text-faint">
                  No runs for this strategy.
                </p>
              ) : (
                <div className="space-y-2">
                  {g.runs.map((r) => <RunCard key={r.id} run={r} />)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </SessionGate>
  );
}

/** Reports: per-strategy run/trade counts. */
export function ReportsBoard({ title }: { title: string }) {
  const { user, checked } = useSession();
  const { data, error } = useAllRuns(user);
  const totals = (data ?? []).reduce(
    (acc, g) => ({
      runs: acc.runs + g.runs.length,
      trades: acc.trades + g.runs.reduce((n, r) => n + r.trades.length, 0),
    }),
    { runs: 0, trades: 0 },
  );
  return (
    <SessionGate checked={checked} user={user} title={title}>
      {error ? <p className="text-xs text-down">{error}</p> : null}
      {data == null ? (
        <RunsSkeleton />
      ) : (
        <div className="space-y-3">
          <section className="grid grid-cols-3 gap-2" aria-label="Totals">
            {[
              ["Strategies", data.length],
              ["Runs", totals.runs],
              ["Trades", totals.trades],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-line bg-surface px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-faint">{label}</p>
                <p className="font-mono text-lg font-bold tabular-nums">{fmtNum(value as number)}</p>
              </div>
            ))}
          </section>
          <section className="overflow-hidden rounded-xl border border-line bg-surface" aria-label="By strategy">
            {data.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-faint">Nothing to report yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
                    <th className="px-3 py-2 font-medium">Strategy</th>
                    <th className="px-3 py-2 text-right font-medium">Runs</th>
                    <th className="px-3 py-2 text-right font-medium">Trades</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {data.map((g) => (
                    <tr key={g.strategy.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 font-sans font-semibold">{g.strategy.name}</td>
                      <td className="px-3 py-2 text-right">{fmtNum(g.runs.length)}</td>
                      <td className="px-3 py-2 text-right">
                        {fmtNum(g.runs.reduce((n, r) => n + r.trades.length, 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </SessionGate>
  );
}

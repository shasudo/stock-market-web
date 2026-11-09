"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileBarChart2,
  ChevronDown,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/common";
import { getAxiosErrorMessage } from "@/lib/api-client";
import { fetchStrategies, type StrategyDefinitionDTO } from "@/lib/strategy-client";
import { fetchBacktestRuns, type BacktestRunDTO } from "@/lib/backtest-client";

interface StrategyReport {
  readonly strategy: StrategyDefinitionDTO;
  readonly runs: BacktestRunDTO[];
}

interface ReportAggregate {
  readonly totalRuns: number;
  readonly totalTrades: number;
  readonly totalPnl: number;
  readonly avgWinRate: number | null;
  readonly lastRunAt: string | null;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function aggregate(runs: BacktestRunDTO[]): ReportAggregate {
  const withSummary = runs.filter((run) => run.summary !== null);
  const totalTrades = withSummary.reduce(
    (sum, run) => sum + (run.summary?.totalTrades ?? 0),
    0,
  );
  const totalPnl = withSummary.reduce(
    (sum, run) => sum + (run.summary?.totalPnl ?? 0),
    0,
  );
  const winRates = withSummary
    .map((run) => run.summary?.winRate)
    .filter((rate): rate is number => rate !== null && rate !== undefined);
  const avgWinRate =
    winRates.length > 0
      ? winRates.reduce((sum, rate) => sum + rate, 0) / winRates.length
      : null;
  const lastRunAt = runs.reduce<string | null>(
    (latest, run) => (!latest || run.createdAt > latest ? run.createdAt : latest),
    null,
  );

  return { totalRuns: runs.length, totalTrades, totalPnl, avgWinRate, lastRunAt };
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "default";
}) {
  const toneClass =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-error"
        : "text-foreground";

  return (
    <div className="rounded-2xl border border-border/90 bg-card p-5 shadow-xs">
      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-mono font-bold num-font ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const [reports, setReports] = useState<StrategyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    const load = async (): Promise<void> => {
      try {
        const strategies = await fetchStrategies();
        const runsByStrategy = await Promise.all(
          strategies.map((strategy) =>
            fetchBacktestRuns(strategy.id).catch(() => [] as BacktestRunDTO[]),
          ),
        );
        if (!isCurrent) return;
        setReports(
          strategies.map((strategy, index) => ({
            strategy,
            runs: runsByStrategy[index],
          })),
        );
        setError(null);
      } catch (err: unknown) {
        if (isCurrent) {
          setError(getAxiosErrorMessage(err, "Could not load reports."));
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    void load();
    return () => {
      isCurrent = false;
    };
  }, []);

  const allRuns = reports.flatMap((report) => report.runs);
  const overall = aggregate(allRuns);

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <PageHeader
          title="Strategy Performance Reports"
          description="Aggregated quantitative backtest analytics, trade win rates, and cumulative P&L across all strategies"
          icon={FileBarChart2}
        />

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-xs text-error font-medium"
          >
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-border/90 bg-card p-12 text-center shadow-xs">
            <p className="text-muted-foreground mb-4 text-xs">
              No strategies configured yet — build your first quantitative model to start tracking reports.
            </p>
            <Link
              href="/analysis/strategy-builder"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-primary/20 shadow-xs hover:bg-primary/90 transition-all"
            >
              Go to Strategy Builder <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <>
            {/* Aggregate Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <SummaryCard label="Configured Strategies" value={String(reports.length)} />
              <SummaryCard label="Total Backtest Runs" value={String(overall.totalRuns)} />
              <SummaryCard
                label="Cumulative P&L"
                value={formatCurrency(overall.totalPnl)}
                tone={
                  overall.totalPnl > 0
                    ? "positive"
                    : overall.totalPnl < 0
                      ? "negative"
                      : "default"
                }
              />
              <SummaryCard
                label="Portfolio Win Rate"
                value={formatPercent(overall.avgWinRate)}
                tone={overall.avgWinRate && overall.avgWinRate >= 50 ? "positive" : "default"}
              />
            </div>

            {/* Performance Table */}
            <div className="rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
                    <tr className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider select-none">
                      <th className="px-3.5 py-3">Strategy Name</th>
                      <th className="px-3 py-3">Asset</th>
                      <th className="px-3 py-3">Type</th>
                      <th className="px-3 py-3 text-right">Runs</th>
                      <th className="px-3 py-3 text-right">Trades</th>
                      <th className="px-3 py-3 text-right">Total P&amp;L</th>
                      <th className="px-3 py-3 text-right">Avg Win Rate</th>
                      <th className="px-3 py-3 text-right">Last Execution</th>
                      <th className="px-3.5 py-3 text-center w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reports.map(({ strategy, runs }) => {
                      const report = aggregate(runs);
                      const isExpanded = expandedId === strategy.id;
                      const isProfit = report.totalPnl >= 0;

                      return (
                        <Fragment key={strategy.id}>
                          <tr
                            onClick={() =>
                              setExpandedId(isExpanded ? null : strategy.id)
                            }
                            className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group cursor-pointer"
                          >
                            <td className="px-3.5 py-2.5 font-bold text-foreground group-hover:text-primary transition-colors whitespace-nowrap">
                              {strategy.name}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {strategy.instrument}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {strategy.tradingType}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-muted-foreground num-font whitespace-nowrap">
                              {report.totalRuns}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-muted-foreground num-font whitespace-nowrap">
                              {report.totalTrades}
                            </td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font ${
                                  isProfit
                                    ? "bg-success/10 text-success border-success/30"
                                    : "bg-error/10 text-error border-error/30"
                                }`}
                              >
                                {isProfit ? "+" : ""}
                                {formatCurrency(report.totalPnl)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-foreground num-font whitespace-nowrap">
                              {formatPercent(report.avgWinRate)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                              {formatDate(report.lastRunAt)}
                            </td>
                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                              <ChevronDown
                                className={`h-4 w-4 mx-auto transition-transform text-muted-foreground group-hover:text-primary ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${strategy.id}-detail`}>
                              <td colSpan={9} className="bg-muted/60 p-5 border-b border-border">
                                {runs.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    No backtest runs recorded for this strategy yet.
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {runs.map((run) => {
                                      const pnl = run.summary?.totalPnl ?? 0;
                                      const runPositive = pnl >= 0;
                                      return (
                                        <div
                                          key={run.id}
                                          className="flex items-center justify-between rounded-xl border border-border/90 bg-card px-4 py-2.5 text-xs shadow-xs"
                                        >
                                          <span className="flex items-center gap-2 font-bold text-foreground">
                                            {runPositive ? (
                                              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                                            ) : (
                                              <TrendingDown className="h-3.5 w-3.5 text-error" />
                                            )}
                                            {run.symbol} · {run.fromDate} → {run.toDate}
                                          </span>
                                          <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font ${
                                              runPositive
                                                ? "bg-success/10 text-success border-success/30"
                                                : "bg-error/10 text-error border-error/30"
                                            }`}
                                          >
                                            {runPositive ? "+" : ""}
                                            {formatCurrency(pnl)} (
                                            {formatPercent(
                                              run.summary?.totalPnlPercent ?? null,
                                            )}
                                            )
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <Link
                                  href="/analysis/strategy-back-test"
                                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary transition-colors"
                                >
                                  Execute new backtest for this strategy <ArrowRight className="w-3 h-3" />
                                </Link>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


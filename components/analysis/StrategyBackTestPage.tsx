"use client";

import { useEffect, useState } from "react";
import {
  Download,
  LineChart,
  Loader2,
  Play,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/common";
import { getAxiosErrorMessage } from "@/lib/api-client";
import {
  fetchBacktestRuns,
  runBacktest,
  type BacktestRunDTO,
  type BacktestTradeDTO,
} from "@/lib/backtest-client";
import { fetchStrategies, type StrategyDefinitionDTO } from "@/lib/strategy-client";

function defaultFromDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function escapeCsvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadTradesCsv(run: BacktestRunDTO): void {
  const headers = [
    "Entry Date",
    "Entry Price",
    "Exit Date",
    "Exit Price",
    "Exit Reason",
    "Quantity",
    "P&L",
    "P&L %",
  ];
  const rows = run.trades.map((trade) =>
    [
      trade.entryDate,
      trade.entryPrice,
      trade.exitDate ?? "",
      trade.exitPrice ?? "",
      trade.exitReason ?? "",
      trade.quantity.toFixed(4),
      trade.pnl?.toFixed(2) ?? "",
      trade.pnlPercent?.toFixed(2) ?? "",
    ]
      .map(escapeCsvCell)
      .join(","),
  );
  const csvContent = [headers.join(","), ...rows].join("\n");
  const downloadUrl = URL.createObjectURL(
    new Blob([csvContent], { type: "text/csv;charset=utf-8" }),
  );
  const downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;
  downloadLink.download = `${run.symbol}-backtest-${run.fromDate}-to-${run.toDate}.csv`;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(downloadUrl);
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-error"
        : "text-foreground";
  return (
    <div className="rounded-2xl border border-border/90 bg-card p-4 shadow-xs">
      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-mono font-bold num-font ${toneClass}`}>{value}</p>
    </div>
  );
}

function TradeTable({ trades }: { trades: readonly BacktestTradeDTO[] }) {
  if (trades.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-8 text-center">
        No trades were triggered in this backtesting window.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/90 bg-card shadow-xs scrollbar-thin">
      <table className="w-full text-left border-collapse text-xs">
        <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
          <tr className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider select-none">
            <th className="py-2.5 px-3">Entry Date</th>
            <th className="py-2.5 px-3 text-right">Entry Price</th>
            <th className="py-2.5 px-3">Exit Date</th>
            <th className="py-2.5 px-3 text-right">Exit Price</th>
            <th className="py-2.5 px-3">Exit Reason</th>
            <th className="py-2.5 px-3 text-right">Qty</th>
            <th className="py-2.5 px-3 text-right">Net P&amp;L</th>
            <th className="py-2.5 px-3 text-right">P&amp;L %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {trades.map((trade, index) => {
            const isProfit = (trade.pnl ?? 0) >= 0;
            return (
              <tr
                key={`${trade.entryDate}-${index}`}
                className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
              >
                <td className="py-2.5 px-3 font-mono text-muted-foreground num-font whitespace-nowrap">
                  {trade.entryDate}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground num-font whitespace-nowrap">
                  ₹{formatCurrency(trade.entryPrice)}
                </td>
                <td className="py-2.5 px-3 font-mono text-muted-foreground num-font whitespace-nowrap">
                  {trade.exitDate ?? "—"}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground num-font whitespace-nowrap">
                  {trade.exitPrice !== null ? `₹${formatCurrency(trade.exitPrice)}` : "—"}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground font-medium whitespace-nowrap">
                  {trade.exitReason ?? "—"}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                  {trade.quantity.toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  {trade.pnl !== null ? (
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font ${
                        isProfit
                          ? "bg-success/10 text-success border-success/30"
                          : "bg-error/10 text-error border-error/30"
                      }`}
                    >
                      {isProfit ? "+" : ""}
                      ₹{formatCurrency(trade.pnl)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  {trade.pnlPercent !== null ? (
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font ${
                        isProfit
                          ? "bg-success/10 text-success border-success/30"
                          : "bg-error/10 text-error border-error/30"
                      }`}
                    >
                      {formatPercent(trade.pnlPercent)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RunResult({ run }: { run: BacktestRunDTO }) {
  const summary = run.summary;
  return (
    <div className="rounded-2xl border border-border/90 bg-card p-6 shadow-xs">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-extrabold text-foreground text-lg">
            {run.symbol} · {run.fromDate} → {run.toDate}
          </h3>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">
            Initial capital ₹{formatCurrency(run.initialCapital)}
          </p>
        </div>
        <button
          onClick={() => downloadTradesCsv(run)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground hover:bg-muted shadow-xs transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Export Trades CSV
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <SummaryCard label="Executed Trades" value={String(summary.totalTrades)} />
          <SummaryCard
            label="Win Ratio"
            value={summary.winRate !== null ? `${summary.winRate.toFixed(1)}%` : "—"}
            tone={summary.winRate && summary.winRate >= 50 ? "positive" : "default"}
          />
          <SummaryCard
            label="Total P&L"
            value={`₹${formatCurrency(summary.totalPnl)}`}
            tone={summary.totalPnl > 0 ? "positive" : summary.totalPnl < 0 ? "negative" : "default"}
          />
          <SummaryCard
            label="P&L Return"
            value={formatPercent(summary.totalPnlPercent)}
            tone={
              summary.totalPnlPercent > 0
                ? "positive"
                : summary.totalPnlPercent < 0
                  ? "negative"
                  : "default"
            }
          />
          <SummaryCard
            label="Max Drawdown"
            value={
              summary.maxDrawdownPercent !== null
                ? `${summary.maxDrawdownPercent.toFixed(2)}%`
                : "—"
            }
            tone="negative"
          />
          <SummaryCard label="Ending Capital" value={`₹${formatCurrency(summary.finalCapital)}`} />
        </div>
      )}

      <TradeTable trades={run.trades} />
    </div>
  );
}

export default function StrategyBackTestPage() {
  const [strategies, setStrategies] = useState<StrategyDefinitionDTO[]>([]);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState("");
  const [symbol, setSymbol] = useState("RELIANCE");
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [initialCapital, setInitialCapital] = useState(100_000);

  const [isRunning, setIsRunning] = useState(false);
  const [latestRun, setLatestRun] = useState<BacktestRunDTO | null>(null);

  const [pastRuns, setPastRuns] = useState<BacktestRunDTO[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrentRequest = true;
    const load = async (): Promise<void> => {
      try {
        const list = await fetchStrategies();
        if (!isCurrentRequest) return;
        setStrategies(list);
        setStrategiesError(null);
        setSelectedStrategyId((current) => current || list[0]?.id || "");
      } catch (error: unknown) {
        if (!isCurrentRequest) return;
        setStrategiesError(getAxiosErrorMessage(error, "Could not load strategies."));
      }
    };
    void load();
    return () => {
      isCurrentRequest = false;
    };
  }, []);

  useEffect(() => {
    let isCurrentRequest = true;
    const load = async (): Promise<void> => {
      if (!selectedStrategyId) {
        setPastRuns([]);
        return;
      }
      try {
        const runs = await fetchBacktestRuns(selectedStrategyId);
        if (isCurrentRequest) setPastRuns(runs);
      } catch {
        if (isCurrentRequest) setPastRuns([]);
      }
    };
    void load();
    return () => {
      isCurrentRequest = false;
    };
  }, [selectedStrategyId, latestRun]);

  const handleRun = async (): Promise<void> => {
    if (!selectedStrategyId) {
      toast.error("Pick a strategy first");
      return;
    }
    if (!symbol.trim()) {
      toast.error("Enter an equity symbol");
      return;
    }

    setIsRunning(true);
    try {
      const run = await runBacktest({
        strategyId: selectedStrategyId,
        symbol: symbol.trim().toUpperCase(),
        fromDate,
        toDate,
        initialCapital,
      });
      setLatestRun(run);
      toast.success("Backtest completed");
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Backtest failed"));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <PageHeader
          title="Quantitative Strategy Backtest"
          description="Simulate strategy execution against real historical equity data and inspect complete trade ledger and drawdown metrics"
          icon={LineChart}
        />

        {strategiesError && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-xs text-error font-medium"
          >
            {strategiesError}
          </p>
        )}

        <div className="rounded-2xl border border-border/90 bg-card p-6 mb-6 shadow-xs">
          <p className="mb-4 text-xs text-muted-foreground">
            Backtesting currently supports NSE/BSE equity symbols with continuous historical candle archives.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Strategy</label>
              <select
                value={selectedStrategyId}
                onChange={(event) => setSelectedStrategyId(event.target.value)}
                className="min-w-[200px] rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-ring"
              >
                {strategies.length === 0 && <option value="">No strategies yet</option>}
                {strategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Symbol</label>
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                placeholder="e.g. RELIANCE"
                className="w-32 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground uppercase focus:outline-none focus:border-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Initial Capital</label>
              <input
                type="number"
                min={1}
                value={initialCapital}
                onChange={(event) => setInitialCapital(Number(event.target.value))}
                className="w-36 rounded-xl border border-border bg-card px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-ring"
              />
            </div>
            <button
              onClick={() => void handleRun()}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-primary/20 shadow-xs hover:bg-primary/90 disabled:opacity-60 transition-all"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run Backtest
            </button>
          </div>
        </div>

        {latestRun && (
          <div className="mb-6">
            <RunResult run={latestRun} />
          </div>
        )}

        {pastRuns.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">Historical Execution Runs</h2>
            <div className="space-y-3">
              {pastRuns.map((run) => {
                const isExpanded = expandedRunId === run.id;
                const pnl = run.summary?.totalPnl ?? 0;
                const isPositive = pnl >= 0;
                return (
                  <div key={run.id} className="rounded-2xl border border-border/90 bg-card overflow-hidden shadow-xs">
                    <button
                      onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                      className="flex w-full items-center justify-between px-5 py-3.5 text-left text-xs md:text-sm hover:bg-muted transition-colors"
                    >
                      <span className="flex items-center gap-2.5 font-bold text-foreground">
                        {isPositive ? (
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-error" />
                        )}
                        {run.symbol} · {run.fromDate} → {run.toDate}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold border num-font ${
                          isPositive
                            ? "bg-success/10 text-success border-success/30"
                            : "bg-error/10 text-error border-error/30"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        ₹{formatCurrency(pnl)} ({formatPercent(run.summary?.totalPnlPercent ?? null)})
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border p-5 bg-muted/50">
                        <RunResult run={run} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


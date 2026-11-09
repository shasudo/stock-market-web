"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FlaskConical, Play, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  BACKTEST_ENTRY_TYPES,
  BACKTEST_SOURCES,
  MOCK_BACKTEST_ROWS,
  computePnl,
  makeEmptyBackTestRow,
  type BackTestRow,
} from "@/lib/analysis-config";

const formatCurrency = (value: number) =>
  `${value < 0 ? "-" : ""}₹${Math.abs(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function StrategyBackTestGroupPage() {
  const [rows, setRows] = useState<BackTestRow[]>(MOCK_BACKTEST_ROWS);
  const idCounter = useRef(1);

  const nextId = () => `bt-${Date.now()}-${idCounter.current++}`;

  const updateRow = (id: string, patch: Partial<BackTestRow>) =>
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );

  const num = (value: string) => (value === "" ? 0 : parseFloat(value) || 0);

  const addRow = () =>
    setRows((prev) => [...prev, makeEmptyBackTestRow(nextId())]);

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Back test row deleted");
  };

  const runBackTest = () => toast.success("Back test simulated on real quotes");

  const totalPnl = rows.reduce((sum, r) => sum + computePnl(r), 0);
  const winners = rows.filter((r) => computePnl(r) > 0).length;
  const winRate = rows.length ? Math.round((winners / rows.length) * 100) : 0;
  const avgSuccess = rows.length
    ? Math.round(
        rows.reduce((sum, r) => sum + (r.successRate || 0), 0) / rows.length,
      )
    : 0;

  return (
    <div className="min-h-screen bg-background py-6 font-sans">
      <div className="w-full px-4 lg:px-8">
        {/* Header Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 mb-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-primary/20 shadow-lg">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
                Strategy Group Backtesting Studio
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Multi-trade batch simulation with automated stop-loss, trailing target and risk execution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={runBackTest}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground shadow-xs transition-all hover:bg-muted active:scale-95"
            >
              <Play className="h-3.5 w-3.5 text-muted-foreground fill-muted-foreground" />
              Re-simulate Batch
            </button>
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-primary/20 shadow-xs transition-all hover:bg-primary/90 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 text-primary-foreground" />
              Add Trade Rule
            </button>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "TOTAL TRADES",
              value: String(rows.length),
              tone: "text-foreground",
            },
            {
              label: "NET REALIZED P&L",
              value: formatCurrency(totalPnl),
              tone: totalPnl >= 0 ? "text-success" : "text-error",
            },
            {
              label: "WINNING TRADES RATIO",
              value: `${winRate}%`,
              tone: winRate >= 50 ? "text-success" : "text-foreground",
            },
            {
              label: "AVG BENCHMARK SUCCESS",
              value: `${avgSuccess}%`,
              tone: "text-foreground",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-border/90 bg-card p-5 shadow-xs"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {card.label}
              </p>
              <p className={`mt-1 text-2xl font-mono font-bold num-font ${card.tone}`}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {/* Table Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-border/90 bg-card shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-border bg-muted/80 px-5 py-3.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Batch Simulation Ledger
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/30">
              {rows.length} trades recorded
            </span>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
                <tr className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider select-none">
                  <th className="border-r border-border px-3 py-3 text-center w-12">
                    #
                  </th>
                  <th className="border-r border-border px-3 py-3 text-left">
                    Signal Source
                  </th>
                  <th className="border-r border-border px-3 py-3 text-left">
                    Entry Type
                  </th>
                  <th className="border-r border-border px-3 py-3 text-center">
                    Qty
                  </th>
                  <th className="border-r border-border px-3 py-3 text-center">
                    Buy Price (₹)
                  </th>
                  <th className="border-r border-border px-3 py-3 text-center">
                    Stop Loss (₹)
                  </th>
                  <th className="border-r border-border px-3 py-3 text-center">
                    Exit Target (₹)
                  </th>
                  <th className="border-r border-border px-3 py-3 text-right">
                    Profit &amp; Loss
                  </th>
                  <th className="border-r border-border px-3 py-3 text-left">
                    Strategy Tag
                  </th>
                  <th className="border-r border-border px-3 py-3 text-right">
                    Confidence
                  </th>
                  <th className="px-3 py-3 text-center w-14">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, index) => {
                  const pnl = computePnl(row);
                  const isProfit = pnl >= 0;
                  return (
                    <tr
                      key={row.id}
                      className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                    >
                      <td className="border-r border-border px-3 py-2 text-xs font-mono font-bold text-muted-foreground text-center w-12 num-font">
                        {index + 1}
                      </td>
                      <td className="border-r border-border px-2 py-2">
                        <select
                          value={row.source}
                          onChange={(e) =>
                            updateRow(row.id, { source: e.target.value })
                          }
                          className="w-full min-w-[95px] max-w-[120px] rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium text-foreground focus:border-ring focus:outline-none cursor-pointer shadow-xs"
                        >
                          {BACKTEST_SOURCES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-r border-border px-2 py-2">
                        <select
                          value={row.entryType}
                          onChange={(e) =>
                            updateRow(row.id, { entryType: e.target.value })
                          }
                          className="w-full min-w-[85px] max-w-[110px] rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium text-foreground focus:border-ring focus:outline-none cursor-pointer shadow-xs"
                        >
                          {BACKTEST_ENTRY_TYPES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-r border-border px-2 py-2">
                        <input
                          type="number"
                          value={row.qty || ""}
                          onChange={(e) =>
                            updateRow(row.id, { qty: num(e.target.value) })
                          }
                          className="w-full min-w-[70px] max-w-[90px] rounded-lg border border-border bg-card px-2 py-1 text-center text-xs font-mono font-bold text-foreground focus:border-ring focus:outline-none shadow-xs num-font"
                        />
                      </td>
                      <td className="border-r border-border px-2 py-2">
                        <input
                          type="number"
                          step="any"
                          value={row.buyPrice || ""}
                          onChange={(e) =>
                            updateRow(row.id, { buyPrice: num(e.target.value) })
                          }
                          className="w-full min-w-[80px] max-w-[100px] rounded-lg border border-border bg-card px-2 py-1 text-center text-xs font-mono font-bold text-foreground focus:border-ring focus:outline-none shadow-xs num-font"
                        />
                      </td>
                      <td className="border-r border-border px-2 py-2">
                        <input
                          type="number"
                          step="any"
                          value={row.stopLoss || ""}
                          onChange={(e) =>
                            updateRow(row.id, { stopLoss: num(e.target.value) })
                          }
                          className="w-full min-w-[80px] max-w-[100px] rounded-lg border border-border bg-card px-2 py-1 text-center text-xs font-mono font-bold text-error focus:border-ring focus:outline-none shadow-xs num-font"
                        />
                      </td>
                      <td className="border-r border-border px-2 py-2">
                        <input
                          type="number"
                          step="any"
                          value={row.exit || ""}
                          onChange={(e) =>
                            updateRow(row.id, { exit: num(e.target.value) })
                          }
                          className="w-full min-w-[80px] max-w-[100px] rounded-lg border border-border bg-card px-2 py-1 text-center text-xs font-mono font-bold text-success focus:border-ring focus:outline-none shadow-xs num-font"
                        />
                      </td>
                      <td className="border-r border-border px-3 py-2 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font ${
                            isProfit
                              ? "bg-success/10 text-success border-success/30"
                              : "bg-error/10 text-error border-error/30"
                          }`}
                        >
                          {formatCurrency(pnl)}
                        </span>
                      </td>
                      <td className="border-r border-border px-2 py-2">
                        <input
                          value={row.strategy}
                          onChange={(e) =>
                            updateRow(row.id, { strategy: e.target.value })
                          }
                          className="w-full min-w-[140px] rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground focus:border-ring focus:outline-none shadow-xs"
                          placeholder="Strategy identifier"
                        />
                      </td>
                      <td className="border-r border-border px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full ${
                                row.successRate >= 60
                                  ? "bg-success"
                                  : row.successRate >= 50
                                    ? "bg-warning"
                                    : "bg-error"
                              }`}
                              style={{
                                width: `${Math.min(100, Math.max(0, row.successRate))}%`,
                              }}
                            />
                          </div>
                          <input
                            type="number"
                            value={row.successRate || ""}
                            onChange={(e) =>
                              updateRow(row.id, {
                                successRate: num(e.target.value),
                              })
                            }
                            className="w-10 rounded-lg border border-border bg-card px-1 py-0.5 text-right text-xs font-mono font-bold text-foreground focus:border-ring focus:outline-none num-font"
                          />
                          <span className="text-muted-foreground text-xs">%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center w-14">
                        <div className="flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => deleteRow(row.id)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-error/10 hover:text-error"
                            title="Delete trade"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-6 py-16 text-center text-muted-foreground text-xs"
                    >
                      No back test trades. Click{" "}
                      <span className="font-bold text-primary">
                        Add Trade Rule
                      </span>{" "}
                      to start.
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border bg-muted/80 font-bold text-foreground">
                    <td
                      colSpan={7}
                      className="border-r border-border px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      CUMULATIVE BATCH P&amp;L
                    </td>
                    <td className="border-r border-border px-3 py-3 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-mono font-bold border num-font ${
                          totalPnl >= 0
                            ? "bg-success/10 text-success border-success/30"
                            : "bg-error/10 text-error border-error/30"
                        }`}
                      >
                        {formatCurrency(totalPnl)}
                      </span>
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}


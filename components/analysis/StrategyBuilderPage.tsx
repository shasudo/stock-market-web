"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Layers, Pencil, Plus, Trash2, X, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { TechnicalColumnPicker } from "@/components/TechnicalColumnPicker";
import {
  ADD_COLUMN_GROUPS,
  ADD_TIMEFRAMES,
  selectionItemLabels,
  type AddColumnSelection,
} from "@/lib/screener-columns";
import { getFundamentalsUnsupportedScreenerColumnReason } from "@/lib/fundamentals/coverage";
import {
  resolveColumnCapability,
  resolveTimeframeCapability,
} from "@/lib/technical";
import {
  MOCK_STRATEGY_ROWS,
  STRATEGY_LEGS,
  TIMEFRAMES,
  TRADING_INSTRUMENTS,
  TRADING_TYPES,
  makeEmptyStrategyRow,
  type StrategyLegKey,
  type StrategyRow,
} from "@/lib/analysis-config";

interface CustomColumn {
  id: string;
  label: string;
}

const selectClass =
  "w-full min-w-[95px] max-w-[120px] rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium text-foreground focus:border-ring focus:outline-none cursor-pointer shadow-xs";

function StrategyBuilderContent() {
  const [rows, setRows] = useState<StrategyRow[]>(MOCK_STRATEGY_ROWS);
  const [customCols, setCustomCols] = useState<CustomColumn[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const snapshot = useRef<StrategyRow | null>(null);
  const idCounter = useRef(1);

  const startEdit = (row: StrategyRow) => {
    snapshot.current = row;
    setEditingId(row.id);
  };

  const saveEdit = () => {
    snapshot.current = null;
    setEditingId(null);
    toast.success("Strategy saved");
  };

  const discardEdit = () => {
    const snap = snapshot.current;
    if (snap) setRows((prev) => prev.map((r) => (r.id === snap.id ? snap : r)));
    snapshot.current = null;
    setEditingId(null);
  };

  const nextId = (prefix: string) =>
    `${prefix}-${Date.now()}-${idCounter.current++}`;

  const updateRow = (id: string, patch: Partial<StrategyRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const updateLeg = (
    rowId: string,
    legKey: StrategyLegKey,
    value: AddColumnSelection,
  ) =>
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [legKey]: value } : r)),
    );

  const updateCustom = (rowId: string, colId: string, value: string) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, custom: { ...r.custom, [colId]: value } } : r,
      ),
    );

  const addRow = () =>
    setRows((prev) => [...prev, makeEmptyStrategyRow(nextId("strat"))]);

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) {
      snapshot.current = null;
      setEditingId(null);
    }
    toast.success("Strategy deleted");
  };

  const addColumn = () => {
    const col = { id: nextId("col"), label: "New Column" };
    setCustomCols((prev) => [...prev, col]);
  };

  const renameColumn = (colId: string, label: string) =>
    setCustomCols((prev) =>
      prev.map((c) => (c.id === colId ? { ...c, label } : c)),
    );

  const deleteColumn = (colId: string) => {
    setCustomCols((prev) => prev.filter((c) => c.id !== colId));
    setRows((prev) =>
      prev.map((r) => {
        if (!(colId in r.custom)) return r;
        const rest = { ...r.custom };
        delete rest[colId];
        return { ...r, custom: rest };
      }),
    );
  };

  const totalColumns = 4 + STRATEGY_LEGS.length + customCols.length + 1;

  const editingRow = rows.find((r) => r.id === editingId) ?? null;
  const getStrategyItemAvailability = useCallback(
    (groupId: string, itemId: string) => {
      const capability = resolveColumnCapability(groupId, itemId);
      const providerReason =
        capability.status === "needs-fundamentals"
          ? getFundamentalsUnsupportedScreenerColumnReason(groupId, itemId)
          : undefined;
      return {
        disabled:
          capability.status === "needs-manual-input" ||
          providerReason !== undefined,
        message:
          capability.status === "needs-manual-input"
            ? capability.message
            : providerReason,
      };
    },
    [],
  );
  const getStrategyTimeframeAvailability = useCallback(
    (timeframeId: string) => {
      const capability = resolveTimeframeCapability(timeframeId);
      return {
        disabled: capability.status === "needs-manual-input",
        message:
          capability.status === "needs-manual-input"
            ? capability.message
            : undefined,
      };
    },
    [],
  );

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        {/* Header Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 mb-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-primary/20 shadow-lg">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
                Quantitative Strategy Builder
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Build multi-leg strategies from candlesticks, indicators, chart patterns and custom signals
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={addColumn}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground shadow-xs transition-all hover:bg-muted active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              Add Column
            </button>
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-primary/20 shadow-xs transition-all hover:bg-primary/90 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 text-primary-foreground" />
              Add Strategy
            </button>
          </div>
        </div>

        {/* Strategies Table Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-border/90 bg-card shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-border bg-muted/80 px-5 py-3.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Active Strategy Rules
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/30">
              {rows.length} strategies configured
            </span>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
                <tr className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider select-none">
                  <th className="border-r border-border px-3 py-3 text-center whitespace-nowrap w-12">
                    #
                  </th>
                  <th className="border-r border-border px-3 py-3 whitespace-nowrap">
                    {editingRow ? (
                      <select
                        value={editingRow.timeframe}
                        onChange={(e) =>
                          updateRow(editingRow.id, {
                            timeframe: e.target.value,
                          })
                        }
                        className={selectClass}
                        title={`Timeframe for strategy #${rows.indexOf(editingRow) + 1}`}
                      >
                        {TIMEFRAMES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    ) : (
                      "Timeframe"
                    )}
                  </th>
                  <th className="border-r border-border px-3 py-3 whitespace-nowrap">
                    Trading Instrument
                  </th>
                  <th className="border-r border-border px-3 py-3 whitespace-nowrap">
                    Trading Type
                  </th>
                  {STRATEGY_LEGS.map((leg) => (
                    <th
                      key={leg.key}
                      className="border-r border-border px-3 py-3 whitespace-nowrap"
                    >
                      {leg.label}
                    </th>
                  ))}
                  {customCols.map((col) => (
                    <th
                      key={col.id}
                      className="border-r border-border px-2 py-2"
                    >
                      <div className="flex items-center gap-1">
                        <input
                          value={col.label}
                          onChange={(e) => renameColumn(col.id, e.target.value)}
                          className="w-24 rounded-lg border border-border bg-card px-2 py-0.5 text-xs font-bold text-foreground focus:border-ring focus:outline-none"
                        />
                        <button
                          onClick={() => deleteColumn(col.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-error/10 hover:text-error"
                          title="Delete column"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                  >
                    <td className="border-r border-border px-3 py-2 text-xs font-mono font-bold text-muted-foreground text-center w-12 num-font">
                      {index + 1}
                    </td>
                    <td className="border-r border-border px-3 py-2 text-xs font-bold text-foreground whitespace-nowrap">
                      <span
                        className={
                          editingId === row.id
                            ? "rounded-md bg-primary/10 px-2 py-0.5 text-primary border border-primary/30"
                            : "font-mono num-font"
                        }
                      >
                        {row.timeframe}
                      </span>
                    </td>
                    <td className="border-r border-border px-2 py-2">
                      <select
                        value={row.instrument}
                        onChange={(e) =>
                          updateRow(row.id, { instrument: e.target.value })
                        }
                        className={selectClass}
                      >
                        {TRADING_INSTRUMENTS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-r border-border px-2 py-2">
                      <select
                        value={row.tradingType}
                        onChange={(e) =>
                          updateRow(row.id, { tradingType: e.target.value })
                        }
                        className={selectClass}
                      >
                        {TRADING_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    {STRATEGY_LEGS.map((leg) => {
                      const selection = row[leg.key];
                      const labels = selectionItemLabels(selection);
                      return (
                        <td
                          key={leg.key}
                          className="border-r border-border p-0 align-middle"
                        >
                          <TechnicalColumnPicker
                            groups={ADD_COLUMN_GROUPS}
                            timeframeOptions={ADD_TIMEFRAMES}
                            selection={selection}
                            onChange={(next) =>
                              updateLeg(row.id, leg.key, next)
                            }
                            getItemAvailability={getStrategyItemAvailability}
                            getTimeframeAvailability={
                              getStrategyTimeframeAvailability
                            }
                          >
                            <button
                              type="button"
                              className="flex min-h-[38px] w-full min-w-[130px] flex-wrap content-center items-center gap-1.5 px-2.5 py-1.5 text-left transition-colors hover:bg-primary/10"
                            >
                              {labels.length === 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary">
                                  <Plus className="h-3 w-3" /> Add Condition
                                </span>
                              ) : (
                                labels.map((it) => (
                                  <span
                                    key={it}
                                    className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary border border-primary/30 shadow-xs whitespace-nowrap"
                                  >
                                    {it}
                                  </span>
                                ))
                              )}
                            </button>
                          </TechnicalColumnPicker>
                        </td>
                      );
                    })}
                    {customCols.map((col) => (
                      <td
                        key={col.id}
                        className="border-r border-border px-2 py-2"
                      >
                        <input
                          value={row.custom[col.id] ?? ""}
                          onChange={(e) =>
                            updateCustom(row.id, col.id, e.target.value)
                          }
                          className="w-full min-w-[90px] rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium text-foreground focus:border-ring focus:outline-none"
                          placeholder="—"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center w-16 whitespace-nowrap">
                      {editingId === row.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={saveEdit}
                            className="rounded-lg p-1.5 text-emerald-600 transition-all hover:bg-success/10"
                            title="Save changes"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={discardEdit}
                            className="rounded-lg p-1.5 text-error transition-all hover:bg-error/10"
                            title="Discard changes"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => startEdit(row)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                            title="Edit strategy"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteRow(row.id)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-error/10 hover:text-error"
                            title="Delete strategy"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={totalColumns}
                      className="px-6 py-16 text-center text-muted-foreground text-xs"
                    >
                      No strategies configured yet. Click{" "}
                      <span className="font-bold text-primary">
                        Add Strategy
                      </span>{" "}
                      to build one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function StrategyBuilderPage() {
  return <StrategyBuilderContent />;
}


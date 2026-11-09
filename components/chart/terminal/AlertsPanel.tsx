"use client";

import { useMemo, useState } from "react";
import { BellPlus, Pause, Pencil, Play, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  deleteAlert,
  deleteAlertMeta,
  describeAlert,
  getAlertMeta,
  getAxiosErrorMessage,
  isAlertExpired,
  readPausedIds,
  removeLocalAlert,
  setAlertPaused,
  type ChartAlert,
} from "./alerts";

interface AlertsPanelProps {
  readonly alerts: readonly ChartAlert[];
  readonly localAlerts: readonly ChartAlert[];
  readonly onCreate: () => void;
  readonly onEdit: (id: string, local: boolean) => void;
  readonly onChanged: () => void;
}

interface Row {
  readonly alert: ChartAlert;
  readonly local: boolean;
  readonly key: string;
  readonly paused: boolean;
}

function RowButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`rounded p-1.5 hover:bg-muted ${
        danger
          ? "text-muted-foreground hover:text-error"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * TradingView-style docked Alerts tab: every alert with pause, edit and
 * delete, plus multi-select bulk delete. Creation and rich edits open the
 * alert dialog.
 */
export default function AlertsPanel({
  alerts,
  localAlerts,
  onCreate,
  onEdit,
  onChanged,
}: AlertsPanelProps) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [pausedIds, setPausedIds] = useState<ReadonlySet<string>>(() =>
    readPausedIds(),
  );
  const [nowMs] = useState(() => Date.now());

  const rows = useMemo<readonly Row[]>(() => {
    const needle = filter.trim().toUpperCase();
    const withPaused = (alert: ChartAlert, local: boolean): Row => ({
      alert,
      local,
      key: `${local ? "L" : "S"}:${alert.id}`,
      paused: pausedIds.has(alert.id),
    });
    const all: Row[] = [
      ...alerts.map((alert) => withPaused(alert, false)),
      ...localAlerts.map((alert) => withPaused(alert, true)),
    ];
    return needle
      ? all.filter((row) =>
          row.alert.tradingSymbol.toUpperCase().includes(needle),
        )
      : all;
  }, [alerts, localAlerts, filter, pausedIds]);

  const toggleSelect = (key: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const removeOne = async (row: Row): Promise<void> => {
    try {
      if (row.local) removeLocalAlert(row.alert.id);
      else await deleteAlert(row.alert.id);
      deleteAlertMeta(row.alert.tradingSymbol, row.alert.targetPrice);
      setAlertPaused(row.alert.id, false);
      toast.success("Alert removed");
      onChanged();
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Could not remove the alert"));
    }
  };

  const removeSelected = async (): Promise<void> => {
    const targets = rows.filter((row) => selected.has(row.key));
    if (targets.length === 0) return;
    let failures = 0;
    for (const row of targets) {
      try {
        if (row.local) removeLocalAlert(row.alert.id);
        else await deleteAlert(row.alert.id);
        deleteAlertMeta(row.alert.tradingSymbol, row.alert.targetPrice);
        setAlertPaused(row.alert.id, false);
      } catch {
        failures += 1;
      }
    }
    setSelected(new Set());
    if (failures > 0) toast.error(`${failures} alert(s) could not be removed`);
    else toast.success(`${targets.length} alert(s) removed`);
    onChanged();
  };

  const togglePaused = (row: Row): void => {
    const next = !row.paused;
    setAlertPaused(row.alert.id, next);
    setPausedIds(readPausedIds());
  };

  const allSelected =
    rows.length > 0 && rows.every((row) => selected.has(row.key));

  return (
    <section aria-label="Alerts" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 px-3 py-2">
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search alerts…"
          aria-label="Search alerts"
          className="min-w-0 flex-1 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <button
          type="button"
          aria-label="Create alert"
          title="Create alert"
          onClick={onCreate}
          className="shrink-0 rounded-md bg-foreground p-1.5 text-primary-foreground hover:bg-foreground/90"
        >
          <BellPlus className="h-4 w-4" />
        </button>
      </div>
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-3 pb-2">
          <span className="text-[12px] font-semibold text-muted-foreground">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={() => void removeSelected()}
            className="flex items-center gap-1 rounded px-2 py-1 text-[12px] font-semibold text-error hover:bg-error/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="max-w-xs text-[13px] text-muted-foreground">
              Alerts notify you instantly when your conditions are met. Create
              one to get started.
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="mt-1 rounded bg-foreground px-4 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-foreground/90"
            >
              Create alert
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            <li className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                aria-label="Select all alerts"
                checked={allSelected}
                onChange={() =>
                  setSelected(
                    allSelected
                      ? new Set()
                      : new Set(rows.map((row) => row.key)),
                  )
                }
                className="h-3.5 w-3.5 accent-[#2962FF]"
              />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {rows.length} alert{rows.length === 1 ? "" : "s"}
              </span>
            </li>
            {rows.map((row) => {
              const { alert, paused } = row;
              const meta = getAlertMeta(alert.tradingSymbol, alert.targetPrice);
              const expired = meta !== null && isAlertExpired(meta, nowMs);
              return (
                <li
                  key={row.key}
                  className={`flex items-start gap-1.5 rounded-lg border px-2 py-1.5 ${
                    paused ? "border-border opacity-60" : "border-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${alert.tradingSymbol} alert`}
                    checked={selected.has(row.key)}
                    onChange={() => toggleSelect(row.key)}
                    className="mt-1 h-3.5 w-3.5 shrink-0 accent-[#2962FF]"
                  />
                  <span
                    aria-hidden
                    className={`mt-0.5 text-[13px] font-bold ${
                      alert.direction === "above"
                        ? "text-success"
                        : "text-error"
                    }`}
                  >
                    {alert.direction === "above" ? "▲" : "▼"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-foreground">
                      {alert.tradingSymbol} · {describeAlert(alert)}
                    </p>
                    <p className="flex flex-wrap gap-1 pt-0.5 text-[10.5px] text-muted-foreground">
                      {paused && (
                        <span className="rounded bg-warning/15 px-1.5 py-px font-semibold text-warning">
                          Paused
                        </span>
                      )}
                      {meta?.trigger === "every" && (
                        <span className="rounded bg-muted px-1.5 py-px">
                          Every time
                        </span>
                      )}
                      {expired && (
                        <span className="rounded bg-error/10 px-1.5 py-px font-semibold text-error">
                          Expired
                        </span>
                      )}
                      {alert.status !== "active" && (
                        <span className="rounded bg-muted px-1.5 py-px">
                          {alert.status}
                        </span>
                      )}
                      {row.local && (
                        <span className="rounded bg-muted px-1.5 py-px">
                          This device
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <RowButton
                      label={paused ? "Resume alert" : "Pause alert"}
                      onClick={() => togglePaused(row)}
                    >
                      {paused ? (
                        <Play className="h-3.5 w-3.5" />
                      ) : (
                        <Pause className="h-3.5 w-3.5" />
                      )}
                    </RowButton>
                    <RowButton
                      label="Edit alert"
                      onClick={() => onEdit(alert.id, row.local)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </RowButton>
                    <RowButton
                      label="Delete alert"
                      danger
                      onClick={() => void removeOne(row)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </RowButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

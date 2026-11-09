"use client";

import { useState } from "react";

/**
 * One hand-entered price level, editable in place: click, type, Enter or
 * blur to save, Escape to cancel. Shows the value with its gap to a
 * reference price (LTP) in rupees and percent; zero means "not set" and
 * renders as an em dash rather than ₹0.00 with a meaningless -100%.
 *
 * Shared by the watchlist and the paper/live trading tables - anywhere a row
 * has a number the user types in rather than one the app computes.
 */
export function LevelCell({
  value,
  reference,
  label,
  tone,
  onSave,
}: {
  value: number;
  /** The live price to diff against (LTP). */
  reference: number;
  label: string;
  tone: "neutral" | "loss" | "gain";
  onSave: (value: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const isSet = value > 0;
  const difference = reference - value;
  const differencePercent = isSet ? (difference / value) * 100 : 0;
  const differenceColor = difference >= 0 ? "text-success" : "text-error";
  const valueColor =
    tone === "loss"
      ? "text-error"
      : tone === "gain"
        ? "text-success"
        : "text-muted-foreground";

  const commit = async (): Promise<void> => {
    setEditing(false);
    const parsed = Number(draft.trim());
    if (draft.trim() === "" || !Number.isFinite(parsed) || parsed < 0) {
      return;
    }
    if (parsed === value) return;
    await onSave(parsed);
  };

  if (editing) {
    return (
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.05"
          min="0"
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") void commit();
            if (event.key === "Escape") setEditing(false);
          }}
          aria-label={label}
          className="w-24 rounded border border-primary bg-background px-2 py-1 text-right text-xs font-mono text-foreground focus:outline-none"
        />
      </td>
    );
  }

  return (
    <td className="px-4 py-3">
      <button
        type="button"
        onClick={() => {
          setDraft(isSet ? String(value) : "");
          setEditing(true);
        }}
        title={`Click to set ${label}`}
        className="flex w-full flex-col items-end gap-0.5 rounded px-1 py-0.5 hover:bg-secondary/60"
      >
        <span className={`text-xs font-mono ${valueColor}`}>
          {isSet ? `₹${value.toFixed(2)}` : "—"}
        </span>
        {isSet && (
          <div className="flex w-full items-center justify-between gap-2">
            <span
              className={`text-[10px] leading-none font-mono font-bold ${differenceColor}`}
            >
              {difference >= 0 ? "+" : ""}
              {difference.toFixed(2)}
            </span>
            <span
              className={`text-[10px] leading-none font-mono font-bold ${differenceColor}`}
            >
              {difference >= 0 ? "+" : ""}
              {differencePercent.toFixed(2)}%
            </span>
          </div>
        )}
      </button>
    </td>
  );
}

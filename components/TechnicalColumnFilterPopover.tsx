"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { AddedColumnDefinition } from "@/lib/screener-columns";
import type { TechnicalColumnFilter } from "@/lib/market/technical-filter";

export type { TechnicalColumnFilter } from "@/lib/market/technical-filter";

const POPOVER_WIDTH = 288;
const VIEWPORT_MARGIN = 8;
/** Space between the trigger and the popover's edge. */
const TRIGGER_GAP = 4;

interface TechnicalColumnFilterPopoverProps {
  column: AddedColumnDefinition;
  currentFilter?: TechnicalColumnFilter;
  onApply: (filter: TechnicalColumnFilter | null) => void;
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export function TechnicalColumnFilterPopover({
  column,
  currentFilter,
  onApply,
  isOpen,
  onClose,
  triggerRef,
}: TechnicalColumnFilterPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  // Rendered into document.body at a fixed position. Inside the table's
  // scroll container an absolutely positioned popover on the last column
  // overflowed its right edge, and focusing its inputs made the browser
  // scroll the table (and page) to reveal it — the whole grid jumped left.
  // The position is written straight to the element: it follows the trigger
  // on scroll and resize without a render per event.

  const isChange = column.kind === "change";
  const itemId = column.itemId || "";
  const isRSI = itemId.includes("rsi");
  const isPattern =
    column.groupId === "candlesticks" ||
    column.groupId === "chart-patterns" ||
    column.groupId === "strategies-builder";

  const [operator, setOperator] = useState<TechnicalColumnFilter["operator"]>(
    currentFilter?.operator ||
      (isPattern ? "detected" : isChange ? "gt" : "gte"),
  );
  const [minVal, setMinVal] = useState<string>(
    currentFilter?.minValue !== undefined ? String(currentFilter.minValue) : "",
  );
  const [maxVal, setMaxVal] = useState<string>(
    currentFilter?.maxValue !== undefined ? String(currentFilter.maxValue) : "",
  );

  // The header cell mounts this only while it is open, so the state above is
  // initialised from the current filter on every open; no reset effect needed.

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose, triggerRef]);

  // Positioned in the viewport, not in the table: below the trigger when it
  // fits, above it when it does not, and pinned inside the viewport (scrolling
  // internally) when neither side has room — the header cell sits near the
  // bottom of a short window as often as not. Re-placed whenever the window,
  // the scroll position or the popover's own content changes size.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const element = popoverRef.current;
      if (!trigger || !element) return;
      const viewportHeight = window.innerHeight;
      element.style.maxHeight = `${viewportHeight - 2 * VIEWPORT_MARGIN}px`;
      const height = element.offsetHeight;
      const lowest = viewportHeight - VIEWPORT_MARGIN - height;
      const below = trigger.bottom + TRIGGER_GAP;
      const above = trigger.top - TRIGGER_GAP - height;
      const top =
        below <= lowest
          ? below
          : above >= VIEWPORT_MARGIN && above <= lowest
            ? above
            : Math.max(VIEWPORT_MARGIN, Math.min(below, lowest));
      const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
      element.style.top = `${top}px`;
      element.style.left = `${Math.max(VIEWPORT_MARGIN, Math.min(trigger.left, maxLeft))}px`;
      element.style.visibility = "visible";
    };
    place();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (popoverRef.current) observer?.observe(popoverRef.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isOpen, triggerRef]);

  if (!isOpen || typeof document === "undefined") return null;

  const handleApply = () => {
    if (isPattern) {
      onApply({
        columnId: column.id,
        operator,
        label: operator === "detected" ? "Detected (Yes)" : "None (No)",
      });
      onClose();
      return;
    }

    const min = minVal.trim() !== "" ? parseFloat(minVal) : undefined;
    const max = maxVal.trim() !== "" ? parseFloat(maxVal) : undefined;

    if (min === undefined && max === undefined) {
      onApply(null);
      onClose();
      return;
    }

    let filterLabel = "";
    if (operator === "gt" || operator === "gte") {
      filterLabel = `≥ ${min}${isChange ? "%" : ""}`;
    } else if (operator === "lt" || operator === "lte") {
      filterLabel = `≤ ${max ?? min}${isChange ? "%" : ""}`;
    } else if (operator === "between") {
      filterLabel = `${min ?? "—"} to ${max ?? "—"}${isChange ? "%" : ""}`;
    } else if (operator === "equals") {
      filterLabel = `= ${min}${isChange ? "%" : ""}`;
    }

    onApply({
      columnId: column.id,
      operator,
      minValue: min,
      maxValue: max,
      label: filterLabel,
    });
    onClose();
  };

  const handleClear = () => {
    onApply(null);
    onClose();
  };

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[1000] w-72 overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-xl text-left font-sans text-xs text-foreground normal-case tracking-normal"
      style={{
        width: POPOVER_WIDTH,
        top: -9999,
        left: -9999,
        visibility: "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-border pb-2 mb-2.5">
        <div>
          <span className="font-bold text-foreground block text-xs">
            Filter: {column.label}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">
            {column.timeframeLabel}{" "}
            {column.groupLabel ? `• ${column.groupLabel}` : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded"
        >
          ✕
        </button>
      </div>

      {isPattern ? (
        <div className="space-y-2.5">
          <label className="text-[11px] font-semibold text-muted-foreground block">
            Signal Detection:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setOperator("detected");
              }}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold border transition-all ${
                operator === "detected"
                  ? "bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950 border-emerald-700 dark:border-emerald-500 shadow-xs"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              ✓ Detected (Yes)
            </button>
            <button
              type="button"
              onClick={() => {
                setOperator("none");
              }}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold border transition-all ${
                operator === "none"
                  ? "bg-muted-foreground dark:bg-zinc-200 text-white dark:text-zinc-950 border-slate-800 dark:border-border shadow-xs"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              No / None
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Quick Presets */}
          {isChange && (
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Quick Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOperator("gte");
                    setMinVal("0");
                    setMaxVal("");
                  }}
                  className="px-2 py-1 bg-success/10 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-300 border border-success/30 dark:border-emerald-400/30 rounded text-[11px] font-semibold hover:bg-success/20 dark:bg-emerald-400/20"
                >
                  Gainers (&gt;0%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOperator("gte");
                    setMinVal("2");
                    setMaxVal("");
                  }}
                  className="px-2 py-1 bg-success/10 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-300 border border-success/30 dark:border-emerald-400/30 rounded text-[11px] font-semibold hover:bg-success/20 dark:bg-emerald-400/20"
                >
                  &gt; +2%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOperator("lte");
                    setMinVal("");
                    setMaxVal("0");
                  }}
                  className="px-2 py-1 bg-error/10 dark:bg-rose-400/10 text-rose-800 dark:text-rose-300 border border-error/30 dark:border-rose-400/30 rounded text-[11px] font-semibold hover:bg-error/20 dark:bg-rose-400/20"
                >
                  Losers (&lt;0%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOperator("lte");
                    setMinVal("");
                    setMaxVal("-2");
                  }}
                  className="px-2 py-1 bg-error/10 dark:bg-rose-400/10 text-rose-800 dark:text-rose-300 border border-error/30 dark:border-rose-400/30 rounded text-[11px] font-semibold hover:bg-error/20 dark:bg-rose-400/20"
                >
                  &lt; -2%
                </button>
              </div>
            </div>
          )}

          {isRSI && (
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                RSI Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOperator("lte");
                    setMinVal("");
                    setMaxVal("30");
                  }}
                  className="px-2 py-1 bg-success/10 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-300 border border-success/30 dark:border-emerald-400/30 rounded text-[11px] font-semibold hover:bg-success/20 dark:bg-emerald-400/20"
                >
                  Oversold (&lt;30)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOperator("gte");
                    setMinVal("70");
                    setMaxVal("");
                  }}
                  className="px-2 py-1 bg-error/10 dark:bg-rose-400/10 text-rose-800 dark:text-rose-300 border border-error/30 dark:border-rose-400/30 rounded text-[11px] font-semibold hover:bg-error/20 dark:bg-rose-400/20"
                >
                  Overbought (&gt;70)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOperator("gte");
                    setMinVal("50");
                    setMaxVal("");
                  }}
                  className="px-2 py-1 bg-blue-50 dark:bg-blue-400/10 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-400/30 rounded text-[11px] font-semibold hover:bg-info/20 dark:bg-blue-400/20"
                >
                  Bullish (&gt;50)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOperator("between");
                    setMinVal("40");
                    setMaxVal("60");
                  }}
                  className="px-2 py-1 bg-muted text-foreground border border-border rounded text-[11px] font-semibold hover:bg-muted"
                >
                  Range (40-60)
                </button>
              </div>
            </div>
          )}

          {/* Condition Selector */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Condition:
            </label>
            <select
              value={operator}
              onChange={(e) =>
                setOperator(e.target.value as TechnicalColumnFilter["operator"])
              }
              className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:border-ring dark:focus:border-zinc-400 focus:outline-hidden"
            >
              <option value="gte">Greater Than or Equal (&gt;=)</option>
              <option value="lte">Less Than or Equal (&lt;=)</option>
              <option value="between">Between (Min &amp; Max)</option>
              <option value="gt">Greater Than (&gt;)</option>
              <option value="lt">Less Than (&lt;)</option>
              <option value="equals">Exact Value (=)</option>
            </select>
          </div>

          {/* Range Inputs */}
          <div className="grid grid-cols-2 gap-2">
            {operator !== "lte" && operator !== "lt" && (
              <div
                className={operator === "between" ? "col-span-1" : "col-span-2"}
              >
                <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                  {operator === "between" ? "Min Value" : "Value"}{" "}
                  {isChange ? "(%)" : ""}:
                </label>
                <input
                  type="number"
                  step="any"
                  value={minVal}
                  onChange={(e) => setMinVal(e.target.value)}
                  placeholder={isChange ? "e.g. 2.5" : "e.g. 50"}
                  className="w-full rounded border border-border px-2 py-1 text-xs text-foreground focus:border-ring dark:focus:border-zinc-400 focus:outline-hidden font-mono"
                />
              </div>
            )}
            {(operator === "lte" ||
              operator === "lt" ||
              operator === "between") && (
              <div
                className={operator === "between" ? "col-span-1" : "col-span-2"}
              >
                <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                  {operator === "between" ? "Max Value" : "Value"}{" "}
                  {isChange ? "(%)" : ""}:
                </label>
                <input
                  type="number"
                  step="any"
                  value={maxVal}
                  onChange={(e) => setMaxVal(e.target.value)}
                  placeholder={isChange ? "e.g. 10.0" : "e.g. 70"}
                  className="w-full rounded border border-border px-2 py-1 text-xs text-foreground focus:border-ring dark:focus:border-zinc-400 focus:outline-hidden font-mono"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t border-border pt-2.5 mt-3">
        <button
          type="button"
          onClick={handleClear}
          className="text-xs font-semibold text-muted-foreground hover:text-error dark:hover:text-rose-400 px-2 py-1 rounded hover:bg-muted"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="bg-black dark:bg-muted text-white dark:text-zinc-950 px-3 py-1 rounded text-xs font-bold hover:bg-primary/90 dark:hover:bg-zinc-200 shadow-xs"
        >
          Apply Filter
        </button>
      </div>
    </div>,
    document.body,
  );
}

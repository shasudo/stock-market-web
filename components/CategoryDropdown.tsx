"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Building2, ChevronDown, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const optionLabelCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function sortByLabel<T extends { label: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) =>
    optionLabelCollator.compare(a.label, b.label),
  );
}

// Quick 1-click timeframe pills
const QUICK_TIMEFRAMES = [
  { id: "tf-5min", label: "5m" },
  { id: "tf-15min", label: "15m" },
  { id: "tf-1hour", label: "1h" },
  { id: "tf-1day", label: "1D" },
  { id: "tf-1week", label: "1W" },
  { id: "tf-1month", label: "1M" },
] as const;

export interface DropdownItem {
  readonly id: string;
  readonly label: string;
}

interface CategoryDropdownProps {
  label: string;
  items: readonly DropdownItem[];
  selectedIds: readonly string[];
  onChange: (selectedIds: string[]) => void;
  isTimeframe?: boolean;
  isCandlestick?: boolean;
  getItemAvailability?: (itemId: string) => {
    readonly disabled: boolean;
    readonly message?: string;
  };
  onAutoSelectDefaultTimeframe?: () => void;
  /**
   * Per-row drill-down, e.g. "view companies forming this pattern". When
   * provided, every row gets a button that opens the drill-down without
   * toggling the checkbox or closing the menu.
   */
  onViewItem?: (item: DropdownItem) => void;
}

export function CategoryDropdown({
  label,
  items,
  selectedIds,
  onChange,
  isTimeframe = false,
  isCandlestick = false,
  getItemAvailability,
  onAutoSelectDefaultTimeframe,
  onViewItem,
}: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [open]);

  const sortedItems = useMemo(() => {
    if (isTimeframe) return items;
    return sortByLabel(items);
  }, [items, isTimeframe]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return sortedItems;
    const q = search.toLowerCase();
    return sortedItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [sortedItems, search]);

  const toggleItem = (itemId: string, checked: boolean) => {
    if (checked && getItemAvailability?.(itemId)?.disabled) return;
    if (checked && onAutoSelectDefaultTimeframe) {
      onAutoSelectDefaultTimeframe();
    }
    if (checked) {
      onChange([...selectedIds, itemId]);
    } else {
      onChange(selectedIds.filter((id) => id !== itemId));
    }
  };

  const selectAll = () => {
    const enabled = items
      .filter((item) => !getItemAvailability?.(item.id)?.disabled)
      .map((item) => item.id);
    if (enabled.length > 0 && onAutoSelectDefaultTimeframe) {
      onAutoSelectDefaultTimeframe();
    }
    onChange(enabled);
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectBullish = () => {
    const bullish = items
      .filter(
        (item) =>
          item.id.includes("bullish") &&
          !getItemAvailability?.(item.id)?.disabled,
      )
      .map((item) => item.id);
    if (bullish.length > 0 && onAutoSelectDefaultTimeframe) {
      onAutoSelectDefaultTimeframe();
    }
    onChange(bullish);
  };

  const selectBearish = () => {
    const bearish = items
      .filter(
        (item) =>
          item.id.includes("bearish") &&
          !getItemAvailability?.(item.id)?.disabled,
      )
      .map((item) => item.id);
    if (bearish.length > 0 && onAutoSelectDefaultTimeframe) {
      onAutoSelectDefaultTimeframe();
    }
    onChange(bearish);
  };

  const count = selectedIds.length;
  const isSelected = count > 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm border transition-all select-none ${
            isSelected
              ? "border-black dark:border-border bg-black dark:bg-muted text-white dark:text-zinc-950 shadow-xs"
              : "border-border bg-card text-foreground hover:border-black dark:hover:border-zinc-400 hover:bg-muted"
          }`}
          title={`${label} (${count} selected)`}
        >
          <span className="truncate max-w-[130px]">{label}</span>
          {isSelected && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold bg-card text-foreground leading-none">
              {count}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              open ? "rotate-180 opacity-100" : "opacity-60"
            }`}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-72 border border-border bg-card p-0 text-foreground shadow-xl rounded-md overflow-hidden z-50 animate-in fade-in-50 zoom-in-95 duration-100"
      >
        {/* Quick Timeframes for Timeframe Dropdown */}
        {isTimeframe && (
          <div className="border-b border-border bg-muted px-2.5 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Quick Select
            </div>
            <div className="flex flex-wrap gap-1">
              {QUICK_TIMEFRAMES.map((tf) => {
                const checked = selectedIds.includes(tf.id);
                return (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => toggleItem(tf.id, !checked)}
                    className={`px-2 py-0.5 text-xs font-bold rounded transition-colors ${
                      checked
                        ? "bg-black dark:bg-muted text-white dark:text-zinc-950"
                        : "bg-card text-foreground border border-border hover:bg-muted"
                    }`}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="border-b border-border p-2 bg-card">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full rounded border border-border pl-8 pr-7 py-1 text-xs focus:border-ring dark:focus:border-zinc-400 focus:outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[11px] bg-muted/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="font-semibold text-primary dark:text-blue-300 hover:underline"
            >
              Select All
            </button>
            {isCandlestick && (
              <>
                <span className="text-muted-foreground">|</span>
                <button
                  type="button"
                  onClick={selectBullish}
                  className="font-semibold text-success dark:text-emerald-300 hover:underline flex items-center gap-1"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Bullish
                </button>
                <span className="text-muted-foreground">|</span>
                <button
                  type="button"
                  onClick={selectBearish}
                  className="font-semibold text-error dark:text-rose-300 hover:underline flex items-center gap-1"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-error" />
                  Bearish
                </button>
              </>
            )}
          </div>
          {count > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="font-semibold text-error dark:text-rose-400 hover:underline"
            >
              Clear ({count})
            </button>
          )}
        </div>

        {/* Scrollable Item List */}
        <div className="max-h-64 overflow-y-auto py-1 divide-y divide-border scrollbar-thin">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No matching items found
            </div>
          ) : (
            filteredItems.map((item) => {
              const isChecked = selectedIds.includes(item.id);
              const availability = getItemAvailability?.(item.id);
              const isDisabled = Boolean(availability?.disabled);
              const isBullishPattern = item.id.includes("bullish");
              const isBearishPattern = item.id.includes("bearish");

              return (
                <label
                  key={item.id}
                  title={availability?.message}
                  className={`flex cursor-pointer items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                    isDisabled
                      ? "opacity-40 cursor-not-allowed bg-muted"
                      : isChecked
                        ? "bg-muted hover:bg-muted/80 font-medium"
                        : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate mr-2">
                    {isBullishPattern && (
                      <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                    )}
                    {isBearishPattern && (
                      <span className="h-1.5 w-1.5 rounded-full bg-error shrink-0" />
                    )}
                    <span className="truncate text-foreground">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {onViewItem && (
                      <button
                        type="button"
                        title={`View companies forming ${item.label}`}
                        aria-label={`View companies forming ${item.label}`}
                        onClick={(e) => {
                          // The row is a <label>: without preventDefault the
                          // click would also toggle the checkbox.
                          e.preventDefault();
                          e.stopPropagation();
                          onViewItem(item);
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Building2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={(e) => toggleItem(item.id, e.target.checked)}
                      className="h-3.5 w-3.5 accent-black shrink-0 cursor-pointer"
                    />
                  </div>
                </label>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-border bg-muted px-3 py-1.5 text-[10px] text-muted-foreground flex justify-between items-center">
          <span>{items.length} total options</span>
          {count > 0 && (
            <span className="font-semibold text-foreground">
              {count} selected
            </span>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default CategoryDropdown;

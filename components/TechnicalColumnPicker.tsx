"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, ChevronRight, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  AddColumnGroupOption,
  AddColumnSelection,
} from "@/lib/screener-columns";

const optionLabelCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function sortByLabel<T extends { label: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) =>
    optionLabelCollator.compare(a.label, b.label),
  );
}

// Prominent standard timeframes for 1-click toggles
const QUICK_TIMEFRAMES = [
  { id: "tf-5min", label: "5m" },
  { id: "tf-15min", label: "15m" },
  { id: "tf-1hour", label: "1h" },
  { id: "tf-1day", label: "1D" },
  { id: "tf-1week", label: "1W" },
  { id: "tf-1month", label: "1M" },
] as const;

interface TechnicalColumnPickerProps {
  groups: AddColumnGroupOption[];
  timeframeOptions: readonly { id: string; label: string }[];
  selection: AddColumnSelection;
  onChange: (selection: AddColumnSelection) => void;
  children: ReactNode;
  align?: "start" | "center" | "end";
  contentClassName?: string;
  getItemAvailability?: (
    groupId: string,
    itemId: string,
  ) => { readonly disabled: boolean; readonly message?: string };
  getTimeframeAvailability?: (timeframeId: string) => {
    readonly disabled: boolean;
    readonly message?: string;
  };
}

export function TechnicalColumnPicker({
  groups,
  timeframeOptions,
  selection,
  onChange,
  children,
  align = "start",
  contentClassName = "w-80 border-border bg-card p-0 text-foreground shadow-xl rounded-md overflow-hidden",
  getItemAvailability,
  getTimeframeAvailability,
}: TechnicalColumnPickerProps) {
  const [view, setView] = useState<string>("root");
  const [search, setSearch] = useState("");

  const defaultTimeframe = () =>
    [
      timeframeOptions.find((o) => o.id === "tf-1day")?.id ||
        timeframeOptions[0]?.id,
    ].filter((id): id is string => Boolean(id));

  const toggleTimeframe = (timeframeId: string, checked: boolean) => {
    if (checked && getTimeframeAvailability?.(timeframeId)?.disabled) return;
    const current = selection.timeframes;
    onChange({
      ...selection,
      timeframes: checked
        ? current.includes(timeframeId)
          ? current
          : [...current, timeframeId]
        : current.filter((id) => id !== timeframeId),
    });
  };

  const setTimeframes = (timeframes: string[]) =>
    onChange({
      ...selection,
      timeframes: timeframes.filter(
        (timeframeId) => !getTimeframeAvailability?.(timeframeId)?.disabled,
      ),
    });

  const toggleGroupItem = (
    groupId: string,
    itemId: string,
    checked: boolean,
  ) => {
    if (checked && getItemAvailability?.(groupId, itemId)?.disabled) return;
    const current = selection.groups[groupId] || [];
    const nextItems = checked
      ? current.includes(itemId)
        ? current
        : [...current, itemId]
      : current.filter((id) => id !== itemId);

    onChange({
      timeframes:
        checked && selection.timeframes.length === 0
          ? defaultTimeframe()
          : selection.timeframes,
      groups: { ...selection.groups, [groupId]: nextItems },
    });
  };

  const setGroupItems = (groupId: string, itemIds: string[]) => {
    const enabledItems = itemIds.filter(
      (itemId) => !getItemAvailability?.(groupId, itemId)?.disabled,
    );
    onChange({
      timeframes:
        enabledItems.length > 0 && selection.timeframes.length === 0
          ? defaultTimeframe()
          : selection.timeframes,
      groups: { ...selection.groups, [groupId]: enabledItems },
    });
  };

  const totalSelectedItems = Object.values(selection.groups).reduce(
    (acc, items) => acc + items.length,
    0,
  );

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) {
          setView("root");
          setSearch("");
        }
      }}
    >
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={contentClassName}>
        {/* Top Quick Timeframe Bar */}
        <div className="border-b border-border bg-muted px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Timeframes</span>
            <button
              type="button"
              onClick={() => {
                setView("timeframes");
                setSearch("");
              }}
              className="text-primary dark:text-blue-300 hover:underline normal-case text-[11px]"
            >
              All ({selection.timeframes.length}) &rarr;
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_TIMEFRAMES.map((tf) => {
              const isSelected = selection.timeframes.includes(tf.id);
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => toggleTimeframe(tf.id, !isSelected)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                    isSelected
                      ? "bg-black dark:bg-muted text-white dark:text-zinc-950 shadow-sm"
                      : "bg-card text-foreground border border-border hover:bg-muted"
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>

        {view === "root" ? (
          <div>
            {/* Global Search Box */}
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search indicators, patterns..."
                  className="w-full rounded border border-border pl-8 pr-2 py-1 text-xs focus:border-ring dark:focus:border-zinc-400 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1.5 text-muted-foreground hover:text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {search.trim() ? (
              <div className="max-h-72 overflow-y-auto py-1 divide-y divide-border">
                {groups.map((group) => {
                  const matchingItems = group.items.filter((item) =>
                    item.label.toLowerCase().includes(search.toLowerCase()),
                  );
                  if (matchingItems.length === 0) return null;
                  const selectedItems = selection.groups[group.id] || [];

                  return (
                    <div key={group.id} className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </div>
                      {matchingItems.map((item) => {
                        const isSelected = selectedItems.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className="flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm hover:bg-muted"
                          >
                            <span className="truncate">{item.label}</span>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                toggleGroupItem(
                                  group.id,
                                  item.id,
                                  e.target.checked,
                                )
                              }
                              className="h-3.5 w-3.5 accent-black"
                            />
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-1 divide-y divide-border">
                {groups.map((group) => {
                  const count = selection.groups[group.id]?.length || 0;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        setView(group.id);
                        setSearch("");
                      }}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors"
                    >
                      <span className="font-medium text-foreground">
                        {group.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {count > 0 && (
                          <span className="min-w-[18px] rounded-full bg-black dark:bg-muted px-1.5 text-center text-[10px] font-bold leading-[18px] text-white dark:text-zinc-950">
                            {count}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {totalSelectedItems > 0 && (
              <div className="border-t border-border bg-muted px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  {totalSelectedItems} selected
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ timeframes: [], groups: {} })}
                  className="font-medium text-error dark:text-rose-400 hover:underline"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        ) : (
          (() => {
            if (view === "timeframes") {
              const filteredTimeframes = timeframeOptions.filter((item) =>
                item.label.toLowerCase().includes(search.toLowerCase()),
              );
              return (
                <div>
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setView("root");
                        setSearch("");
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </button>
                    <span className="text-xs font-bold text-foreground">
                      All Timeframes
                    </span>
                    <div className="w-10" />
                  </div>
                  <div className="border-b border-border p-2">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search timeframes..."
                      className="w-full rounded border border-border px-2 py-1 text-xs focus:border-ring dark:focus:border-zinc-400 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-between border-b border-border px-3 py-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setTimeframes(timeframeOptions.map((item) => item.id))
                      }
                      className="font-medium text-primary dark:text-blue-300 hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeframes([])}
                      className="font-medium text-error dark:text-rose-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {filteredTimeframes.map((item) => {
                      const isSelected = selection.timeframes.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm hover:bg-muted"
                        >
                          <span>{item.label}</span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              toggleTimeframe(item.id, e.target.checked)
                            }
                            className="h-3.5 w-3.5 accent-black"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const group = groups.find((item) => item.id === view);
            if (!group) return null;
            const selectedItems = selection.groups[group.id] || [];
            const filteredItems = sortByLabel(
              group.items.filter((item) =>
                item.label.toLowerCase().includes(search.toLowerCase()),
              ),
            );

            return (
              <div>
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setView("root");
                      setSearch("");
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <span className="text-xs font-bold text-foreground truncate max-w-[140px]">
                    {group.label}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {selectedItems.length}/{group.items.length}
                  </span>
                </div>
                <div className="border-b border-border p-2">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search ${group.label.toLowerCase()}...`}
                    className="w-full rounded border border-border px-2 py-1 text-xs focus:border-ring dark:focus:border-zinc-400 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex justify-between border-b border-border px-3 py-1.5 text-[11px]">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setGroupItems(
                          group.id,
                          group.items.map((item) => item.id),
                        )
                      }
                      className="font-medium text-primary dark:text-blue-300 hover:underline"
                    >
                      Select All
                    </button>
                    {group.id === "candlesticks" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setGroupItems(
                              group.id,
                              group.items
                                .filter((i) => i.id.includes("bullish"))
                                .map((i) => i.id),
                            )
                          }
                          className="font-medium text-success dark:text-emerald-300 hover:underline"
                        >
                          Bullish
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setGroupItems(
                              group.id,
                              group.items
                                .filter((i) => i.id.includes("bearish"))
                                .map((i) => i.id),
                            )
                          }
                          className="font-medium text-error dark:text-rose-300 hover:underline"
                        >
                          Bearish
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setGroupItems(group.id, [])}
                    className="font-medium text-error dark:text-rose-400 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {filteredItems.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      No matches found
                    </div>
                  ) : (
                    filteredItems.map((item) => {
                      const isSelected = selectedItems.includes(item.id);
                      const isBullish = item.id.includes("bullish");
                      const isBearish = item.id.includes("bearish");
                      return (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {isBullish && (
                              <span className="h-2 w-2 rounded-full bg-success flex-shrink-0" />
                            )}
                            {isBearish && (
                              <span className="h-2 w-2 rounded-full bg-error flex-shrink-0" />
                            )}
                            <span className="truncate">{item.label}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              toggleGroupItem(
                                group.id,
                                item.id,
                                e.target.checked,
                              )
                            }
                            className="h-3.5 w-3.5 accent-black flex-shrink-0"
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default TechnicalColumnPicker;

"use client";

import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TechnicalColumnPicker from "@/components/TechnicalColumnPicker";
import CategoryDropdown from "@/components/CategoryDropdown";
import SavedViewsMenu from "@/components/SavedViewsMenu";
import type {
  SavedViewPayload,
  SavedViewScope,
} from "@/lib/validations/saved-views";
import type {
  AddColumnGroupOption,
  AddColumnSelection,
} from "@/lib/screener-columns";
import {
  NSE_SECTORS,
  getIndustriesForSectors,
} from "@/lib/market/nse-sector-classification";

export interface FilterState {
  sectors: string[];
  industries: string[];
  marketCaps: string[];
  priceBands: string[];
  series: string[];
  priceMin: string;
  priceMax: string;
  changeMin: string;
  changeMax: string;
  volumeMin: string;
  marketCapMin: string;
  marketCapMax: string;
}

export interface FilterOptions {
  sectors: string[];
  industries: string[];
  marketCaps: string[];
  priceBands: string[];
  series: string[];
}

export const emptyFilters: FilterState = {
  sectors: [],
  industries: [],
  marketCaps: [],
  priceBands: [],
  series: [],
  priceMin: "",
  priceMax: "",
  changeMin: "",
  changeMax: "",
  volumeMin: "",
  marketCapMin: "",
  marketCapMax: "",
};

export function normalizeFilterState(raw: unknown): FilterState {
  if (!raw || typeof raw !== "object") {
    return { ...emptyFilters };
  }
  const obj = raw as Record<string, unknown>;
  return {
    sectors: Array.isArray(obj.sectors)
      ? obj.sectors.filter((s): s is string => typeof s === "string")
      : [],
    industries: Array.isArray(obj.industries)
      ? obj.industries.filter((s): s is string => typeof s === "string")
      : [],
    marketCaps: Array.isArray(obj.marketCaps)
      ? obj.marketCaps.filter((s): s is string => typeof s === "string")
      : [],
    priceBands: Array.isArray(obj.priceBands)
      ? obj.priceBands.filter((s): s is string => typeof s === "string")
      : [],
    series: Array.isArray(obj.series)
      ? obj.series.filter((s): s is string => typeof s === "string")
      : [],
    priceMin: typeof obj.priceMin === "string" ? obj.priceMin : "",
    priceMax: typeof obj.priceMax === "string" ? obj.priceMax : "",
    changeMin: typeof obj.changeMin === "string" ? obj.changeMin : "",
    changeMax: typeof obj.changeMax === "string" ? obj.changeMax : "",
    volumeMin: typeof obj.volumeMin === "string" ? obj.volumeMin : "",
    marketCapMin: typeof obj.marketCapMin === "string" ? obj.marketCapMin : "",
    marketCapMax: typeof obj.marketCapMax === "string" ? obj.marketCapMax : "",
  };
}

export const emptyFilterOptions: FilterOptions = {
  sectors: [],
  industries: [],
  marketCaps: [],
  priceBands: [],
  series: [],
};

export type { AddColumnGroupOption, AddColumnSelection };

export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.sectors.length > 0 ||
    f.industries.length > 0 ||
    f.marketCaps.length > 0 ||
    f.priceBands.length > 0 ||
    f.series.length > 0 ||
    !!f.priceMin ||
    !!f.priceMax ||
    !!f.changeMin ||
    !!f.changeMax ||
    !!f.volumeMin ||
    !!f.marketCapMin ||
    !!f.marketCapMax
  );
}

function countActive(f: FilterState): number {
  let n = 0;
  if (f.sectors.length) n++;
  if (f.industries.length) n++;
  if (f.marketCaps.length) n++;
  if (f.priceBands.length) n++;
  if (f.series.length) n++;
  if (f.priceMin) n++;
  if (f.priceMax) n++;
  if (f.changeMin) n++;
  if (f.changeMax) n++;
  if (f.volumeMin) n++;
  if (f.marketCapMin) n++;
  if (f.marketCapMax) n++;
  return n;
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (val: string) => {
    onChange(
      selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val],
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
          selected.length > 0
            ? "border-primary dark:border-indigo-400 bg-primary text-primary-foreground shadow-xs"
            : "border-border bg-card text-muted-foreground hover:bg-muted"
        } flex items-center gap-1.5`}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-white/25 dark:bg-zinc-950/10 text-white dark:text-zinc-950 text-[10px] leading-none px-1 py-0.5 rounded-full font-bold min-w-[16px] text-center">
            {selected.length}
          </span>
        )}
        <span className="text-[10px] opacity-60">
          {open ? "\u25B2" : "\u25BC"}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-card border border-border shadow-lg rounded-xl w-64 overflow-hidden">
          {options.length > 6 && (
            <div className="p-2 border-b border-border">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full rounded-lg border border-border px-2 py-1 text-xs focus:outline-none focus:border-ring"
                autoFocus
              />
            </div>
          )}
          <div className="flex gap-3 px-2 py-1.5 border-b border-border">
            <button
              onClick={() => onChange([...options])}
              className="text-[11px] text-primary dark:text-blue-300 hover:underline font-medium"
            >
              Select All
            </button>
            <button
              onClick={() => onChange([])}
              className="text-[11px] text-error dark:text-rose-400 hover:underline font-medium"
            >
              Clear
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground text-center">
                No matches
              </div>
            )}
            {filtered.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="w-3.5 h-3.5 accent-indigo-600"
                />
                <span className="truncate">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  filters: FilterState;
  options: FilterOptions;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  hiddenColumns: Set<string>;
  onHiddenColumnsChange: (cols: Set<string>) => void;
  toggleableColumns: string[];
  addColumnOptions?: string[];
  onAddColumn?: (column: string) => void;
  selectedAddedColumnOptions?: string[];
  onAddedColumnOptionChange?: (option: string, checked: boolean) => void;
  addColumnGroups?: AddColumnGroupOption[];
  timeframeOptions?: readonly { id: string; label: string }[];
  selectedAddColumnConfig?: AddColumnSelection;
  onAddColumnConfigChange?: (config: AddColumnSelection) => void;
  getAddedColumnItemAvailability?: (
    groupId: string,
    itemId: string,
  ) => { readonly disabled: boolean; readonly message?: string };
  getAddedColumnTimeframeAvailability?: (timeframeId: string) => {
    readonly disabled: boolean;
    readonly message?: string;
  };

  /**
   * Per-option drill-down for a column group, e.g. viewing the companies
   * forming one candlestick or chart pattern. The screen owns the dialog
   * because it holds the universe data the panel never sees.
   */
  onViewGroupItem?: (groupId: string, itemId: string, label: string) => void;
  /**
   * Opt into the saved-views dropdown. The screen owns the payload because it
   * knows about state the panel never sees (exchange, tab, sort).
   */
  savedViewScope?: SavedViewScope;
  savedViewPayload?: SavedViewPayload;
  onSavedViewApply?: (payload: SavedViewPayload) => void;
}

export default function FilterPanel({
  filters,
  options,
  onChange,
  onReset,
  hiddenColumns,
  onHiddenColumnsChange,
  toggleableColumns,
  addColumnOptions = [],
  onAddColumn,
  selectedAddedColumnOptions = [],
  onAddedColumnOptionChange,
  addColumnGroups = [],
  timeframeOptions = [],
  selectedAddColumnConfig,
  onAddColumnConfigChange,
  getAddedColumnItemAvailability,
  getAddedColumnTimeframeAvailability,
  onViewGroupItem,
  savedViewScope,
  savedViewPayload,
  onSavedViewApply,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActive(filters);

  const update = (key: keyof FilterState, value: string[] | string) => {
    onChange({ ...filters, [key]: value });
  };

  const updateSectors = (sectors: string[]) => {
    const validIndustries = new Set(getIndustriesForSectors(sectors));
    onChange({
      ...filters,
      sectors,
      industries: (filters.industries ?? []).filter((i) =>
        validIndustries.has(i),
      ),
    });
  };

  const industryOptions = getIndustriesForSectors(filters.sectors ?? []);

  const removeChip = (type: keyof FilterState, value: string) => {
    const current = filters[type];
    if (Array.isArray(current)) {
      onChange({
        ...filters,
        [type]: (current as string[]).filter((v) => v !== value),
      });
    } else {
      onChange({ ...filters, [type]: "" });
    }
  };

  const chips: { label: string; type: keyof FilterState; value: string }[] = [];
  for (const s of filters.sectors ?? [])
    chips.push({ label: s, type: "sectors", value: s });
  for (const s of filters.industries ?? [])
    chips.push({ label: s, type: "industries", value: s });
  for (const s of filters.marketCaps ?? [])
    chips.push({ label: s, type: "marketCaps", value: s });
  for (const s of filters.priceBands ?? [])
    chips.push({ label: `Band: ${s}`, type: "priceBands", value: s });
  for (const s of filters.series ?? [])
    chips.push({ label: `Series: ${s}`, type: "series", value: s });
  if (filters.marketCapMin)
    chips.push({
      label: `M Cap \u2265 ${Number(filters.marketCapMin).toLocaleString()} Cr`,
      type: "marketCapMin",
      value: filters.marketCapMin,
    });
  if (filters.marketCapMax)
    chips.push({
      label: `M Cap \u2264 ${Number(filters.marketCapMax).toLocaleString()} Cr`,
      type: "marketCapMax",
      value: filters.marketCapMax,
    });
  if (filters.priceMin)
    chips.push({
      label: `Price \u2265 \u20B9${filters.priceMin}`,
      type: "priceMin",
      value: filters.priceMin,
    });
  if (filters.priceMax)
    chips.push({
      label: `Price \u2264 \u20B9${filters.priceMax}`,
      type: "priceMax",
      value: filters.priceMax,
    });
  if (filters.changeMin)
    chips.push({
      label: `Change \u2265 ${filters.changeMin}%`,
      type: "changeMin",
      value: filters.changeMin,
    });
  if (filters.changeMax)
    chips.push({
      label: `Change \u2264 ${filters.changeMax}%`,
      type: "changeMax",
      value: filters.changeMax,
    });
  if (filters.volumeMin)
    chips.push({
      label: `Vol \u2265 ${Number(filters.volumeMin).toLocaleString()}`,
      type: "volumeMin",
      value: filters.volumeMin,
    });

  const toggleColumn = (col: string) => {
    const next = new Set(hiddenColumns);
    if (next.has(col)) next.delete(col);
    else next.add(col);
    onHiddenColumnsChange(next);
  };

  const selectedAddColumnCount = selectedAddColumnConfig
    ? Object.values(selectedAddColumnConfig.groups).reduce(
        (sum, values) => sum + values.length,
        selectedAddColumnConfig.timeframes.length,
      )
    : 0;

  return (
    <div className="mb-3">
      {}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted"
        >
          <span className="text-[10px]">{expanded ? "\u25BC" : "\u25B6"}</span>
          Filters
          {activeCount > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] leading-none px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
              {activeCount}
            </span>
          )}
        </button>
        {onAddColumnConfigChange &&
        selectedAddColumnConfig &&
        addColumnGroups.length > 0 ? (
          <>
            <CategoryDropdown
              label="Timeframe"
              items={timeframeOptions}
              selectedIds={selectedAddColumnConfig.timeframes}
              isTimeframe
              onChange={(nextTfs) =>
                onAddColumnConfigChange({
                  ...selectedAddColumnConfig,
                  timeframes: nextTfs,
                })
              }
              getItemAvailability={(id) =>
                getAddedColumnTimeframeAvailability?.(id) ?? { disabled: false }
              }
            />
            {addColumnGroups.map((group) => (
              <CategoryDropdown
                key={group.id}
                label={group.label}
                items={group.items}
                selectedIds={selectedAddColumnConfig.groups[group.id] || []}
                isCandlestick={group.id === "candlesticks"}
                onChange={(nextItems) =>
                  onAddColumnConfigChange({
                    timeframes:
                      nextItems.length > 0 &&
                      selectedAddColumnConfig.timeframes.length === 0
                        ? ["tf-1day"]
                        : selectedAddColumnConfig.timeframes,
                    groups: {
                      ...selectedAddColumnConfig.groups,
                      [group.id]: nextItems,
                    },
                  })
                }
                onAutoSelectDefaultTimeframe={() => {
                  if (selectedAddColumnConfig.timeframes.length === 0) {
                    onAddColumnConfigChange({
                      ...selectedAddColumnConfig,
                      timeframes: ["tf-1day"],
                    });
                  }
                }}
                getItemAvailability={(itemId) =>
                  getAddedColumnItemAvailability?.(group.id, itemId) ?? {
                    disabled: false,
                  }
                }
                onViewItem={
                  onViewGroupItem &&
                  (group.id === "candlesticks" || group.id === "chart-patterns")
                    ? (item) => onViewGroupItem(group.id, item.id, item.label)
                    : undefined
                }
              />
            ))}
          </>
        ) : (
          (onAddColumn || onAddedColumnOptionChange) &&
          addColumnOptions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Add column"
                  title="Add column"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-64 rounded-xl border-border bg-card p-1 text-foreground"
              >
                {addColumnOptions.map((option, index) => {
                  const checked = selectedAddedColumnOptions.includes(option);
                  return (
                    <div key={option}>
                      {index === 1 && (
                        <div className="my-1 border-t border-border" />
                      )}
                      <label
                        className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted ${index > 0 ? "pl-10" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            if (onAddedColumnOptionChange) {
                              onAddedColumnOptionChange(
                                option,
                                event.target.checked,
                              );
                              return;
                            }
                            if (onAddColumn) onAddColumn(option);
                          }}
                          className="h-3.5 w-3.5 accent-indigo-600"
                        />
                        <span>{option}</span>
                      </label>
                    </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )}
        {savedViewScope && savedViewPayload && onSavedViewApply && (
          <SavedViewsMenu
            scope={savedViewScope}
            currentPayload={savedViewPayload}
            onApply={onSavedViewApply}
          />
        )}
        {activeCount > 0 && (
          <button
            onClick={onReset}
            className="text-xs text-error dark:text-rose-400 hover:underline font-medium"
          >
            Reset All
          </button>
        )}
      </div>

      {}
      {expanded && (
        <div className="mt-2 rounded-2xl border border-border p-3 bg-card shadow-xs space-y-3">
          {}
          <div className="flex flex-wrap gap-2">
            <MultiSelect
              label="Sector"
              options={[...NSE_SECTORS]}
              selected={filters.sectors}
              onChange={updateSectors}
            />
            <MultiSelect
              label="Industry"
              options={industryOptions}
              selected={filters.industries}
              onChange={(v) => update("industries", v)}
            />
            <MultiSelect
              label="Market Cap"
              options={
                options.marketCaps.length > 0
                  ? options.marketCaps
                  : ["Large Cap", "Mid Cap", "Small Cap", "Micro Cap"]
              }
              selected={filters.marketCaps}
              onChange={(v) => update("marketCaps", v)}
            />
            <MultiSelect
              label="Price Band"
              options={options.priceBands}
              selected={filters.priceBands}
              onChange={(v) => update("priceBands", v)}
            />
            <MultiSelect
              label="Series"
              options={options.series}
              selected={filters.series}
              onChange={(v) => update("series", v)}
            />
          </div>

          {}
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-muted-foreground whitespace-nowrap">
                M Cap (Cr):
              </span>
              <input
                type="number"
                placeholder="Min"
                value={filters.marketCapMin}
                onChange={(e) => update("marketCapMin", e.target.value)}
                className="w-28 rounded-lg border border-border px-2 py-1 text-xs focus:outline-none focus:border-ring"
              />
              <span className="text-muted-foreground">&mdash;</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.marketCapMax}
                onChange={(e) => update("marketCapMax", e.target.value)}
                className="w-28 rounded-lg border border-border px-2 py-1 text-xs focus:outline-none focus:border-ring"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-muted-foreground whitespace-nowrap">
                Price (\u20B9):
              </span>
              <input
                type="number"
                placeholder="Min"
                value={filters.priceMin}
                onChange={(e) => update("priceMin", e.target.value)}
                className="w-24 rounded-lg border border-border px-2 py-1 text-xs focus:outline-none focus:border-ring"
              />
              <span className="text-muted-foreground">&mdash;</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.priceMax}
                onChange={(e) => update("priceMax", e.target.value)}
                className="w-24 rounded-lg border border-border px-2 py-1 text-xs focus:outline-none focus:border-ring"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-muted-foreground whitespace-nowrap">
                % Change:
              </span>
              <input
                type="number"
                step="0.1"
                placeholder="Min"
                value={filters.changeMin}
                onChange={(e) => update("changeMin", e.target.value)}
                className="w-24 rounded-lg border border-border px-2 py-1 text-xs focus:outline-none focus:border-ring"
              />
              <span className="text-muted-foreground">&mdash;</span>
              <input
                type="number"
                step="0.1"
                placeholder="Max"
                value={filters.changeMax}
                onChange={(e) => update("changeMax", e.target.value)}
                className="w-24 rounded-lg border border-border px-2 py-1 text-xs focus:outline-none focus:border-ring"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-muted-foreground whitespace-nowrap">
                Min Volume:
              </span>
              <input
                type="number"
                placeholder="e.g. 100000"
                value={filters.volumeMin}
                onChange={(e) => update("volumeMin", e.target.value)}
                className="w-28 rounded-lg border border-border px-2 py-1 text-xs focus:outline-none focus:border-ring"
              />
            </div>
          </div>

          {}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t border-border">
            <span className="text-xs font-medium text-muted-foreground">
              Show Columns:
            </span>
            {toggleableColumns.map((col) => (
              <label
                key={col}
                className="flex items-center gap-1 text-xs cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={!hiddenColumns.has(col)}
                  onChange={() => toggleColumn(col)}
                  className="w-3.5 h-3.5 accent-indigo-600"
                />
                <span
                  className={
                    hiddenColumns.has(col)
                      ? "text-muted-foreground"
                      : "text-foreground"
                  }
                >
                  {col}
                </span>
              </label>
            ))}
          </div>

          {}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
              <span className="text-xs font-medium text-muted-foreground self-center mr-1">
                Active:
              </span>
              {chips.map((chip, i) => (
                <span
                  key={`${chip.type}-${i}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted border border-border text-xs rounded-full"
                >
                  {chip.label}
                  <button
                    onClick={() => removeChip(chip.type, chip.value)}
                    className="text-muted-foreground hover:text-red-500 dark:hover:text-rose-400 font-bold text-sm leading-none"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

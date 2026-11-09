"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
  X,
} from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import {
  NSE_SECTORS,
  getIndustriesForSectors,
} from "@/lib/market/nse-sector-classification";
import {
  fetchHistoricalData,
  getHistoricalDataClientErrorMessage,
  isHistoricalDataRequestAborted,
  type HistoricalDataResponse,
  type HistoricalDataRowDTO,
  type HistoricalExchangeInput,
  type HistoricalPeriod,
  type HistoricalSortField,
} from "@/lib/market-data/historical-data-client";
import { isMarketLiveResponse } from "@/lib/market/client-contract";

import { unwrapApiEnvelope } from "@/lib/api-envelope";
// Same exchange scopes the VGS Reddy screener offers -- the four
// "<Exchange> <Segment>" entries are one-click shortcuts there, kept so the
// two lists read the same.
const EXCHANGE_OPTIONS = [
  "NSE",
  "BSE",
  "Both",
  "Merged",
  "Only NSE",
  "Only BSE",
  "NSE FNO",
  "BSE FNO",
  "NSE Indices",
  "BSE Indices",
];

const SEGMENT_OPTIONS = [
  "Equity",
  "F&O Stocks (EQ)",
  "Index Futures",
  "Index Options",
  "Stock Futures",
  "Stock Options",
  "NSE Broad Market Indices",
  "NSE Sectoral Indices",
  "BSE Broad Market Indices",
  "BSE Sectoral Indices",
];

// The four "<Exchange> <Segment>" entries are one-click shortcuts, as on the
// VGS Reddy screener: they set the exchange scope and the matching segment.
const EXCHANGE_SEGMENT_SHORTCUTS: Record<
  string,
  { exchange: HistoricalExchangeInput; segment: string }
> = {
  "NSE FNO": { exchange: "NSE", segment: "F&O Stocks (EQ)" },
  "BSE FNO": { exchange: "BSE", segment: "F&O Stocks (EQ)" },
  "NSE Indices": { exchange: "NSE", segment: "NSE Broad Market Indices" },
  "BSE Indices": { exchange: "BSE", segment: "BSE Broad Market Indices" },
};

// Daily candles are only stored for the equity universe (see
// lib/backtest/candle-loader.ts); the derivative and index segments have no
// history behind them yet, so the page says so instead of showing nothing.
const SEGMENTS_WITH_HISTORY = new Set(["Equity", "F&O Stocks (EQ)"]);

const TIME_PERIOD_OPTIONS = [
  "10 Days",
  "1 Month",
  "3 Months",
  "6 Months",
  "1 Year",
  "3 Years",
  "5 Years",
];

const TIME_PERIOD_IDS: Record<string, HistoricalPeriod> = {
  "10 Days": "10d",
  "1 Month": "1m",
  "3 Months": "3m",
  "6 Months": "6m",
  "1 Year": "1y",
  "3 Years": "3y",
  "5 Years": "5y",
};

const COLUMNS: readonly {
  label: string;
  sort: HistoricalSortField;
  defaultOrder: "asc" | "desc";
}[] = [
  { label: "Date", sort: "date", defaultOrder: "desc" },
  { label: "Company Name", sort: "company", defaultOrder: "asc" },
  { label: "Pre Close", sort: "preClose", defaultOrder: "desc" },
  { label: "Open", sort: "open", defaultOrder: "desc" },
  { label: "High", sort: "high", defaultOrder: "desc" },
  { label: "Low", sort: "low", defaultOrder: "desc" },
  { label: "Close", sort: "close", defaultOrder: "desc" },
  { label: "Net Change", sort: "netChange", defaultOrder: "desc" },
  { label: "% Change", sort: "pctChange", defaultOrder: "desc" },
  { label: "Volume", sort: "volume", defaultOrder: "desc" },
];

const PAGE_SIZE = 200;
const SEARCH_DEBOUNCE_MS = 300;
const SUGGESTION_COUNT = 8;
const MIN_PICKER_CHARS = 2;

interface StockSuggestion {
  readonly symbol: string;
  readonly company: string;
  readonly exchange: string;
}

interface SelectedStock {
  readonly symbol: string;
  readonly company: string;
  readonly exchange: string;
}

// Whether an exchange scope already includes the picked stock's listing,
// so selecting a stock only switches the scope when it has to.
const exchangeScopeCovers = (scope: string, exchange: string): boolean => {
  if (scope === "Both" || scope === "Merged") return true;
  if (scope === "Only NSE") return exchange === "NSE";
  if (scope === "Only BSE") return exchange === "BSE";
  if (scope === "NSE FNO" || scope === "NSE Indices") return exchange === "NSE";
  if (scope === "BSE FNO" || scope === "BSE Indices") return exchange === "BSE";
  return scope === exchange;
};

const toDisplayDate = (d: Date): string => {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const isoToDisplay = (iso: string): string => {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
};

interface ParsedDisplayDate {
  readonly iso: string;
  readonly valid: boolean;
}

const parseDisplayDate = (input: string): ParsedDisplayDate => {
  const trimmed = input.trim();
  if (!trimmed) return { iso: "", valid: true };

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return { iso: "", valid: false };

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  ) {
    return { iso: "", valid: false };
  }

  return { iso: `${year}-${month}-${day}`, valid: true };
};

function formatSessionDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const price = (value: number | null): string =>
  value === null ? "—" : `₹${value.toFixed(2)}`;

const csvEscape = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

function downloadRowsAsCsv(
  rows: readonly HistoricalDataRowDTO[],
  fileName: string,
): void {
  const header = [
    "Date",
    "Exchange",
    "Symbol",
    "Company Name",
    "Pre Close",
    "Open",
    "High",
    "Low",
    "Close",
    "Net Change",
    "% Change",
    "Volume",
  ];
  const lines = rows.map((row) =>
    [
      row.date,
      row.exchange,
      row.tradingSymbol,
      row.companyName,
      row.preClose,
      row.open,
      row.high,
      row.low,
      row.close,
      row.netChange,
      row.percentChange,
      row.volume,
    ]
      .map((value) => csvEscape(value === null ? "" : String(value)))
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  single = false,
  searchable = false,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Radio-style: one value at a time, shown on the trigger itself. */
  single?: boolean;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (value: string) => {
    if (single) {
      onChange([value]);
      setOpen(false);
      return;
    }
    onChange(
      selected.includes(value)
        ? selected.filter((s) => s !== value)
        : [...selected, value],
    );
  };

  const isActive = !single && selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
          isActive
            ? "border-primary bg-primary text-primary-foreground shadow-xs"
            : "border-border bg-card text-muted-foreground hover:bg-muted"
        } flex items-center gap-1.5`}
      >
        {single && selected[0] ? (
          <>
            <span>{label}:</span>
            <span className="font-semibold text-foreground">{selected[0]}</span>
          </>
        ) : (
          label
        )}
        {isActive && (
          <span className="bg-white/25 dark:bg-zinc-950/10 text-white dark:text-zinc-950 text-[10px] leading-none px-1 py-0.5 rounded-full font-bold min-w-[16px] text-center">
            {selected.length}
          </span>
        )}
        <span className="text-[10px] opacity-60">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-card border border-border/90 shadow-lg rounded-xl w-64 overflow-hidden">
          {searchable && (
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
          {!single && (
            <div className="flex gap-3 px-2 py-1.5 border-b border-border">
              <button
                type="button"
                onClick={() => onChange([...options])}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-error hover:underline font-medium"
              >
                Clear
              </button>
            </div>
          )}
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
                  type={single ? "radio" : "checkbox"}
                  name={single ? label : undefined}
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

function HistoricalRow({ row }: { row: HistoricalDataRowDTO }) {
  const cls =
    "px-3 py-2 text-muted-foreground text-xs border-r border-border whitespace-nowrap";
  const netChange = row.netChange ?? 0;
  const colorClass =
    netChange > 0
      ? "text-emerald-600"
      : netChange < 0
        ? "text-error"
        : "text-muted-foreground";
  const isPositive = (row.percentChange ?? 0) >= 0;

  return (
    <tr className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group">
      <td className={`${cls} text-muted-foreground num-font`}>
        {formatSessionDate(row.date)}
      </td>
      <td className={`${cls} text-foreground font-bold`}>
        <div className="flex items-center gap-2">
          <span>{row.companyName}</span>
          <span className="font-mono text-[10px] font-medium text-muted-foreground">
            {row.tradingSymbol}
          </span>
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/30">
            {row.exchange}
          </span>
        </div>
      </td>
      <td
        className={`${cls} text-right font-mono text-muted-foreground num-font`}
      >
        {price(row.preClose)}
      </td>
      <td
        className={`${cls} text-right font-mono text-muted-foreground num-font`}
      >
        {price(row.open)}
      </td>
      <td
        className={`${cls} text-right font-mono text-muted-foreground num-font`}
      >
        {price(row.high)}
      </td>
      <td
        className={`${cls} text-right font-mono text-muted-foreground num-font`}
      >
        {price(row.low)}
      </td>
      <td
        className={`${cls} text-right font-mono font-bold text-foreground num-font`}
      >
        {price(row.close)}
      </td>
      <td
        className={`${cls} text-right font-mono font-semibold num-font ${colorClass}`}
      >
        {row.netChange === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          `${row.netChange > 0 ? "+" : ""}₹${row.netChange.toFixed(2)}`
        )}
      </td>
      <td className={`${cls} text-right`}>
        {row.percentChange === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font ${
              isPositive
                ? "bg-success/10 text-success border-success/30"
                : "bg-error/10 text-error border-error/30"
            }`}
          >
            {isPositive ? "+" : ""}
            {row.percentChange.toFixed(2)}%
          </span>
        )}
      </td>
      <td
        className={`${cls} text-right font-mono text-muted-foreground num-font`}
      >
        {row.volume === null ? "—" : row.volume.toLocaleString("en-IN")}
      </td>
    </tr>
  );
}

function PaginationControls({
  page,
  totalPages,
  totalRows,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalRows);

  const getPageNumbers = (): (number | "...")[] => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    if (page <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("...", totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1, "...");
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1, "...");
      for (let i = page - 1; i <= page + 1; i++) pages.push(i);
      pages.push("...", totalPages);
    }
    return pages;
  };

  const navButton =
    "p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center justify-between py-3 px-2 border-t border-border bg-muted flex-wrap gap-2">
      <span className="text-xs text-muted-foreground">
        Showing {start.toLocaleString("en-IN")}–{end.toLocaleString("en-IN")} of{" "}
        {totalRows.toLocaleString("en-IN")} rows
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className={navButton}
          title="First page"
        >
          <ChevronsLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={navButton}
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>

        {getPageNumbers().map((p, idx) =>
          p === "..." ? (
            <span
              key={`dots-${idx}`}
              className="px-2 text-xs text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[32px] h-8 px-2 text-xs rounded font-medium ${
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={navButton}
          title="Next page"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className={navButton}
          title="Last page"
        >
          <ChevronsRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
    </div>
  );
}

export default function HistoricalDataPage() {
  const [selectedExchange, setSelectedExchange] = useState<string[]>(["NSE"]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([
    "Equity",
  ]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<string[]>([
    TIME_PERIOD_OPTIONS[0],
  ]);
  // The picked stock drives everything: nothing fetches and no company
  // list renders until one is chosen.
  const [selectedStock, setSelectedStock] = useState<SelectedStock | null>(
    null,
  );
  const [stockPickerInput, setStockPickerInput] = useState("");
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  // The picked stock's exact symbol. Sent as `symbols` (exact match), never
  // as substring `search`, so the list holds only the chosen listing.
  const [appliedSymbol, setAppliedSymbol] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<HistoricalSortField>("date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [data, setData] = useState<HistoricalDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const stockPickerRef = useRef<HTMLDivElement>(null);

  const [customDate, setCustomDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [dateError, setDateError] = useState("");
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [isCustomDatePopupOpen, setIsCustomDatePopupOpen] = useState(false);
  const customDateButtonRef = useRef<HTMLButtonElement>(null);
  const customDatePopupRef = useRef<HTMLDivElement>(null);

  const industryOptions = getIndustriesForSectors(selectedSectors);

  const updateSectors = (sectors: string[]) => {
    const validIndustries = new Set(getIndustriesForSectors(sectors));
    setSelectedSectors(sectors);
    setSelectedIndustries((current) =>
      current.filter((industry) => validIndustries.has(industry)),
    );
    setPage(1);
  };

  const updateIndustries = (industries: string[]) => {
    setSelectedIndustries(industries);
    setPage(1);
  };

  const updateSegments = (segments: string[]) => {
    setSelectedSegments(segments);
    setPage(1);
  };

  // A preset period and a custom range describe the same thing, so picking
  // one clears the other.
  const updateTimePeriod = (period: string[]) => {
    setSelectedTimePeriod(period);
    setCustomDate("");
    setCustomEndDate("");
    setPage(1);
  };

  const updateExchange = (exchange: string[]) => {
    setSelectedExchange(exchange);
    const shortcut = EXCHANGE_SEGMENT_SHORTCUTS[exchange[0] ?? ""];
    if (shortcut) setSelectedSegments([shortcut.segment]);
    setPage(1);
  };

  const handleSort = (column: (typeof COLUMNS)[number]) => {
    if (sort === column.sort) {
      setOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSort(column.sort);
      setOrder(column.defaultOrder);
    }
    setPage(1);
  };

  const segment = selectedSegments[0] ?? "Equity";
  const segmentHasHistory = SEGMENTS_WITH_HISTORY.has(segment);
  const exchangeChoice = selectedExchange[0] ?? "NSE";
  const apiExchange: HistoricalExchangeInput =
    EXCHANGE_SEGMENT_SHORTCUTS[exchangeChoice]?.exchange ??
    (exchangeChoice as HistoricalExchangeInput);
  const period = TIME_PERIOD_IDS[selectedTimePeriod[0] ?? ""] ?? "10d";

  // Type-ahead suggestions for the stock picker, searched across both
  // exchanges so any listing can be picked first. Handler-driven (not an
  // effect) so debounced keystrokes never trip set-state-in-effect.
  const suggestTimerRef = useRef<number | null>(null);
  const suggestControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      suggestControllerRef.current?.abort();
      if (suggestTimerRef.current !== null) {
        window.clearTimeout(suggestTimerRef.current);
      }
    },
    [],
  );

  const updateStockPickerInput = (value: string) => {
    setStockPickerInput(value);
    setIsPickerOpen(true);
    suggestControllerRef.current?.abort();
    if (suggestTimerRef.current !== null) {
      window.clearTimeout(suggestTimerRef.current);
      suggestTimerRef.current = null;
    }
    const query = value.trim();
    if (query.length < MIN_PICKER_CHARS) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    const controller = new AbortController();
    suggestControllerRef.current = controller;
    suggestTimerRef.current = window.setTimeout(() => {
      const load = async (): Promise<void> => {
        try {
          const response = await fetch(
            `/api/market/live?${new URLSearchParams({
              exchange: "Merged",
              search: query,
              pageSize: String(SUGGESTION_COUNT),
            }).toString()}`,
            { cache: "no-store", signal: controller.signal },
          );
          const body: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));
          if (suggestControllerRef.current !== controller) return;
          setSuggestions(
            response.ok && isMarketLiveResponse(body)
              ? body.stocks.map((stock) => ({
                  symbol: stock.tradingSymbol,
                  company: stock.companyName,
                  exchange: stock.exchange,
                }))
              : [],
          );
        } catch {
          if (suggestControllerRef.current === controller) setSuggestions([]);
        } finally {
          if (suggestControllerRef.current === controller) {
            setSuggestionsLoading(false);
          }
        }
      };
      void load();
    }, SEARCH_DEBOUNCE_MS);
  };

  useEffect(() => {
    if (!isPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (stockPickerRef.current && !stockPickerRef.current.contains(target)) {
        setIsPickerOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsPickerOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isPickerOpen]);

  const selectStock = (suggestion: StockSuggestion) => {
    setSelectedStock({
      symbol: suggestion.symbol,
      company: suggestion.company,
      exchange: suggestion.exchange,
    });
    setAppliedSymbol(suggestion.symbol);
    setStockPickerInput("");
    setSuggestions([]);
    setIsPickerOpen(false);
    setData(null);
    setErrorMessage(null);
    setPage(1);
    setSelectedExchange((current) =>
      exchangeScopeCovers(current[0] ?? "NSE", suggestion.exchange)
        ? current
        : [suggestion.exchange],
    );
  };

  const clearSelectedStock = () => {
    setSelectedStock(null);
    setAppliedSymbol("");
    setStockPickerInput("");
    setSuggestions([]);
    setData(null);
    setErrorMessage(null);
    setIsLoading(false);
    setPage(1);
  };

  // String keys keep the fetch from re-firing on a fresh-but-equal array.
  const sectorsKey = selectedSectors.join("|");
  const industriesKey = selectedIndustries.join("|");

  useEffect(() => {
    if (!segmentHasHistory || !selectedStock) return;

    const controller = new AbortController();
    let isCurrentRequest = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetchHistoricalData(
          {
            exchange: apiExchange,
            fnoOnly: segment === "F&O Stocks (EQ)",
            sectors: sectorsKey ? sectorsKey.split("|") : [],
            industries: industriesKey ? industriesKey.split("|") : [],
            symbols: appliedSymbol ? [appliedSymbol] : [],
            period,
            from: customDate || undefined,
            to: customEndDate || undefined,
            page,
            pageSize: PAGE_SIZE,
            sort,
            order,
          },
          controller.signal,
        );
        if (!isCurrentRequest) return;
        setData(response);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrentRequest || isHistoricalDataRequestAborted(error)) return;
        setErrorMessage(getHistoricalDataClientErrorMessage(error));
      } finally {
        if (isCurrentRequest) setIsLoading(false);
      }
    };

    void load();
    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [
    segmentHasHistory,
    selectedStock,
    apiExchange,
    segment,
    sectorsKey,
    industriesKey,
    appliedSymbol,
    period,
    customDate,
    customEndDate,
    page,
    sort,
    order,
    refreshVersion,
  ]);

  // A segment without a candle store fetches nothing, so whatever the last
  // supported segment loaded stays in state but is not shown.
  const visibleData = segmentHasHistory && selectedStock ? data : null;
  const rows = visibleData?.rows ?? [];
  const showInitialSpinner = segmentHasHistory && isLoading && !data;
  const windowLabel = visibleData
    ? visibleData.window.sessions !== null
      ? `Last ${visibleData.window.sessions} sessions to ${formatSessionDate(visibleData.window.to)}`
      : `${visibleData.window.from ? formatSessionDate(visibleData.window.from) : "…"} → ${formatSessionDate(visibleData.window.to)}`
    : null;

  const openCustomDatePicker = () => {
    setStartDateInput(customDate ? isoToDisplay(customDate) : "");
    setEndDateInput(customEndDate ? isoToDisplay(customEndDate) : "");
    setDateError("");
    const anchor = customDate ? new Date(`${customDate}T00:00:00`) : new Date();
    setCalendarMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    setIsCustomDatePopupOpen(true);
  };

  useEffect(() => {
    if (!isCustomDatePopupOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        customDatePopupRef.current &&
        !customDatePopupRef.current.contains(target) &&
        customDateButtonRef.current &&
        !customDateButtonRef.current.contains(target)
      ) {
        setIsCustomDatePopupOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCustomDatePopupOpen]);

  useEffect(() => {
    if (!isCustomDatePopupOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsCustomDatePopupOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isCustomDatePopupOpen]);

  const applyDateRange = () => {
    const start = parseDisplayDate(startDateInput);
    const end = parseDisplayDate(endDateInput);
    if (!start.valid) {
      setDateError("Invalid Start Date. Use DD/MM/YYYY.");
      return;
    }
    if (!end.valid) {
      setDateError("Invalid End Date. Use DD/MM/YYYY.");
      return;
    }
    if (!start.iso) {
      setDateError("Start Date is required.");
      return;
    }
    if (end.iso && start.iso > end.iso) {
      setDateError("Start Date must be before End Date.");
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    if (start.iso > today || (end.iso && end.iso > today)) {
      setDateError("Dates cannot be in the future.");
      return;
    }
    setDateError("");
    setCustomDate(start.iso);
    setCustomEndDate(end.iso);
    setSelectedTimePeriod([]);
    setPage(1);
    setIsCustomDatePopupOpen(false);
  };

  const startIso = parseDisplayDate(startDateInput).iso;
  const endIso = parseDisplayDate(endDateInput).iso;
  const selectedRange: DateRange | undefined = startIso
    ? {
        from: new Date(`${startIso}T00:00:00`),
        to: endIso ? new Date(`${endIso}T00:00:00`) : undefined,
      }
    : undefined;

  const customDateLabel = customDate
    ? `${isoToDisplay(customDate)} → ${
        customEndDate ? isoToDisplay(customEndDate) : "Today"
      }`
    : "Customized Date";

  const reopenPicker = () => {
    setStockPickerInput(selectedStock ? selectedStock.symbol : "");
    setIsPickerOpen(true);
  };

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 py-4">
        <div
          ref={stockPickerRef}
          className="relative mb-4 rounded-2xl border border-border/90 bg-card p-4 shadow-xs"
        >
          {selectedStock && !isPickerOpen ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Search className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Selected stock
                </p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {selectedStock.symbol}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {selectedStock.company}
                  </span>
                  <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {selectedStock.exchange}
                  </span>
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={reopenPicker}
                  className="h-8 px-3 text-xs font-medium text-primary hover:text-blue-800 hover:underline"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={clearSelectedStock}
                  aria-label="Clear selected stock"
                  title="Clear selected stock"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="historical-stock-picker"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Step 1 — Search and select a stock
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="historical-stock-picker"
                  type="text"
                  autoFocus
                  placeholder="Type a company name or symbol, e.g. RELIANCE..."
                  value={stockPickerInput}
                  onChange={(e) => updateStockPickerInput(e.target.value)}
                  onFocus={() => setIsPickerOpen(true)}
                  className="h-10 w-full rounded-xl border border-border bg-card pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 md:max-w-md"
                />
                {stockPickerInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setStockPickerInput("");
                      setSuggestions([]);
                    }}
                    aria-label="Clear stock search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {isPickerOpen &&
                stockPickerInput.trim().length >= MIN_PICKER_CHARS && (
                  <div className="absolute left-4 right-4 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border/90 bg-card shadow-[0_18px_50px_rgba(0,0,0,0.16)] md:right-auto md:w-[28rem]">
                    {suggestionsLoading && suggestions.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-muted-foreground">
                        Searching...
                      </p>
                    ) : suggestions.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-muted-foreground">
                        No matches. Try a symbol like RELIANCE or SBIN.
                      </p>
                    ) : (
                      suggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.exchange}-${suggestion.symbol}`}
                          type="button"
                          onClick={() => selectStock(suggestion)}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted"
                        >
                          <span className="text-sm font-semibold text-foreground">
                            {suggestion.symbol}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {suggestion.company}
                          </span>
                          <span className="ml-auto shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {suggestion.exchange}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
        <div className="relative mb-4 flex items-center justify-between flex-wrap gap-2">
          {selectedStock && (
            <div className="flex items-center gap-2 flex-wrap">
              <FilterDropdown
                label="Exchange"
                options={EXCHANGE_OPTIONS}
                selected={selectedExchange}
                onChange={updateExchange}
                single
              />
              <FilterDropdown
                label="Segments"
                options={SEGMENT_OPTIONS}
                selected={selectedSegments}
                onChange={updateSegments}
                single
              />
              <FilterDropdown
                label="Sector"
                options={NSE_SECTORS}
                selected={selectedSectors}
                onChange={updateSectors}
                searchable
              />
              <FilterDropdown
                label="Industry"
                options={industryOptions}
                selected={selectedIndustries}
                onChange={updateIndustries}
                searchable
              />
              <FilterDropdown
                label="Time Period"
                options={TIME_PERIOD_OPTIONS}
                selected={selectedTimePeriod}
                onChange={updateTimePeriod}
                single
              />
              <button
                ref={customDateButtonRef}
                type="button"
                onClick={() =>
                  isCustomDatePopupOpen
                    ? setIsCustomDatePopupOpen(false)
                    : openCustomDatePicker()
                }
                className={`px-3 py-1.5 text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  customDate
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                {customDateLabel}
              </button>
            </div>
          )}

          {selectedStock && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() =>
                  downloadRowsAsCsv(
                    rows,
                    `historical_${apiExchange.replace(" ", "-")}_${customDate ? `${customDate}_to_${customEndDate || visibleData?.window.to || "today"}` : period}_p${page}.csv`,
                  )
                }
                disabled={rows.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary hover:text-blue-800 font-medium disabled:opacity-40"
                title="Download the rows on this page as CSV"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
            </div>
          )}

          {isCustomDatePopupOpen && (
            <div
              ref={customDatePopupRef}
              className="absolute top-full left-0 z-50 mt-2 w-[min(760px,calc(100vw-2rem))] rounded-2xl border border-border/90 bg-card shadow-[0_18px_50px_rgba(0,0,0,0.16)] overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border bg-muted/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-card border border-border text-primary shadow-xs">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Customized Date
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Show historical data between two dates
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomDatePopupOpen(false)}
                  className="h-8 px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Close
                </button>
              </div>

              <div className="grid md:grid-cols-[1fr_250px]">
                <div className="p-4">
                  <DayPicker
                    mode="range"
                    selected={selectedRange}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    onSelect={(range) => {
                      if (!range?.from) return;
                      setStartDateInput(toDisplayDate(range.from));
                      setEndDateInput(range.to ? toDisplayDate(range.to) : "");
                      setDateError("");
                    }}
                    numberOfMonths={2}
                    pagedNavigation
                    captionLayout="dropdown"
                    startMonth={new Date(1990, 0)}
                    endMonth={new Date()}
                    disabled={{ after: new Date() }}
                    showOutsideDays
                    classNames={{
                      root: "w-full",
                      months: "flex flex-col gap-6 md:flex-row md:gap-8",
                      month: "space-y-3",
                      month_caption:
                        "relative flex h-9 items-center justify-center",
                      caption_label: "text-sm font-semibold text-foreground",
                      dropdowns: "flex items-center justify-center gap-2",
                      dropdown_root: "relative",
                      dropdown:
                        "h-8 appearance-none rounded-lg border border-border bg-card px-2 pr-7 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:bg-muted focus:border-ring focus:ring-2 focus:ring-ring/30",
                      months_dropdown: "min-w-[92px]",
                      years_dropdown: "min-w-[76px]",
                      nav: "absolute inset-x-4 top-[76px] flex items-center justify-between md:inset-x-5",
                      button_previous:
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted",
                      button_next:
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted",
                      chevron: "h-4 w-4",
                      month_grid: "w-full border-collapse",
                      weekdays: "flex",
                      weekday:
                        "flex h-8 w-9 items-center justify-center text-[11px] font-medium text-muted-foreground",
                      week: "mt-1 flex w-full",
                      day: "relative h-9 w-9 p-0 text-center text-sm",
                      day_button:
                        "h-9 w-9 rounded-md text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black",
                      today:
                        "font-bold text-foreground after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-black",
                      outside: "text-muted-foreground opacity-60",
                      disabled:
                        "pointer-events-none text-muted-foreground opacity-40",
                      selected: "bg-primary text-primary-foreground",
                      range_start:
                        "rounded-l-md bg-primary text-primary-foreground",
                      range_end:
                        "rounded-r-md bg-primary text-primary-foreground",
                      range_middle: "rounded-none bg-muted text-foreground",
                    }}
                  />
                </div>

                <div className="border-t border-border bg-muted p-4 md:border-l md:border-t-0">
                  <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase text-muted-foreground">
                      Selected range
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {startDateInput || "Start date"}{" "}
                      {endDateInput ? `to ${endDateInput}` : "to today"}
                    </p>
                  </div>

                  <div className="mb-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const t = new Date();
                        setStartDateInput(toDisplayDate(t));
                        setEndDateInput("");
                        setCalendarMonth(
                          new Date(t.getFullYear(), t.getMonth(), 1),
                        );
                        setDateError("");
                      }}
                      className="h-8 flex-1 border border-border bg-card text-xs font-medium text-foreground hover:border-black hover:bg-muted"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStartDateInput("");
                        setEndDateInput("");
                        setDateError("");
                        if (customDate || customEndDate) {
                          setCustomDate("");
                          setCustomEndDate("");
                          setSelectedTimePeriod([TIME_PERIOD_OPTIONS[0]]);
                          setPage(1);
                        }
                      }}
                      className="h-8 flex-1 border border-border bg-card text-xs font-medium text-muted-foreground hover:border-black hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <label className="mb-1 text-xs font-medium text-muted-foreground">
                        Start Date
                      </label>
                      <input
                        type="text"
                        value={startDateInput}
                        onChange={(e) => {
                          setStartDateInput(e.target.value);
                          setDateError("");
                        }}
                        placeholder="DD/MM/YYYY"
                        className="h-9 border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="mb-1 text-xs font-medium text-muted-foreground">
                        End Date
                      </label>
                      <input
                        type="text"
                        value={endDateInput}
                        onChange={(e) => {
                          setEndDateInput(e.target.value);
                          setDateError("");
                        }}
                        placeholder="DD/MM/YYYY"
                        className="h-9 border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>

                  {dateError && (
                    <p className="mt-3 border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
                      {dateError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={applyDateRange}
                    className="mt-5 h-9 w-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="border-t border-border px-4 py-2">
                <p className="text-[11px] text-muted-foreground">
                  Pick a start date and optional end date. Leaving the end date
                  empty shows data from the start date to today.
                </p>
              </div>
            </div>
          )}
        </div>

        {selectedStock && !segmentHasHistory && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-amber-800">
            <span aria-hidden="true">⚠</span>
            <span>
              Daily history is stored for the Equity and F&amp;O Stocks (EQ)
              segments only — {segment} has no candle history yet.
            </span>
          </div>
        )}

        {selectedStock && segmentHasHistory && errorMessage && !isLoading && (
          <div className="border border-red-300 bg-error/10 rounded p-4 mb-4">
            <p className="text-error text-sm">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setRefreshVersion((version) => version + 1)}
              className="mt-2 text-sm text-error underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        )}

        {selectedStock ? (
          <div
            className={`rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden transition-opacity ${
              segmentHasHistory && isLoading && data ? "opacity-60" : ""
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/80">
              <span className="font-bold text-foreground text-xs md:text-sm uppercase tracking-wide">
                Historical Data
                {visibleData
                  ? ` (${visibleData.pagination.totalRows.toLocaleString("en-IN")})`
                  : ""}
              </span>
              {visibleData && (
                <span className="text-xs text-muted-foreground">
                  {visibleData.stockCount.toLocaleString("en-IN")} stocks ·{" "}
                  {windowLabel}
                </span>
              )}
            </div>

            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto scrollbar-thin">
              <table className="w-full text-xs border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md border-b border-border">
                  <tr>
                    {COLUMNS.map((column) => (
                      <th
                        key={column.sort}
                        onClick={() => handleSort(column)}
                        className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center whitespace-nowrap bg-muted/90 border-r border-border cursor-pointer hover:bg-muted transition-colors select-none"
                      >
                        {column.label}
                        {sort === column.sort && (
                          <span className="ml-1 text-[10px]">
                            {order === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {showInitialSpinner ? (
                    <tr>
                      <td
                        colSpan={COLUMNS.length}
                        className="px-4 py-16 text-center text-xs text-muted-foreground"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                          Loading historical data...
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={COLUMNS.length}
                        className="px-4 py-16 text-center text-xs text-muted-foreground"
                      >
                        No historical data for the current selection.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <HistoricalRow
                        key={`${row.exchange}-${row.securityId}-${row.date}`}
                        row={row}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {visibleData && visibleData.pagination.totalPages > 1 && (
              <PaginationControls
                page={visibleData.pagination.page}
                totalPages={visibleData.pagination.totalPages}
                totalRows={visibleData.pagination.totalRows}
                pageSize={visibleData.pagination.pageSize}
                onPageChange={setPage}
              />
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/60 px-4 py-16 text-center">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-xs">
                <Search className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-muted-foreground">
                Select a stock to see its history
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Search above and pick a company first — then choose a period and
                other options, and its historical list will appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

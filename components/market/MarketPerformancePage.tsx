"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Download,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
  ListFilter,
} from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchInput } from "@/components/common/SearchInput";
import { describeSyncFreshness } from "@/lib/utils";
import FilterPanel, {
  type AddColumnSelection,
  type FilterState,
  type FilterOptions,
  emptyFilters,
  emptyFilterOptions,
  normalizeFilterState,
} from "@/components/FilterPanel";
import { usePersistedSettings } from "@/lib/hooks/usePersistedSettings";
import {
  ADD_TIMEFRAMES,
  ADD_COLUMN_GROUPS,
  buildAddedColumnDefinitions,
  emptyAddColumnSelection,
  normalizeAddColumnSelection,
  type AddedColumnDefinition,
} from "@/lib/screener-columns";
import { marketSortFields } from "@/lib/market/live-query";
import {
  isoToDisplay,
  parseDisplayDate,
  toDisplayDate,
  todayLocalIso,
  validateCustomDateRange,
} from "@/lib/market/custom-date";
import type { SavedViewPayload } from "@/lib/validations/saved-views";
import {
  getMarketApiErrorMessage,
  INVALID_MARKET_RESPONSE_MESSAGE,
  isMarketColumnValuesResponse,
  isMarketFilterOptions,
  isMarketLiveResponse,
  type MarketAddedColumnValue,
} from "@/lib/market/client-contract";
import { getFundamentalsUnsupportedScreenerColumnReason } from "@/lib/fundamentals/coverage";
import {
  resolveColumnCapability,
  resolveTimeframeCapability,
} from "@/lib/technical";
import { StockActionsMenu } from "@/components/common/StockActionsMenu";
import PatternCompaniesDialog from "@/components/PatternCompaniesDialog";
import {
  candlestickMatchesForRow,
  combinePatternMatches,
  isCandlestickPendingForRow,
  isPatternPendingForRow,
  patternMatchesForRow,
  type CandlestickMatch,
} from "@/lib/market/candlestick-summary";
import {
  isPatternSummaryTimeframe,
  patternTimeframeLabel,
  resolvePatternSummaryTimeframes,
  type PatternOptionCount,
  type PatternSummaryPayload,
} from "@/lib/market/pattern-summary";
import { formatMarketCap } from "@/lib/format";
import {
  TechnicalColumnFilterPopover,
  type TechnicalColumnFilter,
} from "@/components/TechnicalColumnFilterPopover";
import {
  encodeTechnicalFilters,
  isUniverseScreenableColumn,
  matchesTechnicalFilter,
} from "@/lib/market/technical-filter";

type TimePeriod =
  "today" | "intraday" | "days" | "weeks" | "months" | "years" | "customize";
type SubTab = "custom" | "seasonality" | "ytd" | "52weeks" | "all_time";
const EXCHANGE_OPTIONS = [
  { id: "NSE", label: "NSE", title: "Every NSE-quoted stock" },
  { id: "BSE", label: "BSE", title: "Every BSE-quoted stock" },
  {
    id: "Both",
    label: "Both",
    title: "Every NSE and BSE row — dual-listed companies appear twice",
  },
  {
    id: "Merged",
    label: "Merged",
    title:
      "One row per company: for a dual-listed stock, whichever exchange ranks higher on the sorted column",
  },
  {
    id: "Only NSE",
    label: "Only NSE",
    title: "Stocks listed on NSE and not on BSE",
  },
  {
    id: "Only BSE",
    label: "Only BSE",
    title: "Stocks listed on BSE and not on NSE",
  },
] as const;

type Exchange = (typeof EXCHANGE_OPTIONS)[number]["id"];
type ViewType = "all" | "gainers" | "losers" | "unchanged";

const isExchange = (value: string): value is Exchange =>
  EXCHANGE_OPTIONS.some((option) => option.id === value);

const isMarketSortField = (value: string): boolean =>
  (marketSortFields as readonly string[]).includes(value);

const PAGE_SIZE = 200;

const columnsByPeriod: Record<TimePeriod | SubTab, string[]> = {
  today: ["% Chag"],
  intraday: [
    "% 5Min Chag",
    "% 15Min Chag",
    "% 30Min Chag",
    "% 1Hour Chag",
    "% 2Hours Chag",
    "% Cust Date Chag",
  ],
  days: [
    "% Chag",
    "% 2D Chag",
    "% 3D Chag",
    "% 4D Chag",
    "% 5D Chag",
    "% 1W Chag",
    "% Cust Date Chag",
  ],
  weeks: [
    "% 1W Chag",
    "% 2W Chag",
    "% 3W Chag",
    "% 4W Chag",
    "% 5W Chag",
    "% 1M Chag",
    "% Cust Date Chag",
  ],
  months: [
    "% 1M Chag",
    "% 2M Chag",
    "% 3M Chag",
    "% 4M Chag",
    "% 5M Chag",
    "% 6M Chag",
    "% 7M Chag",
    "% 8M Chag",
    "% 9M Chag",
    "% 10M Chag",
    "% 11M Chag",
    "% 1Y Chag",
  ],
  years: [
    "% 1Y Chag",
    "% 2Y Chag",
    "% 3Y Chag",
    "% 4Y Chag",
    "% 5Y Chag",
    "% 10Y Chag",
    "% Max Chag",
  ],
  customize: [],
  custom: ["% Cust Date Chag", "% Chag"],
  seasonality: ["% Chag", "% Cust Date Chag"],
  ytd: [
    "% YTD Chag",
    "% 2YTD Chag",
    "% 3YTD Chag",
    "% 4YTD Chag",
    "% 5YTD Chag",
    "% 10 YTD Chag",
    "% Cust Date Chag",
  ],
  "52weeks": ["% 52W Chag", "% Cust Date Chag"],
  all_time: ["% ATH&L Chag", "% Cust Date Chag"],
};

const todayBaseColumns = [
  "S No",
  "Exchange",
  "Segments",
  "Company Name",
  "Sector",
  "Industry",
  "Group",
  "FV",
  "P Band",
  "M Cap",
  "Pre Close",
  "Open",
  "High",
  "Low",
  "LTP",
  "Change",
  "% Change",
  "Volume",
  "Value",
  "52W H",
  "52W L",
  "30D % Chng",
  "Candlestick",
  "Chart Patterns",
];

const standardBaseColumns = [
  "S No",
  "Company Name",
  "Sector",
  "Industry",
  "Group",
  "F V",
  "P Band",
  "M Cap",
  "Pre Close",
  "CMP",
  "Net Chag",
  "Candlestick",
  "Chart Patterns",
];

const TODAY_TOGGLEABLE_COLUMNS = [
  "Exchange",
  "Segments",
  "Sector",
  "Industry",
  "Group",
  "FV",
  "P Band",
  "M Cap",
  "Pre Close",
  "Open",
  "High",
  "Low",
  "Volume",
  "Value",
  "52W H",
  "52W L",
  "30D % Chng",
  "Candlestick",
  "Chart Patterns",
];

const STANDARD_TOGGLEABLE_COLUMNS = [
  "Sector",
  "Industry",
  "Group",
  "F V",
  "P Band",
  "M Cap",
  "Pre Close",
  "Candlestick",
  "Chart Patterns",
];

const csvEscape = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

/**
 * Everything a single timeframe tab (Today/Intraday/Days/Weeks/Months/
 * Years/Customize/Seasonality/YTD/52 Weeks/All Time) remembers on its
 * own: its filters, hidden columns, added columns, sort, and technical
 * column filters. Each tab gets its own entry in MarketSettingsPayload.tabs
 * so changing a filter on "Days Wise" never touches "Weeks Wise" -- every
 * tab keeps exactly the state it was left in.
 */
interface MarketTabSettings {
  filters: FilterState;
  hiddenColumns: string[];
  selectedAddColumnConfig: AddColumnSelection;
  onlyShowTechnicalMatches: boolean;
  sortCol: string;
  sortOrder: "asc" | "desc";
  technicalColumnFilters: Record<string, TechnicalColumnFilter>;
}

const defaultMarketTabSettings: MarketTabSettings = {
  filters: emptyFilters,
  hiddenColumns: [],
  selectedAddColumnConfig: emptyAddColumnSelection,
  onlyShowTechnicalMatches: false,
  sortCol: "pctChange",
  sortOrder: "desc",
  technicalColumnFilters: {},
};

interface MarketSettingsPayload {
  // Which universe of stocks to look at -- kept global (not per-tab) since
  // a user switching timeframes generally wants to keep looking at the
  // same exchange, not have it reset per tab.
  selectedExchange: Exchange;
  activeTab: string;
  tabs: Record<string, MarketTabSettings>;
}

const defaultMarketSettings: MarketSettingsPayload = {
  selectedExchange: "Merged",
  activeTab: "today",
  tabs: {},
};

const TECHNICAL_COLUMN_FILTER_OPERATORS = new Set<
  TechnicalColumnFilter["operator"]
>([
  "gt",
  "lt",
  "gte",
  "lte",
  "between",
  "equals",
  "bullish",
  "bearish",
  "detected",
  "none",
]);

function normalizeTechnicalColumnFilters(
  raw: unknown,
): Record<string, TechnicalColumnFilter> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, TechnicalColumnFilter> = {};
  for (const [columnId, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const operator = entry.operator;
    if (
      typeof entry.columnId !== "string" ||
      typeof operator !== "string" ||
      !TECHNICAL_COLUMN_FILTER_OPERATORS.has(
        operator as TechnicalColumnFilter["operator"],
      )
    ) {
      continue;
    }
    result[columnId] = {
      columnId: entry.columnId,
      operator: operator as TechnicalColumnFilter["operator"],
      minValue: typeof entry.minValue === "number" ? entry.minValue : undefined,
      maxValue: typeof entry.maxValue === "number" ? entry.maxValue : undefined,
      preset: typeof entry.preset === "string" ? entry.preset : undefined,
      label: typeof entry.label === "string" ? entry.label : undefined,
    };
  }
  return result;
}

function normalizeMarketTabSettings(raw: unknown): MarketTabSettings {
  if (!raw || typeof raw !== "object") {
    return { ...defaultMarketTabSettings };
  }
  const obj = raw as Record<string, unknown>;
  return {
    filters: normalizeFilterState(obj.filters),
    hiddenColumns: Array.isArray(obj.hiddenColumns)
      ? obj.hiddenColumns.filter((c): c is string => typeof c === "string")
      : [],
    selectedAddColumnConfig: normalizeAddColumnSelection(
      (obj.selectedAddColumnConfig ??
        emptyAddColumnSelection) as AddColumnSelection,
    ),
    onlyShowTechnicalMatches: Boolean(obj.onlyShowTechnicalMatches),
    sortCol: typeof obj.sortCol === "string" ? obj.sortCol : "pctChange",
    sortOrder: obj.sortOrder === "asc" ? "asc" : "desc",
    technicalColumnFilters: normalizeTechnicalColumnFilters(
      obj.technicalColumnFilters,
    ),
  };
}

function normalizeMarketSettings(raw: unknown): MarketSettingsPayload {
  if (!raw || typeof raw !== "object") {
    return { ...defaultMarketSettings, tabs: {} };
  }
  const obj = raw as Record<string, unknown>;
  const selectedExchange =
    typeof obj.selectedExchange === "string" && isExchange(obj.selectedExchange)
      ? obj.selectedExchange
      : "Merged";
  const activeTab = typeof obj.activeTab === "string" ? obj.activeTab : "today";

  if (obj.tabs && typeof obj.tabs === "object") {
    const tabs: Record<string, MarketTabSettings> = {};
    for (const [tabId, tabRaw] of Object.entries(
      obj.tabs as Record<string, unknown>,
    )) {
      tabs[tabId] = normalizeMarketTabSettings(tabRaw);
    }
    return { selectedExchange, activeTab, tabs };
  }

  // Migrate a payload saved before per-tab isolation existed -- it's a flat
  // MarketTabSettings shape at the top level, so treat it as whichever tab
  // the user was last on rather than discarding their existing filters.
  return {
    selectedExchange,
    activeTab,
    tabs: { [activeTab]: normalizeMarketTabSettings(obj) },
  };
}

interface StockData {
  id: string;
  securityId: number;
  exchange: string;
  exchangeSegment: string;
  companyName: string;
  tradingSymbol?: string;
  sector: string;
  industry: string;
  group: string;
  faceValue: number;
  priceBand: string;
  marketCap: string;
  preClose: number;
  open?: number;
  high?: number;
  low?: number;
  cmp: number;
  netChange: number;
  customNetChange?: number | null;
  percentChange?: number;
  percentChanges: Readonly<Record<string, number | null>>;
  volume?: number;
  week52High?: number;
  week52Low?: number;
  hit52High?: boolean;
  hit52Low?: boolean;
}

type HitFilter = "all" | "high" | "low";

type AddedColumnValues = Readonly<
  Record<string, Readonly<Record<string, MarketAddedColumnValue>>>
>;

function addedColumnInstrumentKey(
  stock: Pick<StockData, "securityId" | "exchangeSegment">,
): string {
  return `${stock.exchangeSegment}:${stock.securityId}`;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalStocks: number;
  totalPages: number;
}

interface Stats {
  totalGainers: number;
  totalLosers: number;
  totalUnchanged: number;
  avgGain: number;
  avgLoss: number;
}

interface SyncStatus {
  isRunning: boolean;
  historicalPopulating: boolean;
  historicalProgress: { completed: number; total: number };
  cachedCount: number;
}

const PaginationControls = ({
  pagination,
  onPageChange,
  tone = "terminal",
}: {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  tone?: "terminal" | "vgs";
}) => {
  const { page, totalPages, totalStocks, pageSize } = pagination;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalStocks);
  const vgsTone = tone === "vgs";

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

  const navButton = vgsTone
    ? "p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
    : "p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed";
  const navIcon = vgsTone
    ? "w-4 h-4 text-muted-foreground"
    : "w-4 h-4 text-foreground";

  return (
    <div
      className={
        vgsTone
          ? "flex items-center justify-between py-3 px-5 border-t border-border text-[11px] font-semibold text-muted-foreground"
          : "flex items-center justify-between py-3 px-2 border-t border-border bg-muted"
      }
    >
      <span className={vgsTone ? undefined : "text-xs text-muted-foreground"}>
        Showing {start}–{end} of {totalStocks} stocks
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className={navButton}
          title="First page"
        >
          <ChevronsLeft className={navIcon} />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={navButton}
          title="Previous page"
        >
          <ChevronLeft className={navIcon} />
        </button>

        {getPageNumbers().map((p, idx) =>
          p === "..." ? (
            <span
              key={`dots-${idx}`}
              className={`px-2 text-xs ${vgsTone ? "text-muted-foreground" : "text-muted-foreground"}`}
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`min-w-[32px] h-8 px-2 text-xs rounded-lg font-medium ${
                p === page
                  ? vgsTone
                    ? "bg-primary text-primary-foreground"
                    : "bg-black dark:bg-muted text-white dark:text-zinc-950"
                  : vgsTone
                    ? "text-muted-foreground hover:bg-muted"
                    : "text-foreground hover:bg-muted"
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
          <ChevronRight className={navIcon} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className={navButton}
          title="Last page"
        >
          <ChevronsRight className={navIcon} />
        </button>
      </div>

      <span className={vgsTone ? undefined : "text-xs text-muted-foreground"}>
        Page {page} of {totalPages}
      </span>
    </div>
  );
};

const SORT_MAP_UI: Record<string, string> = {
  "Trading Symbol": "name",
  "Company Name": "name",
  LTP: "lastPrice",
  CMP: "lastPrice",
  "Pre Close": "prevClose",
  Change: "netChange",
  "Net Chag": "netChange",
  "% Change": "pctChange",
  "M Cap": "marketCap",
  Volume: "volume",
};

const SORT_ICON_MAP: Record<string, string> = {
  "Trading Symbol": "name",
  "Company Name": "name",
  LTP: "lastPrice",
  CMP: "lastPrice",
  Change: "netChange",
  "Net Chag": "netChange",
  "% Change": "pctChange",
  "M Cap": "marketCap",
  Volume: "volume",
};

/** Chips shown in a summary cell before the rest collapse into "+N". */
const MAX_PATTERN_CHIPS = 3;

/** What a Candlestick / Chart Patterns cell knows about its row. */
interface PatternCellData {
  readonly matches: readonly CandlestickMatch[];
  /** The summary (or an added pattern column) is still loading for this row. */
  readonly pending: boolean;
  /** No OHLC history for this stock, so "no pattern" cannot be decided. */
  readonly noData: boolean;
  /** Timeframes scanned, for the empty-state tooltip. */
  readonly timeframeText: string;
}

const PatternSummaryCell = ({
  data,
  kind,
}: {
  data: PatternCellData | undefined;
  kind: string;
}) => {
  const matches = data?.matches ?? [];
  if (matches.length === 0) {
    if (!data || data.pending) {
      return (
        <span
          className="text-muted-foreground/60 select-none"
          title={`Scanning ${kind}…`}
        >
          …
        </span>
      );
    }
    if (data.noData) {
      return (
        <span
          className="text-[10px] text-muted-foreground/60 select-none"
          title="No daily OHLC history is stored for this stock yet, so patterns cannot be checked."
        >
          No data
        </span>
      );
    }
    return (
      <span
        className="text-muted-foreground/60 select-none"
        title={`No ${kind} detected on ${data.timeframeText}`}
      >
        —
      </span>
    );
  }
  const byLabel = new Map<string, string[]>();
  for (const match of matches) {
    const timeframes = byLabel.get(match.label) ?? [];
    timeframes.push(match.timeframeLabel);
    byLabel.set(match.label, timeframes);
  }
  const entries = [...byLabel.entries()];
  const shown = entries.slice(0, MAX_PATTERN_CHIPS);
  const hidden = entries.slice(MAX_PATTERN_CHIPS);
  return (
    <span className="flex flex-wrap justify-center gap-1">
      {shown.map(([label, timeframes]) => (
        <span
          key={label}
          title={`${label} · ${[...new Set(timeframes)].join(", ")}`}
          className="inline-flex items-center rounded-full border border-primary/30 dark:border-indigo-400/30 bg-primary/10 dark:bg-indigo-400/10 px-1.5 py-px text-[10px] font-bold whitespace-nowrap text-primary dark:text-indigo-300"
        >
          {label}
        </span>
      ))}
      {hidden.length > 0 && (
        <span
          title={hidden
            .map(
              ([label, timeframes]) =>
                `${label} · ${[...new Set(timeframes)].join(", ")}`,
            )
            .join("\n")}
          className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-px text-[10px] font-bold whitespace-nowrap text-muted-foreground"
        >
          +{hidden.length}
        </span>
      )}
    </span>
  );
};

function renderBaseCell(
  col: string,
  stock: StockData,
  colorClass: string,
  displayedNetChange: number,
  displayedPercentChange: number,
  candlestick?: PatternCellData,
  chartPatterns?: PatternCellData,
) {
  const cls =
    "px-3 py-2 text-foreground text-xs border-r border-border whitespace-nowrap";
  const price = (value: number | undefined) =>
    value !== undefined ? value.toFixed(2) : "—";

  switch (col) {
    case "S No":
      return (
        <td
          key={col}
          className={`${cls} text-center font-semibold text-muted-foreground num-font`}
        >
          {stock.id}
        </td>
      );
    case "Candlestick":
      return (
        <td key={col} className={`${cls} text-center`}>
          <PatternSummaryCell data={candlestick} kind="candlestick pattern" />
        </td>
      );
    case "Chart Patterns":
      return (
        <td key={col} className={`${cls} text-center`}>
          <PatternSummaryCell data={chartPatterns} kind="chart pattern" />
        </td>
      );
    case "Company Name":
      return (
        <td
          key={col}
          className={`${cls} text-foreground font-bold`}
          title={stock.companyName}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="hover:text-primary dark:hover:text-indigo-300 cursor-pointer transition-colors">
              {stock.companyName}
            </span>
            <div className="flex items-center gap-1">
              <StockActionsMenu
                stock={{
                  symbol: stock.tradingSymbol ?? stock.companyName,
                  name: stock.companyName,
                  ltp: stock.cmp,
                  sector: stock.sector,
                  industry: stock.industry,
                }}
              />
            </div>
          </div>
        </td>
      );
    case "Exchange":
      return (
        <td key={col} className={`${cls} text-center`}>
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 dark:bg-indigo-400/10 text-primary dark:text-indigo-300 border border-primary/30 dark:border-indigo-400/30">
            {stock.exchange}
          </span>
        </td>
      );
    case "Segments":
      return (
        <td key={col} className={`${cls} text-muted-foreground`}>
          {stock.exchangeSegment}
        </td>
      );
    case "Trading Symbol":
      return (
        <td
          key={col}
          className={`${cls} font-mono font-bold text-foreground`}
          title={stock.companyName}
        >
          <div className="flex items-center justify-between gap-2">
            <span>{stock.tradingSymbol ?? stock.companyName}</span>
            <div className="flex items-center gap-1">
              <StockActionsMenu
                stock={{
                  symbol: stock.tradingSymbol ?? stock.companyName,
                  name: stock.companyName,
                  ltp: stock.cmp,
                  sector: stock.sector,
                  industry: stock.industry,
                }}
              />
            </div>
          </div>
        </td>
      );
    case "Sector":
      return (
        <td key={col} className={`${cls} text-muted-foreground`}>
          {stock.sector || "—"}
        </td>
      );
    case "Industry":
      return (
        <td key={col} className={`${cls} text-muted-foreground`}>
          {stock.industry || "—"}
        </td>
      );
    case "Group":
      return (
        <td key={col} className={`${cls} text-center`}>
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-foreground">
            {stock.group || "A"}
          </span>
        </td>
      );
    case "F V":
    case "FV":
      return (
        <td
          key={col}
          className={`${cls} text-center text-muted-foreground num-font`}
        >
          {stock.faceValue ? `₹${stock.faceValue}` : "—"}
        </td>
      );
    case "P Band":
      return (
        <td
          key={col}
          className={`${cls} text-center text-muted-foreground num-font`}
        >
          {/* stock.priceBand already carries its own "%" (e.g. "20%") or
              reads "No Band" -- appending another "%" here doubled it up. */}
          {stock.priceBand || "—"}
        </td>
      );
    case "M Cap":
      return (
        <td
          key={col}
          className={`${cls} text-right font-mono text-foreground num-font`}
        >
          {stock.marketCap || "—"}
        </td>
      );
    case "Pre Close":
      return (
        <td
          key={col}
          className={`${cls} text-right font-mono text-muted-foreground num-font`}
        >
          ₹{stock.preClose.toFixed(2)}
        </td>
      );
    case "Open":
      return (
        <td
          key={col}
          className={`${cls} text-right font-mono text-foreground num-font`}
        >
          ₹{price(stock.open)}
        </td>
      );
    case "High":
      return (
        <td
          key={col}
          className={`${cls} text-right font-mono text-foreground num-font`}
        >
          ₹{price(stock.high)}
        </td>
      );
    case "Low":
      return (
        <td
          key={col}
          className={`${cls} text-right font-mono text-foreground num-font`}
        >
          ₹{price(stock.low)}
        </td>
      );
    case "CMP":
    case "LTP":
      return (
        <td
          key={col}
          className={`${cls} text-right font-mono font-bold text-foreground num-font`}
        >
          ₹{stock.cmp.toFixed(2)}
        </td>
      );
    case "Net Chag":
    case "Change":
      return (
        <td
          key={col}
          className={`${cls} text-right font-mono font-semibold num-font ${colorClass}`}
        >
          {displayedNetChange > 0 ? "+" : ""}₹{displayedNetChange.toFixed(2)}
        </td>
      );
    case "% Change": {
      const isPositive = displayedPercentChange >= 0;
      return (
        <td key={col} className={`${cls} text-right`}>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font ${
              isPositive
                ? "bg-success/10 dark:bg-emerald-400/10 text-success dark:text-emerald-300 border-success/30 dark:border-emerald-400/30"
                : "bg-error/10 dark:bg-rose-400/10 text-error dark:text-rose-300 border-error/30 dark:border-rose-400/30"
            }`}
          >
            {isPositive ? "+" : ""}
            {displayedPercentChange.toFixed(2)}%
          </span>
        </td>
      );
    }
    case "Volume":
      return (
        <td
          key={col}
          className={`${cls} text-right font-mono text-muted-foreground num-font`}
        >
          {stock.volume !== undefined
            ? stock.volume.toLocaleString("en-IN")
            : "—"}
        </td>
      );
    case "Value":
      return (
        <td
          key={col}
          className={`${cls} text-right font-mono text-muted-foreground num-font`}
        >
          {stock.volume !== undefined
            ? formatMarketCap(stock.cmp * stock.volume)
            : "—"}
        </td>
      );
    case "52W H":
      return (
        <td
          key={col}
          className={`${cls} text-right font-mono text-muted-foreground num-font`}
        >
          ₹{price(stock.week52High)}
        </td>
      );
    case "52W L":
      return (
        <td
          key={col}
          className={`${cls} text-right font-mono text-muted-foreground num-font`}
        >
          ₹{price(stock.week52Low)}
        </td>
      );
    case "30D % Chng": {
      const value = stock.percentChanges["% 1M Chag"];
      const isPositive = value !== null && value !== undefined && value >= 0;
      return (
        <td key={col} className={`${cls} text-right`}>
          {value === null || value === undefined ? (
            <span className="text-muted-foreground/60">—</span>
          ) : (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font ${
                isPositive
                  ? "bg-success/10 dark:bg-emerald-400/10 text-success dark:text-emerald-300 border-success/30 dark:border-emerald-400/30"
                  : "bg-error/10 dark:bg-rose-400/10 text-error dark:text-rose-300 border-error/30 dark:border-rose-400/30"
              }`}
            >
              {isPositive ? "+" : ""}
              {value.toFixed(2)}%
            </span>
          )}
        </td>
      );
    }
    default:
      return null;
  }
}

const AddedColumnSubheaderCell = ({
  col,
  theme,
  filter,
  onApplyFilter,
  onSort,
  sortOrder,
}: {
  col: AddedColumnDefinition;
  theme: { superHeaderClass: string; subHeaderClass: string };
  filter?: TechnicalColumnFilter;
  onApplyFilter?: (filter: TechnicalColumnFilter | null) => void;
  /** Present when the whole result can be ordered by this column. */
  onSort?: () => void;
  /** The direction when this column is the active sort. */
  sortOrder?: "asc" | "desc";
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const hasActiveFilter = !!filter;

  return (
    <th
      key={col.id}
      className={`relative px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap ${theme.subHeaderClass} group/th`}
    >
      <div className="flex flex-col items-center justify-center gap-0.5">
        <div className="flex items-center justify-center gap-1">
          {onSort ? (
            <button
              type="button"
              onClick={onSort}
              title={`Sort all stocks by ${col.label}`}
              className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 uppercase tracking-wider cursor-pointer hover:bg-foreground/5 ${
                sortOrder ? "text-foreground" : ""
              }`}
            >
              <span>{col.label}</span>
              {sortOrder && (
                <span className="text-[10px]">
                  {sortOrder === "asc" ? "\u25B2" : "\u25BC"}
                </span>
              )}
            </button>
          ) : (
            <span>{col.label}</span>
          )}
          {onApplyFilter && (
            <button
              ref={btnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPopoverOpen(!popoverOpen);
              }}
              title={
                hasActiveFilter
                  ? `Filter active: ${filter.label}`
                  : `Filter by ${col.label}`
              }
              className={`rounded px-1 py-0.5 text-[9px] transition-all flex items-center gap-0.5 cursor-pointer ${
                hasActiveFilter
                  ? "bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950 font-bold shadow-xs scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 opacity-70 group-hover/th:opacity-100"
              }`}
            >
              <svg
                className="w-2.5 h-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              {hasActiveFilter && (
                <span className="max-w-[60px] truncate text-[8px] leading-tight">
                  {filter.label}
                </span>
              )}
            </button>
          )}
        </div>
        {col.groupLabel &&
          col.groupLabel !== "Timeframe" &&
          col.label !== col.groupLabel && (
            <span className="text-[9px] font-normal opacity-70 normal-case">
              {col.groupLabel}
            </span>
          )}
      </div>

      {popoverOpen && onApplyFilter && (
        <TechnicalColumnFilterPopover
          column={col}
          currentFilter={filter}
          isOpen={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          onApply={onApplyFilter}
          triggerRef={btnRef}
        />
      )}
    </th>
  );
};

const SummaryHeaderFilter = ({
  filterOptions,
  selectedIds,
  onFilterChange,
  emptyText,
  scopeText,
}: {
  filterOptions: readonly PatternOptionCount[];
  selectedIds: readonly string[];
  onFilterChange: (ids: string[]) => void;
  emptyText: string;
  scopeText: string;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const toggleId = (id: string) => {
    onFilterChange(
      selectedIds.includes(id)
        ? selectedIds.filter((entry) => entry !== id)
        : [...selectedIds, id],
    );
  };
  // A selected pattern stays listed even when the other filters leave no
  // stock showing it, so it can always be unticked.
  const listed = [
    ...filterOptions,
    ...selectedIds
      .filter((id) => !filterOptions.some((option) => option.id === id))
      .map((id) => ({ id, label: id, count: 0 })),
  ];
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? listed.filter((option) => option.label.toLowerCase().includes(needle))
    : listed;
  const selectedLabels = listed
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.label);
  return (
    <span
      className="relative ml-1 inline-flex align-middle"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title={
          selectedLabels.length > 0
            ? `Filtered: ${selectedLabels.join(", ")}`
            : "Filter by detected pattern"
        }
        aria-label="Filter by detected pattern"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((wasOpen) => !wasOpen);
        }}
        className={`rounded p-0.5 ${
          selectedIds.length > 0
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <ListFilter className="h-3 w-3" />
      </button>
      {open && (
        <span className="absolute top-6 right-0 z-30 block w-60 whitespace-normal rounded-xl border border-border bg-card p-2 text-left shadow-lg">
          <span className="block px-2 pb-1 text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
            {scopeText}
          </span>
          {listed.length === 0 ? (
            <span className="block px-2 py-1 text-[11px] font-normal text-muted-foreground normal-case tracking-normal">
              {emptyText}
            </span>
          ) : (
            <>
              {listed.length > 8 && (
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search patterns"
                  aria-label="Search patterns"
                  className="mb-1 w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] font-normal text-foreground normal-case tracking-normal"
                />
              )}
              <span className="block max-h-64 overflow-y-auto">
                {visible.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[11px] font-normal text-foreground normal-case tracking-normal hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(option.id)}
                      onChange={() => toggleId(option.id)}
                      className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-indigo-600"
                    />
                    <span className="flex-1 truncate">{option.label}</span>
                    <span className="num-font text-[10px] text-muted-foreground">
                      {option.count.toLocaleString("en-IN")}
                    </span>
                  </label>
                ))}
              </span>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onFilterChange([])}
                  className="mt-1 w-full rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground normal-case tracking-normal hover:bg-muted"
                >
                  Clear
                </button>
              )}
            </>
          )}
        </span>
      )}
    </span>
  );
};

const StockTable = ({
  data,
  baseColumns: tableBaseColumns,
  columns,
  title,
  pagination,
  onPageChange,
  sortCol,
  sortOrder,
  onSort,
  hiddenColumns,
  customDate,
  customEndDate,
  addedColumns,
  addedColumnValues,
  technicalColumnFilters = {},
  onApplyTechnicalColumnFilter,
  vgs = false,
  showHitColumn = false,
  candlestickFilterOptions = [],
  candlestickPatternFilter = [],
  onCandlestickFilterChange,
  candlestickCellForStock,
  chartPatternFilterOptions = [],
  chartPatternFilter = [],
  onChartPatternFilterChange,
  chartPatternCellForStock,
  patternScopeText = "",
}: {
  data: StockData[];
  baseColumns: string[];
  columns: string[];
  title: string;
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  sortCol: string;
  sortOrder: "asc" | "desc";
  onSort: (col: string) => void;
  hiddenColumns: Set<string>;
  customDate?: string;
  customEndDate?: string;
  addedColumns: AddedColumnDefinition[];
  addedColumnValues: AddedColumnValues;
  technicalColumnFilters?: Record<string, TechnicalColumnFilter>;
  onApplyTechnicalColumnFilter?: (
    columnId: string,
    filter: TechnicalColumnFilter | null,
  ) => void;
  vgs?: boolean;
  showHitColumn?: boolean;
  candlestickFilterOptions?: readonly PatternOptionCount[];
  candlestickPatternFilter?: readonly string[];
  onCandlestickFilterChange?: (ids: string[]) => void;
  candlestickCellForStock?: (stock: StockData) => PatternCellData;
  chartPatternFilterOptions?: readonly PatternOptionCount[];
  chartPatternFilter?: readonly string[];
  onChartPatternFilterChange?: (ids: string[]) => void;
  chartPatternCellForStock?: (stock: StockData) => PatternCellData;
  /** Which timeframes and stocks the filter menu counts cover. */
  patternScopeText?: string;
}) => {
  const renderHitCell = (stock: StockData) => {
    if (stock.hit52High) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-success/10 dark:bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-success dark:text-emerald-300 border border-success/30 dark:border-emerald-400/30 shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-success"></span>
          52W High
        </span>
      );
    }
    if (stock.hit52Low) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-error/10 dark:bg-rose-400/10 px-2 py-0.5 text-[11px] font-bold text-error dark:text-rose-300 border border-error/30 dark:border-rose-400/30 shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-error"></span>
          52W Low
        </span>
      );
    }
    return <span className="text-muted-foreground/60 select-none">—</span>;
  };
  const visibleBase = tableBaseColumns.filter((c) => !hiddenColumns.has(c));
  const visibleColumns = columns.filter((c) => !hiddenColumns.has(c));
  const addedColumnGroups = ADD_TIMEFRAMES.map((timeframe) => ({
    timeframe,
    columns: addedColumns.filter((col) => col.timeframeId === timeframe.id),
  })).filter((group) => group.columns.length > 0);
  const hasGroupedAddedColumns = addedColumns.length > 0;

  const TIMEFRAME_THEMES = [
    {
      superHeaderClass:
        "text-success dark:text-emerald-300 bg-success/10/90 dark:bg-emerald-400/10 border-b border-success/30 dark:border-emerald-400/30 border-r border-success/30 dark:border-emerald-400/30",
      subHeaderClass:
        "text-success dark:text-emerald-300 bg-success/10/50 dark:bg-emerald-400/10 border-r border-emerald-100 dark:border-emerald-400/20",
    },
    {
      superHeaderClass:
        "text-info dark:text-sky-300 bg-info/10/90 dark:bg-sky-400/10 border-b border-info/30 dark:border-sky-400/30 border-r border-info/30 dark:border-sky-400/30",
      subHeaderClass:
        "text-info dark:text-sky-300 bg-info/10/50 dark:bg-sky-400/10 border-r border-sky-100 dark:border-sky-400/20",
    },
    {
      superHeaderClass:
        "text-purple-700 dark:text-purple-300 bg-purple-50/90 dark:bg-purple-400/10 border-b border-purple-200 dark:border-purple-400/30 border-r border-purple-200 dark:border-purple-400/30",
      subHeaderClass:
        "text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-400/10 border-r border-purple-100 dark:border-purple-400/20",
    },
    {
      superHeaderClass:
        "text-warning dark:text-amber-300 bg-warning/10/90 dark:bg-amber-400/10 border-b border-warning/30 dark:border-amber-400/30 border-r border-warning/30 dark:border-amber-400/30",
      subHeaderClass:
        "text-warning dark:text-amber-300 bg-warning/10/50 dark:bg-amber-400/10 border-r border-amber-100 dark:border-amber-400/20",
    },
    {
      superHeaderClass:
        "text-error dark:text-rose-300 bg-error/10/90 dark:bg-rose-400/10 border-b border-error/30 dark:border-rose-400/30 border-r border-error/30 dark:border-rose-400/30",
      subHeaderClass:
        "text-error dark:text-rose-300 bg-error/10/50 dark:bg-rose-400/10 border-r border-rose-100 dark:border-rose-400/20",
    },
    {
      superHeaderClass:
        "text-teal-700 dark:text-teal-300 bg-teal-50/90 dark:bg-teal-400/10 border-b border-teal-200 dark:border-teal-400/30 border-r border-teal-200 dark:border-teal-400/30",
      subHeaderClass:
        "text-teal-700 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-400/10 border-r border-teal-100 dark:border-teal-400/20",
    },
    {
      superHeaderClass:
        "text-primary dark:text-indigo-300 bg-primary/10 dark:bg-indigo-400/10 border-b border-primary/30 dark:border-indigo-400/30 border-r border-primary/30 dark:border-indigo-400/30",
      subHeaderClass:
        "text-primary dark:text-indigo-300 bg-primary/10 dark:bg-indigo-400/10 border-r border-primary/20 dark:border-indigo-400/20",
    },
  ];

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return (
      <span className="ml-1 text-[10px]">
        {sortOrder === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="text-left px-4 py-3 font-bold text-foreground border-b border-border bg-muted/80 text-xs md:text-sm uppercase tracking-wide">
        {title} ({pagination.totalStocks.toLocaleString("en-IN")})
      </div>

      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto scrollbar-thin">
        <table className="w-full text-xs border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md border-b border-border">
            <tr>
              {visibleBase.map((col) => (
                <th
                  key={col}
                  rowSpan={hasGroupedAddedColumns ? 2 : 1}
                  className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center whitespace-nowrap bg-muted/90 border-r border-border cursor-pointer hover:bg-muted transition-colors select-none"
                  onClick={() => {
                    if (SORT_MAP_UI[col]) onSort(SORT_MAP_UI[col]);
                  }}
                >
                  {col}
                  {SORT_ICON_MAP[col] && <SortIcon col={SORT_ICON_MAP[col]} />}
                  {col === "Candlestick" && onCandlestickFilterChange && (
                    <SummaryHeaderFilter
                      filterOptions={candlestickFilterOptions}
                      selectedIds={candlestickPatternFilter}
                      onFilterChange={onCandlestickFilterChange}
                      emptyText="No candlestick pattern is detected on any stock in this list."
                      scopeText={patternScopeText}
                    />
                  )}
                  {col === "Chart Patterns" && onChartPatternFilterChange && (
                    <SummaryHeaderFilter
                      filterOptions={chartPatternFilterOptions}
                      selectedIds={chartPatternFilter}
                      onFilterChange={onChartPatternFilterChange}
                      emptyText="No chart pattern is detected on any stock in this list."
                      scopeText={patternScopeText}
                    />
                  )}
                </th>
              ))}
              {visibleColumns.map((col) => {
                let label = col;
                if (col === "% Cust Date Chag" && customDate) {
                  const fmt = (iso: string) =>
                    new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    });
                  label = customEndDate
                    ? `% ${fmt(customDate)} → ${fmt(customEndDate)}`
                    : `% ${fmt(customDate)}`;
                }
                return (
                  <th
                    key={col}
                    rowSpan={hasGroupedAddedColumns ? 2 : 1}
                    className="px-3 py-2.5 text-[11px] font-bold text-primary dark:text-indigo-300 uppercase tracking-wider text-right whitespace-nowrap bg-primary/10 dark:bg-indigo-400/10 border-r border-primary/20 dark:border-indigo-400/20 cursor-pointer hover:bg-primary/20/70 dark:bg-indigo-400/20 transition-colors select-none"
                    onClick={() => onSort(col)}
                  >
                    {label}
                    <SortIcon col={col} />
                  </th>
                );
              })}
              {showHitColumn && (
                <th
                  key="52W Hit"
                  rowSpan={hasGroupedAddedColumns ? 2 : 1}
                  title="Whether the session made a fresh 52-week high or low"
                  className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center whitespace-nowrap bg-muted/90 border-r border-border select-none"
                >
                  52W Hit
                </th>
              )}
              {addedColumnGroups.map(
                ({ timeframe, columns: groupColumns }, groupIdx) => {
                  const theme =
                    TIMEFRAME_THEMES[groupIdx % TIMEFRAME_THEMES.length];
                  const tfDisplay = timeframe.label.startsWith("TF ")
                    ? timeframe.label
                    : `TF ${timeframe.label}`;
                  return (
                    <th
                      key={timeframe.id}
                      colSpan={groupColumns.length}
                      className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap ${theme.superHeaderClass}`}
                    >
                      {tfDisplay}
                    </th>
                  );
                },
              )}
            </tr>
            {hasGroupedAddedColumns && (
              <tr className="border-b border-border">
                {addedColumnGroups.flatMap(
                  ({ columns: groupColumns }, groupIdx) => {
                    const theme =
                      TIMEFRAME_THEMES[groupIdx % TIMEFRAME_THEMES.length];
                    return groupColumns.map((col) => (
                      <AddedColumnSubheaderCell
                        key={col.id}
                        col={col}
                        theme={theme}
                        filter={technicalColumnFilters[col.id]}
                        onApplyFilter={
                          onApplyTechnicalColumnFilter
                            ? (filter) =>
                                onApplyTechnicalColumnFilter(col.id, filter)
                            : undefined
                        }
                        onSort={
                          isUniverseScreenableColumn(col)
                            ? () => onSort(col.id)
                            : undefined
                        }
                        sortOrder={sortCol === col.id ? sortOrder : undefined}
                      />
                    ));
                  },
                )}
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-border">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    visibleBase.length +
                    visibleColumns.length +
                    addedColumns.length +
                    (showHitColumn ? 1 : 0)
                  }
                  className="px-4 py-16 text-center text-xs text-muted-foreground"
                >
                  No market data available for current selection.
                </td>
              </tr>
            ) : (
              data.map((stock) => {
                const displayedNetChange =
                  customDate &&
                  stock.customNetChange !== null &&
                  stock.customNetChange !== undefined
                    ? stock.customNetChange
                    : stock.netChange;
                const customPercentChange =
                  stock.percentChanges["% Cust Date Chag"];
                const displayedPercentChange =
                  customDate &&
                  customPercentChange !== null &&
                  customPercentChange !== undefined
                    ? customPercentChange
                    : (stock.percentChange ?? 0);
                const colorClass =
                  displayedNetChange > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : displayedNetChange < 0
                      ? "text-error dark:text-rose-400"
                      : "text-muted-foreground";
                return (
                  <tr
                    key={`${stock.id}-${stock.companyName}`}
                    className="finder-row transition-colors border-b border-border hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                  >
                    {visibleBase.map((col) =>
                      renderBaseCell(
                        col,
                        stock,
                        colorClass,
                        displayedNetChange,
                        displayedPercentChange,
                        col === "Candlestick"
                          ? candlestickCellForStock?.(stock)
                          : undefined,
                        col === "Chart Patterns"
                          ? chartPatternCellForStock?.(stock)
                          : undefined,
                      ),
                    )}
                    {visibleColumns.map((col) => {
                      const value = stock.percentChanges[col];
                      const isNull = value === null || value === undefined;
                      const isGainer =
                        value !== null && value !== undefined && value >= 0;
                      return (
                        <td
                          key={col}
                          className="px-3 py-2 text-right whitespace-nowrap border-r border-border"
                        >
                          {isNull ? (
                            <span className="text-muted-foreground/60">—</span>
                          ) : (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold num-font ${
                                isGainer
                                  ? "bg-success/10 dark:bg-emerald-400/10 text-success dark:text-emerald-300 border border-success/30 dark:border-emerald-400/30"
                                  : "bg-error/10 dark:bg-rose-400/10 text-error dark:text-rose-300 border border-error/30 dark:border-rose-400/30"
                              }`}
                            >
                              {isGainer ? "+" : ""}
                              {value.toFixed(2)}%
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {showHitColumn && (
                      <td
                        key="52W Hit"
                        className="px-3 py-2 text-center whitespace-nowrap border-r border-border"
                      >
                        {renderHitCell(stock)}
                      </td>
                    )}
                    {addedColumns.map((col) => {
                      const value =
                        addedColumnValues[addedColumnInstrumentKey(stock)]?.[
                          col.id
                        ];
                      const state = value?.state ?? "insufficient-data";
                      const display = value?.display ?? "—";
                      const dLower = display.trim().toLowerCase();

                      const isBullish =
                        dLower === "yes" ||
                        dLower === "detected" ||
                        dLower.includes("bullish") ||
                        dLower === "long" ||
                        dLower.includes("buy");

                      const isBearish =
                        dLower.includes("bearish") ||
                        dLower === "short" ||
                        dLower.includes("sell");

                      const isNeutralNo =
                        dLower === "no" ||
                        dLower === "none" ||
                        dLower === "neutral";

                      return (
                        <td
                          key={col.id}
                          title={value?.message}
                          className="px-3 py-2 text-center font-medium border-r border-border whitespace-nowrap"
                        >
                          {state === "ready" ? (
                            isBullish ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-success/10 dark:bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-success dark:text-emerald-300 border border-success/30 dark:border-emerald-400/30 shadow-xs">
                                <span className="h-1.5 w-1.5 rounded-full bg-success"></span>
                                {dLower === "yes" ? "Yes" : display}
                              </span>
                            ) : isBearish ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-error/10 dark:bg-rose-400/10 px-2 py-0.5 text-[11px] font-bold text-error dark:text-rose-300 border border-error/30 dark:border-rose-400/30 shadow-xs">
                                <span className="h-1.5 w-1.5 rounded-full bg-error"></span>
                                {display}
                              </span>
                            ) : isNeutralNo ? (
                              <span className="text-muted-foreground/60 select-none">
                                —
                              </span>
                            ) : (
                              <span className="text-foreground font-semibold text-xs">
                                {display}
                              </span>
                            )
                          ) : state === "warming-live-feed" ||
                            state === "warming-intraday" ? (
                            <span className="text-indigo-500 dark:text-indigo-300 text-[11px] animate-pulse">
                              Syncing...
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 select-none">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <PaginationControls
          pagination={pagination}
          onPageChange={onPageChange}
          tone={vgs ? "vgs" : "terminal"}
        />
      )}
    </div>
  );
};

export type MarketPageTheme = "terminal" | "vgs";

function MarketPageContent({
  enableAddColumns = true,
  settingsScope = "market",
  theme = "terminal",
  includeEtfs = false,
}: {
  enableAddColumns?: boolean;
  settingsScope?: string;
  theme?: MarketPageTheme;
  includeEtfs?: boolean;
}) {
  const vgs = theme === "vgs";
  const router = useRouter();
  const searchParams = useSearchParams();

  const viewParam = searchParams.get("view") as ViewType | null;
  const currentView: ViewType =
    viewParam === "gainers" ||
    viewParam === "losers" ||
    viewParam === "unchanged"
      ? viewParam
      : "all";

  const { settings, updateSettings, resetSettings } =
    usePersistedSettings<MarketSettingsPayload>({
      scope: settingsScope,
      defaultSettings: defaultMarketSettings,
      normalize: normalizeMarketSettings,
    });

  const selectedExchange = settings.selectedExchange;
  const setSelectedExchange = useCallback(
    (ex: Exchange | ((prev: Exchange) => Exchange)) => {
      updateSettings((prev) => ({
        ...prev,
        selectedExchange:
          typeof ex === "function" ? ex(prev.selectedExchange) : ex,
      }));
    },
    [updateSettings],
  );

  const [stockData, setStockData] = useState<StockData[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: PAGE_SIZE,
    totalStocks: 0,
    totalPages: 0,
  });
  const [stats, setStats] = useState<Stats>({
    totalGainers: 0,
    totalLosers: 0,
    totalUnchanged: 0,
    avgGain: 0,
    avgLoss: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  // Captured post-fetch (not read live during render) so the "Live Data"
  // badge's staleness check stays a pure function of state.
  const [lastSyncCheckedAtMs, setLastSyncCheckedAtMs] = useState<number | null>(
    null,
  );
  const [liveFeedRegistrationError, setLiveFeedRegistrationError] = useState<
    string | null
  >(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const activeTab = settings.activeTab;
  const setActiveTab = useCallback(
    (tab: string | ((prev: string) => string)) => {
      updateSettings((prev) => ({
        ...prev,
        activeTab: typeof tab === "function" ? tab(prev.activeTab) : tab,
      }));
    },
    [updateSettings],
  );

  const activeTabSettings: MarketTabSettings =
    settings.tabs[activeTab] ?? defaultMarketTabSettings;

  // Reads/writes whichever tab is active AT THE TIME the update is applied
  // (via prev.activeTab, not the activeTab captured at render time), so
  // every tab keeps exactly its own filters/columns/sort/technical filters
  // isolated from every other tab.
  const updateActiveTabSettings = useCallback(
    (
      updater:
        | Partial<MarketTabSettings>
        | ((prev: MarketTabSettings) => MarketTabSettings),
    ) => {
      updateSettings((prev) => {
        const tab = prev.activeTab;
        const prevTabSettings = prev.tabs[tab] ?? defaultMarketTabSettings;
        const nextTabSettings =
          typeof updater === "function"
            ? updater(prevTabSettings)
            : { ...prevTabSettings, ...updater };
        return {
          ...prev,
          tabs: { ...prev.tabs, [tab]: nextTabSettings },
        };
      });
    },
    [updateSettings],
  );

  const sortCol = activeTabSettings.sortCol;
  const setSortCol = useCallback(
    (col: string | ((prev: string) => string)) => {
      updateActiveTabSettings((prev) => ({
        ...prev,
        sortCol: typeof col === "function" ? col(prev.sortCol) : col,
      }));
    },
    [updateActiveTabSettings],
  );

  const sortOrder = activeTabSettings.sortOrder;
  const setSortOrder = useCallback(
    (order: "asc" | "desc" | ((prev: "asc" | "desc") => "asc" | "desc")) => {
      updateActiveTabSettings((prev) => ({
        ...prev,
        sortOrder: typeof order === "function" ? order(prev.sortOrder) : order,
      }));
    },
    [updateActiveTabSettings],
  );

  const [currentPage, setCurrentPage] = useState(1);

  const filters = activeTabSettings.filters;
  const setFilters = useCallback(
    (f: FilterState | ((prev: FilterState) => FilterState)) => {
      updateActiveTabSettings((prev) => ({
        ...prev,
        filters: typeof f === "function" ? f(prev.filters) : f,
      }));
    },
    [updateActiveTabSettings],
  );

  const [debouncedFilters, setDebouncedFilters] = useState<FilterState>(
    () => activeTabSettings.filters,
  );
  const [filterOptions, setFilterOptions] =
    useState<FilterOptions>(emptyFilterOptions);
  const [filteredCounts, setFilteredCounts] = useState<{
    total: number;
    gainers: number;
    losers: number;
    unchanged: number;
    highHits: number;
    lowHits: number;
  } | null>(null);
  // 52-week hit screen, kept per tab like every other tab-scoped setting but
  // outside the persisted payload so saved views stay comparable.
  const [hitByTab, setHitByTab] = useState<Record<string, HitFilter>>({});

  const hiddenColumns = useMemo(
    () => new Set(activeTabSettings.hiddenColumns),
    [activeTabSettings.hiddenColumns],
  );
  const setHiddenColumns = useCallback(
    (cols: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      updateActiveTabSettings((prev) => {
        const nextSet =
          typeof cols === "function" ? cols(new Set(prev.hiddenColumns)) : cols;
        return {
          ...prev,
          hiddenColumns: Array.from(nextSet),
        };
      });
    },
    [updateActiveTabSettings],
  );

  const selectedAddColumnConfig = activeTabSettings.selectedAddColumnConfig;
  const technicalColumnFilters = activeTabSettings.technicalColumnFilters;
  const addedColumns = useMemo(
    () => buildAddedColumnDefinitions(selectedAddColumnConfig),
    [selectedAddColumnConfig],
  );
  // A filter or sort on a column the server can evaluate for every stock is
  // applied there, across the whole universe; the rest (live-feed and
  // intraday timeframes, whose candles exist only for the rows on screen)
  // still filter the current page.
  const universeColumnIds = useMemo(
    () =>
      new Set(
        addedColumns
          .filter(isUniverseScreenableColumn)
          .map((column) => column.id),
      ),
    [addedColumns],
  );
  const serverTechnicalFilters = useMemo(
    () =>
      Object.values(technicalColumnFilters).filter((filter) =>
        universeColumnIds.has(filter.columnId),
      ),
    [technicalColumnFilters, universeColumnIds],
  );
  const pageLocalTechnicalFilters = useMemo(
    () =>
      Object.values(technicalColumnFilters).filter(
        (filter) =>
          !universeColumnIds.has(filter.columnId) &&
          addedColumns.some((column) => column.id === filter.columnId),
      ),
    [technicalColumnFilters, universeColumnIds, addedColumns],
  );
  const setSelectedAddColumnConfig = useCallback(
    (
      cfg:
        AddColumnSelection | ((prev: AddColumnSelection) => AddColumnSelection),
    ) => {
      updateActiveTabSettings((prev) => ({
        ...prev,
        selectedAddColumnConfig:
          typeof cfg === "function" ? cfg(prev.selectedAddColumnConfig) : cfg,
      }));
    },
    [updateActiveTabSettings],
  );

  const onlyShowTechnicalMatches = activeTabSettings.onlyShowTechnicalMatches;
  const setOnlyShowTechnicalMatches = useCallback(
    (show: boolean | ((prev: boolean) => boolean)) => {
      updateActiveTabSettings((prev) => ({
        ...prev,
        onlyShowTechnicalMatches:
          typeof show === "function"
            ? show(prev.onlyShowTechnicalMatches)
            : show,
      }));
    },
    [updateActiveTabSettings],
  );

  const removeAddedColumn = useCallback(
    (groupId: string | null, itemId: string | null, timeframeId: string) => {
      const colId =
        groupId && itemId
          ? `${timeframeId}:${groupId}:${itemId}`
          : `${timeframeId}:change`;
      updateActiveTabSettings((prev) => {
        const nextFilters = { ...prev.technicalColumnFilters };
        delete nextFilters[colId];
        const nextConfig =
          !groupId || !itemId
            ? {
                ...prev.selectedAddColumnConfig,
                timeframes: prev.selectedAddColumnConfig.timeframes.filter(
                  (tf) => tf !== timeframeId,
                ),
              }
            : {
                ...prev.selectedAddColumnConfig,
                groups: {
                  ...prev.selectedAddColumnConfig.groups,
                  [groupId]: (
                    prev.selectedAddColumnConfig.groups[groupId] || []
                  ).filter((id) => id !== itemId),
                },
              };
        return {
          ...prev,
          technicalColumnFilters: nextFilters,
          selectedAddColumnConfig: nextConfig,
        };
      });
    },
    [updateActiveTabSettings],
  );

  const clearAllTechnicalColumns = useCallback(() => {
    updateActiveTabSettings((prev) => ({
      ...prev,
      selectedAddColumnConfig: emptyAddColumnSelection,
      technicalColumnFilters: {},
    }));
  }, [updateActiveTabSettings]);

  const [addedColumnValues, setAddedColumnValues] = useState<AddedColumnValues>(
    {},
  );
  const [addedColumnsLoading, setAddedColumnsLoading] = useState(false);
  const [addedColumnsError, setAddedColumnsError] = useState<string | null>(
    null,
  );
  const [patternView, setPatternView] = useState<{
    groupId: string;
    itemId: string;
    label: string;
  } | null>(null);
  // Summary-column filters: pattern ids applied on the server across the
  // whole result; empty means no filter.
  const [candlestickPatternFilter, setCandlestickPatternFilter] = useState<
    string[]
  >([]);
  const [chartPatternFilter, setChartPatternFilter] = useState<string[]>([]);
  // Server-detected patterns for the rows on this page, and per-pattern
  // counts over the whole result for the header filter menus.
  const [patternSummary, setPatternSummary] =
    useState<PatternSummaryPayload | null>(null);
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
  const [customDatePopupOffset, setCustomDatePopupOffset] = useState(0);
  const customDateTabRef = useRef<HTMLButtonElement>(null);
  const customDatePopupRef = useRef<HTMLDivElement>(null);
  const marketRequestIdRef = useRef(0);
  const marketRequestControllerRef = useRef<AbortController | null>(null);

  const hitFilter: HitFilter = hitByTab[activeTab] ?? "all";
  const showHitControl = activeTab === "52weeks" || activeTab === "custom";
  const hitReferenceIso =
    activeTab === "custom" ? customEndDate || customDate || "" : "";
  const hitSessionLabel =
    activeTab === "custom" && hitReferenceIso
      ? `on ${isoToDisplay(hitReferenceIso)}`
      : "in today's session";
  const hitHint =
    activeTab === "custom"
      ? `Fresh 52-week highs and lows ${hitSessionLabel}, from each stock's daily candles`
      : "Fresh 52-week highs and lows in today's session";
  const handleHitChange = useCallback(
    (hit: HitFilter) => {
      setHitByTab((prev) => ({ ...prev, [activeTab]: hit }));
      setCurrentPage(1);
    },
    [activeTab],
  );

  const exchanges = EXCHANGE_OPTIONS;

  const allTabs: { id: string; label: string }[] = [
    { id: "today", label: "Today Markets" },
    { id: "intraday", label: "Intraday Wise" },
    { id: "days", label: "Days Wise" },
    { id: "weeks", label: "Weeks Wise" },
    { id: "months", label: "Months Wise" },
    { id: "years", label: "Years Wise" },
    { id: "custom", label: "Customize Date" },
    { id: "seasonality", label: "Seasonality" },
    { id: "ytd", label: "Year to Date" },
    { id: "52weeks", label: "52 Weeks Gainers & Losers" },
    { id: "all_time", label: "All Time Gainers & Losers" },
  ];

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchFilterOptions(): Promise<void> {
      try {
        const response = await fetch(
          `/api/market/filters?exchange=${selectedExchange}`,
          { credentials: "same-origin", signal: controller.signal },
        );
        const payload: unknown = await response.json();
        if (!response.ok || !isMarketFilterOptions(payload)) {
          throw new Error(INVALID_MARKET_RESPONSE_MESSAGE);
        }

        const options: FilterOptions = {
          sectors: [...payload.sectors],
          industries: [...payload.industries],
          marketCaps: [...payload.marketCaps],
          priceBands: [...payload.priceBands],
          series: [...payload.series],
        };
        if (!controller.signal.aborted) {
          setFilterOptions(options);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setFilterOptions(emptyFilterOptions);
      }
    }

    void fetchFilterOptions();
    return () => controller.abort();
  }, [selectedExchange]);

  const isTodayTab = activeTab === "today";
  const activeBaseColumns = isTodayTab ? todayBaseColumns : standardBaseColumns;
  const activeToggleableBaseColumns = isTodayTab
    ? TODAY_TOGGLEABLE_COLUMNS
    : STANDARD_TOGGLEABLE_COLUMNS;
  const currentColumns = isTodayTab
    ? []
    : columnsByPeriod[activeTab as TimePeriod | SubTab] || [];
  const toggleableColumnsForTab = [
    ...activeToggleableBaseColumns,
    ...currentColumns,
  ];
  const periodLabel = allTabs.find((t) => t.id === activeTab)?.label;

  // The summary columns scan the page's selected daily-or-coarser
  // timeframes (daily when none is selected), and only while one of the two
  // columns is on the table.
  const showPatternSummary =
    (activeBaseColumns.includes("Candlestick") &&
      !hiddenColumns.has("Candlestick")) ||
    (activeBaseColumns.includes("Chart Patterns") &&
      !hiddenColumns.has("Chart Patterns"));
  const patternTimeframes = useMemo(
    () =>
      resolvePatternSummaryTimeframes(
        enableAddColumns ? selectedAddColumnConfig.timeframes : [],
      ),
    [enableAddColumns, selectedAddColumnConfig.timeframes],
  );
  const patternTimeframesParam = showPatternSummary
    ? patternTimeframes.join(",")
    : "";
  const candlestickPatternParam = candlestickPatternFilter.join(",");
  const chartPatternParam = chartPatternFilter.join(",");

  const fetchMarketData = useCallback(
    async (page: number, isRefresh = false) => {
      marketRequestControllerRef.current?.abort();
      const controller = new AbortController();
      const requestId = marketRequestIdRef.current + 1;
      marketRequestIdRef.current = requestId;
      marketRequestControllerRef.current = controller;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const filter = currentView === "all" ? "all" : currentView;
        // A sort on an added column only reaches the server while that
        // column is on the table and can be screened universe-wide.
        const sort = sortCol.includes(":")
          ? universeColumnIds.has(sortCol)
            ? sortCol
            : "pctChange"
          : sortCol;
        const params = new URLSearchParams({
          exchange: selectedExchange,
          filter,
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sort,
          order: sortOrder,
          ...(serverTechnicalFilters.length > 0
            ? { technicals: encodeTechnicalFilters(serverTechnicalFilters) }
            : {}),
          ...(searchQuery ? { search: searchQuery } : {}),
          ...(debouncedFilters.sectors?.length
            ? { sectors: debouncedFilters.sectors.join(",") }
            : {}),
          ...(debouncedFilters.industries?.length
            ? { industries: debouncedFilters.industries.join(",") }
            : {}),
          ...(debouncedFilters.marketCaps?.length
            ? { marketCaps: debouncedFilters.marketCaps.join(",") }
            : {}),
          ...(debouncedFilters.priceBands?.length
            ? { priceBands: debouncedFilters.priceBands.join(",") }
            : {}),
          ...(debouncedFilters.series?.length
            ? { series: debouncedFilters.series.join(",") }
            : {}),
          ...(debouncedFilters.marketCapMin
            ? { marketCapMin: debouncedFilters.marketCapMin }
            : {}),
          ...(debouncedFilters.marketCapMax
            ? { marketCapMax: debouncedFilters.marketCapMax }
            : {}),
          ...(debouncedFilters.priceMin
            ? { priceMin: debouncedFilters.priceMin }
            : {}),
          ...(debouncedFilters.priceMax
            ? { priceMax: debouncedFilters.priceMax }
            : {}),
          ...(debouncedFilters.changeMin
            ? { changeMin: debouncedFilters.changeMin }
            : {}),
          ...(debouncedFilters.changeMax
            ? { changeMax: debouncedFilters.changeMax }
            : {}),
          ...(debouncedFilters.volumeMin
            ? { volumeMin: debouncedFilters.volumeMin }
            : {}),
          ...(customDate ? { customDate } : {}),
          ...(customEndDate ? { customEndDate } : {}),
          ...(hitFilter !== "all" ? { hit: hitFilter } : {}),
          ...(includeEtfs ? { etfs: "true" } : {}),
          ...(patternTimeframesParam
            ? { patternTimeframes: patternTimeframesParam }
            : {}),
          ...(candlestickPatternParam
            ? { candlestickPatterns: candlestickPatternParam }
            : {}),
          ...(chartPatternParam ? { chartPatterns: chartPatternParam } : {}),
        });

        const response = await fetch(`/api/market/live?${params}`, {
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => undefined);
          if (requestId === marketRequestIdRef.current) {
            setError(
              getMarketApiErrorMessage(
                payload,
                "Failed to load live market data.",
              ),
            );
          }
          return;
        }

        const data: unknown = await response.json();
        if (!isMarketLiveResponse(data)) {
          throw new Error(INVALID_MARKET_RESPONSE_MESSAGE);
        }

        if (requestId !== marketRequestIdRef.current) {
          return;
        }

        setStockData([...data.stocks]);
        setPatternSummary(data.patternSummary ?? null);
        setPagination({ ...data.pagination });
        setStats({
          totalGainers: data.stats.totalGainers,
          totalLosers: data.stats.totalLosers,
          totalUnchanged: data.stats.totalUnchanged,
          avgGain: data.stats.avgGain,
          avgLoss: data.stats.avgLoss,
        });
        setFilteredCounts({ ...data.filteredCounts });
        setLastSyncAt(data.lastSyncAt);
        setLastSyncCheckedAtMs(Date.now());
        setSyncStatus({
          ...data.syncStatus,
          historicalProgress: { ...data.syncStatus.historicalProgress },
        });
        setCurrentPage(data.pagination.page);
      } catch (error) {
        if (
          controller.signal.aborted ||
          requestId !== marketRequestIdRef.current
        ) {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load live market data. Please try again.",
        );
      } finally {
        if (requestId === marketRequestIdRef.current) {
          marketRequestControllerRef.current = null;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      includeEtfs,
      selectedExchange,
      currentView,
      sortCol,
      sortOrder,
      searchQuery,
      debouncedFilters,
      customDate,
      customEndDate,
      hitFilter,
      serverTechnicalFilters,
      universeColumnIds,
      patternTimeframesParam,
      candlestickPatternParam,
      chartPatternParam,
    ],
  );

  useEffect(() => {
    const initialFetchTimer = window.setTimeout(() => {
      void fetchMarketData(1);
    }, 0);

    return () => window.clearTimeout(initialFetchTimer);
  }, [fetchMarketData]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchMarketData(currentPage, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMarketData, currentPage]);

  useEffect(() => () => marketRequestControllerRef.current?.abort(), []);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchMarketData(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSort = (col: string) => {
    if (col === sortCol) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortCol(col);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleViewChange = (view: ViewType) => {
    setCurrentPage(1);
    router.push(`/market?view=${view}`);
  };

  // The popup is ~980px wide; keep its left edge close to the tab but
  // pull it back when the tab sits too far right to fit it on screen.
  const CUSTOM_DATE_POPUP_WIDTH = 980;
  const alignCustomDatePopup = useCallback(() => {
    const tabLeft = customDateTabRef.current?.offsetLeft ?? 0;
    const parentWidth =
      (customDateTabRef.current?.offsetParent as HTMLElement | null)
        ?.clientWidth ?? CUSTOM_DATE_POPUP_WIDTH;
    setCustomDatePopupOffset(
      Math.max(0, Math.min(tabLeft, parentWidth - CUSTOM_DATE_POPUP_WIDTH - 8)),
    );
  }, []);

  const openCustomDatePicker = () => {
    setStartDateInput(isoToDisplay(customDate));
    setEndDateInput(isoToDisplay(customEndDate));
    setDateError("");

    const anchor = customDate ? new Date(customDate + "T00:00:00") : new Date();
    setCalendarMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    alignCustomDatePopup();
    setActiveTab("custom");
    setIsCustomDatePopupOpen(true);
  };

  const handleTabChange = (tab: string) => {
    if (tab === "custom" && activeTab === "custom") {
      alignCustomDatePopup();
      setIsCustomDatePopupOpen((prev) => !prev);
      return;
    }

    if (tab === "custom") {
      openCustomDatePicker();
      setCurrentPage(1);
      setSortCol(customDate ? "% Cust Date Chag" : "pctChange");
      setSortOrder("desc");
      return;
    }

    setActiveTab(tab);
    setCurrentPage(1);

    setSortCol("pctChange");
    setSortOrder("desc");
    setIsCustomDatePopupOpen(false);
  };

  useEffect(() => {
    if (!isCustomDatePopupOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        customDatePopupRef.current &&
        !customDatePopupRef.current.contains(target) &&
        customDateTabRef.current &&
        !customDateTabRef.current.contains(target)
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

  const handleExchangeChange = (exchange: Exchange) => {
    setSelectedExchange(exchange);
    setFilters(emptyFilters);
    setDebouncedFilters(emptyFilters);
    setCurrentPage(1);
  };

  // Everything a saved view restores. Sets and Maps do not survive JSON, so
  // hiddenColumns travels as a sorted array.
  const savedViewPayload = useMemo(
    (): SavedViewPayload => ({
      filters,
      hiddenColumns: [...hiddenColumns].sort(),
      addColumns: selectedAddColumnConfig,
      exchange: selectedExchange,
      tab: activeTab,
      sort: sortCol,
      order: sortOrder,
      ...(customDate ? { customDate } : {}),
      ...(customEndDate ? { customEndDate } : {}),
    }),
    [
      filters,
      hiddenColumns,
      selectedAddColumnConfig,
      selectedExchange,
      activeTab,
      sortCol,
      sortOrder,
      customDate,
      customEndDate,
    ],
  );

  const applySavedView = useCallback((payload: SavedViewPayload) => {
    const restoredFilters: FilterState = {
      ...emptyFilters,
      ...payload.filters,
    };
    setFilters(restoredFilters);
    // Skip the 300ms debounce: an applied view should refetch immediately
    // rather than showing the previous result for a beat.
    setDebouncedFilters(restoredFilters);
    setHiddenColumns(new Set(payload.hiddenColumns));
    setSelectedAddColumnConfig(
      normalizeAddColumnSelection(
        payload.addColumns ?? emptyAddColumnSelection,
      ),
    );
    if (payload.exchange && isExchange(payload.exchange)) {
      setSelectedExchange(payload.exchange);
    }
    setCustomDate(payload.customDate ?? "");
    setCustomEndDate(payload.customEndDate ?? "");
    if (payload.tab) {
      setActiveTab(payload.tab);
      setIsCustomDatePopupOpen(false);
    }
    if (payload.sort && isMarketSortField(payload.sort)) {
      setSortCol(payload.sort);
    }
    if (payload.order) {
      setSortOrder(payload.order);
    }
    setCurrentPage(1);
  }, []);

  const getAddedColumnItemAvailability = useCallback(
    (_groupId: string, _itemId: string) => {
      return {
        disabled: false,
        message: undefined,
      };
    },
    [],
  );

  const getAddedColumnTimeframeAvailability = useCallback(
    (_timeframeId: string) => {
      return {
        disabled: false,
        message: undefined,
      };
    },
    [],
  );

  useEffect(() => {
    if (
      !enableAddColumns ||
      addedColumns.length === 0 ||
      stockData.length === 0
    ) {
      return;
    }

    const controller = new AbortController();
    const instruments = stockData.map((stock) => ({
      securityId: stock.securityId,
      exchange: stock.exchange,
      exchangeSegment: stock.exchangeSegment,
    }));
    const needsLiveFeed = addedColumns.some((column) => {
      if (column.kind === "change") return column.timeframeId.includes("sec");
      return Boolean(
        column.groupId &&
        column.itemId &&
        resolveColumnCapability(
          column.groupId,
          column.itemId,
          column.timeframeId,
        ).status === "needs-live-feed",
      );
    });
    const needsIntradayCandles = addedColumns.some((column) => {
      const timeframe = resolveTimeframeCapability(column.timeframeId);
      if (!timeframe.dhanInterval || timeframe.dhanInterval === "day") {
        return false;
      }
      if (column.kind === "change") return true;
      if (!column.groupId || !column.itemId) return false;
      const capability = resolveColumnCapability(
        column.groupId,
        column.itemId,
        column.timeframeId,
      );
      return capability.status === "supported" && capability.requiresCandles;
    });

    async function fetchAddedColumnValues(): Promise<void> {
      try {
        setAddedColumnsLoading(true);
        setAddedColumnsError(null);
        if (needsLiveFeed) {
          try {
            const registrationResponse = await fetch("/api/market/live-feed", {
              method: "POST",
              credentials: "same-origin",
              signal: controller.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                instruments: instruments.map(
                  ({ securityId, exchangeSegment }) => ({
                    securityId,
                    exchangeSegment,
                  }),
                ),
              }),
            });
            if (!registrationResponse.ok) {
              const payload: unknown = await registrationResponse
                .json()
                .catch(() => undefined);
              if (!controller.signal.aborted) {
                setLiveFeedRegistrationError(
                  getMarketApiErrorMessage(
                    payload,
                    "The live-feed subscription could not be started.",
                  ),
                );
              }
            } else if (!controller.signal.aborted) {
              setLiveFeedRegistrationError(null);
            }
          } catch (registrationError) {
            if (
              !controller.signal.aborted &&
              !(
                registrationError instanceof Error &&
                registrationError.name === "AbortError"
              )
            ) {
              setLiveFeedRegistrationError(
                "The live-feed subscription could not be started.",
              );
            }
          }
        } else {
          setLiveFeedRegistrationError(null);
        }

        const response = await fetch("/api/market/column-values", {
          method: "POST",
          credentials: "same-origin",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selection: selectedAddColumnConfig,
            instruments,
          }),
        });
        const payload: unknown = await response.json().catch(() => undefined);
        if (!response.ok || !isMarketColumnValuesResponse(payload)) {
          throw new Error(
            getMarketApiErrorMessage(
              payload,
              "Added column values could not be loaded.",
            ),
          );
        }
        if (!controller.signal.aborted) {
          setAddedColumnValues(payload.values as AddedColumnValues);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setAddedColumnValues({});
        setAddedColumnsError(
          error instanceof Error
            ? error.message
            : "Added column values could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) setAddedColumnsLoading(false);
      }
    }

    void fetchAddedColumnValues();
    const liveRefreshTimer =
      needsLiveFeed || needsIntradayCandles
        ? window.setInterval(() => void fetchAddedColumnValues(), 5_000)
        : undefined;
    return () => {
      controller.abort();
      if (liveRefreshTimer !== undefined)
        window.clearInterval(liveRefreshTimer);
    };
  }, [enableAddColumns, addedColumns, stockData, selectedAddColumnConfig]);

  const activeDisplayCounts = filteredCounts || {
    total: stats.totalGainers + stats.totalLosers + stats.totalUnchanged,
    gainers: stats.totalGainers,
    losers: stats.totalLosers,
    unchanged: stats.totalUnchanged,
    highHits: 0,
    lowHits: 0,
  };
  const totalStocksCount = activeDisplayCounts.total;
  const activeFilterOptions = filterOptions;
  const activeToggleableColumns = toggleableColumnsForTab;

  const handleApplyTechnicalColumnFilter = useCallback(
    (columnId: string, filter: TechnicalColumnFilter | null) => {
      updateActiveTabSettings((prev) => {
        const next = { ...prev.technicalColumnFilters };
        if (!filter) {
          delete next[columnId];
        } else {
          next[columnId] = filter;
        }
        return { ...prev, technicalColumnFilters: next };
      });
    },
    [updateActiveTabSettings],
  );

  const clearAllTechnicalColumnFilters = useCallback(() => {
    updateActiveTabSettings((prev) => ({
      ...prev,
      technicalColumnFilters: {},
    }));
  }, [updateActiveTabSettings]);

  const isSignalColumn = useCallback((col: AddedColumnDefinition) => {
    if (col.kind === "change") return false;
    if (
      col.groupId === "candlesticks" ||
      col.groupId === "chart-patterns" ||
      col.groupId === "strategies-builder"
    ) {
      return true;
    }
    if (!col.itemId) return false;
    const signalItemIds = new Set([
      "golden-cross",
      "death-cross",
      "macd-crossover",
      "vwap-cross",
      "supertrend-buy-sell",
      "rsi-overbought",
      "rsi-oversold",
      "ma-crossover",
      "ema-crossover",
      "price-above-sma-50",
      "price-below-sma-50",
      "price-above-sma-200",
      "price-below-sma-200",
      "volume-spike",
      "gap-up-filter",
      "gap-down-filter",
      "near-day-high",
      "near-day-low",
      "near-52-week-high",
      "near-52-week-low",
      "new-52-week-high",
      "new-52-week-low",
      "near-all-time-high",
      "near-all-time-low",
      "new-all-time-high",
      "new-all-time-low",
      "supertrend-signal",
      "parabolic-sar-signal",
      "macd-signal",
    ]);
    return signalItemIds.has(col.itemId);
  }, []);

  const hasActiveSignalColumns = useMemo(() => {
    return addedColumns.some(isSignalColumn);
  }, [addedColumns, isSignalColumn]);

  const isMatchingStock = useCallback(
    (stock: StockData): boolean => {
      if (!hasActiveSignalColumns) return true;
      const stockVals = addedColumnValues[addedColumnInstrumentKey(stock)];
      if (!stockVals) return false;
      for (const col of addedColumns) {
        if (!isSignalColumn(col)) continue;
        const val = stockVals[col.id];
        if (!val) continue;
        const d = (val.display ?? "").trim().toLowerCase();
        if (
          d === "yes" ||
          d === "detected" ||
          d === "bullish" ||
          d === "bearish" ||
          d === "long" ||
          d.includes("signal") ||
          d.includes("buy")
        ) {
          return true;
        }
      }
      return false;
    },
    [addedColumns, addedColumnValues, hasActiveSignalColumns, isSignalColumn],
  );

  const matchesTechnicalColumnFilters = useCallback(
    (stock: StockData): boolean => {
      if (pageLocalTechnicalFilters.length === 0) return true;
      const stockVals = addedColumnValues[addedColumnInstrumentKey(stock)];
      if (!stockVals) return false;
      return pageLocalTechnicalFilters.every((filter) =>
        matchesTechnicalFilter(stockVals[filter.columnId], filter),
      );
    },
    [pageLocalTechnicalFilters, addedColumnValues],
  );

  const matchingStockCount = useMemo(() => {
    if (!hasActiveSignalColumns) return stockData.length;
    return stockData.filter(isMatchingStock).length;
  }, [stockData, hasActiveSignalColumns, isMatchingStock]);

  // Pattern columns the user added on a timeframe the server summary does
  // not scan (intraday, live feed) still feed the summary cells, from the
  // same values their Yes/No cells render.
  const addedPatternColumns = useMemo(
    () =>
      enableAddColumns
        ? addedColumns.filter(
            (column) => !isPatternSummaryTimeframe(column.timeframeId),
          )
        : [],
    [enableAddColumns, addedColumns],
  );
  const patternTimeframeText = useMemo(
    () =>
      (patternSummary?.timeframeIds ?? patternTimeframes)
        .map(patternTimeframeLabel)
        .join(", "),
    [patternSummary, patternTimeframes],
  );
  const patternCellForStock = useCallback(
    (stock: StockData, group: "candlesticks" | "chart-patterns") => {
      const stockVals = addedColumnValues[addedColumnInstrumentKey(stock)];
      const summary =
        patternSummary?.rows[addedColumnInstrumentKey(stock)] ?? undefined;
      const addedMatches =
        group === "candlesticks"
          ? candlestickMatchesForRow(addedPatternColumns, stockVals)
          : patternMatchesForRow(addedPatternColumns, stockVals, group);
      const addedPending =
        group === "candlesticks"
          ? isCandlestickPendingForRow(addedPatternColumns, stockVals)
          : isPatternPendingForRow(addedPatternColumns, stockVals, group);
      return {
        matches: combinePatternMatches(
          group === "candlesticks"
            ? summary?.candlesticks
            : summary?.chartPatterns,
          addedMatches,
        ),
        pending: !summary || addedPending,
        noData: summary?.state === "no-data",
        timeframeText: patternTimeframeText,
      };
    },
    [
      addedColumnValues,
      addedPatternColumns,
      patternSummary,
      patternTimeframeText,
    ],
  );
  const candlestickCellForStock = useCallback(
    (stock: StockData) => patternCellForStock(stock, "candlesticks"),
    [patternCellForStock],
  );
  const chartPatternCellForStock = useCallback(
    (stock: StockData) => patternCellForStock(stock, "chart-patterns"),
    [patternCellForStock],
  );
  const patternScopeText = patternSummary
    ? `Stocks per pattern on ${patternTimeframeText}, across all ${patternSummary.scanned.toLocaleString("en-IN")} stocks in this list${
        patternSummary.withoutData > 0
          ? ` (${patternSummary.withoutData.toLocaleString("en-IN")} without OHLC history)`
          : ""
      }.`
    : "Scanning patterns…";

  const displayStockData = useMemo(() => {
    let data = stockData;
    if (onlyShowTechnicalMatches && hasActiveSignalColumns) {
      data = data.filter(isMatchingStock);
    }
    if (pageLocalTechnicalFilters.length > 0) {
      data = data.filter(matchesTechnicalColumnFilters);
    }
    return data;
  }, [
    stockData,
    onlyShowTechnicalMatches,
    hasActiveSignalColumns,
    isMatchingStock,
    pageLocalTechnicalFilters,
    matchesTechnicalColumnFilters,
  ]);

  const handleRefresh = () => {
    void fetchMarketData(currentPage, true);
  };

  const downloadCSV = () => {
    const visibleBase = activeBaseColumns.filter((c) => !hiddenColumns.has(c));
    const visiblePeriodColumns = currentColumns.filter(
      (c) => !hiddenColumns.has(c),
    );
    const activeAddedColumns = enableAddColumns ? addedColumns : [];
    const addedColumnLabels = activeAddedColumns.map(
      (col) => `${col.timeframeLabel} ${col.label}`,
    );
    const allColumns = [
      ...visibleBase,
      ...visiblePeriodColumns,
      ...(showHitControl ? ["52W Hit"] : []),
      ...addedColumnLabels,
    ];
    const headers = allColumns.join(",");

    const csvLines: string[] = [];
    csvLines.push(
      `Market Data - ${periodLabel} - ${selectedExchange} - ${currentView}`,
    );
    csvLines.push(`Generated on: ${new Date().toLocaleString()}`);
    csvLines.push(
      `Page ${pagination.page} of ${pagination.totalPages} (${pagination.totalStocks} total)`,
    );
    csvLines.push("");
    csvLines.push(headers);

    const getCsvValue = (col: string, stock: StockData): string => {
      switch (col) {
        case "S No":
          return stock.id;
        case "Exchange":
          return stock.exchange;
        case "Segments":
          return stock.exchangeSegment;
        case "Company Name":
          return `"${stock.companyName}"`;
        case "Trading Symbol":
          return `"${stock.tradingSymbol ?? stock.companyName}"`;
        case "Sector":
          return `"${stock.sector}"`;
        case "Industry":
          return `"${stock.industry}"`;
        case "Group":
          return stock.group;
        case "F V":
        case "FV":
          return String(stock.faceValue);
        case "P Band":
          return `"${stock.priceBand}"`;
        case "M Cap":
          return `"${stock.marketCap}"`;
        case "Pre Close":
          return stock.preClose.toFixed(2);
        case "CMP":
        case "LTP":
          return stock.cmp.toFixed(2);
        case "Net Chag":
        case "Change": {
          const displayedNetChange =
            customDate &&
            stock.customNetChange !== null &&
            stock.customNetChange !== undefined
              ? stock.customNetChange
              : stock.netChange;
          return displayedNetChange.toFixed(2);
        }
        case "Open":
          return stock.open !== undefined ? stock.open.toFixed(2) : "";
        case "High":
          return stock.high !== undefined ? stock.high.toFixed(2) : "";
        case "Low":
          return stock.low !== undefined ? stock.low.toFixed(2) : "";
        case "% Change": {
          const customPercentChange = stock.percentChanges["% Cust Date Chag"];
          const displayedPercentChange =
            customDate &&
            customPercentChange !== null &&
            customPercentChange !== undefined
              ? customPercentChange
              : (stock.percentChange ?? 0);
          return displayedPercentChange.toFixed(2);
        }
        case "Volume":
          return stock.volume !== undefined ? String(stock.volume) : "";
        case "Value":
          return stock.volume !== undefined
            ? (stock.cmp * stock.volume).toFixed(2)
            : "";
        case "52W H":
          return stock.week52High !== undefined
            ? stock.week52High.toFixed(2)
            : "";
        case "52W L":
          return stock.week52Low !== undefined
            ? stock.week52Low.toFixed(2)
            : "";
        case "30D % Chng": {
          const value = stock.percentChanges["% 1M Chag"];
          return value === null || value === undefined ? "" : value.toFixed(2);
        }
        case "Candlestick": {
          const labels = candlestickCellForStock(stock).matches.map(
            (match) => match.label,
          );
          return labels.length > 0
            ? `"${[...new Set(labels)].join("; ")}"`
            : "";
        }
        case "Chart Patterns": {
          const labels = chartPatternCellForStock(stock).matches.map(
            (match) => match.label,
          );
          return labels.length > 0
            ? `"${[...new Set(labels)].join("; ")}"`
            : "";
        }
        case "52W Hit":
          return stock.hit52High ? "52W High" : stock.hit52Low ? "52W Low" : "";
        default:
          return "";
      }
    };

    stockData.forEach((stock) => {
      const base = visibleBase.map((col) => getCsvValue(col, stock));
      const pctData = visiblePeriodColumns.map((col) => {
        const value = stock.percentChanges[col];
        return value === null || value === undefined ? "-" : value.toFixed(2);
      });
      const hitData = showHitControl ? [getCsvValue("52W Hit", stock)] : [];
      const addedData = activeAddedColumns.map((column) => {
        const value =
          addedColumnValues[addedColumnInstrumentKey(stock)]?.[column.id]
            ?.display ?? "—";
        return csvEscape(value);
      });
      csvLines.push([...base, ...pctData, ...hitData, ...addedData].join(","));
    });

    const blob = new Blob([csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `market_${activeTab}_${selectedExchange}_${currentView}_p${currentPage}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Matches the 120s staleness threshold the sync engine itself uses
  // (lib/sync/engine.ts) before it kicks off a background resync.
  const isLiveDataStale =
    lastSyncCheckedAtMs !== null &&
    (lastSyncAt === null ||
      lastSyncCheckedAtMs - new Date(lastSyncAt).getTime() > 120_000);
  // Date included: a bare time-of-day makes days-old quotes read as today's.
  const lastSyncedLabel = describeSyncFreshness(lastSyncAt).label;

  // Drill-down dialog for one candlestick or chart pattern: which
  // timeframes to screen (the selected ones, defaulting to daily) and
  // which exchange scope to cover.
  const {
    ids: patternDialogTimeframeIds,
    labels: patternDialogTimeframeLabels,
  } = useMemo(() => {
    const ids =
      selectedAddColumnConfig.timeframes.length > 0
        ? selectedAddColumnConfig.timeframes
        : ["tf-1day"];
    return {
      ids,
      labels: Object.fromEntries(
        ids.map((id) => [
          id,
          ADD_TIMEFRAMES.find((timeframe) => timeframe.id === id)?.label ?? id,
        ]),
      ) as Record<string, string>,
    };
  }, [selectedAddColumnConfig.timeframes]);
  const patternDialogExchange: "NSE" | "BSE" | "BOTH" =
    selectedExchange === "NSE" || selectedExchange === "Only NSE"
      ? "NSE"
      : selectedExchange === "BSE" || selectedExchange === "Only BSE"
        ? "BSE"
        : "BOTH";

  const filterPanel = (
    <FilterPanel
      filters={filters}
      options={activeFilterOptions}
      onChange={(f) => {
        setFilters(f);
        setCurrentPage(1);
      }}
      onReset={() => {
        setFilters(emptyFilters);
        setDebouncedFilters(emptyFilters);
        setCurrentPage(1);
      }}
      hiddenColumns={hiddenColumns}
      onHiddenColumnsChange={setHiddenColumns}
      toggleableColumns={activeToggleableColumns}
      addColumnGroups={enableAddColumns ? ADD_COLUMN_GROUPS : undefined}
      timeframeOptions={enableAddColumns ? ADD_TIMEFRAMES : undefined}
      selectedAddColumnConfig={
        enableAddColumns ? selectedAddColumnConfig : undefined
      }
      onAddColumnConfigChange={
        enableAddColumns ? setSelectedAddColumnConfig : undefined
      }
      getAddedColumnItemAvailability={
        enableAddColumns ? getAddedColumnItemAvailability : undefined
      }
      getAddedColumnTimeframeAvailability={
        enableAddColumns ? getAddedColumnTimeframeAvailability : undefined
      }
      onViewGroupItem={
        enableAddColumns
          ? (groupId, itemId, label) =>
              setPatternView({ groupId, itemId, label })
          : undefined
      }
      savedViewScope="market"
      savedViewPayload={savedViewPayload}
      onSavedViewApply={applySavedView}
    />
  );

  return (
    <div
      className={
        vgs
          ? "min-h-screen bg-background py-6"
          : "min-h-screen bg-card dark:bg-background"
      }
    >
      <div className={vgs ? "w-full px-4 lg:px-8" : "w-full px-4 py-4"}>
        {vgs && (
          <div className="[&_h1]:bg-gradient-to-r [&_h1]:from-indigo-600 [&_h1]:via-fuchsia-600 [&_h1]:to-rose-500 [&_h1]:bg-clip-text [&_h1]:text-transparent">
            <PageHeader
              title="Total Market Performance"
              description="Breadth, movers and performance across every listed stock"
              icon={Activity}
              iconColor="text-primary dark:text-indigo-400"
            />
          </div>
        )}
        {}
        <div className="relative mb-4">
          <div
            className={
              vgs
                ? "flex items-center gap-1 flex-wrap"
                : "flex border-b-2 border-black dark:border-border overflow-x-auto"
            }
          >
            {allTabs.map((tab) => (
              <button
                key={tab.id}
                ref={tab.id === "custom" ? customDateTabRef : undefined}
                onClick={() => handleTabChange(tab.id)}
                className={
                  vgs
                    ? `flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? "bg-primary text-primary-foreground shadow-primary/20 shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`
                    : `px-4 py-2 text-sm font-medium border-t border-l last:border-r border-black dark:border-border -mb-[2px] whitespace-nowrap ${
                        activeTab === tab.id
                          ? "bg-card border-b-2 border-b-white dark:border-b-card text-foreground"
                          : "bg-muted text-foreground hover:bg-muted"
                      }`
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {}
          {isCustomDatePopupOpen &&
            (() => {
              const startIso = parseDisplayDate(startDateInput).iso;
              const endIso = parseDisplayDate(endDateInput).iso;
              const selectedRange: DateRange | undefined = startIso
                ? {
                    from: new Date(`${startIso}T00:00:00`),
                    to: endIso ? new Date(`${endIso}T00:00:00`) : undefined,
                  }
                : undefined;

              const applyDateRange = () => {
                const validation = validateCustomDateRange(
                  startDateInput,
                  endDateInput,
                  todayLocalIso(),
                );
                if (!validation.ok) {
                  setDateError(validation.error);
                  return;
                }
                setDateError("");
                setCustomDate(validation.range.startIso);
                setCustomEndDate(validation.range.endIso);
                setSortCol("% Cust Date Chag");
                setSortOrder("desc");
                setCurrentPage(1);
                setIsCustomDatePopupOpen(false);
              };

              return (
                <div
                  ref={customDatePopupRef}
                  className={
                    vgs
                      ? "absolute top-full left-0 z-50 mt-2 w-[min(980px,calc(100vw-2rem))] rounded-2xl border border-border bg-card shadow-[0_18px_50px_rgba(0,0,0,0.16)] overflow-hidden"
                      : "absolute top-full left-0 z-50 mt-2 w-[min(980px,calc(100vw-2rem))] border border-black dark:border-border bg-card shadow-[0_18px_50px_rgba(0,0,0,0.16)]"
                  }
                  style={{ left: customDatePopupOffset }}
                >
                  <div
                    className={
                      vgs
                        ? "flex items-center justify-between border-b border-border bg-muted/80 px-4 py-3"
                        : "flex items-center justify-between border-b border-black dark:border-border px-4 py-3"
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={
                          vgs
                            ? "flex h-9 w-9 items-center justify-center rounded-xl bg-card border border-border shadow-[0_2px_12px_rgba(0,0,0,0.04)] text-primary dark:text-indigo-400 shrink-0"
                            : "flex h-8 w-8 items-center justify-center border border-black dark:border-border bg-black dark:bg-muted text-white dark:text-zinc-950"
                        }
                      >
                        <CalendarDays className="h-4 w-4" />
                      </span>
                      <div>
                        <p
                          className={
                            vgs
                              ? "text-sm font-bold text-foreground"
                              : "text-sm font-semibold text-foreground"
                          }
                        >
                          Customize Date
                        </p>
                        <p
                          className={
                            vgs
                              ? "text-[11px] text-muted-foreground"
                              : "text-[11px] text-muted-foreground"
                          }
                        >
                          Compare market performance between two dates
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCustomDatePopupOpen(false)}
                      className={
                        vgs
                          ? "h-8 px-3 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          : "h-8 px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      }
                    >
                      Close
                    </button>
                  </div>

                  <div className="grid md:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="relative min-w-0 p-4">
                      <DayPicker
                        mode="range"
                        selected={selectedRange}
                        month={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        onSelect={(range) => {
                          if (!range?.from) {
                            setStartDateInput("");
                            setEndDateInput("");
                            setDateError("");
                            return;
                          }
                          setStartDateInput(toDisplayDate(range.from));
                          setEndDateInput(
                            range.to ? toDisplayDate(range.to) : "",
                          );
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
                          root: "w-full min-w-0",
                          months:
                            "flex flex-col gap-6 md:flex-row md:gap-6 w-full min-w-0",
                          month: "min-w-0 flex-1 space-y-3",
                          month_caption:
                            "relative flex h-9 items-center justify-center",
                          caption_label: vgs
                            ? "inline-flex h-8 min-w-[76px] items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground shadow-xs"
                            : "inline-flex h-8 min-w-[76px] items-center justify-center gap-1 border border-border bg-card px-2 text-xs font-semibold text-foreground",
                          dropdowns:
                            "flex items-center justify-center gap-2 px-10",
                          dropdown_root: "relative inline-flex items-center",
                          dropdown:
                            "absolute inset-0 h-full w-full cursor-pointer opacity-0",
                          months_dropdown: "min-w-[80px]",
                          years_dropdown: "min-w-[68px]",
                          nav: "absolute inset-x-3 top-4 flex items-center justify-between",
                          button_previous: vgs
                            ? "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted"
                            : "inline-flex h-8 w-8 items-center justify-center border border-border bg-card text-foreground transition-colors hover:border-black dark:hover:border-zinc-400 hover:bg-muted",
                          button_next: vgs
                            ? "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted"
                            : "inline-flex h-8 w-8 items-center justify-center border border-border bg-card text-foreground transition-colors hover:border-black dark:hover:border-zinc-400 hover:bg-muted",
                          chevron: "h-4 w-4",
                          month_grid: "w-full border-collapse",
                          weekdays: "flex",
                          weekday: vgs
                            ? "flex h-8 w-8 items-center justify-center text-[11px] font-semibold text-muted-foreground"
                            : "flex h-8 w-8 items-center justify-center text-[11px] font-medium text-muted-foreground",
                          week: "mt-1 flex w-full",
                          day: "relative h-8 w-8 p-0 text-center text-sm",
                          day_button: vgs
                            ? "h-8 w-8 rounded-lg text-[13px] font-medium text-foreground transition-colors hover:bg-primary/10 dark:bg-indigo-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            : "h-8 w-8 rounded-md text-[13px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black",
                          today: vgs
                            ? "font-bold text-primary dark:text-indigo-300 after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary dark:after:bg-indigo-400"
                            : "font-bold text-foreground after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-black dark:after:bg-muted",
                          outside: "text-muted-foreground opacity-60",
                          disabled:
                            "pointer-events-none text-muted-foreground opacity-40",
                          selected: vgs
                            ? "bg-primary text-primary-foreground"
                            : "bg-black dark:bg-muted text-white dark:text-zinc-950",
                          range_start: vgs
                            ? "rounded-l-lg bg-primary text-primary-foreground"
                            : "rounded-l-md bg-black dark:bg-muted text-white dark:text-zinc-950",
                          range_end: vgs
                            ? "rounded-r-lg bg-primary text-primary-foreground"
                            : "rounded-r-md bg-black dark:bg-muted text-white dark:text-zinc-950",
                          range_middle: vgs
                            ? "rounded-none bg-primary/10 dark:bg-indigo-400/10 text-primary dark:text-indigo-200"
                            : "rounded-none bg-muted text-foreground",
                        }}
                      />
                    </div>

                    <div
                      className={
                        vgs
                          ? "border-t border-border bg-muted/60 p-4 md:border-l md:border-t-0"
                          : "border-t border-border bg-muted p-4 md:border-l md:border-t-0"
                      }
                    >
                      <div
                        className={
                          vgs
                            ? "mb-4 rounded-xl border border-border bg-card px-3 py-2 shadow-xs"
                            : "mb-4 border border-border bg-card px-3 py-2"
                        }
                      >
                        <p
                          className={
                            vgs
                              ? "text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                              : "text-[11px] font-medium uppercase text-muted-foreground"
                          }
                        >
                          Selected range
                        </p>
                        <p
                          className={
                            vgs
                              ? "mt-1 text-sm font-bold text-foreground"
                              : "mt-1 text-sm font-semibold text-foreground"
                          }
                        >
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
                          className={
                            vgs
                              ? "h-9 flex-1 rounded-lg border border-border bg-card text-xs font-bold text-foreground shadow-xs transition-colors hover:bg-muted"
                              : "h-8 flex-1 border border-border bg-card text-xs font-medium text-foreground hover:border-black dark:hover:border-zinc-400 hover:bg-muted"
                          }
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const y = new Date();
                            y.setDate(y.getDate() - 1);
                            setStartDateInput(toDisplayDate(y));
                            setEndDateInput("");
                            setCalendarMonth(
                              new Date(y.getFullYear(), y.getMonth(), 1),
                            );
                            setDateError("");
                          }}
                          className={
                            vgs
                              ? "h-9 flex-1 rounded-lg border border-border bg-card text-xs font-bold text-foreground shadow-xs transition-colors hover:bg-muted"
                              : "h-8 flex-1 border border-border bg-card text-xs font-medium text-foreground hover:border-black dark:hover:border-zinc-400 hover:bg-muted"
                          }
                        >
                          Yesterday
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
                              setSortCol("pctChange");
                              setSortOrder("desc");
                              setCurrentPage(1);
                            }
                          }}
                          className={
                            vgs
                              ? "h-9 flex-1 rounded-lg border border-border bg-card text-xs font-bold text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
                              : "h-8 flex-1 border border-border bg-card text-xs font-medium text-foreground hover:border-black dark:hover:border-zinc-400 hover:text-foreground"
                          }
                        >
                          Clear
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-col">
                          <label
                            className={
                              vgs
                                ? "mb-1 text-xs font-semibold text-muted-foreground"
                                : "mb-1 text-xs font-medium text-muted-foreground"
                            }
                          >
                            Start Date
                          </label>
                          <input
                            type="text"
                            value={startDateInput}
                            onChange={(e) => {
                              setStartDateInput(e.target.value);
                              setDateError("");
                              const parsed = parseDisplayDate(e.target.value);
                              if (parsed.iso) {
                                const anchor = new Date(
                                  `${parsed.iso}T00:00:00`,
                                );
                                setCalendarMonth(
                                  new Date(
                                    anchor.getFullYear(),
                                    anchor.getMonth(),
                                    1,
                                  ),
                                );
                              }
                            }}
                            placeholder="DD/MM/YYYY"
                            className={
                              vgs
                                ? "h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground shadow-xs placeholder-muted-foreground outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/30"
                                : "h-9 border border-border bg-card px-3 text-sm text-foreground placeholder-muted-foreground focus:border-ring dark:focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-ring dark:focus:ring-zinc-400"
                            }
                          />
                        </div>
                        <div className="flex flex-col">
                          <label
                            className={
                              vgs
                                ? "mb-1 text-xs font-semibold text-muted-foreground"
                                : "mb-1 text-xs font-medium text-muted-foreground"
                            }
                          >
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
                            className={
                              vgs
                                ? "h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground shadow-xs placeholder-muted-foreground outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/30"
                                : "h-9 border border-border bg-card px-3 text-sm text-foreground placeholder-muted-foreground focus:border-ring dark:focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-ring dark:focus:ring-zinc-400"
                            }
                          />
                        </div>
                      </div>

                      {dateError && (
                        <p
                          className={
                            vgs
                              ? "mt-3 rounded-xl border border-error/30 dark:border-rose-400/30 bg-error/10 dark:bg-rose-400/10 px-3 py-2 text-xs font-medium text-error dark:text-rose-300"
                              : "mt-3 border border-error/30 dark:border-rose-400/30 bg-error/10 dark:bg-rose-400/10 px-3 py-2 text-xs text-error dark:text-rose-300"
                          }
                        >
                          {dateError}
                        </p>
                      )}
                      {!dateError && customDate && (
                        <p
                          className={
                            vgs
                              ? "mt-3 text-xs leading-5 text-muted-foreground"
                              : "mt-3 text-xs leading-5 text-muted-foreground"
                          }
                        >
                          Active:{" "}
                          <strong
                            className={
                              vgs ? "text-foreground" : "text-foreground"
                            }
                          >
                            {new Date(
                              customDate + "T00:00:00",
                            ).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </strong>{" "}
                          to{" "}
                          <strong
                            className={
                              vgs ? "text-foreground" : "text-foreground"
                            }
                          >
                            {customEndDate
                              ? new Date(
                                  customEndDate + "T00:00:00",
                                ).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "today"}
                          </strong>
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={applyDateRange}
                        className={
                          vgs
                            ? "mt-5 h-10 w-full rounded-xl bg-primary dark:bg-indigo-400 px-4 text-sm font-bold text-white dark:text-zinc-950 shadow-primary/25 shadow-xs transition-colors hover:bg-primary/90 dark:hover:bg-indigo-300"
                            : "mt-5 h-9 w-full bg-black px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                        }
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  <div
                    className={
                      vgs
                        ? "border-t border-border bg-muted/60 px-4 py-2.5"
                        : "border-t border-border px-4 py-2"
                    }
                  >
                    <p
                      className={
                        vgs
                          ? "text-[11px] text-muted-foreground"
                          : "text-[11px] text-muted-foreground"
                      }
                    >
                      Pick a start date and optional end date. Leaving the end
                      date empty compares the start date with today.
                    </p>
                  </div>
                </div>
              );
            })()}
        </div>

        {}
        {customDate && !isCustomDatePopupOpen && (
          <div
            className={
              vgs
                ? "mb-4 flex items-center gap-3 rounded-xl border border-primary/30 dark:border-indigo-400/30 bg-primary/10 dark:bg-indigo-400/10 px-3 py-2 text-xs"
                : "mb-4 flex items-center gap-3 border border-black dark:border-border bg-muted px-3 py-2 text-xs"
            }
          >
            <span
              className={
                vgs ? "text-primary dark:text-indigo-200" : "text-foreground"
              }
            >
              Custom date active:{" "}
              <strong
                className={
                  vgs
                    ? "text-indigo-950 dark:text-indigo-200"
                    : "text-foreground"
                }
              >
                {new Date(customDate + "T00:00:00").toLocaleDateString(
                  "en-IN",
                  { day: "numeric", month: "short", year: "numeric" },
                )}
              </strong>
              {" → "}
              <strong
                className={
                  vgs
                    ? "text-indigo-950 dark:text-indigo-200"
                    : "text-foreground"
                }
              >
                {customEndDate
                  ? new Date(customEndDate + "T00:00:00").toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short", year: "numeric" },
                    )
                  : "today"}
              </strong>
            </span>
            <button
              onClick={openCustomDatePicker}
              className={
                vgs
                  ? "font-semibold text-primary dark:text-indigo-300 underline underline-offset-2 hover:text-primary dark:hover:text-indigo-200"
                  : "font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
              }
            >
              Change
            </button>
            <button
              onClick={() => {
                setCustomDate("");
                setCustomEndDate("");
                setStartDateInput("");
                setEndDateInput("");
                setSortCol("pctChange");
                setSortOrder("desc");
                setCurrentPage(1);
              }}
              className="font-medium text-error dark:text-rose-400 underline underline-offset-2 hover:text-red-800 dark:hover:text-rose-300"
            >
              Clear
            </button>
          </div>
        )}

        {}
        <div
          className={
            vgs
              ? "grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"
              : "flex items-center justify-between mb-4 flex-wrap gap-2"
          }
        >
          <div
            className={
              vgs
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-x divide-border rounded-xl border border-border bg-card shadow-xs overflow-hidden"
                : "flex items-center gap-4 flex-wrap"
            }
          >
            {vgs ? (
              exchanges.map((exchange) => (
                <button
                  key={exchange.id}
                  type="button"
                  title={exchange.title}
                  onClick={() => handleExchangeChange(exchange.id)}
                  aria-pressed={selectedExchange === exchange.id}
                  className={`flex items-center justify-center px-2 py-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
                    selectedExchange === exchange.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {exchange.label}
                </button>
              ))
            ) : (
              <div className="flex items-center gap-4">
                {exchanges.map((exchange) => (
                  <label
                    key={exchange.id}
                    title={exchange.title}
                    className="flex items-center cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="exchange"
                      checked={selectedExchange === exchange.id}
                      onChange={() => handleExchangeChange(exchange.id)}
                      className="w-4 h-4 text-foreground border-border focus:ring-ring dark:focus:ring-zinc-400"
                    />
                    <span
                      className={`ml-2 text-sm font-medium ${selectedExchange === exchange.id ? "text-foreground underline" : "text-muted-foreground"}`}
                    >
                      {exchange.label}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {}
            <div
              className={
                vgs
                  ? "flex items-center gap-2 px-3 py-2 col-span-2 sm:col-span-3 md:col-span-6 border-t border-border bg-muted/60"
                  : "flex items-center gap-2"
              }
            >
              <span className="relative flex h-2.5 w-2.5">
                {!isLiveDataStale && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isLiveDataStale ? "bg-warning" : "bg-success"
                  }`}
                ></span>
              </span>
              <span
                className={`text-xs ${isLiveDataStale ? "text-warning dark:text-amber-300" : vgs ? "text-muted-foreground" : "text-muted-foreground"}`}
              >
                {isLiveDataStale ? "Data may be stale" : "Live Data"} ·{" "}
                {totalStocksCount} Stocks
                {lastSyncedLabel && ` · Synced ${lastSyncedLabel}`}
              </span>
            </div>

            {liveFeedRegistrationError && (
              <div
                className={
                  vgs
                    ? "flex items-center gap-2 px-3 py-2 col-span-2 sm:col-span-3 md:col-span-6 border-t border-error/30 dark:border-rose-400/30 bg-error/10/60 dark:bg-rose-400/10"
                    : "flex items-center gap-2"
                }
              >
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-error"></span>
                <span className="text-xs text-error dark:text-rose-300">
                  {liveFeedRegistrationError}
                </span>
              </div>
            )}

            {}
            {syncStatus?.historicalPopulating && (
              <div
                className={
                  vgs
                    ? "flex items-center gap-2 px-3 py-2 col-span-2 sm:col-span-3 md:col-span-6 border-t border-border bg-muted/60"
                    : "flex items-center gap-2"
                }
              >
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                <span className="text-xs text-primary dark:text-blue-300">
                  Syncing historical: {syncStatus.historicalProgress.completed}/
                  {syncStatus.historicalProgress.total} (
                  {syncStatus.cachedCount} cached)
                </span>
              </div>
            )}
          </div>

          {}
          {vgs ? (
            <div className="flex items-center gap-2 flex-wrap">
              {showHitControl && (
                <div
                  role="group"
                  aria-label="52-week high and low hits"
                  title={hitHint}
                  className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shrink-0"
                >
                  {(
                    [
                      { id: "all", label: "All", count: totalStocksCount },
                      {
                        id: "high",
                        label: "52W High",
                        count: activeDisplayCounts.highHits,
                      },
                      {
                        id: "low",
                        label: "52W Low",
                        count: activeDisplayCounts.lowHits,
                      },
                    ] as const
                  ).map((option) => {
                    const isActive = hitFilter === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleHitChange(option.id as HitFilter)}
                        aria-pressed={isActive}
                        title={
                          option.id === "all"
                            ? "Show every stock"
                            : option.id === "high"
                              ? `Stocks that made a fresh 52-week high ${hitSessionLabel}`
                              : `Stocks that made a fresh 52-week low ${hitSessionLabel}`
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                          isActive
                            ? option.id === "high"
                              ? "bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950 shadow-xs"
                              : option.id === "low"
                                ? "bg-error dark:bg-rose-400 text-white dark:text-zinc-950 shadow-xs"
                                : "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {option.label}
                        <span
                          className={`text-[11px] font-mono num-font ${
                            isActive
                              ? "text-white/85 dark:text-zinc-950/80"
                              : "text-muted-foreground"
                          }`}
                        >
                          ({option.count.toLocaleString("en-IN")})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <SearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search company..."
                className="relative flex-1 min-w-0"
                matchCount={displayStockData.length}
                totalCount={totalStocksCount}
              />
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="Refresh market data"
                title="Refresh market data"
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border border-border bg-card text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60 shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <button
                type="button"
                onClick={downloadCSV}
                disabled={displayStockData.length === 0}
                title="Download these rows as CSV"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950 text-xs font-bold shadow-emerald-500/25 shadow-xs hover:bg-emerald-700 dark:hover:bg-emerald-300 disabled:opacity-40 disabled:hover:bg-emerald-600 dark:disabled:hover:bg-emerald-400 transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              {showHitControl && (
                <div
                  role="group"
                  aria-label="52-week high and low hits"
                  title={hitHint}
                  className="flex items-center gap-1 text-sm"
                >
                  {(
                    [
                      { id: "all", label: "All", count: totalStocksCount },
                      {
                        id: "high",
                        label: "52W High",
                        count: activeDisplayCounts.highHits,
                      },
                      {
                        id: "low",
                        label: "52W Low",
                        count: activeDisplayCounts.lowHits,
                      },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleHitChange(option.id as HitFilter)}
                      aria-pressed={hitFilter === option.id}
                      className={`px-2 py-1.5 font-medium whitespace-nowrap ${
                        hitFilter === option.id
                          ? "text-foreground underline"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {option.label} ({option.count.toLocaleString("en-IN")})
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search company..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-7 pr-3 py-1.5 text-sm border border-border rounded w-48 focus:outline-none focus:border-ring dark:focus:border-zinc-400 text-foreground"
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground font-medium disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <button
                onClick={downloadCSV}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary dark:text-blue-300 hover:text-blue-800 dark:text-blue-300 font-medium"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
            </div>
          )}
        </div>

        {}
        {vgs ? (
          <div className="mb-4 rounded-2xl border border-purple/30 dark:border-violet-400/30 bg-gradient-to-r from-violet-50 dark:from-violet-400/10 via-fuchsia-50/50 dark:via-fuchsia-400/5 to-white dark:to-transparent shadow-xs p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-purple dark:text-violet-300 uppercase tracking-wider pb-2">
              Advanced Filters
            </p>
            {filterPanel}
          </div>
        ) : (
          filterPanel
        )}

        {patternView && (
          <PatternCompaniesDialog
            groupId={patternView.groupId}
            itemId={patternView.itemId}
            title={patternView.label}
            timeframeIds={patternDialogTimeframeIds}
            timeframeLabels={patternDialogTimeframeLabels}
            exchange={patternDialogExchange}
            onClose={() => setPatternView(null)}
          />
        )}

        {}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className={`animate-spin rounded-full h-12 w-12 border-b-2 mb-4 ${vgs ? "border-primary" : "border-black dark:border-border"}`}
            ></div>
            <p
              className={`text-sm ${vgs ? "text-muted-foreground" : "text-muted-foreground"}`}
            >
              Loading market data...
            </p>
            <p
              className={`text-xs mt-1 ${vgs ? "text-muted-foreground" : "text-muted-foreground"}`}
            >
              Fetching from database
            </p>
          </div>
        )}

        {}
        {error && !loading && (
          <div
            className={
              vgs
                ? "rounded-xl border border-error/30 dark:border-rose-400/30 bg-error/10 dark:bg-rose-400/10 px-4 py-3 mb-6"
                : "border border-red-300 dark:border-rose-400/30 bg-error/10 dark:bg-rose-400/10 rounded p-4 mb-6"
            }
          >
            <p
              className={`text-sm ${vgs ? "text-error dark:text-rose-300 font-medium" : "text-error dark:text-rose-300"}`}
            >
              {error}
            </p>
            <button
              onClick={() => void fetchMarketData(1)}
              className={`mt-2 text-sm underline ${vgs ? "text-error dark:text-rose-400 hover:text-rose-800 dark:text-rose-300 font-medium" : "text-error dark:text-rose-400 hover:text-red-800 dark:hover:text-rose-300"}`}
            >
              Try again
            </button>
          </div>
        )}

        {}
        {!loading && !error && (
          <>
            {/* View Tabs */}
            {vgs ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border bg-card shadow-xs overflow-hidden mb-4">
                <button
                  onClick={() => handleViewChange("all")}
                  aria-pressed={currentView === "all"}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-colors ${
                    currentView === "all"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  All ({totalStocksCount})
                </button>
                <button
                  onClick={() => handleViewChange("gainers")}
                  aria-pressed={currentView === "gainers"}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-colors ${
                    currentView === "gainers"
                      ? "bg-success dark:bg-emerald-400 text-white dark:text-zinc-950 shadow-xs"
                      : "text-success dark:text-emerald-300 hover:bg-success/10 dark:bg-emerald-400/10"
                  }`}
                >
                  Gainers ({activeDisplayCounts.gainers})
                </button>
                <button
                  onClick={() => handleViewChange("losers")}
                  aria-pressed={currentView === "losers"}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-colors ${
                    currentView === "losers"
                      ? "bg-error dark:bg-rose-400 text-white dark:text-zinc-950 shadow-xs"
                      : "text-error dark:text-rose-300 hover:bg-error/10 dark:bg-rose-400/10"
                  }`}
                >
                  Losers ({activeDisplayCounts.losers})
                </button>
                <button
                  onClick={() => handleViewChange("unchanged")}
                  aria-pressed={currentView === "unchanged"}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-colors ${
                    currentView === "unchanged"
                      ? "bg-muted-foreground dark:bg-zinc-400 text-white dark:text-zinc-950 shadow-xs"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Unchanged ({activeDisplayCounts.unchanged})
                </button>
              </div>
            ) : (
              <div className="flex border-b border-black dark:border-border mb-4">
                <button
                  onClick={() => handleViewChange("all")}
                  className={`flex-1 text-center py-2 font-bold border-r border-black dark:border-border ${
                    currentView === "all"
                      ? "text-foreground bg-muted"
                      : "text-muted-foreground bg-muted"
                  }`}
                >
                  All ({totalStocksCount})
                </button>
                <button
                  onClick={() => handleViewChange("gainers")}
                  className={`flex-1 text-center py-2 font-bold border-r border-black dark:border-border ${
                    currentView === "gainers"
                      ? "text-success dark:text-emerald-400 bg-success/10 dark:bg-emerald-400/10"
                      : "text-muted-foreground bg-muted"
                  }`}
                >
                  Gainers ({activeDisplayCounts.gainers})
                </button>
                <button
                  onClick={() => handleViewChange("losers")}
                  className={`flex-1 text-center py-2 font-bold border-r border-black dark:border-border ${
                    currentView === "losers"
                      ? "text-error dark:text-rose-400 bg-error/10 dark:bg-rose-400/10"
                      : "text-muted-foreground bg-muted"
                  }`}
                >
                  Losers ({activeDisplayCounts.losers})
                </button>
                <button
                  onClick={() => handleViewChange("unchanged")}
                  className={`flex-1 text-center py-2 font-bold ${
                    currentView === "unchanged"
                      ? "text-foreground bg-muted"
                      : "text-muted-foreground bg-muted"
                  }`}
                >
                  Unchanged ({activeDisplayCounts.unchanged})
                </button>
              </div>
            )}

            {enableAddColumns && addedColumns.length > 0 && (
              <div
                className={
                  vgs
                    ? "mb-4 rounded-2xl border border-border bg-card p-3 shadow-xs"
                    : "mb-4 rounded-md border border-border bg-muted p-3 shadow-xs"
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider mr-1 ${vgs ? "text-muted-foreground" : "text-muted-foreground"}`}
                    >
                      Active Technicals:
                    </span>
                    {addedColumns.map((col) => {
                      const filter = technicalColumnFilters[col.id];
                      return (
                        <span
                          key={col.id}
                          className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium shadow-xs transition-colors ${
                            filter
                              ? "bg-success/10/90 dark:bg-emerald-400/10 border-emerald-300 dark:border-emerald-400/40 text-emerald-950 dark:text-emerald-200"
                              : "border-border bg-card text-foreground"
                          }`}
                        >
                          <span className="rounded bg-black dark:bg-muted px-1.5 py-0.5 text-[10px] font-bold text-white dark:text-zinc-950 uppercase">
                            {col.timeframeLabel.replace("TF ", "")}
                          </span>
                          <span>{col.label}</span>
                          {filter && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950 px-1.5 py-0.5 text-[10px] font-bold shadow-xs">
                              {filter.label}
                              <button
                                type="button"
                                onClick={() =>
                                  handleApplyTechnicalColumnFilter(col.id, null)
                                }
                                className="ml-1 hover:text-emerald-200 font-bold"
                                title="Clear column filter"
                              >
                                ✕
                              </button>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              removeAddedColumn(
                                col.groupId,
                                col.itemId,
                                col.timeframeId,
                              )
                            }
                            className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-error dark:hover:text-rose-400"
                            title="Remove column"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                    {Object.keys(technicalColumnFilters).length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllTechnicalColumnFilters}
                        className="ml-2 text-xs font-semibold text-warning dark:text-amber-300 bg-warning/10 dark:bg-amber-400/10 border border-warning/30 dark:border-amber-400/30 rounded px-2 py-0.5 hover:bg-warning/20 dark:hover:bg-amber-400/20"
                      >
                        Reset Filters (
                        {Object.keys(technicalColumnFilters).length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={clearAllTechnicalColumns}
                      className="ml-2 text-xs font-semibold text-error dark:text-rose-400 hover:underline"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    {hasActiveSignalColumns ? (
                      <label className="flex items-center gap-2 cursor-pointer select-none rounded bg-card px-3 py-1.5 border border-border shadow-xs hover:bg-muted transition-colors">
                        <input
                          type="checkbox"
                          checked={onlyShowTechnicalMatches}
                          onChange={(e) =>
                            setOnlyShowTechnicalMatches(e.target.checked)
                          }
                          className="h-4 w-4 rounded accent-black"
                        />
                        <span className="text-xs font-bold text-foreground">
                          Only Show Matching Signals
                        </span>
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-400/20 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-success/30 dark:border-emerald-400/30">
                          {matchingStockCount} Matches
                        </span>
                      </label>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        {serverTechnicalFilters.length > 0 ? (
                          <span className="rounded-full bg-success/10 dark:bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 border border-success/30 dark:border-emerald-400/30">
                            {pagination.totalStocks.toLocaleString("en-IN")}{" "}
                            stocks match across all pages
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground border border-border">
                            Showing values for{" "}
                            {displayStockData.length.toLocaleString("en-IN")}{" "}
                            stocks
                          </span>
                        )}
                        {pageLocalTechnicalFilters.length > 0 && (
                          <span
                            className="rounded-full bg-warning/10 dark:bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 border border-warning/30 dark:border-amber-400/30"
                            title="Intraday and live-feed columns are only computed for the rows on screen, so their filters apply to this page."
                          >
                            {pageLocalTechnicalFilters.length} intraday filter
                            {pageLocalTechnicalFilters.length === 1
                              ? ""
                              : "s"}{" "}
                            apply to this page only
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {addedColumnsLoading && (
                  <div className="mt-2 text-[11px] text-primary dark:text-blue-300 font-medium animate-pulse">
                    Syncing live technical signals...
                  </div>
                )}
                {addedColumnsError && (
                  <div className="mt-2 text-[11px] text-error dark:text-rose-400 font-medium">
                    {addedColumnsError}
                  </div>
                )}
              </div>
            )}

            <div className="mb-6">
              <StockTable
                data={displayStockData}
                baseColumns={activeBaseColumns}
                columns={currentColumns}
                title={
                  currentView === "gainers"
                    ? "Gainers"
                    : currentView === "losers"
                      ? "Losers"
                      : currentView === "unchanged"
                        ? "Unchanged"
                        : "All Stocks"
                }
                pagination={pagination}
                onPageChange={handlePageChange}
                sortCol={sortCol}
                sortOrder={sortOrder}
                onSort={handleSort}
                hiddenColumns={hiddenColumns}
                customDate={customDate}
                customEndDate={customEndDate}
                addedColumns={enableAddColumns ? addedColumns : []}
                addedColumnValues={enableAddColumns ? addedColumnValues : {}}
                technicalColumnFilters={technicalColumnFilters}
                onApplyTechnicalColumnFilter={handleApplyTechnicalColumnFilter}
                vgs={vgs}
                showHitColumn={showHitControl}
                candlestickFilterOptions={
                  patternSummary?.options.candlesticks ?? []
                }
                candlestickPatternFilter={candlestickPatternFilter}
                onCandlestickFilterChange={setCandlestickPatternFilter}
                candlestickCellForStock={candlestickCellForStock}
                chartPatternFilterOptions={
                  patternSummary?.options.chartPatterns ?? []
                }
                chartPatternFilter={chartPatternFilter}
                onChartPatternFilterChange={setChartPatternFilter}
                chartPatternCellForStock={chartPatternCellForStock}
                patternScopeText={patternScopeText}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MarketPageLoading() {
  return (
    <div className="min-h-screen bg-card dark:bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-border"></div>
    </div>
  );
}

export function MarketPerformancePage({
  enableAddColumns = true,
  settingsScope = "market",
  theme = "terminal",
  includeEtfs = false,
}: {
  enableAddColumns?: boolean;
  /**
   * This component backs three separate routes (Total Market Performance,
   * the Screening Table, and the market-data dummy table). Each page's
   * settings (filters, hidden columns, sort, tab, added columns) persist
   * per settingsScope via usePersistedSettings, so pass a scope unique to
   * the page rendering this -- otherwise their saved config bleeds into
   * each other, both in localStorage and in the synced backend settings.
   */
  settingsScope?: string;
  /**
   * Visual language. "terminal" keeps the square black-and-white market
   * terminal; "vgs" applies the rounded VGS Reddy screener theme. Only the
   * Total Market Performance route opts into "vgs".
   */
  theme?: MarketPageTheme;
  /** List ETFs alongside stocks (Total Market Performance only). */
  includeEtfs?: boolean;
}) {
  return (
    <Suspense fallback={<MarketPageLoading />}>
      <MarketPageContent
        enableAddColumns={enableAddColumns}
        settingsScope={settingsScope}
        theme={theme}
        includeEtfs={includeEtfs}
      />
    </Suspense>
  );
}

export default MarketPerformancePage;

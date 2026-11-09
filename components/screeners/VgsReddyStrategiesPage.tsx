"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  TrendingUp,
  Activity,
  Eye,
  LineChart,
  FileText,
  PieChart,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  CandlestickChart,
  Layers,
  Plus,
  X,
  Clock,
  ChevronDown,
  Landmark,
  BarChart2,
  Gauge,
  Users,
  Percent,
  IndianRupee,
  Radar,
  Star,
  ScanSearch,
  Pencil,
  GripVertical,
  Columns3,
  Check,
  Download,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Loader2,
  RefreshCw,
  MoreVertical,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  PageHeader,
  SearchInput,
  TabCount,
  matchesSearch,
} from "@/components/common";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  NSE_SECTORS,
  getIndustriesForSectors,
} from "@/lib/market/nse-sector-classification";
import { usePersistedSettings } from "@/lib/hooks/usePersistedSettings";
import {
  getMarketApiErrorMessage,
  INVALID_MARKET_RESPONSE_MESSAGE,
  isMarketFilterOptions,
  isMarketLiveResponse,
  type MarketFilterOptions,
  type MarketStockData,
} from "@/lib/market/client-contract";
import {
  dailyCandlePatternIdForLabel,
  type DailyCandlePatternId,
} from "@/lib/market/candle-patterns";

import { unwrapApiEnvelope } from "@/lib/api-envelope";
type SourceTab =
  | "screening"
  | "watchlist"
  | "preposition"
  | "paper-trading"
  | "live-trading"
  | "alerts-watchlist"
  | "alerts-preposition"
  | "alerts-paper-trading"
  | "alerts-live-trading"
  | "back-test"
  | "back-test-group";
/** Every tab except "screening" is a curated list the user builds themselves. */
type CuratedTab = Exclude<SourceTab, "screening">;
type TimeUnit = "sec" | "min" | "hours" | "day" | "week" | "month";
type TrendType = "nifty" | "sector" | "industry";
type TrendDirection = "up" | "down";

/**
 * One symbol the user has added to one of their own boards (Watchlist,
 * Paper Trading, etc.). Deliberately holds NO live-market fields (price,
 * sector, volume, ...) — those come from the real /api/market/live feed and
 * are joined in at render time, so they're never stale or fabricated.
 */
interface CuratedEntry {
  id: string;
  exchange: "NSE" | "BSE";
  tradingSymbol: string;
  category: CuratedTab;
  addedAt: string;
  timeframe: { unit: TimeUnit; value: number };
  entrySignal: boolean;
  entry: number;
  stopLoss: number;
  trend?: "Bullish" | "Bearish" | "Neutral";
  candlestickPattern: string;
  candlestickPattern2?: string;
  day1Open?: number;
  day2Open?: number;
  day3Open?: number;
  target?: number;
  target1?: number;
  target2?: number;
  target3?: number;
  note?: string;
  redFlags?: string;
  boardMeeting?: string;
  corporateAction?: string;
  exRecordDate?: string;
  latestNews?: string;
  sourceFrom?: string;
}

/**
 * One rendered table row: real live data (when available) joined with the
 * user's own curated metadata (when this symbol has been added to a board).
 * Screening-table rows have `curated: null` — there's nothing to edit yet.
 */
export interface JoinedRow {
  id: string;
  exchange: "NSE" | "BSE";
  tradingSymbol: string;
  companyName: string;
  segments: string;
  sector: string;
  industry: string;
  group: string;
  priceBand: string;
  marketCap: string;
  cmp: number;
  netChange: number;
  changePercent: number;
  volume: number;
  category: SourceTab;
  curated: CuratedEntry | null;
  liveMissing: boolean;
}

/** Pagination shape for the Screening Table's live equity feed. */
interface ScreeningPaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const sourceTabs: { id: SourceTab; label: string; icon: typeof Eye }[] = [
  { id: "screening", label: "Screening Table", icon: ScanSearch },
  { id: "watchlist", label: "Watchlist", icon: Eye },
  { id: "preposition", label: "Preposition Watchlist", icon: Eye },
  { id: "paper-trading", label: "Paper Trading", icon: FileText },
  { id: "live-trading", label: "Live Trading", icon: TrendingUp },
  { id: "alerts-watchlist", label: "Alerts · Watchlist", icon: Bell },
  {
    id: "alerts-preposition",
    label: "Alerts · Preposition Watchlist",
    icon: Bell,
  },
  {
    id: "alerts-paper-trading",
    label: "Alerts · Paper Trading",
    icon: Bell,
  },
  { id: "alerts-live-trading", label: "Alerts · Live Trading", icon: Bell },
  { id: "back-test", label: "Strategy Back Test", icon: LineChart },
  { id: "back-test-group", label: "Strategy Back Test Group", icon: Layers },
];

const curatedTabs = sourceTabs.filter(
  (tab): tab is { id: CuratedTab; label: string; icon: typeof Eye } =>
    tab.id !== "screening",
);

function sequentialRange(max: number): number[] {
  return Array.from({ length: max }, (_, i) => i + 1);
}

const timeUnitGroups: { id: TimeUnit; label: string; standard: number[] }[] = [
  { id: "sec", label: "Sec", standard: sequentialRange(60) },
  { id: "min", label: "Min", standard: sequentialRange(60) },
  { id: "hours", label: "Hours", standard: sequentialRange(24) },
  { id: "day", label: "Day", standard: sequentialRange(31) },
  { id: "week", label: "Week", standard: sequentialRange(52) },
  { id: "month", label: "Month", standard: sequentialRange(12) },
];

const trendTypeTabs: { id: TrendType; label: string; icon: typeof Activity }[] =
  [
    { id: "nifty", label: "Nifty Trend", icon: Activity },
    { id: "sector", label: "Sector Trend", icon: PieChart },
    { id: "industry", label: "Industry Trend", icon: Building2 },
  ];

const EXCHANGE_FILTER_OPTIONS = [
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

// The 4 "<Exchange> <Segment>" options above are one-click shortcuts: picking
// one sets both the exchange scope and the matching Segments value at once.
// This maps each shortcut back to the real exchange scope the backend
// understands (everything else passes through unchanged).
function baseExchangeMode(rawMode: string): string {
  if (rawMode === "NSE FNO" || rawMode === "NSE Indices") return "NSE";
  if (rawMode === "BSE FNO" || rawMode === "BSE Indices") return "BSE";
  return rawMode;
}

const EXCHANGE_SEGMENT_SHORTCUTS: Record<string, string> = {
  "NSE FNO": "F&O Stocks (EQ)",
  "BSE FNO": "F&O Stocks (EQ)",
  "NSE Indices": "NSE Broad Market Indices",
  "BSE Indices": "BSE Broad Market Indices",
};

// /api/market/live serves the equity universe, so "Equity" and "F&O Stocks
// (EQ)" (that same universe narrowed to stocks that have derivatives) are
// the two segment values real rows match today. The futures/options/index
// segments have no live rows behind them yet — same honest-placeholder
// precedent as the old Indices segment.
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

const SCAN_FOR_STANDARD = ["Upto 10%", "10% to 30%", "Above 30%"];

// Most of these are labels a curated entry carries. The ones that
// candle-patterns.ts defines (RED JC Type 2 WNT today) are also real screens:
// picked in the CP Signal filter, the Screening Table asks the server for the
// stocks whose last daily candles match.
export const CANDLESTICK_PATTERN_OPTIONS = [
  "JC Type 1",
  "JC Type 2",
  "JC Type 2 NT",
  "RED JC Type 2 WNT",
  "ICBS",
  "Opp EC (Cl C)",
  "HC",
  "DC+O",
  "TRBO",
  "TRAO",
  "DC",
  "TEIC",
  "GDG",
  "RDR",
];

const TREND_OPTIONS: NonNullable<CuratedEntry["trend"]>[] = [
  "Bullish",
  "Bearish",
  "Neutral",
];

const STARRED_TIMEFRAMES_STORAGE_KEY = "vgsreddy-starred-timeframes";
const SELECTED_TIMEFRAMES_STORAGE_KEY = "vgsreddy-selected-timeframes";
const CUSTOM_TIMEFRAMES_STORAGE_KEY = "vgsreddy-custom-timeframes";

const EMPTY_MARKET_FILTER_OPTIONS: MarketFilterOptions = {
  sectors: [],
  industries: [],
  marketCaps: [],
  priceBands: [],
  series: [],
};

const formLabelClass =
  "block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1";
const formInputClass =
  "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500";

type CuratedEntryFormState = Omit<CuratedEntry, "id" | "addedAt">;

function defaultCuratedEntryForm(): CuratedEntryFormState {
  return {
    exchange: "NSE",
    tradingSymbol: "",
    category: "watchlist",
    timeframe: { unit: "min", value: 5 },
    entrySignal: false,
    entry: 0,
    stopLoss: 0,
    candlestickPattern: CANDLESTICK_PATTERN_OPTIONS[0],
    sourceFrom: "Manual Entry",
  };
}

function getScanForBucket(changePercent: number): string {
  const abs = Math.abs(changePercent);
  if (abs > 30) return "Above 30%";
  if (abs > 10) return "10% to 30%";
  return "Upto 10%";
}

function liveKeyFor(exchange: string, tradingSymbol: string): string {
  return `${exchange}:${tradingSymbol.toUpperCase()}`;
}

function formatSegmentLabel(exchangeSegment: string): string {
  return exchangeSegment.toUpperCase().includes("EQ")
    ? "Equity"
    : exchangeSegment;
}

function tabLabel(tab: SourceTab): string {
  return sourceTabs.find((t) => t.id === tab)?.label ?? tab;
}

// `fnoOnly` says the feed was narrowed to F&O-enabled stocks, which is what
// the row's Segments cell should then read — these are ordinary cash-market
// equity rows, so their own exchangeSegment still says "Equity", and the
// Segments filter matches on this label.
function buildScreeningJoinedRow(
  stock: MarketStockData,
  fnoOnly: boolean,
): JoinedRow {
  return {
    id: `live-${stock.id}`,
    exchange: stock.exchange === "BSE" ? "BSE" : "NSE",
    tradingSymbol: stock.tradingSymbol,
    companyName: stock.companyName,
    segments: fnoOnly
      ? "F&O Stocks (EQ)"
      : formatSegmentLabel(stock.exchangeSegment),
    sector: stock.sector,
    industry: stock.industry,
    group: stock.group,
    priceBand: stock.priceBand,
    marketCap: stock.marketCap,
    cmp: stock.cmp,
    netChange: stock.netChange,
    changePercent: stock.percentChange,
    volume: stock.volume ?? 0,
    category: "screening",
    curated: null,
    liveMissing: false,
  };
}

function buildCuratedJoinedRow(
  entry: CuratedEntry,
  live: MarketStockData | undefined,
): JoinedRow {
  return {
    id: entry.id,
    exchange: entry.exchange,
    tradingSymbol: entry.tradingSymbol,
    companyName: live?.companyName ?? entry.tradingSymbol,
    segments: live ? formatSegmentLabel(live.exchangeSegment) : "-",
    sector: live?.sector ?? "-",
    industry: live?.industry ?? "-",
    group: live?.group ?? "-",
    priceBand: live?.priceBand ?? "-",
    marketCap: live?.marketCap ?? "-",
    cmp: live?.cmp ?? 0,
    netChange: live?.netChange ?? 0,
    changePercent: live?.percentChange ?? 0,
    volume: live?.volume ?? 0,
    category: entry.category,
    curated: entry,
    liveMissing: !live,
  };
}

function formatAddedDate(addedAt: string): string {
  const date = new Date(addedAt);
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
}

function formatAddedTime(addedAt: string): string {
  const date = new Date(addedAt);
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().slice(11, 19);
}

function daysSince(addedAt: string): number | "-" {
  const date = new Date(addedAt);
  if (Number.isNaN(date.getTime())) return "-";
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function FilterTriggerButton({
  icon: Icon,
  label,
  count,
  valueLabel,
  activeVariant = "light",
  highlightActive,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  valueLabel?: string;
  activeVariant?: "light" | "dark";
  highlightActive?: boolean;
}) {
  const isActive = highlightActive ?? count > 0;
  const activeClass =
    activeVariant === "dark"
      ? "border-indigo-600 bg-indigo-600 text-white shadow-indigo-500/20 shadow-xs"
      : "border-indigo-500 text-indigo-700 bg-indigo-50";

  return (
    <DropdownMenuTrigger asChild>
      <button
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border whitespace-nowrap ${
          isActive
            ? activeClass
            : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{valueLabel ? `${label}: ${valueLabel}` : label}</span>
        {!valueLabel && count > 0 && (
          <span
            className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-none ${
              activeVariant === "dark"
                ? "bg-white/25 text-white dark:bg-zinc-950/10 dark:text-zinc-950"
                : "bg-indigo-600 text-white"
            }`}
          >
            {count}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 ${isActive && activeVariant === "dark" ? "opacity-90" : "opacity-60"}`}
        />
      </button>
    </DropdownMenuTrigger>
  );
}

function CheckboxFilterDropdown({
  label,
  icon,
  options,
  selected,
  onToggle,
  onClear,
  searchable = false,
  single = false,
  customAdd,
  removableOptions,
  onRemoveOption,
  starred,
  onToggleStar,
  activeVariant = "light",
  highlightActive,
  onSelectAll,
}: {
  label: string;
  icon: LucideIcon;
  options: readonly string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
  searchable?: boolean;
  single?: boolean;
  customAdd?: {
    value: string;
    onChange: (value: string) => void;
    onAdd: () => void;
  };
  removableOptions?: Set<string>;
  onRemoveOption?: (value: string) => void;
  starred?: Set<string>;
  onToggleStar?: (value: string) => void;
  activeVariant?: "light" | "dark";
  highlightActive?: boolean;
  /** Selects every currently visible option (respects the search box, if
   * any) without discarding selections outside that view. */
  onSelectAll?: (visibleOptions: readonly string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filteredOptions =
    searchable && search.trim()
      ? options.filter((option) =>
          option.toLowerCase().includes(search.trim().toLowerCase()),
        )
      : options;
  const count = selected.size;
  const valueLabel =
    single && selected.size === 1 ? Array.from(selected)[0] : undefined;
  const canStar = Boolean(starred && onToggleStar);
  const starredOptions = canStar
    ? filteredOptions.filter((option) => starred!.has(option))
    : [];
  const restOptions = canStar
    ? filteredOptions.filter((option) => !starred!.has(option))
    : filteredOptions;

  const renderOption = (option: string) => {
    const checked = selected.has(option);
    const isRemovable = removableOptions?.has(option) ?? false;
    const isStarred = starred?.has(option) ?? false;
    return (
      <div
        key={option}
        className="flex items-center justify-between gap-1 group/item hover:bg-slate-50"
      >
        {canStar && (
          <button
            onClick={() => onToggleStar!(option)}
            aria-label={
              isStarred
                ? `Unstar ${option} ${label}`
                : `Star ${option} ${label}`
            }
            className={`p-1 ml-1 shrink-0 transition-colors ${
              isStarred
                ? "text-amber-400 hover:text-amber-500"
                : "text-slate-300 hover:text-amber-400"
            }`}
          >
            <Star
              className="w-3.5 h-3.5"
              fill={isStarred ? "currentColor" : "none"}
            />
          </button>
        )}
        <label className="flex flex-1 items-center justify-between gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
          <span className="truncate">{option}</span>
          <input
            type={single ? "radio" : "checkbox"}
            name={single ? label : undefined}
            checked={checked}
            onChange={() => onToggle(option)}
            className="h-3.5 w-3.5 accent-indigo-600 cursor-pointer shrink-0"
          />
        </label>
        {isRemovable && onRemoveOption && (
          <button
            onClick={() => onRemoveOption(option)}
            aria-label={`Remove custom ${option} ${label}`}
            className="p-0.5 mr-2 text-slate-300 hover:text-rose-600 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  return (
    <DropdownMenu>
      <FilterTriggerButton
        icon={icon}
        label={label}
        count={count}
        valueLabel={valueLabel}
        activeVariant={activeVariant}
        highlightActive={highlightActive}
      />
      <DropdownMenuContent
        align="start"
        className="w-64 p-0 rounded-xl border border-slate-200/90 shadow-lg overflow-hidden"
      >
        <div className="px-3 pt-2.5 pb-2 flex items-center justify-between border-b border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {label}
          </span>
          <div className="flex items-center gap-2">
            {!single &&
              onSelectAll &&
              filteredOptions.length > 0 &&
              filteredOptions.some((option) => !selected.has(option)) && (
                <button
                  onClick={() => onSelectAll(filteredOptions)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  Select All
                </button>
              )}
            {count > 0 && (
              <button
                onClick={onClear}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                Clear ({count})
              </button>
            )}
          </div>
        </div>
        {searchable && (
          <div className="px-2.5 py-2 border-b border-slate-100">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}
        <div className="max-h-56 overflow-y-auto scrollbar-thin py-1">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-400">
              No matches
            </div>
          ) : (
            <>
              {starredOptions.length > 0 && (
                <>
                  <div className="px-3 pt-1 pb-1 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                    Starred
                  </div>
                  {starredOptions.map(renderOption)}
                  <div className="my-1 border-t border-slate-100" />
                </>
              )}
              {restOptions.map(renderOption)}
            </>
          )}
        </div>
        {customAdd && (
          <div className="flex items-center gap-1 p-2 border-t border-slate-100">
            <input
              value={customAdd.value}
              onChange={(e) => customAdd.onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") customAdd.onAdd();
              }}
              placeholder="Custom"
              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={customAdd.onAdd}
              aria-label={`Add custom ${label} value`}
              className="shrink-0 p-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RangeFilterDropdown({
  label,
  icon,
  min,
  max,
  onMinChange,
  onMaxChange,
  onClear,
  showMax = true,
  bucketOptions,
  selectedBuckets,
  onToggleBucket,
}: {
  label: string;
  icon: LucideIcon;
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  onClear: () => void;
  showMax?: boolean;
  bucketOptions?: readonly string[];
  selectedBuckets?: Set<string>;
  onToggleBucket?: (value: string) => void;
}) {
  const active =
    Boolean(min.trim()) ||
    Boolean(max.trim()) ||
    Boolean(selectedBuckets && selectedBuckets.size > 0);
  const bucketCount = selectedBuckets ? selectedBuckets.size : 0;

  return (
    <DropdownMenu>
      <FilterTriggerButton
        icon={icon}
        label={label}
        count={bucketCount > 0 ? bucketCount : active ? 1 : 0}
      />
      <DropdownMenuContent
        align="start"
        className="w-56 p-0 rounded-xl border border-slate-200/90 shadow-lg overflow-hidden"
      >
        <div className="px-3 pt-2.5 pb-2 flex items-center justify-between border-b border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {label}
          </span>
          {active && (
            <button
              onClick={onClear}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              Clear
            </button>
          )}
        </div>
        {bucketOptions && selectedBuckets && onToggleBucket && (
          <div className="px-3 py-2 space-y-1.5 border-b border-slate-100">
            {bucketOptions.map((option) => {
              const checked = selectedBuckets.has(option);
              return (
                <label
                  key={option}
                  className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  <span>{option}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleBucket(option)}
                    className="h-3.5 w-3.5 accent-indigo-600 cursor-pointer"
                  />
                </label>
              );
            })}
          </div>
        )}
        <div className="p-3 space-y-2.5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Min
            </label>
            <input
              type="number"
              value={min}
              onChange={(e) => onMinChange(e.target.value)}
              placeholder="Min"
              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>
          {showMax && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Max
              </label>
              <input
                type="number"
                value={max}
                onChange={(e) => onMaxChange(e.target.value)}
                placeholder="Max"
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function toggleSetValue(
  setter: Dispatch<SetStateAction<Set<string>>>,
  value: string,
) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  });
}

function BooleanBadge({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 text-xs font-mono font-bold rounded-full border num-font ${
        value
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-slate-100 text-slate-500 border-slate-200"
      }`}
    >
      {value ? "Triggered" : "Pending"}
    </span>
  );
}

const WATCHLIST_COLUMN_DEFS: Record<
  string,
  { label: string; align?: "left" | "right" | "center" }
> = {
  sNo: { label: "S No", align: "center" },
  date: { label: "Date" },
  time: { label: "Time" },
  days: { label: "Days", align: "right" },
  sourceFrom: { label: "Source From" },
  exchange: { label: "Exchange" },
  segments: { label: "Segments" },
  companyName: { label: "Company Name" },
  instrumentName: { label: "Instrument Name" },
  tradingSymbol: { label: "Trading Symbol" },
  sector: { label: "Sector" },
  industry: { label: "Industry" },
  group: { label: "Group" },
  priceBand: { label: "P Band" },
  marketCap: { label: "M Cap", align: "right" },
  cmp: { label: "CMP", align: "right" },
  ltp: { label: "LTP", align: "right" },
  netChange: { label: "Net Change", align: "right" },
  changePercent: { label: "% Change", align: "right" },
  volume: { label: "Volume", align: "right" },
  trend: { label: "Trend", align: "center" },
  candlestickPattern: { label: "CP Signal" },
  candlestickPattern2: { label: "CP 2nd Signal" },
  entrySignal: { label: "Entry", align: "center" },
  day1Open: { label: "Day 1 Open", align: "right" },
  day2Open: { label: "Day 2 Open", align: "right" },
  day3Open: { label: "Day 3 Open", align: "right" },
  moveTo: { label: "Move to" },
  entry: { label: "Entry Price", align: "right" },
  stopLoss: { label: "Stop Loss", align: "right" },
  target: { label: "Target", align: "right" },
  target1: { label: "Target 1", align: "right" },
  target2: { label: "Target 2", align: "right" },
  target3: { label: "Target 3", align: "right" },
  note: { label: "Note" },
  redFlags: { label: "Red Flags" },
  boardMeeting: { label: "Board Meeting" },
  corporateAction: { label: "Corporate Action" },
  exRecordDate: { label: "Ex/Record Date" },
  latestNews: { label: "Latest News" },
};

const WATCHLIST_DEFAULT_COLUMN_ORDER = Object.keys(WATCHLIST_COLUMN_DEFS);

export type TableSortDirection = "asc" | "desc";

export interface TableSort {
  readonly columnKey: string;
  readonly direction: TableSortDirection;
}

// S No is the row counter and Move to is a control — neither is data to
// order by. Every other column sorts.
const UNSORTABLE_COLUMNS = new Set(["sNo", "moveTo"]);

/**
 * Columns the Screening Table can sort on the server, so the order runs over
 * the whole filtered result set instead of only the page in view. Anything
 * absent (the curated fields, and the derivative columns nothing fills) sorts
 * in the browser, across the rows currently loaded.
 */
const SERVER_SORT_FIELD_BY_COLUMN: Record<string, string> = {
  companyName: "name",
  tradingSymbol: "tradingSymbol",
  exchange: "exchange",
  sector: "sector",
  industry: "industry",
  group: "series",
  priceBand: "priceBand",
  marketCap: "marketCap",
  cmp: "lastPrice",
  ltp: "lastPrice",
  netChange: "netChange",
  changePercent: "pctChange",
  volume: "volume",
};

/**
 * The page numbers a pager should offer, with `null` marking an elided gap.
 * The first and last page stay reachable in one click and a small window
 * follows the current page, so the strip keeps a steady width whether there
 * are 3 pages or 35.
 */
export function paginationWindow(
  page: number,
  totalPages: number,
): (number | null)[] {
  const lastPage = Math.max(1, totalPages);
  const currentPage = Math.min(Math.max(1, page), lastPage);
  const wanted = new Set<number>([1, lastPage, currentPage]);
  for (const offset of [-1, 1]) {
    const neighbour = currentPage + offset;
    if (neighbour >= 1 && neighbour <= lastPage) wanted.add(neighbour);
  }
  // Near either end there is no gap to elide, so spend the freed slots on
  // real pages instead of leaving the strip visibly shorter.
  if (currentPage <= 3) {
    for (const near of [2, 3, 4]) if (near <= lastPage) wanted.add(near);
  }
  if (currentPage >= lastPage - 2) {
    for (const near of [lastPage - 1, lastPage - 2, lastPage - 3]) {
      if (near >= 1) wanted.add(near);
    }
  }

  const slots: (number | null)[] = [];
  let previous = 0;
  for (const pageNumber of [...wanted].sort((left, right) => left - right)) {
    if (previous !== 0 && pageNumber - previous > 1) slots.push(null);
    slots.push(pageNumber);
    previous = pageNumber;
  }
  return slots;
}

// ---- Quick Scans -------------------------------------------------------
// A named snapshot of every filter on this page, so a setup worth rebuilding
// by hand can be recalled from a dropdown instead. Persisted per account (via
// usePersistedSettings) with a localStorage fallback while signed out, the
// same way the boards and column layouts already are.

interface QuickScanFilters {
  timeframes: string[];
  customTimeframes: Record<TimeUnit, number[]>;
  exchanges: string[];
  segments: string[];
  sectors: string[];
  industries: string[];
  marketCapBuckets: string[];
  priceBands: string[];
  groups: string[];
  scanFor: string[];
  customScanFor: string[];
  candlestickPatterns: string[];
  marketCapMin: string;
  marketCapMax: string;
  priceMin: string;
  priceMax: string;
  changeMin: string;
  changeMax: string;
  volumeMin: string;
  trendDirection: TrendDirection;
  trendType: TrendType;
  sort: TableSort | null;
}

interface QuickScan {
  id: string;
  name: string;
  savedAt: string;
  filters: QuickScanFilters;
}

interface QuickScanSettings {
  scans: QuickScan[];
}

const MAX_QUICK_SCAN_NAME_LENGTH = 60;

function emptyCustomTimeframes(): Record<TimeUnit, number[]> {
  return { sec: [], min: [], hours: [], day: [], week: [], month: [] };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function toStringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Saved scans come back as untyped Json, and the filter set grows over time —
 * so every field is read defensively and a scan saved before a filter existed
 * simply restores that filter as "not set" instead of being thrown away.
 */
function normalizeQuickScanFilters(raw: unknown): QuickScanFilters {
  const value = (raw ?? {}) as Record<string, unknown>;
  const customTimeframes = emptyCustomTimeframes();
  const rawCustom = value.customTimeframes;
  if (rawCustom && typeof rawCustom === "object") {
    for (const unit of Object.keys(customTimeframes) as TimeUnit[]) {
      const values = (rawCustom as Record<string, unknown>)[unit];
      if (Array.isArray(values)) {
        customTimeframes[unit] = values.filter(
          (entry): entry is number =>
            typeof entry === "number" && Number.isFinite(entry),
        );
      }
    }
  }

  const rawSort = value.sort as Record<string, unknown> | null | undefined;
  const rawDirection = rawSort?.direction;
  const sort: TableSort | null =
    rawSort &&
    typeof rawSort.columnKey === "string" &&
    (rawDirection === "asc" || rawDirection === "desc")
      ? { columnKey: rawSort.columnKey, direction: rawDirection }
      : null;

  return {
    timeframes: toStringArray(value.timeframes),
    customTimeframes,
    exchanges: toStringArray(value.exchanges),
    segments: toStringArray(value.segments),
    sectors: toStringArray(value.sectors),
    industries: toStringArray(value.industries),
    marketCapBuckets: toStringArray(value.marketCapBuckets),
    priceBands: toStringArray(value.priceBands),
    groups: toStringArray(value.groups),
    scanFor: toStringArray(value.scanFor),
    customScanFor: toStringArray(value.customScanFor),
    candlestickPatterns: toStringArray(value.candlestickPatterns),
    marketCapMin: toStringField(value.marketCapMin),
    marketCapMax: toStringField(value.marketCapMax),
    priceMin: toStringField(value.priceMin),
    priceMax: toStringField(value.priceMax),
    changeMin: toStringField(value.changeMin),
    changeMax: toStringField(value.changeMax),
    volumeMin: toStringField(value.volumeMin),
    trendDirection: value.trendDirection === "down" ? "down" : "up",
    trendType:
      value.trendType === "sector" || value.trendType === "industry"
        ? value.trendType
        : "nifty",
    sort,
  };
}

export function normalizeQuickScanSettings(raw: unknown): QuickScanSettings {
  const value = (raw ?? {}) as Record<string, unknown>;
  if (!Array.isArray(value.scans)) return { scans: [] };
  return {
    scans: value.scans
      .filter(
        (entry): entry is Record<string, unknown> =>
          !!entry && typeof entry === "object",
      )
      .filter(
        (entry) =>
          typeof entry.id === "string" && typeof entry.name === "string",
      )
      .map((entry) => ({
        id: entry.id as string,
        name: (entry.name as string).slice(0, MAX_QUICK_SCAN_NAME_LENGTH),
        savedAt:
          typeof entry.savedAt === "string"
            ? entry.savedAt
            : new Date(0).toISOString(),
        filters: normalizeQuickScanFilters(entry.filters),
      })),
  };
}

/**
 * A stable fingerprint of a filter set, so the menu can highlight the scan
 * matching what is on screen instead of trusting a "last applied" flag that
 * goes stale the moment a filter is touched. Lists are sorted because a Set
 * remembers insertion order and picking Banks-then-IT is the same scan as
 * picking IT-then-Banks.
 */
export function quickScanSignature(filters: QuickScanFilters): string {
  const sortedLists: Record<string, string[] | number[]> = {
    timeframes: [...filters.timeframes].sort(),
    exchanges: [...filters.exchanges].sort(),
    segments: [...filters.segments].sort(),
    sectors: [...filters.sectors].sort(),
    industries: [...filters.industries].sort(),
    marketCapBuckets: [...filters.marketCapBuckets].sort(),
    priceBands: [...filters.priceBands].sort(),
    groups: [...filters.groups].sort(),
    scanFor: [...filters.scanFor].sort(),
    customScanFor: [...filters.customScanFor].sort(),
    candlestickPatterns: [...filters.candlestickPatterns].sort(),
  };
  const customTimeframes = Object.fromEntries(
    (Object.keys(filters.customTimeframes) as TimeUnit[])
      .sort()
      .map((unit) => [
        unit,
        [...filters.customTimeframes[unit]].sort((a, b) => a - b),
      ]),
  );
  return JSON.stringify([
    Object.entries(sortedLists).sort(([a], [b]) => a.localeCompare(b)),
    customTimeframes,
    filters.marketCapMin.trim(),
    filters.marketCapMax.trim(),
    filters.priceMin.trim(),
    filters.priceMax.trim(),
    filters.changeMin.trim(),
    filters.changeMax.trim(),
    filters.volumeMin.trim(),
    filters.trendDirection,
    filters.trendType,
    filters.sort ? [filters.sort.columnKey, filters.sort.direction] : null,
  ]);
}

/** How many of a scan's filters are actually set, for the menu's subtitle. */
export function countQuickScanFilters(filters: QuickScanFilters): number {
  const lists = [
    filters.timeframes,
    filters.exchanges,
    filters.segments,
    filters.sectors,
    filters.industries,
    filters.marketCapBuckets,
    filters.priceBands,
    filters.groups,
    filters.scanFor,
    filters.candlestickPatterns,
  ];
  const ranges = [
    filters.marketCapMin || filters.marketCapMax,
    filters.priceMin || filters.priceMax,
    filters.changeMin || filters.changeMax,
    filters.volumeMin,
  ];
  return (
    lists.filter((list) => list.length > 0).length +
    ranges.filter((range) => range.trim() !== "").length
  );
}

/** asc → desc → unsorted, so a third click puts the table back. */
export function nextSortState(
  current: TableSort | null,
  columnKey: string,
): TableSort | null {
  if (current?.columnKey !== columnKey) return { columnKey, direction: "asc" };
  if (current.direction === "asc") return { columnKey, direction: "desc" };
  return null;
}

function isValidWatchlistColumnOrder(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  if (value.length !== WATCHLIST_DEFAULT_COLUMN_ORDER.length) return false;
  const valueSet = new Set(value);
  return WATCHLIST_DEFAULT_COLUMN_ORDER.every((key) => valueSet.has(key));
}

function isValidVisibleColumnsList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (key) => typeof key === "string" && key in WATCHLIST_COLUMN_DEFS,
    )
  );
}

// Each tab keeps its own column order/visibility, synced per logged-in user
// (via usePersistedSettings) so the layout survives logout/login and follows
// the user to another device/browser, with a localStorage fallback when
// signed out. Every tab starts from an independent copy of the shared
// default rather than a reference to it.
interface VgsReddyColumnSettings {
  columnOrderByTab: Record<SourceTab, string[]>;
  visibleColumnsByTab: Record<SourceTab, string[]>;
}

function defaultColumnSettings(): VgsReddyColumnSettings {
  const columnOrderByTab = {} as Record<SourceTab, string[]>;
  const visibleColumnsByTab = {} as Record<SourceTab, string[]>;
  for (const tab of sourceTabs) {
    columnOrderByTab[tab.id] = [...WATCHLIST_DEFAULT_COLUMN_ORDER];
    visibleColumnsByTab[tab.id] = [...WATCHLIST_DEFAULT_COLUMN_ORDER];
  }
  return { columnOrderByTab, visibleColumnsByTab };
}

const DEFAULT_COLUMN_SETTINGS = defaultColumnSettings();

function normalizeColumnSettings(raw: unknown): VgsReddyColumnSettings {
  const result = defaultColumnSettings();
  if (!raw || typeof raw !== "object") return result;
  const value = raw as Partial<
    Record<keyof VgsReddyColumnSettings, unknown>
  >;

  const rawOrderByTab = value.columnOrderByTab;
  if (rawOrderByTab && typeof rawOrderByTab === "object") {
    for (const tab of sourceTabs) {
      const savedForTab = (rawOrderByTab as Record<string, unknown>)[tab.id];
      if (isValidWatchlistColumnOrder(savedForTab)) {
        result.columnOrderByTab[tab.id] = savedForTab;
      }
    }
  }

  const rawVisibleByTab = value.visibleColumnsByTab;
  if (rawVisibleByTab && typeof rawVisibleByTab === "object") {
    for (const tab of sourceTabs) {
      const savedForTab = (rawVisibleByTab as Record<string, unknown>)[
        tab.id
      ];
      if (isValidVisibleColumnsList(savedForTab)) {
        result.visibleColumnsByTab[tab.id] = savedForTab;
      }
    }
  }

  return result;
}

// The user's own curated boards, synced the same way as column settings —
// per-account via usePersistedSettings, localStorage fallback while signed
// out. This is what makes "Watchlist"/"Paper Trading"/etc. real per-user
// lists of real symbols instead of a shared mock array.
function isValidCuratedEntry(value: unknown): value is CuratedEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<CuratedEntry>;
  return (
    typeof entry.id === "string" &&
    (entry.exchange === "NSE" || entry.exchange === "BSE") &&
    typeof entry.tradingSymbol === "string" &&
    entry.tradingSymbol.length > 0 &&
    curatedTabs.some((tab) => tab.id === entry.category) &&
    typeof entry.addedAt === "string" &&
    Boolean(entry.timeframe) &&
    typeof entry.timeframe === "object" &&
    typeof (entry.timeframe as { unit?: unknown }).unit === "string" &&
    typeof (entry.timeframe as { value?: unknown }).value === "number" &&
    typeof entry.entrySignal === "boolean" &&
    typeof entry.entry === "number" &&
    typeof entry.stopLoss === "number" &&
    typeof entry.candlestickPattern === "string"
  );
}

interface CuratedEntriesSettings {
  entries: CuratedEntry[];
}

function normalizeCuratedEntries(raw: unknown): CuratedEntriesSettings {
  if (!raw || typeof raw !== "object") return { entries: [] };
  const value = raw as { entries?: unknown };
  if (!Array.isArray(value.entries)) return { entries: [] };
  return { entries: value.entries.filter(isValidCuratedEntry) };
}

function watchlistCellClass(columnKey: string): string {
  const def = WATCHLIST_COLUMN_DEFS[columnKey];
  const alignClass =
    def?.align === "right"
      ? "text-right"
      : def?.align === "center"
        ? "text-center"
        : "text-left";
  const wrapClass = ["note", "redFlags", "latestNews", "corporateAction"].includes(
    columnKey,
  )
    ? "max-w-[220px] whitespace-normal"
    : "whitespace-nowrap";
  return `px-3 py-2.5 text-slate-700 font-medium ${alignClass} ${wrapClass}`;
}

/**
 * The 3-dot menu on Trading Symbol and Company Name. Deliberately NOT the
 * shared StockActionsMenu — that writes to the real, site-wide Watchlist/
 * Portfolio/Trades/Alerts/Notes, which would leak this page's actions into
 * every other page that reads those same tables. Everything here (view a
 * stock's real detail page, export this one row) is either read-only
 * navigation or a local file download — nothing that touches shared state.
 * Adding/editing/moving a row already goes through this page's own curated
 * boards (Edit/Remove/Move to), which are fully isolated.
 */
function RowActionsMenu({ row }: { row: JoinedRow }) {
  const router = useRouter();

  const handleExportRow = () => {
    const csv = buildWatchlistCsv([row], WATCHLIST_DEFAULT_COLUMN_ORDER, 0);
    downloadCsvFile(
      `vgsreddy-${row.tradingSymbol}-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    );
    toast.success(`${row.tradingSymbol} exported to CSV`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Actions for ${row.tradingSymbol}`}
          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() =>
            router.push(`/stock/${encodeURIComponent(row.tradingSymbol)}`)
          }
        >
          <FileText />
          Stock Summary
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleExportRow}>
          <Download />
          Export Row as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function renderWatchlistCell(
  row: JoinedRow,
  rowNumber: number,
  columnKey: string,
  handlers: {
    onEdit: (row: JoinedRow) => void;
    onRemove: (entryId: string) => void;
    onMove: (row: JoinedRow, category: CuratedTab) => void;
  },
): ReactNode {
  const meta = row.curated;
  switch (columnKey) {
    case "sNo":
      return (
        <span className="font-mono font-bold text-slate-600 num-font">
          {rowNumber}
        </span>
      );
    case "date":
      return meta ? formatAddedDate(meta.addedAt) : "-";
    case "time":
      return meta ? formatAddedTime(meta.addedAt) : "-";
    case "days":
      return meta ? daysSince(meta.addedAt) : "-";
    case "sourceFrom":
      return meta?.sourceFrom ?? "-";
    case "exchange":
      return (
        <span
          className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-md border ${
            row.exchange === "NSE"
              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
              : "bg-purple-50 text-purple-700 border-purple-200"
          }`}
        >
          {row.exchange}
        </span>
      );
    case "segments":
      return row.segments;
    case "companyName":
      return (
        <div className="flex items-center justify-between gap-2">
          <span>{row.companyName}</span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <RowActionsMenu row={row} />
          </div>
        </div>
      );
    case "instrumentName":
      return row.liveMissing ? "-" : "Equity";
    case "tradingSymbol":
      return (
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-slate-900">
            {row.tradingSymbol}
            {row.liveMissing && (
              <span
                title="No live match yet — showing placeholder data"
                className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 align-middle"
              />
            )}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <RowActionsMenu row={row} />
            {meta && (
              <>
                <button
                  onClick={() => handlers.onEdit(row)}
                  aria-label={`Edit ${row.tradingSymbol}`}
                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handlers.onRemove(meta.id)}
                  aria-label={`Remove ${row.tradingSymbol}`}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      );
    case "sector":
      return row.sector;
    case "industry":
      return row.industry;
    case "group":
      return row.group;
    case "priceBand":
      return row.priceBand;
    case "marketCap":
      return row.marketCap;
    case "cmp":
      return `₹${row.cmp.toFixed(2)}`;
    case "ltp":
      return (
        <span className="font-mono font-bold text-slate-900 num-font">
          ₹{row.cmp.toFixed(2)}
        </span>
      );
    case "netChange":
      return (
        <span
          className={`font-mono font-bold num-font ${row.netChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}
        >
          {row.netChange >= 0 ? "+" : ""}
          {row.netChange.toFixed(2)}
        </span>
      );
    case "changePercent":
      return (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font ${
            row.changePercent >= 0
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
        >
          {row.changePercent >= 0 ? "+" : ""}
          {row.changePercent.toFixed(1)}%
        </span>
      );
    case "volume":
      return row.volume.toLocaleString("en-IN");
    case "trend":
      return meta?.trend ? (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${
            meta.trend === "Bullish"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : meta.trend === "Bearish"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
          }`}
        >
          {meta.trend}
        </span>
      ) : (
        "-"
      );
    case "candlestickPattern":
      return meta?.candlestickPattern ?? "-";
    case "candlestickPattern2":
      return meta?.candlestickPattern2 ?? "-";
    case "entrySignal":
      return meta ? <BooleanBadge value={meta.entrySignal} /> : "-";
    case "day1Open":
      return meta?.day1Open != null ? `₹${meta.day1Open.toFixed(2)}` : "-";
    case "day2Open":
      return meta?.day2Open != null ? `₹${meta.day2Open.toFixed(2)}` : "-";
    case "day3Open":
      return meta?.day3Open != null ? `₹${meta.day3Open.toFixed(2)}` : "-";
    case "moveTo":
      return (
        <select
          defaultValue=""
          onChange={(e) => {
            const value = e.target.value;
            if (value) {
              handlers.onMove(row, value as CuratedTab);
              e.target.value = "";
            }
          }}
          className="rounded-md border border-slate-200 px-1.5 py-1 text-[11px] font-semibold text-slate-600 focus:outline-none focus:border-indigo-500"
        >
          <option value="">
            {meta ? "Move to…" : "Add to…"}
          </option>
          {curatedTabs
            .filter((tab) => tab.id !== row.category)
            .map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
        </select>
      );
    case "entry":
      return meta ? `₹${meta.entry.toFixed(2)}` : "-";
    case "stopLoss":
      return meta ? (
        <span className="font-mono font-bold text-rose-600 num-font">
          ₹{meta.stopLoss.toFixed(2)}
        </span>
      ) : (
        "-"
      );
    case "target":
      return meta?.target != null ? `₹${meta.target.toFixed(2)}` : "-";
    case "target1":
      return meta?.target1 != null ? `₹${meta.target1.toFixed(2)}` : "-";
    case "target2":
      return meta?.target2 != null ? `₹${meta.target2.toFixed(2)}` : "-";
    case "target3":
      return meta?.target3 != null ? `₹${meta.target3.toFixed(2)}` : "-";
    case "note":
      return meta?.note ?? "-";
    case "redFlags":
      return meta?.redFlags ?? "-";
    case "boardMeeting":
      return meta?.boardMeeting ?? "-";
    case "corporateAction":
      return meta?.corporateAction ?? "-";
    case "exRecordDate":
      return meta?.exRecordDate ?? "-";
    case "latestNews":
      return meta?.latestNews ?? "-";
    default:
      return "-";
  }
}

// "Move to" is a control, not data — every other visible column exports.
const CSV_EXCLUDED_COLUMNS = new Set(["moveTo"]);

/**
 * The CSV twin of renderWatchlistCell: same column keys, same source fields,
 * but plain text. Numbers stay unformatted (no ₹, no thousands separators) so
 * a spreadsheet reads them as numbers, and anything missing exports as an
 * empty cell rather than the table's "-" placeholder.
 */
function watchlistCellCsvValue(
  row: JoinedRow,
  rowNumber: number,
  columnKey: string,
): string | number {
  const meta = row.curated;
  const blankIfDash = (value: string | number): string | number =>
    value === "-" ? "" : value;
  switch (columnKey) {
    case "sNo":
      return rowNumber;
    case "date":
      return meta ? blankIfDash(formatAddedDate(meta.addedAt)) : "";
    case "time":
      return meta ? blankIfDash(formatAddedTime(meta.addedAt)) : "";
    case "days":
      return meta ? blankIfDash(daysSince(meta.addedAt)) : "";
    case "sourceFrom":
      return meta?.sourceFrom ?? "";
    case "exchange":
      return row.exchange;
    case "segments":
      return row.segments;
    case "companyName":
      return row.companyName;
    case "instrumentName":
      return row.liveMissing ? "" : "Equity";
    case "tradingSymbol":
      return row.tradingSymbol;
    case "sector":
      return row.sector;
    case "industry":
      return row.industry;
    case "group":
      return row.group;
    case "priceBand":
      return row.priceBand;
    case "marketCap":
      return row.marketCap;
    case "cmp":
    case "ltp":
      return row.cmp;
    case "netChange":
      return row.netChange;
    case "changePercent":
      return row.changePercent;
    case "volume":
      return row.volume;
    case "trend":
      return meta?.trend ?? "";
    case "candlestickPattern":
      return meta?.candlestickPattern ?? "";
    case "candlestickPattern2":
      return meta?.candlestickPattern2 ?? "";
    case "entrySignal":
      return meta ? (meta.entrySignal ? "Triggered" : "Pending") : "";
    case "day1Open":
      return meta?.day1Open ?? "";
    case "day2Open":
      return meta?.day2Open ?? "";
    case "day3Open":
      return meta?.day3Open ?? "";
    case "entry":
      return meta?.entry ?? "";
    case "stopLoss":
      return meta?.stopLoss ?? "";
    case "target":
      return meta?.target ?? "";
    case "target1":
      return meta?.target1 ?? "";
    case "target2":
      return meta?.target2 ?? "";
    case "target3":
      return meta?.target3 ?? "";
    case "note":
      return meta?.note ?? "";
    case "redFlags":
      return meta?.redFlags ?? "";
    case "boardMeeting":
      return meta?.boardMeeting ?? "";
    case "corporateAction":
      return meta?.corporateAction ?? "";
    case "exRecordDate":
      return meta?.exRecordDate ?? "";
    case "latestNews":
      return meta?.latestNews ?? "";
    default:
      return "";
  }
}

function escapeCsvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/**
 * Header row + one line per row, in the table's own column order.
 * `rowNumberOffset` is how many rows precede these in the full result set, so
 * S No keeps counting across pages instead of restarting at 1 on every one.
 */
export function buildWatchlistCsv(
  rows: JoinedRow[],
  columnOrder: string[],
  rowNumberOffset = 0,
): string {
  const columns = columnOrder.filter((key) => !CSV_EXCLUDED_COLUMNS.has(key));
  const header = columns
    .map((key) => escapeCsvCell(WATCHLIST_COLUMN_DEFS[key]?.label ?? key))
    .join(",");
  const body = rows.map((row, index) =>
    columns
      .map((key) =>
        escapeCsvCell(
          watchlistCellCsvValue(row, rowNumberOffset + index + 1, key),
        ),
      )
      .join(","),
  );
  return [header, ...body].join("\n");
}

/**
 * Orders rows by any column, reusing the CSV extractor for the cell's plain
 * value: numbers compare numerically, text compares naturally ("Target 2"
 * before "Target 10"), and blanks always sink to the bottom whichever way the
 * sort runs — an empty cell is missing data, not the smallest value.
 */
export function sortRowsByColumn(
  rows: JoinedRow[],
  columnKey: string,
  direction: TableSortDirection,
): JoinedRow[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    // S No is unsortable, so the row number passed here is never read.
    const leftValue = watchlistCellCsvValue(left, 0, columnKey);
    const rightValue = watchlistCellCsvValue(right, 0, columnKey);
    const leftEmpty = leftValue === "";
    const rightEmpty = rightValue === "";
    if (leftEmpty || rightEmpty) {
      return leftEmpty === rightEmpty ? 0 : leftEmpty ? 1 : -1;
    }
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * factor;
    }
    return (
      String(leftValue).localeCompare(String(rightValue), "en", {
        numeric: true,
        sensitivity: "base",
      }) * factor
    );
  });
}

function downloadCsvFile(fileName: string, csv: string): void {
  // A BOM keeps Excel from mangling ₹/₨ and non-ASCII company names.
  const url = URL.createObjectURL(
    new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function WatchlistStyleTable({
  rows,
  columnOrder,
  onReorderColumn,
  onEdit,
  onRemove,
  onMove,
  emptyMessage,
  sort,
  onToggleSort,
  sortScopeLabel,
  rowNumberOffset,
}: {
  rows: JoinedRow[];
  columnOrder: string[];
  onReorderColumn: (draggedKey: string, targetKey: string) => void;
  onEdit: (row: JoinedRow) => void;
  onRemove: (entryId: string) => void;
  onMove: (row: JoinedRow, category: CuratedTab) => void;
  emptyMessage: string;
  sort: TableSort | null;
  onToggleSort: (columnKey: string) => void;
  /** How far a sort on this column reaches, for the header tooltip. */
  sortScopeLabel: (columnKey: string) => string;
  /** Rows preceding these in the full result set, so S No counts through. */
  rowNumberOffset: number;
}) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);

  return (
    <table className="w-full text-left border-collapse text-xs md:text-sm">
      <thead className="bg-slate-50/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
        <tr className="group/head text-slate-500 text-[11px] font-bold uppercase tracking-wider select-none">
          {columnOrder.map((columnKey) => {
            const def = WATCHLIST_COLUMN_DEFS[columnKey];
            if (!def) return null;
            const alignClass =
              def.align === "right"
                ? "text-right"
                : def.align === "center"
                  ? "text-center"
                  : "text-left";
            const sortable = !UNSORTABLE_COLUMNS.has(columnKey);
            const activeSort = sort?.columnKey === columnKey ? sort : null;
            return (
              <th
                key={columnKey}
                draggable
                onDragStart={() => setDraggedKey(columnKey)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedKey && draggedKey !== columnKey) {
                    onReorderColumn(draggedKey, columnKey);
                  }
                  setDraggedKey(null);
                }}
                onDragEnd={() => setDraggedKey(null)}
                onClick={() => {
                  if (sortable) onToggleSort(columnKey);
                }}
                aria-sort={
                  activeSort
                    ? activeSort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                title={
                  sortable
                    ? `Click to sort by ${def.label} (${sortScopeLabel(columnKey)}) · drag to reorder`
                    : "Drag to reorder column"
                }
                className={`px-3 py-3 whitespace-nowrap transition-colors ${alignClass} ${
                  sortable
                    ? "cursor-pointer hover:text-indigo-600 hover:bg-indigo-50/60"
                    : "cursor-grab active:cursor-grabbing"
                } ${activeSort ? "text-indigo-700 bg-indigo-50/70" : ""} ${
                  draggedKey === columnKey ? "opacity-40" : ""
                }`}
              >
                <span
                  className={`inline-flex items-center gap-1 ${
                    def.align === "right" ? "flex-row-reverse" : ""
                  }`}
                >
                  <GripVertical className="w-3 h-3 opacity-40 shrink-0" />
                  {def.label}
                  {sortable &&
                    (activeSort ? (
                      activeSort.direction === "asc" ? (
                        <ArrowUp className="w-3 h-3 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 shrink-0 opacity-0 group-hover/head:opacity-30" />
                    ))}
                </span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, index) => (
          <tr
            key={row.id}
            className="finder-row transition-colors border-b border-slate-100/80 hover:bg-blue-50/60 even:bg-white odd:bg-slate-50/75 group"
          >
            {columnOrder.map((columnKey) => (
              <td key={columnKey} className={watchlistCellClass(columnKey)}>
                {renderWatchlistCell(row, rowNumberOffset + index + 1, columnKey, {
                  onEdit,
                  onRemove,
                  onMove,
                })}
              </td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td
              colSpan={columnOrder.length}
              className="px-6 py-16 text-center text-slate-400 text-xs"
            >
              {emptyMessage}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function QuickScanMenu({
  scans,
  activeScanId,
  activeCount,
  onApply,
  onSave,
  onOverwrite,
  onRename,
  onDelete,
}: {
  scans: QuickScan[];
  activeScanId: string | null;
  /** Filters set right now, so "Save" can say what it is about to capture. */
  activeCount: number;
  onApply: (scan: QuickScan) => void;
  onSave: (name: string) => void;
  onOverwrite: (scan: QuickScan) => void;
  onRename: (scan: QuickScan, name: string) => void;
  onDelete: (scan: QuickScan) => void;
}) {
  const [nameInput, setNameInput] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");

  const submitNew = (event: FormEvent) => {
    event.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    onSave(name);
    setNameInput("");
  };

  const submitRename = (event: FormEvent, scan: QuickScan) => {
    event.preventDefault();
    const name = renameInput.trim();
    if (!name) return;
    onRename(scan, name);
    setRenamingId(null);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border border-sky-300 bg-sky-100 text-sky-800 hover:bg-sky-200 whitespace-nowrap">
          <Radar className="w-3.5 h-3.5" />
          <span>Quick Scan</span>
          {scans.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-none bg-sky-600 text-white num-font">
              {scans.length}
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 p-0 rounded-xl border border-slate-200/90 shadow-lg overflow-hidden"
      >
        <div className="px-3 pt-2.5 pb-2 border-b border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Save this setup
          </span>
          <form onSubmit={submitNew} className="mt-2 flex items-center gap-1.5">
            <input
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              maxLength={MAX_QUICK_SCAN_NAME_LENGTH}
              placeholder="Name this scan…"
              className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-900 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={nameInput.trim() === ""}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-600 text-white disabled:opacity-40 hover:bg-sky-700 transition-colors"
            >
              Save
            </button>
          </form>
          <p className="mt-1.5 text-[10px] font-semibold text-slate-400">
            {activeCount === 0
              ? "No filters set — this would save an empty scan."
              : `Captures ${activeCount} active filter${activeCount === 1 ? "" : "s"}, the trend toggle, and the sort.`}
          </p>
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5">
          {scans.length === 0 && (
            <p className="px-2 py-6 text-center text-[11px] font-semibold text-slate-400">
              No saved scans yet.
            </p>
          )}
          {scans.map((scan) => {
            const isActive = scan.id === activeScanId;
            if (renamingId === scan.id) {
              return (
                <form
                  key={scan.id}
                  onSubmit={(event) => submitRename(event, scan)}
                  className="flex items-center gap-1.5 px-1.5 py-1.5"
                >
                  <input
                    autoFocus
                    value={renameInput}
                    onChange={(event) => setRenameInput(event.target.value)}
                    maxLength={MAX_QUICK_SCAN_NAME_LENGTH}
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-sky-600 text-white hover:bg-sky-700"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-200 hover:bg-slate-50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </form>
              );
            }
            return (
              <div
                key={scan.id}
                className={`group flex items-center gap-1 rounded-lg px-1.5 py-1 ${
                  isActive ? "bg-sky-50" : "hover:bg-slate-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onApply(scan)}
                  title={`Apply "${scan.name}"`}
                  className="flex-1 text-left min-w-0 px-1 py-1"
                >
                  <span
                    className={`block truncate text-xs font-bold ${
                      isActive ? "text-sky-800" : "text-slate-700"
                    }`}
                  >
                    {scan.name}
                  </span>
                  <span className="block text-[10px] font-semibold text-slate-400">
                    {countQuickScanFilters(scan.filters)} filters ·{" "}
                    {formatAddedDate(scan.savedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onOverwrite(scan)}
                  title="Update this scan to the filters on screen"
                  aria-label={`Update ${scan.name}`}
                  className="p-1 text-slate-400 hover:text-sky-700 hover:bg-sky-100 rounded-md"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(scan.id);
                    setRenameInput(scan.name);
                  }}
                  title="Rename"
                  aria-label={`Rename ${scan.name}`}
                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(scan)}
                  title="Delete"
                  aria-label={`Delete ${scan.name}`}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColumnVisibilityDropdown({
  columnOrder,
  visibleColumns,
  onToggleColumn,
  onReset,
}: {
  columnOrder: string[];
  visibleColumns: Set<string>;
  onToggleColumn: (columnKey: string) => void;
  onReset: () => void;
}) {
  const hiddenCount = columnOrder.length - visibleColumns.size;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border whitespace-nowrap border-slate-200 text-slate-600 bg-white hover:bg-slate-50">
          <Columns3 className="w-3.5 h-3.5" />
          <span>Columns</span>
          {hiddenCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-none bg-indigo-600 text-white">
              {hiddenCount} hidden
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 p-0 rounded-xl border border-slate-200/90 shadow-lg overflow-hidden"
      >
        <div className="px-3 pt-2.5 pb-2 flex items-center justify-between border-b border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Show / Hide Columns
          </span>
          {hiddenCount > 0 && (
            <button
              onClick={onReset}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              Show All
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {columnOrder.map((columnKey) => {
            const def = WATCHLIST_COLUMN_DEFS[columnKey];
            if (!def) return null;
            const checked = visibleColumns.has(columnKey);
            return (
              <label
                key={columnKey}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-50"
              >
                <span className="truncate">{def.label}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleColumn(columnKey)}
                  className="h-3.5 w-3.5 accent-indigo-600 cursor-pointer shrink-0"
                />
              </label>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The real tab switcher, shown beside the page title — grouping the same
// SourceTab values the table already understands under Watchlist/Portfolio/
// Back Test categories, matching the requested nav structure. Replaces the
// old flat tab-button row that used to sit between Timeframes and Advanced
// Filters (removed) — this is the only way to switch tabs now.
interface SourceNavItem {
  label: string;
  tab?: SourceTab;
  children?: { label: string; tab: SourceTab }[];
}

const SOURCE_NAV_ITEMS: readonly SourceNavItem[] = [
  { label: "Screening Table", tab: "screening" },
  {
    label: "Watchlist",
    children: [
      { label: "Watchlist", tab: "watchlist" },
      { label: "Preposition Watchlist", tab: "preposition" },
    ],
  },
  {
    label: "Portfolio",
    children: [
      { label: "Paper Trading", tab: "paper-trading" },
      { label: "Live Trading", tab: "live-trading" },
    ],
  },
  {
    label: "Alerts",
    children: [
      { label: "Watchlist", tab: "alerts-watchlist" },
      { label: "Preposition Watchlist", tab: "alerts-preposition" },
      { label: "Paper Trading", tab: "alerts-paper-trading" },
      { label: "Live Trading", tab: "alerts-live-trading" },
    ],
  },
  {
    label: "Back Test",
    children: [
      { label: "Strategy Back Test", tab: "back-test" },
      { label: "Strategy Back Test Group", tab: "back-test-group" },
    ],
  },
];

const SOURCE_NAV_ACTIVE_CLASS =
  "bg-indigo-600 text-white shadow-indigo-500/20 shadow-xs";
const SOURCE_NAV_INACTIVE_CLASS =
  "text-slate-500 hover:bg-slate-100 hover:text-slate-700";
// Give the pointer a moment to travel from the trigger button into the
// (portaled, so not a DOM descendant) menu before treating it as "left" —
// without this, crossing the small gap between them closes the menu.
const SOURCE_NAV_CLOSE_DELAY_MS = 150;

/**
 * One "<Category> ▾" nav item — opens/closes on hover (leaving both the
 * trigger and the open menu, not just a click elsewhere) rather than
 * Radix's default click-to-open/click-outside-to-close, since a hover nav
 * is what this reads as at a glance and a menu that only closes on an
 * explicit outside click otherwise stays open until the user notices it.
 */
function SourceNavGroup({
  item,
  activeSource,
  onSelect,
  countBySource,
}: {
  item: SourceNavItem & { children: { label: string; tab: SourceTab }[] };
  activeSource: SourceTab;
  onSelect: (tab: SourceTab) => void;
  countBySource: (tab: SourceTab) => number;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const handleEnter = () => {
    cancelClose();
    setOpen(true);
  };
  const handleLeave = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), SOURCE_NAV_CLOSE_DELAY_MS);
  };

  useEffect(() => cancelClose, []);

  const isActiveGroup = item.children.some(
    (child) => child.tab === activeSource,
  );
  const groupCount = item.children.reduce(
    (sum, child) => sum + countBySource(child.tab),
    0,
  );

  return (
    <div onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {/* modal={false}: Radix's default modal dropdown locks body scroll,
          padding the body to compensate for the removed scrollbar. That
          shift moves this trigger out from under a stationary cursor,
          firing a real mouseleave -> close -> shift back -> mouseenter ->
          reopen, which reads as the menu blinking. A hover nav doesn't
          need scroll-lock or focus-trapping, so non-modal avoids the
          layout shift entirely (kept local to this component, not the
          shared DropdownMenu wrapper). */}
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              isActiveGroup ? SOURCE_NAV_ACTIVE_CLASS : SOURCE_NAV_INACTIVE_CLASS
            }`}
          >
            {item.label}
            <TabCount count={groupCount} active={isActiveGroup} />
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className="min-w-[12rem] rounded-xl border border-slate-200/90 p-1 shadow-lg"
        >
          {item.children.map((child) => {
            const isActiveChild = child.tab === activeSource;
            return (
              <DropdownMenuItem
                key={child.tab}
                onSelect={() => {
                  onSelect(child.tab);
                  setOpen(false);
                }}
                className={
                  isActiveChild ? "bg-indigo-50 text-indigo-700 font-bold" : ""
                }
              >
                <span className="flex-1">{child.label}</span>
                <TabCount count={countBySource(child.tab)} active={isActiveChild} />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SourceNav({
  activeSource,
  onSelect,
  countBySource,
}: {
  activeSource: SourceTab;
  onSelect: (tab: SourceTab) => void;
  countBySource: (tab: SourceTab) => number;
}) {
  return (
    <nav className="flex items-center gap-1 flex-wrap">
      {SOURCE_NAV_ITEMS.map((item) => {
        if (item.children) {
          return (
            <SourceNavGroup
              key={item.label}
              item={item as SourceNavItem & { children: { label: string; tab: SourceTab }[] }}
              activeSource={activeSource}
              onSelect={onSelect}
              countBySource={countBySource}
            />
          );
        }

        const tab = item.tab!;
        const isActive = tab === activeSource;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelect(tab)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              isActive ? SOURCE_NAV_ACTIVE_CLASS : SOURCE_NAV_INACTIVE_CLASS
            }`}
          >
            {item.label}
            <TabCount count={countBySource(tab)} active={isActive} />
          </button>
        );
      })}
    </nav>
  );
}

export default function VgsReddyStrategiesPage() {
  const [activeSource, setActiveSource] = useState<SourceTab>("screening");
  const [tableSort, setTableSort] = useState<TableSort | null>(null);
  const [pageJumpInput, setPageJumpInput] = useState("");
  const [selectedTimeframes, setSelectedTimeframes] = useState<Set<string>>(
    new Set(),
  );
  const [customTimeframes, setCustomTimeframes] = useState<
    Record<TimeUnit, number[]>
  >(() => {
    const empty: Record<TimeUnit, number[]> = {
      sec: [],
      min: [],
      hours: [],
      day: [],
      week: [],
      month: [],
    };
    if (typeof window === "undefined") return empty;
    try {
      const raw = localStorage.getItem(CUSTOM_TIMEFRAMES_STORAGE_KEY);
      return raw ? { ...empty, ...JSON.parse(raw) } : empty;
    } catch {
      return empty;
    }
  });
  const [customTimeframeInputs, setCustomTimeframeInputs] = useState<
    Record<TimeUnit, string>
  >({ sec: "", min: "", hours: "", day: "", week: "", month: "" });
  const [starredTimeframes, setStarredTimeframes] = useState<
    Record<TimeUnit, number[]>
  >(() => {
    const empty: Record<TimeUnit, number[]> = {
      sec: [],
      min: [],
      hours: [],
      day: [],
      week: [],
      month: [],
    };
    if (typeof window === "undefined") return empty;
    try {
      const raw = localStorage.getItem(STARRED_TIMEFRAMES_STORAGE_KEY);
      return raw ? { ...empty, ...JSON.parse(raw) } : empty;
    } catch {
      return empty;
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SELECTED_TIMEFRAMES_STORAGE_KEY);
      if (raw) setSelectedTimeframes(new Set(JSON.parse(raw)));
    } catch {
      // ignore malformed/unavailable storage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        SELECTED_TIMEFRAMES_STORAGE_KEY,
        JSON.stringify(Array.from(selectedTimeframes)),
      );
    } catch {
      // ignore unavailable storage
    }
  }, [selectedTimeframes]);

  useEffect(() => {
    try {
      localStorage.setItem(
        CUSTOM_TIMEFRAMES_STORAGE_KEY,
        JSON.stringify(customTimeframes),
      );
    } catch {
      // ignore unavailable storage
    }
  }, [customTimeframes]);

  const [activeTrendType, setActiveTrendType] = useState<TrendType>("nifty");
  const [activeTrendDirection, setActiveTrendDirection] =
    useState<TrendDirection>("up");
  const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(
    new Set(),
  );
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(
    new Set(),
  );
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(
    new Set(),
  );
  const [selectedIndustries, setSelectedIndustries] = useState<Set<string>>(
    new Set(),
  );
  const [selectedMarketCapBuckets, setSelectedMarketCapBuckets] = useState<
    Set<string>
  >(new Set());
  const [marketCapMin, setMarketCapMin] = useState("");
  const [marketCapMax, setMarketCapMax] = useState("");
  const [selectedPriceBands, setSelectedPriceBands] = useState<Set<string>>(
    new Set(),
  );
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [changeMin, setChangeMin] = useState("");
  const [changeMax, setChangeMax] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [volumeMin, setVolumeMin] = useState("");
  const [selectedScanFor, setSelectedScanFor] = useState<Set<string>>(
    new Set(),
  );
  const [customScanForOptions, setCustomScanForOptions] = useState<string[]>(
    [],
  );
  const [customScanForInput, setCustomScanForInput] = useState("");
  const [selectedCandlestickPatterns, setSelectedCandlestickPatterns] =
    useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Real distinct sector/industry/market-cap/price-band/series values from
  // the live feed (same /api/market/filters endpoint /market uses), so the
  // Advanced Filters options actually match what live rows can have. Starts
  // empty (server-safe) and loads on mount/exchange-change — never read
  // synchronously, so there's nothing here that can hydration-mismatch.
  const [liveFilterOptions, setLiveFilterOptions] =
    useState<MarketFilterOptions>(EMPTY_MARKET_FILTER_OPTIONS);

  const filterExchangeParam = selectedExchanges.size
    ? baseExchangeMode(Array.from(selectedExchanges)[0])
    : "NSE";

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(
          `/api/market/filters?exchange=${encodeURIComponent(filterExchangeParam)}`,
          { credentials: "same-origin", signal: controller.signal },
        );
        if (!response.ok) return;
        const data: unknown = unwrapApiEnvelope(await response.json());
        if (isMarketFilterOptions(data)) {
          setLiveFilterOptions(data);
        }
      } catch {
        // ignore — Advanced Filters just keep their previous options
      }
    })();
    return () => controller.abort();
  }, [filterExchangeParam]);

  // ---- Real live market data (Screening Table tab) ----------------------
  // Equity (default) and F&O Stocks (EQ) (Segments filter) are the same
  // equity feed — the latter narrows it to the cash-market stocks that have
  // derivatives, so both fill the one screeningStocks list.
  const [screeningStocks, setScreeningStocks] = useState<MarketStockData[]>(
    [],
  );
  const [screeningPagination, setScreeningPagination] =
    useState<ScreeningPaginationInfo | null>(null);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screeningError, setScreeningError] = useState<string | null>(null);
  const screeningRequestIdRef = useRef(0);
  const screeningControllerRef = useRef<AbortController | null>(null);
  // Manual "Refresh" button next to the search bar — re-fetches whichever
  // live source (Screening Table's page, or the active curated board's
  // symbols) backs the tab currently in view.
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // ---- Real live market data for curated symbols (all 6 board tabs) -----
  const [liveByKey, setLiveByKey] = useState<Record<string, MarketStockData>>(
    {},
  );
  const curatedRequestIdRef = useRef(0);
  const curatedControllerRef = useRef<AbortController | null>(null);

  const mergeLiveData = useCallback((stocks: readonly MarketStockData[]) => {
    if (stocks.length === 0) return;
    setLiveByKey((current) => {
      const next = { ...current };
      for (const stock of stocks) {
        next[liveKeyFor(stock.exchange, stock.tradingSymbol)] = stock;
      }
      return next;
    });
  }, []);

  const isFnoSegmentSelected = selectedSegments.has("F&O Stocks (EQ)");

  // The CP Signal picks the server can evaluate. A label-only pick beside
  // them contributes nothing on the Screening Table (nothing there carries
  // that label), exactly as before; on the curated boards every pick still
  // matches the label the entry was saved with.
  const screenedPatternIds = useMemo(
    () =>
      Array.from(selectedCandlestickPatterns)
        .map(dailyCandlePatternIdForLabel)
        .filter((id): id is DailyCandlePatternId => id !== undefined)
        .sort(),
    [selectedCandlestickPatterns],
  );

  const fetchScreeningStocks = useCallback(
    async (page: number) => {
      screeningControllerRef.current?.abort();
      const controller = new AbortController();
      const requestId = screeningRequestIdRef.current + 1;
      screeningRequestIdRef.current = requestId;
      screeningControllerRef.current = controller;

      try {
        setScreeningLoading(true);
        setScreeningError(null);

        // A sort the server understands runs over the whole filtered set;
        // anything else keeps the default order here and is sorted in the
        // browser, across the page in view.
        const serverSortField = tableSort
          ? SERVER_SORT_FIELD_BY_COLUMN[tableSort.columnKey]
          : undefined;

        const params = new URLSearchParams({
          exchange: filterExchangeParam,
          page: String(page),
          pageSize: "100",
          sort: serverSortField ?? "pctChange",
          order: serverSortField && tableSort ? tableSort.direction : "desc",
          // "F&O Stocks (EQ)" is a narrowing of this same equity feed, not a
          // different one: the NSE/BSE stocks that have derivatives.
          ...(isFnoSegmentSelected ? { fnoOnly: "true" } : {}),
          ...(screenedPatternIds.length
            ? { patterns: screenedPatternIds.join(",") }
            : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(selectedSectors.size
            ? { sectors: Array.from(selectedSectors).join(",") }
            : {}),
          ...(selectedIndustries.size
            ? { industries: Array.from(selectedIndustries).join(",") }
            : {}),
          ...(selectedMarketCapBuckets.size
            ? { marketCaps: Array.from(selectedMarketCapBuckets).join(",") }
            : {}),
          ...(selectedPriceBands.size
            ? { priceBands: Array.from(selectedPriceBands).join(",") }
            : {}),
          ...(selectedGroups.size
            ? { series: Array.from(selectedGroups).join(",") }
            : {}),
          ...(marketCapMin.trim() ? { marketCapMin } : {}),
          ...(marketCapMax.trim() ? { marketCapMax } : {}),
          ...(priceMin.trim() ? { priceMin } : {}),
          ...(priceMax.trim() ? { priceMax } : {}),
          ...(changeMin.trim() ? { changeMin } : {}),
          ...(changeMax.trim() ? { changeMax } : {}),
          ...(volumeMin.trim() ? { volumeMin } : {}),
        });

        const response = await fetch(`/api/market/live?${params}`, {
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => undefined);
          if (requestId === screeningRequestIdRef.current) {
            setScreeningError(
              getMarketApiErrorMessage(
                payload,
                "Failed to load live market data.",
              ),
            );
          }
          return;
        }

        const data: unknown = unwrapApiEnvelope(await response.json());
        if (!isMarketLiveResponse(data)) {
          throw new Error(INVALID_MARKET_RESPONSE_MESSAGE);
        }
        if (requestId !== screeningRequestIdRef.current) return;

        setScreeningStocks([...data.stocks]);
        setScreeningPagination({
          page: data.pagination.page,
          pageSize: data.pagination.pageSize,
          total: data.pagination.totalStocks,
          totalPages: data.pagination.totalPages,
        });
        mergeLiveData(data.stocks);
      } catch (err) {
        if (
          controller.signal.aborted ||
          requestId !== screeningRequestIdRef.current
        ) {
          return;
        }
        setScreeningError(
          err instanceof Error
            ? err.message
            : "Failed to load live market data.",
        );
      } finally {
        if (requestId === screeningRequestIdRef.current) {
          screeningControllerRef.current = null;
          setScreeningLoading(false);
        }
      }
    },
    [
      isFnoSegmentSelected,
      screenedPatternIds,
      tableSort,
      filterExchangeParam,
      search,
      selectedSectors,
      selectedIndustries,
      selectedMarketCapBuckets,
      selectedPriceBands,
      selectedGroups,
      marketCapMin,
      marketCapMax,
      priceMin,
      priceMax,
      changeMin,
      changeMax,
      volumeMin,
      mergeLiveData,
    ],
  );

  // Debounced fetch whenever the Screening Table's filters change, while
  // that tab is active.
  useEffect(() => {
    if (activeSource !== "screening") return;
    const timer = setTimeout(() => {
      void fetchScreeningStocks(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [activeSource, fetchScreeningStocks]);

  // 30s live refresh while Screening Table is the active tab, same cadence
  // as /market.
  useEffect(() => {
    if (activeSource !== "screening") return;
    const interval = setInterval(() => {
      void fetchScreeningStocks(screeningPagination?.page ?? 1);
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeSource, fetchScreeningStocks, screeningPagination?.page]);

  useEffect(
    () => () => screeningControllerRef.current?.abort(),
    [],
  );

  // ---- Quick Scans (saved filter setups) -------------------------------
  const { settings: quickScanSettings, updateSettings: updateQuickScans } =
    usePersistedSettings<QuickScanSettings>({
      scope: "vgsreddy-quick-scans",
      defaultSettings: { scans: [] },
      normalize: normalizeQuickScanSettings,
    });
  const quickScans = quickScanSettings.scans;

  const captureQuickScanFilters = (): QuickScanFilters => ({
    timeframes: Array.from(selectedTimeframes),
    customTimeframes: {
      sec: [...customTimeframes.sec],
      min: [...customTimeframes.min],
      hours: [...customTimeframes.hours],
      day: [...customTimeframes.day],
      week: [...customTimeframes.week],
      month: [...customTimeframes.month],
    },
    exchanges: Array.from(selectedExchanges),
    segments: Array.from(selectedSegments),
    sectors: Array.from(selectedSectors),
    industries: Array.from(selectedIndustries),
    marketCapBuckets: Array.from(selectedMarketCapBuckets),
    priceBands: Array.from(selectedPriceBands),
    groups: Array.from(selectedGroups),
    scanFor: Array.from(selectedScanFor),
    customScanFor: [...customScanForOptions],
    candlestickPatterns: Array.from(selectedCandlestickPatterns),
    marketCapMin,
    marketCapMax,
    priceMin,
    priceMax,
    changeMin,
    changeMax,
    volumeMin,
    trendDirection: activeTrendDirection,
    trendType: activeTrendType,
    sort: tableSort,
  });

  const applyQuickScan = (scan: QuickScan) => {
    const { filters } = scan;
    setSelectedTimeframes(new Set(filters.timeframes));
    setCustomTimeframes({
      sec: [...filters.customTimeframes.sec],
      min: [...filters.customTimeframes.min],
      hours: [...filters.customTimeframes.hours],
      day: [...filters.customTimeframes.day],
      week: [...filters.customTimeframes.week],
      month: [...filters.customTimeframes.month],
    });
    setSelectedExchanges(new Set(filters.exchanges));
    setSelectedSegments(new Set(filters.segments));
    setSelectedSectors(new Set(filters.sectors));
    setSelectedIndustries(new Set(filters.industries));
    setSelectedMarketCapBuckets(new Set(filters.marketCapBuckets));
    setSelectedPriceBands(new Set(filters.priceBands));
    setSelectedGroups(new Set(filters.groups));
    setSelectedScanFor(new Set(filters.scanFor));
    setCustomScanForOptions([...filters.customScanFor]);
    setSelectedCandlestickPatterns(new Set(filters.candlestickPatterns));
    setMarketCapMin(filters.marketCapMin);
    setMarketCapMax(filters.marketCapMax);
    setPriceMin(filters.priceMin);
    setPriceMax(filters.priceMax);
    setChangeMin(filters.changeMin);
    setChangeMax(filters.changeMax);
    setVolumeMin(filters.volumeMin);
    setActiveTrendDirection(filters.trendDirection);
    setActiveTrendType(filters.trendType);
    setTableSort(filters.sort);
    toast.success(`Applied "${scan.name}"`);
  };

  const saveQuickScan = (name: string) => {
    const filters = captureQuickScanFilters();
    const existing = quickScans.find((scan) => scan.name === name);
    const id = existing?.id ?? `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const saved: QuickScan = {
      id,
      name,
      savedAt: new Date().toISOString(),
      filters,
    };
    updateQuickScans((current) => ({
      scans: existing
        ? current.scans.map((scan) => (scan.id === existing.id ? saved : scan))
        : [...current.scans, saved],
    }));
    // Saving over a name is how the market table's saved views behave too, so
    // say which of the two just happened rather than silently replacing.
    toast.success(existing ? `Updated "${name}"` : `Saved "${name}"`);
  };

  const overwriteQuickScan = (scan: QuickScan) => {
    const filters = captureQuickScanFilters();
    updateQuickScans((current) => ({
      scans: current.scans.map((entry) =>
        entry.id === scan.id
          ? { ...entry, filters, savedAt: new Date().toISOString() }
          : entry,
      ),
    }));
    toast.success(`Updated "${scan.name}"`);
  };

  const renameQuickScan = (scan: QuickScan, name: string) => {
    updateQuickScans((current) => ({
      scans: current.scans.map((entry) =>
        entry.id === scan.id ? { ...entry, name } : entry,
      ),
    }));
    toast.success(`Renamed to "${name}"`);
  };

  // Which saved scan, if any, describes the filters on screen right now.
  const matchingQuickScanId =
    quickScans.find(
      (scan) =>
        quickScanSignature(scan.filters) ===
        quickScanSignature(captureQuickScanFilters()),
    )?.id ?? null;

  const deleteQuickScan = (scan: QuickScan) => {
    updateQuickScans((current) => ({
      scans: current.scans.filter((entry) => entry.id !== scan.id),
    }));
    toast.success(`Deleted "${scan.name}"`);
  };

  // ---- Curated boards (Watchlist, Paper Trading, Back Test, ...) --------
  const { settings: curatedSettings, updateSettings: updateCuratedSettings } =
    usePersistedSettings<CuratedEntriesSettings>({
      scope: "vgsreddy-entries",
      defaultSettings: { entries: [] },
      normalize: normalizeCuratedEntries,
    });
  const curatedEntries = curatedSettings.entries;

  const updateCuratedEntries = useCallback(
    (updater: (current: CuratedEntry[]) => CuratedEntry[]) => {
      updateCuratedSettings((current) => ({
        entries: updater(current.entries),
      }));
    },
    [updateCuratedSettings],
  );

  const fetchCuratedLiveData = useCallback(
    async (symbols: readonly string[]) => {
      if (symbols.length === 0) return;
      curatedControllerRef.current?.abort();
      const controller = new AbortController();
      const requestId = curatedRequestIdRef.current + 1;
      curatedRequestIdRef.current = requestId;
      curatedControllerRef.current = controller;

      try {
        const params = new URLSearchParams({
          exchange: "Both",
          symbols: symbols.join(","),
          pageSize: "500",
        });
        const response = await fetch(`/api/market/live?${params}`, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data: unknown = unwrapApiEnvelope(await response.json());
        if (!isMarketLiveResponse(data)) return;
        if (requestId !== curatedRequestIdRef.current) return;
        mergeLiveData(data.stocks);
      } catch {
        // ignore — affected rows just keep showing their placeholder state
      }
    },
    [mergeLiveData],
  );

  const curatedSymbolsKey = useMemo(
    () =>
      Array.from(new Set(curatedEntries.map((e) => e.tradingSymbol))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [curatedEntries],
  );

  useEffect(() => {
    if (curatedSymbolsKey.length === 0) return;
    const timer = setTimeout(() => {
      void fetchCuratedLiveData(curatedSymbolsKey);
    }, 0);
    return () => clearTimeout(timer);
    // curatedSymbolsKey is a derived, deduped snapshot — safe to depend on
    // directly instead of curatedEntries itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curatedSymbolsKey.join(","), fetchCuratedLiveData]);

  useEffect(() => {
    if (curatedSymbolsKey.length === 0) return;
    const interval = setInterval(() => {
      void fetchCuratedLiveData(curatedSymbolsKey);
    }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curatedSymbolsKey.join(","), fetchCuratedLiveData]);

  useEffect(() => () => curatedControllerRef.current?.abort(), []);

  // ---- Column order / visibility (unchanged from the column-layout work) -
  const { settings: columnSettings, updateSettings: updateColumnSettings } =
    usePersistedSettings<VgsReddyColumnSettings>({
      scope: "vgsreddy-columns",
      defaultSettings: DEFAULT_COLUMN_SETTINGS,
      normalize: normalizeColumnSettings,
    });

  const visibleColumnsSetForActiveTab = useMemo(
    () => new Set(columnSettings.visibleColumnsByTab[activeSource]),
    [columnSettings.visibleColumnsByTab, activeSource],
  );

  const handleReorderWatchlistColumn = (
    draggedKey: string,
    targetKey: string,
  ) => {
    updateColumnSettings((current) => {
      const currentOrder = current.columnOrderByTab[activeSource];
      const next = [...currentOrder];
      const fromIndex = next.indexOf(draggedKey);
      const toIndex = next.indexOf(targetKey);
      if (fromIndex === -1 || toIndex === -1) return current;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggedKey);
      return {
        ...current,
        columnOrderByTab: { ...current.columnOrderByTab, [activeSource]: next },
      };
    });
  };

  const handleToggleColumnVisibility = (columnKey: string) => {
    updateColumnSettings((current) => {
      const next = new Set(current.visibleColumnsByTab[activeSource]);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return {
        ...current,
        visibleColumnsByTab: {
          ...current.visibleColumnsByTab,
          [activeSource]: Array.from(next),
        },
      };
    });
  };

  const handleResetColumnVisibility = () => {
    updateColumnSettings((current) => ({
      ...current,
      visibleColumnsByTab: {
        ...current.visibleColumnsByTab,
        [activeSource]: [...WATCHLIST_DEFAULT_COLUMN_ORDER],
      },
    }));
  };

  const industryOptions = useMemo(
    () => getIndustriesForSectors(Array.from(selectedSectors)),
    [selectedSectors],
  );

  const [prevIndustryOptions, setPrevIndustryOptions] =
    useState(industryOptions);
  if (prevIndustryOptions !== industryOptions) {
    setPrevIndustryOptions(industryOptions);
    const allowed = new Set(industryOptions);
    setSelectedIndustries((current) => {
      const next = new Set(
        Array.from(current).filter((industry) => allowed.has(industry)),
      );
      return next.size === current.size ? current : next;
    });
  }

  // F&O Stocks now matches by underlying symbol against either exchange's
  // F&O contracts (see the fnoOnly query in live-market-service.ts), so all
  // segment options are valid regardless of exchange scope — NSE and BSE
  // both keep the full list.
  const segmentOptions = SEGMENT_OPTIONS;

  const scanForOptions = [...SCAN_FOR_STANDARD, ...customScanForOptions];
  const sectorOptions = liveFilterOptions.sectors.length
    ? liveFilterOptions.sectors
    : NSE_SECTORS;
  const marketCapBucketOptions = liveFilterOptions.marketCaps;
  const priceBandOptions = liveFilterOptions.priceBands;
  const groupOptions = liveFilterOptions.series;

  const toggleExchangeSingle = (value: string) => {
    setSelectedExchanges((current) => {
      if (current.has(value) && current.size === 1) return new Set();
      return new Set([value]);
    });
    // Picking one of the "<Exchange> <Segment>" shortcuts also selects the
    // matching Segments value, so one click gets both scopes at once.
    const impliedSegment = EXCHANGE_SEGMENT_SHORTCUTS[value];
    if (impliedSegment && !selectedExchanges.has(value)) {
      setSelectedSegments(new Set([impliedSegment]));
    }
  };

  const toggleSegmentSingle = (value: string) => {
    setSelectedSegments((current) =>
      current.has(value) && current.size === 1 ? new Set() : new Set([value]),
    );
  };

  const addCustomScanFor = () => {
    const raw = customScanForInput.trim();
    if (!raw) return;
    if (
      !SCAN_FOR_STANDARD.includes(raw) &&
      !customScanForOptions.includes(raw)
    ) {
      setCustomScanForOptions((current) => [...current, raw]);
    }
    setSelectedScanFor((current) => new Set(current).add(raw));
    setCustomScanForInput("");
  };

  const timeframeKey = Array.from(selectedTimeframes).sort().join(",");
  const boardKey = `${activeSource}-${timeframeKey}-${activeTrendType}-${activeTrendDirection}`;

  // Sets preserve insertion order, and every select/add path here removes a
  // unit's old key before re-adding the new one, so the last entry is always
  // whichever unit's timeframe was most recently changed.
  const selectedTimeframesInOrder = Array.from(selectedTimeframes);
  const mostRecentTimeframeUnit = selectedTimeframesInOrder.length
    ? (selectedTimeframesInOrder[selectedTimeframesInOrder.length - 1].split(
        "-",
      )[0] as TimeUnit)
    : null;

  const handleRemove = (entryId: string) => {
    updateCuratedEntries((current) =>
      current.filter((entry) => entry.id !== entryId),
    );
    toast.success("Removed from board");
  };

  const handleMoveRow = (row: JoinedRow, category: CuratedTab) => {
    if (row.curated) {
      const entryId = row.curated.id;
      updateCuratedEntries((current) =>
        current.map((entry) =>
          entry.id === entryId ? { ...entry, category } : entry,
        ),
      );
      toast.success(`Moved to ${tabLabel(category)}`);
      return;
    }

    const newEntry: CuratedEntry = {
      ...defaultCuratedEntryForm(),
      id: `entry-${Date.now()}`,
      addedAt: new Date().toISOString(),
      exchange: row.exchange,
      tradingSymbol: row.tradingSymbol,
      category,
    };
    updateCuratedEntries((current) => [...current, newEntry]);
    toast.success(`Added to ${tabLabel(category)}`);
  };

  const [isStrategyDialogOpen, setIsStrategyDialogOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [strategyForm, setStrategyForm] = useState<CuratedEntryFormState>(
    defaultCuratedEntryForm(),
  );
  const [symbolLookup, setSymbolLookup] = useState<{
    status: "idle" | "loading" | "found" | "not-found";
    companyName?: string;
  }>({ status: "idle" });

  useEffect(() => {
    if (!isStrategyDialogOpen) return;
    const symbol = strategyForm.tradingSymbol.trim();
    const controller = new AbortController();
    let fetchTimer: ReturnType<typeof setTimeout> | undefined;

    const kickoffTimer = setTimeout(() => {
      if (!symbol) {
        setSymbolLookup({ status: "idle" });
        return;
      }
      setSymbolLookup({ status: "loading" });
      fetchTimer = setTimeout(async () => {
        try {
          const params = new URLSearchParams({
            exchange: strategyForm.exchange,
            search: symbol,
            pageSize: "5",
          });
          const response = await fetch(`/api/market/live?${params}`, {
            credentials: "same-origin",
            signal: controller.signal,
          });
          if (!response.ok) {
            setSymbolLookup({ status: "not-found" });
            return;
          }
          const data: unknown = unwrapApiEnvelope(await response.json());
          if (!isMarketLiveResponse(data)) {
            setSymbolLookup({ status: "not-found" });
            return;
          }
          const match = data.stocks.find(
            (stock) =>
              stock.tradingSymbol.toUpperCase() === symbol.toUpperCase(),
          );
          setSymbolLookup(
            match
              ? { status: "found", companyName: match.companyName }
              : { status: "not-found" },
          );
        } catch {
          // aborted or network error — leave the last known state
        }
      }, 400);
    }, 0);

    return () => {
      clearTimeout(kickoffTimer);
      if (fetchTimer) clearTimeout(fetchTimer);
      controller.abort();
    };
  }, [strategyForm.tradingSymbol, strategyForm.exchange, isStrategyDialogOpen]);

  const openEditStrategyDialog = (row: JoinedRow) => {
    if (!row.curated) return;
    const { id, addedAt, ...rest } = row.curated;
    void id;
    void addedAt;
    setEditingEntryId(row.curated.id);
    setStrategyForm(rest);
    setIsStrategyDialogOpen(true);
  };

  const handleStrategyFormChange = <K extends keyof CuratedEntryFormState>(
    field: K,
    value: CuratedEntryFormState[K],
  ) => {
    setStrategyForm((current) => ({ ...current, [field]: value }));
  };

  const handleStrategyFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const symbol = strategyForm.tradingSymbol.trim().toUpperCase();
    if (!symbol) {
      toast.error("Trading symbol is required");
      return;
    }

    if (editingEntryId) {
      updateCuratedEntries((current) =>
        current.map((entry) =>
          entry.id === editingEntryId
            ? { ...entry, ...strategyForm, tradingSymbol: symbol }
            : entry,
        ),
      );
      toast.success("Entry updated");
    } else {
      const newEntry: CuratedEntry = {
        ...strategyForm,
        tradingSymbol: symbol,
        id: `entry-${Date.now()}`,
        addedAt: new Date().toISOString(),
      };
      updateCuratedEntries((current) => [...current, newEntry]);
      toast.success("Added to board");
    }
    setIsStrategyDialogOpen(false);
  };

  // Raw live rows (Screening Table, curated === null) have no timeframe of
  // their own — a stock's live quote isn't "on" a timeframe — so the filter
  // only ever applies to curated board entries, which do have one.
  const matchesTimeframe = (curated: CuratedEntry | null) =>
    curated === null ||
    selectedTimeframes.size === 0 ||
    selectedTimeframes.has(
      `${curated.timeframe.unit}-${curated.timeframe.value}`,
    );

  const selectTimeframe = (unit: TimeUnit, value: number) => {
    const key = `${unit}-${value}`;
    setSelectedTimeframes((current) => {
      // Only one timeframe can be active at a time, across every unit —
      // selecting one clears whatever was selected in any other dropdown.
      if (current.size === 1 && current.has(key)) return current;
      return new Set([key]);
    });
  };

  const addCustomTimeframe = (unit: TimeUnit) => {
    const raw = customTimeframeInputs[unit].trim();
    const value = Number(raw);
    if (!raw || !Number.isInteger(value) || value <= 0) return;

    const group = timeUnitGroups.find((g) => g.id === unit)!;
    if (
      !group.standard.includes(value) &&
      !customTimeframes[unit].includes(value)
    ) {
      setCustomTimeframes((current) => ({
        ...current,
        [unit]: [...current[unit], value].sort((a, b) => a - b),
      }));
    }
    // Same global exclusivity as selectTimeframe: adding a custom value
    // selects it and clears any selection in every other dropdown.
    setSelectedTimeframes(new Set([`${unit}-${value}`]));
    setCustomTimeframeInputs((current) => ({ ...current, [unit]: "" }));
  };

  const removeCustomTimeframe = (unit: TimeUnit, value: number) => {
    setCustomTimeframes((current) => ({
      ...current,
      [unit]: current[unit].filter((v) => v !== value),
    }));
    setSelectedTimeframes((current) => {
      const next = new Set(current);
      next.delete(`${unit}-${value}`);
      return next;
    });
  };

  const clearUnitTimeframes = (unit: TimeUnit) => {
    setSelectedTimeframes((current) => {
      const next = new Set(
        Array.from(current).filter((key) => !key.startsWith(`${unit}-`)),
      );
      return next;
    });
  };

  const getUnitSelectedValues = (unit: TimeUnit): Set<string> =>
    new Set(
      Array.from(selectedTimeframes)
        .filter((key) => key.startsWith(`${unit}-`))
        .map((key) => key.slice(unit.length + 1)),
    );

  const toggleStarTimeframe = (unit: TimeUnit, value: number) => {
    setStarredTimeframes((current) => {
      const list = current[unit];
      const nextList = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      const next = { ...current, [unit]: nextList };
      try {
        localStorage.setItem(
          STARRED_TIMEFRAMES_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch {
        // ignore unavailable storage
      }
      return next;
    });
  };

  const matchesExchangeFilter = (row: JoinedRow) => {
    if (selectedExchanges.size === 0) return true;
    const mode = baseExchangeMode(Array.from(selectedExchanges)[0]);
    if (mode === "Both" || mode === "Merged") return true;
    if (mode === "NSE" || mode === "Only NSE") return row.exchange === "NSE";
    if (mode === "BSE" || mode === "Only BSE") return row.exchange === "BSE";
    return true;
  };

  const matchesSet = (selected: Set<string>, value: string) =>
    selected.size === 0 || selected.has(value);

  const matchesRange = (value: number, min: string, max: string) => {
    const minN = min.trim() === "" ? -Infinity : Number(min);
    const maxN = max.trim() === "" ? Infinity : Number(max);
    return value >= minN && value <= maxN;
  };

  // Server already applies the equivalent filters to Screening Table's
  // fetch, so re-checking here is a cheap, harmless no-op for that tab and
  // the real enforcement mechanism for the small, client-held curated
  // boards.
  const passesAdvancedFilters = (row: JoinedRow): boolean => {
    if (!matchesTimeframe(row.curated)) return false;
    if (!matchesExchangeFilter(row)) return false;
    // Segments narrows the Screening Table's fetch (Equity vs the F&O-enabled
    // subset of it) — the fetch effect already enforces that, so
    // this is a no-op confirmation there. Curated boards (Watchlist, Paper
    // Trading, ...) hold hand-picked stocks that are always equity lookups
    // today, so a "segment" isn't a real property of a curated row; without
    // this bypass, leaving "F&O Stocks (EQ)" selected while browsing any curated
    // tab would make every board look empty for an unrelated reason.
    if (row.category === "screening" && !matchesSet(selectedSegments, row.segments))
      return false;
    if (!matchesSet(selectedSectors, row.sector)) return false;
    if (!matchesSet(selectedIndustries, row.industry)) return false;
    if (!matchesSet(selectedPriceBands, row.priceBand)) return false;
    if (!matchesSet(selectedGroups, row.group)) return false;
    if (!matchesRange(row.changePercent, changeMin, changeMax)) return false;
    if (!matchesRange(row.cmp, priceMin, priceMax)) return false;
    if (volumeMin.trim() !== "" && row.volume < Number(volumeMin))
      return false;
    if (!matchesSet(selectedScanFor, getScanForBucket(row.changePercent)))
      return false;
    // Curated boards match the label the entry was saved with. Screening rows
    // carry no label: the picks with a real candle screen behind them have
    // already narrowed the fetch (screenedPatternIds), and the rest cannot
    // apply there.
    if (
      row.curated &&
      !matchesSet(selectedCandlestickPatterns, row.curated.candlestickPattern)
    )
      return false;
    return true;
  };

  const joinedRowsForActiveTab: JoinedRow[] = useMemo(() => {
    if (activeSource === "screening") {
      return screeningStocks.map((stock) =>
        buildScreeningJoinedRow(stock, isFnoSegmentSelected),
      );
    }
    return curatedEntries
      .filter((entry) => entry.category === activeSource)
      .map((entry) =>
        buildCuratedJoinedRow(
          entry,
          liveByKey[liveKeyFor(entry.exchange, entry.tradingSymbol)],
        ),
      );
  }, [
    activeSource,
    isFnoSegmentSelected,
    screeningStocks,
    curatedEntries,
    liveByKey,
  ]);

  const rowsBeforeSearch = useMemo(
    () => joinedRowsForActiveTab.filter(passesAdvancedFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      joinedRowsForActiveTab,
      selectedTimeframes,
      selectedExchanges,
      selectedSegments,
      selectedSectors,
      selectedIndustries,
      selectedPriceBands,
      selectedGroups,
      changeMin,
      changeMax,
      priceMin,
      priceMax,
      volumeMin,
      selectedScanFor,
      customScanForOptions,
      selectedCandlestickPatterns,
    ],
  );

  const countBySource = (value: SourceTab): number => {
    if (value === "screening") {
      if (activeSource === "screening") {
        return screeningPagination?.total ?? screeningStocks.length;
      }
      return screeningStocks.length;
    }
    return curatedEntries.filter((entry) => entry.category === value).length;
  };

  const filteredRows = useMemo(
    () =>
      rowsBeforeSearch.filter((row) =>
        matchesSearch(
          search,
          row.tradingSymbol,
          row.companyName,
          row.curated?.candlestickPattern ?? "",
        ),
      ),
    [rowsBeforeSearch, search],
  );

  // A screening sort the API understood is already applied across the whole
  // result set, so re-sorting the page here would be redundant; everything
  // else is ordered in the browser.
  const sortedByServer =
    activeSource === "screening" &&
    tableSort !== null &&
    SERVER_SORT_FIELD_BY_COLUMN[tableSort.columnKey] !== undefined;

  const sortedRows = useMemo(() => {
    if (!tableSort || sortedByServer) return filteredRows;
    return sortRowsByColumn(filteredRows, tableSort.columnKey, tableSort.direction);
  }, [filteredRows, tableSort, sortedByServer]);

  // S No numbers a row within the entire result set, not within the page in
  // view: on page 3 of the Screening Table the first row is 201, not 1.
  const rowNumberOffset =
    activeSource === "screening" && screeningPagination
      ? (screeningPagination.page - 1) * screeningPagination.pageSize
      : 0;

  const handleJumpToPage = (event: FormEvent) => {
    event.preventDefault();
    if (!screeningPagination) return;
    const lastPage = Math.max(1, screeningPagination.totalPages);
    const target = Number(pageJumpInput.trim());
    if (!Number.isInteger(target) || target < 1 || target > lastPage) {
      toast.error(`Enter a page between 1 and ${lastPage}`);
      return;
    }
    setPageJumpInput("");
    void fetchScreeningStocks(target);
  };

  const handleToggleSort = (columnKey: string) => {
    setTableSort((current) => nextSortState(current, columnKey));
  };

  // Says how far a sort on this column reaches, so nobody reads a page-local
  // order as a whole-market one.
  const sortScopeLabel = (columnKey: string): string => {
    if (activeSource !== "screening") return "all rows";
    return SERVER_SORT_FIELD_BY_COLUMN[columnKey]
      ? "all matching rows"
      : "this page only";
  };

  // Drives the badge on the Advanced Filters header: one count per control in
  // that row that is currently narrowing the table.
  const activeAdvancedFilterCount = [
    selectedExchanges.size,
    selectedSegments.size,
    selectedSectors.size,
    selectedIndustries.size,
    selectedMarketCapBuckets.size,
    marketCapMin.trim() || marketCapMax.trim() ? 1 : 0,
    selectedPriceBands.size,
    selectedGroups.size,
    changeMin.trim() || changeMax.trim() ? 1 : 0,
    priceMin.trim() || priceMax.trim() ? 1 : 0,
    volumeMin.trim() ? 1 : 0,
    selectedScanFor.size,
    selectedCandlestickPatterns.size,
  ].filter((count) => count > 0).length;

  const visibleColumnOrderForActiveTab = useMemo(
    () =>
      columnSettings.columnOrderByTab[activeSource].filter((key) =>
        visibleColumnsSetForActiveTab.has(key),
      ),
    [
      columnSettings.columnOrderByTab,
      activeSource,
      visibleColumnsSetForActiveTab,
    ],
  );

  // Export exactly what is on screen: the active tab's visible columns, in the
  // user's own column order, for the rows that survived the current filters.
  // The Screening Table is paginated server-side, so that tab exports the page
  // in view — the file name and the toast both say which one.
  const handleDownloadCsv = () => {
    if (sortedRows.length === 0) return;
    const page =
      activeSource === "screening" ? screeningPagination?.page : undefined;
    const fileName = `vgsreddy-${activeSource}${
      page ? `-page-${page}` : ""
    }-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsvFile(
      fileName,
      buildWatchlistCsv(
        sortedRows,
        visibleColumnOrderForActiveTab,
        rowNumberOffset,
      ),
    );
    toast.success(
      `Exported ${sortedRows.length} row${
        sortedRows.length === 1 ? "" : "s"
      }${page ? ` from page ${page}` : ""}`,
    );
  };

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      if (activeSource === "screening") {
        await fetchScreeningStocks(screeningPagination?.page ?? 1);
      } else if (curatedSymbolsKey.length > 0) {
        await fetchCuratedLiveData(curatedSymbolsKey);
      }
      toast.success("Refreshed");
    } finally {
      setIsManualRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/40 py-6">
      <div className="w-full px-4 lg:px-8">
        {/* PageHeader (components/common/PageHeader.tsx) is shared with other
            pages and takes a plain string title — the gradient here is
            applied from outside it via a Tailwind arbitrary descendant
            selector on this wrapper, targeting the shared component's own
            <h1>, so no shared file changes and no effect on any other page
            that renders PageHeader. */}
        <div className="[&_h1]:bg-gradient-to-r [&_h1]:from-indigo-600 [&_h1]:via-fuchsia-600 [&_h1]:to-rose-500 [&_h1]:bg-clip-text [&_h1]:text-transparent">
          <PageHeader
            title="VGS Reddy Screener"
            description="Institutional candlestick breakout setups and multi-timeframe pattern recognition scanner"
            icon={CandlestickChart}
          >
            <SourceNav
              activeSource={activeSource}
              onSelect={setActiveSource}
              countBySource={countBySource}
            />
          </PageHeader>
        </div>

        {/* Controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="grid grid-cols-2 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <button
              onClick={() => setActiveTrendDirection("up")}
              className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-colors ${
                activeTrendDirection === "up"
                  ? "bg-emerald-500 text-white shadow-xs dark:text-zinc-950"
                  : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Bullish Trend
            </button>
            <button
              onClick={() => setActiveTrendDirection("down")}
              className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-colors ${
                activeTrendDirection === "down"
                  ? "bg-rose-500 text-white shadow-xs dark:text-zinc-950"
                  : "text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              Bearish Trend
            </button>
          </div>

          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search symbol, company, pattern..."
              className="relative flex-1 min-w-0"
              matchCount={filteredRows.length}
              totalCount={rowsBeforeSearch.length}
            />
            <button
              onClick={() => void handleRefresh()}
              disabled={isManualRefreshing}
              aria-label="Refresh live data"
              title="Refresh live data"
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60 shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isManualRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Timeframes */}
        <div className="mb-4 flex flex-wrap items-center gap-3 p-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50/60 to-white shadow-xs">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 uppercase tracking-wider shrink-0">
            <Clock className="w-3.5 h-3.5" />
            Timeframes
            {selectedTimeframes.size > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] leading-none num-font">
                {selectedTimeframes.size}
              </span>
            )}
          </span>
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
            {timeUnitGroups.map((group) => {
              const customValues = customTimeframes[group.id];
              const options = [...group.standard, ...customValues].map(
                String,
              );
              return (
                <CheckboxFilterDropdown
                  key={group.id}
                  label={group.label}
                  icon={Clock}
                  options={options}
                  selected={getUnitSelectedValues(group.id)}
                  onToggle={(value) =>
                    selectTimeframe(group.id, Number(value))
                  }
                  onClear={() => clearUnitTimeframes(group.id)}
                  searchable
                  single
                  activeVariant="dark"
                  highlightActive={group.id === mostRecentTimeframeUnit}
                  removableOptions={new Set(customValues.map(String))}
                  onRemoveOption={(value) =>
                    removeCustomTimeframe(group.id, Number(value))
                  }
                  starred={
                    new Set(starredTimeframes[group.id].map(String))
                  }
                  onToggleStar={(value) =>
                    toggleStarTimeframe(group.id, Number(value))
                  }
                  customAdd={{
                    value: customTimeframeInputs[group.id],
                    onChange: (value) =>
                      setCustomTimeframeInputs((current) => ({
                        ...current,
                        [group.id]: value,
                      })),
                    onAdd: () => addCustomTimeframe(group.id),
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-fuchsia-50/50 to-white shadow-xs">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-violet-700 uppercase tracking-wider mr-1">
            <Radar className="w-3.5 h-3.5" />
            Advanced Filters
            {activeAdvancedFilterCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[10px] leading-none num-font">
                {activeAdvancedFilterCount}
              </span>
            )}
          </span>
          <CheckboxFilterDropdown
            label="Exchange"
            icon={Landmark}
            options={EXCHANGE_FILTER_OPTIONS}
            selected={selectedExchanges}
            onToggle={toggleExchangeSingle}
            onClear={() => setSelectedExchanges(new Set())}
            single
          />
          <CheckboxFilterDropdown
            label="Segments"
            icon={Layers}
            options={segmentOptions}
            selected={selectedSegments}
            onToggle={toggleSegmentSingle}
            onClear={() => setSelectedSegments(new Set())}
            single
          />
          <CheckboxFilterDropdown
            label="Sector"
            icon={PieChart}
            options={sectorOptions}
            selected={selectedSectors}
            onToggle={(value) => toggleSetValue(setSelectedSectors, value)}
            onClear={() => setSelectedSectors(new Set())}
            searchable
          />
          <CheckboxFilterDropdown
            label="Industry"
            icon={Building2}
            options={industryOptions}
            selected={selectedIndustries}
            onToggle={(value) => toggleSetValue(setSelectedIndustries, value)}
            onClear={() => setSelectedIndustries(new Set())}
            searchable
          />
          <RangeFilterDropdown
            label="M Cap"
            icon={BarChart2}
            min={marketCapMin}
            max={marketCapMax}
            onMinChange={setMarketCapMin}
            onMaxChange={setMarketCapMax}
            onClear={() => {
              setSelectedMarketCapBuckets(new Set());
              setMarketCapMin("");
              setMarketCapMax("");
            }}
            bucketOptions={marketCapBucketOptions}
            selectedBuckets={selectedMarketCapBuckets}
            onToggleBucket={(value) =>
              toggleSetValue(setSelectedMarketCapBuckets, value)
            }
          />
          <CheckboxFilterDropdown
            label="P Band"
            icon={Gauge}
            options={priceBandOptions}
            selected={selectedPriceBands}
            onToggle={(value) => toggleSetValue(setSelectedPriceBands, value)}
            onClear={() => setSelectedPriceBands(new Set())}
          />
          <CheckboxFilterDropdown
            label="Group"
            icon={Users}
            options={groupOptions}
            selected={selectedGroups}
            onToggle={(value) => toggleSetValue(setSelectedGroups, value)}
            onClear={() => setSelectedGroups(new Set())}
          />
          <RangeFilterDropdown
            label="% Change"
            icon={Percent}
            min={changeMin}
            max={changeMax}
            onMinChange={setChangeMin}
            onMaxChange={setChangeMax}
            onClear={() => {
              setChangeMin("");
              setChangeMax("");
            }}
          />
          <RangeFilterDropdown
            label="Price"
            icon={IndianRupee}
            min={priceMin}
            max={priceMax}
            onMinChange={setPriceMin}
            onMaxChange={setPriceMax}
            onClear={() => {
              setPriceMin("");
              setPriceMax("");
            }}
          />
          <RangeFilterDropdown
            label="Volume"
            icon={Activity}
            min={volumeMin}
            max=""
            onMinChange={setVolumeMin}
            onMaxChange={() => {}}
            onClear={() => setVolumeMin("")}
            showMax={false}
          />
          <CheckboxFilterDropdown
            label="Scan For"
            icon={Radar}
            options={scanForOptions}
            selected={selectedScanFor}
            onToggle={(value) => toggleSetValue(setSelectedScanFor, value)}
            onClear={() => setSelectedScanFor(new Set())}
            customAdd={{
              value: customScanForInput,
              onChange: setCustomScanForInput,
              onAdd: addCustomScanFor,
            }}
          />
          <CheckboxFilterDropdown
            label="CP Signal"
            icon={CandlestickChart}
            options={CANDLESTICK_PATTERN_OPTIONS}
            selected={selectedCandlestickPatterns}
            onToggle={(value) =>
              toggleSetValue(setSelectedCandlestickPatterns, value)
            }
            onClear={() => setSelectedCandlestickPatterns(new Set())}
            onSelectAll={(values) =>
              setSelectedCandlestickPatterns(
                (current) => new Set([...current, ...values]),
              )
            }
          />
          {/* Last in the row and pushed right, so it lands at the bottom-right
              corner of the panel however many filters wrap above it. */}
          <div className="ml-auto">
            <QuickScanMenu
              scans={quickScans}
              activeScanId={matchingQuickScanId}
              activeCount={activeAdvancedFilterCount + selectedTimeframes.size}
              onApply={applyQuickScan}
              onSave={saveQuickScan}
              onOverwrite={overwriteQuickScan}
              onRename={renameQuickScan}
              onDelete={deleteQuickScan}
            />
          </div>
        </div>

        {/* macOS Finder Striped Table Card */}
        <motion.div
          key={boardKey}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              {sourceTabs.find((t) => t.id === activeSource)?.label}
              {selectedTimeframes.size > 0 && (
                <>
                  {" "}
                  · {selectedTimeframes.size} timeframe
                  {selectedTimeframes.size > 1 ? "s" : ""} selected
                </>
              )}
              {activeSource === "screening" && screeningLoading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              )}
            </h2>
            <div className="flex items-center gap-2">
              {tableSort && (
                <span
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-[11px] font-bold text-indigo-700"
                  title={`Sorted by ${
                    WATCHLIST_COLUMN_DEFS[tableSort.columnKey]?.label ??
                    tableSort.columnKey
                  } (${sortScopeLabel(tableSort.columnKey)})`}
                >
                  {tableSort.direction === "asc" ? (
                    <ArrowUp className="w-3 h-3" />
                  ) : (
                    <ArrowDown className="w-3 h-3" />
                  )}
                  {WATCHLIST_COLUMN_DEFS[tableSort.columnKey]?.label ??
                    tableSort.columnKey}
                  {!sortedByServer && activeSource === "screening" && (
                    <span className="font-semibold opacity-70">· this page</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setTableSort(null)}
                    aria-label="Clear sort"
                    className="p-0.5 rounded hover:bg-indigo-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <ColumnVisibilityDropdown
                columnOrder={columnSettings.columnOrderByTab[activeSource]}
                visibleColumns={visibleColumnsSetForActiveTab}
                onToggleColumn={handleToggleColumnVisibility}
                onReset={handleResetColumnVisibility}
              />
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={filteredRows.length === 0}
                title={
                  activeSource === "screening" && screeningPagination
                    ? `Download the ${filteredRows.length} rows on this page as CSV`
                    : "Download these rows as CSV"
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold shadow-emerald-500/25 shadow-xs hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {filteredRows.length} signals active
              </span>
            </div>
          </div>

          {activeSource === "screening" && screeningError && (
            <p
              role="alert"
              className="mx-5 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 font-medium"
            >
              {screeningError}
            </p>
          )}

          <div className="overflow-x-auto scrollbar-thin">
            <WatchlistStyleTable
              rows={sortedRows}
              columnOrder={visibleColumnOrderForActiveTab}
              sort={tableSort}
              onToggleSort={handleToggleSort}
              sortScopeLabel={sortScopeLabel}
              rowNumberOffset={rowNumberOffset}
              onReorderColumn={handleReorderWatchlistColumn}
              onEdit={openEditStrategyDialog}
              onRemove={handleRemove}
              onMove={handleMoveRow}
              emptyMessage={
                search.trim()
                  ? `No signals match "${search.trim()}".`
                  : activeSource === "screening"
                    ? isFnoSegmentSelected
                      ? "No live F&O Stocks (EQ) match these filters."
                      : "No live rows match these filters."
                    : "Nothing added to this board yet — use Add Strategy or Move to from Screening Table."
              }
            />
          </div>

          {activeSource === "screening" && screeningPagination && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>
                Page {screeningPagination.page} of{" "}
                {Math.max(1, screeningPagination.totalPages)} ·{" "}
                {screeningPagination.total.toLocaleString("en-IN")}{" "}
                {isFnoSegmentSelected ? "live F&O Stocks (EQ)" : "live rows"}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <button
                  disabled={screeningPagination.page <= 1}
                  onClick={() => void fetchScreeningStocks(1)}
                  title="First page"
                  className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  « First
                </button>
                <button
                  disabled={screeningPagination.page <= 1}
                  onClick={() =>
                    void fetchScreeningStocks(screeningPagination.page - 1)
                  }
                  className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Prev
                </button>

                {paginationWindow(
                  screeningPagination.page,
                  screeningPagination.totalPages,
                ).map((pageNumber, slot) =>
                  pageNumber === null ? (
                    <span
                      key={`gap-${slot}`}
                      aria-hidden="true"
                      className="px-1 text-slate-400"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={pageNumber}
                      onClick={() => void fetchScreeningStocks(pageNumber)}
                      aria-current={
                        pageNumber === screeningPagination.page
                          ? "page"
                          : undefined
                      }
                      className={`min-w-[26px] px-2 py-1 rounded-lg border transition-colors ${
                        pageNumber === screeningPagination.page
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ),
                )}

                <button
                  disabled={
                    screeningPagination.page >= screeningPagination.totalPages
                  }
                  onClick={() =>
                    void fetchScreeningStocks(screeningPagination.page + 1)
                  }
                  className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
                <button
                  disabled={
                    screeningPagination.page >= screeningPagination.totalPages
                  }
                  onClick={() =>
                    void fetchScreeningStocks(
                      Math.max(1, screeningPagination.totalPages),
                    )
                  }
                  title="Last page"
                  className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Last »
                </button>

                {/* Straight to a page, for when the strip's window doesn't
                    reach it — 35 pages of equity rows is a lot of Next. */}
                <form
                  onSubmit={handleJumpToPage}
                  className="flex items-center gap-1 ml-1"
                >
                  <label htmlFor="screening-page-jump" className="sr-only">
                    Go to page
                  </label>
                  <input
                    id="screening-page-jump"
                    type="number"
                    min={1}
                    max={Math.max(1, screeningPagination.totalPages)}
                    value={pageJumpInput}
                    onChange={(event) => setPageJumpInput(event.target.value)}
                    placeholder="Page"
                    className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={pageJumpInput.trim() === ""}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Go
                  </button>
                </form>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <Dialog
        open={isStrategyDialogOpen}
        onOpenChange={setIsStrategyDialogOpen}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntryId ? "Edit Strategy" : "Add Strategy"}
            </DialogTitle>
            <DialogDescription>
              {editingEntryId
                ? "Update this board entry's details."
                : "Add a real trading symbol to one of your boards — its live price, sector, volume, etc. come straight from the live feed."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleStrategyFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={formLabelClass}>Trading Symbol</label>
                <input
                  type="text"
                  required
                  value={strategyForm.tradingSymbol}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "tradingSymbol",
                      e.target.value.toUpperCase(),
                    )
                  }
                  className={formInputClass}
                  placeholder="e.g. RELIANCE"
                />
                <p className="mt-1 text-[11px] font-semibold">
                  {symbolLookup.status === "loading" && (
                    <span className="text-slate-400">Checking…</span>
                  )}
                  {symbolLookup.status === "found" && (
                    <span className="text-emerald-600 inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> {symbolLookup.companyName}
                    </span>
                  )}
                  {symbolLookup.status === "not-found" && (
                    <span className="text-amber-600">
                      No live match yet — you can still save this, it will
                      pick up live data once available.
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className={formLabelClass}>Board</label>
                <select
                  value={strategyForm.category}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "category",
                      e.target.value as CuratedTab,
                    )
                  }
                  className={formInputClass}
                >
                  {curatedTabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={formLabelClass}>Exchange</label>
                <select
                  value={strategyForm.exchange}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "exchange",
                      e.target.value as "NSE" | "BSE",
                    )
                  }
                  className={formInputClass}
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>

              <div>
                <label className={formLabelClass}>CP Signal</label>
                <select
                  value={strategyForm.candlestickPattern}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "candlestickPattern",
                      e.target.value,
                    )
                  }
                  className={formInputClass}
                >
                  {CANDLESTICK_PATTERN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={formLabelClass}>CP 2nd Signal</label>
                <select
                  value={strategyForm.candlestickPattern2 ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "candlestickPattern2",
                      e.target.value || undefined,
                    )
                  }
                  className={formInputClass}
                >
                  <option value="">—</option>
                  {CANDLESTICK_PATTERN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={formLabelClass}>Trend</label>
                <select
                  value={strategyForm.trend ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "trend",
                      (e.target.value || undefined) as
                        | CuratedEntryFormState["trend"],
                    )
                  }
                  className={formInputClass}
                >
                  <option value="">—</option>
                  {TREND_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={formLabelClass}>Timeframe Unit</label>
                <select
                  value={strategyForm.timeframe.unit}
                  onChange={(e) =>
                    handleStrategyFormChange("timeframe", {
                      ...strategyForm.timeframe,
                      unit: e.target.value as TimeUnit,
                    })
                  }
                  className={formInputClass}
                >
                  {timeUnitGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={formLabelClass}>Timeframe Value</label>
                <input
                  type="number"
                  min={1}
                  value={strategyForm.timeframe.value}
                  onChange={(e) =>
                    handleStrategyFormChange("timeframe", {
                      ...strategyForm.timeframe,
                      value: Number(e.target.value),
                    })
                  }
                  className={formInputClass}
                />
              </div>

              <div>
                <label className={formLabelClass}>Entry (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={strategyForm.entry}
                  onChange={(e) =>
                    handleStrategyFormChange("entry", Number(e.target.value))
                  }
                  className={formInputClass}
                />
              </div>
              <div>
                <label className={formLabelClass}>Stop Loss (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={strategyForm.stopLoss}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "stopLoss",
                      Number(e.target.value),
                    )
                  }
                  className={formInputClass}
                />
              </div>
              <div>
                <label className={formLabelClass}>Target (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={strategyForm.target ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "target",
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                  className={formInputClass}
                />
              </div>
              <div>
                <label className={formLabelClass}>Day 1 Open (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={strategyForm.day1Open ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "day1Open",
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                  className={formInputClass}
                />
              </div>
              <div>
                <label className={formLabelClass}>Day 2 Open (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={strategyForm.day2Open ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "day2Open",
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                  className={formInputClass}
                />
              </div>
              <div>
                <label className={formLabelClass}>Day 3 Open (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={strategyForm.day3Open ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "day3Open",
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                  className={formInputClass}
                />
              </div>

              <div>
                <label className={formLabelClass}>Target 1 (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={strategyForm.target1 ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "target1",
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                  className={formInputClass}
                />
              </div>
              <div>
                <label className={formLabelClass}>Target 2 (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={strategyForm.target2 ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "target2",
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                  className={formInputClass}
                />
              </div>
              <div>
                <label className={formLabelClass}>Target 3 (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={strategyForm.target3 ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "target3",
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                  className={formInputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={formLabelClass}>Note</label>
                <input
                  type="text"
                  value={strategyForm.note ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange("note", e.target.value)
                  }
                  className={formInputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={formLabelClass}>Red Flags</label>
                <input
                  type="text"
                  value={strategyForm.redFlags ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange("redFlags", e.target.value)
                  }
                  className={formInputClass}
                />
              </div>

              <div>
                <label className={formLabelClass}>Board Meeting</label>
                <input
                  type="text"
                  value={strategyForm.boardMeeting ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange("boardMeeting", e.target.value)
                  }
                  placeholder="YYYY-MM-DD"
                  className={formInputClass}
                />
              </div>
              <div>
                <label className={formLabelClass}>Ex/Record Date</label>
                <input
                  type="text"
                  value={strategyForm.exRecordDate ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange("exRecordDate", e.target.value)
                  }
                  placeholder="YYYY-MM-DD"
                  className={formInputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={formLabelClass}>Corporate Action</label>
                <input
                  type="text"
                  value={strategyForm.corporateAction ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange(
                      "corporateAction",
                      e.target.value,
                    )
                  }
                  className={formInputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={formLabelClass}>Latest News</label>
                <input
                  type="text"
                  value={strategyForm.latestNews ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange("latestNews", e.target.value)
                  }
                  className={formInputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={formLabelClass}>Source From</label>
                <input
                  type="text"
                  value={strategyForm.sourceFrom ?? ""}
                  onChange={(e) =>
                    handleStrategyFormChange("sourceFrom", e.target.value)
                  }
                  className={formInputClass}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={strategyForm.entrySignal}
                  onChange={(e) =>
                    handleStrategyFormChange("entrySignal", e.target.checked)
                  }
                />
                Entry
              </label>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setIsStrategyDialogOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                {editingEntryId ? "Save Changes" : "Add Strategy"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

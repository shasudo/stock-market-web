"use client";

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Eye,
  Trash2,
  TrendingUp,
  Clock,
  Activity,
  BarChart2,
  Zap,
  Folder as FolderIcon,
  FolderInput,
  Copy,
  Pencil,
  Plus,
  LineChart,
  Table as TableIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useSearchParams } from "next/navigation";
import WatchlistChartView from "@/components/watchlist/WatchlistChartView";
import { isMarketOpen } from "@/lib/market-hours";
import {
  PageHeader,
  StockActionsMenu,
  SearchInput,
  TabCount,
  LevelCell,
  PickerMenu,
  ColumnVisibilityMenu,
  loadHiddenColumns,
  saveHiddenColumns,
  matchesSearch,
} from "@/components/common";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import type { LucideIcon } from "lucide-react";
import type { WatchlistCategory } from "@/types";
import type {
  WatchlistLevelField,
  WatchlistListType,
} from "@/lib/validations/watchlist";
import apiClient, {
  getApiResponseMessage,
  getAxiosErrorMessage,
  isRecord,
  isSuccessfulApiResponse,
} from "@/lib/api-client";
import { daysSince, formatMarketCap } from "@/lib/format";

interface WatchlistPageProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  listType?: WatchlistListType;
}

interface WatchlistStock {
  id: string;
  sNo: number;
  date: string;
  sourceFrom: string;
  segments: string;
  tradingSymbol: string;
  sector: string;
  industry: string;
  // Joined in at read time from live market data, not stored on the row.
  exchange: string;
  group: string;
  priceBand: string;
  marketCapValue: number;
  corporateAction: string | null;
  ltp: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  redFlags: string;
  note: string;
  category: WatchlistCategory;
  listType: WatchlistListType;
  netChange?: number;
  pctChange?: number;
  prevClose?: number;
  high?: number | null;
  low?: number | null;
  open?: number | null;
}

function isWatchlistStock(value: unknown): value is WatchlistStock {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.tradingSymbol === "string" &&
    typeof value.category === "string" &&
    typeof value.listType === "string" &&
    typeof value.ltp === "number" &&
    typeof value.exchange === "string" &&
    typeof value.group === "string" &&
    typeof value.priceBand === "string" &&
    typeof value.marketCapValue === "number" &&
    (value.corporateAction === null ||
      typeof value.corporateAction === "string")
  );
}

interface WatchlistFolder {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly stocks: WatchlistStock[];
}

function toFolder(value: unknown): WatchlistFolder | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.isDefault !== "boolean"
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    isDefault: value.isDefault,
    stocks: Array.isArray(value.stocks)
      ? value.stocks.filter(isWatchlistStock)
      : [],
  };
}

function extractFolders(responseData: unknown): WatchlistFolder[] | null {
  if (!isSuccessfulApiResponse(responseData) || !isRecord(responseData.data)) {
    return null;
  }

  const watchlists = responseData.data.watchlists;
  if (!Array.isArray(watchlists)) {
    return null;
  }

  return watchlists
    .map(toFolder)
    .filter((folder): folder is WatchlistFolder => folder !== null);
}

const WATCHLIST_LIVE_POLL_MS = 10_000;
const WATCHLIST_IDLE_POLL_MS = 60_000;

async function requestWatchlistFolders(): Promise<WatchlistFolder[] | null> {
  const response = await apiClient.get<unknown>("/api/watchlist");
  return extractFolders(response.data);
}

const tabs = [
  {
    id: "intraday" as const,
    label: "Intraday Trading",
    icon: Clock,
    isSpecial: false,
  },
  {
    id: "fno" as const,
    label: "F&O Trading",
    icon: TrendingUp,
    isSpecial: false,
  },
  {
    id: "swing" as const,
    label: "Swing Trading",
    icon: Activity,
    isSpecial: false,
  },
  {
    id: "positional" as const,
    label: "Positional Trading",
    icon: BarChart2,
    isSpecial: false,
  },
  {
    id: "multibagger" as const,
    label: "Multi Bagger Stocks",
    icon: Zap,
    isSpecial: true,
  },
];

// Order matches the columns list itself, so the "Columns" menu reads the
// same left-to-right as the table.
const WATCHLIST_COLUMN_LABELS: Record<string, string> = {
  sNo: "S No",
  date: "Date",
  days: "Days",
  sourceFrom: "Source From",
  exchange: "Exchange",
  segments: "Segments",
  symbol: "Trading Symbol",
  sector: "Sector",
  industry: "Industry",
  group: "Group",
  priceBand: "P Band",
  marketCap: "M Cap",
  boardMeeting: "Board Meeting",
  corporateAction: "Corporate Action",
  latestNews: "Latest News",
  ltp: "LTP",
  moveTo: "Move to",
  entryPrice: "Entry Price",
  stopLoss: "Stop Loss",
  target1: "Target 1",
  target2: "Target 2",
  target3: "Target 3",
  note: "Note",
  redFlags: "Red Flags",
};

const WATCHLIST_COLUMN_ALIGN: Record<string, "left" | "right"> = {
  days: "right",
  marketCap: "right",
  ltp: "right",
  entryPrice: "right",
  stopLoss: "right",
  target1: "right",
  target2: "right",
  target3: "right",
};

// The normal board tracks adopted positions, so the event columns (board
// meeting, corporate action, latest news) trail behind the levels. The
// preposition board is for candidates still being evaluated, where those
// same columns matter before you'd size up entry/stop/targets, so they sit
// right after M Cap instead - same columns, different priority per board.
const NORMAL_COLUMN_ORDER = [
  "sNo",
  "date",
  "days",
  "sourceFrom",
  "exchange",
  "segments",
  "symbol",
  "sector",
  "industry",
  "group",
  "priceBand",
  "marketCap",
  "ltp",
  "moveTo",
  "entryPrice",
  "stopLoss",
  "target1",
  "target2",
  "target3",
  "note",
  "redFlags",
  "boardMeeting",
  "corporateAction",
  "latestNews",
];

const PREPOSITION_COLUMN_ORDER = [
  "sNo",
  "date",
  "days",
  "sourceFrom",
  "exchange",
  "segments",
  "symbol",
  "sector",
  "industry",
  "group",
  "priceBand",
  "marketCap",
  "boardMeeting",
  "corporateAction",
  "latestNews",
  "ltp",
  "moveTo",
  "entryPrice",
  "stopLoss",
  "target1",
  "target2",
  "target3",
  "note",
  "redFlags",
];

function columnOrderFor(listType: WatchlistListType): string[] {
  return listType === "preposition"
    ? PREPOSITION_COLUMN_ORDER
    : NORMAL_COLUMN_ORDER;
}

export default function WatchlistPage({
  title = "Watchlist",
  description = "Track your favorite stocks",
  icon = Eye,
  listType = "normal",
}: WatchlistPageProps = {}) {
  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <PageHeader title={title} description={description} icon={icon} />
        <Suspense
          fallback={<LoadingSpinner message="Loading watchlist..." />}
        >
          <WatchlistCategoryBoard listType={listType} />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * One hand-entered level, editable in place. Shows the value with its gap to
 * LTP in rupees and percent; zero means "not set" and shows a dash, because a
 * 0 level would otherwise render a meaningless -100%.
 *
 * The percentage is measured against the level itself (how far LTP sits from
 * your entry / stop / target), which is what the original single-target column
 * did — kept so the three targets read the same way.
 */
/**
 * Folder chips plus create/rename/delete. Folders hold both boards, so this
 * renders identically on the normal and preposition pages; `listType` only
 * shapes the per-folder count so each board reports its own.
 */
function WatchlistFolderBar({
  folders,
  activeFolderId,
  listType,
  onSelect,
  onChanged,
}: {
  folders: readonly WatchlistFolder[];
  activeFolderId: string | null;
  listType: WatchlistListType;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [draftName, setDraftName] = useState("");
  const [mode, setMode] = useState<"idle" | "create" | "rename">("idle");
  const [busy, setBusy] = useState(false);

  const activeFolder = folders.find((folder) => folder.id === activeFolderId);

  const submit = async (): Promise<void> => {
    const name = draftName.trim();
    if (!name || busy) return;

    setBusy(true);
    try {
      const response =
        mode === "create"
          ? await apiClient.post<unknown>("/api/watchlist/folders", { name })
          : await apiClient.patch<unknown>("/api/watchlist/folders", {
              watchlistId: activeFolderId,
              name,
            });

      if (!isSuccessfulApiResponse(response.data)) {
        toast.error(
          getApiResponseMessage(response.data, "Unable to save watchlist"),
        );
        return;
      }

      toast.success(
        mode === "create" ? `Created "${name}"` : "Watchlist renamed",
      );
      setDraftName("");
      setMode("idle");
      await onChanged();
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to save watchlist"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!activeFolder || activeFolder.isDefault || busy) return;
    if (
      !window.confirm(
        `Delete "${activeFolder.name}" and its ${activeFolder.stocks.length} stock(s)? This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const response = await apiClient.delete<unknown>(
        "/api/watchlist/folders",
        { data: { watchlistId: activeFolder.id } },
      );
      if (!isSuccessfulApiResponse(response.data)) {
        toast.error(
          getApiResponseMessage(response.data, "Unable to delete watchlist"),
        );
        return;
      }
      toast.success("Watchlist deleted");
      await onChanged();
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to delete watchlist"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 border-b border-border pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <FolderIcon className="w-4 h-4 text-muted-foreground" />
        {folders.map((folder) => {
          const count = folder.stocks.filter(
            (stock) => stock.listType === listType,
          ).length;
          const isActive = folder.id === activeFolderId;
          return (
            <button
              key={folder.id}
              onClick={() => onSelect(folder.id)}
              title={folder.isDefault ? "Default watchlist" : folder.name}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <span className="max-w-[160px] truncate">{folder.name}</span>
              <TabCount count={count} active={isActive} />
            </button>
          );
        })}

        <button
          onClick={() => {
            setMode("create");
            setDraftName("");
          }}
          title="New watchlist"
          className="flex items-center gap-1 rounded-xl border border-dashed border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
          New
        </button>

        {activeFolder && !activeFolder.isDefault && (
          <>
            <button
              onClick={() => {
                setMode("rename");
                setDraftName(activeFolder.name);
              }}
              title={`Rename "${activeFolder.name}"`}
              aria-label={`Rename ${activeFolder.name}`}
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => void remove()}
              disabled={busy}
              title={`Delete "${activeFolder.name}"`}
              aria-label={`Delete ${activeFolder.name}`}
              className="rounded-lg p-2 text-muted-foreground hover:bg-error/10 hover:text-error disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {mode !== "idle" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
              if (event.key === "Escape") setMode("idle");
            }}
            placeholder="Watchlist name, e.g. Auto"
            maxLength={40}
            autoFocus
            className="w-full sm:w-64 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => void submit()}
            disabled={!draftName.trim() || busy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {mode === "create" ? "Create" : "Rename"}
          </button>
          <button
            onClick={() => setMode("idle")}
            className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function WatchlistCategoryBoard({
  listType = "normal",
}: {
  listType?: WatchlistListType;
} = {}) {
  const [activeTab, setActiveTab] = useState<WatchlistCategory>("intraday");
  const [folders, setFolders] = useState<WatchlistFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<"table" | "chart">(
    searchParams.get("view") === "chart" ? "chart" : "table",
  );
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string>(
    searchParams.get("symbol") ?? "",
  );

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() =>
    loadHiddenColumns("watchlist-hidden-columns"),
  );

  useEffect(() => {
    saveHiddenColumns("watchlist-hidden-columns", hiddenColumns);
  }, [hiddenColumns]);

  const toggleColumn = (key: string): void => {
    setHiddenColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const applyFolders = useCallback((loaded: WatchlistFolder[]): void => {
    setFolders(loaded);
    // Keep the selection if it survived, otherwise fall back to the default.
    setActiveFolderId((current) =>
      current && loaded.some((folder) => folder.id === current)
        ? current
        : (loaded.find((folder) => folder.isDefault)?.id ??
          loaded[0]?.id ??
          null),
    );
  }, []);

  const reloadFolders = useCallback(async (): Promise<void> => {
    try {
      const loaded = await requestWatchlistFolders();
      if (loaded === null) {
        toast.error("Received an invalid watchlist response");
        return;
      }
      applyFolders(loaded);
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to load watchlist"));
    } finally {
      setLoading(false);
    }
  }, [applyFolders]);

  // The chart view is read-only, so quotes can be refreshed under it without
  // clobbering an in-progress table edit. Failures stay silent: the next tick
  // retries and the chart keeps showing its last good prices.
  useEffect(() => {
    if (viewMode !== "chart") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async (): Promise<void> => {
      if (typeof document === "undefined" || !document.hidden) {
        try {
          const loaded = await requestWatchlistFolders();
          if (!cancelled && loaded) applyFolders(loaded);
        } catch {
          // keep the last good prices
        }
      }
      if (!cancelled) {
        timer = setTimeout(
          () => void tick(),
          isMarketOpen() ? WATCHLIST_LIVE_POLL_MS : WATCHLIST_IDLE_POLL_MS,
        );
      }
    };

    // Coming back to the tab refreshes at once instead of waiting out the tick.
    const onVisible = (): void => {
      if (document.hidden) return;
      if (timer) clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    timer = setTimeout(
      () => void tick(),
      isMarketOpen() ? WATCHLIST_LIVE_POLL_MS : WATCHLIST_IDLE_POLL_MS,
    );
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [viewMode, applyFolders]);

  useEffect(() => {
    let isCurrent = true;

    void requestWatchlistFolders()
      .then((loaded) => {
        if (!isCurrent) return;
        if (loaded === null) {
          toast.error("Received an invalid watchlist response");
          return;
        }
        applyFolders(loaded);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          toast.error(getAxiosErrorMessage(error, "Failed to load watchlist"));
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [applyFolders]);

  const handleRemove = async (stockId: string): Promise<void> => {
    try {
      const response = await apiClient.delete<unknown>("/api/watchlist", {
        data: { stockId },
      });

      if (isSuccessfulApiResponse(response.data)) {
        toast.success("Stock removed from watchlist");
        const loaded = extractFolders(response.data);
        if (loaded) applyFolders(loaded);
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to remove stock"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to remove stock"));
    }
  };

  const handleLevelChange = async (
    stockId: string,
    field: WatchlistLevelField,
    value: number,
  ): Promise<void> => {
    try {
      const response = await apiClient.patch<unknown>("/api/watchlist/levels", {
        stockId,
        field,
        value,
      });

      if (isSuccessfulApiResponse(response.data)) {
        const loaded = extractFolders(response.data);
        if (loaded) applyFolders(loaded);
      } else {
        toast.error(getApiResponseMessage(response.data, "Unable to save"));
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to save"));
    }
  };

  const handleMove = async (
    stockId: string,
    watchlistId: string,
  ): Promise<void> => {
    try {
      const response = await apiClient.patch<unknown>("/api/watchlist", {
        stockId,
        watchlistId,
      });

      if (isSuccessfulApiResponse(response.data)) {
        toast.success("Stock moved");
        const loaded = extractFolders(response.data);
        if (loaded) applyFolders(loaded);
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to move stock"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to move stock"));
    }
  };

  // Duplicates the row into another folder, levels and all, leaving the
  // original in place - unlike handleMove, which relocates it.
  const handleCopy = async (
    stock: WatchlistStock,
    watchlistId: string,
  ): Promise<void> => {
    try {
      const response = await apiClient.post<unknown>("/api/watchlist", {
        watchlistId,
        sNo: stock.sNo,
        date: stock.date,
        sourceFrom: stock.sourceFrom,
        segments: stock.segments,
        tradingSymbol: stock.tradingSymbol,
        sector: stock.sector,
        industry: stock.industry,
        ltp: stock.ltp,
        entryPrice: stock.entryPrice,
        stopLoss: stock.stopLoss,
        target1: stock.target1,
        target2: stock.target2,
        target3: stock.target3,
        redFlags: stock.redFlags,
        note: stock.note,
        category: stock.category,
        listType: stock.listType,
      });

      if (isSuccessfulApiResponse(response.data)) {
        toast.success("Stock copied");
        const loaded = extractFolders(response.data);
        if (loaded) applyFolders(loaded);
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to copy stock"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to copy stock"));
    }
  };

  const folderPickerItems = folders.map((folder) => ({
    id: folder.id,
    label: folder.name,
  }));

  // One cell per column key, so the header/body loop below can render either
  // board's column order (see NORMAL_/PREPOSITION_COLUMN_ORDER) off the same
  // definitions instead of duplicating cell markup per layout.
  function renderCell(
    key: string,
    stock: WatchlistStock,
    index: number,
  ): ReactNode {
    switch (key) {
      case "sNo":
        return (
          <td className="px-3 py-2.5 text-xs font-medium text-foreground">
            {index + 1}
          </td>
        );
      case "date":
        return (
          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
            {stock.date.slice(0, 10)}
          </td>
        );
      case "days":
        return (
          <td className="px-3 py-2.5 text-xs text-right text-muted-foreground whitespace-nowrap">
            {daysSince(stock.date)}
          </td>
        );
      case "sourceFrom":
        return (
          <td className="px-3 py-2.5 text-xs text-muted-foreground">
            {stock.sourceFrom}
          </td>
        );
      case "exchange":
        return (
          <td className="px-3 py-2.5 text-xs text-muted-foreground">
            {stock.exchange}
          </td>
        );
      case "segments":
        return (
          <td className="px-4 py-3">
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${
                stock.segments === "NSE"
                  ? "bg-blue-500/10 dark:bg-blue-400/10 text-primary dark:text-blue-300"
                  : stock.segments === "BSE"
                    ? "bg-purple-500/10 dark:bg-purple-400/10 text-purple-600 dark:text-purple-300"
                    : "bg-warning/10 dark:bg-orange-400/10 text-warning dark:text-orange-300"
              }`}
            >
              {stock.segments}
            </span>
          </td>
        );
      case "symbol":
        return (
          <td className="px-3 py-2.5 text-xs font-semibold text-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>{stock.tradingSymbol}</span>
              <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <StockActionsMenu
                  stock={{
                    symbol: stock.tradingSymbol,
                    name: stock.tradingSymbol,
                    ltp: stock.ltp,
                    sector: stock.sector,
                    industry: stock.industry,
                  }}
                  source={
                    listType === "preposition" ? "preposition" : "watchlist"
                  }
                  onActionComplete={(action) => {
                    if (action === "watchlist") void reloadFolders();
                  }}
                />
              </div>
            </div>
          </td>
        );
      case "sector":
        return (
          <td className="px-3 py-2.5 text-xs text-muted-foreground">
            {stock.sector}
          </td>
        );
      case "industry":
        return (
          <td className="px-3 py-2.5 text-xs text-muted-foreground">
            {stock.industry}
          </td>
        );
      case "group":
        return (
          <td className="px-3 py-2.5 text-xs text-muted-foreground">
            {stock.group}
          </td>
        );
      case "priceBand":
        return (
          <td className="px-3 py-2.5 text-xs text-muted-foreground">
            {stock.priceBand}
          </td>
        );
      case "marketCap":
        return (
          <td className="px-3 py-2.5 text-xs font-mono text-right text-muted-foreground">
            {formatMarketCap(stock.marketCapValue)}
          </td>
        );
      // No data source yet for these two - shown as placeholders so the
      // column layout matches the sheet rather than being silently dropped.
      case "boardMeeting":
        return <td className="px-3 py-2.5 text-xs text-muted-foreground">-</td>;
      case "latestNews":
        return <td className="px-3 py-2.5 text-xs text-muted-foreground">-</td>;
      case "corporateAction":
        return (
          <td
            className="px-3 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate"
            title={stock.corporateAction ?? undefined}
          >
            {stock.corporateAction ?? "-"}
          </td>
        );
      case "ltp":
        return (
          <td className="px-3 py-2.5 text-xs font-mono text-right font-semibold text-foreground">
            ₹{stock.ltp.toFixed(2)}
          </td>
        );
      case "moveTo":
        return (
          <td className="px-4 py-3">
            <div className="flex items-center gap-1">
              <PickerMenu
                items={folderPickerItems}
                excludeId={activeFolderId}
                icon={FolderInput}
                label={`Move ${stock.tradingSymbol} to another watchlist`}
                onPick={(watchlistId) => void handleMove(stock.id, watchlistId)}
              />
              <PickerMenu
                items={folderPickerItems}
                excludeId={activeFolderId}
                icon={Copy}
                label={`Copy ${stock.tradingSymbol} to another watchlist`}
                onPick={(watchlistId) => void handleCopy(stock, watchlistId)}
              />
              <button
                onClick={() => void handleRemove(stock.id)}
                aria-label={`Remove ${stock.tradingSymbol} from watchlist`}
                className="p-1.5 text-muted-foreground hover:text-error hover:bg-error/10 rounded-md transition-all"
                title="Remove from watchlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        );
      case "entryPrice":
        return (
          <LevelCell
            value={stock.entryPrice}
            reference={stock.ltp}
            label={`Entry price for ${stock.tradingSymbol}`}
            tone="neutral"
            onSave={(value) => handleLevelChange(stock.id, "entryPrice", value)}
          />
        );
      case "stopLoss":
        return (
          <LevelCell
            value={stock.stopLoss}
            reference={stock.ltp}
            label={`Stop loss for ${stock.tradingSymbol}`}
            tone="loss"
            onSave={(value) => handleLevelChange(stock.id, "stopLoss", value)}
          />
        );
      case "target1":
        return (
          <LevelCell
            value={stock.target1}
            reference={stock.ltp}
            label={`Target 1 for ${stock.tradingSymbol}`}
            tone="gain"
            onSave={(value) => handleLevelChange(stock.id, "target1", value)}
          />
        );
      case "target2":
        return (
          <LevelCell
            value={stock.target2}
            reference={stock.ltp}
            label={`Target 2 for ${stock.tradingSymbol}`}
            tone="gain"
            onSave={(value) => handleLevelChange(stock.id, "target2", value)}
          />
        );
      case "target3":
        return (
          <LevelCell
            value={stock.target3}
            reference={stock.ltp}
            label={`Target 3 for ${stock.tradingSymbol}`}
            tone="gain"
            onSave={(value) => handleLevelChange(stock.id, "target3", value)}
          />
        );
      case "note":
        return (
          <td
            className="px-3 py-2.5 text-xs text-muted-foreground max-w-[150px] truncate"
            title={stock.note}
          >
            {stock.note || "-"}
          </td>
        );
      case "redFlags":
        return (
          <td className="px-3 py-2.5 text-xs">
            {stock.redFlags && stock.redFlags !== "None" ? (
              <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded bg-error/10 text-error">
                {stock.redFlags}
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </td>
        );
      default:
        return null;
    }
  }

  const activeFolder =
    folders.find((folder) => folder.id === activeFolderId) ?? null;
  const stocksInFolder = (activeFolder?.stocks ?? []).filter(
    (stock) => stock.listType === listType,
  );
  const stocksInTab = stocksInFolder.filter(
    (stock) => stock.category === activeTab,
  );
  const stocks = stocksInTab.filter((stock) =>
    matchesSearch(
      search,
      stock.tradingSymbol,
      stock.sector,
      stock.industry,
      stock.sourceFrom,
      stock.note,
    ),
  );
  const visibleColumns = columnOrderFor(listType).filter(
    (key) => !hiddenColumns.has(key),
  );

  return (
    <>
      <WatchlistFolderBar
        folders={folders}
        activeFolderId={activeFolderId}
        listType={listType}
        onSelect={setActiveFolderId}
        onChanged={reloadFolders}
      />

      {/* Category Tabs and View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1 flex-wrap overflow-x-auto w-full sm:w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isSpecial = tab.isSpecial;
            const count = stocksInFolder.filter(
              (stock) => stock.category === tab.id,
            ).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`w-4 h-4 ${isSpecial ? "text-error" : ""}`} />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    isActive
                      ? "bg-white/25 dark:bg-zinc-950/10 text-white dark:text-zinc-950"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View Mode Switcher: Table vs Chart View */}
        <div className="flex items-center rounded-xl border border-border bg-card shadow-xs p-1 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "table"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedChartSymbol && stocksInTab.length > 0) {
                setSelectedChartSymbol(stocksInTab[0].tradingSymbol);
              }
              setViewMode("chart");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "chart"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>View Chart</span>
          </button>
        </div>
      </div>

      {viewMode === "chart" ? (
        <WatchlistChartView
          folders={folders}
          activeFolderId={activeFolderId}
          onSelectFolder={setActiveFolderId}
          activeCategory={activeTab}
          onSelectCategory={setActiveTab}
          activeSymbol={
            selectedChartSymbol ||
            stocksInTab[0]?.tradingSymbol ||
            stocksInFolder[0]?.tradingSymbol ||
            "RELIANCE"
          }
          onSelectSymbol={setSelectedChartSymbol}
          onBackToTable={() => setViewMode("table")}
          onRemoveStock={handleRemove}
          listType={listType}
        />
      ) : (
        /* Main Table Card */
        <motion.div
          key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-3xl border border-border bg-card/95 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04),0_1px_3px_rgb(0,0,0,0.02)] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border bg-muted/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h2
            className={`text-sm md:text-base font-extrabold capitalize flex items-center gap-2 ${
              activeTab === "multibagger" ? "text-error" : "text-foreground"
            }`}
          >
            {activeTab === "multibagger" && (
              <Zap className="w-4 h-4 fill-current" />
            )}
            {tabs.find((t) => t.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-2.5 flex-wrap">
            <ColumnVisibilityMenu
              columnOrder={columnOrderFor(listType)}
              columnLabels={WATCHLIST_COLUMN_LABELS}
              hiddenColumns={hiddenColumns}
              onToggle={toggleColumn}
            />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search symbol, sector, note..."
              className="relative w-full sm:w-64"
              inputClassName="w-full rounded-xl border border-border bg-card py-1.5 pl-7 pr-7 text-xs md:text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none shadow-xs"
            />
            <div className="whitespace-nowrap text-xs text-muted-foreground font-medium">
              <span className="font-bold text-foreground">
                {stocks.length}
              </span>{" "}
              {search.trim() ? `of ${stocksInTab.length} ` : ""}equities
            </div>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs md:text-sm min-w-[1200px]">
            <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
              <tr>
                {visibleColumns.map((key) => (
                  <th
                    key={key}
                    className={`px-4 py-3.5 text-${WATCHLIST_COLUMN_ALIGN[key] ?? "left"} text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] select-none`}
                  >
                    {WATCHLIST_COLUMN_LABELS[key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length}
                    className="px-6 py-20 text-center text-xs text-muted-foreground font-medium"
                  >
                    Loading live watchlist data…
                  </td>
                </tr>
              ) : null}
              {!loading &&
                stocks.map((stock, index) => (
                  <tr
                    key={stock.id}
                    className="finder-row transition-colors border-b border-border hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                  >
                    {visibleColumns.map((key) => (
                      <Fragment key={key}>
                        {renderCell(key, stock, index)}
                      </Fragment>
                    ))}
                  </tr>
                ))}
              {!loading && stocks.length === 0 && (
                <tr>
                  <td
                    colSpan={visibleColumns.length}
                    className="px-6 py-20 text-center text-xs text-muted-foreground font-medium"
                  >
                    {search.trim()
                      ? `No stocks match "${search.trim()}".`
                      : "No stocks found in this watchlist."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    )}
  </>
);
}

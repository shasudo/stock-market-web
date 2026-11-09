"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import apiClient, {
  getApiResponseMessage,
  getAxiosErrorMessage,
  isRecord,
  isSuccessfulApiResponse,
} from "@/lib/api-client";
import {
  fetchIndexQuoteSnapshot,
  fetchTickerQuoteSnapshot,
} from "@/lib/market/instrument-quote-client";
import { isMarketOpen } from "@/lib/market-hours";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import { readRecentSymbols } from "./SymbolSearchDialog";
import {
  DOWN_COLOR,
  Divider,
  Menu,
  MenuItem,
  UP_COLOR,
  formatNumber,
  signed,
} from "./ui";

export interface WatchlistRow {
  readonly symbol: string;
  readonly last: number;
  readonly change: number;
  readonly pct: number;
  /** Server stock id for folder rows; null for indices, futures and recents. */
  readonly id: string | null;
}

type Row = WatchlistRow;

/** Case-insensitive substring match on the symbol; empty query returns all rows. */
export function filterWatchlistRows(
  rows: readonly WatchlistRow[],
  query: string,
): WatchlistRow[] {
  const needle = query.trim().toUpperCase();
  if (!needle) return [...rows];
  return rows.filter((row) => row.symbol.toUpperCase().includes(needle));
}

export type WatchlistSortKey = "symbol" | "last" | "change" | "pct";

export interface WatchlistSort {
  readonly key: WatchlistSortKey;
  /** 1 for ascending, -1 for descending. */
  readonly dir: 1 | -1;
}

/**
 * TradingView-style header sorting, applied within each section. A null sort
 * keeps the server order.
 */
export function sortWatchlistRows(
  rows: readonly WatchlistRow[],
  sort: WatchlistSort | null,
): WatchlistRow[] {
  if (!sort) return [...rows];
  const dir = sort.dir;
  return [...rows].sort((a, b) => {
    switch (sort.key) {
      case "symbol":
        return a.symbol.localeCompare(b.symbol) * dir;
      case "last":
        return (a.last - b.last) * dir;
      case "change":
        return (a.change - b.change) * dir;
      case "pct":
        return (a.pct - b.pct) * dir;
    }
  });
}

/** Header click cycles ascending → descending → unsorted. */
export function cycleWatchlistSort(
  current: WatchlistSort | null,
  key: WatchlistSortKey,
): WatchlistSort | null {
  if (current?.key !== key) return { key, dir: 1 };
  if (current.dir === 1) return { key, dir: -1 };
  return null;
}

interface Folder {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly rows: readonly Row[];
}

const FEATURED_INDICES = [
  "NIFTY",
  "BANKNIFTY",
  "SENSEX",
  "FINNIFTY",
  "NIFTYIT",
  "MIDCPNIFTY",
];
const LIVE_MS = 10_000;
const IDLE_MS = 60_000;

function toFolders(value: unknown): Folder[] {
  if (!isRecord(value) || !Array.isArray(value.watchlists)) return [];
  const folders: Folder[] = [];
  for (const entry of value.watchlists) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      !Array.isArray(entry.stocks)
    ) {
      continue;
    }
    const rows: Row[] = [];
    for (const stock of entry.stocks) {
      if (!isRecord(stock) || typeof stock.tradingSymbol !== "string") continue;
      const last = typeof stock.ltp === "number" ? stock.ltp : 0;
      const change = typeof stock.netChange === "number" ? stock.netChange : 0;
      const pct = typeof stock.pctChange === "number" ? stock.pctChange : 0;
      const id = typeof stock.id === "string" ? stock.id : null;
      if (!rows.some((row) => row.symbol === stock.tradingSymbol)) {
        rows.push({ symbol: stock.tradingSymbol, last, change, pct, id });
      }
    }
    folders.push({
      id: entry.id,
      name: typeof entry.name === "string" ? entry.name : "Watchlist",
      isDefault: entry.isDefault === true,
      rows,
    });
  }
  return folders;
}

interface WatchlistPanelProps {
  readonly activeSymbol: string;
  readonly onSelect: (symbol: string) => void;
}

export default function WatchlistPanel({
  activeSymbol,
  onSelect,
}: WatchlistPanelProps) {
  const [indices, setIndices] = useState<readonly Row[]>([]);
  const [futures, setFutures] = useState<readonly Row[]>([]);
  const [folders, setFolders] = useState<readonly Folder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [failed, setFailed] = useState(false);
  const [sort, setSort] = useState<WatchlistSort | null>(null);
  const [folderMode, setFolderMode] = useState<"create" | "rename" | null>(
    null,
  );
  const [folderName, setFolderName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addSymbol, setAddSymbol] = useState("");
  const [mutating, setMutating] = useState(false);

  /** Reload folders from the server; returns the fresh list. */
  const refreshFolders = useCallback(async (): Promise<Folder[]> => {
    try {
      const response = await apiClient.get<unknown>("/api/watchlist");
      const data = isSuccessfulApiResponse(response.data)
        ? response.data.data
        : null;
      const next = toFolders(data);
      setFolders(next);
      setFailed(false);
      return next;
    } catch {
      setFailed(true);
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async (): Promise<void> => {
      if (!document.hidden) {
        const [indexResult, tickerResult, folderResult] =
          await Promise.allSettled([
            fetchIndexQuoteSnapshot(),
            fetchTickerQuoteSnapshot(),
            apiClient.get<unknown>("/api/watchlist"),
          ]);
        if (cancelled) return;
        if (indexResult.status === "fulfilled") {
          const bySymbol = new Map(
            indexResult.value.indices.map((index) => [
              index.tradingSymbol,
              index,
            ]),
          );
          const featured = FEATURED_INDICES.map((symbol) =>
            bySymbol.get(symbol),
          ).filter(
            (index): index is NonNullable<typeof index> => index !== undefined,
          );
          setIndices(
            (featured.length > 0
              ? featured
              : indexResult.value.indices.slice(0, 6)
            ).map((index) => ({
              symbol: index.tradingSymbol,
              last: index.lastPrice,
              change: index.netChange,
              pct: index.pctChange,
              id: null,
            })),
          );
        }
        if (tickerResult.status === "fulfilled") {
          setFutures(
            tickerResult.value.ticker.map((quote) => ({
              symbol: quote.tradingSymbol,
              last: quote.lastPrice,
              change: quote.netChange,
              pct: quote.pctChange,
              id: null,
            })),
          );
        }
        if (folderResult.status === "fulfilled") {
          const data = isSuccessfulApiResponse(folderResult.value.data)
            ? folderResult.value.data.data
            : null;
          setFolders(toFolders(data));
          setFailed(false);
        } else {
          setFailed(true);
        }
      }
      if (!cancelled)
        timer = setTimeout(
          () => void load(),
          isMarketOpen() ? LIVE_MS : IDLE_MS,
        );
    };

    const onVisible = (): void => {
      if (document.hidden) return;
      if (timer) clearTimeout(timer);
      void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const folder = useMemo(
    () =>
      folders.find((entry) => entry.id === folderId) ??
      folders.find((entry) => entry.isDefault) ??
      folders[0] ??
      null,
    [folders, folderId],
  );
  const recents = useMemo(() => (folder ? [] : readRecentSymbols()), [folder]);
  const visibleIndices = useMemo(
    () => sortWatchlistRows(filterWatchlistRows(indices, filter), sort),
    [indices, filter, sort],
  );
  const visibleFutures = useMemo(
    () => sortWatchlistRows(filterWatchlistRows(futures, filter), sort),
    [futures, filter, sort],
  );
  const visibleStocks = useMemo(
    () =>
      folder
        ? sortWatchlistRows(filterWatchlistRows(folder.rows, filter), sort)
        : [],
    [folder, filter, sort],
  );

  const removeRow = useCallback(
    async (row: Row): Promise<void> => {
      if (!row.id) return;
      setMutating(true);
      try {
        const response = await apiClient.delete<unknown>("/api/watchlist", {
          data: { stockId: row.id },
        });
        if (isSuccessfulApiResponse(response.data)) {
          toast.success(`${row.symbol} removed from watchlist`);
          await refreshFolders();
        } else {
          toast.error(
            getApiResponseMessage(response.data, "Unable to remove stock"),
          );
        }
      } catch (error: unknown) {
        toast.error(getAxiosErrorMessage(error, "Unable to remove stock"));
      } finally {
        setMutating(false);
      }
    },
    [refreshFolders],
  );

  const submitFolder = useCallback(async (): Promise<boolean> => {
    const name = folderName.trim();
    if (!name || !folderMode || mutating) return false;
    setMutating(true);
    try {
      if (folderMode === "create") {
        const response = await apiClient.post<unknown>(
          "/api/watchlist/folders",
          { name },
        );
        if (!isSuccessfulApiResponse(response.data)) {
          toast.error(
            getApiResponseMessage(response.data, "Unable to create watchlist"),
          );
          return false;
        }
        toast.success(`Created "${name}"`);
        const next = await refreshFolders();
        const created = next.find((entry) => entry.name === name);
        if (created) setFolderId(created.id);
      } else if (folder) {
        const response = await apiClient.patch<unknown>(
          "/api/watchlist/folders",
          { watchlistId: folder.id, name },
        );
        if (!isSuccessfulApiResponse(response.data)) {
          toast.error(
            getApiResponseMessage(response.data, "Unable to rename watchlist"),
          );
          return false;
        }
        toast.success("Watchlist renamed");
        await refreshFolders();
      }
      setFolderMode(null);
      setFolderName("");
      setConfirmDelete(false);
      return true;
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to save watchlist"));
      return false;
    } finally {
      setMutating(false);
    }
  }, [folderName, folderMode, folder, mutating, refreshFolders]);

  const deleteFolder = useCallback(async (): Promise<void> => {
    if (!folder || folder.isDefault || mutating) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setMutating(true);
    try {
      const response = await apiClient.delete<unknown>(
        "/api/watchlist/folders",
        { data: { watchlistId: folder.id } },
      );
      if (!isSuccessfulApiResponse(response.data)) {
        toast.error(
          getApiResponseMessage(response.data, "Unable to delete watchlist"),
        );
        return;
      }
      toast.success("Watchlist deleted");
      setFolderId(null);
      setConfirmDelete(false);
      await refreshFolders();
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to delete watchlist"));
    } finally {
      setMutating(false);
    }
  }, [folder, confirmDelete, mutating, refreshFolders]);

  const submitAdd = useCallback(async (): Promise<void> => {
    const symbol = addSymbol.trim().toUpperCase();
    if (!symbol || mutating) return;
    setMutating(true);
    try {
      await useWatchlistStore.getState().add({
        tradingSymbol: symbol,
        ltp: 0,
        category: "swing",
        listType: "normal",
        ...(folder ? { watchlistId: folder.id } : {}),
      });
      toast.success(
        folder ? `${symbol} added to ${folder.name}` : `${symbol} added`,
      );
      setAddSymbol("");
      setAdding(false);
      await refreshFolders();
      onSelect(symbol);
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to add symbol"));
    } finally {
      setMutating(false);
    }
  }, [addSymbol, folder, mutating, refreshFolders, onSelect]);

  const renderRow = (row: Row, removable: boolean) => {
    const up = row.change >= 0;
    const active = row.symbol === activeSymbol;
    return (
      <div
        key={row.symbol}
        className={`group/row relative grid w-full grid-cols-[1.4fr_1fr_0.8fr_0.8fr] items-center gap-1 px-3 py-2 text-left text-[12.5px] ${
          active ? "bg-primary/10" : "hover:bg-muted"
        }`}
      >
        <button
          type="button"
          onClick={() => onSelect(row.symbol)}
          aria-current={active ? "true" : undefined}
          className="col-span-4 grid grid-cols-subgrid items-center gap-1 text-left"
        >
          <span className="truncate font-semibold text-foreground">
            {row.symbol}
          </span>
          <span className="text-right font-mono text-foreground">
            {row.last > 0 ? formatNumber(row.last) : "—"}
          </span>
          <span
            className="text-right font-mono"
            style={{ color: up ? UP_COLOR : DOWN_COLOR }}
          >
            {row.last > 0 ? signed(row.change) : ""}
          </span>
          <span
            className="text-right font-mono"
            style={{ color: up ? UP_COLOR : DOWN_COLOR }}
          >
            {row.last > 0 ? `${signed(row.pct)}%` : ""}
          </span>
        </button>
        {removable && row.id && (
          <button
            type="button"
            aria-label={`Remove ${row.symbol} from watchlist`}
            title={`Remove ${row.symbol}`}
            disabled={mutating}
            onClick={() => void removeRow(row)}
            className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-error group-hover/row:block"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  const HEADERS: readonly { key: WatchlistSortKey; label: string }[] = [
    { key: "symbol", label: "Symbol" },
    { key: "last", label: "Last" },
    { key: "change", label: "Chg" },
    { key: "pct", label: "Chg%" },
  ];

  const renderHeader = () => (
    <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] gap-1 border-y border-border bg-muted px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
      {HEADERS.map((entry, index) => {
        const active = sort?.key === entry.key;
        const arrow = active ? (sort.dir === 1 ? " ↑" : " ↓") : "";
        return (
          <button
            key={entry.key}
            type="button"
            title={`Click to sort by ${entry.label}${active ? (sort.dir === 1 ? " ↑" : " ↓") : " ↑"}`}
            aria-label={`Sort by ${entry.label}`}
            onClick={() => setSort(cycleWatchlistSort(sort, entry.key))}
            className={`hover:text-primary ${index === 0 ? "text-left" : "text-right"} ${
              active ? "text-primary" : ""
            }`}
          >
            {entry.label}
            {arrow}
          </button>
        );
      })}
    </div>
  );

  const openFolderEditor = (mode: "create" | "rename"): void => {
    setFolderMode(mode);
    setFolderName(mode === "rename" ? (folder?.name ?? "") : "");
    setConfirmDelete(false);
  };

  return (
    <section aria-label="Watchlist" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <Menu
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="flex min-w-0 items-center gap-1 text-[14px] font-bold text-foreground"
            >
              <span className="truncate">{folder?.name ?? "Watchlist"}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}
        >
          {(close) => (
            <div className="w-56">
              {folderMode ? (
                <form
                  className="flex items-center gap-1.5 p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitFolder().then((saved) => {
                      if (saved) close();
                    });
                  }}
                >
                  <input
                    autoFocus
                    value={folderName}
                    onChange={(event) => setFolderName(event.target.value)}
                    placeholder={
                      folderMode === "create" ? "New list name" : "Rename list"
                    }
                    aria-label={
                      folderMode === "create" ? "New list name" : "Rename list"
                    }
                    maxLength={40}
                    className="min-w-0 flex-1 rounded border border-border px-2 py-1.5 text-[13px] outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={!folderName.trim() || mutating}
                    className="shrink-0 rounded bg-primary px-2.5 py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    {folderMode === "create" ? "Add" : "Save"}
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel"
                    onClick={() => {
                      setFolderMode(null);
                      setFolderName("");
                    }}
                    className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <>
                  {folders.length === 0 && (
                    <p className="px-3 py-2 text-[12px] text-muted-foreground">
                      No watchlists yet
                    </p>
                  )}
                  {folders.map((entry) => (
                    <MenuItem
                      key={entry.id}
                      active={entry.id === folder?.id}
                      onClick={() => {
                        setFolderId(entry.id);
                        setConfirmDelete(false);
                        close();
                      }}
                    >
                      <span className="flex-1 truncate">{entry.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {entry.rows.length}
                      </span>
                    </MenuItem>
                  ))}
                  <Divider vertical={false} />
                  <MenuItem onClick={() => openFolderEditor("create")}>
                    New watchlist
                  </MenuItem>
                  {folder && (
                    <MenuItem onClick={() => openFolderEditor("rename")}>
                      Rename &ldquo;{folder.name}&rdquo;
                    </MenuItem>
                  )}
                  {folder && !folder.isDefault && (
                    <MenuItem
                      onClick={() => {
                        void deleteFolder().then(() => {
                          if (!confirmDelete) return;
                          close();
                        });
                      }}
                      className={
                        confirmDelete ? "font-semibold text-error" : undefined
                      }
                    >
                      {confirmDelete
                        ? `Click again to delete "${folder.name}"`
                        : `Delete "${folder.name}"`}
                    </MenuItem>
                  )}
                </>
              )}
            </div>
          )}
        </Menu>
        <button
          type="button"
          aria-label="Add symbol to watchlist"
          title="Add symbol"
          onClick={() => {
            setAdding((current) => !current);
            setAddSymbol("");
          }}
          className={`rounded p-1.5 hover:bg-muted ${
            adding ? "bg-primary/10 text-primary" : "text-muted-foreground"
          }`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {adding && (
        <form
          className="flex items-center gap-1.5 px-3 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAdd();
          }}
        >
          <input
            autoFocus
            value={addSymbol}
            onChange={(event) => setAddSymbol(event.target.value.toUpperCase())}
            placeholder="Symbol, e.g. RELIANCE"
            aria-label="Symbol to add"
            className="min-w-0 flex-1 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[12.5px] uppercase text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <button
            type="submit"
            disabled={!addSymbol.trim() || mutating}
            className="shrink-0 rounded bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            Add
          </button>
        </form>
      )}

      <div className="px-3 pb-2">
        <input
          id="watchlist-filter"
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter symbols"
          aria-label="Filter watchlist symbols"
          className="w-full rounded-md border border-border bg-muted px-2.5 py-1.5 text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      {renderHeader()}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibleIndices.length > 0 && (
          <>
            <p className="px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              Indices
            </p>
            {visibleIndices.map((row) => renderRow(row, false))}
          </>
        )}
        <p className="px-3 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
          {folder ? "Stocks" : "Recent"}
        </p>
        {folder && visibleStocks.length > 0 ? (
          visibleStocks.map((row) => renderRow(row, true))
        ) : folder && folder.rows.length > 0 ? (
          <p className="px-3 py-3 text-[12px] text-muted-foreground">
            No symbols match &ldquo;{filter.trim()}&rdquo;.
          </p>
        ) : folder ? (
          <p className="px-3 py-3 text-[12px] text-muted-foreground">
            This watchlist is empty. Add a symbol with the + button above.
          </p>
        ) : failed ? (
          <p className="px-3 py-3 text-[12px] text-muted-foreground">
            Couldn&apos;t load your watchlist.
          </p>
        ) : recents.length > 0 ? (
          recents.map((recent) =>
            renderRow(
              {
                symbol: recent.symbol,
                last: recent.last,
                change: 0,
                pct: recent.pct,
                id: null,
              },
              false,
            ),
          )
        ) : (
          <p className="px-3 py-3 text-[12px] text-muted-foreground">
            Search a symbol to get started.
          </p>
        )}
        {visibleFutures.length > 0 && (
          <>
            <p className="px-3 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              Futures
            </p>
            {visibleFutures.map((row) => renderRow(row, false))}
          </>
        )}
      </div>
    </section>
  );
}

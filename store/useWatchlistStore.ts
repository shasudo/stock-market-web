import { create } from "zustand";
import apiClient, {
  getApiResponseMessage,
  isRecord,
  isSuccessfulApiResponse,
} from "@/lib/api-client";
import type { WatchlistCategory } from "@/types";
import type { WatchlistListType } from "@/lib/validations/watchlist";

export interface WatchlistStockEntry {
  readonly id: string;
  readonly tradingSymbol: string;
  readonly category: WatchlistCategory;
  readonly listType: WatchlistListType;
}

export interface AddWatchlistStockInput {
  readonly tradingSymbol: string;
  readonly sector?: string;
  readonly industry?: string;
  readonly ltp: number;
  readonly category: WatchlistCategory;
  readonly listType: WatchlistListType;
  /** Omit to add to the user's default folder. */
  readonly watchlistId?: string;
}

/** A watchlist folder, as the three-dot menu needs to know it. */
export interface WatchlistFolder {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
}

interface WatchlistState {
  entriesByKey: Map<string, WatchlistStockEntry[]>;
  folders: WatchlistFolder[];
  loaded: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  ensureLoaded: () => Promise<void>;
  isWatched: (symbol: string, listType: WatchlistListType) => boolean;
  getEntries: (
    symbol: string,
    listType: WatchlistListType,
  ) => WatchlistStockEntry[];
  add: (input: AddWatchlistStockInput) => Promise<void>;
  removeAllForSymbol: (
    symbol: string,
    listType: WatchlistListType,
  ) => Promise<void>;
}

function isWatchlistFolder(value: unknown): value is WatchlistFolder {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.isDefault === "boolean"
  );
}

function extractFolders(responseData: unknown): WatchlistFolder[] {
  if (!isSuccessfulApiResponse(responseData) || !isRecord(responseData.data)) {
    return [];
  }

  const watchlists = responseData.data.watchlists;
  return Array.isArray(watchlists)
    ? watchlists.filter(isWatchlistFolder).map(({ id, name, isDefault }) => ({
        id,
        name,
        isDefault,
      }))
    : [];
}

function isWatchlistStockEntry(value: unknown): value is WatchlistStockEntry {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.tradingSymbol === "string" &&
    typeof value.category === "string" &&
    typeof value.listType === "string"
  );
}

function extractStocks(responseData: unknown): WatchlistStockEntry[] {
  if (!isSuccessfulApiResponse(responseData) || !isRecord(responseData.data)) {
    return [];
  }

  const watchlists = responseData.data.watchlists;
  if (Array.isArray(watchlists)) {
    return watchlists.flatMap((folder) => {
      const stocks = isRecord(folder) ? folder.stocks : undefined;
      return Array.isArray(stocks) ? stocks.filter(isWatchlistStockEntry) : [];
    });
  }

  const watchlist = responseData.data.watchlist;
  const stocks = isRecord(watchlist) ? watchlist.stocks : undefined;
  return Array.isArray(stocks) ? stocks.filter(isWatchlistStockEntry) : [];
}

// Every row is keyed by symbol+listType, not just symbol - a stock can sit in
// the normal watchlist and the preposition watchlist independently, and each
// board's membership must be tracked (and toggled) separately.
function entryKey(symbol: string, listType: WatchlistListType): string {
  return `${symbol.toUpperCase()}|${listType}`;
}

function toEntriesByKey(
  stocks: readonly WatchlistStockEntry[],
): Map<string, WatchlistStockEntry[]> {
  const map = new Map<string, WatchlistStockEntry[]>();
  for (const stock of stocks) {
    const key = entryKey(stock.tradingSymbol, stock.listType);
    const existing = map.get(key);
    if (existing) {
      existing.push(stock);
    } else {
      map.set(key, [stock]);
    }
  }
  return map;
}

function countEntries(
  entriesByKey: Map<string, WatchlistStockEntry[]>,
): number {
  let total = 0;
  for (const entries of entriesByKey.values()) {
    total += entries.length;
  }
  return total;
}

// Shared across every stock row's three-dot menu so watchlist membership is
// fetched once (not once per row) and every menu reflects add/remove
// immediately without a page reload.
export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  entriesByKey: new Map(),
  folders: [],
  loaded: false,
  loading: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const response = await apiClient.get<unknown>("/api/watchlist");
      set({
        entriesByKey: toEntriesByKey(extractStocks(response.data)),
        folders: extractFolders(response.data),
        loaded: true,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  ensureLoaded: async () => {
    if (get().loaded || get().loading) {
      return;
    }
    await get().refresh();
  },

  isWatched: (symbol, listType) =>
    (get().entriesByKey.get(entryKey(symbol, listType))?.length ?? 0) > 0,

  getEntries: (symbol, listType) =>
    get().entriesByKey.get(entryKey(symbol, listType)) ?? [],

  add: async (input) => {
    const ltp = input.ltp > 0 ? input.ltp : 0;
    // Only LTP is known at add time. Entry, stop loss and the three targets
    // are the user's own calls, so they are left unset (0) to be typed in on
    // the watchlist rather than guessed from a ±5% band.
    const response = await apiClient.post<unknown>("/api/watchlist", {
      sNo: countEntries(get().entriesByKey) + 1,
      date: new Date().toISOString(),
      sourceFrom: "Quick Add",
      segments: "NSE",
      tradingSymbol: input.tradingSymbol.toUpperCase(),
      sector: input.sector?.trim() || "-",
      industry: input.industry?.trim() || "-",
      ltp,
      redFlags: "",
      note: "",
      category: input.category,
      listType: input.listType,
      ...(input.watchlistId ? { watchlistId: input.watchlistId } : {}),
    });

    if (!isSuccessfulApiResponse(response.data)) {
      throw new Error(
        getApiResponseMessage(response.data, "Unable to add to watchlist"),
      );
    }

    await get().refresh();
  },

  removeAllForSymbol: async (symbol, listType) => {
    for (const entry of get().getEntries(symbol, listType)) {
      const response = await apiClient.delete<unknown>("/api/watchlist", {
        data: { stockId: entry.id },
      });
      if (!isSuccessfulApiResponse(response.data)) {
        throw new Error(
          getApiResponseMessage(
            response.data,
            "Unable to remove from watchlist",
          ),
        );
      }
    }

    await get().refresh();
  },
}));

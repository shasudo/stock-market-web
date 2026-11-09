"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Search,
  ChevronDown,
  Table as TableIcon,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Trash2,
} from "lucide-react";
import LiveCandleChart from "@/components/chart/LiveCandleChart";
import { StockActionsMenu } from "@/components/common";
import type { WatchlistCategory } from "@/types";
import type { WatchlistListType } from "@/lib/validations/watchlist";

export interface WatchlistStockData {
  id: string;
  sNo: number;
  date: string;
  sourceFrom: string;
  segments: string;
  tradingSymbol: string;
  sector: string;
  industry: string;
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

export interface WatchlistFolderData {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly stocks: WatchlistStockData[];
}

interface WatchlistChartViewProps {
  folders: readonly WatchlistFolderData[];
  activeFolderId: string | null;
  onSelectFolder: (id: string) => void;
  activeCategory: WatchlistCategory;
  onSelectCategory: (category: WatchlistCategory) => void;
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onBackToTable: () => void;
  onRemoveStock?: (id: string) => Promise<void>;
  listType?: WatchlistListType;
}

const CATEGORY_CHIPS: { id: WatchlistCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "intraday", label: "Intraday" },
  { id: "swing", label: "Swing" },
  { id: "positional", label: "Positional" },
  { id: "multibagger", label: "Multi Bagger" },
];

export default function WatchlistChartView({
  folders,
  activeFolderId,
  onSelectFolder,
  activeCategory,
  onSelectCategory,
  activeSymbol,
  onSelectSymbol,
  onBackToTable,
  onRemoveStock,
  listType = "normal",
}: WatchlistChartViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    WatchlistCategory | "all"
  >(activeCategory);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);

  const activeFolder =
    folders.find((f) => f.id === activeFolderId) ?? folders[0] ?? null;

  // Filter stocks according to folder, category chip, and search query
  const folderStocks = useMemo(() => {
    return (activeFolder?.stocks ?? []).filter((s) => s.listType === listType);
  }, [activeFolder, listType]);

  const filteredStocks = useMemo(() => {
    return folderStocks.filter((stock) => {
      const matchesCategory =
        categoryFilter === "all" || stock.category === categoryFilter;
      if (!matchesCategory) return false;

      if (!filterQuery.trim()) return true;
      const q = filterQuery.toLowerCase();
      return (
        stock.tradingSymbol.toLowerCase().includes(q) ||
        stock.sector.toLowerCase().includes(q) ||
        stock.industry.toLowerCase().includes(q)
      );
    });
  }, [folderStocks, categoryFilter, filterQuery]);

  // Find currently active stock object
  const activeStock = useMemo(() => {
    const found = folderStocks.find(
      (s) =>
        s.tradingSymbol.toUpperCase() === activeSymbol.toUpperCase(),
    );
    return found ?? filteredStocks[0] ?? folderStocks[0] ?? null;
  }, [folderStocks, filteredStocks, activeSymbol]);

  // Safe fallback calculation for change and pctChange
  function getStockChanges(stock: WatchlistStockData) {
    let net = stock.netChange ?? 0;
    let pct = stock.pctChange ?? 0;

    if (net === 0 && pct === 0 && stock.prevClose && stock.prevClose > 0) {
      net = stock.ltp - stock.prevClose;
      pct = (net / stock.prevClose) * 100;
    }

    const isPositive = net > 0;
    const isNegative = net < 0;

    return { net, pct, isPositive, isNegative };
  }

  const selectedChanges = activeStock ? getStockChanges(activeStock) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Top Chart Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/90 bg-card/90 p-3 backdrop-blur-xl shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onBackToTable}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
            title="Switch back to table view"
          >
            <TableIcon className="h-3.5 w-3.5 text-primary" />
            <span>Table View</span>
          </button>

          <span className="text-muted-foreground">|</span>

          {/* Active Stock Badge */}
          {activeStock && (
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm md:text-base text-foreground tracking-tight">
                {activeStock.tradingSymbol}
              </span>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-bold text-primary border border-primary/20">
                {activeStock.exchange || "NSE"}
              </span>
              <span className="font-mono text-sm font-bold text-foreground">
                ₹{activeStock.ltp.toFixed(2)}
              </span>
              {selectedChanges && (
                <span
                  className={`inline-flex items-center text-xs font-mono font-bold ${
                    selectedChanges.isPositive
                      ? "text-[#34C759]"
                      : selectedChanges.isNegative
                        ? "text-[#FF3B30]"
                        : "text-muted-foreground"
                  }`}
                >
                  {selectedChanges.isPositive ? (
                    <TrendingUp className="mr-0.5 h-3.5 w-3.5" />
                  ) : selectedChanges.isNegative ? (
                    <TrendingDown className="mr-0.5 h-3.5 w-3.5" />
                  ) : null}
                  {selectedChanges.net >= 0 ? "+" : ""}
                  {selectedChanges.net.toFixed(2)} (
                  {selectedChanges.pct >= 0 ? "+" : ""}
                  {selectedChanges.pct.toFixed(2)}%)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right action controls */}
        <div className="flex items-center gap-2">
          {activeStock && (
            <Link
              href={`/chart/${encodeURIComponent(activeStock.tradingSymbol)}`}
              className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
              title="Open the full chart terminal with drawing tools and indicators"
            >
              <span>Full chart</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {activeStock && (
            <Link
              href={`/stock/${encodeURIComponent(activeStock.tradingSymbol)}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-xl bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Open full stock summary"
            >
              <span>Stock Details</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}

          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            title={sidebarOpen ? "Hide watchlist panel" : "Show watchlist panel"}
          >
            {sidebarOpen ? (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>Hide Watchlist</span>
              </>
            ) : (
              <>
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Show Watchlist</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Dual Layout: Chart on Left, Watchlist Sidebar on Right */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch min-h-[640px] h-[calc(100vh-210px)] max-h-[960px]">
        {/* Left Area: live candlestick chart */}
        <div className="flex-1 min-w-0 h-full rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden">
          <LiveCandleChart
            symbol={activeStock?.tradingSymbol ?? "NIFTY"}
            exchange={activeStock?.exchange ?? "NSE"}
            height="100%"
            className="h-full w-full"
          />
        </div>

        {/* Right Area: Watchlist Sidebar Panel (Matching FYERS Screenshot) */}
        {sidebarOpen && (
          <aside className="w-full lg:w-88 xl:w-96 shrink-0 h-full flex flex-col rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden">
            {/* Sidebar Top: Folder Dropdown & Search */}
            <div className="p-3 border-b border-border/90 bg-muted/80 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                {/* Watchlist Folder Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFolderMenuOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 rounded-xl bg-card px-3 py-1.5 text-xs font-bold text-foreground border border-border shadow-2xs hover:bg-muted"
                  >
                    <span className="max-w-[140px] truncate">
                      {activeFolder?.name ?? "Watchlist"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>

                  {folderMenuOpen && (
                    <div className="absolute left-0 top-full mt-1 z-30 w-52 rounded-xl border border-border bg-card p-1 shadow-lg">
                      {folders.map((folder) => {
                        const count = folder.stocks.filter(
                          (s) => s.listType === listType,
                        ).length;
                        return (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => {
                              onSelectFolder(folder.id);
                              setFolderMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-left font-medium transition-colors ${
                              folder.id === activeFolderId
                                ? "bg-primary/10 text-primary font-bold"
                                : "text-foreground hover:bg-muted"
                            }`}
                          >
                            <span className="truncate">{folder.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({count})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <span className="text-[11px] font-mono font-semibold text-muted-foreground">
                  {filteredStocks.length} symbols
                </span>
              </div>

              {/* Quick Filter Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter stocks..."
                  className="w-full rounded-xl border border-border/90 bg-card py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {CATEGORY_CHIPS.map((chip) => {
                  const isActive = categoryFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        setCategoryFilter(chip.id);
                        if (chip.id !== "all") {
                          onSelectCategory(chip.id);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-tight whitespace-nowrap transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "bg-card text-muted-foreground border border-border/90 hover:text-foreground"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sidebar Column Headers (Symbol, Last, Chg, Chg%) */}
            <div className="grid grid-cols-12 px-3 py-2 bg-muted/90 border-b border-border/90 text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
              <span className="col-span-5">Symbol</span>
              <span className="col-span-3 text-right">Last</span>
              <span className="col-span-2 text-right">Chg</span>
              <span className="col-span-2 text-right">Chg%</span>
            </div>

            {/* Stock Rows List */}
            <div className="flex-1 overflow-y-auto divide-y divide-black/[0.03]">
              {filteredStocks.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No stocks match filter.
                </div>
              ) : (
                filteredStocks.map((stock) => {
                  const isSelected =
                    activeStock?.tradingSymbol.toUpperCase() ===
                    stock.tradingSymbol.toUpperCase();
                  const { net, pct, isPositive, isNegative } =
                    getStockChanges(stock);

                  return (
                    <div
                      key={stock.id}
                      onClick={() => onSelectSymbol(stock.tradingSymbol)}
                      className={`grid grid-cols-12 items-center px-3 py-2.5 cursor-pointer text-xs transition-colors select-none group ${
                        isSelected
                          ? "bg-primary/[0.08] border-l-3 border-primary"
                          : "hover:bg-muted even:bg-muted/75"
                      }`}
                    >
                      {/* Symbol & Exchange */}
                      <div className="col-span-5 flex items-center gap-1.5 min-w-0 pr-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isPositive
                              ? "bg-[#34C759]"
                              : isNegative
                                ? "bg-[#FF3B30]"
                                : "bg-gray-300"
                          }`}
                        />
                        <span
                          className={`truncate font-semibold ${
                            isSelected ? "text-primary font-bold" : "text-foreground"
                          }`}
                        >
                          {stock.tradingSymbol}
                        </span>
                      </div>

                      {/* Last Price */}
                      <div className="col-span-3 text-right font-mono font-medium text-foreground">
                        {stock.ltp.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>

                      {/* Net Change */}
                      <div
                        className={`col-span-2 text-right font-mono text-[11px] font-semibold ${
                          isPositive
                            ? "text-[#34C759]"
                            : isNegative
                              ? "text-[#FF3B30]"
                              : "text-muted-foreground"
                        }`}
                      >
                        {net >= 0 ? "+" : ""}
                        {net.toFixed(2)}
                      </div>

                      {/* Pct Change */}
                      <div
                        className={`col-span-2 text-right font-mono text-[11px] font-semibold ${
                          isPositive
                            ? "text-[#34C759]"
                            : isNegative
                              ? "text-[#FF3B30]"
                              : "text-muted-foreground"
                        }`}
                      >
                        {pct >= 0 ? "+" : ""}
                        {pct.toFixed(2)}%
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Bottom: Active Stock Details Panel */}
            {activeStock && (
              <div className="border-t border-border/90 bg-[#F5F5F7]/60 p-3 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-xs text-foreground">
                        {activeStock.tradingSymbol}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {activeStock.exchange || "NSE"}
                      </span>
                    </div>
                    {activeStock.sector && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                        {activeStock.sector}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {onRemoveStock && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onRemoveStock(activeStock.id);
                        }}
                        className="p-1 rounded-md text-muted-foreground hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <StockActionsMenu
                      stock={{
                        symbol: activeStock.tradingSymbol,
                        name: activeStock.tradingSymbol,
                        ltp: activeStock.ltp,
                        sector: activeStock.sector,
                        industry: activeStock.industry,
                      }}
                      source="watchlist"
                      className="p-1 hover:bg-black/[0.06] rounded"
                    />
                  </div>
                </div>

                {/* Levels & Targets summary if configured */}
                {(activeStock.entryPrice > 0 ||
                  activeStock.target1 > 0 ||
                  activeStock.stopLoss > 0) && (
                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border text-[10px] font-mono">
                    {activeStock.entryPrice > 0 && (
                      <div className="bg-card rounded-md p-1 border border-border text-center">
                        <span className="text-muted-foreground block text-[9px] uppercase font-bold">
                          Entry
                        </span>
                        <span className="font-bold text-foreground">
                          ₹{activeStock.entryPrice.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {activeStock.stopLoss > 0 && (
                      <div className="bg-card rounded-md p-1 border border-border text-center">
                        <span className="text-[#FF3B30] block text-[9px] uppercase font-bold">
                          SL
                        </span>
                        <span className="font-bold text-[#FF3B30]">
                          ₹{activeStock.stopLoss.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {activeStock.target1 > 0 && (
                      <div className="bg-card rounded-md p-1 border border-border text-center">
                        <span className="text-[#34C759] block text-[9px] uppercase font-bold">
                          TGT 1
                        </span>
                        <span className="font-bold text-[#34C759]">
                          ₹{activeStock.target1.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Activity,
  BarChart2,
  TrendingUp,
  Zap,
  FolderInput,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  StockActionsMenu,
  SearchInput,
  TabCount,
  LevelCell,
  PickerMenu,
  ColumnVisibilityMenu,
  loadHiddenColumns,
  saveHiddenColumns,
  matchesSearch,
  type PickerMenuItem,
} from "@/components/common";
import { daysSince } from "@/lib/format";
import apiClient, {
  getApiResponseMessage,
  getAxiosErrorMessage,
  isRecord,
  isSuccessfulApiResponse,
} from "@/lib/api-client";
import type { WatchlistCategory } from "@/types";
import type {
  TradeLevelField,
  TradeMode,
} from "@/lib/validations/portfolio-trades";

interface Trade {
  readonly id: string;
  readonly tradingType: WatchlistCategory;
  readonly openedAt: string;
  readonly sourceFrom: string;
  readonly instrument: string;
  readonly tradingSymbol: string;
  readonly sector: string;
  readonly industry: string;
  readonly quantity: number;
  readonly entryPrice: number;
  readonly stopLoss: number;
  readonly target1: number;
  readonly target2: number;
  readonly target3: number;
  readonly exitPrice: number;
  readonly note: string;
  readonly redFlags: string;
  readonly ltp: number;
  readonly exchange: string;
  readonly segment: string;
  readonly group: string;
  readonly priceBand: string;
  readonly marketCap: string;
  readonly corporateAction: string | null;
}

function isTrade(value: unknown): value is Trade {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.tradingType === "string" &&
    typeof value.openedAt === "string" &&
    typeof value.tradingSymbol === "string" &&
    typeof value.quantity === "number" &&
    typeof value.entryPrice === "number" &&
    typeof value.ltp === "number"
  );
}

function extractTrades(responseData: unknown): Trade[] | null {
  if (!isSuccessfulApiResponse(responseData) || !isRecord(responseData.data)) {
    return null;
  }
  const trades = responseData.data.trades;
  return Array.isArray(trades) ? trades.filter(isTrade) : null;
}

async function requestTrades(mode: TradeMode): Promise<Trade[] | null> {
  const response = await apiClient.get<unknown>(`/api/trades?mode=${mode}`);
  return extractTrades(response.data);
}

const tabs: {
  id: WatchlistCategory;
  label: string;
  icon: LucideIcon;
  isSpecial: boolean;
}[] = [
  { id: "intraday", label: "Intraday Trading", icon: Clock, isSpecial: false },
  { id: "fno", label: "F&O Trading", icon: TrendingUp, isSpecial: false },
  { id: "swing", label: "Swing Trading", icon: Activity, isSpecial: false },
  {
    id: "positional",
    label: "Positional Trading",
    icon: BarChart2,
    isSpecial: false,
  },
  {
    id: "multibagger",
    label: "Multi Bagger Stocks",
    icon: Zap,
    isSpecial: true,
  },
];

// Order matches the sheet the user asked to match. Board meeting, latest
// news, candlestick pattern, and chart pattern have no data source wired
// into this app (same call as the watchlist's board-meeting/latest-news
// columns) - they render as placeholders so the layout matches without
// fabricating a feed.
const TRADE_COLUMN_ORDER = [
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
  "corporate",
  "latestNews",
  "ltp",
  "moveTo",
  "candlestickPattern",
  "chartPattern",
  "qty",
  "entryPrice",
  "stopLoss",
  "target1",
  "target2",
  "target3",
  "exit",
  "pnl",
  "note",
  "redFlags",
];

const TRADE_COLUMN_LABELS: Record<string, string> = {
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
  corporate: "Corporate",
  latestNews: "Latest News",
  ltp: "LTP",
  moveTo: "Move to",
  candlestickPattern: "Candlestick Pattern",
  chartPattern: "Chart Pattern",
  qty: "Qty",
  entryPrice: "Entry Price",
  stopLoss: "Stop Loss",
  target1: "Target 1",
  target2: "Target 2",
  target3: "Target 3",
  exit: "Exit",
  pnl: "P&L",
  note: "Note",
  redFlags: "Red Flags",
};

const TRADE_COLUMN_ALIGN: Record<string, "left" | "right"> = {
  days: "right",
  marketCap: "right",
  ltp: "right",
  qty: "right",
  entryPrice: "right",
  stopLoss: "right",
  target1: "right",
  target2: "right",
  target3: "right",
  exit: "right",
  pnl: "right",
};

const TRADING_TYPE_PICKER_ITEMS: readonly PickerMenuItem[] = tabs.map(
  (tab) => ({ id: tab.id, label: tab.label }),
);

/** Realized once an exit is entered; unrealized against LTP until then. */
function tradePnL(trade: Trade): { amount: number; percent: number } {
  const exitOrLtp = trade.exitPrice > 0 ? trade.exitPrice : trade.ltp;
  const amount = (exitOrLtp - trade.entryPrice) * trade.quantity;
  const invested = trade.entryPrice * trade.quantity;
  return { amount, percent: invested > 0 ? (amount / invested) * 100 : 0 };
}

interface TradingBoardProps {
  mode: TradeMode;
  title: string;
  description: string;
  icon: LucideIcon;
}

export function TradingBoard({
  mode,
  title,
  description,
  icon: Icon,
}: TradingBoardProps) {
  const [activeTab, setActiveTab] = useState<WatchlistCategory>("intraday");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() =>
    loadHiddenColumns(`trades-${mode}-hidden-columns`),
  );

  useEffect(() => {
    saveHiddenColumns(`trades-${mode}-hidden-columns`, hiddenColumns);
  }, [mode, hiddenColumns]);

  const toggleColumn = (key: string): void => {
    setHiddenColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    let isCurrent = true;

    void requestTrades(mode)
      .then((loaded) => {
        if (!isCurrent) return;
        if (loaded === null) {
          toast.error("Received an invalid trades response");
          return;
        }
        setTrades(loaded);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          toast.error(
            getAxiosErrorMessage(error, `Failed to load ${mode} trades`),
          );
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [mode]);

  const handleDelete = async (id: string): Promise<void> => {
    try {
      const response = await apiClient.delete<unknown>("/api/trades", {
        data: { id },
      });
      if (isSuccessfulApiResponse(response.data)) {
        toast.success("Trade removed");
        setTrades((current) => current.filter((trade) => trade.id !== id));
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to remove trade"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to remove trade"));
    }
  };

  const handleLevelChange = async (
    id: string,
    field: TradeLevelField,
    value: number,
  ): Promise<void> => {
    try {
      const response = await apiClient.patch<unknown>("/api/trades/levels", {
        id,
        mode,
        field,
        value,
      });
      if (isSuccessfulApiResponse(response.data)) {
        const loaded = extractTrades(response.data);
        if (loaded) setTrades(loaded);
      } else {
        toast.error(getApiResponseMessage(response.data, "Unable to save"));
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to save"));
    }
  };

  const handleMove = async (id: string, tradingType: string): Promise<void> => {
    try {
      const response = await apiClient.patch<unknown>("/api/trades", {
        id,
        mode,
        tradingType,
      });
      if (isSuccessfulApiResponse(response.data)) {
        const loaded = extractTrades(response.data);
        if (loaded) setTrades(loaded);
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to move trade"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to move trade"));
    }
  };

  function renderCell(key: string, trade: Trade, index: number): ReactNode {
    switch (key) {
      case "sNo":
        return (
          <td className="px-4 py-3 text-xs font-medium text-foreground">
            {index + 1}
          </td>
        );
      case "date":
        return (
          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
            {trade.openedAt.slice(0, 10)}
          </td>
        );
      case "days":
        return (
          <td className="px-4 py-3 text-xs text-right text-muted-foreground whitespace-nowrap">
            {daysSince(trade.openedAt)}
          </td>
        );
      case "sourceFrom":
        return (
          <td className="px-4 py-3 text-xs text-muted-foreground">
            {trade.sourceFrom}
          </td>
        );
      case "exchange":
        return (
          <td className="px-4 py-3 text-xs text-muted-foreground">
            {trade.exchange}
          </td>
        );
      case "segments":
        return (
          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
            {trade.segment}
          </td>
        );
      case "symbol":
        return (
          <td className="px-4 py-3 text-xs font-semibold text-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>{trade.tradingSymbol}</span>
              <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <StockActionsMenu
                  stock={{
                    symbol: trade.tradingSymbol,
                    name: trade.tradingSymbol,
                    ltp: trade.ltp,
                    sector: trade.sector,
                    industry: trade.industry,
                  }}
                  source={mode}
                />
              </div>
            </div>
          </td>
        );
      case "sector":
        return (
          <td className="px-4 py-3 text-xs text-muted-foreground">
            {trade.sector}
          </td>
        );
      case "industry":
        return (
          <td className="px-4 py-3 text-xs text-muted-foreground">
            {trade.industry}
          </td>
        );
      case "group":
        return (
          <td className="px-4 py-3 text-xs text-muted-foreground">
            {trade.group}
          </td>
        );
      case "priceBand":
        return (
          <td className="px-4 py-3 text-xs text-muted-foreground">
            {trade.priceBand}
          </td>
        );
      case "marketCap":
        return (
          <td className="px-4 py-3 text-xs font-mono text-right text-muted-foreground">
            {trade.marketCap}
          </td>
        );
      // No data source for these three - see the column-order comment above.
      case "boardMeeting":
      case "latestNews":
      case "candlestickPattern":
      case "chartPattern":
        return <td className="px-4 py-3 text-xs text-muted-foreground">-</td>;
      case "corporate":
        return (
          <td
            className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate"
            title={trade.corporateAction ?? undefined}
          >
            {trade.corporateAction ?? "-"}
          </td>
        );
      case "ltp":
        return (
          <td className="px-4 py-3 text-xs font-mono text-right font-semibold text-foreground">
            ₹{trade.ltp.toFixed(2)}
          </td>
        );
      case "moveTo":
        return (
          <td className="px-4 py-3">
            <div className="flex items-center gap-1">
              <PickerMenu
                items={TRADING_TYPE_PICKER_ITEMS}
                excludeId={trade.tradingType}
                icon={FolderInput}
                label={`Move ${trade.tradingSymbol} to another trading style`}
                onPick={(tradingType) => void handleMove(trade.id, tradingType)}
              />
              <button
                onClick={() => void handleDelete(trade.id)}
                aria-label={`Remove ${trade.tradingSymbol} position`}
                className="p-1.5 text-muted-foreground hover:text-error hover:bg-error/10 rounded-md transition-all"
                title="Remove position"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        );
      case "qty":
        return (
          <td className="px-4 py-3 text-xs text-right text-foreground font-medium">
            {trade.quantity}
          </td>
        );
      case "entryPrice":
        return (
          <LevelCell
            value={trade.entryPrice}
            reference={trade.ltp}
            label={`Entry price for ${trade.tradingSymbol}`}
            tone="neutral"
            onSave={(value) => handleLevelChange(trade.id, "entryPrice", value)}
          />
        );
      case "stopLoss":
        return (
          <LevelCell
            value={trade.stopLoss}
            reference={trade.ltp}
            label={`Stop loss for ${trade.tradingSymbol}`}
            tone="loss"
            onSave={(value) => handleLevelChange(trade.id, "stopLoss", value)}
          />
        );
      case "target1":
        return (
          <LevelCell
            value={trade.target1}
            reference={trade.ltp}
            label={`Target 1 for ${trade.tradingSymbol}`}
            tone="gain"
            onSave={(value) => handleLevelChange(trade.id, "target1", value)}
          />
        );
      case "target2":
        return (
          <LevelCell
            value={trade.target2}
            reference={trade.ltp}
            label={`Target 2 for ${trade.tradingSymbol}`}
            tone="gain"
            onSave={(value) => handleLevelChange(trade.id, "target2", value)}
          />
        );
      case "target3":
        return (
          <LevelCell
            value={trade.target3}
            reference={trade.ltp}
            label={`Target 3 for ${trade.tradingSymbol}`}
            tone="gain"
            onSave={(value) => handleLevelChange(trade.id, "target3", value)}
          />
        );
      case "exit":
        return (
          <LevelCell
            value={trade.exitPrice}
            reference={trade.ltp}
            label={`Exit price for ${trade.tradingSymbol}`}
            tone="neutral"
            onSave={(value) => handleLevelChange(trade.id, "exitPrice", value)}
          />
        );
      case "pnl": {
        const { amount, percent } = tradePnL(trade);
        const positive = amount >= 0;
        return (
          <td className="px-3.5 py-2.5 whitespace-nowrap">
            <div className="flex flex-col items-end gap-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-mono border num-font ${
                  positive
                    ? "bg-success/10 text-success border-success/30"
                    : "bg-error/10 text-error border-error/30"
                }`}
              >
                {positive ? (
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                )}
                ₹{Math.abs(amount).toFixed(2)}
              </span>
              <span
                className={`text-[10px] font-mono font-bold num-font pr-1 ${positive ? "text-emerald-600" : "text-error"}`}
              >
                {positive ? "+" : ""}
                {percent.toFixed(2)}%
              </span>
            </div>
          </td>
        );
      }
      case "note":
        return (
          <td
            className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate"
            title={trade.note}
          >
            {trade.note || "-"}
          </td>
        );
      case "redFlags":
        return (
          <td className="px-4 py-3 text-xs">
            {trade.redFlags ? (
              <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded bg-error/10 text-error">
                {trade.redFlags}
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

  const tradesInTab = trades.filter((trade) => trade.tradingType === activeTab);
  const visibleTrades = tradesInTab.filter((trade) =>
    matchesSearch(
      search,
      trade.tradingSymbol,
      trade.sector,
      trade.industry,
      trade.instrument,
    ),
  );
  const visibleColumns = TRADE_COLUMN_ORDER.filter(
    (key) => !hiddenColumns.has(key),
  );

  const totalPnL = tradesInTab.reduce(
    (sum, trade) => sum + tradePnL(trade).amount,
    0,
  );
  const totalInvestment = tradesInTab.reduce(
    (sum, trade) => sum + trade.entryPrice * trade.quantity,
    0,
  );
  const totalPnLPercent =
    totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 py-8 md:px-6 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Icon className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground">
                {title}
              </h1>
              <p className="text-lg text-muted-foreground mt-1">
                {description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap mb-6">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              const count = trades.filter(
                (trade) => trade.tradingType === tab.id,
              ).length;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                      : "text-muted-foreground hover:bg-muted hover:text-muted-foreground flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                  }`}
                >
                  <TabIcon
                    className={`w-4 h-4 ${tab.isSpecial ? "text-[#FF3B30]" : ""}`}
                  />
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                      isActive
                        ? "bg-white/25 dark:bg-zinc-950/10 text-white dark:text-zinc-950"
                        : "bg-slate-200/80 text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border bg-muted/80 flex flex-wrap items-center justify-between gap-3">
            <h2
              className={`text-sm md:text-base font-extrabold capitalize flex items-center gap-2 ${activeTab === "multibagger" ? "text-error" : "text-foreground"}`}
            >
              {activeTab === "multibagger" && (
                <Zap className="w-4 h-4 fill-current" />
              )}
              {tabs.find((tab) => tab.id === activeTab)?.label} Positions
            </h2>
            <div className="flex items-center gap-2.5 flex-wrap">
              <ColumnVisibilityMenu
                columnOrder={TRADE_COLUMN_ORDER}
                columnLabels={TRADE_COLUMN_LABELS}
                hiddenColumns={hiddenColumns}
                onToggle={toggleColumn}
              />
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search symbol, sector, instrument..."
                className="relative w-full sm:w-64"
                inputClassName="w-full rounded-xl border border-border bg-card py-1.5 pl-7 pr-7 text-xs md:text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none shadow-xs"
              />
              <div className="whitespace-nowrap text-xs text-muted-foreground font-medium">
                <span className="font-bold text-foreground">
                  {visibleTrades.length}
                </span>{" "}
                {search.trim() ? `of ${tradesInTab.length} ` : ""}positions
              </div>
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs md:text-sm min-w-[1450px]">
              <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
                <tr>
                  {visibleColumns.map((key) => (
                    <th
                      key={key}
                      className={`px-4 py-3.5 text-${TRADE_COLUMN_ALIGN[key] ?? "left"} text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] select-none`}
                    >
                      {TRADE_COLUMN_LABELS[key]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {loading && (
                  <tr>
                    <td
                      colSpan={visibleColumns.length}
                      className="px-6 py-20 text-center text-xs text-muted-foreground font-medium"
                    >
                      Loading live {mode} trades…
                    </td>
                  </tr>
                )}
                {!loading &&
                  visibleTrades.map((trade, index) => (
                    <tr
                      key={trade.id}
                      className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                    >
                      {visibleColumns.map((key) => (
                        <Fragment key={key}>
                          {renderCell(key, trade, index)}
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                {!loading && visibleTrades.length === 0 && (
                  <tr>
                    <td
                      colSpan={visibleColumns.length}
                      className="px-6 py-20 text-center text-xs text-muted-foreground font-medium"
                    >
                      {search.trim()
                        ? `No positions match "${search.trim()}".`
                        : `No ${mode} positions yet — use the ⋮ menu on any stock to add one.`}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-muted/90 font-semibold border-t border-border">
                <tr>
                  <td
                    colSpan={Math.max(visibleColumns.length - 1, 1)}
                    className="px-6 py-3.5 text-xs text-muted-foreground text-right uppercase tracking-[0.06em] font-bold"
                  >
                    Net Unrealized P&amp;L
                  </td>
                  <td className="px-6 py-3.5 text-xs text-right font-mono font-bold whitespace-nowrap">
                    <span
                      className={
                        totalPnL >= 0
                          ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font bg-success/10 text-success border-success/30"
                          : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font bg-error/10 text-error border-error/30"
                      }
                    >
                      {totalPnL >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                      )}
                      ₹{Math.abs(totalPnL).toFixed(2)} (
                      {totalPnLPercent >= 0 ? "+" : ""}
                      {totalPnLPercent.toFixed(2)}%)
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

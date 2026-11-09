"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  FileText,
  LineChart,
  Eye,
  EyeOff,
  ListPlus,
  ListMinus,
  Briefcase,
  Bell,
  StickyNote,
  FileSpreadsheet,
  ClipboardList,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { Button } from "@/components/ui/button";
import apiClient, {
  getApiResponseMessage,
  getAxiosErrorMessage,
  isSuccessfulApiResponse,
} from "@/lib/api-client";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import type { WatchlistCategory } from "@/types";
import type { WatchlistListType } from "@/lib/validations/watchlist";

export interface StockActionsMenuStock {
  readonly symbol: string;
  readonly name: string;
  readonly ltp: number;
  readonly sector?: string;
  readonly industry?: string;
}

export type StockActionsMenuAction =
  | "watchlist"
  | "portfolio"
  | "alert"
  | "note"
  | "paper"
  | "live";

export type StockActionsMenuSource =
  "watchlist" | "preposition" | "paper" | "live" | "others";

interface StockActionsMenuProps {
  readonly stock: StockActionsMenuStock;
  readonly onActionComplete?: (action: StockActionsMenuAction) => void;
  readonly className?: string;
  // Which page/table this menu instance lives on - tags alerts created here
  // so the Alerts page can filter by where they came from. Defaults to
  // "others" for every table that isn't one of the four tracked sources.
  readonly source?: StockActionsMenuSource;
}

const WATCHLIST_CATEGORIES: { value: WatchlistCategory; label: string }[] = [
  { value: "intraday", label: "Intraday Trading" },
  { value: "fno", label: "F&O Trading" },
  { value: "swing", label: "Swing Trading" },
  { value: "positional", label: "Positional Trading" },
  { value: "multibagger", label: "Multi Bagger Stocks" },
];

const WATCHLIST_LIST_LABELS: Record<WatchlistListType, string> = {
  normal: "Watchlist",
  preposition: "Preposition Watchlist",
};

function toCsvRow(stock: StockActionsMenuStock): string {
  const header = "Symbol,Name,LTP,Sector,Industry";
  const row = [
    stock.symbol,
    stock.name,
    stock.ltp,
    stock.sector ?? "",
    stock.industry ?? "",
  ]
    .map((value) => `"${String(value).replace(/"/g, '""')}"`)
    .join(",");
  return `${header}\n${row}\n`;
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function StockActionsMenu({
  stock,
  onActionComplete,
  className,
  source = "others",
}: StockActionsMenuProps) {
  const router = useRouter();
  const isWatchedNormal = useWatchlistStore((state) =>
    state.isWatched(stock.symbol, "normal"),
  );
  const isWatchedPreposition = useWatchlistStore((state) =>
    state.isWatched(stock.symbol, "preposition"),
  );
  const watchlistAdd = useWatchlistStore((state) => state.add);
  const watchlistRemove = useWatchlistStore(
    (state) => state.removeAllForSymbol,
  );
  const ensureWatchlistLoaded = useWatchlistStore(
    (state) => state.ensureLoaded,
  );
  const watchlistFolders = useWatchlistStore((state) => state.folders);

  useEffect(() => {
    void ensureWatchlistLoaded();
  }, [ensureWatchlistLoaded]);

  const [activeDialog, setActiveDialog] =
    useState<StockActionsMenuAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [portfolioQuantity, setPortfolioQuantity] = useState("1");
  const [portfolioAvgPrice, setPortfolioAvgPrice] = useState("");
  const [tradeTradingType, setTradeTradingType] =
    useState<WatchlistCategory>("swing");
  const [tradeQuantity, setTradeQuantity] = useState("1");
  const [tradeEntryPrice, setTradeEntryPrice] = useState("");
  const [alertCategory, setAlertCategory] =
    useState<WatchlistCategory>("swing");
  const [alertTargetPrice, setAlertTargetPrice] = useState("");
  const [alertDirection, setAlertDirection] = useState<"above" | "below">(
    "above",
  );
  const [noteContent, setNoteContent] = useState("");

  function goToStockDetail(): void {
    router.push(`/stock/${encodeURIComponent(stock.symbol)}`);
  }

  function handleViewChart(): void {
    router.push(`/chart/${encodeURIComponent(stock.symbol)}`);
  }

  function handleExcelConnect(): void {
    downloadCsv(`${stock.symbol}.csv`, toCsvRow(stock));
    toast.success(`${stock.symbol} exported to CSV`);
  }

  function openPortfolioDialog(): void {
    setPortfolioQuantity("1");
    setPortfolioAvgPrice(stock.ltp > 0 ? String(stock.ltp) : "");
    setActiveDialog("portfolio");
  }

  function openTradeDialog(
    mode: "paper" | "live",
    category: WatchlistCategory,
  ): void {
    setTradeTradingType(category);
    setTradeQuantity("1");
    setTradeEntryPrice(stock.ltp > 0 ? String(stock.ltp) : "");
    setActiveDialog(mode);
  }

  function openAlertDialog(category: WatchlistCategory): void {
    setAlertCategory(category);
    setAlertTargetPrice(stock.ltp > 0 ? String(stock.ltp) : "");
    setAlertDirection("above");
    setActiveDialog("alert");
  }

  async function removeFromWatchlist(
    listType: WatchlistListType,
  ): Promise<void> {
    const listLabel = WATCHLIST_LIST_LABELS[listType];
    try {
      await watchlistRemove(stock.symbol, listType);
      toast.success(`${stock.symbol} removed from ${listLabel}`);
      onActionComplete?.("watchlist");
    } catch (error) {
      toast.error(
        getAxiosErrorMessage(error, `Unable to remove from ${listLabel}`),
      );
    }
  }

  async function addToWatchlist(
    listType: WatchlistListType,
    category: WatchlistCategory,
    folder?: { readonly id: string; readonly name: string },
  ): Promise<void> {
    const listLabel = folder?.name ?? WATCHLIST_LIST_LABELS[listType];
    setSubmitting(true);
    try {
      await watchlistAdd({
        tradingSymbol: stock.symbol,
        sector: stock.sector,
        industry: stock.industry,
        ltp: stock.ltp,
        category,
        listType,
        watchlistId: folder?.id,
      });
      toast.success(`${stock.symbol} added to ${listLabel}`);
      onActionComplete?.("watchlist");
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, `Unable to add to ${listLabel}`));
    } finally {
      setSubmitting(false);
    }
  }

  // Always offered, even when the stock is already watched under this
  // listType elsewhere - membership is per folder, so being in one folder
  // must not block adding the same stock to another.
  function renderAddToWatchlistSubmenu(
    listType: WatchlistListType,
    label: string,
    Icon: LucideIcon,
  ) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Icon />
          {label}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {/* With a single folder there is nothing to choose, so the
              categories stay one click away as before. */}
          {watchlistFolders.length <= 1
            ? WATCHLIST_CATEGORIES.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => void addToWatchlist(listType, option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))
            : watchlistFolders.map((folder) => (
                <DropdownMenuSub key={folder.id}>
                  <DropdownMenuSubTrigger>{folder.name}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {WATCHLIST_CATEGORIES.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onSelect={() =>
                          void addToWatchlist(listType, option.value, folder)
                        }
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  async function submitPortfolioAdd(): Promise<void> {
    const quantity = Number(portfolioQuantity);
    const avgPrice = Number(portfolioAvgPrice);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (!Number.isFinite(avgPrice) || avgPrice <= 0) {
      toast.error("Enter a valid average price");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post<unknown>(
        "/api/portfolio-holdings",
        {
          tradingSymbol: stock.symbol,
          displayName: stock.name,
          quantity,
          avgPrice,
        },
      );
      if (!isSuccessfulApiResponse(response.data)) {
        throw new Error(
          getApiResponseMessage(response.data, "Unable to add to portfolio"),
        );
      }
      toast.success(`${stock.symbol} added to portfolio`);
      onActionComplete?.("portfolio");
      setActiveDialog(null);
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Unable to add to portfolio"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTradeAdd(mode: "paper" | "live"): Promise<void> {
    const modeLabel = mode === "paper" ? "Paper Trading" : "Live Trading";
    const quantity = Number(tradeQuantity);
    const entryPrice = Number(tradeEntryPrice);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      toast.error("Enter a valid entry price");
      return;
    }

    setSubmitting(true);
    try {
      // Stop loss, targets, and exit are the user's own calls, entered in
      // place on the trading table afterward - not guessed from entry price.
      const response = await apiClient.post<unknown>("/api/trades", {
        mode,
        tradingType: tradeTradingType,
        instrument: "EQUITY",
        tradingSymbol: stock.symbol,
        sector: stock.sector ?? "-",
        industry: stock.industry ?? "-",
        quantity,
        entryPrice,
      });
      if (!isSuccessfulApiResponse(response.data)) {
        throw new Error(
          getApiResponseMessage(response.data, `Unable to add to ${modeLabel}`),
        );
      }
      toast.success(`${stock.symbol} added to ${modeLabel}`);
      onActionComplete?.(mode);
      setActiveDialog(null);
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, `Unable to add to ${modeLabel}`));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAlertAdd(): Promise<void> {
    const targetPrice = Number(alertTargetPrice);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      toast.error("Enter a valid target price");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post<unknown>("/api/alerts", {
        tradingSymbol: stock.symbol,
        displayName: stock.name,
        targetPrice,
        direction: alertDirection,
        source,
        category: alertCategory,
      });
      if (!isSuccessfulApiResponse(response.data)) {
        throw new Error(
          getApiResponseMessage(response.data, "Unable to add alert"),
        );
      }
      toast.success(`Alert set for ${stock.symbol}`);
      onActionComplete?.("alert");
      setActiveDialog(null);
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Unable to add alert"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNoteAdd(): Promise<void> {
    if (!noteContent.trim()) {
      toast.error("Write something before saving");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post<unknown>("/api/notes", {
        title: `${stock.symbol} - ${stock.name}`,
        content: noteContent.trim(),
        color: "slate",
        tags: [stock.symbol.toUpperCase()],
      });
      if (!isSuccessfulApiResponse(response.data)) {
        throw new Error(
          getApiResponseMessage(response.data, "Unable to save note"),
        );
      }
      toast.success(`Note added for ${stock.symbol}`);
      onActionComplete?.("note");
      setActiveDialog(null);
      setNoteContent("");
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Unable to save note"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            aria-label={`Actions for ${stock.symbol}`}
            className={`p-1 hover:bg-muted rounded text-muted-foreground hover:text-muted-foreground ${className ?? ""}`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={goToStockDetail}>
            <FileText />
            Stock Summary
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleViewChart}>
            <LineChart />
            View Full Chart
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {renderAddToWatchlistSubmenu("normal", "Add to Watchlist", Eye)}
          {isWatchedNormal && (
            <DropdownMenuItem
              onSelect={() => void removeFromWatchlist("normal")}
            >
              <EyeOff />
              Remove from Watchlist
            </DropdownMenuItem>
          )}
          {renderAddToWatchlistSubmenu(
            "preposition",
            "Add to Preposition Watchlist",
            ListPlus,
          )}
          {isWatchedPreposition && (
            <DropdownMenuItem
              onSelect={() => void removeFromWatchlist("preposition")}
            >
              <ListMinus />
              Remove from Preposition Watchlist
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={openPortfolioDialog}>
            <Briefcase />
            Add to Portfolio
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileText />
              Add to Paper Trading
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {WATCHLIST_CATEGORIES.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => openTradeDialog("paper", option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <TrendingUp />
              Add to Live Trading
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {WATCHLIST_CATEGORIES.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => openTradeDialog("live", option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Bell />
              Add Alerts
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {WATCHLIST_CATEGORIES.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => openAlertDialog(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={() => setActiveDialog("note")}>
            <StickyNote />
            Add Notes
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleExcelConnect}>
            <FileSpreadsheet />
            Excel Connect
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={goToStockDetail}>
            <ClipboardList />
            Stock Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={activeDialog !== null}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent>
          {activeDialog === "portfolio" && (
            <>
              <DialogHeader>
                <DialogTitle>Add {stock.symbol} to Portfolio</DialogTitle>
                <DialogDescription>
                  Adding a symbol you already hold blends into your average
                  price.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <label className="block text-sm">
                  Quantity
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={portfolioQuantity}
                    onChange={(event) =>
                      setPortfolioQuantity(event.target.value)
                    }
                    className="mt-1 w-full rounded border border-border px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  Average Price
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={portfolioAvgPrice}
                    onChange={(event) =>
                      setPortfolioAvgPrice(event.target.value)
                    }
                    className="mt-1 w-full rounded border border-border px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => void submitPortfolioAdd()}
                  disabled={submitting}
                >
                  Add
                </Button>
              </DialogFooter>
            </>
          )}

          {(activeDialog === "paper" || activeDialog === "live") && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Add {stock.symbol} to{" "}
                  {
                    WATCHLIST_CATEGORIES.find(
                      (option) => option.value === tradeTradingType,
                    )?.label
                  }{" "}
                  {activeDialog === "paper" ? "Paper Trading" : "Live Trading"}
                </DialogTitle>
                <DialogDescription>Opens a new position.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <label className="block text-sm">
                  Quantity
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={tradeQuantity}
                    onChange={(event) => setTradeQuantity(event.target.value)}
                    className="mt-1 w-full rounded border border-border px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  Entry Price
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={tradeEntryPrice}
                    onChange={(event) => setTradeEntryPrice(event.target.value)}
                    className="mt-1 w-full rounded border border-border px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => void submitTradeAdd(activeDialog)}
                  disabled={submitting}
                >
                  Add
                </Button>
              </DialogFooter>
            </>
          )}

          {activeDialog === "alert" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Add{" "}
                  {
                    WATCHLIST_CATEGORIES.find(
                      (option) => option.value === alertCategory,
                    )?.label
                  }{" "}
                  Alert for {stock.symbol}
                </DialogTitle>
                <DialogDescription>
                  Checked against the latest price whenever you open Alerts - no
                  push notification.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <label className="block text-sm">
                  Target Price
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={alertTargetPrice}
                    onChange={(event) =>
                      setAlertTargetPrice(event.target.value)
                    }
                    className="mt-1 w-full rounded border border-border px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="alert-direction"
                      checked={alertDirection === "above"}
                      onChange={() => setAlertDirection("above")}
                    />
                    Price goes above
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="alert-direction"
                      checked={alertDirection === "below"}
                      onChange={() => setAlertDirection("below")}
                    />
                    Price goes below
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => void submitAlertAdd()}
                  disabled={submitting}
                >
                  Set Alert
                </Button>
              </DialogFooter>
            </>
          )}

          {activeDialog === "note" && (
            <>
              <DialogHeader>
                <DialogTitle>Add Note for {stock.symbol}</DialogTitle>
              </DialogHeader>
              <textarea
                value={noteContent}
                onChange={(event) => setNoteContent(event.target.value)}
                rows={4}
                placeholder="What's your thesis on this stock?"
                className="w-full rounded border border-border px-3 py-2 text-sm"
              />
              <DialogFooter>
                <Button
                  onClick={() => void submitNoteAdd()}
                  disabled={submitting}
                >
                  Save Note
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default StockActionsMenu;

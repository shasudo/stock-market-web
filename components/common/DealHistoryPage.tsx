"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import UnofficialSourceBadge from "@/components/common/UnofficialSourceBadge";
import { StockActionsMenu } from "@/components/common/StockActionsMenu";
import {
  fetchDealHistory,
  getDealHistoryClientErrorMessage,
  isDealHistoryRequestAborted,
} from "@/lib/deals/deal-history-client";
import type {
  DealHistoryItem,
  DealHistoryType,
} from "@/lib/deals/deal-history-client";

export type DealPageType = "bulk" | "block";

const PAGE_SIZE = 24;

function formatQuantity(num: number): number {
  return num;
}

function formatDealDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DealCard({
  deal,
  dealTypeLabel,
}: {
  deal: DealHistoryItem;
  dealTypeLabel: string;
}) {
  const isBuy = deal.transactionType === "BUY";
  const dealValueCr = (deal.quantity * deal.price) / 10_000_000;

  return (
    <div className="rounded-2xl border border-border/90 bg-card shadow-xs p-4">
      <div className="text-xs text-muted-foreground mb-3">
        {formatDealDate(deal.dealDate)}
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded">
          {dealTypeLabel}
        </span>
        <div className="flex items-center gap-1">
          <span
            className={`px-3 py-1 text-xs font-semibold rounded ${
              isBuy
                ? "bg-success dark:text-zinc-950 text-white"
                : "bg-error dark:text-zinc-950 text-white"
            }`}
          >
            {isBuy ? "BUY" : "SELL"}
          </span>
          <StockActionsMenu
            stock={{
              symbol: deal.symbol,
              name: deal.companyName,
              ltp: deal.price,
            }}
          />
        </div>
      </div>

      <h3 className="font-semibold text-foreground text-base mb-1">
        {deal.companyName}
      </h3>
      <p className="text-xs text-muted-foreground mb-2">{deal.symbol}</p>

      <p className="text-sm text-muted-foreground mb-4">
        <span className={isBuy ? "text-success" : "text-error"}>
          {isBuy ? "Bought by" : "Sold by"}
        </span>{" "}
        <span className="text-primary">{deal.clientName}</span>
      </p>

      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Quantity</p>
          <p className="font-semibold text-foreground text-sm">
            {formatQuantity(deal.quantity).toLocaleString("en-IN")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Traded Price</p>
          <p className="font-semibold text-foreground text-sm">
            {deal.price.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">
            Deal Value (Rs. Cr.)
          </p>
          <p className="font-semibold text-foreground text-sm">
            {dealValueCr.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
        <div>
          {/* % of shares outstanding needs total-shares data this app
              doesn't have — shown honestly rather than fabricated. */}
          <p className="text-xs text-muted-foreground mb-0.5">% Traded</p>
          <p className="font-semibold text-muted-foreground text-sm">—</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Exchange</p>
          <p className="font-semibold text-foreground text-sm">NSE</p>
        </div>
      </div>
    </div>
  );
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function DealHistoryPage({
  dealType: fixedDealType,
  dealTypeLabel: fixedLabel,
  showTypeTabs = false,
}: {
  dealType: DealPageType | "all";
  dealTypeLabel: string;
  showTypeTabs?: boolean;
}) {
  const [typeTab, setTypeTab] = useState<DealHistoryType>("all");
  const dealType: DealHistoryType = showTypeTabs ? typeTab : fixedDealType;
  const dealTypeLabel =
    showTypeTabs && typeTab !== "all"
      ? typeTab === "bulk"
        ? "Bulk"
        : "Block"
      : fixedLabel;
  const [deals, setDeals] = useState<DealHistoryItem[]>([]);
  const [totalDeals, setTotalDeals] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortBy, setSortBy] = useState("date");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const resetPage = (): void => setPage(1);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetchDealHistory(
          {
            dealType,
            page,
            pageSize: PAGE_SIZE,
            search: search || undefined,
            from: from || undefined,
            to: to || undefined,
            sort: sortBy,
          },
          controller.signal,
        );
        if (!isCurrentRequest) return;
        setDeals([...response.deals]);
        setTotalDeals(response.pagination.totalDeals);
        setTotalPages(response.pagination.totalPages);
        setLastSyncAt(response.lastSyncAt);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrentRequest || isDealHistoryRequestAborted(error)) return;
        setErrorMessage(getDealHistoryClientErrorMessage(error));
      } finally {
        if (isCurrentRequest) setIsLoading(false);
      }
    };

    void load();
    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [dealType, page, search, from, to, sortBy]);

  const todayIso = useMemo(() => toIsoDay(new Date()), []);

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8 py-6">
        <UnofficialSourceBadge
          lastSyncAt={lastSyncAt}
          label="NSE archive history since Jul 2021 — refreshed by the holdings sync"
        />

        {showTypeTabs && (
          <div className="flex space-x-2 bg-transparent p-1 overflow-x-auto mb-4">
            {(
              [
                { key: "all", label: "All Deals" },
                { key: "bulk", label: "Bulk" },
                { key: "block", label: "Block" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setTypeTab(tab.key);
                  resetPage();
                }}
                className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all shadow-xs whitespace-nowrap ${
                  typeTab === tab.key
                    ? "bg-primary text-primary-foreground shadow-primary/20"
                    : "bg-card border border-border/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 mb-4 rounded-2xl border border-border/90 bg-card shadow-xs p-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by company, symbol, or client"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
            />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={from}
              max={to || todayIso}
              onChange={(e) => {
                setFrom(e.target.value);
                resetPage();
              }}
              className="px-2 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/30"
              aria-label="From date"
            />
            <span className="text-muted-foreground text-xs font-bold">TO</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              max={todayIso}
              onChange={(e) => {
                setTo(e.target.value);
                resetPage();
              }}
              className="px-2 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/30"
              aria-label="To date"
            />
            {(from || to) && (
              <button
                onClick={() => {
                  setFrom("");
                  setTo("");
                  resetPage();
                }}
                className="text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1" />

          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              resetPage();
            }}
            className="pl-4 pr-4 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer"
          >
            <option value="date">Date (Newest)</option>
            <option value="value-desc">Deal Value (High)</option>
            <option value="value-asc">Deal Value (Low)</option>
            <option value="quantity-desc">Quantity (High)</option>
          </select>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          {totalDeals.toLocaleString("en-IN")} {dealTypeLabel.toLowerCase()}{" "}
          deals in history
          {search || from || to
            ? ` · showing page ${page} of ${totalPages}`
            : ` · page ${page} of ${totalPages}`}
        </p>

        {errorMessage ? (
          <p
            role="alert"
            className="mb-4 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          >
            {errorMessage}
          </p>
        ) : null}

        {isLoading && deals.length === 0 ? (
          <div className="rounded-2xl border border-border/90 bg-card shadow-xs p-8 text-center">
            <p className="text-muted-foreground">
              Loading {dealTypeLabel.toLowerCase()} deals…
            </p>
          </div>
        ) : deals.length === 0 ? (
          <div className="rounded-2xl border border-border/90 bg-card shadow-xs p-8 text-center">
            <p className="text-muted-foreground">
              No {dealTypeLabel.toLowerCase()} deals found matching your
              criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deals.map((deal) => (
              <DealCard
                key={`${deal.dealType}-${deal.symbol}-${deal.dealDate}-${deal.clientName}-${deal.quantity}`}
                deal={deal}
                dealTypeLabel={dealTypeLabel}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-4 py-2 border border-border rounded-lg text-sm bg-card disabled:opacity-50 hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              disabled={page >= totalPages || isLoading}
              className="inline-flex items-center gap-1 px-4 py-2 border border-border rounded-lg text-sm bg-card disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export type { DealHistoryType };

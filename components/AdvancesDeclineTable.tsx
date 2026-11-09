"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  fetchLiveMarketData,
  getLiveMarketClientErrorMessage,
  isLiveMarketRequestAborted,
  type LiveMarketFilter,
  type LiveMarketRequest,
  type LiveMarketSort,
  type LiveMarketSortDirection,
} from "@/lib/market/live-market-client";
import type {
  MarketFilteredCounts,
  MarketLiveResponse,
  MarketStockData,
} from "@/lib/market/client-contract";
import { StockActionsMenu } from "@/components/common";

interface Stock {
  readonly id: string;
  readonly symbol: string;
  readonly companyName: string;
  readonly series: string;
  readonly ltp: number;
  readonly changePercent: number;
  readonly marketCap: string;
  readonly volumeLakhs: number;
  readonly valueCrores: number;
}

interface MarketSnapshot {
  readonly requestKey: string;
  readonly response: MarketLiveResponse;
}

type TabType = "advance" | "decline" | "unchanged";
type SortField =
  | "symbol"
  | "series"
  | "ltp"
  | "changePercent"
  | "marketCap"
  | "volumeLakhs"
  | "valueCrores";
type SortableField = "ltp" | "changePercent" | "marketCap" | "volumeLakhs";
type SortOrder = LiveMarketSortDirection | null;
type AriaSort = "ascending" | "descending" | "none";

interface TabDefinition {
  readonly id: TabType;
  readonly label: string;
}

interface TableColumn {
  readonly field: SortField;
  readonly label: string;
  readonly align?: "left" | "right";
  readonly secondaryLabel?: string;
  readonly marketSort?: LiveMarketSort;
}

interface SortableTableColumn extends TableColumn {
  readonly field: SortableField;
  readonly marketSort: LiveMarketSort;
}

interface PaginationControlsProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly isDisabled: boolean;
  readonly onPageChange: (page: number) => void;
  readonly showPageInput?: boolean;
}

const RECORDS_PER_PAGE = 50;
const REFRESH_INTERVAL_MS = 30_000;
const SHARES_PER_LAKH = 100_000;
const RUPEES_PER_CRORE = 10_000_000;

const tabs: readonly TabDefinition[] = [
  { id: "advance", label: "Advance" },
  { id: "decline", label: "Decline" },
  { id: "unchanged", label: "Unchanged" },
];

const tableColumns: readonly TableColumn[] = [
  { field: "symbol", label: "SYMBOL" },
  { field: "series", label: "SERIES" },
  { field: "ltp", label: "LTP", align: "right", marketSort: "lastPrice" },
  {
    field: "changePercent",
    label: "%CHNG",
    align: "right",
    marketSort: "pctChange",
  },
  {
    field: "marketCap",
    label: "MKT CAP",
    align: "right",
    secondaryLabel: "(₹)",
    marketSort: "marketCap",
  },
  {
    field: "volumeLakhs",
    label: "VOLUME",
    align: "right",
    secondaryLabel: "(Lakhs)",
    marketSort: "volume",
  },
  {
    field: "valueCrores",
    label: "VALUE",
    align: "right",
    secondaryLabel: "(₹ Crores)",
  },
];

const csvHeaders = [
  "Symbol",
  "Series",
  "LTP",
  "Change %",
  "Market Cap",
  "Volume (Lakhs)",
  "Value (₹ Crores)",
];

const filterByTab: Readonly<Record<TabType, LiveMarketFilter>> = {
  advance: "gainers",
  decline: "losers",
  unchanged: "unchanged",
};

const defaultSortByTab: Readonly<
  Record<
    TabType,
    { readonly sort: LiveMarketSort; readonly order: LiveMarketSortDirection }
  >
> = {
  advance: { sort: "pctChange", order: "desc" },
  decline: { sort: "pctChange", order: "asc" },
  unchanged: { sort: "name", order: "asc" },
};

function isSortableTableColumn(
  column: TableColumn,
): column is SortableTableColumn {
  return column.marketSort !== undefined;
}

function getAriaSort(
  sortField: SortableField | null,
  sortOrder: SortOrder,
  column: TableColumn,
): AriaSort {
  if (
    !isSortableTableColumn(column) ||
    sortField !== column.field ||
    !sortOrder
  ) {
    return "none";
  }

  return sortOrder === "asc" ? "ascending" : "descending";
}

function SortIcon({
  column,
  sortField,
  sortOrder,
}: {
  readonly column: SortableTableColumn;
  readonly sortField: SortableField | null;
  readonly sortOrder: SortOrder;
}): ReactElement {
  if (sortField !== column.field || !sortOrder) {
    return (
      <ArrowUpDown aria-hidden="true" className="ml-1 h-4 w-4 text-muted-foreground" />
    );
  }

  return sortOrder === "asc" ? (
    <ChevronUp aria-hidden="true" className="ml-1 h-4 w-4 text-purple-700" />
  ) : (
    <ChevronDown aria-hidden="true" className="ml-1 h-4 w-4 text-purple-700" />
  );
}

function escapeCsvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function toDisplayStock(stock: MarketStockData): Stock {
  const volume = stock.volume ?? 0;

  return {
    id: stock.id,
    symbol: stock.tradingSymbol,
    companyName: stock.companyName,
    series: stock.group || "—",
    ltp: stock.cmp,
    changePercent: stock.percentChange,
    marketCap: stock.marketCap,
    volumeLakhs: volume / SHARES_PER_LAKH,
    valueCrores: (stock.cmp * volume) / RUPEES_PER_CRORE,
  };
}

function formatNumber(value: number, fractionDigits: number = 2): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatCount(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString("en-IN");
}

function formatLastSync(lastSyncAt: string | null | undefined): string {
  if (!lastSyncAt) {
    return "Awaiting the first completed market sync";
  }

  const timestamp = new Date(lastSyncAt);
  if (Number.isNaN(timestamp.getTime())) {
    return "Live data timestamp unavailable";
  }

  return timestamp.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  });
}

function PaginationControls({
  currentPage,
  totalPages,
  isDisabled,
  onPageChange,
  showPageInput = false,
}: PaginationControlsProps): ReactElement {
  const goToPreviousPage = (): void =>
    onPageChange(Math.max(1, currentPage - 1));
  const goToNextPage = (): void =>
    onPageChange(Math.min(totalPages, currentPage + 1));
  const handlePageInput = (event: ChangeEvent<HTMLInputElement>): void => {
    const requestedPage = Number(event.target.value);

    if (
      Number.isInteger(requestedPage) &&
      requestedPage >= 1 &&
      requestedPage <= totalPages
    ) {
      onPageChange(requestedPage);
    }
  };

  const disabledButtonClass =
    "cursor-not-allowed border-border text-muted-foreground";
  const enabledButtonClass =
    "border-orange-600 text-warning hover:bg-warning/10";
  const firstPage = currentPage === 1 || isDisabled;
  const lastPage = currentPage === totalPages || isDisabled;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(1)}
        disabled={firstPage}
        className={`rounded border px-3 py-1.5 text-sm ${firstPage ? disabledButtonClass : enabledButtonClass}`}
      >
        First
      </button>
      <button
        type="button"
        onClick={goToPreviousPage}
        disabled={firstPage}
        className={`rounded border px-3 py-1.5 text-sm ${firstPage ? disabledButtonClass : enabledButtonClass}`}
      >
        Prev
      </button>
      <span className="px-3 text-sm text-muted-foreground">
        Page{" "}
        {showPageInput ? (
          <input
            aria-label="Current page"
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            disabled={isDisabled}
            onChange={handlePageInput}
            className="mx-1 w-12 rounded border border-border text-center disabled:bg-muted"
          />
        ) : (
          currentPage
        )}{" "}
        of {totalPages}
      </span>
      <button
        type="button"
        onClick={goToNextPage}
        disabled={lastPage}
        className={`rounded border px-3 py-1.5 text-sm ${lastPage ? disabledButtonClass : enabledButtonClass}`}
      >
        Next
      </button>
      <button
        type="button"
        onClick={() => onPageChange(totalPages)}
        disabled={lastPage}
        className={`rounded border px-3 py-1.5 text-sm ${lastPage ? disabledButtonClass : enabledButtonClass}`}
      >
        Last
      </button>
    </div>
  );
}

export default function AdvancesDeclineTable(): ReactElement {
  const [activeTab, setActiveTab] = useState<TabType>("advance");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortableField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const marketRequest = useMemo<LiveMarketRequest>(() => {
    const defaultSort = defaultSortByTab[activeTab];
    const selectedColumn = tableColumns.find(
      (column) => column.field === sortField,
    );
    const selectedSort =
      selectedColumn && isSortableTableColumn(selectedColumn)
        ? selectedColumn.marketSort
        : defaultSort.sort;

    return {
      exchange: "NSE",
      filter: filterByTab[activeTab],
      page: currentPage,
      pageSize: RECORDS_PER_PAGE,
      sort: selectedSort,
      order: sortOrder ?? defaultSort.order,
      search: deferredSearchQuery,
    };
  }, [activeTab, currentPage, deferredSearchQuery, sortField, sortOrder]);

  const requestKey = useMemo(
    () => JSON.stringify(marketRequest),
    [marketRequest],
  );

  useEffect(() => {
    const abortController = new AbortController();
    let isCurrentRequest = true;

    const loadMarketData = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetchLiveMarketData(
          marketRequest,
          abortController.signal,
        );
        if (!isCurrentRequest) {
          return;
        }

        setSnapshot({ requestKey, response });
        if (
          response.pagination.totalPages > 0 &&
          currentPage > response.pagination.totalPages
        ) {
          setCurrentPage(response.pagination.totalPages);
        }
      } catch (error: unknown) {
        if (!isCurrentRequest || isLiveMarketRequestAborted(error)) {
          return;
        }

        setErrorMessage(getLiveMarketClientErrorMessage(error));
      } finally {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      }
    };

    void loadMarketData();

    return () => {
      isCurrentRequest = false;
      abortController.abort();
    };
  }, [currentPage, marketRequest, refreshVersion, requestKey]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      setRefreshVersion((version) => version + 1);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(refreshTimer);
  }, []);

  const response =
    snapshot?.requestKey === requestKey ? snapshot.response : undefined;
  const stocks = useMemo(
    () => response?.stocks.map(toDisplayStock) ?? [],
    [response],
  );
  const filteredCounts: MarketFilteredCounts | undefined =
    response?.filteredCounts;
  const totalRecords = response?.pagination.totalStocks ?? 0;
  const totalPages = Math.max(1, response?.pagination.totalPages ?? 1);
  const startRecord =
    totalRecords === 0 ? 0 : (currentPage - 1) * RECORDS_PER_PAGE + 1;
  const endRecord = Math.min(currentPage * RECORDS_PER_PAGE, totalRecords);
  const showLoadingState = isLoading || (!response && !errorMessage);

  const selectTab = (tab: TabType): void => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSortField(null);
    setSortOrder(null);
  };

  const handleSort = (column: TableColumn): void => {
    if (!isSortableTableColumn(column)) {
      return;
    }

    if (sortField !== column.field) {
      setSortField(column.field);
      setSortOrder("asc");
    } else if (sortOrder === "asc") {
      setSortOrder("desc");
    } else {
      setSortField(null);
      setSortOrder(null);
    }

    setCurrentPage(1);
  };

  const clearSearch = (): void => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setSearchQuery(event.target.value);
    setCurrentPage(1);
  };

  const handleRefresh = (): void => {
    setRefreshVersion((version) => version + 1);
  };

  const handleDownloadCsv = (): void => {
    const rows = stocks.map((stock) =>
      [
        stock.symbol,
        stock.series,
        formatNumber(stock.ltp),
        formatNumber(stock.changePercent),
        stock.marketCap,
        formatNumber(stock.volumeLakhs),
        formatNumber(stock.valueCrores),
      ]
        .map(escapeCsvCell)
        .join(","),
    );
    const csvContent = [csvHeaders.join(","), ...rows].join("\n");
    const downloadUrl = URL.createObjectURL(
      new Blob([csvContent], { type: "text/csv;charset=utf-8" }),
    );
    const downloadLink = document.createElement("a");

    downloadLink.href = downloadUrl;
    downloadLink.download = `${activeTab}-stocks-page-${currentPage}.csv`;
    document.body.append(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="w-full min-h-screen py-6 md:py-10">
      <div className="w-full px-4 lg:px-8">
        {/* Apple Breadth Gauge Summary Card */}
        <div className="rounded-2xl border border-border/90 bg-card shadow-xs p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-[-0.035em]">
                Advances & Declines
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground font-medium mt-0.5">
                Market breadth ratio, directional distribution, and net liquidity across NSE equities
              </p>
            </div>

            {/* Apple Breadth Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#34C759]/10 border border-[#34C759]/25 text-[#248a3d] text-xs font-bold font-mono num-font">
                <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                Advances: {formatCount(filteredCounts?.gainers)}
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/25 text-[#d70015] text-xs font-bold font-mono num-font">
                <span className="w-2 h-2 rounded-full bg-[#FF3B30]" />
                Declines: {formatCount(filteredCounts?.losers)}
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/[0.04] border border-border/90 text-muted-foreground text-xs font-bold font-mono num-font">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                Unchanged: {formatCount(filteredCounts?.unchanged)}
              </div>
            </div>
          </div>

          {/* Visual Apple Activity-Style Ratio Bar */}
          {filteredCounts && (filteredCounts.gainers > 0 || filteredCounts.losers > 0) && (
            <div className="w-full h-2.5 rounded-full bg-black/[0.04] overflow-hidden flex shadow-inner">
              <div
                className="bg-[#34C759] h-full transition-all duration-500"
                style={{
                  width: `${
                    (filteredCounts.gainers /
                      (filteredCounts.gainers + filteredCounts.losers + (filteredCounts.unchanged || 0))) *
                    100
                  }%`,
                }}
              />
              <div
                className="bg-slate-300 h-full transition-all duration-500"
                style={{
                  width: `${
                    ((filteredCounts.unchanged || 0) /
                      (filteredCounts.gainers + filteredCounts.losers + (filteredCounts.unchanged || 0))) *
                    100
                  }%`,
                }}
              />
              <div
                className="bg-[#FF3B30] h-full transition-all duration-500"
                style={{
                  width: `${
                    (filteredCounts.losers /
                      (filteredCounts.gainers + filteredCounts.losers + (filteredCounts.unchanged || 0))) *
                    100
                  }%`,
                }}
              />
            </div>
          )}
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-[#FF3B30]/25 bg-[#FF3B30]/10 px-4 py-3 text-xs font-semibold text-[#FF3B30]"
          >
            {errorMessage}
          </div>
        ) : null}

        {/* Tab & Filter Bar */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div
            role="tablist"
            aria-label="Advance decline categories"
            className="flex items-center gap-1 flex-wrap"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const count =
                tab.id === "advance"
                  ? filteredCounts?.gainers
                  : tab.id === "decline"
                    ? filteredCounts?.losers
                    : filteredCounts?.unchanged;

              return (
                <button
                  key={tab.id}
                  id={`${tab.id}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="advance-decline-table"
                  onClick={() => selectTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    isActive ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-muted hover:text-muted-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  {count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                        isActive
                          ? "bg-black/[0.08] text-foreground"
                          : "bg-black/[0.04] text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <input
                id="advance-decline-search"
                type="search"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search symbol, company..."
                className="w-56 md:w-64 rounded-xl border border-border/90 bg-card px-3.5 py-1.5 text-xs md:text-sm placeholder:text-muted-foreground focus:border-primary/30 focus:ring-2 focus:ring-ring/30/20 focus:outline-none shadow-xs"
              />
            </div>

            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="rounded-xl border border-border/90 bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors shadow-xs"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={stocks.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/90 bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50 transition-all shadow-xs"
            >
              <Download aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/90 bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50 transition-all shadow-xs"
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-3.5 w-3.5 text-primary ${isLoading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Record count info */}
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span>
            Showing <strong className="text-foreground">{startRecord}-{endRecord}</strong> of{" "}
            <strong className="text-foreground">{totalRecords.toLocaleString("en-IN")}</strong> equities
          </span>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            isDisabled={isLoading}
            onPageChange={setCurrentPage}
            showPageInput
          />
        </div>

        {/* Apple Table Card */}
        <div
          id="advance-decline-table"
          role="tabpanel"
          aria-labelledby={`${activeTab}-tab`}
          className="overflow-hidden rounded-2xl border border-border/90 bg-card/95 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04),0_1px_3px_rgb(0,0,0,0.02)]"
        >
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead className="bg-muted/90 backdrop-blur-xl border-b border-border/90 sticky top-0 z-10">
                <tr>
                  {tableColumns.map((column) => {
                    const alignmentClass =
                      column.align === "right" ? "text-right" : "text-left";
                    const sortableColumn = isSortableTableColumn(column);

                    return (
                      <th
                        key={column.field}
                        scope="col"
                        aria-sort={getAriaSort(sortField, sortOrder, column)}
                        className={`p-0 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground select-none ${alignmentClass}`}
                      >
                        {sortableColumn ? (
                          <button
                            type="button"
                            onClick={() => handleSort(column)}
                            className={`flex w-full items-center px-4 py-3.5 transition-colors hover:text-foreground focus:outline-none ${
                              column.align === "right"
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <span>{column.label}</span>
                            {column.secondaryLabel && (
                              <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                                {column.secondaryLabel}
                              </span>
                            )}
                            <SortIcon
                              column={column}
                              sortField={sortField}
                              sortOrder={sortOrder}
                            />
                          </button>
                        ) : (
                          <span
                            className={`flex px-4 py-3.5 ${column.align === "right" ? "justify-end" : "justify-start"}`}
                          >
                            <span>{column.label}</span>
                            {column.secondaryLabel && (
                              <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                                {column.secondaryLabel}
                              </span>
                            )}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {stocks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={tableColumns.length}
                      className="px-4 py-20 text-center text-xs text-muted-foreground font-medium"
                    >
                      {showLoadingState
                        ? "Loading live market data…"
                        : "No matching records found."}
                    </td>
                  </tr>
                ) : (
                  stocks.map((stock) => {
                    const isGainer = stock.changePercent > 0;
                    const isLoser = stock.changePercent < 0;

                    return (
                      <tr
                        key={`${stock.id}-${stock.symbol}`}
                        className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                      >
                        {/* Symbol */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="font-bold text-foreground hover:text-primary cursor-pointer block text-xs md:text-sm">
                                {stock.symbol}
                              </span>
                              <span className="text-[10px] text-muted-foreground block truncate max-w-[140px]">
                                {stock.companyName}
                              </span>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <StockActionsMenu
                                stock={{
                                  symbol: stock.symbol,
                                  name: stock.companyName,
                                  ltp: stock.ltp,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Series / Group */}
                        <td className="px-4 py-3 text-muted-foreground font-medium text-xs whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-black/[0.04] text-muted-foreground text-[10px] font-bold">
                            {stock.series}
                          </span>
                        </td>

                        {/* LTP */}
                        <td className="px-4 py-3 text-right font-mono font-bold text-foreground num-font whitespace-nowrap">
                          ₹{formatNumber(stock.ltp)}
                        </td>

                        {/* Apple Stocks % Change Pill */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span
                            className={
                              isGainer
                                ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font bg-success/10 text-success border-success/30"
                                : isLoser
                                  ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font bg-error/10 text-error border-error/30"
                                  : "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-black/[0.04] text-muted-foreground border border-border/90 num-font"
                            }
                          >
                            {isGainer ? "+" : ""}
                            {formatNumber(stock.changePercent)}%
                          </span>
                        </td>

                        {/* Mkt Cap */}
                        <td className="px-4 py-3 text-right text-xs font-mono font-medium text-muted-foreground num-font whitespace-nowrap">
                          {stock.marketCap}
                        </td>

                        {/* Volume */}
                        <td className="px-4 py-3 text-right text-xs font-mono text-muted-foreground num-font whitespace-nowrap">
                          {formatNumber(stock.volumeLakhs)}
                        </td>

                        {/* Value */}
                        <td className="px-4 py-3 text-right text-xs font-mono text-muted-foreground num-font whitespace-nowrap">
                          ₹{formatNumber(stock.valueCrores)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Pagination */}
        <div className="mt-4 flex items-center justify-end">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            isDisabled={isLoading}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import { ArrowUpDown, RefreshCw, X } from "lucide-react";
import {
  LiveMarketClientError,
  fetchLiveMarketData,
  getLiveMarketClientErrorMessage,
  isLiveMarketRequestAborted,
  type LiveMarketFilter,
} from "@/lib/market/live-market-client";
import type { MarketStockData } from "@/lib/market/client-contract";
import { StockActionsMenu } from "@/components/common";

interface PriceBandStock {
  readonly id: string;
  readonly companyName: string;
  readonly symbol: string;
  readonly series: string;
  readonly ltp: number;
  readonly percentChange: number;
  readonly priceBandPercent: number;
  readonly volumeLakhs: number;
  readonly valueCrores: number;
}

interface PriceBandData {
  readonly upper: readonly PriceBandStock[];
  readonly lower: readonly PriceBandStock[];
  readonly both: readonly PriceBandStock[];
  readonly lastSyncAt: string | null;
}

type BandTab = "upper" | "lower" | "both";
type MoverFilter = Extract<LiveMarketFilter, "gainers" | "losers">;
type SortField =
  | "symbol"
  | "series"
  | "ltp"
  | "percentChange"
  | "priceBandPercent"
  | "volumeLakhs"
  | "valueCrores";
type SortDirection = "asc" | "desc";
type AriaSort = "ascending" | "descending" | "none";

interface TabDefinition {
  readonly id: BandTab;
  readonly label: string;
}

interface TableColumn {
  readonly field: SortField;
  readonly label: string;
  readonly align?: "left" | "right";
  readonly secondaryLabel?: string;
}

interface PaginationControlsProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly isDisabled: boolean;
  readonly onPageChange: (page: number) => void;
}

interface CandidateFetchResult {
  readonly stocks: readonly MarketStockData[];
  readonly lastSyncAt: string | null;
}

const ROWS_PER_PAGE = 50;
const MARKET_PAGE_SIZE = 500;
const MAX_CANDIDATE_PAGES = 20;
const REFRESH_INTERVAL_MS = 30_000;
const MINIMUM_PRICE_BAND_PERCENT = 2;
const SHARES_PER_LAKH = 100_000;
const RUPEES_PER_CRORE = 10_000_000;
const PRICE_BAND_VALUES = ["2%", "5%", "10%", "20%"] as const;
const TOO_MANY_CANDIDATES_MESSAGE =
  "Too many price-band candidates were returned to load safely. Narrow the data source and try again.";
const EMPTY_PRICE_BAND_STOCKS: readonly PriceBandStock[] = [];

const tabs: readonly TabDefinition[] = [
  { id: "upper", label: "Upper Band" },
  { id: "lower", label: "Lower Band" },
  { id: "both", label: "Both Band" },
];

const tableColumns: readonly TableColumn[] = [
  { field: "symbol", label: "SYMBOL" },
  { field: "series", label: "SERIES" },
  { field: "ltp", label: "LTP", align: "right" },
  { field: "percentChange", label: "%CHNG", align: "right" },
  { field: "priceBandPercent", label: "PRICE BAND %", align: "right" },
  {
    field: "volumeLakhs",
    label: "VOLUME",
    align: "right",
    secondaryLabel: "(Lakhs)",
  },
  {
    field: "valueCrores",
    label: "VALUE",
    align: "right",
    secondaryLabel: "(₹ Crores)",
  },
];

function SortIcon({
  field,
  sortField,
}: {
  readonly field: SortField;
  readonly sortField: SortField;
}): ReactElement {
  return (
    <ArrowUpDown
      aria-hidden="true"
      className={`ml-1 inline-block h-3 w-3 ${sortField === field ? "text-teal-600" : "text-muted-foreground"}`}
    />
  );
}

function getAriaSort(
  sortField: SortField,
  sortDirection: SortDirection,
  field: SortField,
): AriaSort {
  if (sortField !== field) {
    return "none";
  }

  return sortDirection === "asc" ? "ascending" : "descending";
}

function getPriceBandPercent(stock: MarketStockData): number | undefined {
  const priceBandPercent = Number.parseFloat(stock.priceBand);

  return Number.isFinite(priceBandPercent) && priceBandPercent > 0
    ? priceBandPercent
    : undefined;
}

function meetsUpperPriceBandThreshold(stock: MarketStockData): boolean {
  const priceBandPercent = getPriceBandPercent(stock);
  return (
    priceBandPercent !== undefined && stock.percentChange >= priceBandPercent
  );
}

function meetsLowerPriceBandThreshold(stock: MarketStockData): boolean {
  const priceBandPercent = getPriceBandPercent(stock);
  return (
    priceBandPercent !== undefined && stock.percentChange <= -priceBandPercent
  );
}

function shouldFetchNextPage(
  stocks: readonly MarketStockData[],
  filter: MoverFilter,
): boolean {
  const lastStock = stocks.at(-1);
  if (!lastStock) {
    return false;
  }

  return filter === "gainers"
    ? lastStock.percentChange >= MINIMUM_PRICE_BAND_PERCENT
    : lastStock.percentChange <= -MINIMUM_PRICE_BAND_PERCENT;
}

async function fetchPriceBandCandidates(
  filter: MoverFilter,
  signal: AbortSignal,
): Promise<CandidateFetchResult> {
  const stocks: MarketStockData[] = [];
  let page = 1;
  let totalPages = 1;
  let lastSyncAt: string | null = null;

  while (page <= totalPages) {
    if (page > MAX_CANDIDATE_PAGES) {
      throw new LiveMarketClientError(TOO_MANY_CANDIDATES_MESSAGE);
    }

    const response = await fetchLiveMarketData(
      {
        exchange: "NSE",
        filter,
        page,
        pageSize: MARKET_PAGE_SIZE,
        sort: "pctChange",
        order: filter === "gainers" ? "desc" : "asc",
        priceBands: PRICE_BAND_VALUES,
      },
      signal,
    );
    stocks.push(...response.stocks);
    totalPages = response.pagination.totalPages;
    lastSyncAt = mostRecentTimestamp(lastSyncAt, response.lastSyncAt);

    if (!shouldFetchNextPage(response.stocks, filter)) {
      break;
    }

    page += 1;
  }

  return { stocks, lastSyncAt };
}

async function loadPriceBandData(signal: AbortSignal): Promise<PriceBandData> {
  const [upperCandidates, lowerCandidates] = await Promise.all([
    fetchPriceBandCandidates("gainers", signal),
    fetchPriceBandCandidates("losers", signal),
  ]);
  const upper = upperCandidates.stocks
    .filter(meetsUpperPriceBandThreshold)
    .map(toPriceBandStock);
  const lower = lowerCandidates.stocks
    .filter(meetsLowerPriceBandThreshold)
    .map(toPriceBandStock);

  return {
    upper,
    lower,
    both: combineBandStocks(upper, lower),
    lastSyncAt: mostRecentTimestamp(
      upperCandidates.lastSyncAt,
      lowerCandidates.lastSyncAt,
    ),
  };
}

function toPriceBandStock(stock: MarketStockData): PriceBandStock {
  const volume = stock.volume ?? 0;

  return {
    id: `${stock.tradingSymbol}-${stock.group}`,
    companyName: stock.companyName,
    symbol: stock.tradingSymbol,
    series: stock.group || "—",
    ltp: stock.cmp,
    percentChange: stock.percentChange,
    priceBandPercent: getPriceBandPercent(stock) ?? 0,
    volumeLakhs: volume / SHARES_PER_LAKH,
    valueCrores: (stock.cmp * volume) / RUPEES_PER_CRORE,
  };
}

function combineBandStocks(
  upper: readonly PriceBandStock[],
  lower: readonly PriceBandStock[],
): readonly PriceBandStock[] {
  const stocksById = new Map<string, PriceBandStock>();

  for (const stock of [...upper, ...lower]) {
    stocksById.set(stock.id, stock);
  }

  return [...stocksById.values()];
}

function mostRecentTimestamp(
  firstTimestamp: string | null,
  secondTimestamp: string | null,
): string | null {
  if (!firstTimestamp) {
    return secondTimestamp;
  }
  if (!secondTimestamp) {
    return firstTimestamp;
  }

  const firstTime = new Date(firstTimestamp).getTime();
  const secondTime = new Date(secondTimestamp).getTime();
  if (Number.isNaN(firstTime) || Number.isNaN(secondTime)) {
    return secondTimestamp;
  }

  return secondTime > firstTime ? secondTimestamp : firstTimestamp;
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
}: PaginationControlsProps): ReactElement {
  const firstPage = currentPage === 1 || isDisabled;
  const lastPage = currentPage === totalPages || isDisabled;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onPageChange(1)}
        disabled={firstPage}
        className="rounded border border-orange-400 px-2 py-1 text-xs text-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        First
      </button>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={firstPage}
        className="rounded border border-orange-400 px-2 py-1 text-xs text-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Prev
      </button>
      <span className="px-2 text-sm text-muted-foreground">
        Page <strong>{currentPage}</strong> of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={lastPage}
        className="rounded border border-orange-400 px-2 py-1 text-xs text-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
      <button
        type="button"
        onClick={() => onPageChange(totalPages)}
        disabled={lastPage}
        className="rounded border border-orange-400 px-2 py-1 text-xs text-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Last
      </button>
    </div>
  );
}

export default function PriceBandHittersView(): ReactElement {
  const [activeTab, setActiveTab] = useState<BandTab>("upper");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("valueCrores");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [priceBandData, setPriceBandData] = useState<PriceBandData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    const abortController = new AbortController();
    let isCurrentRequest = true;

    const refreshPriceBandData = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextPriceBandData = await loadPriceBandData(
          abortController.signal,
        );
        if (isCurrentRequest) {
          setPriceBandData(nextPriceBandData);
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

    void refreshPriceBandData();

    return () => {
      isCurrentRequest = false;
      abortController.abort();
    };
  }, [refreshVersion]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      setRefreshVersion((version) => version + 1);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(refreshTimer);
  }, []);

  const rawData = priceBandData?.[activeTab] ?? EMPTY_PRICE_BAND_STOCKS;
  const filteredData = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLocaleLowerCase();
    const matchingData = normalizedQuery
      ? rawData.filter(
          (stock) =>
            stock.symbol.toLocaleLowerCase().includes(normalizedQuery) ||
            stock.companyName.toLocaleLowerCase().includes(normalizedQuery),
        )
      : rawData;

    return [...matchingData].sort((firstStock, secondStock) => {
      const firstValue = firstStock[sortField];
      const secondValue = secondStock[sortField];

      if (typeof firstValue === "string" && typeof secondValue === "string") {
        return sortDirection === "asc"
          ? firstValue.localeCompare(secondValue)
          : secondValue.localeCompare(firstValue);
      }

      return sortDirection === "asc"
        ? Number(firstValue) - Number(secondValue)
        : Number(secondValue) - Number(firstValue);
    });
  }, [deferredSearchQuery, rawData, sortDirection, sortField]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredData.length / ROWS_PER_PAGE),
  );
  const displayedPage = Math.min(currentPage, totalPages);
  const paginatedData = filteredData.slice(
    (displayedPage - 1) * ROWS_PER_PAGE,
    displayedPage * ROWS_PER_PAGE,
  );
  const upperCount = priceBandData?.upper.length;
  const lowerCount = priceBandData?.lower.length;
  const bothCount = priceBandData?.both.length;
  const firstDisplayedRecord =
    filteredData.length === 0 ? 0 : (displayedPage - 1) * ROWS_PER_PAGE + 1;
  const lastDisplayedRecord = Math.min(
    displayedPage * ROWS_PER_PAGE,
    filteredData.length,
  );
  const showLoadingState = isLoading || (!priceBandData && !errorMessage);

  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }

    setCurrentPage(1);
  };

  const selectTab = (tab: BandTab): void => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchQuery("");
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

  return (
    <div className="min-h-screen w-full bg-card">
      <div className="border-b border-border px-6 py-5">
        <h1 className="text-xl font-bold text-foreground">
          Price Band Hitters
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          As on {formatLastSync(priceBandData?.lastSyncAt)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Live NSE candidates meeting or exceeding their stored price-band
          percentage. Both Band combines upper and lower candidates.
        </p>
      </div>

      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-sm font-semibold text-muted-foreground">
            Securities meeting the price-band threshold
          </span>
          <span className="text-sm font-bold text-success">
            Upper Band - {formatCount(upperCount)}
          </span>
          <span className="text-sm font-bold text-error">
            Lower Band - {formatCount(lowerCount)}
          </span>
          <span className="text-sm font-bold text-orange-500">
            Both Band - {formatCount(bothCount)}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">
            Total Securities - {formatCount(bothCount)}
          </span>
        </div>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="mx-6 mt-4 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="border-b border-border px-6">
        <div
          role="tablist"
          aria-label="Price band categories"
          className="flex space-x-6"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const activeClass =
              tab.id === "upper"
                ? "border-green-600 text-success"
                : tab.id === "lower"
                  ? "border-red-600 text-error"
                  : "border-orange-500 text-orange-500";

            return (
              <button
                key={tab.id}
                id={`${tab.id}-band-tab`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="price-band-table"
                onClick={() => selectTab(tab.id)}
                className={`border-b-2 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? activeClass
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <label
            htmlFor="price-band-search"
            className="rounded-l-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            Company
          </label>
          <div className="relative">
            <input
              id="price-band-search"
              type="search"
              placeholder="Company Name or Symbol"
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-56 rounded-md border border-border py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear company search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <X
                  aria-hidden="true"
                  className="h-4 w-4 text-muted-foreground"
                />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={clearSearch}
            className="rounded-full border border-orange-400 px-4 py-2 text-sm text-orange-500 hover:bg-warning/10"
          >
            Clear
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span aria-live="polite" className="text-sm text-muted-foreground">
            Displaying {firstDisplayedRecord}-{lastDisplayedRecord} of{" "}
            {filteredData.length} records
          </span>
          <PaginationControls
            currentPage={displayedPage}
            totalPages={totalPages}
            isDisabled={isLoading}
            onPageChange={setCurrentPage}
          />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />{" "}
            Refresh
          </button>
        </div>
      </div>

      <div
        id="price-band-table"
        role="tabpanel"
        aria-labelledby={`${activeTab}-band-tab`}
        className="overflow-x-auto"
      >
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#1a237e] text-white">
              {tableColumns.map((column) => (
                <th
                  key={column.field}
                  scope="col"
                  aria-sort={getAriaSort(
                    sortField,
                    sortDirection,
                    column.field,
                  )}
                  className={`p-0 font-semibold ${column.align === "right" ? "text-right" : "text-left"}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSort(column.field)}
                    className={`flex w-full items-center px-4 py-3 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white ${
                      column.align === "right" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <span>{column.label}</span>
                    {column.secondaryLabel && (
                      <span className="ml-1 text-xs font-normal">
                        {column.secondaryLabel}
                      </span>
                    )}
                    <SortIcon field={column.field} sortField={sortField} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-card">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColumns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {showLoadingState
                    ? "Loading live market data…"
                    : "No records found"}
                </td>
              </tr>
            ) : (
              paginatedData.map((stock) => (
                <tr
                  key={stock.id}
                  className="border-b border-border transition-colors hover:bg-muted"
                >
                  <td className="px-4 py-3 font-medium text-info">
                    <div className="flex items-center justify-between gap-2">
                      <span>{stock.symbol}</span>
                      <div className="flex items-center gap-1">
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
                  <td className="px-4 py-3 text-muted-foreground">
                    {stock.series}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {formatNumber(stock.ltp)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${stock.percentChange >= 0 ? "text-success" : "text-error"}`}
                  >
                    {formatNumber(stock.percentChange)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-warning">
                    {formatNumber(stock.priceBandPercent)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {formatNumber(stock.volumeLakhs)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {formatNumber(stock.valueCrores)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-6 py-4">
        <span className="text-sm text-muted-foreground">
          Displaying {firstDisplayedRecord}-{lastDisplayedRecord} of{" "}
          {filteredData.length} records
        </span>
        <PaginationControls
          currentPage={displayedPage}
          totalPages={totalPages}
          isDisabled={isLoading}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}

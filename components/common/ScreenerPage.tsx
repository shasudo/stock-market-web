"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import TopGainersLosersTable from "@/components/TopGainersLosersTable";
import { AuthGuard } from "./AuthGuard";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  type ScreenerConfig,
  type ScreenerType,
  screenerConfigs,
} from "@/lib/screener-config";
import type { TopGainerLoserStock } from "@/lib/mockData";
import apiClient from "@/lib/api-client";

const MARKET_PAGE_SIZE = 500;
const PAGE_REQUEST_CONCURRENCY = 3;
const MAX_MARKET_DATA_PAGES = 20;
const MARKET_DATA_UNAVAILABLE_MESSAGE =
  "Live market data is temporarily unavailable. Please try again shortly.";

const REQUIRED_STOCK_STRING_FIELDS = [
  "id",
  "companyName",
  "tradingSymbol",
  "sector",
  "industry",
  "group",
  "priceBand",
  "marketCap",
] as const;

const REQUIRED_STOCK_NUMBER_FIELDS = [
  "faceValue",
  "preClose",
  "cmp",
  "netChange",
  "percentChange",
] as const;

interface MarketStock {
  readonly id: string;
  readonly companyName: string;
  readonly tradingSymbol: string;
  readonly sector: string;
  readonly industry: string;
  readonly group: string;
  readonly faceValue: number;
  readonly priceBand: string;
  readonly marketCap: string;
  readonly preClose: number;
  readonly cmp: number;
  readonly netChange: number;
  readonly percentChange: number;
  readonly open?: number;
  readonly high?: number;
  readonly low?: number;
  readonly week52High?: number;
  readonly week52Low?: number;
  readonly ath?: number;
  readonly atl?: number;
  readonly volume?: number;
}

interface MarketPagination {
  readonly totalPages: number;
}

interface MarketPageResponse {
  readonly stocks: readonly MarketStock[];
  readonly pagination: MarketPagination;
  readonly lastSyncAt?: string | null;
}

interface MoverStocksResult {
  readonly stocks: MarketStock[];
  readonly lastSyncAt: string | null;
}

type MarketMoverFilter = "gainers" | "losers";
type Exchange = "NSE" | "BSE";
type UnknownRecord = Record<string, unknown>;

/**
 * The four breakout screens are evaluated on the server against live quotes:
 * 52-week highs/lows touch Dhan's quoted 52-week band, all-time highs/lows
 * touch the extreme over the stock's full stored candle history.
 */
interface ServerScreen {
  readonly hit: "all" | "high" | "low";
  readonly ath: "all" | "high" | "low";
}

const SERVER_SCREENS: Partial<Record<ScreenerType, ServerScreen>> = {
  "52-week-high": { hit: "high", ath: "all" },
  "52-week-low": { hit: "low", ath: "all" },
  "all-time-high": { hit: "all", ath: "high" },
  "all-time-low": { hit: "all", ath: "low" },
};

class MarketDataResponseError extends Error {
  public constructor(message: string = MARKET_DATA_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "MarketDataResponseError";
  }
}

function toTableStock(s: MarketStock): TopGainerLoserStock {
  return {
    id: s.id,
    stockName: s.companyName,
    symbol: s.tradingSymbol,
    price: s.cmp,
    change: s.netChange,
    changePercent: s.percentChange,
    daysHigh: s.high ?? s.week52High ?? s.cmp,
    daysLow: s.low ?? s.week52Low ?? s.cmp,
    open: s.open ?? s.preClose,
    vwap: s.cmp,
    sparklineData: [],
    sector: s.sector,
    industry: s.industry,
    group: s.group,
    faceValue: s.faceValue,
    priceBand: parseFloat(s.priceBand) || undefined,
    mktCap: s.marketCap,
    preClose: s.preClose,
  };
}

function applyFilter(
  gainers: readonly MarketStock[],
  losers: readonly MarketStock[],
  filter?: string,
): MarketStock[] {
  const all = [...gainers, ...losers];

  switch (filter) {
    case "onlyBuyers":
      return gainers.filter(
        (s) =>
          s.priceBand !== "No Band" &&
          s.percentChange >= parseFloat(s.priceBand),
      );
    case "onlySellers":
      return losers.filter(
        (s) =>
          s.priceBand !== "No Band" &&
          Math.abs(s.percentChange) >= parseFloat(s.priceBand),
      );
    case "priceShockers":
      return all
        .filter((s) => Math.abs(s.percentChange) >= 5)
        .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
    case "volumeShockers":
      return all
        .filter((s) => (s.volume ?? 0) > 0)
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
        .slice(0, 100);
    case "mostActiveByValue":
      return all
        .filter((s) => (s.volume ?? 0) > 0)
        .sort((a, b) => b.cmp * (b.volume ?? 0) - a.cmp * (a.volume ?? 0))
        .slice(0, 100);
    default:
      return all;
  }
}

function createMarketPageUrl(
  exchange: Exchange,
  filter: MarketMoverFilter,
  page: number,
): string {
  const searchParameters = new URLSearchParams({
    exchange,
    filter,
    page: String(page),
    pageSize: String(MARKET_PAGE_SIZE),
    sort: "pctChange",
    order: filter === "gainers" ? "desc" : "asc",
  });

  return `/api/market/live?${searchParameters.toString()}`;
}

function createScreenPageUrl(
  exchange: Exchange,
  screen: ServerScreen,
  page: number,
): string {
  const searchParameters = new URLSearchParams({
    exchange,
    filter: "all",
    hit: screen.hit,
    ath: screen.ath,
    page: String(page),
    pageSize: String(MARKET_PAGE_SIZE),
    sort: "pctChange",
    order: "desc",
  });

  return `/api/market/live?${searchParameters.toString()}`;
}

function getRemainingPageNumbers(totalPages: number): number[] {
  if (
    !Number.isSafeInteger(totalPages) ||
    totalPages < 0 ||
    totalPages > MAX_MARKET_DATA_PAGES
  ) {
    throw new MarketDataResponseError();
  }

  return Array.from(
    { length: Math.max(0, totalPages - 1) },
    (_, index) => index + 2,
  );
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalFiniteNumber(value: unknown): boolean {
  return value === undefined || isFiniteNumber(value);
}

function isMarketStock(value: unknown): value is MarketStock {
  if (!isUnknownRecord(value)) {
    return false;
  }

  return (
    REQUIRED_STOCK_STRING_FIELDS.every(
      (field) => typeof value[field] === "string",
    ) &&
    REQUIRED_STOCK_NUMBER_FIELDS.every((field) =>
      isFiniteNumber(value[field]),
    ) &&
    isOptionalFiniteNumber(value.open) &&
    isOptionalFiniteNumber(value.high) &&
    isOptionalFiniteNumber(value.low) &&
    isOptionalFiniteNumber(value.week52High) &&
    isOptionalFiniteNumber(value.week52Low) &&
    isOptionalFiniteNumber(value.ath) &&
    isOptionalFiniteNumber(value.atl) &&
    isOptionalFiniteNumber(value.volume)
  );
}

function isMarketPageResponse(value: unknown): value is MarketPageResponse {
  if (!isUnknownRecord(value) || !Array.isArray(value.stocks)) {
    return false;
  }

  const pagination = value.pagination;
  if (!isUnknownRecord(pagination)) {
    return false;
  }

  const totalPages = pagination.totalPages;
  return (
    value.stocks.every(isMarketStock) &&
    typeof totalPages === "number" &&
    Number.isSafeInteger(totalPages) &&
    totalPages >= 0 &&
    (value.lastSyncAt === null ||
      value.lastSyncAt === undefined ||
      typeof value.lastSyncAt === "string")
  );
}

function getMarketDataErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && isUnknownRecord(error.response?.data)) {
    const responseMessage =
      error.response.data.error ?? error.response.data.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }
  }

  return error instanceof Error && error.message.trim()
    ? error.message
    : MARKET_DATA_UNAVAILABLE_MESSAGE;
}

async function fetchMarketPage(url: string): Promise<MarketPageResponse> {
  const response = await apiClient.get<unknown>(url);
  if (!isMarketPageResponse(response.data)) {
    throw new MarketDataResponseError();
  }

  return response.data;
}

async function fetchAllMoverStocks(
  exchange: Exchange,
  filter: MarketMoverFilter,
): Promise<MoverStocksResult> {
  const firstPage = await fetchMarketPage(
    createMarketPageUrl(exchange, filter, 1),
  );
  const stocks = [...firstPage.stocks];
  const remainingPageNumbers = getRemainingPageNumbers(
    firstPage.pagination.totalPages,
  );

  for (
    let startingIndex = 0;
    startingIndex < remainingPageNumbers.length;
    startingIndex += PAGE_REQUEST_CONCURRENCY
  ) {
    const pageNumbers = remainingPageNumbers.slice(
      startingIndex,
      startingIndex + PAGE_REQUEST_CONCURRENCY,
    );
    const pageResponses = await Promise.all(
      pageNumbers.map((page) =>
        fetchMarketPage(createMarketPageUrl(exchange, filter, page)),
      ),
    );

    for (const pageResponse of pageResponses) {
      stocks.push(...pageResponse.stocks);
    }
  }

  return { stocks, lastSyncAt: firstPage.lastSyncAt ?? null };
}

/**
 * Loads every page of a server-evaluated breakout screen (52-week or
 * all-time high/low). The server already filtered to the breakout stocks, so
 * every returned row is displayed as-is.
 */
async function fetchAllScreenStocks(
  exchange: Exchange,
  screen: ServerScreen,
): Promise<MoverStocksResult> {
  const firstPage = await fetchMarketPage(
    createScreenPageUrl(exchange, screen, 1),
  );
  const stocks = [...firstPage.stocks];
  const remainingPageNumbers = getRemainingPageNumbers(
    firstPage.pagination.totalPages,
  );

  for (
    let startingIndex = 0;
    startingIndex < remainingPageNumbers.length;
    startingIndex += PAGE_REQUEST_CONCURRENCY
  ) {
    const pageNumbers = remainingPageNumbers.slice(
      startingIndex,
      startingIndex + PAGE_REQUEST_CONCURRENCY,
    );
    const pageResponses = await Promise.all(
      pageNumbers.map((page) =>
        fetchMarketPage(createScreenPageUrl(exchange, screen, page)),
      ),
    );

    for (const pageResponse of pageResponses) {
      stocks.push(...pageResponse.stocks);
    }
  }

  return { stocks, lastSyncAt: firstPage.lastSyncAt ?? null };
}

interface ScreenerPageProps {
  screenerType: ScreenerType;
}

function ScreenerContent({ screenerType }: ScreenerPageProps) {
  const config = screenerConfigs[screenerType];
  const serverScreen = SERVER_SCREENS[screenerType];
  const [gainers, setGainers] = useState<MarketStock[]>([]);
  const [losers, setLosers] = useState<MarketStock[]>([]);
  const [screenStocks, setScreenStocks] = useState<MarketStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exchange, setExchange] = useState<Exchange>("NSE");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const handleExchangeChange = useCallback((nextExchange: Exchange) => {
    setLoading(true);
    setExchange(nextExchange);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      if (serverScreen) {
        const result = await fetchAllScreenStocks(exchange, serverScreen);
        setScreenStocks(result.stocks);
        setGainers([]);
        setLosers([]);
        setLastSyncAt(result.lastSyncAt);
      } else {
        const [nextGainers, nextLosers] = await Promise.all([
          fetchAllMoverStocks(exchange, "gainers"),
          fetchAllMoverStocks(exchange, "losers"),
        ]);
        setGainers(nextGainers.stocks);
        setLosers(nextLosers.stocks);
        setScreenStocks([]);
        setLastSyncAt(nextGainers.lastSyncAt ?? nextLosers.lastSyncAt);
      }
      setErrorMessage(null);
    } catch (error: unknown) {
      setErrorMessage(getMarketDataErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [exchange, serverScreen]);

  useEffect(() => {
    const initialFetchTimer = window.setTimeout(() => {
      void fetchData();
    }, 0);
    const refreshInterval = window.setInterval(() => {
      void fetchData();
    }, 30_000);

    return () => {
      window.clearTimeout(initialFetchTimer);
      window.clearInterval(refreshInterval);
    };
  }, [fetchData]);

  const stocks = useMemo(() => {
    let source: MarketStock[];
    if (serverScreen) {
      source = screenStocks;
    } else {
      const filterType = "filter" in config ? config.filter : undefined;
      if (filterType) {
        source = applyFilter(gainers, losers, filterType);
      } else if (config.dataSource === "gainers") {
        source = gainers;
      } else if (config.dataSource === "losers") {
        source = losers;
      } else {
        source = [...gainers, ...losers];
      }
    }
    return source.map((s, i) => ({ ...s, id: `${i + 1}` }));
  }, [gainers, losers, screenStocks, serverScreen, config]);

  const tableData = useMemo(() => stocks.map(toTableStock), [stocks]);
  const screenerConfig: ScreenerConfig = config;
  const unavailableReason = screenerConfig.unavailableReason;

  if (loading) {
    return <LoadingSpinner message={config.loadingMessage} />;
  }

  return (
    <>
      {errorMessage ? (
        <p
          role="alert"
          className="mx-6 mt-4 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
        >
          {errorMessage}
        </p>
      ) : null}
      <TopGainersLosersTable
        data={tableData}
        type={config.tableType}
        exchange={exchange}
        onExchangeChange={handleExchangeChange}
        index="NIFTY 500"
        lastSyncAt={lastSyncAt}
        unavailableReason={unavailableReason}
      />
    </>
  );
}

export function ScreenerPage({ screenerType }: ScreenerPageProps) {
  const config = screenerConfigs[screenerType];

  return (
    <AuthGuard loadingMessage={config.loadingMessage}>
      <ScreenerContent screenerType={screenerType} />
    </AuthGuard>
  );
}

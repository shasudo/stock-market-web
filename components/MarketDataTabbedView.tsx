"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Settings } from "lucide-react";
import Link from "next/link";
import IndicesDataTable, {
  type IndexData,
} from "@/components/IndicesDataTable";
import {
  fetchAllLiveMarketStocks,
  getLiveMarketClientErrorMessage,
  isLiveMarketRequestAborted,
} from "@/lib/market/live-market-client";
import type {
  MarketAddedColumnValue,
  MarketStockData,
} from "@/lib/market/client-contract";
import {
  fetchFundamentalsTable,
  getFundamentalsTableErrorMessage,
  isFundamentalsTableRequestAborted,
} from "@/lib/market/fundamentals-table-client";
import type { FundamentalsTableRow } from "@/lib/market/fundamentals-table-client";
import {
  fetchSeasonality,
  getSeasonalityErrorMessage,
  isSeasonalityRequestAborted,
} from "@/lib/market/seasonality-client";
import type { SeasonalityRow } from "@/lib/market/seasonality-client";
import { isMarketColumnValuesResponse } from "@/lib/market/client-contract";
import {
  fetchIndexQuoteSnapshot,
  getIndexQuoteClientErrorMessage,
  isIndexQuoteRequestAborted,
} from "@/lib/market/instrument-quote-client";
import type { IndexQuoteDTO } from "@/lib/market/instrument-quote-client";
import { DataFreshness } from "@/components/common/DataFreshness";
import { StockActionsMenu } from "@/components/common/StockActionsMenu";
import { SearchInput, matchesSearch } from "@/components/common/SearchInput";
import {
  filterIndicesByCategory,
  type IndexCategory,
} from "@/lib/market-data/index-categories";

import { unwrapApiEnvelope } from "@/lib/api-envelope";
const REFRESH_INTERVAL_MS = 30_000;

function toIndexData(quote: IndexQuoteDTO): IndexData {
  return {
    name: quote.displayName,
    current: quote.lastPrice,
    changePercent: quote.pctChange,
    open: quote.open ?? quote.lastPrice,
    high: quote.high ?? quote.lastPrice,
    low: quote.low ?? quote.lastPrice,
    // Not carried by any data source — shown as "-" by IndicesDataTable.
    indicativeClose: null,
    prevClose: quote.prevClose,
    prevDay: quote.prevDay,
    oneWeekAgo: quote.oneWeekAgo,
    oneMonthAgo: quote.oneMonthAgo,
    oneYearAgo: quote.oneYearAgo,
    fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
  };
}

// Row shape rendered by the stock tables — every tab (including F&O
// stocks) reads the real live-market pipeline now.
interface MarketRow {
  id: string;
  symbol: string;
  stockName: string;
  sector: string;
  industry: string;
  group: string;
  faceValue: number;
  priceBand: string;
  mktCap: string;
  preClose: number;
  price: number;
  change: number;
  changePercent: number;
  sparklineData: number[];
}

function fromMarketStock(s: MarketStockData): MarketRow {
  return {
    id: s.id,
    symbol: s.tradingSymbol,
    stockName: s.companyName || s.tradingSymbol,
    sector: s.sector,
    industry: s.industry,
    group: s.group,
    faceValue: s.faceValue,
    priceBand: s.priceBand,
    mktCap: s.marketCap,
    preClose: s.preClose,
    price: s.cmp,
    change: s.netChange,
    changePercent: s.percentChange,
    // Not carried by the live-market API — left empty rather than faked.
    sparklineData: [],
  };
}

type SubTabId =
  | "overview"
  | "fundamental"
  | "returns"
  | "financials"
  | "technicals"
  | "seasonality";

const RETURNS_COLUMNS: readonly { readonly key: string; readonly label: string }[] = [
  { key: "% Chag", label: "1D" },
  { key: "% 1W Chag", label: "1W" },
  { key: "% 1M Chag", label: "1M" },
  { key: "% 3M Chag", label: "3M" },
  { key: "% 6M Chag", label: "6M" },
  { key: "% 1Y Chag", label: "1Y" },
  { key: "% YTD Chag", label: "YTD" },
  { key: "% 52W Chag", label: "52W" },
];

const TECHNICAL_COLUMNS: readonly { readonly id: string; readonly label: string }[] = [
  { id: "tf-1day:indicators:rsi-14", label: "RSI 14" },
  { id: "tf-1day:indicators:sma-20", label: "SMA 20" },
  { id: "tf-1day:indicators:sma-50", label: "SMA 50" },
  { id: "tf-1day:indicators:sma-200", label: "SMA 200" },
];

const TECH_REQUEST_CONCURRENCY = 4;
const TECH_INSTRUMENTS_PER_REQUEST = 200;

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function changeTextClasses(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-muted-foreground";
  return value >= 0 ? "text-success" : "text-error";
}

function formatCrore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `₹${Math.round(value).toLocaleString("en-IN")} Cr`;
}

function fundamentalsKey(exchange: string, symbol: string): string {
  return `${exchange}:${symbol.toUpperCase()}`;
}

function seasonalityKey(exchangeSegment: string, securityId: number): string {
  return `${exchangeSegment}:${securityId}`;
}

export const COLUMN_VALUES_UNAVAILABLE_MESSAGE =
  "Technical data is temporarily unavailable. Please try again shortly.";

export class ColumnValuesClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ColumnValuesClientError";
  }
}

function getColumnValuesErrorMessage(error: unknown): string {
  return error instanceof ColumnValuesClientError
    ? error.message
    : COLUMN_VALUES_UNAVAILABLE_MESSAGE;
}

function isColumnValuesAborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function fetchTechnicalValues(
  instruments: readonly {
    readonly securityId: number;
    readonly exchange: string;
    readonly exchangeSegment: string;
  }[],
  signal?: AbortSignal,
): Promise<Record<string, Record<string, MarketAddedColumnValue>>> {
  const response = await fetch("/api/market/column-values", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      selection: {
        timeframes: ["tf-1day"],
        groups: {
          indicators: ["rsi-14", "sma-20", "sma-50", "sma-200"],
        },
      },
      instruments,
    }),
    signal,
  });
  const body: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      typeof (body as Record<string, unknown>).message === "string" &&
      ((body as Record<string, unknown>).message as string).trim()
        ? ((body as Record<string, unknown>).message as string)
        : COLUMN_VALUES_UNAVAILABLE_MESSAGE;
    throw new ColumnValuesClientError(message);
  }
  if (!isMarketColumnValuesResponse(body)) {
    throw new ColumnValuesClientError(COLUMN_VALUES_UNAVAILABLE_MESSAGE);
  }
  return body.values as Record<string, Record<string, MarketAddedColumnValue>>;
}

type TabType =
  | "indicesFno"
  | "broadMarket"
  | "sectoralIndices"
  | "stocks"
  | "sectors"
  | "industry"
  | "fnoStocks";

interface MarketDataTabbedViewProps {
  initialTab?: TabType;
}

const SparklineChart = ({ data }: { data: number[] }) => {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const isPositive = data[data.length - 1] >= data[0];

  return (
    <svg width="80" height="30" className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={isPositive ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
      />
    </svg>
  );
};

const categoryInfo: Record<TabType, { title: string; description: string }> = {
  indicesFno: {
    title: "INDICES IN F&O",
    description:
      "Indices eligible for Futures and Options trading on NSE. These derivative-eligible indices include benchmark indices like NIFTY 50, NIFTY BANK and other key indices with active derivatives contracts....",
  },
  broadMarket: {
    title: "BROAD MARKET INDICES",
    description:
      "Broad market indices covering large-cap, mid-cap, small-cap and multi-cap segments. Track overall market breadth and performance across different market capitalization segments....",
  },
  sectoralIndices: {
    title: "SECTORAL INDICES",
    description:
      "NSE sectoral indices tracking performance of specific sectors like Auto, IT, Pharma, Banking, FMCG, Metal, Realty and more. Identify sector trends and rotation patterns....",
  },
  stocks: {
    title: "ALL STOCKS",
    description:
      "Comprehensive listing of all stocks trading on NSE/BSE with real-time prices, market capitalization, sector classification, and detailed performance metrics. Filter by exchange, index, and various parameters....",
  },
  sectors: {
    title: "SECTOR-WISE PERFORMANCE",
    description:
      "Sector indices showing aggregate performance of stocks grouped by sectors like Banking, IT, Pharma, Auto, FMCG, and more. Track sector rotation and identify trending industries....",
  },
  industry: {
    title: "INDUSTRY-WISE PERFORMANCE",
    description:
      "Industry-wise market performance showing granular classification within sectors. Analyze sub-sector trends like Software Services, Private Banks, Steel Products, and more for detailed insights....",
  },
  fnoStocks: {
    title: "F&O ELIGIBLE STOCKS",
    description:
      "Stocks eligible for Futures and Options trading with higher liquidity and institutional participation. These stocks meet NSE/BSE criteria for derivatives trading....",
  },
};

const subTabs: readonly { readonly id: SubTabId; readonly label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "fundamental", label: "Fundamental" },
  { id: "returns", label: "Returns" },
  { id: "financials", label: "Financials" },
  { id: "technicals", label: "Technicals" },
  { id: "seasonality", label: "Seasonality Analysis for Dec" },
];

export default function MarketDataTabbedView({
  initialTab = "stocks",
}: MarketDataTabbedViewProps) {
  const [activeCategory, setActiveCategory] = useState<TabType>(initialTab);
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>("overview");
  const [search, setSearch] = useState("");
  const [selectedExchange, setSelectedExchange] = useState<"NSE" | "BSE">(
    "NSE",
  );
  const [liveStocks, setLiveStocks] = useState<MarketStockData[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(true);
  const [liveErrorMessage, setLiveErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [indexQuotes, setIndexQuotes] = useState<IndexQuoteDTO[]>([]);
  const [indicesLastSyncAt, setIndicesLastSyncAt] = useState<string | null>(
    null,
  );
  const [isLoadingIndices, setIsLoadingIndices] = useState(true);
  const [indicesErrorMessage, setIndicesErrorMessage] = useState<string | null>(
    null,
  );
  const [indicesStreaming, setIndicesStreaming] = useState(true);
  const [hasIndexSnapshot, setHasIndexSnapshot] = useState(false);
  const selectedIndex = "NIFTY 500";
  const selectedPeriod = "1 Day";

  const isIndicesTab =
    activeCategory === "indicesFno" ||
    activeCategory === "broadMarket" ||
    activeCategory === "sectoralIndices";

  // Every stock tab (including F&O stocks) reads the real live-market
  // pipeline. F&O screens to derivative-eligible underlyings server-side.
  const needsLiveStocks = !isIndicesTab;
  const needsFnoStocks = activeCategory === "fnoStocks";

  const [fundamentals, setFundamentals] = useState<
    ReadonlyMap<string, FundamentalsTableRow>
  >(new Map());
  const [isLoadingFundamentals, setIsLoadingFundamentals] = useState(false);
  const [fundamentalsError, setFundamentalsError] = useState<string | null>(
    null,
  );
  const [seasonality, setSeasonality] = useState<
    ReadonlyMap<string, SeasonalityRow>
  >(new Map());
  const [isLoadingSeasonality, setIsLoadingSeasonality] = useState(false);
  const [seasonalityError, setSeasonalityError] = useState<string | null>(null);
  const [techValues, setTechValues] = useState<
    Record<string, Record<string, MarketAddedColumnValue>>
  >({});
  const [isLoadingTech, setIsLoadingTech] = useState(false);
  const [techError, setTechError] = useState<string | null>(null);

  const needsFundamentals =
    needsLiveStocks &&
    (activeSubTab === "fundamental" || activeSubTab === "financials");
  const needsSeasonality =
    needsLiveStocks && activeSubTab === "seasonality";

  useEffect(() => {
    if (!needsLiveStocks) return;

    const controller = new AbortController();
    let isCurrentRequest = true;

    const loadLiveStocks = async (): Promise<void> => {
      setIsLoadingLive(true);
      try {
        const stocks = await fetchAllLiveMarketStocks(
          {
            exchange: selectedExchange,
            ...(needsFnoStocks ? { fnoOnly: true } : {}),
          },
          controller.signal,
        );
        if (!isCurrentRequest) return;
        setLiveStocks([...stocks]);
        setLiveErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrentRequest || isLiveMarketRequestAborted(error)) return;
        setLiveErrorMessage(getLiveMarketClientErrorMessage(error));
      } finally {
        if (isCurrentRequest) setIsLoadingLive(false);
      }
    };

    void loadLiveStocks();

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [needsLiveStocks, needsFnoStocks, selectedExchange, refreshVersion]);

  // Fundamentals + seasonality change daily at most: load on tab activation
  // and exchange change, not on every 30s live tick.
  useEffect(() => {
    if (!needsFundamentals) return;

    const controller = new AbortController();
    let isCurrentRequest = true;

    const loadFundamentals = async (): Promise<void> => {
      setIsLoadingFundamentals(true);
      try {
        const table = await fetchFundamentalsTable(
          selectedExchange,
          controller.signal,
        );
        if (!isCurrentRequest) return;
        const byKey = new Map<string, FundamentalsTableRow>();
        for (const row of table.rows) {
          byKey.set(fundamentalsKey(row.exchange, row.symbol), row);
        }
        setFundamentals(byKey);
        setFundamentalsError(null);
      } catch (error: unknown) {
        if (!isCurrentRequest || isFundamentalsTableRequestAborted(error)) {
          return;
        }
        setFundamentalsError(getFundamentalsTableErrorMessage(error));
      } finally {
        if (isCurrentRequest) setIsLoadingFundamentals(false);
      }
    };

    void loadFundamentals();

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [needsFundamentals, selectedExchange]);

  useEffect(() => {
    if (!needsSeasonality) return;

    const controller = new AbortController();
    let isCurrentRequest = true;

    const loadSeasonality = async (): Promise<void> => {
      setIsLoadingSeasonality(true);
      try {
        const response = await fetchSeasonality(
          selectedExchange,
          controller.signal,
        );
        if (!isCurrentRequest) return;
        const byKey = new Map<string, SeasonalityRow>();
        for (const row of response.stats) {
          byKey.set(
            seasonalityKey(row.exchangeSegment, row.securityId),
            row,
          );
        }
        setSeasonality(byKey);
        setSeasonalityError(null);
      } catch (error: unknown) {
        if (!isCurrentRequest || isSeasonalityRequestAborted(error)) return;
        setSeasonalityError(getSeasonalityErrorMessage(error));
      } finally {
        if (isCurrentRequest) setIsLoadingSeasonality(false);
      }
    };

    void loadSeasonality();

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [needsSeasonality, selectedExchange]);

  // Technicals are computed on demand for the visible universe: load when the
  // tab opens (or the universe changes size), not on every live tick.
  const liveStockCount = liveStocks.length;
  useEffect(() => {
    if (
      !needsLiveStocks ||
      activeSubTab !== "technicals" ||
      liveStockCount === 0
    ) {
      return;
    }

    const controller = new AbortController();
    let isCurrentRequest = true;

    const loadTechnicals = async (): Promise<void> => {
      setIsLoadingTech(true);
      try {
        const instruments = liveStocks.map((stock) => ({
          securityId: stock.securityId,
          exchange: stock.exchange,
          exchangeSegment: stock.exchangeSegment,
        }));
        const merged: Record<string, Record<string, MarketAddedColumnValue>> =
          {};
        for (
          let start = 0;
          start < instruments.length;
          start +=
            TECH_INSTRUMENTS_PER_REQUEST * TECH_REQUEST_CONCURRENCY
        ) {
          if (!isCurrentRequest) return;
          const batches = [];
          for (
            let batch = 0;
            batch < TECH_REQUEST_CONCURRENCY;
            batch += 1
          ) {
            const slice = instruments.slice(
              start + batch * TECH_INSTRUMENTS_PER_REQUEST,
              start + (batch + 1) * TECH_INSTRUMENTS_PER_REQUEST,
            );
            if (slice.length === 0) continue;
            batches.push(
              fetchTechnicalValues(slice, controller.signal),
            );
          }
          const results = await Promise.all(batches);
          if (!isCurrentRequest) return;
          for (const values of results) {
            for (const [key, columns] of Object.entries(values)) {
              merged[key] = { ...(merged[key] ?? {}), ...columns };
            }
          }
        }
        if (!isCurrentRequest) return;
        setTechValues(merged);
        setTechError(null);
      } catch (error: unknown) {
        if (!isCurrentRequest || isColumnValuesAborted(error)) return;
        setTechError(getColumnValuesErrorMessage(error));
      } finally {
        if (isCurrentRequest) setIsLoadingTech(false);
      }
    };

    void loadTechnicals();

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsLiveStocks, activeSubTab, selectedExchange, liveStockCount]);

  useEffect(() => {
    if (!isIndicesTab) return;
    // Paused and already holding a snapshot: ignore the global tick and keep
    // the frozen frame. Resuming (or arriving with no data) fetches again.
    if (!indicesStreaming && hasIndexSnapshot) return;

    const controller = new AbortController();
    let isCurrentRequest = true;

    const loadIndices = async (): Promise<void> => {
      setIsLoadingIndices(true);
      try {
        const snapshot = await fetchIndexQuoteSnapshot(controller.signal);
        if (!isCurrentRequest) return;
        setIndexQuotes([...snapshot.indices]);
        setHasIndexSnapshot(true);
        setIndicesLastSyncAt(snapshot.lastSyncAt);
        setIndicesErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrentRequest || isIndexQuoteRequestAborted(error)) return;
        setIndicesErrorMessage(getIndexQuoteClientErrorMessage(error));
      } finally {
        if (isCurrentRequest) setIsLoadingIndices(false);
      }
    };

    void loadIndices();

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [isIndicesTab, refreshVersion, indicesStreaming, hasIndexSnapshot]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      setRefreshVersion((version) => version + 1);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(refreshTimer);
  }, []);

  const categoryTabs = [
    { id: "indicesFno", label: "Indices in F&O" },
    { id: "broadMarket", label: "Broad Market Indices" },
    { id: "sectoralIndices", label: "Sectoral Indices" },
    { id: "stocks", label: "Stocks" },
    { id: "sectors", label: "Sectors" },
    { id: "industry", label: "Industry" },
    { id: "fnoStocks", label: "F&O Stocks" },
  ];

  const allRows: MarketRow[] = liveStocks.map(fromMarketStock);
  const data = allRows.filter((row) =>
    matchesSearch(search, row.symbol, row.stockName, row.sector, row.industry),
  );
  // Full live rows for the sub-tabs (security/segment keys for technicals,
  // seasonality and fundamentals joins), under the same search filter.
  const filteredStocks = liveStocks.filter((stock) =>
    matchesSearch(
      search,
      stock.tradingSymbol,
      stock.companyName,
      stock.sector,
      stock.industry,
    ),
  );

  const stockNameCell = (stock: MarketStockData) => (
    <Link
      href={`/stock/${encodeURIComponent(stock.tradingSymbol)}`}
      className="text-primary hover:text-info font-medium"
    >
      {stock.companyName || stock.tradingSymbol}
    </Link>
  );

  const tabAlert = (message: string) => (
    <p
      role="alert"
      className="mx-6 mt-4 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
    >
      {message}
    </p>
  );

  const tabLoading = (message: string) => (
    <div className="px-6 py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );

  const renderReturnsTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-muted/90 border-b border-border">
            <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
              #
            </th>
            <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
              Company
            </th>
            <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
              LTP
            </th>
            {RETURNS_COLUMNS.map((column) => (
              <th
                key={column.key}
                className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-card">
          {filteredStocks.map((stock, index) => (
            <tr
              key={`${stock.exchange}:${stock.securityId}`}
              className="border-b border-border hover:bg-muted transition-colors"
            >
              <td className="px-2 py-3 text-foreground">{index + 1}</td>
              <td className="px-2 py-3">{stockNameCell(stock)}</td>
              <td className="px-2 py-3 text-right font-bold text-foreground">
                ₹{stock.cmp.toFixed(2)}
              </td>
              {RETURNS_COLUMNS.map((column) => {
                const value = stock.percentChanges[column.key] ?? null;
                return (
                  <td
                    key={column.key}
                    className={`px-2 py-3 text-right font-semibold ${changeTextClasses(value)}`}
                  >
                    {formatSignedPercent(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderFundamentalTable = () => {
    if (fundamentalsError) return tabAlert(fundamentalsError);
    if (isLoadingFundamentals && fundamentals.size === 0) {
      return tabLoading("Loading fundamental data…");
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/90 border-b border-border">
              <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
                #
              </th>
              <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
                Company
              </th>
              <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
                LTP
              </th>
              {["P/E", "EPS", "BV", "ROE %", "Net Margin %", "Op Margin %", "Div Yield", "Beta", "Revenue TTM"].map(
                (label) => (
                  <th
                    key={label}
                    className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="bg-card">
            {filteredStocks.map((stock, index) => {
              const row = fundamentals.get(
                fundamentalsKey(stock.exchange, stock.tradingSymbol),
              );
              return (
                <tr
                  key={`${stock.exchange}:${stock.securityId}`}
                  className="border-b border-border hover:bg-muted transition-colors"
                >
                  <td className="px-2 py-3 text-foreground">{index + 1}</td>
                  <td className="px-2 py-3">{stockNameCell(stock)}</td>
                  <td className="px-2 py-3 text-right font-bold text-foreground">
                    ₹{stock.cmp.toFixed(2)}
                  </td>
                  <td className="px-2 py-3 text-right text-foreground">
                    {formatNumber(row?.pe)}
                  </td>
                  <td className="px-2 py-3 text-right text-foreground">
                    {formatNumber(row?.eps)}
                  </td>
                  <td className="px-2 py-3 text-right text-foreground">
                    {formatNumber(row?.bookValue)}
                  </td>
                  <td className="px-2 py-3 text-right text-foreground">
                    {row?.roe == null ? "—" : `${row.roe.toFixed(2)}%`}
                  </td>
                  <td className="px-2 py-3 text-right text-foreground">
                    {row?.profitMargin == null
                      ? "—"
                      : `${row.profitMargin.toFixed(2)}%`}
                  </td>
                  <td className="px-2 py-3 text-right text-foreground">
                    {row?.operatingMargin == null
                      ? "—"
                      : `${row.operatingMargin.toFixed(2)}%`}
                  </td>
                  <td className="px-2 py-3 text-right text-foreground">
                    {formatNumber(row?.dividendYield)}
                  </td>
                  <td className="px-2 py-3 text-right text-foreground">
                    {formatNumber(row?.beta)}
                  </td>
                  <td className="px-2 py-3 text-right text-foreground">
                    {formatCrore(row?.revenueTtm)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderFinancialsTable = () => {
    if (fundamentalsError) return tabAlert(fundamentalsError);
    if (isLoadingFundamentals && fundamentals.size === 0) {
      return tabLoading("Loading financial statements…");
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/90 border-b border-border">
              <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
                #
              </th>
              <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
                Company
              </th>
              <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
                LTP
              </th>
              <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
                Revenue FY
              </th>
              <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
                Net Profit FY
              </th>
              <th className="px-2 py-2 text-center font-semibold text-foreground uppercase tracking-wide">
                FY End
              </th>
            </tr>
          </thead>
          <tbody className="bg-card">
            {filteredStocks.map((stock, index) => {
              const row = fundamentals.get(
                fundamentalsKey(stock.exchange, stock.tradingSymbol),
              );
              return (
                <tr
                  key={`${stock.exchange}:${stock.securityId}`}
                  className="border-b border-border hover:bg-muted transition-colors"
                >
                  <td className="px-2 py-3 text-foreground">{index + 1}</td>
                  <td className="px-2 py-3">{stockNameCell(stock)}</td>
                  <td className="px-2 py-3 text-right font-bold text-foreground">
                    ₹{stock.cmp.toFixed(2)}
                  </td>
                  <td className="px-2 py-3 text-right text-foreground">
                    {formatCrore(row?.revenueAnnual)}
                  </td>
                  <td
                    className={`px-2 py-3 text-right ${changeTextClasses(row?.netIncomeAnnual)}`}
                  >
                    {row?.netIncomeAnnual == null
                      ? "—"
                      : `₹${Math.round(row.netIncomeAnnual).toLocaleString("en-IN")} Cr`}
                  </td>
                  <td className="px-2 py-3 text-center text-foreground">
                    {row?.revenueAnnualDate
                      ? row.revenueAnnualDate.slice(0, 4)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTechnicalsTable = () => {
    if (techError) return tabAlert(techError);
    if (isLoadingTech && Object.keys(techValues).length === 0) {
      return tabLoading("Computing technical indicators…");
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/90 border-b border-border">
              <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
                #
              </th>
              <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
                Company
              </th>
              <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
                LTP
              </th>
              <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
                % Change
              </th>
              {TECHNICAL_COLUMNS.map((column) => (
                <th
                  key={column.id}
                  className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-card">
            {filteredStocks.map((stock, index) => {
              const values =
                techValues[
                  seasonalityKey(stock.exchangeSegment, stock.securityId)
                ] ?? {};
              return (
                <tr
                  key={`${stock.exchange}:${stock.securityId}`}
                  className="border-b border-border hover:bg-muted transition-colors"
                >
                  <td className="px-2 py-3 text-foreground">{index + 1}</td>
                  <td className="px-2 py-3">{stockNameCell(stock)}</td>
                  <td className="px-2 py-3 text-right font-bold text-foreground">
                    ₹{stock.cmp.toFixed(2)}
                  </td>
                  <td
                    className={`px-2 py-3 text-right font-semibold ${changeTextClasses(stock.percentChange)}`}
                  >
                    {formatSignedPercent(stock.percentChange)}
                  </td>
                  {TECHNICAL_COLUMNS.map((column) => {
                    const value = values[column.id];
                    const ready = value?.state === "ready";
                    return (
                      <td
                        key={column.id}
                        title={ready ? undefined : (value?.message ?? "Not available")}
                        className="px-2 py-3 text-right font-mono text-foreground"
                      >
                        {ready ? value.display : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSeasonalityTable = () => {
    if (seasonalityError) return tabAlert(seasonalityError);
    if (isLoadingSeasonality && seasonality.size === 0) {
      return tabLoading("Loading December seasonality…");
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/90 border-b border-border">
              <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
                #
              </th>
              <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
                Company
              </th>
              <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
                LTP
              </th>
              {["Dec Avg %", "Hit Rate %", "Decembers", "Best Dec %", "Worst Dec %"].map(
                (label) => (
                  <th
                    key={label}
                    className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="bg-card">
            {filteredStocks.map((stock, index) => {
              const row = seasonality.get(
                seasonalityKey(stock.exchangeSegment, stock.securityId),
              );
              return (
                <tr
                  key={`${stock.exchange}:${stock.securityId}`}
                  className="border-b border-border hover:bg-muted transition-colors"
                >
                  <td className="px-2 py-3 text-foreground">{index + 1}</td>
                  <td className="px-2 py-3">{stockNameCell(stock)}</td>
                  <td className="px-2 py-3 text-right font-bold text-foreground">
                    ₹{stock.cmp.toFixed(2)}
                  </td>
                  <td
                    className={`px-2 py-3 text-right font-semibold ${changeTextClasses(row?.avg)}`}
                  >
                    {formatSignedPercent(row?.avg)}
                  </td>
                  <td className="px-2 py-3 text-right text-foreground">
                    {row?.hitRate == null ? "—" : `${row.hitRate.toFixed(1)}%`}
                  </td>
                  <td className="px-2 py-3 text-center text-foreground">
                    {row?.years ?? "—"}
                  </td>
                  <td
                    className={`px-2 py-3 text-right font-semibold ${changeTextClasses(row?.best)}`}
                  >
                    {formatSignedPercent(row?.best)}
                  </td>
                  <td
                    className={`px-2 py-3 text-right font-semibold ${changeTextClasses(row?.worst)}`}
                  >
                    {formatSignedPercent(row?.worst)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case "returns":
        return renderReturnsTable();
      case "fundamental":
        return renderFundamentalTable();
      case "financials":
        return renderFinancialsTable();
      case "technicals":
        return renderTechnicalsTable();
      case "seasonality":
        return renderSeasonalityTable();
      case "overview":
      default:
        return null;
    }
  };
  const currentCategoryInfo = categoryInfo[activeCategory];
  const title = currentCategoryInfo.title;
  const description = currentCategoryInfo.description;

  return (
    <div className="min-h-screen bg-background py-6">
      {}
      <div className="border-b border-border px-4 py-3 overflow-x-auto">
        <div className="flex space-x-2">
          {categoryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as TabType)}
              className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                activeCategory === tab.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card text-muted-foreground border border-border hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {}
      <div className="px-6 py-4 border-b border-border">
        <p className="text-sm text-foreground leading-relaxed">
          {description}
          <a href="#" className="text-primary hover:underline ml-1">
            Read more
          </a>
        </p>
      </div>

      {isIndicesTab ? (
        <>
          {}
          <div className="px-6 py-4 flex items-center justify-between border-b border-border">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
              <DataFreshness
                lastSyncAt={indicesLastSyncAt}
                className="text-sm"
              />
            </div>
          </div>

          {indicesErrorMessage ? (
            <p
              role="alert"
              className="mx-6 mt-4 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
            >
              {indicesErrorMessage}
            </p>
          ) : null}

          {isLoadingIndices && indexQuotes.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Loading index data…
            </div>
          ) : (
            <IndicesDataTable
              streaming={indicesStreaming}
              onStreamingChange={setIndicesStreaming}
              title={
                activeCategory === "indicesFno"
                  ? "Indices Eligible in Derivatives"
                  : activeCategory === "broadMarket"
                    ? "Broad Market Indices"
                    : "Sectoral Indices"
              }
              data={filterIndicesByCategory(
                indexQuotes,
                activeCategory as IndexCategory,
              ).map(toIndexData)}
            />
          )}
        </>
      ) : (
        <>
          {}
          <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-border">
            <div className="flex items-center space-x-3">
              {/* No timestamp here: fetchAllLiveMarketStocks does not surface
                  the snapshot's lastSyncAt, and a locally generated one would
                  date days-old rows to this second. */}
              <h1 className="text-xl font-bold text-foreground">
                {title} - {selectedExchange}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search company, symbol, sector..."
                className="relative w-64"
                matchCount={data.length}
                totalCount={allRows.length}
              />

              {}
              <div className="flex items-center space-x-3">
                {(["NSE", "BSE"] as const).map((ex) => (
                  <label key={ex} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="exchange"
                      checked={selectedExchange === ex}
                      onChange={() => setSelectedExchange(ex)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="ml-2 text-sm font-medium text-foreground">
                      {ex}
                    </span>
                  </label>
                ))}
              </div>

              {}
              <button className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted">
                <span className="text-sm font-medium text-foreground">
                  {selectedIndex}
                </span>
                <ChevronDown className="w-4 h-4 text-foreground" />
              </button>

              {}
              <button className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted">
                <span className="text-sm font-medium text-foreground">
                  {selectedPeriod}
                </span>
                <ChevronDown className="w-4 h-4 text-foreground" />
              </button>

              {}
              <button className="p-2 rounded-lg hover:bg-muted">
                <Settings className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>

          {}
          <div className="px-6 border-b border-border">
            <div className="flex space-x-1 overflow-x-auto">
              {subTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                    activeSubTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {needsLiveStocks && liveErrorMessage ? (
            <p
              role="alert"
              className="mx-6 mt-4 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
            >
              {liveErrorMessage}
            </p>
          ) : null}

          {activeSubTab !== "overview" ? (
            renderSubTabContent()
          ) : needsLiveStocks && isLoadingLive && liveStocks.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Loading live stock data…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-muted/90 border-b border-border">
                    <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
                      #
                    </th>
                    <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
                      Company
                    </th>
                    <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
                      Sector
                    </th>
                    <th className="px-2 py-2 text-left font-semibold text-foreground uppercase tracking-wide">
                      Industry
                    </th>
                    <th className="px-2 py-2 text-center font-semibold text-foreground uppercase tracking-wide">
                      Group
                    </th>
                    <th className="px-2 py-2 text-center font-semibold text-foreground uppercase tracking-wide">
                      Face Value
                    </th>
                    <th className="px-2 py-2 text-center font-semibold text-foreground uppercase tracking-wide">
                      Price Band
                    </th>
                    <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
                      Mkt Cap
                    </th>
                    <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
                      Pre Close
                    </th>
                    <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
                      LTP
                    </th>
                    <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
                      Net Change
                    </th>
                    <th className="px-2 py-2 text-right font-semibold text-foreground uppercase tracking-wide">
                      % Change
                    </th>
                    <th className="px-2 py-2 text-center font-semibold text-foreground uppercase tracking-wide">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card">
                  {data.map((stock, index) => (
                    <tr
                      key={stock.id}
                      className="border-b border-border hover:bg-muted transition-colors"
                    >
                      <td className="px-2 py-3 text-foreground">{index + 1}</td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/stock/${encodeURIComponent(stock.symbol)}`}
                            className="text-primary hover:text-info font-medium"
                          >
                            {stock.stockName}
                          </Link>
                          <div className="flex items-center gap-1">
                            <StockActionsMenu
                              stock={{
                                symbol: stock.symbol,
                                name: stock.stockName,
                                ltp: stock.price,
                                sector: stock.sector,
                                industry: stock.industry,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-foreground">
                        {stock.sector && stock.sector !== "-"
                          ? stock.sector
                          : "—"}
                      </td>
                      <td className="px-2 py-3 text-foreground">
                        {stock.industry && stock.industry !== "-"
                          ? stock.industry
                          : "—"}
                      </td>
                      <td className="px-2 py-3 text-center text-foreground">
                        {stock.group || "—"}
                      </td>
                      <td className="px-2 py-3 text-center text-foreground">
                        {stock.faceValue ? `₹${stock.faceValue}` : "—"}
                      </td>
                      <td className="px-2 py-3 text-center text-foreground">
                        {stock.priceBand || "—"}
                      </td>
                      <td className="px-2 py-3 text-right text-foreground">
                        {stock.mktCap || "—"}
                      </td>
                      <td className="px-2 py-3 text-right text-foreground">
                        ₹{(stock.preClose || stock.price).toFixed(2)}
                      </td>
                      <td className="px-2 py-3 text-right font-bold text-foreground">
                        ₹{stock.price.toFixed(2)}
                      </td>
                      <td
                        className={`px-2 py-3 text-right font-semibold ${
                          stock.change >= 0 ? "text-success" : "text-error"
                        }`}
                      >
                        {stock.change >= 0 ? "+" : ""}₹{stock.change.toFixed(2)}
                      </td>
                      <td
                        className={`px-2 py-3 text-right font-semibold ${
                          stock.changePercent >= 0
                            ? "text-success"
                            : "text-error"
                        }`}
                      >
                        {stock.changePercent >= 0 ? "+" : ""}
                        {stock.changePercent.toFixed(2)}%
                      </td>
                      <td className="px-2 py-3 text-center">
                        <SparklineChart data={stock.sparklineData} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

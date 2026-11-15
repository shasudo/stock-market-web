"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BookOpen,
  CalendarDays,
  CandlestickChart,
  Factory,
  Landmark,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  List,
  Percent,
  PieChart,
  Zap,
  type LucideIcon,
} from "lucide-react";
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
import {
  DsTableContainer,
  DsTableScroll,
  DsTable,
  DsTableHeader,
  DsTableBody,
  DsRow,
  DsHead,
  DsCell,
  DsNumCell,
  DsCard,
  DsBadge,
  ChangePill,
  ChangeText,
  LoadingState,
} from "@/components/ds";
import { cn } from "@/lib/utils";

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
    <span
      className={cn(
        "inline-block",
        isPositive
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-rose-700 dark:text-rose-300",
      )}
    >
      <svg width="80" height="30" className="block" aria-hidden="true">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    </span>
  );
};

const categoryInfo: Record<TabType, { title: string; description: string }> = {
  indicesFno: {
    title: "Indices in F&O",
    description:
      "Indices eligible for Futures and Options trading on NSE. These derivative-eligible indices include benchmark indices like NIFTY 50, NIFTY Bank and other key indices with active derivatives contracts.",
  },
  broadMarket: {
    title: "Broad Market Indices",
    description:
      "Broad market indices covering large-cap, mid-cap, small-cap and multi-cap segments. Track overall market breadth and performance across different market capitalization segments.",
  },
  sectoralIndices: {
    title: "Sectoral Indices",
    description:
      "NSE sectoral indices tracking performance of specific sectors like Auto, IT, Pharma, Banking, FMCG, Metal, Realty and more. Identify sector trends and rotation patterns.",
  },
  stocks: {
    title: "All Stocks",
    description:
      "Comprehensive listing of all stocks trading on NSE/BSE with real-time prices, market capitalization, sector classification, and detailed performance metrics. Filter by exchange, index, and various parameters.",
  },
  sectors: {
    title: "Sector-Wise Performance",
    description:
      "Sector indices showing aggregate performance of stocks grouped by sectors like Banking, IT, Pharma, Auto, FMCG, and more. Track sector rotation and identify trending industries.",
  },
  industry: {
    title: "Industry-Wise Performance",
    description:
      "Industry-wise market performance showing granular classification within sectors. Analyze sub-sector trends like Software Services, Private Banks, Steel Products, and more for detailed insights.",
  },
  fnoStocks: {
    title: "F&O Eligible Stocks",
    description:
      "Stocks eligible for Futures and Options trading with higher liquidity and institutional participation. These stocks meet NSE/BSE criteria for derivatives trading.",
  },
};

const subTabs: readonly { readonly id: SubTabId; readonly label: string; readonly icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "fundamental", label: "Fundamental", icon: BookOpen },
  { id: "returns", label: "Returns", icon: Percent },
  { id: "financials", label: "Financials", icon: Landmark },
  { id: "technicals", label: "Technicals", icon: Activity },
  { id: "seasonality", label: "Seasonality Analysis for Dec", icon: CalendarDays },
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

  const categoryTabs: readonly { id: string; label: string; icon: LucideIcon }[] = [
    { id: "indicesFno", label: "Indices in F&O", icon: CandlestickChart },
    { id: "broadMarket", label: "Broad Market Indices", icon: Layers },
    { id: "sectoralIndices", label: "Sectoral Indices", icon: PieChart },
    { id: "stocks", label: "Stocks", icon: List },
    { id: "sectors", label: "Sectors", icon: LayoutGrid },
    { id: "industry", label: "Industry", icon: Factory },
    { id: "fnoStocks", label: "F&O Stocks", icon: Zap },
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
      className="font-medium text-primary hover:underline"
    >
      {stock.companyName || stock.tradingSymbol}
    </Link>
  );

  const tabAlert = (message: string) => (
    <p
      role="alert"
      className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive"
    >
      {message}
    </p>
  );

  const tabLoading = (message: string) => <LoadingState message={message} />;

  const renderReturnsTable = () => (
    <DsTableContainer>
      <DsTableScroll>
        <DsTable>
          <DsTableHeader>
            <DsRow>
              <DsHead align="center">#</DsHead>
              <DsHead>Company</DsHead>
              <DsHead align="right">LTP</DsHead>
              {RETURNS_COLUMNS.map((column) => (
                <DsHead key={column.key} align="right">
                  {column.label}
                </DsHead>
              ))}
            </DsRow>
          </DsTableHeader>
          <DsTableBody>
            {filteredStocks.map((stock, index) => (
              <DsRow key={`${stock.exchange}:${stock.securityId}`}>
                <DsNumCell align="center" className="text-muted-foreground">
                  {index + 1}
                </DsNumCell>
                <DsCell>{stockNameCell(stock)}</DsCell>
                <DsNumCell className="font-bold">₹{stock.cmp.toFixed(2)}</DsNumCell>
                {RETURNS_COLUMNS.map((column) => {
                  const value = stock.percentChanges[column.key] ?? null;
                  return (
                    <DsNumCell key={column.key}>
                      <ChangeText value={value}>{formatSignedPercent(value)}</ChangeText>
                    </DsNumCell>
                  );
                })}
              </DsRow>
            ))}
          </DsTableBody>
        </DsTable>
      </DsTableScroll>
    </DsTableContainer>
  );

  const renderFundamentalTable = () => {
    if (fundamentalsError) return tabAlert(fundamentalsError);
    if (isLoadingFundamentals && fundamentals.size === 0) {
      return tabLoading("Loading fundamental data…");
    }
    return (
      <DsTableContainer>
        <DsTableScroll>
          <DsTable>
            <DsTableHeader>
              <DsRow>
                <DsHead align="center">#</DsHead>
                <DsHead>Company</DsHead>
                <DsHead align="right">LTP</DsHead>
                {["P/E", "EPS", "BV", "ROE %", "Net Margin %", "Op Margin %", "Div Yield", "Beta", "Revenue TTM"].map(
                  (label) => (
                    <DsHead key={label} align="right">
                      {label}
                    </DsHead>
                  ),
                )}
              </DsRow>
            </DsTableHeader>
            <DsTableBody>
              {filteredStocks.map((stock, index) => {
                const row = fundamentals.get(
                  fundamentalsKey(stock.exchange, stock.tradingSymbol),
                );
                return (
                  <DsRow key={`${stock.exchange}:${stock.securityId}`}>
                    <DsNumCell align="center" className="text-muted-foreground">
                      {index + 1}
                    </DsNumCell>
                    <DsCell>{stockNameCell(stock)}</DsCell>
                    <DsNumCell className="font-bold">₹{stock.cmp.toFixed(2)}</DsNumCell>
                    <DsNumCell className="font-normal text-muted-foreground">
                      {formatNumber(row?.pe)}
                    </DsNumCell>
                    <DsNumCell className="font-normal text-muted-foreground">
                      {formatNumber(row?.eps)}
                    </DsNumCell>
                    <DsNumCell className="font-normal text-muted-foreground">
                      {formatNumber(row?.bookValue)}
                    </DsNumCell>
                    <DsNumCell className="font-normal text-muted-foreground">
                      {row?.roe == null ? "—" : `${row.roe.toFixed(2)}%`}
                    </DsNumCell>
                    <DsNumCell className="font-normal text-muted-foreground">
                      {row?.profitMargin == null
                        ? "—"
                        : `${row.profitMargin.toFixed(2)}%`}
                    </DsNumCell>
                    <DsNumCell className="font-normal text-muted-foreground">
                      {row?.operatingMargin == null
                        ? "—"
                        : `${row.operatingMargin.toFixed(2)}%`}
                    </DsNumCell>
                    <DsNumCell className="font-normal text-muted-foreground">
                      {formatNumber(row?.dividendYield)}
                    </DsNumCell>
                    <DsNumCell className="font-normal text-muted-foreground">
                      {formatNumber(row?.beta)}
                    </DsNumCell>
                    <DsNumCell className="font-normal text-muted-foreground">
                      {formatCrore(row?.revenueTtm)}
                    </DsNumCell>
                  </DsRow>
                );
              })}
            </DsTableBody>
          </DsTable>
        </DsTableScroll>
      </DsTableContainer>
    );
  };

  const renderFinancialsTable = () => {
    if (fundamentalsError) return tabAlert(fundamentalsError);
    if (isLoadingFundamentals && fundamentals.size === 0) {
      return tabLoading("Loading financial statements…");
    }
    return (
      <DsTableContainer>
        <DsTableScroll>
          <DsTable>
            <DsTableHeader>
              <DsRow>
                <DsHead align="center">#</DsHead>
                <DsHead>Company</DsHead>
                <DsHead align="right">LTP</DsHead>
                <DsHead align="right">Revenue FY</DsHead>
                <DsHead align="right">Net Profit FY</DsHead>
                <DsHead align="center">FY End</DsHead>
              </DsRow>
            </DsTableHeader>
            <DsTableBody>
              {filteredStocks.map((stock, index) => {
                const row = fundamentals.get(
                  fundamentalsKey(stock.exchange, stock.tradingSymbol),
                );
                return (
                  <DsRow key={`${stock.exchange}:${stock.securityId}`}>
                    <DsNumCell align="center" className="text-muted-foreground">
                      {index + 1}
                    </DsNumCell>
                    <DsCell>{stockNameCell(stock)}</DsCell>
                    <DsNumCell className="font-bold">₹{stock.cmp.toFixed(2)}</DsNumCell>
                    <DsNumCell className="font-normal text-muted-foreground">
                      {formatCrore(row?.revenueAnnual)}
                    </DsNumCell>
                    <DsNumCell>
                      <ChangeText value={row?.netIncomeAnnual}>
                        {row?.netIncomeAnnual == null
                          ? "—"
                          : `₹${Math.round(row.netIncomeAnnual).toLocaleString("en-IN")} Cr`}
                      </ChangeText>
                    </DsNumCell>
                    <DsCell align="center" className="text-muted-foreground">
                      {row?.revenueAnnualDate
                        ? row.revenueAnnualDate.slice(0, 4)
                        : "—"}
                    </DsCell>
                  </DsRow>
                );
              })}
            </DsTableBody>
          </DsTable>
        </DsTableScroll>
      </DsTableContainer>
    );
  };

  const renderTechnicalsTable = () => {
    if (techError) return tabAlert(techError);
    if (isLoadingTech && Object.keys(techValues).length === 0) {
      return tabLoading("Computing technical indicators…");
    }
    return (
      <DsTableContainer>
        <DsTableScroll>
          <DsTable>
            <DsTableHeader>
              <DsRow>
                <DsHead align="center">#</DsHead>
                <DsHead>Company</DsHead>
                <DsHead align="right">LTP</DsHead>
                <DsHead align="right">% Change</DsHead>
                {TECHNICAL_COLUMNS.map((column) => (
                  <DsHead key={column.id} align="right">
                    {column.label}
                  </DsHead>
                ))}
              </DsRow>
            </DsTableHeader>
            <DsTableBody>
              {filteredStocks.map((stock, index) => {
                const values =
                  techValues[
                    seasonalityKey(stock.exchangeSegment, stock.securityId)
                  ] ?? {};
                return (
                  <DsRow key={`${stock.exchange}:${stock.securityId}`}>
                    <DsNumCell align="center" className="text-muted-foreground">
                      {index + 1}
                    </DsNumCell>
                    <DsCell>{stockNameCell(stock)}</DsCell>
                    <DsNumCell className="font-bold">₹{stock.cmp.toFixed(2)}</DsNumCell>
                    <DsNumCell>
                      <ChangeText value={stock.percentChange}>
                        {formatSignedPercent(stock.percentChange)}
                      </ChangeText>
                    </DsNumCell>
                    {TECHNICAL_COLUMNS.map((column) => {
                      const value = values[column.id];
                      const ready = value?.state === "ready";
                      return (
                        <DsNumCell
                          key={column.id}
                          title={ready ? undefined : (value?.message ?? "Not available")}
                          className="font-normal text-muted-foreground"
                        >
                          {ready ? value.display : "—"}
                        </DsNumCell>
                      );
                    })}
                  </DsRow>
                );
              })}
            </DsTableBody>
          </DsTable>
        </DsTableScroll>
      </DsTableContainer>
    );
  };

  const renderSeasonalityTable = () => {
    if (seasonalityError) return tabAlert(seasonalityError);
    if (isLoadingSeasonality && seasonality.size === 0) {
      return tabLoading("Loading December seasonality…");
    }
    return (
      <DsTableContainer>
        <DsTableScroll>
          <DsTable>
            <DsTableHeader>
              <DsRow>
                <DsHead align="center">#</DsHead>
                <DsHead>Company</DsHead>
                <DsHead align="right">LTP</DsHead>
                {["Dec Avg %", "Hit Rate %", "Decembers", "Best Dec %", "Worst Dec %"].map(
                  (label) => (
                    <DsHead
                      key={label}
                      align={label === "Decembers" ? "center" : "right"}
                    >
                      {label}
                    </DsHead>
                  ),
                )}
              </DsRow>
            </DsTableHeader>
            <DsTableBody>
              {filteredStocks.map((stock, index) => {
                const row = seasonality.get(
                  seasonalityKey(stock.exchangeSegment, stock.securityId),
                );
                return (
                  <DsRow key={`${stock.exchange}:${stock.securityId}`}>
                    <DsNumCell align="center" className="text-muted-foreground">
                      {index + 1}
                    </DsNumCell>
                    <DsCell>{stockNameCell(stock)}</DsCell>
                    <DsNumCell className="font-bold">₹{stock.cmp.toFixed(2)}</DsNumCell>
                    <DsNumCell>
                      <ChangeText value={row?.avg}>{formatSignedPercent(row?.avg)}</ChangeText>
                    </DsNumCell>
                    <DsNumCell className="font-normal text-muted-foreground">
                      {row?.hitRate == null ? "—" : `${row.hitRate.toFixed(1)}%`}
                    </DsNumCell>
                    <DsCell align="center" className="text-muted-foreground">
                      {row?.years ?? "—"}
                    </DsCell>
                    <DsNumCell>
                      <ChangeText value={row?.best}>{formatSignedPercent(row?.best)}</ChangeText>
                    </DsNumCell>
                    <DsNumCell>
                      <ChangeText value={row?.worst}>{formatSignedPercent(row?.worst)}</ChangeText>
                    </DsNumCell>
                  </DsRow>
                );
              })}
            </DsTableBody>
          </DsTable>
        </DsTableScroll>
      </DsTableContainer>
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
    <div>
      {/* Category switcher */}
      <div className="mb-4 overflow-x-auto pb-1">
        <div className="apple-segmented-group">
          {categoryTabs.map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id as TabType)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "apple-segmented-item inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
                  isActive && "apple-segmented-item-active",
                )}
              >
                <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <DsCard className="mb-4 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {title}
                {!isIndicesTab && (
                  <span className="text-muted-foreground"> — {selectedExchange}</span>
                )}
              </h1>
              {isIndicesTab && (
                <DataFreshness
                  lastSyncAt={indicesLastSyncAt}
                  className="text-xs text-muted-foreground"
                />
              )}
            </div>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>

          {!isIndicesTab && (
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search company, symbol, sector..."
                className="relative w-64"
                matchCount={data.length}
                totalCount={allRows.length}
              />

              <div className="apple-segmented-group" role="group" aria-label="Exchange">
                {(["NSE", "BSE"] as const).map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setSelectedExchange(ex)}
                    aria-pressed={selectedExchange === ex}
                    className={cn(
                      "apple-segmented-item text-xs",
                      selectedExchange === ex && "apple-segmented-item-active",
                    )}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {!isIndicesTab && (
          <div className="mt-4 flex space-x-1 overflow-x-auto border-t border-border pt-1">
            {subTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                aria-current={activeSubTab === tab.id ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                  activeSubTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </DsCard>

      {isIndicesTab ? (
        <>
          {indicesErrorMessage ? (
            <div className="mb-4">{tabAlert(indicesErrorMessage)}</div>
          ) : null}

          {isLoadingIndices && indexQuotes.length === 0 ? (
            tabLoading("Loading index data…")
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
          {needsLiveStocks && liveErrorMessage ? (
            <div className="mb-4">{tabAlert(liveErrorMessage)}</div>
          ) : null}

          {activeSubTab !== "overview" ? (
            renderSubTabContent()
          ) : needsLiveStocks && isLoadingLive && liveStocks.length === 0 ? (
            tabLoading("Loading live stock data…")
          ) : (
            <DsTableContainer>
              <DsTableScroll>
                <DsTable>
                  <DsTableHeader>
                    <DsRow>
                      <DsHead align="center">#</DsHead>
                      <DsHead>Company</DsHead>
                      <DsHead>Sector</DsHead>
                      <DsHead>Industry</DsHead>
                      <DsHead align="center">Group</DsHead>
                      <DsHead align="center">Face Value</DsHead>
                      <DsHead align="center">Price Band</DsHead>
                      <DsHead align="right">Mkt Cap</DsHead>
                      <DsHead align="right">Pre Close</DsHead>
                      <DsHead align="right">LTP</DsHead>
                      <DsHead align="right">Net Change</DsHead>
                      <DsHead align="right">% Change</DsHead>
                      <DsHead align="center">Trend</DsHead>
                    </DsRow>
                  </DsTableHeader>
                  <DsTableBody>
                    {data.map((stock, index) => (
                      <DsRow key={stock.id}>
                        <DsNumCell align="center" className="text-muted-foreground">
                          {index + 1}
                        </DsNumCell>
                        <DsCell>
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              href={`/stock/${encodeURIComponent(stock.symbol)}`}
                              className="font-medium text-primary hover:underline"
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
                        </DsCell>
                        <DsCell className="text-muted-foreground">
                          {stock.sector && stock.sector !== "-"
                            ? stock.sector
                            : "—"}
                        </DsCell>
                        <DsCell className="text-muted-foreground">
                          {stock.industry && stock.industry !== "-"
                            ? stock.industry
                            : "—"}
                        </DsCell>
                        <DsCell align="center">
                          <DsBadge>{stock.group || "—"}</DsBadge>
                        </DsCell>
                        <DsCell align="center" className="tabular-nums text-muted-foreground">
                          {stock.faceValue ? `₹${stock.faceValue}` : "—"}
                        </DsCell>
                        <DsCell align="center" className="text-muted-foreground">
                          {stock.priceBand || "—"}
                        </DsCell>
                        <DsNumCell className="font-normal text-muted-foreground">
                          {stock.mktCap || "—"}
                        </DsNumCell>
                        <DsNumCell className="font-normal text-muted-foreground">
                          ₹{(stock.preClose || stock.price).toFixed(2)}
                        </DsNumCell>
                        <DsNumCell className="font-bold">
                          ₹{stock.price.toFixed(2)}
                        </DsNumCell>
                        <DsNumCell>
                          <ChangeText value={stock.change}>
                            {stock.change >= 0 ? "+" : ""}₹{stock.change.toFixed(2)}
                          </ChangeText>
                        </DsNumCell>
                        <DsNumCell>
                          <div className="flex items-center justify-end">
                            <ChangePill value={stock.changePercent} />
                          </div>
                        </DsNumCell>
                        <DsCell align="center">
                          <SparklineChart data={stock.sparklineData} />
                        </DsCell>
                      </DsRow>
                    ))}
                  </DsTableBody>
                </DsTable>
              </DsTableScroll>
            </DsTableContainer>
          )}
        </>
      )}
    </div>
  );
}

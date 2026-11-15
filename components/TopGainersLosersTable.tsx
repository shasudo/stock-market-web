"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TopGainerLoserStock } from "@/lib/mockData";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ChevronsDown,
  ChevronsUp,
  Flame,
  History,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { DataFreshness } from "@/components/common/DataFreshness";
import { StockActionsMenu } from "@/components/common/StockActionsMenu";
import { SearchInput, matchesSearch } from "@/components/common/SearchInput";
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
  EmptyState,
} from "@/components/ds";
import { cn } from "@/lib/utils";

interface TopGainersLosersTableProps {
  data: TopGainerLoserStock[];
  type:
    | "gainers"
    | "losers"
    | "52wkHigh"
    | "52wkLow"
    | "onlyBuyers"
    | "onlySellers"
    | "priceShockers"
    | "volumeShockers"
    | "mostActiveByValue"
    | "allTimeHigh"
    | "allTimeLow"
    | "stocks"
    | "sectors"
    | "industry"
    | "fnoStocks";
  exchange: "NSE" | "BSE";
  index: string;
  lastSyncAt: string | null;
  unavailableReason?: string;
  onExchangeChange?: (exchange: "NSE" | "BSE") => void;
}

const categoryInfo: Record<
  string,
  { title: string; description: string; isPositive: boolean }
> = {
  gainers: {
    title: "Top Gainers",
    description:
      "Stocks recording the highest percentage gains during the current trading session. Monitor institutional rally momentum across market caps.",
    isPositive: true,
  },
  losers: {
    title: "Top Losers",
    description:
      "Stocks recording the highest percentage losses during the current session. Identify underperforming assets and potential mean-reversion setups.",
    isPositive: false,
  },
  "52wkHigh": {
    title: "52-Week High",
    description:
      "Stocks trading at or breaking out to new 52-week peak prices with sustained institutional volume momentum.",
    isPositive: true,
  },
  "52wkLow": {
    title: "52-Week Low",
    description:
      "Stocks trading at 52-week trough levels under persistent distribution or structural industry headwinds.",
    isPositive: false,
  },
  onlyBuyers: {
    title: "Only Buyers",
    description:
      "Stocks with exclusively buy orders and zero ask liquidity at current price levels, hitting upper circuit ceilings.",
    isPositive: true,
  },
  onlySellers: {
    title: "Only Sellers",
    description:
      "Stocks with exclusively sell orders and zero bid depth at current market price, hitting lower circuit floors.",
    isPositive: false,
  },
  priceShockers: {
    title: "Price Shockers",
    description:
      "Stocks exhibiting anomalous intraday standard-deviation volatility expansions and rapid price spikes.",
    isPositive: true,
  },
  volumeShockers: {
    title: "Volume Shockers",
    description:
      "Stocks trading at multiples of their 20-day average daily volume, indicating institutional accumulation or liquidation.",
    isPositive: true,
  },
  mostActiveByValue: {
    title: "Most Active by Value",
    description:
      "Stocks generating the highest gross turnover (Price × Volume) across domestic equities today.",
    isPositive: true,
  },
  allTimeHigh: {
    title: "All-Time High",
    description:
      "Stocks trading at record historical highs, operating in price discovery territory above all overhead supply.",
    isPositive: true,
  },
  allTimeLow: {
    title: "All-Time Low",
    description:
      "Stocks trading at all-time historical lows with ongoing downward repricing.",
    isPositive: false,
  },
  stocks: {
    title: "All Equities",
    description:
      "Complete live market universe across NSE and BSE equities with market capitalization, sector classification, and real-time quotes.",
    isPositive: true,
  },
  sectors: {
    title: "Sector-Wise Performance",
    description:
      "Aggregated sectoral indices monitoring capital rotation across Banking, IT, Pharma, Auto, Energy, and FMCG.",
    isPositive: true,
  },
  industry: {
    title: "Industry-Wise Performance",
    description:
      "Granular sub-industry performance breakdowns providing deep micro-sector visibility.",
    isPositive: true,
  },
  fnoStocks: {
    title: "F&O Eligible Equities",
    description:
      "Derivative-eligible equities with high liquidity, tight bid-ask spreads, and active futures & options trading.",
    isPositive: true,
  },
};

const SparklineChart = ({
  data,
  isGainer,
}: {
  data: number[];
  isGainer: boolean;
}) => {
  if (!data || data.length < 2) return <span className="text-muted-foreground/60">—</span>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 24;
  const width = 76;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <span
      className={cn(
        "inline-block",
        isGainer ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
      )}
    >
      <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </span>
  );
};

const categoryTabs: readonly { id: string; label: string; href: string; icon: LucideIcon }[] = [
  { id: "gainers", label: "Top Gainers", href: "/gainers", icon: TrendingUp },
  { id: "losers", label: "Top Losers", href: "/losers", icon: TrendingDown },
  { id: "52wkHigh", label: "52W High", href: "/52-week-high", icon: ChevronsUp },
  { id: "52wkLow", label: "52W Low", href: "/52-week-low", icon: ChevronsDown },
  { id: "mostActiveByValue", label: "Most Active", href: "/most-active-by-value", icon: Activity },
  { id: "volumeShockers", label: "Volume Shockers", href: "/volume-shockers", icon: Flame },
  { id: "priceShockers", label: "Price Shockers", href: "/price-shockers", icon: Zap },
  { id: "onlyBuyers", label: "Only Buyers", href: "/only-buyers", icon: ArrowUpRight },
  { id: "onlySellers", label: "Only Sellers", href: "/only-sellers", icon: ArrowDownRight },
  { id: "allTimeHigh", label: "All-Time High", href: "/all-time-high", icon: Trophy },
  { id: "allTimeLow", label: "All-Time Low", href: "/all-time-low", icon: History },
];

export default function TopGainersLosersTable({
  data,
  type,
  exchange,
  lastSyncAt,
  unavailableReason,
  onExchangeChange,
}: TopGainersLosersTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedExchange, setSelectedExchange] = useState<"NSE" | "BSE">(exchange);
  const [prevExchangeProp, setPrevExchangeProp] = useState(exchange);
  if (exchange !== prevExchangeProp) {
    setPrevExchangeProp(exchange);
    setSelectedExchange(exchange);
  }

  const handleExchangeChange = (nextExchange: "NSE" | "BSE") => {
    setSelectedExchange(nextExchange);
    onExchangeChange?.(nextExchange);
  };

  const visibleData = useMemo(
    () =>
      data.filter((stock) =>
        matchesSearch(
          search,
          stock.symbol,
          stock.stockName,
          stock.sector,
          stock.industry,
        ),
      ),
    [data, search],
  );

  const currentCategoryInfo = categoryInfo[type] || categoryInfo.gainers;
  const title = currentCategoryInfo.title;
  const description = currentCategoryInfo.description;

  return (
    <div>
      {/* Category switcher */}
      <div className="mb-4 overflow-x-auto pb-1">
        <div className="apple-segmented-group">
          {categoryTabs.map((tab) => {
            const isActive = type === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => router.push(tab.href)}
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

      {/* Toolbar header card */}
      <DsCard className="mb-4 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <DsBadge tone="blue">{selectedExchange}</DsBadge>
              <DataFreshness lastSyncAt={lastSyncAt} className="text-xs text-muted-foreground" />
            </div>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="apple-segmented-group" role="group" aria-label="Exchange">
              {(["NSE", "BSE"] as const).map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => handleExchangeChange(ex)}
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

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search symbol, sector..."
              className="relative w-56 md:w-64"
              matchCount={visibleData.length}
              totalCount={data.length}
            />
          </div>
        </div>
      </DsCard>

      {unavailableReason ? (
        <div className="mb-4 rounded-[10px] border border-amber-600/25 bg-amber-500/10 p-3 text-xs font-medium text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300">
          {unavailableReason}
        </div>
      ) : null}

      {/* Table */}
      <DsTableContainer>
        <DsTableScroll>
          <DsTable>
            <DsTableHeader>
              <DsRow>
                <DsHead align="center">#</DsHead>
                <DsHead>Symbol / Company</DsHead>
                <DsHead>Sector</DsHead>
                <DsHead align="center">Group</DsHead>
                <DsHead align="center">Band</DsHead>
                <DsHead align="right">Mkt Cap</DsHead>
                <DsHead align="right">Prev Close</DsHead>
                <DsHead align="right">LTP (₹)</DsHead>
                <DsHead align="right">Change</DsHead>
                <DsHead align="right">% Change</DsHead>
                <DsHead align="center">Trend (7D)</DsHead>
              </DsRow>
            </DsTableHeader>
            <DsTableBody>
              {visibleData.length === 0 && !unavailableReason ? (
                <DsRow>
                  <DsCell colSpan={11} align="center">
                    <EmptyState
                      className="py-10"
                      title={
                        search.trim()
                          ? `No equities match "${search.trim()}".`
                          : "No equities currently qualify for this filter."
                      }
                    />
                  </DsCell>
                </DsRow>
              ) : null}
              {visibleData.map((stock, index) => {
                const isStockGainer = (stock.changePercent ?? 0) >= 0;

                return (
                  <DsRow key={stock.id} className="group">
                    <DsNumCell align="center" className="font-semibold text-muted-foreground">
                      {index + 1}
                    </DsNumCell>

                    <DsCell>
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/stock/${encodeURIComponent(stock.symbol)}`)
                          }
                          className="group/link cursor-pointer text-left"
                        >
                          <span className="block text-[13px] font-semibold text-foreground group-hover/link:text-primary">
                            {stock.stockName}
                          </span>
                          <span className="block font-mono text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            {stock.symbol}
                          </span>
                        </button>
                        <div className="opacity-0 transition-opacity group-hover:opacity-100">
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

                    <DsCell>
                      <span className="block text-[13px] font-semibold text-foreground">
                        {stock.sector && stock.sector !== "-" ? stock.sector : "—"}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {stock.industry && stock.industry !== "-" ? stock.industry : ""}
                      </span>
                    </DsCell>

                    <DsCell align="center">
                      <DsBadge>{stock.group || "EQ"}</DsBadge>
                    </DsCell>

                    <DsCell align="center" className="tabular-nums">
                      {stock.priceBand !== undefined ? (
                        <DsBadge>{stock.priceBand}%</DsBadge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </DsCell>

                    <DsNumCell>{stock.mktCap || "—"}</DsNumCell>

                    <DsNumCell className="font-normal text-muted-foreground">
                      ₹{(stock.preClose ?? stock.price - stock.change).toFixed(2)}
                    </DsNumCell>

                    <DsNumCell className="font-bold">₹{stock.price.toFixed(2)}</DsNumCell>

                    <DsNumCell>
                      <ChangeText value={stock.change}>
                        {isStockGainer ? "+" : ""}₹{stock.change.toFixed(2)}
                      </ChangeText>
                    </DsNumCell>

                    <DsNumCell>
                      <div className="flex items-center justify-end">
                        <ChangePill value={stock.changePercent} />
                      </div>
                    </DsNumCell>

                    <DsCell align="center">
                      <SparklineChart
                        data={stock.sparklineData}
                        isGainer={isStockGainer}
                      />
                    </DsCell>
                  </DsRow>
                );
              })}
            </DsTableBody>
          </DsTable>
        </DsTableScroll>
      </DsTableContainer>
    </div>
  );
}

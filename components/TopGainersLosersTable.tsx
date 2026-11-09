"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TopGainerLoserStock } from "@/lib/mockData";
import { DataFreshness } from "@/components/common/DataFreshness";
import { StockActionsMenu } from "@/components/common/StockActionsMenu";
import { SearchInput, matchesSearch } from "@/components/common/SearchInput";
import { getChangeColorClasses, getGroupBadgeClasses, appleTableStyles } from "@/lib/table-styles";

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

  const strokeColor = isGainer ? "#34C759" : "#FF3B30";

  return (
    <svg width={width} height={height} className="inline-block overflow-visible">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

const categoryTabs = [
  { id: "gainers", label: "Top Gainers", href: "/gainers" },
  { id: "losers", label: "Top Losers", href: "/losers" },
  { id: "52wkHigh", label: "52W High", href: "/52-week-high" },
  { id: "52wkLow", label: "52W Low", href: "/52-week-low" },
  { id: "mostActiveByValue", label: "Most Active", href: "/most-active-by-value" },
  { id: "volumeShockers", label: "Volume Shockers", href: "/volume-shockers" },
  { id: "priceShockers", label: "Price Shockers", href: "/price-shockers" },
  { id: "onlyBuyers", label: "Only Buyers", href: "/only-buyers" },
  { id: "onlySellers", label: "Only Sellers", href: "/only-sellers" },
  { id: "allTimeHigh", label: "All-Time High", href: "/all-time-high" },
  { id: "allTimeLow", label: "All-Time Low", href: "/all-time-low" },
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
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        {/* Apple Segmented Control Category Switcher */}
        <div className="mb-6 overflow-x-auto scrollbar-thin pb-2">
          <div className="flex items-center gap-1 flex-wrap">
            {categoryTabs.map((tab) => {
              const isActive = type === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => router.push(tab.href)}
                  className={`text-xs px-3.5 py-1.5 whitespace-nowrap transition-all ${
                    isActive ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap" : "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar Header Card */}
        <div className="rounded-2xl border border-border bg-card shadow-xs p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-[-0.035em] text-foreground">
                  {title}
                </h1>
                <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-primary/10 dark:bg-indigo-400/10 text-primary dark:text-indigo-300 border border-primary/30 dark:border-indigo-400/30">
                  {selectedExchange}
                </span>
                <DataFreshness lastSyncAt={lastSyncAt} className="text-xs text-muted-foreground" />
              </div>
              <p className="text-xs md:text-sm text-muted-foreground font-medium mt-1 max-w-3xl leading-relaxed">
                {description}
              </p>
            </div>

            {/* Apple Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Apple Segmented Exchange Switcher */}
              <div className="flex items-center gap-1 flex-wrap">
                {(["NSE", "BSE"] as const).map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => handleExchangeChange(ex)}
                    className={`text-xs px-3.5 py-1.5 transition-all ${
                      selectedExchange === ex
                        ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {ex}
                  </button>
                ))}
              </div>

              {/* Search Box */}
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
        </div>

        {unavailableReason ? (
          <div className="mb-6 rounded-2xl border border-warning/30 dark:border-amber-400/30 bg-warning/10 dark:bg-amber-400/10 p-4 text-xs font-semibold text-warning dark:text-amber-300">
            {unavailableReason}
          </div>
        ) : null}

        {/* Apple Table Card Container */}
        <div className={appleTableStyles.container}>
          <div className={appleTableStyles.scrollWrapper}>
            <table className={appleTableStyles.table}>
              <thead className={appleTableStyles.thead}>
                <tr>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center w-12 select-none">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                    Symbol / Company
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                    Sector
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center select-none">
                    Group
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center select-none">
                    Band
                  </th>
                  <th className={appleTableStyles.thRight}>
                    Mkt Cap
                  </th>
                  <th className={appleTableStyles.thRight}>
                    Prev Close
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right select-none">
                    LTP (₹)
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right select-none">
                    Change
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right select-none">
                    % Change
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center select-none w-24">
                    Trend (7D)
                  </th>
                </tr>
              </thead>
              <tbody className={appleTableStyles.tbody}>
                {visibleData.length === 0 && !unavailableReason ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-6 py-20 text-center text-xs text-muted-foreground font-medium"
                    >
                      {search.trim()
                        ? `No equities match "${search.trim()}".`
                        : "No equities currently qualify for this filter."}
                    </td>
                  </tr>
                ) : null}
                {visibleData.map((stock, index) => {
                  const changeClasses = getChangeColorClasses(stock.changePercent);
                  const isStockGainer = (stock.changePercent ?? 0) >= 0;

                  return (
                    <tr
                      key={stock.id}
                      className="finder-row transition-colors border-b border-border hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                    >
                      {/* Serial Number */}
                      <td className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground num-font">
                        {index + 1}
                      </td>

                      {/* Company & Symbol */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-3">
                          <div
                            onClick={() =>
                              router.push(`/stock/${encodeURIComponent(stock.symbol)}`)
                            }
                            className="cursor-pointer group/link"
                          >
                            <span className="font-bold text-foreground group-hover/link:text-primary dark:text-indigo-400 transition-colors block text-xs md:text-sm">
                              {stock.stockName}
                            </span>
                            <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase">
                              {stock.symbol}
                            </span>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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

                      {/* Sector & Industry */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-foreground block">
                          {stock.sector && stock.sector !== "-" ? stock.sector : "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          {stock.industry && stock.industry !== "-" ? stock.industry : ""}
                        </span>
                      </td>

                      {/* Group Badge */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-md ${getGroupBadgeClasses(
                            stock.group || "",
                          )}`}
                        >
                          {stock.group || "EQ"}
                        </span>
                      </td>

                      {/* Price Band */}
                      <td className="px-3 py-2.5 text-center text-xs text-muted-foreground font-mono num-font whitespace-nowrap">
                        {stock.priceBand !== undefined ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold">
                            {stock.priceBand}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Market Cap */}
                      <td className="px-3 py-2.5 text-right text-xs font-mono font-medium text-foreground num-font whitespace-nowrap">
                        {stock.mktCap || "—"}
                      </td>

                      {/* Previous Close */}
                      <td className="px-3 py-2.5 text-right text-xs font-mono text-muted-foreground num-font whitespace-nowrap">
                        ₹{(stock.preClose ?? stock.price - stock.change).toFixed(2)}
                      </td>

                      {/* LTP */}
                      <td className="px-3 py-2.5 text-right text-xs font-mono font-bold text-foreground num-font whitespace-nowrap">
                        ₹{stock.price.toFixed(2)}
                      </td>

                      {/* Net Change */}
                      <td className="px-3 py-2.5 text-right text-xs font-mono font-semibold num-font whitespace-nowrap">
                        <span className={changeClasses.text}>
                          {isStockGainer ? "+" : ""}₹{stock.change.toFixed(2)}
                        </span>
                      </td>

                      {/* Apple Stocks-Style % Change Pill */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span
                          className={
                            changeClasses.pill
                          }
                        >
                          {isStockGainer ? "+" : ""}
                          {stock.changePercent.toFixed(2)}%
                        </span>
                      </td>

                      {/* Sparkline Trend */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <SparklineChart
                          data={stock.sparklineData}
                          isGainer={isStockGainer}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


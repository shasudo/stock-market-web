"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import {
  fetchIndexQuoteSnapshot,
  getIndexQuoteClientErrorMessage,
  isIndexQuoteRequestAborted,
} from "@/lib/market/instrument-quote-client";
import type { IndexQuoteDTO } from "@/lib/market/instrument-quote-client";
import { DataFreshness } from "@/components/common/DataFreshness";
import { StockActionsMenu } from "@/components/common/StockActionsMenu";
import { SearchInput, matchesSearch } from "@/components/common/SearchInput";

const REFRESH_INTERVAL_MS = 30_000;

interface RealIndexTableProps {
  exchange: "NSE" | "BSE";
  title: string;
  description: string;
  icon: LucideIcon;
  iconWrapperClassName: string;
  iconClassName: string;
}

export default function RealIndexTable({
  exchange,
  title,
  description,
  icon: Icon,
  iconWrapperClassName,
  iconClassName,
}: RealIndexTableProps) {
  const [indices, setIndices] = useState<IndexQuoteDTO[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const snapshot = await fetchIndexQuoteSnapshot(controller.signal);
        if (!isCurrentRequest) return;
        setIndices(
          snapshot.indices.filter((index) => index.exchange === exchange),
        );
        setLastSyncAt(snapshot.lastSyncAt);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrentRequest || isIndexQuoteRequestAborted(error)) return;
        setErrorMessage(getIndexQuoteClientErrorMessage(error));
      } finally {
        if (isCurrentRequest) setIsLoading(false);
      }
    };

    void load();

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [exchange, refreshVersion]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      setRefreshVersion((version) => version + 1);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(refreshTimer);
  }, []);

  const visibleIndices = indices.filter((index) =>
    matchesSearch(search, index.displayName, index.tradingSymbol),
  );

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 mb-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border border-primary/20 ${iconWrapperClassName}`}>
                  <Icon className={`h-6 w-6 ${iconClassName}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                      {title}
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/30">
                      {exchange}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{description}</p>
                  <DataFreshness lastSyncAt={lastSyncAt} className="text-xs mt-1" />
                </div>
              </div>

              <div>
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search index..."
                  className="relative w-full sm:w-64"
                  inputClassName="w-full rounded-xl border border-border bg-card py-2 pl-8 pr-8 text-xs md:text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
                  matchCount={visibleIndices.length}
                  totalCount={indices.length}
                />
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div
              role="alert"
              className="mb-5 rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-xs font-medium text-error shadow-xs"
            >
              {errorMessage}
            </div>
          ) : null}

          {/* macOS Finder Table */}
          <div className="bg-card border border-border/90 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto scrollbar-thin">
              {isLoading && indices.length === 0 ? (
                <div className="px-6 py-16 text-center text-xs text-muted-foreground">
                  Loading index live quotes…
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
                    <tr>
                      <th className="px-3.5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Index Name
                      </th>
                      <th className="px-3.5 py-3 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Prev Close
                      </th>
                      <th className="px-3.5 py-3 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Current LTP
                      </th>
                      <th className="px-3.5 py-3 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Net Change
                      </th>
                      <th className="px-3.5 py-3 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        % Change
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleIndices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-16 text-center text-xs text-muted-foreground"
                        >
                          {search.trim()
                            ? `No indices match "${search.trim()}".`
                            : `No ${exchange} index data available.`}
                        </td>
                      </tr>
                    ) : null}
                    {visibleIndices.map((index, i) => {
                      const isGainer = index.pctChange >= 0;
                      return (
                        <tr
                          key={index.securityId}
                          className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                        >
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="text-xs md:text-sm font-bold text-foreground group-hover:text-primary transition-colors block">
                                  {index.displayName}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground block">
                                  {index.tradingSymbol}
                                </span>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <StockActionsMenu
                                  stock={{
                                    symbol: index.tradingSymbol,
                                    name: index.displayName,
                                    ltp: index.lastPrice,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-xs text-muted-foreground text-right font-mono num-font whitespace-nowrap">
                            {index.prevClose.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-3.5 py-2.5 text-xs font-bold text-foreground text-right font-mono num-font whitespace-nowrap">
                            {index.lastPrice.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-3.5 py-2.5 text-xs text-right font-mono num-font whitespace-nowrap">
                            <span
                              className={`font-semibold ${isGainer ? "text-emerald-600" : "text-error"}`}
                            >
                              {isGainer ? "+" : ""}
                              {index.netChange.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font ${
                                isGainer
                                  ? "bg-success/10 text-success border-success/30"
                                  : "bg-error/10 text-error border-error/30"
                              }`}
                            >
                              {isGainer ? (
                                <TrendingUp className="w-3 h-3 mr-0.5" />
                              ) : (
                                <TrendingDown className="w-3 h-3 mr-0.5" />
                              )}
                              {isGainer ? "+" : ""}
                              {index.pctChange.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}


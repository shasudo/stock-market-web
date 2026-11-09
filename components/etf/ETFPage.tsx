"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search, TrendingUp, TrendingDown, Layers } from "lucide-react";
import { etfFAQs, sortOptions } from "@/lib/etf-data";
import {
  fetchEtfQuoteSnapshot,
  getIndexQuoteClientErrorMessage,
  isIndexQuoteRequestAborted,
} from "@/lib/market/instrument-quote-client";
import type { EtfQuoteDTO } from "@/lib/market/instrument-quote-client";
import { DataFreshness } from "@/components/common/DataFreshness";

const REFRESH_INTERVAL_MS = 30_000;

function formatPrice(price: number): string {
  return price.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function ETFCard({ etf }: { readonly etf: EtfQuoteDTO }) {
  const isPositive = etf.pctChange >= 0;
  return (
    <div className="bg-card border border-border/90 rounded-2xl p-5 hover:shadow-md hover:border-border transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
            {etf.displayName}
          </h3>
          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border">
            {etf.exchange}
          </span>
        </div>
        <div className="text-right">
          <p className="font-bold font-mono text-foreground text-base num-font">
            ₹{formatPrice(etf.lastPrice)}
          </p>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold border mt-1 num-font ${
              isPositive
                ? "bg-success/10 text-success border-success/30"
                : "bg-error/10 text-error border-error/30"
            }`}
          >
            {isPositive ? "+" : ""}
            {etf.pctChange.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground border-t border-border pt-3 font-mono">
        <span className="text-[11px] text-muted-foreground font-sans">1Y / 3Y Returns</span>
        <span className="text-right text-muted-foreground">—</span>
        <span className="text-[11px] text-muted-foreground font-sans">Expense Ratio</span>
        <span className="text-right text-muted-foreground">—</span>
        <span className="text-[11px] text-muted-foreground font-sans">AUM Pool</span>
        <span className="text-right text-muted-foreground">—</span>
      </div>
    </div>
  );
}

export default function ETFPage() {
  const [etfs, setEtfs] = useState<EtfQuoteDTO[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [exchangeFilter, setExchangeFilter] = useState<"All" | "NSE" | "BSE">(
    "All",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>("1");

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const snapshot = await fetchEtfQuoteSnapshot(controller.signal);
        if (!isCurrentRequest) return;
        setEtfs([...snapshot.etfs]);
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
  }, [refreshVersion]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      setRefreshVersion((version) => version + 1);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(refreshTimer);
  }, []);

  const visibleEtfs = useMemo(() => {
    let list = etfs;
    if (exchangeFilter !== "All") {
      list = list.filter((etf) => etf.exchange === exchangeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (etf) =>
          etf.displayName.toLowerCase().includes(q) ||
          etf.tradingSymbol.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    if (sortBy === "price") {
      sorted.sort((a, b) => b.lastPrice - a.lastPrice);
    } else if (sortBy === "change") {
      sorted.sort((a, b) => b.pctChange - a.pctChange);
    } else {
      sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    return sorted;
  }, [etfs, exchangeFilter, searchQuery, sortBy]);

  return (
    <div className="w-full min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        {/* Header Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 mb-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-primary/20 shadow-lg">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
                  Exchange Traded Funds (ETFs)
                </h1>
                <DataFreshness lastSyncAt={lastSyncAt} />
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Real-time tracking for index, commodity, and thematic ETFs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-ring"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search ETF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 bg-card border border-border rounded-xl pl-3 pr-8 py-1.5 text-xs md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Exchange Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {(["All", "NSE", "BSE"] as const).map((exchange) => (
            <button
              key={exchange}
              onClick={() => setExchangeFilter(exchange)}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all shadow-xs ${
                exchangeFilter === exchange
                  ? "bg-primary text-primary-foreground shadow-primary/20"
                  : "bg-card border border-border/80 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {exchange}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {errorMessage ? (
              <p
                role="alert"
                className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-xs text-error font-medium"
              >
                {errorMessage}
              </p>
            ) : null}

            {isLoading && visibleEtfs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-xs">
                Loading ETF live pricing…
              </div>
            ) : visibleEtfs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-xs">
                No ETFs found matching your criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleEtfs.map((etf) => (
                  <ETFCard key={etf.securityId} etf={etf} />
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-card border border-border/90 rounded-2xl p-5 shadow-xs">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">
                ETF Insights &amp; FAQs
              </h2>
              <div className="space-y-2">
                {etfFAQs.map((faq) => (
                  <div
                    key={faq.id}
                    className="border border-border/90 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)
                      }
                      className="w-full flex items-center justify-between px-3.5 py-2.5 text-left bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <span className="font-bold text-foreground text-xs">
                        {faq.question}
                      </span>
                      {expandedFAQ === faq.id ? (
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                    {expandedFAQ === faq.id && (
                      <div className="p-3.5 text-xs leading-relaxed text-muted-foreground border-t border-border">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

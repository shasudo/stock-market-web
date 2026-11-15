"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Download,
  Search,
  X,
} from "lucide-react";
import UnofficialSourceBadge from "@/components/common/UnofficialSourceBadge";

const categories = [
  "NIFTY 50",
  "NIFTY NEXT 50",
  "NIFTY 100",
  "NIFTY 200",
  "NIFTY 500",
  "NIFTY MIDCAP 50",
  "NIFTY MIDCAP 100",
  "NIFTY SMALLCAP 50",
  "NIFTY SMALLCAP 100",
  "NIFTY BANK",
  "NIFTY AUTO",
  "NIFTY FINANCIAL SERVICES",
  "NIFTY FMCG",
  "NIFTY IT",
  "NIFTY MEDIA",
  "NIFTY METAL",
  "NIFTY PHARMA",
  "NIFTY REALTY",
  "NIFTY ENERGY",
  "NIFTY INFRA",
  "NIFTY PSU BANK",
  "NIFTY PRIVATE BANK",
];


type Denomination = "lakhs" | "crores" | "billions";

interface PreOpenRow {
  readonly symbol: string;
  readonly prevClose: number | null;
  readonly live: number | null;
  readonly change: number | null;
  readonly changePct: number | null;
  readonly volume: number | null;
  readonly valueCrores: number | null;
  readonly mktCapCrores: number | null;
  readonly high52: number | null;
  readonly low52: number | null;
}

const REFRESH_INTERVAL_MS = 60_000;

export default function PreOpenPage() {
  const [selectedCategory, setSelectedCategory] = useState("NIFTY 50");
  const [symbolSearch, setSymbolSearch] = useState("");
  const [denomination, setDenomination] = useState<Denomination>("crores");
  const [rows, setRows] = useState<PreOpenRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/market-data/indices/nse/${encodeURIComponent(selectedCategory)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error(`request failed (${response.status})`);
        const body: unknown = await response.json().catch(() => undefined);
        const unwrapped =
          body !== null &&
          typeof body === "object" &&
          "data" in body &&
          body.data !== null &&
          typeof body.data === "object" &&
          "constituents" in body.data
            ? (body.data as { constituents: unknown }).constituents
            : (body as { constituents?: unknown })?.constituents;
        if (!Array.isArray(unwrapped)) throw new Error("invalid response");
        if (!isCurrentRequest) return;
        setRows(
          (unwrapped as Record<string, unknown>[]).map((row) => {
            const num = (v: unknown): number | null =>
              typeof v === "number" && Number.isFinite(v) ? v : null;
            const value = num(row.value);
            return {
              symbol: typeof row.symbol === "string" ? row.symbol : "",
              prevClose: num(row.prevClose),
              live: num(row.price),
              change: num(row.change),
              changePct: num(row.changePct),
              volume: num(row.volume),
              valueCrores: value === null ? null : value / 1e7,
              mktCapCrores: num(row.marketCapCr),
              high52: num(row.high52),
              low52: num(row.low52),
            };
          }),
        );
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrentRequest) return;
        if (error instanceof Error && error.name === "AbortError") return;
        setErrorMessage(
          "Live data is temporarily unavailable for this index. Please try again shortly.",
        );
      } finally {
        if (isCurrentRequest) setIsLoading(false);
      }
    };

    void load();
    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [selectedCategory, refreshVersion]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRefreshVersion((version) => version + 1);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const currentData = useMemo(() => {
    if (!symbolSearch.trim()) return rows;
    const needle = symbolSearch.toLowerCase();
    return rows.filter((s) => s.symbol.toLowerCase().includes(needle));
  }, [rows, symbolSearch]);

  const formatMoney = (value: number | null): string => {
    if (value === null) return "—";
    switch (denomination) {
      case "lakhs":
        return (value * 100).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      case "crores":
        return value.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      case "billions":
        return (value / 100).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      default:
        return value.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
    }
  };

  const formatPrice = (value: number | null): string =>
    value === null
      ? "—"
      : value.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  const formatSigned = (value: number | null): string =>
    value === null
      ? "—"
      : `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;

  const denominationLabel =
    denomination === "lakhs"
      ? "Lakhs"
      : denomination === "crores"
        ? "Crores"
        : "Billions";

  const handleDownloadCSV = () => {
    const plain = (value: number | null): string =>
      value === null ? "" : String(value);
    const headers = [
      "Symbol",
      "Prev. Close",
      "Live Price",
      "Chng",
      "%Chng",
      "Volume",
      `Value (${denominationLabel})`,
      `Mkt Cap (${denominationLabel})`,
      "52W H",
      "52W L",
    ];
    const rows = currentData.map((s) => [
      s.symbol,
      plain(s.prevClose),
      plain(s.live),
      plain(s.change),
      plain(s.changePct),
      s.volume === null ? "" : String(s.volume),
      s.valueCrores === null ? "" : formatMoney(s.valueCrores),
      s.mktCapCrores === null ? "" : formatMoney(s.mktCapCrores),
      plain(s.high52),
      plain(s.low52),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pre-open-${selectedCategory.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="w-full px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <UnofficialSourceBadge label="Live index constituents. Official pre-open auction equilibrium prices (IEP) are published by NSE only during the 9:00–9:15 IST session; outside that window live traded prices are shown." />
          {}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-amber-600/25 bg-amber-500/10 dark:border-amber-400/25 dark:bg-amber-400/10">
              <Clock className="h-4 w-4 text-amber-800 dark:text-amber-300" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Pre Open Market
              </h1>
              <p className="text-sm text-muted-foreground">
                Live constituent quotes for each index — refreshes every minute
              </p>
            </div>
          </div>
          {errorMessage ? (
            <p
              role="alert"
              className="mb-4 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
            >
              {errorMessage}
            </p>
          ) : null}

          {}
          <div className="bg-background border border-border rounded-xl p-4 mb-4 shadow-luxury">
            <div className="flex flex-wrap items-center gap-4">
              {}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  Symbol
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Enter symbol"
                    value={symbolSearch}
                    onChange={(e) => setSymbolSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 w-40"
                  />
                </div>
                {symbolSearch && (
                  <button
                    onClick={() => setSymbolSearch("")}
                    className="px-3 py-1.5 text-xs font-medium bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>

              {}
              <button
                onClick={handleDownloadCSV}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download (.csv)
              </button>
            </div>

            {}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <span className="text-sm font-medium text-muted-foreground">
                Change denomination
              </span>
              {(["lakhs", "crores", "billions"] as Denomination[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDenomination(d)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    denomination === d
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {}
          <div className="bg-background border border-border rounded-xl overflow-hidden shadow-luxury">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-primary">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-primary-foreground uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider">
                      Prev. Close
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider">
                      Live Price
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider">
                      Chng
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider">
                      %Chng
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider whitespace-nowrap">
                      Volume
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider whitespace-nowrap">
                      Value ({denominationLabel})
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider whitespace-nowrap">
                      Mkt Cap ({denominationLabel})
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider whitespace-nowrap">
                      52W H
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider whitespace-nowrap">
                      52W L
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading && currentData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        Loading live constituents for {selectedCategory}…
                      </td>
                    </tr>
                  ) : currentData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        {symbolSearch.trim()
                          ? `No constituents match "${symbolSearch.trim()}".`
                          : "No constituents available for this index right now."}
                      </td>
                    </tr>
                  ) : (
                    currentData.map((stock, i) => (
                      <motion.tr
                        key={stock.symbol}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 10) * 0.02 }}
                        className="hover:bg-secondary/50 transition-colors group"
                      >
                        <td className="px-3 py-2">
                          <span className="text-sm font-semibold text-primary group-hover:underline cursor-pointer">
                            {stock.symbol}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground text-right font-mono">
                          {formatPrice(stock.prevClose)}
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-foreground text-right font-mono">
                          {formatPrice(stock.live)}
                        </td>
                        <td className="px-3 py-2 text-xs text-right font-mono">
                          <span
                            className={`font-semibold ${(stock.change ?? 0) >= 0 ? "text-success" : "text-error"}`}
                          >
                            {formatSigned(stock.change)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono ${
                              (stock.changePct ?? 0) >= 0
                                ? "bg-success/10 text-success"
                                : "bg-error/10 text-error"
                            }`}
                          >
                            {(stock.changePct ?? 0) >= 0 ? (
                              <TrendingUp className="w-3.5 h-3.5 mr-1" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5 mr-1" />
                            )}
                            {formatSigned(stock.changePct)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground text-right font-mono">
                          {stock.volume === null
                            ? "—"
                            : stock.volume.toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground text-right font-mono">
                          {formatMoney(stock.valueCrores)}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground text-right font-mono">
                          {formatMoney(stock.mktCapCrores)}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground text-right font-mono">
                          {formatPrice(stock.high52)}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground text-right font-mono">
                          {formatPrice(stock.low52)}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {currentData.length} stocks for {selectedCategory}
            </span>
            <span>Values in {denominationLabel}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

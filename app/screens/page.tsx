"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AuthGuard } from "@/components/common";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ScreenerSummarySection } from "@/components/screens/ScreenerSummary";
import apiClient, { isRecord, isSuccessfulApiResponse } from "@/lib/api-client";

const DEFAULT_SYMBOL = "RELIANCE";

interface ScreensQuote {
  readonly displayName: string;
  readonly lastPrice: number;
  readonly pctChange: number;
  readonly syncedAt: string;
  readonly sector: string | null;
  readonly industry: string | null;
}

function isScreensStock(value: unknown): value is ScreensQuote & {
  symbol: string;
} {
  return (
    isRecord(value) &&
    typeof value.symbol === "string" &&
    typeof value.displayName === "string" &&
    typeof value.lastPrice === "number" &&
    typeof value.pctChange === "number" &&
    typeof value.syncedAt === "string"
  );
}

function ScreensContent() {
  const [input, setInput] = useState(DEFAULT_SYMBOL);
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [stock, setStock] = useState<(ScreensQuote & { symbol: string }) | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    const loadStock = async (): Promise<void> => {
      setLoading(true);
      try {
        const response = await apiClient.get<unknown>(
          `/api/stocks/${encodeURIComponent(symbol)}`,
        );
        if (!isCurrent) return;
        const data = isSuccessfulApiResponse(response.data)
          ? response.data.data
          : null;
        const next =
          isRecord(data) && isScreensStock(data.stock) ? data.stock : null;
        if (next) {
          setStock(next);
          setErrorMessage(null);
        } else {
          setStock(null);
          setErrorMessage(`No synced market data for "${symbol}" yet.`);
        }
      } catch {
        if (!isCurrent) return;
        setStock(null);
        setErrorMessage(
          "Could not load this stock right now. Please try again.",
        );
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    void loadStock();

    return () => {
      isCurrent = false;
    };
  }, [symbol]);

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <h1 className="text-xl font-extrabold text-foreground">Screens</h1>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          Screener-style full summary with chart, peers, statements, pros and
          cons. The stock page keeps the classic summary.
        </p>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = input.trim().toUpperCase();
            if (next) {
              setSymbol(next);
              setInput("");
            }
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value.toUpperCase())}
              placeholder="Enter symbol, e.g. RELIANCE"
              aria-label="Stock symbol"
              className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 shadow-xs"
            />
          </div>
          <button
            type="submit"
            className="h-10 shrink-0 rounded-xl bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            Show
          </button>
        </form>

        <div className="mt-6">
          {loading ? (
            <LoadingSpinner message={`Loading ${symbol}...`} />
          ) : stock ? (
            <ScreenerSummarySection
              key={stock.symbol}
              symbol={stock.symbol}
              quote={{
                displayName: stock.displayName,
                lastPrice: stock.lastPrice,
                pctChange: stock.pctChange,
                syncedAt: stock.syncedAt,
                sector: stock.sector,
                industry: stock.industry,
              }}
            />
          ) : (
            <div
              role="alert"
              className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-xs font-semibold text-muted-foreground shadow-xs"
            >
              {errorMessage ?? `No data for "${symbol}" yet.`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ScreensPage() {
  return (
    <AuthGuard loadingMessage="Loading screens...">
      <ScreensContent />
    </AuthGuard>
  );
}

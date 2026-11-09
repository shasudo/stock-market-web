"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/common";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StockSummarySection } from "@/components/stock/QuickRatios";
import { isMarketOpen } from "@/lib/market-hours";
import { resolveStockBackDestination } from "@/lib/stock-back-navigation";
import apiClient, { isRecord, isSuccessfulApiResponse } from "@/lib/api-client";

const STOCK_LIVE_POLL_MS = 10_000;
const STOCK_IDLE_POLL_MS = 60_000;

interface StockDetailDTO {
  readonly symbol: string;
  readonly displayName: string;
  readonly sector: string | null;
  readonly industry: string | null;
  readonly lastPrice: number;
  readonly prevClose: number;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly netChange: number;
  readonly pctChange: number;
  readonly week52High: number | null;
  readonly week52Low: number | null;
  readonly syncedAt: string;
}

interface StockNote {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly tags: string[];
  readonly updatedAt: string;
}

function isStockDetail(value: unknown): value is StockDetailDTO {
  return (
    isRecord(value) &&
    typeof value.symbol === "string" &&
    typeof value.displayName === "string" &&
    typeof value.lastPrice === "number" &&
    typeof value.prevClose === "number" &&
    typeof value.netChange === "number" &&
    typeof value.pctChange === "number" &&
    typeof value.syncedAt === "string"
  );
}

function isStockNote(value: unknown): value is StockNote {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    Array.isArray(value.tags) &&
    typeof value.updatedAt === "string"
  );
}

function StockDetailContent({ symbol }: { symbol: string }) {
  const [stock, setStock] = useState<StockDetailDTO | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<StockNote[]>([]);
  const router = useRouter();

  const handleBack = (): void => {
    if (resolveStockBackDestination(window.history.length) === "back") {
      router.back();
    } else {
      router.push("/dashboard");
    }
  };

  const fetchNotes = useCallback(async (): Promise<void> => {
    try {
      const response = await apiClient.get<unknown>("/api/notes");
      const data = isSuccessfulApiResponse(response.data)
        ? response.data.data
        : null;
      const allNotes =
        isRecord(data) && Array.isArray(data.notes)
          ? data.notes.filter(isStockNote)
          : [];
      setNotes(
        allNotes.filter((note) => note.tags.includes(symbol.toUpperCase())),
      );
    } catch {
      // Notes are a supplementary section - a failed fetch shouldn't block
      // the quote/chart view above it.
    }
  }, [symbol]);

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
        const nextStock =
          isRecord(data) && isStockDetail(data.stock) ? data.stock : null;
        setStock(nextStock);
        setNotFound(nextStock === null);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrent) return;
        const status =
          isRecord(error) && isRecord(error.response)
            ? error.response.status
            : null;
        if (status === 404) {
          setNotFound(true);
          setErrorMessage(null);
        } else {
          setErrorMessage(
            "Could not load this stock right now. Please try again.",
          );
        }
        setStock(null);
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    const loadNotes = async (): Promise<void> => {
      try {
        const response = await apiClient.get<unknown>("/api/notes");
        if (!isCurrent) return;
        const data = isSuccessfulApiResponse(response.data)
          ? response.data.data
          : null;
        const allNotes =
          isRecord(data) && Array.isArray(data.notes)
            ? data.notes.filter(isStockNote)
            : [];
        setNotes(
          allNotes.filter((note) => note.tags.includes(symbol.toUpperCase())),
        );
      } catch {
        // Notes are a supplementary section - a failed fetch shouldn't block
        // the quote/chart view above it.
      }
    };

    void loadStock();
    void loadNotes();

    return () => {
      isCurrent = false;
    };
  }, [symbol]);

  // The quote header refreshes under the chart so the two never disagree.
  // Failures are silent: the last good quote stays on screen.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = async (): Promise<void> => {
      if (!document.hidden) {
        try {
          const response = await apiClient.get<unknown>(
            `/api/stocks/${encodeURIComponent(symbol)}`,
          );
          const data = isSuccessfulApiResponse(response.data)
            ? response.data.data
            : null;
          if (!cancelled && isRecord(data) && isStockDetail(data.stock)) {
            setStock(data.stock);
          }
        } catch {
          // keep the last good quote
        }
      }
      if (!cancelled) schedule();
    };
    const schedule = (): void => {
      timer = setTimeout(
        () => void refresh(),
        isMarketOpen() ? STOCK_LIVE_POLL_MS : STOCK_IDLE_POLL_MS,
      );
    };
    const onVisible = (): void => {
      if (document.hidden) return;
      if (timer) clearTimeout(timer);
      void refresh();
    };

    document.addEventListener("visibilitychange", onVisible);
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [symbol]);

  if (loading) {
    return <LoadingSpinner message={`Loading ${symbol}...`} />;
  }

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6 bg-card/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-black/[0.06] shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        {errorMessage ? (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-[#FF3B30]/25 bg-[#FF3B30]/10 px-4 py-3 text-xs font-semibold text-[#FF3B30]"
          >
            {errorMessage}
          </div>
        ) : null}

        {notFound ? (
          <div className="rounded-2xl border border-border/90 bg-card shadow-xs p-8 text-center">
            <p className="text-foreground font-bold mb-1">
              No synced market data for &quot;{symbol}&quot; yet.
            </p>
            <p className="text-xs text-muted-foreground font-medium">
              This might not be an NSE/BSE-listed instrument this app tracks —
              watchlist, alerts and notes still work for it either way.
            </p>
          </div>
        ) : stock ? (
          <div className="mb-6">
            <StockSummarySection
              key={symbol}
              symbol={symbol}
              quote={{
                displayName: stock.displayName,
                lastPrice: stock.lastPrice,
                pctChange: stock.pctChange,
                syncedAt: stock.syncedAt,
                sector: stock.sector,
                industry: stock.industry,
              }}
              onNoteAdded={fetchNotes}
            />
          </div>
        ) : null}

        {/* Notes Card */}
        <div className="rounded-2xl border border-border/90 bg-card shadow-xs p-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
            Research Notes
          </h2>
          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No notes yet — use the ⋮ menu above to add one.
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-border/80 bg-muted/50 p-4"
                >
                  <p className="text-xs font-bold text-foreground mb-1">
                    {note.title}
                  </p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StockDetailPage({ symbol }: { symbol: string }) {
  return (
    <AuthGuard loadingMessage={`Loading ${symbol}...`}>
      <StockDetailContent symbol={symbol} />
    </AuthGuard>
  );
}

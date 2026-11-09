"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { fetchIndexQuoteSnapshot } from "@/lib/market/instrument-quote-client";
import { fetchLiveMarketData } from "@/lib/market/live-market-client";
import type { IndexQuoteDTO } from "@/lib/market/instrument-quote-client";
import { UP_COLOR, DOWN_COLOR, formatNumber } from "./ui";

export interface SearchResult {
  readonly symbol: string;
  readonly name: string;
  readonly exchange: string;
  readonly kind: "stock" | "index";
  readonly last: number;
  readonly pct: number;
}

interface SymbolSearchDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly onSelect: (result: SearchResult) => void;
  readonly onClose: () => void;
}

const RECENT_KEY = "chart:terminal:recent-symbols";

/** Exact symbol first, then symbol prefix, then name prefix, then the rest. */
export function rankResults(
  results: readonly SearchResult[],
  needle: string,
): SearchResult[] {
  const score = (result: SearchResult): number => {
    const symbol = result.symbol.toLowerCase();
    const name = result.name.toLowerCase();
    if (symbol === needle) return 0;
    if (symbol.startsWith(needle)) return 1;
    if (name.startsWith(needle)) return 2;
    return 3;
  };
  return results
    .map((result, index) => ({ result, index, rank: score(result) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.result);
}

export function readRecentSymbols(): SearchResult[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SearchResult[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function rememberSymbol(result: SearchResult): void {
  try {
    const next = [
      result,
      ...readRecentSymbols().filter((entry) => entry.symbol !== result.symbol),
    ].slice(0, 8);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Recents are a convenience.
  }
}

export default function SymbolSearchDialog({
  open,
  title,
  onSelect,
  onClose,
}: SymbolSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [stocks, setStocks] = useState<readonly SearchResult[]>([]);
  const [indices, setIndices] = useState<readonly IndexQuoteDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetchIndexQuoteSnapshot(controller.signal)
      .then((response) => setIndices(response.indices))
      .catch(() => undefined);
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 1) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      void fetchLiveMarketData(
        {
          exchange: "NSE",
          filter: "all",
          page: 1,
          pageSize: 12,
          sort: "marketCap",
          order: "desc",
          search: term,
        },
        controller.signal,
      )
        .then((response) =>
          setStocks(
            response.stocks.map((stock) => ({
              symbol: stock.tradingSymbol,
              name: stock.companyName,
              exchange: stock.exchange,
              kind: "stock" as const,
              last: stock.cmp,
              pct: stock.percentChange,
            })),
          ),
        )
        .catch(() => setStocks([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const term = query.trim();
  const results = useMemo<SearchResult[]>(() => {
    if (!term) return readRecentSymbols();
    const needle = term.toLowerCase();
    const matchedIndices: SearchResult[] = indices
      .filter(
        (index) =>
          index.tradingSymbol.toLowerCase().includes(needle) ||
          index.displayName.toLowerCase().includes(needle),
      )
      .slice(0, 5)
      .map((index) => ({
        symbol: index.tradingSymbol,
        name: index.displayName,
        exchange: "INDEX",
        kind: "index" as const,
        last: index.lastPrice,
        pct: index.pctChange,
      }));
    return rankResults([...matchedIndices, ...stocks], needle);
  }, [term, indices, stocks]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  const choose = (result: SearchResult | undefined): void => {
    if (!result) return;
    rememberSymbol(result);
    setQuery("");
    setStocks([]);
    onSelect(result);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 px-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        className="w-full max-w-xl overflow-hidden rounded-xl bg-card shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h2 className="mr-2 text-[15px] font-semibold text-foreground">
            {title}
          </h2>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlight((value) =>
                  Math.min(value + 1, results.length - 1),
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlight((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter") {
                choose(results[highlight]);
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search stocks and indices, e.g. RELIANCE or NIFTY"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-1">
          {!term && results.length > 0 && (
            <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Recent
            </p>
          )}
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {term
                ? loading
                  ? "Searching…"
                  : "No symbols found"
                : "Start typing to search"}
            </p>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.symbol}-${result.exchange}-${index}`}
                type="button"
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(result)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                  index === highlight ? "bg-muted" : ""
                }`}
              >
                <span className="w-28 shrink-0 truncate text-[13px] font-bold text-foreground">
                  {result.symbol}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                  {result.name}
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {result.kind === "index" ? "INDEX" : result.exchange}
                </span>
                {result.last > 0 && (
                  <span
                    className="w-24 shrink-0 text-right font-mono text-[12px] font-semibold"
                    style={{ color: result.pct >= 0 ? UP_COLOR : DOWN_COLOR }}
                  >
                    {formatNumber(result.last)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

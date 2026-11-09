"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  fetchTickerQuoteSnapshot,
  isIndexQuoteRequestAborted,
} from "@/lib/market/instrument-quote-client";
import type { TickerQuoteDTO } from "@/lib/market/instrument-quote-client";
import { DataFreshness } from "@/components/common/DataFreshness";

const REFRESH_INTERVAL_MS = 30_000;

function formatValue(item: TickerQuoteDTO): string {
  // MCX contracts price in ₹, the currency future in ₹ per USD — no $
  // conversion happens here, this is exactly what Dhan quotes.
  return `₹${item.lastPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function MarketTicker() {
  const [items, setItems] = useState<TickerQuoteDTO[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    const load = async (): Promise<void> => {
      try {
        const snapshot = await fetchTickerQuoteSnapshot(controller.signal);
        if (!isCurrentRequest) return;
        setItems([...snapshot.ticker]);
        setLastSyncAt(snapshot.lastSyncAt);
      } catch (error: unknown) {
        // Decorative header strip — on failure it just stays empty/stale
        // rather than showing an error banner on every page.
        if (!isCurrentRequest || isIndexQuoteRequestAborted(error)) return;
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

  if (items.length === 0) {
    return null;
  }

  const duplicatedData = [...items, ...items, ...items];

  return (
    <div className="market-ticker-wrapper">
      <div className="market-ticker">
        <div className="ticker-track">
          {duplicatedData.map((item, index) => (
            <div key={`${item.securityId}-${index}`} className="ticker-item">
              <span className="ticker-name">{item.displayName}</span>
              <span className="ticker-value">{formatValue(item)}</span>
              <span
                className={`ticker-change ${item.netChange >= 0 ? "positive" : "negative"}`}
              >
                {item.netChange >= 0 ? (
                  <TrendingUp className="ticker-icon" />
                ) : (
                  <TrendingDown className="ticker-icon" />
                )}
                {item.netChange >= 0 ? "+" : ""}
                {item.pctChange.toFixed(2)}%
              </span>
              <span className="ticker-divider">|</span>
            </div>
          ))}
        </div>
      </div>

      {/* Always dated, not only when stale: this strip is on every page, and
          overnight prices with no timestamp are exactly what read as live. */}
      <div className="flex justify-end px-4 pb-1">
        <DataFreshness
          lastSyncAt={lastSyncAt}
          prefix="Prices as of"
          className="text-white/50"
        />
      </div>

      <style jsx>{`
        .market-ticker-wrapper {
          width: 100%;
          background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          overflow: hidden;
        }

        .market-ticker {
          position: relative;
          width: 100%;
          height: 36px;
          display: flex;
          align-items: center;
          overflow: hidden;
        }

        .ticker-track {
          display: flex;
          align-items: center;
          animation: scroll 40s linear infinite;
          white-space: nowrap;
        }

        .ticker-track:hover {
          animation-play-state: paused;
        }

        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }

        .ticker-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 24px;
          font-size: 13px;
          font-weight: 500;
        }

        .ticker-name {
          color: rgba(255, 255, 255, 0.7);
          font-weight: 600;
        }

        .ticker-value {
          color: #ffffff;
          font-weight: 600;
          font-family:
            ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco,
            "Liberation Mono", "Courier New", monospace;
        }

        .ticker-change {
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
          font-size: 12px;
        }

        .ticker-change.positive {
          color: #22c55e;
        }

        .ticker-change.negative {
          color: #ef4444;
        }

        .ticker-change :global(.ticker-icon) {
          width: 12px;
          height: 12px;
        }

        .ticker-divider {
          color: rgba(255, 255, 255, 0.2);
          margin-left: 16px;
        }
      `}</style>
    </div>
  );
}

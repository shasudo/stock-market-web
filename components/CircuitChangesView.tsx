"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import UnofficialSourceBadge from "@/components/common/UnofficialSourceBadge";
import {
  fetchScrapedEvents,
  getScrapedEventClientErrorMessage,
  isScrapedEventRequestAborted,
} from "@/lib/scrape/scraped-event-client";
import type { CircuitHitDTO } from "@/lib/scrape/scraped-event-client";

const REFRESH_INTERVAL_MS = 60_000;

function NSECircuitChanges() {
  const [hits, setHits] = useState<CircuitHitDTO[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [symbolFilter, setSymbolFilter] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetchScrapedEvents<CircuitHitDTO>(
          "/api/market-data/circuit-changes",
          controller.signal,
        );
        if (!isCurrentRequest) return;
        setHits([...response.events]);
        setLastSyncAt(response.lastSyncAt);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrentRequest || isScrapedEventRequestAborted(error)) return;
        setErrorMessage(getScrapedEventClientErrorMessage(error));
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

  const filteredData = useMemo(() => {
    if (!symbolFilter.trim()) return hits;
    const q = symbolFilter.toLowerCase();
    return hits.filter(
      (r) =>
        r.symbol.toLowerCase().includes(q) ||
        r.companyName.toLowerCase().includes(q),
    );
  }, [hits, symbolFilter]);

  return (
    <div>
      <div className="px-6 py-5 border-b border-border">
        <UnofficialSourceBadge lastSyncAt={lastSyncAt} />
        <h3 className="text-base font-semibold text-foreground border-b-2 border-primary inline-block pb-2 mb-2 mt-2">
          Note
        </h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 mt-3">
          <li>
            Securities that hit their upper (H) or lower (L) price band on the
            most recent trading day.
          </li>
        </ul>
      </div>

      <div className="px-6 py-4 border-b border-border">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Filter By :
          </span>
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <span className="bg-muted text-sm text-muted-foreground px-3 py-2 border-r border-border">
              Symbol
            </span>
            <div className="relative">
              <input
                type="text"
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                className="pl-3 pr-8 py-2 text-sm w-48 focus:outline-none"
              />
              {symbolFilter && (
                <button
                  onClick={() => setSymbolFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <p role="alert" className="mx-6 mt-4 text-sm text-error">
          {errorMessage}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#1a237e] text-white">
              <th className="px-4 py-3 text-left font-semibold">SYMBOL</th>
              <th className="px-4 py-3 text-left font-semibold">
                SECURITY NAME
              </th>
              <th className="px-4 py-3 text-center font-semibold">
                HIGH / LOW BAND
              </th>
            </tr>
          </thead>
          <tbody className="bg-card">
            {isLoading && filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading circuit data…
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No records found
                </td>
              </tr>
            ) : (
              filteredData.map((row, index) => (
                <tr
                  key={`${row.symbol}-${index}`}
                  className="border-b border-border hover:bg-muted transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/stock/${encodeURIComponent(row.symbol)}`}
                      className="text-info hover:underline font-medium"
                    >
                      {row.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.companyName}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">
                    <span
                      className={
                        row.highOrLow === "H" ? "text-success" : "text-error"
                      }
                    >
                      {row.highOrLow === "H" ? "Upper" : "Lower"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CircuitChangesView() {
  return (
    <div className="min-h-screen bg-background py-6">
      <div className="px-6 py-5 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">Circuit Changes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          NSE price-band hits from the live feed. BSE circulars have no
          verified unauthenticated source in this build, so no BSE tab is
          shown.
        </p>
      </div>

      <NSECircuitChanges />
    </div>
  );
}

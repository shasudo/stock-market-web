"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, RefreshCw, Search } from "lucide-react";
import UnofficialSourceBadge from "@/components/common/UnofficialSourceBadge";
import {
  fetchEarnings,
  getEarningsClientErrorMessage,
  isEarningsRequestAborted,
} from "@/lib/calendar/client";
import type { EarningsDTO } from "@/lib/calendar/calendar";

type RangeTab = "Yesterday" | "Today" | "Tomorrow" | "Upcoming 30 days";
type SortKey = "Date" | "Market Cap" | "% Change" | "LTP";

const RANGE_TABS: readonly RangeTab[] = [
  "Yesterday",
  "Today",
  "Tomorrow",
  "Upcoming 30 days",
];

function istToday(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeForTab(tab: RangeTab): { from: string; to: string } {
  const today = istToday();
  if (tab === "Upcoming 30 days") {
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    return { from: toIsoDate(today), to: toIsoDate(end) };
  }
  const offset = tab === "Yesterday" ? -1 : tab === "Tomorrow" ? 1 : 0;
  const day = new Date(today);
  day.setDate(day.getDate() + offset);
  const iso = toIsoDate(day);
  return { from: iso, to: iso };
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function formatEps(value: number | null): string {
  return value === null ? "—" : `₹${value.toFixed(2)}`;
}

function formatLtp(value: number | null): string {
  return value === null ? "—" : `₹${value.toFixed(2)}`;
}

export default function EarningsCalendarView() {
  const [activeTab, setActiveTab] = useState<RangeTab>("Today");
  const [events, setEvents] = useState<EarningsDTO[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("Date");

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;
    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const { from, to } = rangeForTab(activeTab);
        const response = await fetchEarnings(from, to, controller.signal);
        if (!isCurrent) return;
        setEvents([...response.events]);
        setLastSyncAt(response.lastSyncAt);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrent || isEarningsRequestAborted(error)) return;
        setErrorMessage(getEarningsClientErrorMessage(error));
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [activeTab, refreshVersion]);

  const visibleData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? events.filter(
          (item) =>
            item.symbol.toLowerCase().includes(query) ||
            item.companyName.toLowerCase().includes(query),
        )
      : [...events];
    const nullsLast = (value: number | null): number =>
      value === null ? Number.NEGATIVE_INFINITY : value;
    switch (sortBy) {
      case "Market Cap":
        filtered.sort((a, b) => nullsLast(b.marketCap) - nullsLast(a.marketCap));
        break;
      case "% Change":
        filtered.sort((a, b) => nullsLast(b.pctChange) - nullsLast(a.pctChange));
        break;
      case "LTP":
        filtered.sort((a, b) => nullsLast(b.ltp) - nullsLast(a.ltp));
        break;
      default:
        filtered.sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1));
        break;
    }
    return filtered;
  }, [events, searchQuery, sortBy]);

  return (
    <div className="w-full p-6">
      <UnofficialSourceBadge
        lastSyncAt={lastSyncAt}
        label="Earnings dates from fundamentals providers — dates and estimates can shift; verify with exchange filings"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-border">
        <div className="flex items-center gap-2">
          {RANGE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-primary/20 shadow-xs"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search stock..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-border bg-card focus:outline-none focus:border-ring w-48"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-border bg-card rounded-xl focus:outline-none focus:border-ring"
            >
              <option>Date</option>
              <option>Market Cap</option>
              <option>% Change</option>
              <option>LTP</option>
            </select>
          </div>
          <button
            onClick={() => setRefreshVersion((version) => version + 1)}
            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            aria-label="Refresh earnings"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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

      {isLoading && visibleData.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground text-xs">
          Loading earnings calendar…
        </p>
      ) : visibleData.length === 0 ? (
        <div className="py-16 text-center">
          <Calendar className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground text-xs">
            No earnings announcements in this range. Providers publish dates as
            results season approaches.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
                <tr className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider select-none">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4 text-right">EPS Est.</th>
                  <th className="py-3 px-4 text-right">LTP (₹)</th>
                  <th className="py-3 px-4 text-right">% Change</th>
                  <th className="py-3 px-4 text-center">Timing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleData.map((item) => {
                  const change = item.pctChange ?? 0;
                  const hasChange = item.pctChange !== null;
                  const isPositive = change >= 0;
                  return (
                    <tr
                      key={`${item.symbol}-${item.eventDate}`}
                      className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-muted-foreground num-font whitespace-nowrap">
                        {formatDate(item.eventDate)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Link
                          href={`/stock/${encodeURIComponent(item.symbol)}`}
                          className="font-bold text-foreground hover:text-primary hover:underline"
                        >
                          {item.companyName}
                        </Link>
                        <span className="block text-[11px] font-medium text-muted-foreground">
                          {item.symbol}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-muted-foreground num-font whitespace-nowrap">
                        {formatEps(item.epsEstimate)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground num-font whitespace-nowrap">
                        {formatLtp(item.ltp)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {hasChange ? (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font ${
                              isPositive
                                ? "bg-success/10 text-success border-success/30"
                                : "bg-error/10 text-error border-error/30"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {change.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-xs text-muted-foreground num-font whitespace-nowrap">
                        {item.timing ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

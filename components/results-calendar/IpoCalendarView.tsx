"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, RefreshCw, Search } from "lucide-react";
import UnofficialSourceBadge from "@/components/common/UnofficialSourceBadge";
import {
  fetchIpoCalendar,
  IPO_CALENDAR_UNAVAILABLE_MESSAGE,
  isIpoCalendarRequestAborted,
} from "@/lib/calendar/client";
import type { IpoDTO, IpoStatus } from "@/lib/calendar/ipo";

type IpoTab = "Open Now" | "Upcoming" | "Recently Closed";

const IPO_TABS: readonly IpoTab[] = ["Open Now", "Upcoming", "Recently Closed"];

function formatDate(iso: string | null): string {
  if (iso === null) return "—";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatBand(low: number | null, high: number | null): string {
  if (low === null || high === null) return "—";
  if (low === high) return `₹${low.toLocaleString("en-IN")}`;
  return `₹${low.toLocaleString("en-IN")} – ₹${high.toLocaleString("en-IN")}`;
}

function statusClass(status: IpoStatus): string {
  if (status === "Open")
    return "text-lime-600 border-lime-600/30 bg-lime-600/10";
  if (status === "Upcoming")
    return "text-info border-info/30 bg-info/10";
  return "text-muted-foreground border-border bg-muted";
}

export default function IpoCalendarView() {
  const [activeTab, setActiveTab] = useState<IpoTab>("Open Now");
  const [issues, setIssues] = useState<readonly IpoDTO[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;
    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetchIpoCalendar(controller.signal);
        if (!isCurrent) return;
        setIssues([...response.issues]);
        setLastSyncAt(response.lastSyncAt);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrent || isIpoCalendarRequestAborted(error)) return;
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : IPO_CALENDAR_UNAVAILABLE_MESSAGE,
        );
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [refreshVersion]);

  const visibleData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const wanted: IpoStatus =
      activeTab === "Open Now"
        ? "Open"
        : activeTab === "Upcoming"
          ? "Upcoming"
          : "Closed";
    const filtered = issues.filter((item) => item.status === wanted);
    const searched = query
      ? filtered.filter(
          (item) =>
            item.symbol.toLowerCase().includes(query) ||
            item.companyName.toLowerCase().includes(query),
        )
      : [...filtered];
    searched.sort((a, b) =>
      (a.openDate ?? "9999") < (b.openDate ?? "9999") ? -1 : 1,
    );
    return searched;
  }, [issues, searchQuery, activeTab]);

  return (
    <div className="w-full p-6">
      <UnofficialSourceBadge
        lastSyncAt={lastSyncAt}
        label="Live IPO board from NSE — dates and bands shift with issuer announcements; verify with the prospectus"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-border">
        <div className="flex items-center gap-2">
          {IPO_TABS.map((tab) => (
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
              placeholder="Search company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-border bg-card focus:outline-none focus:border-ring w-48"
            />
          </div>
          <button
            onClick={() => setRefreshVersion((version) => version + 1)}
            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            aria-label="Refresh IPO calendar"
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
          Loading IPO calendar…
        </p>
      ) : visibleData.length === 0 ? (
        <div className="py-16 text-center">
          <Calendar className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground text-xs">
            No {activeTab === "Open Now" ? "open" : activeTab.toLowerCase()}{" "}
            IPOs right now. NSE lists issues on trading days as bankers file
            them.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
                <tr className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider select-none">
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Open</th>
                  <th className="py-3 px-4">Close</th>
                  <th className="py-3 px-4 text-right">Price band</th>
                  <th className="py-3 px-4 text-right">Subscription</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleData.map((item) => (
                  <tr
                    key={item.symbol}
                    className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-foreground">
                        {item.companyName}
                      </span>
                      <span className="block text-[11px] font-medium text-muted-foreground">
                        {item.symbol}
                        {item.segment ? ` · ${item.segment}` : ""}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-muted-foreground num-font whitespace-nowrap">
                      {formatDate(item.openDate)}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-muted-foreground num-font whitespace-nowrap">
                      {formatDate(item.closeDate)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-foreground num-font whitespace-nowrap">
                      {formatBand(item.priceBandLow, item.priceBandHigh)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-muted-foreground num-font whitespace-nowrap">
                      {item.subscription === null
                        ? "—"
                        : `${item.subscription.toFixed(2)}×`}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${statusClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

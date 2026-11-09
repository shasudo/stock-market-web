"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronDown, Search } from "lucide-react";
import UnofficialSourceBadge from "@/components/common/UnofficialSourceBadge";
import {
  fetchScrapedEvents,
  getScrapedEventClientErrorMessage,
  isScrapedEventRequestAborted,
  type ScrapedEventsResponse,
} from "@/lib/scrape/scraped-event-client";
import type { CorporateActionDTO } from "@/lib/scrape/scraped-event-client";
import {
  CORPORATE_CATEGORIES,
  categorizeCorporatePurpose,
  type CorporateCategory,
} from "@/lib/calendar/calendar";

type ScopeTab = "Upcoming" | "Past" | "All";
type EventFilter = "All" | CorporateCategory;

const SCOPE_TABS: readonly ScopeTab[] = ["Upcoming", "Past", "All"];

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

function startOfTodayIst(): Date {
  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  nowIst.setHours(0, 0, 0, 0);
  return nowIst;
}

export default function CorporateCalendarView() {
  const [response, setResponse] =
    useState<ScrapedEventsResponse<CorporateActionDTO> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scope, setScope] = useState<ScopeTab>("Upcoming");
  const [eventFilter, setEventFilter] = useState<EventFilter>("All");
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;
    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const data = await fetchScrapedEvents<CorporateActionDTO>(
          "/api/market-data/corporate-action",
          controller.signal,
        );
        if (!isCurrent) return;
        setResponse(data);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrent || isScrapedEventRequestAborted(error)) return;
        setErrorMessage(getScrapedEventClientErrorMessage(error));
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, []);

  const visibleData = useMemo(() => {
    const events = response?.events ?? [];
    const todayStart = startOfTodayIst();
    const query = searchQuery.trim().toLowerCase();
    return events
      .map((event) => ({
        event,
        category: categorizeCorporatePurpose(event.purpose),
      }))
      .filter(({ event, category }) => {
        if (eventFilter !== "All" && category !== eventFilter) return false;
        const eventDate = new Date(event.eventDate);
        if (scope === "Upcoming" && eventDate < todayStart) return false;
        if (scope === "Past" && eventDate >= todayStart) return false;
        if (!query) return true;
        return (
          event.symbol.toLowerCase().includes(query) ||
          event.companyName.toLowerCase().includes(query)
        );
      })
      .sort((a, b) =>
        scope === "Past"
          ? a.event.eventDate < b.event.eventDate
            ? 1
            : -1
          : a.event.eventDate < b.event.eventDate
            ? -1
            : 1,
      );
  }, [response, scope, eventFilter, searchQuery]);

  return (
    <div className="w-full p-6">
      <UnofficialSourceBadge
        lastSyncAt={response?.lastSyncAt ?? null}
        label="NSE bhavcopy snapshot — synced daily; board meetings and AGM dates are not published in this feed"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {SCOPE_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setScope(tab)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                  scope === tab
                    ? "bg-primary text-primary-foreground shadow-primary/20 shadow-xs"
                    : "bg-card border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-muted-foreground border border-border bg-card rounded-xl hover:bg-muted shadow-xs transition-colors"
            >
              Event: <span className="text-primary">{eventFilter}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showDropdown && (
              <div className="absolute top-full left-0 mt-1 w-44 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden py-1">
                {(["All", ...CORPORATE_CATEGORIES] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setEventFilter(type);
                      setShowDropdown(false);
                    }}
                    className={`block w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-muted transition-colors ${
                      eventFilter === type
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search stock..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-border bg-card focus:outline-none focus:border-ring w-52"
          />
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
          Loading corporate calendar…
        </p>
      ) : visibleData.length === 0 ? (
        <div className="py-16 text-center">
          <Calendar className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground text-xs">
            No corporate actions recorded for this filter.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
                <tr className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider select-none">
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Event Date</th>
                  <th className="py-3 px-4 text-center">Record Date</th>
                  <th className="py-3 px-4">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleData.map(({ event, category }) => (
                  <tr
                    key={`${event.symbol}-${event.eventDate}-${event.purpose}`}
                    className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Link
                        href={`/stock/${encodeURIComponent(event.symbol)}`}
                        className="font-bold text-foreground hover:text-primary hover:underline"
                      >
                        {event.companyName}
                      </Link>
                      <span className="block text-[11px] font-medium text-muted-foreground">
                        {event.symbol}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/30">
                        {category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-foreground num-font whitespace-nowrap">
                      {formatDate(event.eventDate)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-muted-foreground num-font whitespace-nowrap">
                      {event.recordDate ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-medium text-xs max-w-72 truncate">
                      {event.purpose || "—"}
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

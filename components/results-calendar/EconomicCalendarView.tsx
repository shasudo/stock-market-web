"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, RefreshCw, Search, Star } from "lucide-react";
import UnofficialSourceBadge from "@/components/common/UnofficialSourceBadge";
import {
  fetchEconomicCalendar,
  ECONOMIC_CALENDAR_UNAVAILABLE_MESSAGE,
  isEconomicCalendarRequestAborted,
} from "@/lib/calendar/client";
import type {
  EconomicEventDTO,
  EconomicImpact,
} from "@/lib/calendar/economic";

type RangeTab =
  | "Yesterday"
  | "Today"
  | "Tomorrow"
  | "This Week"
  | "Next Week"
  | "Custom";

const RANGE_TABS: readonly RangeTab[] = [
  "Yesterday",
  "Today",
  "Tomorrow",
  "This Week",
  "Next Week",
  "Custom",
];

const IMPACT_FILTERS = ["All", "High", "Medium", "Low"] as const;
type ImpactFilter = (typeof IMPACT_FILTERS)[number];

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

function shiftIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function weekBounds(todayIso: string, next: boolean): {
  from: string;
  to: string;
} {
  const base = new Date(`${todayIso}T00:00:00`);
  // Weeks run Sunday to Saturday, matching the publisher's weekly file.
  const sunday = new Date(base);
  sunday.setDate(sunday.getDate() - sunday.getDay() + (next ? 7 : 0));
  const saturday = new Date(sunday);
  saturday.setDate(saturday.getDate() + 6);
  return { from: toIsoDate(sunday), to: toIsoDate(saturday) };
}

function formatDayHeader(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function impactStars(impact: EconomicImpact): number {
  if (impact === "High") return 3;
  if (impact === "Medium") return 2;
  return 1;
}

export default function EconomicCalendarView() {
  const [activeTab, setActiveTab] = useState<RangeTab>("Today");
  const [events, setEvents] = useState<readonly EconomicEventDTO[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [country, setCountry] = useState("All");
  const [impact, setImpact] = useState<ImpactFilter>("All");
  const [customFrom, setCustomFrom] = useState(() => toIsoDate(istToday()));
  const [customTo, setCustomTo] = useState(() => toIsoDate(istToday()));

  const range = useMemo(() => {
    const today = toIsoDate(istToday());
    switch (activeTab) {
      case "Yesterday":
        return { from: shiftIso(today, -1), to: shiftIso(today, -1) };
      case "Tomorrow":
        return { from: shiftIso(today, 1), to: shiftIso(today, 1) };
      case "This Week":
        return weekBounds(today, false);
      case "Next Week":
        return weekBounds(today, true);
      case "Custom":
        return customFrom <= customTo
          ? { from: customFrom, to: customTo }
          : { from: customTo, to: customFrom };
      default:
        return { from: today, to: today };
    }
  }, [activeTab, customFrom, customTo]);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;
    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetchEconomicCalendar(
          { from: range.from, to: range.to },
          controller.signal,
        );
        if (!isCurrent) return;
        setEvents([...response.events]);
        setLastSyncAt(response.lastSyncAt);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrent || isEconomicCalendarRequestAborted(error)) return;
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : ECONOMIC_CALENDAR_UNAVAILABLE_MESSAGE,
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
  }, [range, refreshVersion]);

  const countries = useMemo(() => {
    const seen = new Map<string, string>();
    for (const event of events) {
      if (!seen.has(event.country)) seen.set(event.country, event.countryName);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [events]);

  const visibleData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      if (country !== "All" && event.country !== country) return false;
      if (impact !== "All" && event.impact !== impact) return false;
      if (
        query &&
        !event.title.toLowerCase().includes(query) &&
        !event.countryName.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [events, searchQuery, country, impact]);

  const groups = useMemo(() => {
    const byDate = new Map<string, EconomicEventDTO[]>();
    for (const event of visibleData) {
      const list = byDate.get(event.date) ?? [];
      list.push(event);
      byDate.set(event.date, list);
    }
    return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [visibleData]);

  return (
    <div className="w-full p-6">
      <UnofficialSourceBadge
        lastSyncAt={lastSyncAt}
        label="Live macro calendar — actuals print as statistical agencies release them; verify market-moving figures with the source release"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
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
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="Filter by country"
            className="px-2.5 py-1.5 text-xs font-semibold border border-border bg-card rounded-xl focus:outline-none focus:border-ring max-w-36"
          >
            <option value="All">All countries</option>
            {countries.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={impact}
            onChange={(e) => setImpact(e.target.value as ImpactFilter)}
            aria-label="Filter by impact"
            className="px-2.5 py-1.5 text-xs font-semibold border border-border bg-card rounded-xl focus:outline-none focus:border-ring"
          >
            {IMPACT_FILTERS.map((level) => (
              <option key={level} value={level}>
                {level === "All" ? "All impacts" : `${level} impact`}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search event or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-border bg-card focus:outline-none focus:border-ring w-48"
            />
          </div>
          <button
            onClick={() => setRefreshVersion((version) => version + 1)}
            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            aria-label="Refresh economic calendar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {activeTab === "Custom" ? (
        <div className="flex items-center gap-2 mb-4 text-xs font-semibold text-muted-foreground">
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold border border-border bg-card rounded-xl focus:outline-none focus:border-ring"
          />
          <span>to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            onChange={(e) => setCustomTo(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold border border-border bg-card rounded-xl focus:outline-none focus:border-ring"
          />
          <span className="font-normal">
            (GMT+5:30) Chennai, Kolkata, Mumbai, New Delhi
          </span>
        </div>
      ) : null}

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
          Loading economic calendar…
        </p>
      ) : visibleData.length === 0 ? (
        <div className="py-16 text-center">
          <Calendar className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground text-xs">
            No macro releases match this range. The publisher posts each
            week&apos;s file as it begins.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, dayEvents]) => (
            <div
              key={date}
              className="rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden"
            >
              <div className="px-4 py-2 bg-muted/80 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {formatDayHeader(date)}
              </div>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider select-none">
                      <th className="py-2.5 px-4">Time</th>
                      <th className="py-2.5 px-4">Country</th>
                      <th className="py-2.5 px-4">Event</th>
                      <th className="py-2.5 px-4 text-center">Impact</th>
                      <th className="py-2.5 px-4 text-right">Actual</th>
                      <th className="py-2.5 px-4 text-right">Forecast</th>
                      <th className="py-2.5 px-4 text-right">Previous</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dayEvents.map((event) => (
                      <tr
                        key={event.id}
                        className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-muted-foreground num-font whitespace-nowrap">
                          {event.time ?? "All day"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-bold text-foreground">
                            {event.country}
                          </span>
                          <span className="block text-[11px] font-medium text-muted-foreground">
                            {event.countryName}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {event.title}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {event.impact === "Holiday" ? (
                            <span className="text-[11px] font-bold text-muted-foreground">
                              Holiday
                            </span>
                          ) : (
                            <span
                              className="inline-flex gap-0.5"
                              aria-label={`${event.impact} impact`}
                            >
                              {[0, 1, 2].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-3.5 h-3.5 ${
                                    star < impactStars(event.impact)
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-muted-foreground/40"
                                  }`}
                                />
                              ))}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-foreground num-font whitespace-nowrap">
                          {event.actual ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-muted-foreground num-font whitespace-nowrap">
                          {event.forecast ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-muted-foreground num-font whitespace-nowrap">
                          {event.previous ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

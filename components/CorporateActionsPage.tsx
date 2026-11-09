"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search } from "lucide-react";
import UnofficialSourceBadge from "@/components/common/UnofficialSourceBadge";
import {
  fetchScrapedEvents,
  getScrapedEventClientErrorMessage,
  isScrapedEventRequestAborted,
} from "@/lib/scrape/scraped-event-client";
import type { CorporateActionDTO } from "@/lib/scrape/scraped-event-client";
import {
  CORPORATE_ACTION_CATEGORIES,
  classifyCorporateAction,
  type CorporateActionCategory,
} from "@/lib/corporate-actions";

const REFRESH_INTERVAL_MS = 60_000;

type Scope = "Upcoming" | "Past" | "All";
type SortKey = "Soonest" | "Latest";

const SCOPES: readonly Scope[] = ["Upcoming", "Past", "All"];

function getBadgeStyle(category: CorporateActionCategory): string {
  switch (category) {
    case "Dividends":
      return "bg-info/20 text-info border-blue-300";
    case "Interest":
      return "bg-muted text-muted-foreground border-border";
    case "Distributions":
      return "bg-cyan-100 text-cyan-700 border-cyan-300";
    case "Buyback":
      return "bg-success/20 text-success border-green-300";
    case "Bonus":
      return "bg-purple-100 text-purple-700 border-purple-300";
    case "Split":
      return "bg-orange-100 text-warning border-orange-300";
    case "Rights":
      return "bg-cyan-100 text-cyan-700 border-cyan-300";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function startOfTodayIst(): Date {
  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  nowIst.setHours(0, 0, 0, 0);
  return nowIst;
}

function CorporateActionCard({
  action,
  category,
}: {
  action: CorporateActionDTO;
  category: CorporateActionCategory;
}) {
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-4">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <Link
            href={`/stock/${encodeURIComponent(action.symbol)}`}
            className="font-semibold text-foreground text-base hover:text-primary hover:underline"
          >
            {action.companyName}
          </Link>
          <p className="text-xs text-muted-foreground">{action.symbol}</p>
        </div>
        <span
          className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded border ${getBadgeStyle(category)}`}
        >
          {category}
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        {action.purpose || "—"}
      </p>

      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Record Date</p>
          <p className="text-sm text-muted-foreground">
            {action.recordDate ? formatDate(action.recordDate) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Ex-Date</p>
          <p className="text-sm text-muted-foreground">
            {formatDate(action.eventDate)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CorporateActionsPage() {
  const [actions, setActions] = useState<CorporateActionDTO[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [activeCategory, setActiveCategory] = useState<
    CorporateActionCategory | "All"
  >("All");
  const [scope, setScope] = useState<Scope>("Upcoming");
  const [sortKey, setSortKey] = useState<SortKey>("Soonest");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetchScrapedEvents<CorporateActionDTO>(
          "/api/market-data/corporate-action",
          controller.signal,
        );
        if (!isCurrentRequest) return;
        setActions([...response.events]);
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

  const categorized = useMemo(
    () =>
      actions.map((action) => ({
        action,
        category: classifyCorporateAction(action.purpose),
      })),
    [actions],
  );

  const counts = useMemo(() => {
    const map = new Map<CorporateActionCategory, number>();
    for (const { category } of categorized) {
      map.set(category, (map.get(category) ?? 0) + 1);
    }
    return map;
  }, [categorized]);

  const visibleTabs = useMemo(
    () =>
      CORPORATE_ACTION_CATEGORIES.filter(
        (category) => (counts.get(category) ?? 0) > 0,
      ),
    [counts],
  );

  const upcomingCount = useMemo(() => {
    const todayStart = startOfTodayIst();
    return actions.filter(
      (action) => new Date(action.eventDate) >= todayStart,
    ).length;
  }, [actions]);

  const filteredData = useMemo(() => {
    const todayStart = startOfTodayIst();
    const query = searchQuery.trim().toLowerCase();
    const filtered = categorized.filter(({ action, category }) => {
      if (activeCategory !== "All" && category !== activeCategory) return false;
      const eventDate = new Date(action.eventDate);
      if (scope === "Upcoming" && eventDate < todayStart) return false;
      if (scope === "Past" && eventDate >= todayStart) return false;
      if (!query) return true;
      return (
        action.companyName.toLowerCase().includes(query) ||
        action.symbol.toLowerCase().includes(query) ||
        action.purpose.toLowerCase().includes(query)
      );
    });
    filtered.sort((a, b) =>
      sortKey === "Soonest"
        ? a.action.eventDate < b.action.eventDate
          ? -1
          : 1
        : a.action.eventDate < b.action.eventDate
          ? 1
          : -1,
    );
    return filtered;
  }, [categorized, activeCategory, scope, sortKey, searchQuery]);

  return (
    <div className="min-h-screen bg-muted">
      <div className="w-full px-4 lg:px-8 py-6">
        <UnofficialSourceBadge
          lastSyncAt={lastSyncAt}
          label="NSE bhavcopy snapshot — synced daily; debt interest shown separately from equity dividends"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-xs text-muted-foreground">
            {actions.length} actions in snapshot · {upcomingCount} upcoming
            {lastSyncAt
              ? ` · showing ${filteredData.length} of ${actions.length}`
              : ""}
          </p>
          <button
            onClick={() => setRefreshVersion((version) => version + 1)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-muted-foreground border border-border bg-card rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            {SCOPES.map((tab) => (
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">
              Sort:
            </span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-border bg-card rounded-xl focus:outline-none focus:border-ring"
            >
              <option>Soonest</option>
              <option>Latest</option>
            </select>
          </div>
        </div>

        <div className="border-b border-border mb-6">
          <div className="flex flex-wrap gap-1 overflow-x-auto">
            {(["All", ...visibleTabs] as const).map((tab) => {
              const count =
                tab === "All" ? actions.length : (counts.get(tab) ?? 0);
              return (
                <button
                  key={tab}
                  onClick={() => setActiveCategory(tab)}
                  className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeCategory === tab
                      ? "text-foreground border-b-2 border-foreground"
                      : "text-muted-foreground hover:text-muted-foreground"
                  }`}
                >
                  {tab}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by company, symbol, or purpose"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-transparent"
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

        {isLoading && filteredData.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">Loading corporate actions…</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">
              No corporate actions found matching your criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredData.map(({ action, category }) => (
              <CorporateActionCard
                key={`${action.symbol}-${action.eventDate}-${action.purpose}`}
                action={action}
                category={category}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

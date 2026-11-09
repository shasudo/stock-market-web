"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  PageHeader,
  SearchInput,
  TabCount,
  LevelCell,
  matchesSearch,
} from "@/components/common";
import apiClient, {
  getApiResponseMessage,
  getAxiosErrorMessage,
  isRecord,
  isSuccessfulApiResponse,
} from "@/lib/api-client";
import { daysSince } from "@/lib/format";
import type { WatchlistCategory } from "@/types";

type AlertSource = "watchlist" | "preposition" | "paper" | "live" | "others";
type AlertDirection = "above" | "below";

interface Alert {
  readonly id: string;
  readonly tradingSymbol: string;
  readonly displayName: string;
  readonly targetPrice: number;
  readonly direction: AlertDirection;
  readonly status: "active" | "triggered";
  readonly source: AlertSource;
  readonly category: WatchlistCategory;
  readonly createdAt: string;
  readonly triggeredAt: string | null;
  readonly ltp: number | null;
}

function isAlert(value: unknown): value is Alert {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.tradingSymbol === "string" &&
    typeof value.displayName === "string" &&
    typeof value.targetPrice === "number" &&
    typeof value.direction === "string" &&
    typeof value.status === "string" &&
    typeof value.source === "string" &&
    typeof value.category === "string" &&
    typeof value.createdAt === "string" &&
    (value.triggeredAt === null || typeof value.triggeredAt === "string") &&
    (value.ltp === null || typeof value.ltp === "number")
  );
}

function extractAlert(responseData: unknown): Alert | null {
  if (!isSuccessfulApiResponse(responseData) || !isRecord(responseData.data)) {
    return null;
  }
  const alert = responseData.data.alert;
  return isAlert(alert) ? alert : null;
}

async function requestAlerts(): Promise<Alert[] | null> {
  const response = await apiClient.get<unknown>("/api/alerts");
  if (
    !isSuccessfulApiResponse(response.data) ||
    !isRecord(response.data.data)
  ) {
    return null;
  }

  const alerts = response.data.data.alerts;
  return Array.isArray(alerts) ? alerts.filter(isAlert) : null;
}

type SourceFilter = "all" | AlertSource;

const sourceTabs: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "All Sources" },
  { id: "watchlist", label: "Watchlist" },
  { id: "preposition", label: "Preposition Watchlist" },
  { id: "paper", label: "Paper Trading" },
  { id: "live", label: "Live Trading" },
  { id: "others", label: "Others" },
];

const validSourceFilters: readonly SourceFilter[] = sourceTabs.map(
  (tab) => tab.id,
);

function isSourceFilter(value: string | null): value is SourceFilter {
  return (
    value !== null && (validSourceFilters as readonly string[]).includes(value)
  );
}

type CategoryFilter = "all" | WatchlistCategory;

const categoryTabs: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All Types" },
  { id: "intraday", label: "Intraday Trading" },
  { id: "fno", label: "F&O Trading" },
  { id: "swing", label: "Swing Trading" },
  { id: "positional", label: "Positional Trading" },
  { id: "multibagger", label: "Multi Bagger Stocks" },
];

export default function AlertsPage() {
  return (
    <Suspense fallback={null}>
      <AlertsPageContent />
    </Suspense>
  );
}

/** ISO date string ("YYYY-MM-DD") in this browser's local time, so
 * date-range filtering compares against the date the user actually sees on
 * the row, not a UTC-shifted one. */
function toLocalDateInput(iso: string): string {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

/** Every angle asked for: an exact-match search plus a from/to range on
 * whichever date column the table is showing (created, or triggered). */
function inDateRange(iso: string, from: string, to: string): boolean {
  const value = toLocalDateInput(iso);
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

// No trendline/candlestick/chart-pattern/indicator feed is wired into this
// app per symbol (same call already made for the watchlist's board-meeting
// column and the trading tables' pattern columns) - rendered as a
// placeholder so the layout matches the sheet without fabricating a feed.
function PlaceholderCell() {
  return <td className="px-3 py-2.5 text-xs text-muted-foreground">-</td>;
}

function AlertsPageContent() {
  const searchParams = useSearchParams();
  const sourceParam = searchParams.get("source");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(() =>
    isSourceFilter(sourceParam) ? sourceParam : "all",
  );
  // Nav-driven links change `source` on the same route (no remount), so the
  // filter has to resync during render when it does - an effect here would
  // cause an extra flash of the stale filter before correcting itself.
  const [syncedSourceParam, setSyncedSourceParam] = useState(sourceParam);
  if (sourceParam !== syncedSourceParam) {
    setSyncedSourceParam(sourceParam);
    setSourceFilter(isSourceFilter(sourceParam) ? sourceParam : "all");
  }

  useEffect(() => {
    let isCurrent = true;

    void requestAlerts()
      .then((loaded) => {
        if (!isCurrent) return;
        if (loaded === null) {
          toast.error("Received an invalid alerts response");
          return;
        }
        setAlerts(loaded);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          toast.error(getAxiosErrorMessage(error, "Failed to load alerts"));
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleDelete = async (id: string): Promise<void> => {
    try {
      const response = await apiClient.delete<unknown>("/api/alerts", {
        data: { id },
      });

      if (isSuccessfulApiResponse(response.data)) {
        toast.success("Alert removed");
        setAlerts((current) => current.filter((alert) => alert.id !== id));
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to remove alert"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to remove alert"));
    }
  };

  const handleTargetChange = async (
    id: string,
    value: number,
  ): Promise<void> => {
    try {
      const response = await apiClient.patch<unknown>("/api/alerts", {
        id,
        targetPrice: value,
      });
      if (isSuccessfulApiResponse(response.data)) {
        const updated = extractAlert(response.data);
        if (updated) {
          setAlerts((current) =>
            current.map((alert) =>
              alert.id === id ? { ...alert, ...updated } : alert,
            ),
          );
        }
      } else {
        toast.error(getApiResponseMessage(response.data, "Unable to save"));
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to save"));
    }
  };

  const handleDirectionChange = async (
    id: string,
    direction: AlertDirection,
  ): Promise<void> => {
    try {
      const response = await apiClient.patch<unknown>("/api/alerts", {
        id,
        direction,
      });
      if (isSuccessfulApiResponse(response.data)) {
        const updated = extractAlert(response.data);
        if (updated) {
          setAlerts((current) =>
            current.map((alert) =>
              alert.id === id ? { ...alert, ...updated } : alert,
            ),
          );
        }
      } else {
        toast.error(getApiResponseMessage(response.data, "Unable to save"));
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Unable to save"));
    }
  };

  const beforeDateAndSearch = alerts.filter(
    (alert) =>
      (sourceFilter === "all" || alert.source === sourceFilter) &&
      (categoryFilter === "all" || alert.category === categoryFilter),
  );

  const countBySource = (value: SourceFilter): number =>
    alerts.filter(
      (alert) =>
        (value === "all" || alert.source === value) &&
        (categoryFilter === "all" || alert.category === categoryFilter),
    ).length;

  const countByCategory = (value: CategoryFilter): number =>
    alerts.filter(
      (alert) =>
        (value === "all" || alert.category === value) &&
        (sourceFilter === "all" || alert.source === sourceFilter),
    ).length;

  const activeAlerts = beforeDateAndSearch
    .filter((alert) => alert.status === "active")
    .filter((alert) => inDateRange(alert.createdAt, dateFrom, dateTo))
    .filter((alert) =>
      matchesSearch(search, alert.tradingSymbol, alert.displayName),
    );

  const triggeredAlerts = beforeDateAndSearch
    .filter((alert) => alert.status === "triggered")
    .filter((alert) =>
      inDateRange(alert.triggeredAt ?? alert.createdAt, dateFrom, dateTo),
    )
    .filter((alert) =>
      matchesSearch(search, alert.tradingSymbol, alert.displayName),
    );

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <PageHeader
          title="Price Alerts"
          description="Real-time notifications and conditional triggers across all active watchlists"
          icon={Bell}
        />

        <div className="flex items-center gap-1 flex-wrap mb-4 overflow-x-auto w-full md:w-fit">
          {sourceTabs.map((tab) => {
            const isActive = sourceFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSourceFilter(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    isActive
                      ? "bg-white/25 dark:bg-zinc-950/10 text-white dark:text-zinc-950"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {countBySource(tab.id)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 flex-wrap mb-6 overflow-x-auto w-full md:w-fit">
          {categoryTabs.map((tab) => {
            const isActive = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    isActive
                      ? "bg-white/25 dark:bg-zinc-950/10 text-white dark:text-zinc-950"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {countByCategory(tab.id)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter bar */}
        <div className="rounded-2xl border border-border bg-card shadow-xs p-4 mb-8 flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="dateFrom"
              className="block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-1"
            >
              From Date
            </label>
            <input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none shadow-xs"
            />
          </div>
          <div>
            <label
              htmlFor="dateTo"
              className="block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-1"
            >
              To Date
            </label>
            <input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none shadow-xs"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear dates
            </button>
          )}
          <div className="ml-auto w-full sm:w-64">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search symbol, company..."
              className="relative w-full"
              inputClassName="w-full rounded-xl border border-border bg-card py-1.5 pl-7 pr-7 text-xs text-foreground placeholder-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none shadow-xs"
            />
          </div>
        </div>

        <AlertsTable
          title="Active Alerts"
          alerts={activeAlerts}
          loading={loading}
          search={search}
          onDelete={handleDelete}
          onTargetChange={handleTargetChange}
          onDirectionChange={handleDirectionChange}
        />

        <div className="mt-10">
          <AlertsTable
            title="Alerts Triggered"
            alerts={triggeredAlerts}
            loading={loading}
            search={search}
            triggered
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}

function AlertsTable({
  title,
  alerts,
  loading,
  search,
  triggered = false,
  onDelete,
  onTargetChange,
  onDirectionChange,
}: {
  title: string;
  alerts: readonly Alert[];
  loading: boolean;
  search: string;
  triggered?: boolean;
  onDelete: (id: string) => Promise<void>;
  onTargetChange?: (id: string, value: number) => Promise<void>;
  onDirectionChange?: (id: string, direction: AlertDirection) => Promise<void>;
}) {
  // Triggered rows add one column (when it fired) that active rows don't
  // carry - everything else is the same shape, per the sheet.
  const columnCount = triggered ? 14 : 13;

  return (
    <div>
      <h2 className="text-sm md:text-base font-extrabold text-foreground mb-3 flex items-center tracking-tight">
        {title}
        <span className="ml-2 text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
          {alerts.length}
        </span>
      </h2>
      <div className="rounded-3xl border border-border bg-card/95 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04),0_1px_3px_rgb(0,0,0,0.02)] overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] select-none">
                  S No
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] whitespace-nowrap select-none">
                  Date &amp; Time
                </th>
                <th className="px-4 py-3.5 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] select-none">
                  Days
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] select-none">
                  Trading Symbol
                </th>
                <th className="px-4 py-3.5 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] select-none">
                  LTP
                </th>
                {triggered && (
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] whitespace-nowrap select-none">
                    Triggered D&amp;T
                  </th>
                )}
                <th className="px-4 py-3.5 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] select-none">
                  Target
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] select-none">
                  Direction
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] select-none">
                  TrendLine
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] whitespace-nowrap select-none">
                  Candlestick Pattern
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] whitespace-nowrap select-none">
                  Chart Pattern
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] select-none">
                  Indicators
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] select-none">
                  Status
                </th>
                <th className="px-4 py-3.5 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] select-none">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-6 py-20 text-center text-xs text-muted-foreground font-medium"
                  >
                    Loading live alerts…
                  </td>
                </tr>
              ) : null}
              {!loading &&
                alerts.map((alert, index) => (
                  <tr
                    key={alert.id}
                    className="finder-row transition-colors border-b border-border hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                  >
                    <td className="px-3 py-2.5 text-xs font-semibold text-muted-foreground num-font text-center">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap num-font">
                      {new Date(alert.createdAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right text-muted-foreground font-mono num-font">
                      {daysSince(alert.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-foreground">
                      <span className="hover:text-primary dark:hover:text-indigo-300 cursor-pointer transition-colors block">
                        {alert.displayName}
                      </span>
                      <span className="block text-[10px] font-mono text-muted-foreground">
                        {alert.tradingSymbol}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-right font-bold text-foreground num-font">
                      {alert.ltp !== null ? `₹${alert.ltp.toFixed(2)}` : "—"}
                    </td>
                    {triggered && (
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap num-font">
                        {alert.triggeredAt
                          ? new Date(alert.triggeredAt).toLocaleString(
                              "en-IN",
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                              },
                            )
                          : "—"}
                      </td>
                    )}
                    {onTargetChange ? (
                      <LevelCell
                        value={alert.targetPrice}
                        reference={alert.ltp ?? alert.targetPrice}
                        label={`Target price for ${alert.tradingSymbol}`}
                        tone="neutral"
                        onSave={(value) => onTargetChange(alert.id, value)}
                      />
                    ) : (
                      <td className="px-3 py-2.5 text-xs font-mono text-right font-semibold text-foreground num-font">
                        ₹{alert.targetPrice.toFixed(2)}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-xs capitalize text-foreground font-medium">
                      {alert.direction}
                    </td>
                    <PlaceholderCell />
                    <PlaceholderCell />
                    <PlaceholderCell />
                    <PlaceholderCell />
                    <td className="px-3 py-2.5 text-xs">
                      <span
                        className={`inline-flex px-2.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-[0.06em] ${
                          alert.status === "triggered"
                            ? "bg-success/10 text-success border border-success/20"
                            : "bg-primary/10 dark:bg-indigo-400/10 text-primary dark:text-indigo-300 border border-primary/30 dark:border-indigo-400/30"
                        }`}
                      >
                        {alert.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => void onDelete(alert.id)}
                        className="p-1.5 text-muted-foreground hover:text-error hover:bg-error/10 rounded-lg transition-all"
                        aria-label={`Delete alert for ${alert.tradingSymbol}`}
                        title="Delete alert"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              {!loading && alerts.length === 0 && (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-6 py-20 text-center text-xs text-muted-foreground font-medium"
                  >
                    No alerts in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

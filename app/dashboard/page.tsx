"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import axios from "axios";
import apiClient from "@/lib/api-client";
import {
  extractDashboardStats,
  type DashboardStats,
} from "@/lib/dashboard/stats-guard";
import {
  CloudOff,
  TrendingUp,
  TrendingDown,
  Eye,
  Wallet,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  LayoutDashboard,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { AuthGuard, LoadingSpinner } from "@/components/common";
import { PageHeader } from "@/components/ds";
import { describeSyncFreshness } from "@/lib/utils";

const REFRESH_INTERVAL_MS = 30_000;
// Data older than this without a successful refresh reads as stale rather
// than current, even though the last fetch itself succeeded.
const STALE_AFTER_MS = 5 * 60_000;

type Stats = DashboardStats;

function DashboardContent() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isColdStart, setIsColdStart] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    let isCurrent = true;

    const loadStats = async (): Promise<void> => {
      try {
        const response = await apiClient.get<unknown>("/api/stocks/stats");
        if (!isCurrent) return;

        const loaded = extractDashboardStats(response.data);
        if (loaded === null) {
          setErrorMessage("The statistics service returned an invalid response.");
          setIsColdStart(false);
          return;
        }

        setStats(loaded);
        setErrorMessage(null);
        setIsColdStart(false);
      } catch (error: unknown) {
        if (!isCurrent) return;

        if (axios.isAxiosError(error) && error.response?.status === 503) {
          // Fresh deploy / DB reset: the sync cron hasn't populated LiveQuote
          // yet. This is an expected transient state, not a failure to report.
          setIsColdStart(true);
          setErrorMessage(null);
        } else {
          setIsColdStart(false);
          setErrorMessage("Failed to load statistics. Retrying shortly.");
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
          // Captured here (post-await), not read live during render, so the
          // staleness check below stays a pure function of state.
          setNowMs(Date.now());
        }
      }
    };

    void loadStats();

    return () => {
      isCurrent = false;
    };
  }, [refreshVersion]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      setRefreshVersion((version) => version + 1);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(refreshTimer);
  }, []);

  if (loading && !stats) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  if (isColdStart && !stats) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card shadow-[var(--card-shadow)]">
            <CloudOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-lg font-semibold text-foreground">
            Market data hasn&apos;t synced yet
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The first market sync hasn&apos;t completed on this deployment.
            This page will pick up data automatically once it has — checking
            again every {REFRESH_INTERVAL_MS / 1000}s.
          </p>
        </div>
      </div>
    );
  }

  const lastSyncedAt = stats?.lastSyncAt ? new Date(stats.lastSyncAt) : null;
  const isStale =
    lastSyncedAt !== null &&
    nowMs !== null &&
    nowMs - lastSyncedAt.getTime() > STALE_AFTER_MS;
  // Date included: a bare time-of-day makes four-day-old stats read as today's.
  const lastSyncedLabel = describeSyncFreshness(stats?.lastSyncAt).label;

  const quickActions = [
    {
      href: "/gainers",
      label: "Top Gainers",
      icon: TrendingUp,
      color: "text-emerald-800 dark:text-emerald-300",
      bgColor: "border border-emerald-600/25 bg-emerald-600/10 dark:border-emerald-400/25 dark:bg-emerald-400/10",
    },
    {
      href: "/losers",
      label: "Top Losers",
      icon: TrendingDown,
      color: "text-rose-800 dark:text-rose-300",
      bgColor: "border border-rose-600/25 bg-rose-600/10 dark:border-rose-400/25 dark:bg-rose-400/10",
    },
    {
      href: "/watchlist",
      label: "Watchlist",
      icon: Eye,
      color: "text-primary",
      bgColor: "border border-primary/25 bg-primary/[0.08]",
    },
    {
      href: "/portfolio",
      label: "Portfolio",
      icon: Wallet,
      color: "text-amber-800 dark:text-amber-300",
      bgColor: "border border-amber-600/25 bg-amber-500/10 dark:border-amber-400/25 dark:bg-amber-400/10",
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.firstName || user?.username || ""}`}
        description="Real-time market surveillance and portfolio overview"
        icon={LayoutDashboard}
        meta={
          lastSyncedLabel ? (
            <div
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                isStale
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-emerald-600/25 bg-emerald-600/10 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isStale
                    ? "bg-destructive"
                    : "bg-emerald-600 animate-pulse dark:bg-emerald-400"
                }`}
              />
              {isStale ? "Sync delayed — " : "Live "}
              {lastSyncedLabel}
            </div>
          ) : undefined
        }
      />

      {errorMessage ? (
        <p
          role="alert"
          className="mb-4 inline-block rounded-[10px] border border-amber-600/25 bg-amber-500/10 px-4 py-2.5 text-xs font-medium text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300"
        >
          {errorMessage}
        </p>
      ) : null}

      {/* Top KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total Gainers */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--card-shadow)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Gainers
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-emerald-600/25 bg-emerald-600/10 dark:border-emerald-400/25 dark:bg-emerald-400/10">
              <TrendingUp className="h-4 w-4 text-emerald-800 dark:text-emerald-300" />
            </div>
          </div>
          <p className="mb-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground md:text-4xl">
            {stats?.totalGainers || 0}
          </p>
          <p className="flex items-center text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />+
            {stats?.avgGain?.toFixed(2) || "0.00"}% avg gain
          </p>
        </div>

        {/* Total Losers */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--card-shadow)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Losers
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-rose-600/25 bg-rose-600/10 dark:border-rose-400/25 dark:bg-rose-400/10">
              <TrendingDown className="h-4 w-4 text-rose-800 dark:text-rose-300" />
            </div>
          </div>
          <p className="mb-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground md:text-4xl">
            {stats?.totalLosers || 0}
          </p>
          <p className="flex items-center text-xs font-semibold text-rose-800 dark:text-rose-300">
            <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
            {stats?.avgLoss?.toFixed(2) || "0.00"}% avg loss
          </p>
        </div>

        {/* Market Activity */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--card-shadow)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Market Breadth
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/25 bg-primary/[0.08]">
              <Activity className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="mb-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground md:text-4xl">
            {stats && stats.totalGainers + stats.totalLosers > 0
              ? `${Math.round((stats.totalGainers / (stats.totalGainers + stats.totalLosers)) * 100)}%`
              : "Active"}
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            Positive Advance/Decline ratio
          </p>
        </div>
      </div>

      {/* Top Performer Spotlights */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {/* Top Gainer Spotlight */}
        {stats?.topGainer && (
          <div className="relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-[var(--card-shadow)]">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <span className="mb-2 inline-flex rounded-md border border-emerald-600/25 bg-emerald-600/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300">
                  Top Performer
                </span>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {stats.topGainer.company}
                </h3>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                  {stats.topGainer.sector}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-600/25 bg-emerald-600/10 dark:border-emerald-400/25 dark:bg-emerald-400/10">
                <TrendingUp className="h-5 w-5 text-emerald-800 dark:text-emerald-300" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Last Traded Price
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">
                  ₹{stats.topGainer.ltp.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Daily Gain</p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                  +{stats.topGainer.percentInChange.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Top Loser Spotlight */}
        {stats?.topLoser && (
          <div className="relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-[var(--card-shadow)]">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <span className="mb-2 inline-flex rounded-md border border-rose-600/25 bg-rose-600/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-300">
                  Top Lagging Stock
                </span>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {stats.topLoser.company}
                </h3>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                  {stats.topLoser.sector}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-rose-600/25 bg-rose-600/10 dark:border-rose-400/25 dark:bg-rose-400/10">
                <TrendingDown className="h-5 w-5 text-rose-800 dark:text-rose-300" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Last Traded Price
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">
                  ₹{stats.topLoser.ltp.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Daily Change</p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-rose-800 dark:text-rose-300">
                  {stats.topLoser.percentInChange.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Navigation Grid */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
          <Terminal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Terminal Shortcuts
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {quickActions.map((action) => (
            <div key={action.href}>
              <Link
                href={action.href}
                className="group block rounded-lg border border-border bg-card p-4 shadow-[var(--card-shadow)]"
              >
                <div
                  className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${action.bgColor}`}
                >
                  <action.icon className={`h-4 w-4 ${action.color}`} />
                </div>
                <p className="text-[13px] font-semibold text-foreground group-hover:text-primary">
                  {action.label}
                </p>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard loadingMessage="Loading dashboard...">
      <DashboardContent />
    </AuthGuard>
  );
}

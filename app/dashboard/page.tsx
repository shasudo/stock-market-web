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
  TrendingUp,
  TrendingDown,
  Eye,
  Wallet,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AuthGuard, LoadingSpinner } from "@/components/common";
import { describeSyncFreshness } from "@/lib/utils";

const REFRESH_INTERVAL_MS = 30_000;
// Data older than this without a successful refresh reads as stale rather
// than current, even though the last fetch itself succeeded.
const STALE_AFTER_MS = 5 * 60_000;

type Stats = DashboardStats;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
    },
  },
};

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
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
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
      color: "text-success",
      bgColor: "bg-success/10 border border-success/30",
    },
    {
      href: "/losers",
      label: "Top Losers",
      icon: TrendingDown,
      color: "text-error",
      bgColor: "bg-error/10 border border-error/30",
    },
    {
      href: "/watchlist",
      label: "Watchlist",
      icon: Eye,
      color: "text-primary",
      bgColor: "bg-primary/10 border border-primary/30",
    },
    {
      href: "/portfolio",
      label: "Portfolio",
      icon: Wallet,
      color: "text-purple",
      bgColor: "bg-fuchsia-50 border border-fuchsia-200",
    },
  ];

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-[-0.035em]">
                Welcome back, {user?.firstName || user?.username}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground font-medium mt-1">
                Real-time market surveillance and portfolio overview
              </p>
            </div>
            {lastSyncedLabel ? (
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  isStale
                    ? "bg-error/10 text-error border border-error/30"
                    : "bg-success/10 text-success border border-success/30"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isStale ? "bg-error" : "bg-success animate-pulse"}`} />
                {isStale ? "Sync delayed — " : "Live "}
                {lastSyncedLabel}
              </div>
            ) : null}
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="mt-3 inline-block rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs font-semibold text-warning"
            >
              {errorMessage}
            </p>
          ) : null}
        </motion.div>

        {/* Top KPI Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8"
        >
          {/* Total Gainers */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-border/90 bg-card shadow-xs p-6 group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                Total Gainers
              </span>
              <div className="w-10 h-10 bg-success/10 border border-success/30 rounded-xl flex items-center justify-center transition-transform">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
            </div>
            <p className="text-3xl md:text-4xl font-extrabold text-foreground mb-1 font-mono tracking-tight num-font">
              {stats?.totalGainers || 0}
            </p>
            <p className="text-xs font-bold text-success flex items-center">
              <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />+
              {stats?.avgGain?.toFixed(2) || "0.00"}% avg gain
            </p>
          </motion.div>

          {/* Total Losers */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-border/90 bg-card shadow-xs p-6 group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                Total Losers
              </span>
              <div className="w-10 h-10 bg-error/10 border border-error/30 rounded-xl flex items-center justify-center transition-transform">
                <TrendingDown className="h-5 w-5 text-error" />
              </div>
            </div>
            <p className="text-3xl md:text-4xl font-extrabold text-foreground mb-1 font-mono tracking-tight num-font">
              {stats?.totalLosers || 0}
            </p>
            <p className="text-xs font-bold text-error flex items-center">
              <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
              {stats?.avgLoss?.toFixed(2) || "0.00"}% avg loss
            </p>
          </motion.div>

          {/* Market Activity */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-border/90 bg-card shadow-xs p-6 group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                Market Breadth
              </span>
              <div className="w-10 h-10 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-center transition-transform">
                <Activity className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-3xl md:text-4xl font-extrabold text-foreground mb-1 font-mono tracking-tight num-font">
              {stats && stats.totalGainers + stats.totalLosers > 0
                ? `${Math.round((stats.totalGainers / (stats.totalGainers + stats.totalLosers)) * 100)}%`
                : "Active"}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              Positive Advance/Decline ratio
            </p>
          </motion.div>
        </motion.div>

        {/* Top Performer Spotlights */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid md:grid-cols-2 gap-6 mb-8"
        >
          {/* Top Gainer Spotlight */}
          {stats?.topGainer && (
            <motion.div
              variants={itemVariants}
              className="rounded-2xl border border-border/90 bg-card shadow-xs p-6 group relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="inline-flex px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-[0.06em] bg-success/10 text-success border border-success/30 mb-2">
                    Top Performer
                  </span>
                  <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {stats.topGainer.company}
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    {stats.topGainer.sector}
                  </p>
                </div>
                <div className="w-11 h-11 bg-success/10 border border-success/30 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.06em]">
                    Last Traded Price
                  </p>
                  <p className="text-lg font-bold text-foreground font-mono num-font mt-0.5">
                    ₹{stats.topGainer.ltp.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.06em]">Daily Gain</p>
                  <p className="text-lg font-bold text-success font-mono num-font mt-0.5">
                    +{stats.topGainer.percentInChange.toFixed(2)}%
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Top Loser Spotlight */}
          {stats?.topLoser && (
            <motion.div
              variants={itemVariants}
              className="rounded-2xl border border-border/90 bg-card shadow-xs p-6 group relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="inline-flex px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-[0.06em] bg-error/10 text-error border border-error/30 mb-2">
                    Top Lagging Stock
                  </span>
                  <h3 className="text-xl font-bold text-foreground group-hover:text-error transition-colors">
                    {stats.topLoser.company}
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    {stats.topLoser.sector}
                  </p>
                </div>
                <div className="w-11 h-11 bg-error/10 border border-error/30 rounded-2xl flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-error" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.06em]">
                    Last Traded Price
                  </p>
                  <p className="text-lg font-bold text-foreground font-mono num-font mt-0.5">
                    ₹{stats.topLoser.ltp.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.06em]">Daily Change</p>
                  <p className="text-lg font-bold text-error font-mono num-font mt-0.5">
                    {stats.topLoser.percentInChange.toFixed(2)}%
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Quick Action Navigation Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <h2 className="text-lg font-bold text-foreground mb-4 tracking-tight">
            Terminal Shortcuts
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <motion.div key={action.href} variants={itemVariants}>
                <Link
                  href={action.href}
                  className="group block rounded-2xl border border-border/90 bg-card shadow-xs p-5"
                >
                  <div
                    className={`w-11 h-11 ${action.bgColor} rounded-xl flex items-center justify-center mb-3 transition-transform`}
                  >
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <p className="text-xs md:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {action.label}
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
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


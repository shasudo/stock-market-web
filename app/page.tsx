"use client";

import Link from "next/link";
import {
  BarChart3,
  Shield,
  Zap,
  TrendingUp,
  ArrowRight,
  LineChart,
  Layers,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    iconTone:
      "border-emerald-600/25 bg-emerald-600/10 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300",
    title: "Real-Time Market Terminal",
    description:
      "Direct feed from NSE & BSE with institutional tick speed, advance-decline breadth, and multi-timeframe analytics.",
  },
  {
    icon: Layers,
    iconTone: "border-primary/25 bg-primary/[0.08] text-primary",
    title: "High-Density Screeners",
    description:
      "Dense tabular screens with instant sorting, filters, sparklines, and level management.",
  },
  {
    icon: LineChart,
    iconTone:
      "border-amber-600/25 bg-amber-500/10 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300",
    title: "Strategy Builder & Backtesting",
    description:
      "Build custom multi-leg candlestick strategies and backtest against historical ticks with detailed trade logs.",
  },
  {
    icon: Shield,
    iconTone:
      "border-sky-600/25 bg-sky-600/10 text-sky-800 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-300",
    title: "Institutional Security",
    description:
      "Enterprise authentication and segregated paper & live execution sandboxes for total peace of mind.",
  },
  {
    icon: Zap,
    iconTone:
      "border-amber-600/25 bg-amber-500/10 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300",
    title: "F&O & Derivatives Chain",
    description:
      "Comprehensive option chain, open interest heatmaps, PCR analysis, and max pain calculation.",
  },
  {
    icon: Sparkles,
    iconTone:
      "border-rose-600/25 bg-rose-600/10 text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-300",
    title: "Super Investors & FII/DII",
    description:
      "Track institutional footprints, bulk & block deals, corporate actions, and super investor portfolios.",
  },
];

const stats = [
  { value: "10K+", label: "Active Traders", tone: "text-primary" },
  {
    value: "₹50Cr+",
    label: "Assets Tracked",
    tone: "text-emerald-800 dark:text-emerald-300",
  },
  {
    value: "99.9%",
    label: "System Uptime",
    tone: "text-sky-800 dark:text-sky-300",
  },
  {
    value: "60+",
    label: "Market Screens",
    tone: "text-amber-800 dark:text-amber-300",
  },
];

export default function HomePage() {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-[1100px] px-4 pt-16 pb-14 text-center md:pt-20 md:pb-16 lg:px-6">
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-emerald-600/25 bg-emerald-600/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse dark:bg-emerald-400" />
            <span>Live NSE &amp; BSE Market Data Feed</span>
          </div>

          <h1 className="mx-auto max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground md:text-[52px] md:leading-[1.05]">
            Institutional trading intelligence, engineered for clarity
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Market surveillance with dense tabular terminals, real-time F&amp;O
            analytics, custom strategy backtests, and portfolio tracking.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/gainers"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Launch Terminal
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              View Dashboard
            </Link>
          </div>

          <p className="mt-5 text-xs font-medium text-muted-foreground">
            Real-time synchronization • No account configuration needed
          </p>
        </div>
      </section>

      {/* Metrics */}
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto w-full max-w-[1100px] px-4 py-10 lg:px-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[10px] border border-border bg-card p-5 text-center"
              >
                <p
                  className={`mb-1 font-mono text-3xl font-semibold tabular-nums tracking-tight md:text-4xl ${stat.tone}`}
                >
                  {stat.value}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-14 md:py-16">
        <div className="mx-auto w-full max-w-[1100px] px-4 lg:px-6">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="mb-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Complete pro terminal toolset
            </h2>
            <p className="text-sm text-muted-foreground">
              Engineered for speed, consistency, and analytical clarity.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[10px] border border-border bg-card p-5"
              >
                <div
                  className={`mb-4 flex h-9 w-9 items-center justify-center rounded-md border ${feature.iconTone}`}
                >
                  <feature.icon className="h-4 w-4" />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold tracking-tight text-foreground">
                  {feature.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-16">
        <div className="mx-auto w-full max-w-[1100px] px-4 lg:px-6">
          <div className="rounded-[10px] border border-border bg-card p-8 text-center md:p-12">
            <h2 className="mb-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Ready to elevate your trading edge?
            </h2>
            <p className="mx-auto mb-6 max-w-xl text-sm text-muted-foreground">
              Explore real-time gainers, track institutional positions, and
              backtest your strategies.
            </p>
            <Link
              href="/gainers"
              className="inline-flex items-center justify-center rounded-md bg-primary px-7 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Explore Market Terminal
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row lg:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BarChart3 className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              StockMarket Pro
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            Institutional-grade market data terminal &amp; quantitative
            analytics platform.
          </p>
        </div>
      </footer>
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  BarChart3,
  Shield,
  Zap,
  TrendingUp,
  ArrowRight,
  Check,
  LineChart,
  Layers,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: TrendingUp,
    iconBg: "bg-success/10 text-emerald-600 border-success/30/80",
    title: "Real-Time Market Terminal",
    description:
      "Direct feed from NSE & BSE with institutional tick speed, advance-decline heatmaps, and multi-timeframe analytics.",
  },
  {
    icon: Layers,
    iconBg: "bg-primary/10 text-primary border-primary/30/80",
    title: "macOS Finder-Style Screeners",
    description:
      "Pixel-perfect high-density zebra striped tables with instant sorting, filters, sparklines, and level management.",
  },
  {
    icon: LineChart,
    iconBg: "bg-purple-50 text-purple-600 border-purple-200/80",
    title: "Strategy Builder & Backtesting",
    description:
      "Build custom multi-leg candlestick strategies and backtest against historical ticks with detailed trade logs.",
  },
  {
    icon: Shield,
    iconBg: "bg-info/10 text-sky-600 border-info/30/80",
    title: "Institutional Security",
    description:
      "Enterprise authentication and segregated paper & live execution sandboxes for total peace of mind.",
  },
  {
    icon: Zap,
    iconBg: "bg-warning/10 text-amber-600 border-warning/30/80",
    title: "F&O & Derivatives Chain",
    description:
      "Comprehensive option chain, open interest heatmaps, PCR analysis, and max pain calculation.",
  },
  {
    icon: Sparkles,
    iconBg: "bg-error/10 text-error border-error/30/80",
    title: "Super Investors & FII/DII",
    description:
      "Track institutional footprints, bulk & block deals, corporate actions, and super investor portfolios.",
  },
];

const stats = [
  { value: "10K+", label: "Active Traders", tone: "text-primary" },
  { value: "₹50Cr+", label: "Assets Tracked", tone: "text-emerald-600" },
  { value: "99.9%", label: "System Uptime", tone: "text-sky-600" },
  { value: "60+", label: "Market Screens", tone: "text-purple-600" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-muted/50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-indigo-50/20 to-slate-50/50 border-b border-border/80">
        <div className="absolute inset-0 bg-[radial-gradient(#e0e7ff_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

        <div className="relative w-full px-4 lg:px-8 pt-16 pb-24 md:pt-24 md:pb-36">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            {/* Live Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-card border border-success/30/80 rounded-full text-xs font-semibold text-emerald-800 mb-8 shadow-xs"
            >
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span>Live NSE &amp; BSE Market Data Feed</span>
            </motion.div>

            {/* Main Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-foreground mb-6 tracking-tight">
              Institutional Trading Intelligence
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Engineered for High-Velocity Alpha
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Experience seamless market surveillance with macOS Finder zebra-striped terminals,
              real-time F&amp;O analytics, custom strategy backtests, and portfolio tracking.
            </p>

            {/* Call to Actions */}
            <div className="flex flex-col sm:flex-row gap-3.5 justify-center items-center">
              <Link
                href="/gainers"
                className="group inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold text-primary-foreground bg-primary rounded-xl transition-all shadow-md shadow-primary/25 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30"
              >
                Launch Terminal
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold text-muted-foreground bg-card border border-border/90 rounded-xl hover:bg-muted hover:text-foreground transition-all shadow-xs"
              >
                View Dashboard
              </Link>
            </div>

            <p className="text-xs text-muted-foreground mt-6 font-medium">
              Real-time synchronization • No account configuration needed
            </p>
          </motion.div>
        </div>
      </section>

      {/* Metrics Banner */}
      <section className="border-b border-black/[0.06] bg-muted/70 backdrop-blur-md">
        <div className="w-full px-4 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center p-5 rounded-3xl bg-card/80 border border-border"
              >
                <p className={`text-3xl md:text-4xl font-extrabold ${stat.tone} mb-1 num-font font-mono tracking-tight`}>
                  {stat.value}
                </p>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.06em]">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 md:py-28">
        <div className="w-full px-4 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
          >
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-3 tracking-[-0.035em]">
                Complete Pro Terminal Toolset
              </h2>
              <p className="text-sm md:text-base text-muted-foreground font-medium">
                Engineered for speed, consistency, and analytical clarity.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className="apple-glass-card apple-card-hover p-7 flex flex-col justify-between"
                >
                  <div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${feature.iconBg}`}>
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-2 tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed font-medium">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Action CTA */}
      <section className="pb-24">
        <div className="w-full px-4 lg:px-8">
          <div className="apple-glass-card p-10 md:p-14 text-center relative overflow-hidden bg-gradient-to-b from-white to-[#F5F5F7]">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-3 tracking-[-0.035em]">
                Ready to elevate your trading edge?
              </h2>
              <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto font-medium">
                Explore real-time gainers, track institutional positions, and backtest your strategies.
              </p>
            </div>

            <div className="text-center">
              <Link
                href="/gainers"
                className="inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold text-primary-foreground bg-primary rounded-2xl hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,122,255,0.28)]"
              >
                Explore Market Terminal
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/[0.06] py-8 bg-muted/70 backdrop-blur-md">
        <div className="w-full px-4 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
                <BarChart3 className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold text-foreground tracking-tight">
                StockMarket Pro
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Institutional-grade market data terminal &amp; quantitative analytics platform.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}


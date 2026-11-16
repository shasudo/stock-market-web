"use client";

import { AuthGuard } from "@/components/common";
import { PageHeader } from "@/components/ds";
import { Briefcase, TrendingUp, FileText, ArrowRight, PieChart } from "lucide-react";
import Link from "next/link";

const portfolioOptions = [
  {
    href: "/portfolio/holdings",
    icon: Briefcase,
    title: "Holdings",
    description: "Stocks added from any stock's three-dot menu",
    tile: "border-amber-600/25 bg-amber-500/10",
    iconColor: "text-amber-800 dark:text-amber-300",
  },
  {
    href: "/portfolio/live-trading",
    icon: TrendingUp,
    title: "Live Trading",
    description:
      "View your real trading portfolio with actual market positions",
    tile: "border-emerald-600/25 bg-emerald-600/10 dark:border-emerald-400/25 dark:bg-emerald-400/10",
    iconColor: "text-emerald-800 dark:text-emerald-300",
  },
  {
    href: "/portfolio/paper-trading",
    icon: FileText,
    title: "Paper Trading",
    description: "Practice trading with simulated positions and virtual money",
    tile: "border-primary/25 bg-primary/[0.08]",
    iconColor: "text-primary",
  },
  {
    href: "/portfolio/management",
    icon: PieChart,
    title: "Portfolio Management",
    description: "Analyze and manage your portfolio allocation and risk",
    tile: "border-primary/25 bg-primary/[0.08]",
    iconColor: "text-primary",
  },
];

export default function PortfolioPage() {
  return (
    <AuthGuard loadingMessage="Loading portfolio...">
      <PortfolioContent />
    </AuthGuard>
  );
}

function PortfolioContent() {
  return (
    <div>
      <div className="w-full">
        <PageHeader
          title="Portfolio"
          description="Manage your trading portfolios"
          icon={Briefcase}
        />

        <div className="grid gap-4 md:grid-cols-2">
          {portfolioOptions.map((option) => (
            <div key={option.href}>
              <Link
                href={option.href}
                className="group block rounded-lg border border-border bg-card p-6 shadow-[var(--card-shadow)]"
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-md border ${option.tile}`}
                >
                  <option.icon className={`h-5 w-5 ${option.iconColor}`} />
                </div>
                <h3 className="mb-1 font-display text-xl font-semibold tracking-tight text-foreground group-hover:text-primary">
                  {option.title}
                </h3>
                <p className="mb-4 text-[13px] text-muted-foreground">
                  {option.description}
                </p>
                <div className="flex items-center text-[13px] font-semibold text-primary">
                  <span>View Portfolio</span>
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  CandlestickChart,
  LayoutGrid,
  LineChart,
  Newspaper,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Activity,
  Flame,
  Gauge,
  CalendarDays,
  CalendarClock,
  Bell,
  Eye,
  Briefcase,
  FileText,
  PieChart,
  StickyNote,
  BookOpen,
  FlaskConical,
  Globe,
  Building2,
  Landmark,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Item {
  href: string;
  label: string;
  icon?: LucideIcon;
}

interface Section {
  title: string;
  items: Item[];
}

const SECTIONS: Section[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/chart/NIFTY", label: "Charts", icon: CandlestickChart },
      { href: "/charting", label: "Charting", icon: Activity },
      { href: "/screens", label: "FA Screener", icon: LayoutGrid },
      { href: "/market", label: "Total Market", icon: LineChart },
      { href: "/market-mood", label: "Market Mood", icon: Gauge },
      { href: "/news", label: "News", icon: Newspaper },
    ],
  },
  {
    title: "Movers",
    items: [
      { href: "/gainers", label: "Top Gainers", icon: TrendingUp },
      { href: "/losers", label: "Top Losers", icon: TrendingDown },
      { href: "/only-buyers", label: "Only Buyers", icon: ArrowUpRight },
      { href: "/only-sellers", label: "Only Sellers", icon: ArrowDownRight },
      { href: "/price-shockers", label: "Price Shockers", icon: Zap },
      { href: "/volume-shockers", label: "Volume Shockers", icon: Flame },
      { href: "/most-active-by-value", label: "Most Active by Value", icon: Activity },
      { href: "/52-week-high", label: "52W High", icon: TrendingUp },
      { href: "/52-week-low", label: "52W Low", icon: TrendingDown },
      { href: "/all-time-high", label: "All-Time High", icon: TrendingUp },
      { href: "/all-time-low", label: "All-Time Low", icon: TrendingDown },
    ],
  },
  {
    title: "Market Data",
    items: [
      { href: "/market-data/indices/nse", label: "NSE Indices" },
      { href: "/market-data/indices/bse", label: "BSE Indices" },
      { href: "/market-data/sectors/nse", label: "NSE Sectors" },
      { href: "/market-data/sectors/bse", label: "BSE Sectors" },
      { href: "/market-data/sectors-data", label: "Sectors Data" },
      { href: "/market-data/industry", label: "Industry" },
      { href: "/market-data/stocks", label: "Stocks" },
      { href: "/market-data/pre-open", label: "Pre-Open" },
      { href: "/market-data/broad-market-indices", label: "Broad Market" },
      { href: "/market-data/sectoral-indices", label: "Sectoral Indices" },
      { href: "/market-data/indices-fno", label: "Indices in F&O" },
      { href: "/market-data/fno", label: "F&O Data" },
      { href: "/market-data/fno-stocks", label: "F&O Stocks" },
      { href: "/market-data/price-band-hitters", label: "Price Band Hitters" },
      { href: "/market-data/global-markets", label: "Global Markets", icon: Globe },
      { href: "/market-data/historical-data", label: "Historical Data" },
      { href: "/market-data/nifty", label: "Nifty" },
      { href: "/market-data/pe", label: "PE" },
      { href: "/market-data/etfs", label: "ETFs" },
      { href: "/market-data/unlisted-shares", label: "Unlisted Shares", icon: Building2 },
      { href: "/market-data", label: "All Statistics" },
    ],
  },
  {
    title: "Deals & Flows",
    items: [
      { href: "/market-data/bulk-deals", label: "Bulk Deals" },
      { href: "/market-data/block-deals", label: "Block Deals" },
      { href: "/market-data/intraday-deals", label: "Intraday Deals" },
      { href: "/market-data/circuit-changes", label: "Circuit Changes" },
      { href: "/market-data/fii-dii", label: "FII & DII", icon: Landmark },
      { href: "/market-data/super-investors", label: "Super Investors" },
      { href: "/market-data/corporate-action", label: "Corporate Action" },
      { href: "/market-data/results-calendar", label: "Results Calendar" },
      { href: "/market-data/advances-decline-unchanged", label: "Adv / Dec / Unch" },
    ],
  },
  {
    title: "Calendars",
    items: [
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/events", label: "Event Manager", icon: CalendarClock },
      { href: "/market-data/ipo", label: "IPO" },
    ],
  },
  {
    title: "Trading",
    items: [
      { href: "/portfolio/holdings", label: "Holdings", icon: Briefcase },
      { href: "/portfolio/live-trading", label: "Live Trading", icon: TrendingUp },
      { href: "/portfolio/paper-trading", label: "Paper Trading", icon: FileText },
      { href: "/portfolio/management", label: "Management", icon: PieChart },
      { href: "/watchlist", label: "Watchlist", icon: Eye },
      { href: "/watchlist/preposition", label: "Preposition WL", icon: Eye },
      { href: "/alerts", label: "Alerts", icon: Bell },
      { href: "/chart-indicators", label: "Indicators" },
    ],
  },
  {
    title: "Analysis",
    items: [
      { href: "/analysis/strategy-builder", label: "Strategy Builder", icon: FlaskConical },
      { href: "/analysis/strategy-back-test", label: "Back Test" },
      { href: "/analysis/strategy-back-test-group", label: "Back Test Group" },
      { href: "/analysis/reports", label: "Reports" },
      { href: "/screeners/screening-table", label: "Screening Table" },
      { href: "/screeners/vgsreddy-strategies", label: "VGS Reddy" },
    ],
  },
  {
    title: "Journal",
    items: [
      { href: "/notes", label: "Notes", icon: StickyNote },
      { href: "/diary", label: "Diary", icon: BookOpen },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href.includes("?")) href = href.split("?")[0];
  if (href === "/chart/NIFTY") return pathname.startsWith("/chart");
  return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
}

export function Sidebar({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <nav aria-label="Primary" className="flex h-full flex-col gap-4 overflow-y-auto px-3 py-4">
      {SECTIONS.map((section) => {
        const sectionActive = section.items.some((i) => isActive(pathname, i.href));
        const expanded = open[section.title] ?? sectionActive ?? section.title === "Overview";
        return (
          <div key={section.title}>
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [section.title]: !expanded }))}
              aria-expanded={expanded}
              className={cn(
                "flex w-full items-center justify-between px-2 py-1 text-[11px] font-semibold tracking-wider uppercase",
                sectionActive ? "text-foreground" : "text-muted-foreground",
                collapsed && "hidden",
              )}
            >
              <span>{section.title}</span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", !expanded && "-rotate-90")}
                aria-hidden="true"
              />
            </button>
            {(expanded || collapsed) && (
              <ul className="mt-1 space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href + item.label}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
                          active
                            ? "bg-primary/[0.08] text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          collapsed && "justify-center px-1.5",
                        )}
                      >
                        {Icon ? (
                          <Icon
                            className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
                            aria-hidden="true"
                          />
                        ) : (
                          !collapsed && <span className="w-4 shrink-0" aria-hidden="true" />
                        )}
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && active && (
                          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  BarChart3,
  Bell,
  Box,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarClock,
  CandlestickChart,
  ChevronDown,
  Clock,
  Eye,
  Factory,
  FileCheck,
  FileText,
  FlaskConical,
  Flame,
  Gauge,
  Globe,
  History,
  Landmark,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  List,
  ListChecks,
  Newspaper,
  Package,
  Percent,
  PieChart,
  Power,
  Rocket,
  SlidersHorizontal,
  StickyNote,
  BookOpen,
  Table,
  TestTube,
  Timer,
  TrendingUp,
  TrendingDown,
  TriangleAlert,
  Users,
  Database,
  Zap,
  Files,
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
      { href: "/market-data/indices/nse", label: "NSE Indices", icon: LineChart },
      { href: "/market-data/indices/bse", label: "BSE Indices", icon: LineChart },
      { href: "/market-data/sectors/nse", label: "NSE Sectors", icon: PieChart },
      { href: "/market-data/sectors/bse", label: "BSE Sectors", icon: PieChart },
      { href: "/market-data/sectors-data", label: "Sectors Data", icon: LayoutGrid },
      { href: "/market-data/industry", label: "Industry", icon: Factory },
      { href: "/market-data/stocks", label: "Stocks", icon: List },
      { href: "/market-data/pre-open", label: "Pre-Open", icon: Clock },
      { href: "/market-data/broad-market-indices", label: "Broad Market", icon: Layers },
      { href: "/market-data/sectoral-indices", label: "Sectoral Indices", icon: BarChart3 },
      { href: "/market-data/indices-fno", label: "Indices in F&O", icon: CandlestickChart },
      { href: "/market-data/fno", label: "F&O Data", icon: Zap },
      { href: "/market-data/fno-stocks", label: "F&O Stocks", icon: ListChecks },
      { href: "/market-data/price-band-hitters", label: "Price Band Hitters", icon: TriangleAlert },
      { href: "/market-data/global-markets", label: "Global Markets", icon: Globe },
      { href: "/market-data/historical-data", label: "Historical Data", icon: History },
      { href: "/market-data/nifty", label: "Nifty", icon: Award },
      { href: "/market-data/pe", label: "PE", icon: Percent },
      { href: "/market-data/etfs", label: "ETFs", icon: Briefcase },
      { href: "/market-data/unlisted-shares", label: "Unlisted Shares", icon: Building2 },
      { href: "/market-data", label: "All Statistics", icon: Database },
    ],
  },
  {
    title: "Deals & Flows",
    items: [
      { href: "/market-data/bulk-deals", label: "Bulk Deals", icon: Package },
      { href: "/market-data/block-deals", label: "Block Deals", icon: Box },
      { href: "/market-data/intraday-deals", label: "Intraday Deals", icon: Timer },
      { href: "/market-data/circuit-changes", label: "Circuit Changes", icon: Power },
      { href: "/market-data/fii-dii", label: "FII & DII", icon: Landmark },
      { href: "/market-data/super-investors", label: "Super Investors", icon: Users },
      { href: "/market-data/corporate-action", label: "Corporate Action", icon: FileCheck },
      { href: "/market-data/results-calendar", label: "Results Calendar", icon: CalendarClock },
      { href: "/market-data/advances-decline-unchanged", label: "Adv / Dec / Unch", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Calendars",
    items: [
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/events", label: "Event Manager", icon: CalendarClock },
      { href: "/market-data/ipo", label: "IPO", icon: Rocket },
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
      { href: "/chart-indicators", label: "Indicators", icon: SlidersHorizontal },
    ],
  },
  {
    title: "Analysis",
    items: [
      { href: "/analysis/strategy-builder", label: "Strategy Builder", icon: FlaskConical },
      { href: "/analysis/strategy-back-test", label: "Back Test", icon: TestTube },
      { href: "/analysis/strategy-back-test-group", label: "Back Test Group", icon: Files },
      { href: "/analysis/reports", label: "Reports", icon: FileText },
      { href: "/screeners/screening-table", label: "Screening Table", icon: Table },
      { href: "/screeners/vgsreddy-strategies", label: "VGS Reddy", icon: CandlestickChart },
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

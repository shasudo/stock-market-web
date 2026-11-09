"use client";

import Link from "next/link";
import {
  AlarmClock,
  BarChart3,
  Bell,
  BellRing,
  Bookmark,
  Briefcase,
  CalendarDays,
  Eye,
  FileCode2,
  History,
  Info,
  LayoutGrid,
  Layers,
  Map,
  Newspaper,
  Radar,
  Star,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidePanelTab } from "./terminal-settings";
import { Menu, ToolbarButton } from "./ui";

export interface Product {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly section: "Products" | "Social" | "Your data";
}

/** Shortcuts into the rest of the app, standing in for the terminal's product menu. */
export const PRODUCTS: readonly Product[] = [
  {
    id: "screeners",
    label: "Screeners",
    href: "/screeners/screening-table",
    icon: Radar,
    section: "Products",
  },
  {
    id: "calendars",
    label: "Calendars",
    href: "/calendar",
    icon: CalendarDays,
    section: "Products",
  },
  {
    id: "pine-editor",
    label: "Pine Editor",
    href: "/analysis/strategy-builder",
    icon: FileCode2,
    section: "Products",
  },
  {
    id: "news-flow",
    label: "News Flow",
    href: "/news",
    icon: Newspaper,
    section: "Products",
  },
  {
    id: "macro-maps",
    label: "Macro Maps",
    href: "/market-mood",
    icon: Map,
    section: "Products",
  },
  {
    id: "market-data",
    label: "Market data",
    href: "/market-data",
    icon: BarChart3,
    section: "Products",
  },
  {
    id: "options",
    label: "Options and F&O",
    href: "/market-data/fno",
    icon: Layers,
    section: "Products",
  },
  {
    id: "historical",
    label: "Historical data",
    href: "/market-data/historical-data",
    icon: History,
    section: "Products",
  },
  {
    id: "watchlist",
    label: "Watchlist",
    href: "/watchlist",
    icon: Eye,
    section: "Your data",
  },
  {
    id: "alerts",
    label: "Alerts",
    href: "/alerts",
    icon: Bell,
    section: "Your data",
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/alerts",
    icon: BellRing,
    section: "Social",
  },
  {
    id: "notes",
    label: "Notes",
    href: "/notes",
    icon: StickyNote,
    section: "Your data",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    href: "/portfolio/holdings",
    icon: Briefcase,
    section: "Your data",
  },
];

/** TradingView-style side-panel tabs, switched in the docked panel. */
export const PANEL_TABS: readonly {
  readonly id: SidePanelTab;
  readonly label: string;
  readonly icon: LucideIcon;
}[] = [
  { id: "watchlist", label: "Watchlist", icon: Bookmark },
  { id: "details", label: "Symbol details", icon: Info },
  { id: "alerts", label: "Alerts", icon: AlarmClock },
  { id: "objects", label: "Objects", icon: Layers },
  { id: "screener", label: "Screener", icon: Radar },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "news", label: "News", icon: Newspaper },
];

interface RightRailProps {
  readonly starred: readonly string[];
  readonly onToggleStar: (id: string) => void;
  readonly activeTab: SidePanelTab;
  readonly panelOpen: boolean;
  readonly onTab: (tab: SidePanelTab) => void;
  readonly pineOpen: boolean;
  readonly onPine: () => void;
}

export default function RightRail({
  starred,
  onToggleStar,
  activeTab,
  panelOpen,
  onTab,
  pineOpen,
  onPine,
}: RightRailProps) {
  const pinned = PRODUCTS.filter((product) => starred.includes(product.id));

  return (
    <nav
      aria-label="Shortcuts"
      className="hidden w-12 shrink-0 flex-col items-center gap-1 border-l border-border bg-card py-2 md:flex"
    >
      {PANEL_TABS.map((tab) => {
        const active = panelOpen && activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            title={tab.label}
            aria-label={tab.label}
            aria-pressed={active}
            onClick={() => onTab(tab.id)}
            className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <tab.icon className="h-[22px] w-[22px]" strokeWidth={1.5} />
          </button>
        );
      })}
      <button
        type="button"
        title="Pine Editor"
        aria-label="Pine Editor"
        aria-pressed={pineOpen}
        onClick={onPine}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
          pineOpen
            ? "bg-primary/10 text-primary"
            : "text-foreground hover:bg-muted",
        )}
      >
        <FileCode2 className="h-[22px] w-[22px]" strokeWidth={1.5} />
      </button>
      <span aria-hidden className="my-1 h-px w-8 bg-border" />
      {pinned.map((product) => (
        <Link
          key={product.id}
          href={product.href}
          title={product.label}
          aria-label={product.label}
          className="flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
        >
          <product.icon className="h-[22px] w-[22px]" strokeWidth={1.5} />
        </Link>
      ))}
      <span className="flex-1" />
      <Menu
        side="bottom"
        align="right"
        trigger={({ toggle }) => (
          <ToolbarButton
            label="Products"
            onClick={toggle}
            className="h-10 w-10"
          >
            <LayoutGrid className="h-[22px] w-[22px]" strokeWidth={1.5} />
          </ToolbarButton>
        )}
        className="!bottom-12 !top-auto w-[260px]"
      >
        {(close) => (
          <div className="w-[260px] py-1">
            {(["Products", "Social", "Your data"] as const).map(
              (section, index) => (
                <div key={section}>
                  {index > 0 && <div className="mx-3 my-1 h-px bg-border" />}
                  <p className="px-4 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {section}
                  </p>
                  {PRODUCTS.filter(
                    (product) => product.section === section,
                  ).map((product) => {
                    const on = starred.includes(product.id);
                    return (
                      <div
                        key={product.id}
                        className="group/row flex items-center hover:bg-muted"
                      >
                        <Link
                          href={product.href}
                          onClick={close}
                          className="flex h-11 flex-1 items-center gap-3 px-4 text-[15px] text-foreground"
                        >
                          <product.icon
                            className="h-6 w-6 shrink-0"
                            strokeWidth={1.5}
                          />
                          {product.label}
                        </Link>
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={
                            on
                              ? `Unpin ${product.label}`
                              : `Pin ${product.label}`
                          }
                          title={
                            on
                              ? "Remove from the sidebar"
                              : "Add to the sidebar"
                          }
                          onClick={() => onToggleStar(product.id)}
                          className={`mr-3 rounded p-1 hover:bg-muted ${
                            on
                              ? "opacity-100"
                              : "opacity-0 focus:opacity-100 group-hover/row:opacity-100"
                          }`}
                        >
                          <Star
                            className={
                              on
                                ? "h-4 w-4 text-warning"
                                : "h-4 w-4 text-muted-foreground"
                            }
                            fill={on ? "currentColor" : "none"}
                            stroke="currentColor"
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ),
            )}
          </div>
        )}
      </Menu>
    </nav>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { NavLink } from "./NavLink";
import { FAScreenerDropdown } from "./FAScreenerDropdown";
import { MarketDataDropdown } from "./MarketDataDropdown";
import { ScreenersDropdown } from "./ScreenersDropdown";
import { AnalysisDropdown } from "./AnalysisDropdown";
import { PortfolioDropdown } from "./PortfolioDropdown";
import { WatchlistDropdown } from "./WatchlistDropdown";
import { AlertsDropdown } from "./AlertsDropdown";
import { NotesDropdown } from "./NotesDropdown";
import { navLinks } from "@/lib/nav-config";

interface NavDesktopProps {
  user: { firstName?: string; username?: string; email?: string } | null;
  onLogout: () => void;
}

export function NavDesktop({ user, onLogout }: NavDesktopProps) {
  const pathname = usePathname();
  const isMarketDataActive = pathname.startsWith("/market-data");
  const isFaScreenerActive =
    pathname.startsWith("/screens") || pathname.startsWith("/chart");
  const isScreenersActive = pathname.startsWith("/screeners");
  const isAnalysisActive = pathname.startsWith("/analysis");
  const isPortfolioActive = pathname.startsWith("/portfolio");
  const isWatchlistActive = pathname.startsWith("/watchlist");
  const isAlertsActive = pathname.startsWith("/alerts");
  const isNotesActive =
    pathname.startsWith("/notes") ||
    pathname.startsWith("/diary") ||
    pathname.startsWith("/events") ||
    pathname.startsWith("/calendar");

  return (
    <div className="hidden md:flex items-center space-x-1">
      {navLinks.map((link) =>
        link.href === "/screens" ? (
          <FAScreenerDropdown key={link.href} isActive={isFaScreenerActive} />
        ) : (
          <NavLink
            key={link.href}
            href={link.href}
            label={link.label}
            icon={link.icon!}
            isActive={pathname === link.href}
          />
        ),
      )}

      <MarketDataDropdown isActive={isMarketDataActive} />
      <ScreenersDropdown isActive={isScreenersActive} />
      <AnalysisDropdown isActive={isAnalysisActive} />

      <AlertsDropdown isActive={isAlertsActive} />

      <WatchlistDropdown isActive={isWatchlistActive} />

      <PortfolioDropdown isActive={isPortfolioActive} pathname={pathname} />

      <NotesDropdown isActive={isNotesActive} />

      {}
      <div className="flex items-center space-x-3 ml-6 pl-6 border-l border-border">
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            {user?.firstName || user?.username}
          </p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

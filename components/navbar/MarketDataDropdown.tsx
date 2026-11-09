"use client";

import Link from "next/link";
import { LineChart } from "lucide-react";
import { NavDropdown } from "./NavDropdown";
import { marketDataLinks } from "@/lib/nav-config";

const linkClass =
  "block px-4 py-1 text-sm text-foreground hover:bg-muted hover:outline hover:outline-1 hover:outline-border border-b border-border";
const sectionHeader =
  "px-4 py-1.5 text-sm font-bold text-foreground border-b border-border";
const columnHeader =
  "px-4 py-2 text-sm font-bold text-foreground border-b border-border bg-muted";

interface MarketDataDropdownProps {
  isActive: boolean;
}

export function MarketDataDropdown({ isActive }: MarketDataDropdownProps) {
  return (
    <NavDropdown label="Market Data" icon={LineChart} isActive={isActive}>
      <div className="flex">
        {}
        <div className="min-w-[200px] border-r border-border">
          <div className={columnHeader}>Market Overview</div>

          {}
          <div className="border-b border-border">
            <div className={sectionHeader}>Indices</div>
            {marketDataLinks.marketOverview.indices.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
          </div>

          {}
          <div className="border-b border-border">
            <div className={sectionHeader}>Sectors</div>
            {marketDataLinks.marketOverview.sectors.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
          </div>

          {}
          <div className="border-b border-border">
            <div className="px-4 py-1.5 text-sm font-bold text-foreground border-b border-border">
              Total Market
            </div>
            <Link
              href="/market-data/advances-decline-unchanged"
              className={linkClass}
            >
              Advances, Decline & Unchanged
            </Link>
            <Link href="/market" className={linkClass}>
              Total Market Performance
            </Link>
          </div>

          {}
          <div className="border-b border-border">
            <Link
              href="/market-mood"
              className="block px-4 py-1.5 text-sm text-foreground hover:bg-muted hover:outline hover:outline-1 hover:outline-border"
            >
              Market Mood
            </Link>
          </div>

          {}
          <div className="border-b border-border">
            <Link
              href="#"
              className="block px-4 py-1.5 text-sm text-foreground hover:bg-muted hover:outline hover:outline-1 hover:outline-border"
            >
              Futures Support & Resistance
            </Link>
          </div>

          {}
          <div className="border-b border-border">
            <Link
              href="/market-data/global-markets"
              className="block px-4 py-1.5 text-sm font-bold text-foreground hover:bg-muted hover:outline hover:outline-1 hover:outline-border"
            >
              Global Markets
            </Link>
          </div>

          {}
          <div>
            <div className="px-4 py-1.5 text-sm font-bold text-foreground">
              Filterings
            </div>
          </div>
        </div>

        {}
        <div className="min-w-[150px] border-r border-border">
          <div className={columnHeader}>Equity</div>
          {marketDataLinks.equity.map((link) => (
            <Link key={link.label} href={link.href} className={linkClass}>
              {link.label}
            </Link>
          ))}
          <div className="border-b border-border">
            <div className="px-4 py-1.5 text-sm font-bold text-foreground">
              Filterings
            </div>
          </div>
          <Link href="/market-data/dummy-table" className={linkClass}>
            Dummy Table
          </Link>
        </div>

        {}
        <div className="min-w-[180px]">
          <div className={columnHeader}>Others</div>

          <Link href="/market-data/results-calendar" className={linkClass}>
            Calendar
          </Link>
          <Link href="/market-data/fii-dii" className={linkClass}>
            FII & DII Activity
          </Link>
          <Link href="#" className={linkClass}>
            Promoters Activity
          </Link>
          <Link href="#" className={linkClass}>
            Mutual Funds Activity
          </Link>
          <Link href="/market-data/super-investors" className={linkClass}>
            Super Investors
          </Link>
          <Link href="/market-data/corporate-action" className={linkClass}>
            Corporate Action
          </Link>

          {}
          <div className="border-b border-border">
            <div className="px-4 py-1.5 text-sm font-bold text-foreground border-b border-border">
              Deals
            </div>
            <Link href="/market-data/bulk-deals" className={linkClass}>
              Bulk Deals
            </Link>
            <Link href="/market-data/block-deals" className={linkClass}>
              Block Deals
            </Link>
            <Link href="/market-data/intraday-deals" className={linkClass}>
              Intraday Large Deals
            </Link>
            <Link href="/market-data/circuit-changes" className={linkClass}>
              Circuit Changes
            </Link>
            <div className="px-4 py-1.5 text-sm font-bold text-foreground">
              Monthly Wise
            </div>
          </div>

          {}
          <div className="border-b border-border">
            <Link href="/market-data/nifty" className={linkClass}>
              Nifty
            </Link>
            <Link href="/market-data/pe" className={linkClass}>
              PE
            </Link>
            <Link href="#" className={linkClass}>
              Downloads
            </Link>
            <Link href="/market-data/historical-data" className={linkClass}>
              Historical Data
            </Link>
          </div>
        </div>
      </div>
    </NavDropdown>
  );
}

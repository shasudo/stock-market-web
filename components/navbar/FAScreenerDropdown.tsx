"use client";

import Link from "next/link";
import { CandlestickChart, LayoutGrid } from "lucide-react";
import { NavDropdown } from "./NavDropdown";

interface FAScreenerDropdownProps {
  isActive: boolean;
}

const linkClass =
  "flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted border-b border-border last:border-b-0";

/**
 * FA Screener nav with a hover popup: the screener page itself plus a
 * Charting shortcut.
 */
export function FAScreenerDropdown({ isActive }: FAScreenerDropdownProps) {
  return (
    <NavDropdown
      label="FA Screener"
      icon={LayoutGrid}
      isActive={isActive}
      className="rounded-xl"
    >
      <div className="min-w-[220px]">
        <Link href="/screens" className={linkClass}>
          <LayoutGrid className="h-4 w-4 shrink-0" />
          FA Screener
        </Link>
        <Link href="/charting" className={linkClass}>
          <CandlestickChart className="h-4 w-4 shrink-0" />
          Charting
        </Link>
      </div>
    </NavDropdown>
  );
}

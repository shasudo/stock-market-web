"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { NavDropdown } from "./NavDropdown";
import { screenersLinks } from "@/lib/nav-config";

const linkClass =
  "block px-4 py-1 text-sm text-foreground hover:bg-muted hover:outline hover:outline-1 hover:outline-border border-b border-border";
const sectionHeader =
  "px-4 py-1.5 text-sm font-bold text-foreground border-b border-border";

interface ScreenersDropdownProps {
  isActive: boolean;
}

export function ScreenersDropdown({ isActive }: ScreenersDropdownProps) {
  return (
    <NavDropdown
      label="Screeners"
      icon={Search}
      isActive={isActive}
      className="rounded-xl"
    >
      <div className="flex">
        {}
        <div className="min-w-[200px] border-r border-border">
          <div className="px-4 py-2 text-sm font-bold text-foreground border-b border-border bg-muted">
            Technical
          </div>

          <div className="border-b border-border">
            {screenersLinks.technical.screeningTable.map((link) => (
              <Link key={link.label} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
          </div>

          {}
          <div className="border-b border-border">
            <div className={sectionHeader}>Candlestick Patterns</div>
            {screenersLinks.technical.candlestickPatterns.map((link) => (
              <Link key={link.label} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
          </div>

          {}
          <div className="border-b border-border">
            <div className={sectionHeader}>Chart Patterns</div>
            {screenersLinks.technical.chartPatterns.map((link) => (
              <Link key={link.label} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
          </div>

          {}
          <div className="border-b border-border">
            <div className={sectionHeader}>Drawing Tools</div>
            {screenersLinks.technical.drawingTools.map((link) => (
              <Link key={link.label} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
          </div>

          {}
          <div className="border-b border-border">
            <div className="px-4 py-1.5 text-sm font-bold text-foreground">
              Indicators
            </div>
          </div>

          {}
          <div>
            <div className="px-4 py-1.5 text-sm font-bold text-foreground">
              Strategies
            </div>
          </div>
        </div>

        {}
        <div className="min-w-[160px]">
          <div className="px-4 py-2 text-sm font-bold text-foreground border-b border-border bg-muted">
            Fundamental
          </div>
        </div>
      </div>
    </NavDropdown>
  );
}

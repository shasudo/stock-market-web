"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { NavDropdown } from "./NavDropdown";
import { watchlistLinks } from "@/lib/nav-config";

interface WatchlistDropdownProps {
  isActive: boolean;
}

export function WatchlistDropdown({ isActive }: WatchlistDropdownProps) {
  return (
    <NavDropdown label="Watchlist" icon={Eye} isActive={isActive}>
      <div className="min-w-[200px]">
        <div className="px-4 py-2 text-sm font-bold text-foreground border-b border-border bg-muted">
          Watchlist
        </div>
        {watchlistLinks.map((link) => {
          const Icon = link.icon!;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center space-x-3 px-4 py-1.5 text-sm text-foreground hover:bg-muted hover:outline hover:outline-1 hover:outline-border border-b border-border"
            >
              <Icon className="h-4 w-4" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </NavDropdown>
  );
}

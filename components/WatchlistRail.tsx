"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Briefcase, Home, LayoutGrid, LineChart, Moon, Sun, Table2 } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { CommandPalette } from "./CommandPalette";
import { cn } from "@/lib/cn";

const RAIL = [
  { href: "/", label: "Today", icon: Home },
  { href: "/markets", label: "Markets", icon: Table2 },
  { href: "/fno", label: "F&O", icon: LineChart },
  { href: "/mine", label: "Mine", icon: Briefcase },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/browse", label: "Browse", icon: LayoutGrid },
];

/** Desktop left rail (md:+). Icon rail on md, full labels on lg. */
export function WatchlistRail() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  return (
    <nav
      aria-label="Primary"
      className="hidden w-16 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3 md:flex lg:w-52 lg:items-stretch lg:px-3"
    >
      <span className="tnum mb-2 hidden px-2 text-[10px] font-bold uppercase tracking-widest text-faint lg:block">
        Terminal
      </span>
      {RAIL.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={`${label} — Cmd+K for palette`}
            className={cn(
              "flex min-h-[44px] items-center justify-center gap-3 rounded-md px-2 text-[13px] font-medium lg:justify-start lg:px-3",
              active ? "bg-accent/10 text-accent" : "text-muted hover:bg-accent/[0.05] hover:text-fg",
            )}
          >
            <Icon size={19} strokeWidth={active ? 2.5 : 2} aria-hidden className="shrink-0" />
            <span className="hidden lg:inline">{label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        className="mt-auto flex min-h-[44px] min-w-[44px] items-center justify-center gap-3 rounded-md px-2 text-muted hover:bg-accent/[0.05] hover:text-fg lg:justify-start lg:px-3 lg:text-[13px] lg:font-medium"
      >
        {theme === "dark" ? <Sun size={19} aria-hidden /> : <Moon size={19} aria-hidden />}
        <span className="hidden lg:inline">{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
      <CommandPalette />
    </nav>
  );
}

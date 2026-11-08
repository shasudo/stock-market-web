"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Briefcase, Home, LineChart, Table2 } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/", label: "Today", icon: Home },
  { href: "/markets", label: "Markets", icon: Table2 },
  { href: "/fno", label: "F&O", icon: LineChart },
  { href: "/mine", label: "Mine", icon: Briefcase },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

/** Companion bottom nav (<768px). The rail takes over on md:+ screens. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10px] font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

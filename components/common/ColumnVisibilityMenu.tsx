"use client";

import { Columns3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * "Columns" toggle button plus its show/hide checklist, for any table wide
 * enough that not every column earns permanent screen space (the watchlist
 * and the paper/live trading boards both run past 20 columns).
 */
export function ColumnVisibilityMenu({
  columnOrder,
  columnLabels,
  hiddenColumns,
  onToggle,
}: {
  columnOrder: readonly string[];
  columnLabels: Readonly<Record<string, string>>;
  hiddenColumns: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Show or hide columns"
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground"
        >
          <Columns3 className="w-4 h-4" />
          Columns
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {columnOrder.map((key) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={!hiddenColumns.has(key)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => onToggle(key)}
          >
            {columnLabels[key]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** localStorage-backed hidden-column set, one key per table. */
export function loadHiddenColumns(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? new Set(parsed.filter((key): key is string => typeof key === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

export function saveHiddenColumns(
  storageKey: string,
  hidden: ReadonlySet<string>,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...hidden]));
  } catch {
    // Best-effort only - a private-browsing quota error shouldn't break the page.
  }
}

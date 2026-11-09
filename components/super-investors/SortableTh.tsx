"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortState } from "@/lib/super-investors/sorting";

/**
 * A table header that sorts its column: click once for the column's default
 * order (A→Z for text, largest / newest first for numbers and dates), again
 * to reverse. The arrow shows the active column and direction.
 */
export function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className = "",
}: {
  readonly label: React.ReactNode;
  readonly sortKey: K;
  readonly sort: SortState<K> | null;
  readonly onSort: (key: K) => void;
  readonly align?: "left" | "right" | "center";
  readonly className?: string;
}) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`${className} ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Sort by ${typeof label === "string" ? label : "this column"}`}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground ${
          active ? "text-foreground" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <Icon className={`h-3 w-3 shrink-0 ${active ? "text-primary" : "opacity-40"}`} aria-hidden />
      </button>
    </th>
  );
}

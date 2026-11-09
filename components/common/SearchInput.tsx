"use client";

import { Search, X } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Wrapper classes — mainly to set the width for a given toolbar. */
  className?: string;
  /**
   * Replaces the input's own look. This app runs two visual languages (the
   * square market terminal and the rounded app shell), so the caller decides.
   */
  inputClassName?: string;
  /** When given, shows "showing X of Y" under the field while searching. */
  matchCount?: number;
  totalCount?: number;
  ariaLabel?: string;
}

const DEFAULT_INPUT_CLASSES =
  "w-full rounded-xl border border-border bg-card py-2 pl-8 pr-8 text-xs md:text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none transition-all shadow-xs";


export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "relative w-56",
  inputClassName = DEFAULT_INPUT_CLASSES,
  matchCount,
  totalCount,
  ariaLabel,
}: SearchInputProps) {
  const showCount =
    value.trim().length > 0 &&
    matchCount !== undefined &&
    totalCount !== undefined;

  return (
    <div className={className}>
      {/* Inner wrapper so the icons centre on the input itself, whatever
          height the caller's padding gives it, instead of on the field plus
          the count line below. */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onChange("");
          }}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          className={inputClassName}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            title="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {showCount && (
        <span className="absolute left-0 top-full mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">
          {matchCount} of {totalCount}
        </span>
      )}
    </div>
  );
}

/**
 * Case-insensitive "does any of these fields contain the query" test. An empty
 * query matches everything, so callers can filter unconditionally.
 */
export function matchesSearch(
  query: string,
  ...fields: readonly (string | number | null | undefined)[]
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return fields.some(
    (field) =>
      field !== null &&
      field !== undefined &&
      String(field).toLowerCase().includes(needle),
  );
}

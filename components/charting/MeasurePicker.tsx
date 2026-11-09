"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Layers, Search } from "lucide-react";
import { MEASURE_CATEGORIES, MEASURES, measureTerm, type MeasureDef } from "@/lib/screener/catalog";
import type { Term, TimeframeUnit } from "@/lib/screener/scan-types";
import { cn } from "@/lib/utils";

export type PickerChoice =
  | { readonly kind: "term"; readonly term: Term }
  | { readonly kind: "group" }
  | { readonly kind: "browse" };

interface MeasurePickerProps {
  readonly onPick: (choice: PickerChoice) => void;
  readonly timeframe?: TimeframeUnit;
  /** Offer "Sub-Filter/Group" and "Browse scans" (top of a filter list only). */
  readonly allowGroup?: boolean;
  readonly allowText?: boolean;
  readonly placeholder?: string;
}

function score(def: MeasureDef, query: string): number {
  if (!query) return 1;
  const haystack = `${def.label} ${def.short ?? ""} ${def.id} ${(def.keywords ?? []).join(" ")}`.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((word) => haystack.includes(word))) return 0;
  const label = def.label.toLowerCase();
  if (label.startsWith(query.toLowerCase())) return 3;
  if ((def.short ?? "").toLowerCase().startsWith(query.toLowerCase())) return 2.5;
  return 1;
}

/** Searchable list of every measure, grouped like Chartink's filter picker. */
export function MeasurePicker({
  onPick,
  timeframe = "day",
  allowGroup = false,
  allowText = false,
  placeholder = "Select an indicator/formula",
}: MeasurePickerProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const numeric = query.trim() !== "" && Number.isFinite(Number(query.trim()));

  const flat = useMemo(() => {
    const matches = MEASURES.map((def) => ({ def, rank: score(def, query.trim()) }))
      .filter((entry) => entry.rank > 0)
      .filter((entry) => allowText || entry.def.output !== "text");
    if (!query.trim()) return matches.map((entry) => entry.def);
    return matches.sort((a, b) => b.rank - a.rank).map((entry) => entry.def);
  }, [query, allowText]);

  const grouped = useMemo(() => {
    if (query.trim()) return null;
    return MEASURE_CATEGORIES.map((category) => ({
      category,
      items: flat.filter((def) => def.category === category),
    }));
  }, [flat, query]);

  const pickMeasure = (def: MeasureDef): void => {
    onPick({ kind: "term", term: measureTerm(def.id, def.timeframed ? timeframe : "day") });
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (numeric) {
        onPick({ kind: "term", term: { kind: "number", value: Number(query.trim()) } });
      } else if (flat[cursor]) {
        pickMeasure(flat[cursor]!);
      } else if (allowText && query.trim()) {
        onPick({ kind: "term", term: { kind: "text", value: query.trim() } });
      }
    }
  };

  const row = (def: MeasureDef, index: number) => (
    <button
      key={def.id}
      type="button"
      onMouseEnter={() => setCursor(index)}
      onClick={() => pickMeasure(def)}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-foreground",
        index === cursor && query ? "bg-primary/10 text-primary" : "hover:bg-muted",
      )}
    >
      <span>{def.label}</span>
      {query && <span className="text-[10px] font-medium text-muted-foreground">{def.category}</span>}
    </button>
  );

  return (
    <div className="w-[320px] max-w-[85vw]" onKeyDown={onKeyDown}>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-2.5 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setCursor(0);
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs font-semibold text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="mt-1 max-h-[360px] overflow-y-auto pr-1">
        {allowGroup && !query && (
          <div className="flex gap-1.5 px-1 py-1.5">
            <button
              type="button"
              onClick={() => onPick({ kind: "browse" })}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary/20"
            >
              <BookOpen className="h-3 w-3" /> Browse scans
            </button>
          </div>
        )}
        {numeric && (
          <button
            type="button"
            onClick={() => onPick({ kind: "term", term: { kind: "number", value: Number(query.trim()) } })}
            className="flex w-full rounded-lg bg-primary/10 px-2.5 py-1.5 text-left text-xs font-bold text-primary"
          >
            Number {query.trim()}
          </button>
        )}
        {allowText && query.trim() && !numeric && (
          <button
            type="button"
            onClick={() => onPick({ kind: "term", term: { kind: "text", value: query.trim() } })}
            className="flex w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            Text &ldquo;{query.trim()}&rdquo;
          </button>
        )}
        {grouped ? (
          <>
            <div className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Measures
            </div>
            {allowGroup && (
              <button
                type="button"
                onClick={() => onPick({ kind: "group" })}
                className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-foreground hover:bg-muted"
              >
                <Layers className="h-3.5 w-3.5 text-primary" /> Sub-Filter/Group
              </button>
            )}
            <button
              type="button"
              onClick={() => onPick({ kind: "term", term: { kind: "number", value: 0 } })}
              className="flex w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-muted"
            >
              Number
            </button>
            {grouped.map((section) => (
              <div key={section.category}>
                <div className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {section.category}
                </div>
                {section.items.map((def) => row(def, flat.indexOf(def)))}
              </div>
            ))}
          </>
        ) : (
          flat.map((def, index) => row(def, index))
        )}
        {flat.length === 0 && !numeric && !allowText && (
          <div className="px-2.5 py-3 text-xs text-muted-foreground">No matching indicator.</div>
        )}
      </div>
    </div>
  );
}

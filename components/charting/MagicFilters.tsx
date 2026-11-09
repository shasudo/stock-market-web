"use client";

import { useEffect, useState } from "react";
import { Pencil, Sparkles, Wand2 } from "lucide-react";
import { MAGIC_SUGGESTIONS, parseMagicPrompt } from "@/lib/screener/magic";
import type { Clause } from "@/lib/screener/scan-types";
import { cn } from "@/lib/utils";
import { DrawPattern } from "./DrawPattern";

interface MagicFiltersProps {
  readonly onApply: (clauses: Clause[], mode: "append" | "replace") => void;
}

function pickSuggestions(seed: number): string[] {
  const out: string[] = [];
  for (let index = 0; out.length < 4; index += 1) {
    const next = MAGIC_SUGGESTIONS[(seed * 7 + index * 3) % MAGIC_SUGGESTIONS.length]!;
    if (!out.includes(next)) out.push(next);
  }
  return out;
}

export function MagicFilters({ onApply }: MagicFiltersProps) {
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [prompt, setPrompt] = useState("");
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [seed, setSeed] = useState(0);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setSeed((value) => value + 1), 9000);
    return () => clearInterval(timer);
  }, []);

  const generate = (text: string): void => {
    const { clauses, unmatched: missed } = parseMagicPrompt(text);
    setUnmatched(missed);
    if (clauses.length) onApply(clauses, mode);
    if (missed.length === 0) setPrompt("");
  };

  return (
    <div className="rounded-2xl border border-info/25 bg-gradient-to-br from-info/10 to-primary/10 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-info">
        <Wand2 className="h-3.5 w-3.5" /> Magic filters
      </div>
      <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-stretch">
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex rounded-lg bg-card p-0.5 shadow-xs ring-1 ring-border">
            {(["append", "replace"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-bold capitalize",
                  mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDrawing(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-card px-2.5 py-1.5 text-xs font-bold text-primary shadow-xs ring-1 ring-border hover:bg-primary/10"
          >
            <Pencil className="h-3.5 w-3.5" /> Draw
          </button>
        </div>
        <textarea
          value={prompt}
          rows={1}
          aria-label="Magic filter prompt"
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (prompt.trim()) generate(prompt);
            }
          }}
          placeholder="Scan stocks using simple language like 'stocks up by 4% and rising volume'"
          className="min-h-[38px] flex-1 resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          disabled={!prompt.trim()}
          onClick={() => generate(prompt)}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-info/100 px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:bg-info/90 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" /> Generate
        </button>
      </div>
      {unmatched.length > 0 && (
        <p className="mt-2 text-xs font-medium text-warning">
          Couldn&apos;t understand: {unmatched.map((part) => `“${part}”`).join(", ")}. Try phrases like the
          suggestions below, or add the filter with the + button.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {pickSuggestions(seed).map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => generate(suggestion)}
            className="inline-flex items-center gap-1 rounded-lg bg-card px-2 py-1 text-xs font-semibold text-foreground shadow-xs ring-1 ring-border hover:bg-primary/10 hover:text-primary"
          >
            {suggestion}
            <Sparkles className="h-3 w-3 text-info" />
          </button>
        ))}
      </div>
      {drawing && (
        <DrawPattern
          onClose={() => setDrawing(false)}
          onGenerate={(clauses) => {
            onApply(clauses, mode);
            setDrawing(false);
          }}
        />
      )}
    </div>
  );
}

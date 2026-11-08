"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { LIVE_ROUTES } from "@/lib/nav";

/** Bloomberg-thin keyboard layer: Cmd/Ctrl+K, type a code or name, Enter. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      inputRef.current?.focus();
    }
  }, [open ]);

  if (!open) return null;

  const q = query.trim().toUpperCase();
  const hits = LIVE_ROUTES.filter(
    (d) => q === "" || d.code.includes(q) || d.label.toUpperCase().includes(q),
  ).slice(0, 30);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[15vh]"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-md border border-line bg-surface shadow-xl"
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={16} className="shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits.length > 0 && hits[0] != null) go(hits[0].href);
            }}
            placeholder="Type a destination — TODAY, FNO, PE…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
          <kbd className="tnum shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">esc</kbd>
        </div>
        <ul className="max-h-64 overflow-y-auto py-1">
          {hits.map((hit) => (
            <li key={hit.code}>
              <button
                type="button"
                onClick={() => go(hit.href)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent/[0.07]"
              >
                <span className="tnum w-20 shrink-0 text-[11px] font-semibold text-accent">{hit.code}</span>
                <span>{hit.label}</span>
              </button>
            </li>
          ))}
          {hits.length === 0 && <li className="px-3 py-4 text-sm text-muted">No destination matches.</li>}
        </ul>
      </div>
    </div>
  );
}

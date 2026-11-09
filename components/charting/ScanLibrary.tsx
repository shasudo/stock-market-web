"use client";

import { useState } from "react";
import { BookOpen, ClipboardPaste, Star, Trash2, X } from "lucide-react";
import { SCAN_EXAMPLES, exampleScan, type ScanExample } from "@/lib/screener/examples";
import { scanFromPaste, type SavedScan } from "@/lib/screener/share";
import type { Scan } from "@/lib/screener/scan-types";
import { cn } from "@/lib/utils";

interface ScanLibraryProps {
  readonly saved: readonly SavedScan[];
  readonly onLoad: (scan: Scan) => void;
  readonly onDeleteSaved: (id: string) => void;
  readonly onClose: () => void;
}

type Tab = "examples" | "saved" | "paste";

export function ScanLibrary({ saved, onLoad, onDeleteSaved, onClose }: ScanLibraryProps) {
  const [tab, setTab] = useState<Tab>(saved.length ? "saved" : "examples");
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const categories = [...new Set(SCAN_EXAMPLES.map((example) => example.category))];

  const loadExample = (example: ScanExample): void => onLoad(exampleScan(example));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-base font-extrabold text-foreground">Browse scans</h3>
          <div className="ml-3 flex rounded-lg bg-muted p-0.5">
            {(
              [
                ["examples", "Scan examples"],
                ["saved", `My scans (${saved.length})`],
                ["paste", "Paste scan URL"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-bold",
                  tab === value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="ml-auto rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {tab === "examples" &&
            categories.map((category) => (
              <div key={category} className="mb-4">
                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{category}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SCAN_EXAMPLES.filter((example) => example.category === category).map((example) => (
                    <button
                      key={example.id}
                      type="button"
                      onClick={() => loadExample(example)}
                      className="rounded-xl border border-border px-3 py-2 text-left hover:border-primary hover:bg-primary/5"
                    >
                      <div className="text-sm font-bold text-foreground">{example.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{example.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

          {tab === "saved" &&
            (saved.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No saved scans yet. Use <b>Save Scan</b> to keep one here.
              </div>
            ) : (
              <div className="space-y-2">
                {saved.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                    <Star className="h-4 w-4 text-warning" />
                    <button type="button" onClick={() => onLoad(entry.scan)} className="flex-1 text-left">
                      <div className="text-sm font-bold text-foreground">{entry.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Saved {entry.savedAt ? new Date(entry.savedAt).toLocaleString("en-IN") : ""}
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${entry.name}`}
                      onClick={() => onDeleteSaved(entry.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-error/10 hover:text-error"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ))}

          {tab === "paste" && (
            <div>
              <p className="text-xs text-muted-foreground">
                Paste a scan link shared from this page (it contains <code>?scan=</code>) or a scan copied as JSON.
              </p>
              <textarea
                value={paste}
                onChange={(event) => {
                  setPaste(event.target.value);
                  setPasteError(null);
                }}
                rows={5}
                className="mt-2 w-full rounded-xl border border-border px-3 py-2 font-mono text-xs outline-none focus:border-ring"
              />
              <button
                type="button"
                onClick={() => {
                  const scan = scanFromPaste(paste);
                  if (scan) onLoad(scan);
                  else setPasteError("That doesn't look like a scan link or scan JSON.");
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                <ClipboardPaste className="h-3.5 w-3.5" /> Load scan
              </button>
              {pasteError && <p className="mt-2 text-xs font-semibold text-error">{pasteError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

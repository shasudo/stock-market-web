"use client";

import { useRef, useState } from "react";
import { ChevronDown, Minus, Play, Save, TriangleAlert, X } from "lucide-react";
import toast from "react-hot-toast";

import {
  compilePineScript,
  registerCompiledScript,
} from "@/lib/pine/pine-script";

export const PINE_SCRIPTS_KEY = "chart:pine:my-scripts:v1";
export const DEFAULT_PINE = `// This Pine Script® code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/

//@version=6
indicator("My script")
plot(close)`;

export interface SavedPineScript {
  readonly name: string;
  readonly code: string;
}

export function readPineScripts(): SavedPineScript[] {
  try {
    const raw = window.localStorage.getItem(PINE_SCRIPTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedPineScript =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as SavedPineScript).name === "string" &&
        typeof (entry as SavedPineScript).code === "string",
    );
  } catch {
    return [];
  }
}

function writePineScripts(scripts: readonly SavedPineScript[]): void {
  try {
    window.localStorage.setItem(PINE_SCRIPTS_KEY, JSON.stringify(scripts));
  } catch {
    // Quota or privacy mode; the list simply won't persist.
  }
}

interface PineEditorPanelProps {
  readonly onClose: () => void;
  readonly onAddToChart: (definitionId: string) => void;
}

/**
 * TradingView-style bottom-docked Pine Editor: script switcher, Add to chart,
 * Save and Publish actions, a code area, and a live line/column status bar.
 */
export default function PineEditorPanel({
  onClose,
  onAddToChart,
}: PineEditorPanelProps) {
  const [scripts, setScripts] = useState<SavedPineScript[]>(() =>
    typeof window === "undefined" ? [] : readPineScripts(),
  );
  const [active, setActive] = useState("untitled");
  const [code, setCode] = useState(DEFAULT_PINE);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const activeName = active === "untitled" ? "Untitled script" : active;

  const syncCursor = (): void => {
    const area = areaRef.current;
    if (!area) return;
    const before = area.value.slice(0, area.selectionStart ?? 0);
    const line = before.split("\n").length;
    const col = before.length - (before.lastIndexOf("\n") + 1) + 1;
    setCursor({ line, col });
  };

  const persist = (name: string, nextCode: string): SavedPineScript[] => {
    const entry = { name, code: nextCode };
    const next = [
      ...scripts.filter((item) => item.name !== name),
      entry,
    ];
    setScripts(next);
    writePineScripts(next);
    return next;
  };

  return (
    <section
      aria-label="Pine Editor"
      className="flex h-[300px] shrink-0 flex-col border-t border-border bg-card"
    >
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        <span className="flex items-center gap-1.5 px-2 text-[13px] font-semibold text-foreground">
          <span aria-hidden className="text-[15px]">
            ~
          </span>
          Pine Editor
        </span>
        <label className="relative ml-2 flex items-center gap-1 rounded px-2 py-1 text-[13px] font-semibold text-foreground hover:bg-muted">
          <span className="sr-only">Active script</span>
          <select
            value={active}
            onChange={(event) => {
              const next = event.target.value;
              setActive(next);
              if (next === "untitled") {
                setCode(DEFAULT_PINE);
              } else {
                const found = scripts.find((item) => item.name === next);
                if (found) setCode(found.code);
              }
              setCursor({ line: 1, col: 1 });
            }}
            className="max-w-44 cursor-pointer appearance-none bg-transparent pr-5 focus:outline-none"
          >
            <option value="untitled">Untitled script</option>
            {scripts.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1 h-3.5 w-3.5 text-muted-foreground" />
        </label>

        <span className="flex-1" />

        <button
          type="button"
          onClick={() => {
            const name =
              active === "untitled"
                ? `My script${scripts.length > 0 ? ` ${scripts.length + 1}` : ""}`
                : active;
            const compiled = compilePineScript(name, code);
            if (!compiled.definition) {
              toast.error(compiled.error ?? "Could not compile the script");
              return;
            }
            persist(name, code);
            setActive(name);
            registerCompiledScript(name, code, compiled.definition);
            if (compiled.warnings.length > 0) {
              toast(compiled.warnings.join(" "), { duration: 6000 });
            }
            onAddToChart(compiled.definition.id);
          }}
          className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted"
        >
          <Play className="h-3.5 w-3.5" />
          Add to chart
        </button>
        <button
          type="button"
          onClick={() => {
            const name =
              active === "untitled"
                ? `My script${scripts.length > 0 ? ` ${scripts.length + 1}` : ""}`
                : active;
            persist(name, code);
            setActive(name);
            toast.success(`Saved "${name}"`);
          }}
          className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[13px] font-medium text-primary hover:bg-muted"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            const name =
              active === "untitled"
                ? `My script${scripts.length > 0 ? ` ${scripts.length + 1}` : ""}`
                : active;
            persist(name, code);
            setActive(name);
            toast.success(
              `Published "${name}" — free for this workspace, listed under My scripts.`,
            );
          }}
          className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-[13px] font-semibold text-foreground hover:bg-muted"
        >
          <TriangleAlert className="h-3.5 w-3.5" />
          Publish script
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Minimize Pine Editor"
          title="Minimize"
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Pine Editor"
          title="Close"
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <textarea
        ref={areaRef}
        value={code}
        onChange={(event) => {
          setCode(event.target.value);
          syncCursor();
        }}
        onSelect={syncCursor}
        onKeyUp={syncCursor}
        onClick={syncCursor}
        spellCheck={false}
        aria-label={`Pine Script code for ${activeName}`}
        className="min-h-0 flex-1 resize-none bg-card p-3 font-mono text-[13px] leading-5 text-foreground focus:outline-none"
      />

      <div className="flex h-7 shrink-0 items-center justify-end gap-4 border-t border-border px-3 text-[11px] text-muted-foreground">
        <span>
          Line {cursor.line}, Col {cursor.col}
        </span>
        <span>Pine Script® v6</span>
      </div>
    </section>
  );
}

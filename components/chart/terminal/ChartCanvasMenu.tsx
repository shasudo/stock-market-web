"use client";

import { useState } from "react";
import {
  AlarmClockPlus,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Lock,
  RotateCcw,
  Settings,
  SquarePlus,
  X,
} from "lucide-react";
import { Divider, MenuItem, formatNumber } from "./ui";

export interface ChartTemplateEntry {
  readonly name: string;
}

interface ChartCanvasMenuProps {
  readonly symbol: string;
  readonly price: number | null;
  readonly drawingCount: number;
  readonly indicatorCount: number;
  readonly hasClipboard: boolean;
  readonly templates: readonly ChartTemplateEntry[];
  readonly onResetView: () => void;
  readonly onCopyPrice: () => void;
  readonly onPaste: () => void;
  readonly onAddAlert: () => void;
  readonly onSellLimit: () => void;
  readonly onBuyStop: () => void;
  readonly onAddOrder: () => void;
  readonly onLockCursorLine: () => void;
  readonly onTableView: () => void;
  readonly onObjectTree: () => void;
  readonly onApplyTemplate: (name: string) => void;
  readonly onSaveTemplate: (name: string) => void;
  readonly onDeleteTemplate: (name: string) => void;
  readonly onRemoveDrawings: () => void;
  readonly onRemoveIndicators: () => void;
  readonly onOpenSettings: () => void;
  readonly close: () => void;
}

function Hint({ children }: { children: string }) {
  return (
    <span className="ml-auto pl-6 text-[12px] text-muted-foreground/70">
      {children}
    </span>
  );
}

/**
 * Right-click menu on the chart pane, exactly like TradingView: view reset,
 * copy/paste, alerts, paper orders, cursor lock, table view, object tree,
 * templates, bulk remove and settings.
 */
export default function ChartCanvasMenu({
  symbol,
  price,
  drawingCount,
  indicatorCount,
  hasClipboard,
  templates,
  onResetView,
  onCopyPrice,
  onPaste,
  onAddAlert,
  onSellLimit,
  onBuyStop,
  onAddOrder,
  onLockCursorLine,
  onTableView,
  onObjectTree,
  onApplyTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  onRemoveDrawings,
  onRemoveIndicators,
  onOpenSettings,
  close,
}: ChartCanvasMenuProps) {
  const [templateOpen, setTemplateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const priced = price !== null;

  const run = (action: () => void): void => {
    action();
    close();
  };

  return (
    <div className="min-w-72 py-1" onMouseLeave={() => setTemplateOpen(false)}>
      <MenuItem onClick={() => run(onResetView)}>
        <RotateCcw className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">Reset chart view</span>
      </MenuItem>
      <Divider vertical={false} />
      <MenuItem disabled={!priced} onClick={() => run(onCopyPrice)}>
        <span className="w-4" aria-hidden />
        <span className="flex-1">
          Copy price{priced ? ` ${formatNumber(price)}` : ""}
        </span>
      </MenuItem>
      <MenuItem disabled={!hasClipboard} onClick={() => run(onPaste)}>
        <span className="w-4" aria-hidden />
        <span className="flex-1">Paste</span>
        <Hint>⌘V</Hint>
      </MenuItem>
      <Divider vertical={false} />
      <MenuItem disabled={!priced} onClick={() => run(onAddAlert)}>
        <AlarmClockPlus className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">
          Add alert on {symbol} at {priced ? `${formatNumber(price)}…` : "…"}
        </span>
      </MenuItem>
      <Divider vertical={false} />
      <MenuItem disabled={!priced} onClick={() => run(onSellLimit)}>
        <ChevronsDown className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">
          Sell 1 {symbol} @ {priced ? `${formatNumber(price)} limit` : "…"}
        </span>
      </MenuItem>
      <MenuItem disabled={!priced} onClick={() => run(onBuyStop)}>
        <ChevronsUp className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">
          Buy 1 {symbol} @ {priced ? `${formatNumber(price)} stop` : "…"}
        </span>
      </MenuItem>
      <MenuItem disabled={!priced} onClick={() => run(onAddOrder)}>
        <SquarePlus className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">
          Add order on {symbol} at {priced ? `${formatNumber(price)}…` : "…"}
        </span>
      </MenuItem>
      <Divider vertical={false} />
      <MenuItem onClick={() => run(onLockCursorLine)}>
        <Lock className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">Lock vertical cursor line by time</span>
      </MenuItem>
      <Divider vertical={false} />
      <MenuItem onClick={() => run(onTableView)}>
        <span className="w-4" aria-hidden />
        <span className="flex-1">Table view</span>
      </MenuItem>
      <MenuItem onClick={() => run(onObjectTree)}>
        <span className="w-4" aria-hidden />
        <span className="flex-1">Object tree</span>
      </MenuItem>
      <div className="relative" onMouseEnter={() => setTemplateOpen(true)}>
        <MenuItem
          onClick={() => setTemplateOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={templateOpen}
        >
          <span className="w-4" aria-hidden />
          <span className="flex-1">Chart template</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </MenuItem>
        {templateOpen && (
          <div
            role="menu"
            className="absolute left-full top-0 z-[80] min-w-56 rounded-lg border border-border bg-card py-1 shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
          >
            {templates.length === 0 && !saving && (
              <p className="px-3 py-1.5 text-[12px] text-muted-foreground">
                No templates yet.
              </p>
            )}
            {templates.map((entry) => (
              <div key={entry.name} className="group flex items-center">
                <MenuItem
                  className="flex-1"
                  onClick={() => run(() => onApplyTemplate(entry.name))}
                >
                  <span className="flex-1">{entry.name}</span>
                </MenuItem>
                <button
                  type="button"
                  aria-label={`Delete template ${entry.name}`}
                  onClick={() => onDeleteTemplate(entry.name)}
                  className="mr-1 hidden rounded p-1 text-muted-foreground hover:text-error group-hover:block"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {saving ? (
              <form
                className="flex items-center gap-1 px-2 py-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (name.trim()) {
                    onSaveTemplate(name.trim());
                    setName("");
                    setSaving(false);
                    close();
                  }
                }}
              >
                <input
                  autoFocus
                  value={name}
                  maxLength={40}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Template name"
                  aria-label="Template name"
                  className="min-w-0 flex-1 rounded border border-border px-2 py-1 text-[13px] outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  className="rounded bg-foreground px-2 py-1 text-[12px] font-semibold text-primary-foreground"
                >
                  Save
                </button>
              </form>
            ) : (
              <MenuItem onClick={() => setSaving(true)}>
                <span className="flex-1 pl-6">Save chart template…</span>
              </MenuItem>
            )}
          </div>
        )}
      </div>
      <Divider vertical={false} />
      <MenuItem onClick={() => run(onRemoveDrawings)}>
        <span className="w-4" aria-hidden />
        <span className="flex-1">
          Remove {drawingCount} drawing{drawingCount === 1 ? "" : "s"}
        </span>
      </MenuItem>
      <MenuItem onClick={() => run(onRemoveIndicators)}>
        <span className="w-4" aria-hidden />
        <span className="flex-1">
          Remove {indicatorCount} indicator{indicatorCount === 1 ? "" : "s"}
        </span>
      </MenuItem>
      <Divider vertical={false} />
      <MenuItem onClick={() => run(onOpenSettings)}>
        <Settings className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">Settings…</span>
      </MenuItem>
    </div>
  );
}

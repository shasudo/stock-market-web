"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronsRight } from "lucide-react";
import type { SidePanelTab } from "./terminal-settings";
import {
  PANEL_WIDTH_DEFAULT,
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  WATCHLIST_SPLIT_DEFAULT,
  clampWatchlistSplit,
} from "./terminal-settings";

/** Neither half of the watchlist tab shrinks below this many pixels. */
const SPLIT_MIN_PX = 96;
const SPLIT_KEY_STEP = 0.05;

interface SidePanelProps {
  readonly tab: SidePanelTab;
  readonly width: number;
  readonly onWidth: (width: number) => void;
  /** Fraction of the watchlist tab's height the watchlist takes. */
  readonly split: number;
  readonly onSplit: (split: number) => void;
  readonly onHide: () => void;
  readonly watchlist: ReactNode;
  readonly details: ReactNode;
  readonly alerts: ReactNode;
  readonly log: ReactNode;
  readonly objects: ReactNode;
  readonly data: ReactNode;
  readonly screener: ReactNode;
  readonly calendar: ReactNode;
  readonly news: ReactNode;
}

function SubTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Panel views"
      className="flex shrink-0 gap-1 rounded-lg bg-muted p-1"
    >
      {tabs.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="tab"
          aria-selected={active === entry.id}
          onClick={() => onChange(entry.id)}
          className={`flex-1 rounded-md px-2 py-1.5 text-[13px] font-semibold transition-colors ${
            active === entry.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

function AlertsViews({ alerts, log }: { alerts: ReactNode; log: ReactNode }) {
  const [view, setView] = useState("alerts");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <SubTabs
        tabs={[
          { id: "alerts", label: "Alerts" },
          { id: "log", label: "Log" },
        ]}
        active={view}
        onChange={setView}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === "alerts" ? alerts : log}
      </div>
    </div>
  );
}

function ObjectsViews({
  objects,
  data,
}: {
  objects: ReactNode;
  data: ReactNode;
}) {
  const [view, setView] = useState("objects");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <SubTabs
        tabs={[
          { id: "objects", label: "Object tree" },
          { id: "data", label: "Data window" },
        ]}
        active={view}
        onChange={setView}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === "objects" ? objects : data}
      </div>
    </div>
  );
}

/**
 * Watchlist above, symbol details below, with a draggable divider between
 * them (double-click resets, arrow keys nudge). Neither half collapses below
 * SPLIT_MIN_PX.
 */
function WatchlistSplit({
  split,
  onSplit,
  watchlist,
  details,
}: {
  readonly split: number;
  readonly onSplit: (split: number) => void;
  readonly watchlist: ReactNode;
  readonly details: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const limit = (value: number): number => {
    const height = container.current?.clientHeight ?? 0;
    const floor = height > SPLIT_MIN_PX * 2 ? SPLIT_MIN_PX / height : 0;
    return clampWatchlistSplit(Math.min(1 - floor, Math.max(floor, value)));
  };

  return (
    <div ref={container} className={`flex min-h-0 flex-1 flex-col ${dragging ? "select-none" : ""}`}>
      <div className="flex min-h-0 flex-col" style={{ flex: `${split} 1 0%` }}>
        {watchlist}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize watchlist and details"
        aria-valuemin={15}
        aria-valuemax={85}
        aria-valuenow={Math.round(split * 100)}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={(event) => {
          if (event.button !== 0 || !container.current) return;
          event.preventDefault();
          const top = container.current.getBoundingClientRect().top;
          const height = container.current.clientHeight;
          if (height <= 0) return;
          setDragging(true);
          const move = (moveEvent: PointerEvent): void => {
            onSplit(limit((moveEvent.clientY - top) / height));
          };
          const up = (): void => {
            setDragging(false);
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
          window.addEventListener("pointercancel", up);
        }}
        onDoubleClick={() => onSplit(WATCHLIST_SPLIT_DEFAULT)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            onSplit(limit(split + (event.key === "ArrowUp" ? -SPLIT_KEY_STEP : SPLIT_KEY_STEP)));
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            onSplit(limit(event.key === "Home" ? 0 : 1));
          }
        }}
        className={`group relative z-10 flex h-2 shrink-0 cursor-ns-resize touch-none items-center justify-center border-y border-border bg-muted/40 outline-none hover:bg-primary/15 focus-visible:bg-primary/20 ${
          dragging ? "bg-primary/20" : ""
        }`}
      >
        <span
          className={`h-1 w-10 rounded-full bg-muted-foreground/40 group-hover:bg-primary ${dragging ? "bg-primary" : ""}`}
          aria-hidden
        />
      </div>
      <div className="min-h-0 overflow-y-auto" style={{ flex: `${1 - split} 1 0%` }}>
        {details}
      </div>
    </div>
  );
}

/**
 * TradingView-style docked side panel. The right rail switches the top-level
 * tab; Alerts/Log and Object tree/Data window switch through sub-tabs that
 * reset whenever the tab remounts. The panel resizes by dragging its left
 * edge (double-click resets) and collapses through the Hide tab handle.
 */
export default function SidePanel({
  tab,
  width,
  onWidth,
  split,
  onSplit,
  onHide,
  watchlist,
  details,
  alerts,
  log,
  objects,
  data,
  screener,
  calendar,
  news,
}: SidePanelProps) {
  const label: Record<SidePanelTab, string> = {
    watchlist: "Watchlist and details",
    details: "Watchlist and details",
    alerts: "Alerts and log",
    objects: "Objects and data",
    screener: "Screener",
    calendar: "Calendar",
    news: "News",
  };
  const clampWidth = (value: number): number =>
    Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, Math.round(value)));

  return (
    <aside
      aria-label={label[tab]}
      style={{ width }}
      className="relative hidden shrink-0 flex-col border-l border-border bg-card md:flex"
    >
      {/* Resize + hide edge, mirroring TradingView's panel border. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize side panel"
        title="Drag to resize · double-click to reset"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          const startX = event.clientX;
          const startWidth = width;
          const move = (moveEvent: PointerEvent): void => {
            onWidth(clampWidth(startWidth + (startX - moveEvent.clientX)));
          };
          const up = (): void => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
          window.addEventListener("pointercancel", up);
        }}
        onDoubleClick={() => onWidth(PANEL_WIDTH_DEFAULT)}
        className="absolute inset-y-0 -left-1.5 z-10 w-3 cursor-ew-resize touch-none hover:bg-primary/15"
      />
      <button
        type="button"
        onClick={onHide}
        title="Hide tab"
        aria-label={`Hide ${label[tab]}`}
        className="group absolute -left-3 top-1/2 z-20 flex h-16 w-3 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
      >
        <ChevronsRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-px" />
      </button>

      {(tab === "watchlist" || tab === "details") && (
        <WatchlistSplit split={split} onSplit={onSplit} watchlist={watchlist} details={details} />
      )}
      {tab === "alerts" && <AlertsViews alerts={alerts} log={log} />}
      {tab === "objects" && <ObjectsViews objects={objects} data={data} />}
      {tab === "screener" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {screener}
        </div>
      )}
      {tab === "calendar" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {calendar}
        </div>
      )}
      {tab === "news" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {news}
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between border-t border-border px-2 py-1">
        <span className="truncate px-1 text-[11px] font-medium text-muted-foreground">
          {label[tab]} · {Math.round(width)}px
        </span>
        <button
          type="button"
          onClick={onHide}
          title="Hide tab"
          className="rounded px-2 py-1 text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Hide tab
        </button>
      </div>
    </aside>
  );
}

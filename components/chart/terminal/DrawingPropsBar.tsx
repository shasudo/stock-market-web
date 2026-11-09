"use client";

import type { ReactNode } from "react";
import {
  AlarmClockPlus,
  GripVertical,
  LayoutGrid,
  Lock,
  LockOpen,
  Brush,
  Settings2,
  Trash2,
  Type,
} from "lucide-react";
import {
  DRAWING_COLORS,
  getToolDefinition,
  type DashStyle,
  type Drawing,
} from "@/lib/chart/drawings";
import {
  attachedKindFor,
  bandForDrawing,
  fibLevelPrice,
  supportsTrendlineAlert,
  trendLinePriceAt,
} from "./alerts";
import { Menu, ToolbarButton } from "./ui";

export interface DrawingStyleValue {
  readonly color: string;
  readonly width: number;
  readonly dash: DashStyle;
}

export interface DrawingStylePatch extends Partial<DrawingStyleValue> {
  readonly textColor?: string;
}

interface DrawingPropsBarProps {
  /** The selected drawing, or null when only the default style is shown. */
  readonly drawing: Drawing | null;
  readonly style: DrawingStyleValue;
  /** Global drawings lock from the toolbar. */
  readonly locked: boolean;
  /** "Always remove locked drawings" preference. */
  readonly canDeleteLocked: boolean;
  readonly onStyleChange: (style: DrawingStylePatch) => void;
  readonly onDelete: () => void;
  readonly onToggleLock: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenObjectTree: () => void;
  readonly onCreateAlert: (price: number, drawing: Drawing | null) => void;
  /** Shared "more" menu content (visual order, visibility, clone, hide). */
  readonly moreMenu: (close: () => void) => ReactNode;
}

const DASHES: readonly { id: DashStyle; label: string; pattern: string }[] = [
  { id: "solid", label: "Solid", pattern: "" },
  { id: "dashed", label: "Dashed", pattern: "6 4" },
  { id: "dotted", label: "Dotted", pattern: "1.5 3.5" },
];

function Swatches({
  value,
  onPick,
  label,
}: {
  value: string;
  onPick: (color: string) => void;
  label: string;
}) {
  return (
    <div className="grid w-max grid-cols-8 gap-1 p-2">
      {DRAWING_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`${label} ${color}`}
          aria-pressed={value === color}
          onClick={() => onPick(color)}
          className={`h-5 w-5 rounded-full border border-border ${
            value === color
              ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
              : ""
          }`}
          style={{ backgroundColor: color }}
        />
      ))}
      <label
        className="relative h-5 w-5 cursor-pointer overflow-hidden rounded-full border border-dashed border-muted-foreground"
        title="Custom colour"
      >
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "conic-gradient(#f55, #ff5, #5f5, #5ff, #55f, #f5f, #f55)",
          }}
        />
        <input
          type="color"
          aria-label="Custom colour"
          value={value}
          onChange={(event) => onPick(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

export default function DrawingPropsBar({
  drawing,
  style,
  locked,
  canDeleteLocked,
  onStyleChange,
  onDelete,
  onToggleLock,
  onOpenSettings,
  onOpenObjectTree,
  onCreateAlert,
  moreMenu,
}: DrawingPropsBarProps) {
  const current = drawing ?? null;
  const color = current?.color ?? style.color;
  const textColor = current?.textColor ?? current?.color ?? style.color;
  const width = current?.width ?? style.width;
  const dash = current?.dash ?? style.dash;
  const frozen = locked;
  const drawingLocked = current?.locked === true;
  const cannotEdit = frozen;
  const cannotDelete = (frozen || drawingLocked) && !canDeleteLocked;

  // Every drawing that can host an alert — lines, channels, forks and fibs —
  // offers the bell. The click price is only a hint; the dialog resolves the
  // exact band or fib level itself.
  const attachedKind = current
    ? attachedKindFor(current.type, current.points.length)
    : null;
  const canAlert = current !== null && attachedKind !== null;
  const alertPriceForClick = (): number | null => {
    if (!current || !attachedKind) return null;
    const [first, second] = current.points;
    if (!first) return null;
    if (current.type === "hline" || current.type === "hray") return first.p;
    if (attachedKind === "fib") {
      return fibLevelPrice(current.points, 0.5) ?? second?.p ?? first.p;
    }
    if (attachedKind === "channel" || attachedKind === "fork") {
      const { band } = bandForDrawing(
        current.type,
        current.points,
        first.t,
        [],
      );
      if (band) return (band.lower + band.upper) / 2;
      // Regression without bar data: fall back to the anchors' midpoint.
      return (first.p + (second?.p ?? first.p)) / 2;
    }
    if (!supportsTrendlineAlert(current.type)) return null;
    return trendLinePriceAt(current.points, Math.floor(Date.now() / 1000));
  };

  const dashPattern = DASHES.find((entry) => entry.id === dash)?.pattern ?? "";

  return (
    <div
      role="toolbar"
      aria-label={
        current
          ? `${getToolDefinition(current.type).label} settings`
          : "Drawing style"
      }
      className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border bg-card px-1.5 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
    >
      <span aria-hidden className="cursor-grab px-1 text-muted-foreground/70">
        <GripVertical className="h-4 w-4" />
      </span>
      <ToolbarButton label="Object tree" onClick={onOpenObjectTree}>
        <LayoutGrid className="h-4 w-4" />
      </ToolbarButton>
      <Menu
        trigger={({ toggle }) => (
          <button
            type="button"
            title="Line colour"
            aria-label="Line colour"
            onClick={toggle}
            disabled={cannotEdit && current !== null}
            className="flex h-8 min-w-8 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-foreground hover:bg-muted disabled:opacity-35"
          >
            <Brush className="h-4 w-4" />
            <span
              aria-hidden
              className="h-1 w-6 rounded-full"
              style={{ backgroundColor: color }}
            />
          </button>
        )}
      >
        {(close) => (
          <Swatches
            value={color}
            label="Line colour"
            onPick={(next) => {
              onStyleChange({ color: next });
              close();
            }}
          />
        )}
      </Menu>
      <Menu
        trigger={({ toggle }) => (
          <button
            type="button"
            title="Text colour"
            aria-label="Text colour"
            onClick={toggle}
            disabled={cannotEdit && current !== null}
            className="flex h-8 min-w-8 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-foreground hover:bg-muted disabled:opacity-35"
          >
            <Type className="h-4 w-4" />
            <span
              aria-hidden
              className="h-1 w-6 rounded-full"
              style={{ backgroundColor: textColor }}
            />
          </button>
        )}
      >
        {(close) => (
          <Swatches
            value={textColor}
            label="Text colour"
            onPick={(next) => {
              onStyleChange({ textColor: next });
              close();
            }}
          />
        )}
      </Menu>
      <Menu
        trigger={({ toggle }) => (
          <button
            type="button"
            title="Line width"
            aria-label={`Line width ${width}px`}
            onClick={toggle}
            disabled={cannotEdit && current !== null}
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-foreground hover:bg-muted disabled:opacity-35"
          >
            <span
              aria-hidden
              className="block w-5 rounded bg-foreground"
              style={{ height: Math.min(4, width) }}
            />
            {width}px
          </button>
        )}
      >
        {(close) => (
          <div className="w-max min-w-[140px] py-1">
            {[1, 2, 3, 4].map((option) => (
              <button
                key={option}
                type="button"
                role="menuitem"
                aria-label={`Line width ${option}px`}
                onClick={() => {
                  onStyleChange({ width: option });
                  close();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-muted"
              >
                <span
                  aria-hidden
                  className="block w-6 rounded bg-foreground"
                  style={{ height: option }}
                />
                {option}px
              </button>
            ))}
          </div>
        )}
      </Menu>
      <Menu
        trigger={({ toggle }) => (
          <button
            type="button"
            title="Line style"
            aria-label="Line style"
            onClick={toggle}
            disabled={cannotEdit && current !== null}
            className="flex h-8 items-center rounded-md px-2 text-foreground hover:bg-muted disabled:opacity-35"
          >
            <svg width="26" height="6" aria-hidden>
              <line
                x1="1"
                y1="3"
                x2="25"
                y2="3"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={dashPattern}
              />
            </svg>
          </button>
        )}
      >
        {(close) => (
          <div className="w-max min-w-[140px] py-1">
            {DASHES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                aria-label={`${entry.label} line`}
                onClick={() => {
                  onStyleChange({ dash: entry.id });
                  close();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-muted"
              >
                <svg width="26" height="6" aria-hidden>
                  <line
                    x1="1"
                    y1="3"
                    x2="25"
                    y2="3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={entry.pattern}
                  />
                </svg>
                {entry.label}
              </button>
            ))}
          </div>
        )}
      </Menu>
      {current && (
        <>
          <ToolbarButton label="Drawing settings" onClick={onOpenSettings}>
            <Settings2 className="h-4 w-4" />
          </ToolbarButton>
          {canAlert && (
            <ToolbarButton
              label={
                current.type === "hline" || current.type === "hray"
                  ? "Create an alert at this price"
                  : `Create an alert on this ${getToolDefinition(current.type).label.toLowerCase()}`
              }
              onClick={() => {
                const price = alertPriceForClick();
                if (price !== null) onCreateAlert(price, current);
              }}
            >
              <AlarmClockPlus className="h-4 w-4" />
            </ToolbarButton>
          )}
          <ToolbarButton
            label={drawingLocked ? "Unlock drawing" : "Lock drawing"}
            aria-pressed={drawingLocked}
            active={drawingLocked}
            disabled={frozen}
            onClick={onToggleLock}
          >
            {drawingLocked ? (
              <Lock className="h-4 w-4" />
            ) : (
              <LockOpen className="h-4 w-4" />
            )}
          </ToolbarButton>
          <ToolbarButton
            label="Delete (Del)"
            onClick={onDelete}
            disabled={cannotDelete}
          >
            <Trash2 className="h-4 w-4" />
          </ToolbarButton>
          <Menu
            trigger={({ toggle }) => (
              <ToolbarButton label="More drawing actions" onClick={toggle}>
                <span
                  aria-hidden
                  className="text-[16px] font-bold leading-none"
                >
                  ···
                </span>
              </ToolbarButton>
            )}
          >
            {(close) => moreMenu(close)}
          </Menu>
        </>
      )}
    </div>
  );
}

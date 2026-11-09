"use client";

import { useState } from "react";
import {
  BellPlus,
  Braces,
  ChartLine,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Info,
  Layers,
  ListTree,
  Move,
  Pin,
  Settings,
  Star,
  Trash2,
} from "lucide-react";

import { getIndicatorDefinition } from "@/lib/technical/indicator-catalog";
import {
  type IndicatorInstance,
  type VisibilityTimeframe,
  VISIBILITY_TIMEFRAMES,
  formatIndicatorTitle,
} from "@/lib/technical/indicator-schema";
import { cn } from "@/lib/utils";

export type IndicatorMenuAction =
  | "alert"
  | "add-indicator"
  | "favorite"
  | "visibility-settings"
  | "about"
  | "source"
  | "copy"
  | "hide"
  | "remove"
  | "object-tree"
  | "settings";

export interface IndicatorMenuProps {
  readonly instance: IndicatorInstance;
  readonly isFavorite: boolean;
  readonly x: number;
  readonly y: number;
  readonly onAction: (action: IndicatorMenuAction) => void;
  readonly onToggleUnit: (unit: VisibilityTimeframe, enabled: boolean) => void;
  readonly onReorder: (
    direction: "front" | "forward" | "backward" | "back",
  ) => void;
  readonly onMoveTo: (pane: "price" | "separate") => void;
  readonly onPinScale: (side: "left" | "right") => void;
  readonly onClose: () => void;
}

const UNIT_LABELS: Readonly<Record<VisibilityTimeframe, string>> = {
  ticks: "Ticks",
  seconds: "Seconds",
  minutes: "Minutes",
  hours: "Hours",
  days: "Days",
  weeks: "Weeks",
  months: "Months",
};

/**
 * Right-click / ••• menu for a chart indicator, mirroring TradingView's
 * indicator menu: alerts, favorites, visual order, interval visibility,
 * pane moves, scale pinning, script info, and lifecycle actions.
 */
export default function IndicatorMenu({
  instance,
  isFavorite,
  x,
  y,
  onAction,
  onToggleUnit,
  onReorder,
  onMoveTo,
  onPinScale,
  onClose,
}: IndicatorMenuProps) {
  const [openSub, setOpenSub] = useState<string | null>(null);
  const definition = getIndicatorDefinition(instance.definitionId);
  if (!definition) return null;

  const title = formatIndicatorTitle(definition, instance);
  const effectivePane = instance.paneOverride ?? definition.pane;
  const scaleSide = instance.scaleSide ?? "right";
  const isPricePane = effectivePane === "price";

  return (
    <div
      role="menu"
      aria-label={`${title} menu`}
      className="max-h-[calc(100vh-16px)] w-80 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
      style={{
        top: Math.max(8, Math.min(y, window.innerHeight - 480)),
        left: Math.max(8, Math.min(x, window.innerWidth - 340)),
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <MenuItem
        icon={<BellPlus className="h-4 w-4" />}
        label={`Add alert on ${title}...`}
        hint="⌥A"
        onClick={() => onAction("alert")}
      />
      <MenuItem
        icon={<ChartLine className="h-4 w-4" />}
        label={`Add indicator/strategy on ${title}...`}
        onClick={() => onAction("add-indicator")}
      />
      <MenuItem
        icon={
          <Star
            className={cn("h-4 w-4", isFavorite && "fill-warning text-warning")}
          />
        }
        label="Add this indicator to favorites"
        onClick={() => onAction("favorite")}
      />
      <MenuSeparator />
      <SubMenu
        id="order"
        openSub={openSub}
        setOpenSub={setOpenSub}
        icon={<Layers className="h-4 w-4" />}
        label="Visual order"
      >
        <MenuItem label="Bring to front" onClick={() => onReorder("front")} />
        <MenuItem label="Bring forward" onClick={() => onReorder("forward")} />
        <MenuItem label="Send backward" onClick={() => onReorder("backward")} />
        <MenuItem label="Send to back" onClick={() => onReorder("back")} />
      </SubMenu>
      <SubMenu
        id="visibility"
        openSub={openSub}
        setOpenSub={setOpenSub}
        icon={<Eye className="h-4 w-4" />}
        label="Visibility on intervals"
      >
        {VISIBILITY_TIMEFRAMES.map((unit) => (
          <button
            key={unit}
            type="button"
            role="menuitemcheckbox"
            aria-checked={instance.visibility[unit].enabled}
            onClick={() =>
              onToggleUnit(unit, !instance.visibility[unit].enabled)
            }
            className="flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-[14px] text-foreground hover:bg-muted"
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border",
                instance.visibility[unit].enabled
                  ? "border-foreground bg-foreground text-primary-foreground"
                  : "border-muted-foreground/40 bg-card",
              )}
            >
              {instance.visibility[unit].enabled && (
                <svg viewBox="0 0 10 8" className="h-2.5 w-2.5" fill="none">
                  <path
                    d="M1 4l2.5 2.5L9 1"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </span>
            {UNIT_LABELS[unit]}
          </button>
        ))}
        <MenuSeparator />
        <MenuItem
          label="Edit ranges..."
          onClick={() => onAction("visibility-settings")}
        />
      </SubMenu>
      <SubMenu
        id="moveto"
        openSub={openSub}
        setOpenSub={setOpenSub}
        icon={<Move className="h-4 w-4" />}
        label="Move to"
      >
        <MenuItem
          label={`Price scale${isPricePane ? " ✓" : ""}`}
          onClick={() => onMoveTo("price")}
        />
        <MenuItem
          label={`New pane${!isPricePane ? " ✓" : ""}`}
          onClick={() => onMoveTo("separate")}
        />
      </SubMenu>
      <SubMenu
        id="pinscale"
        openSub={openSub}
        setOpenSub={setOpenSub}
        icon={<Pin className="h-4 w-4" />}
        label={`Pin to scale (now ${scaleSide})`}
        disabled={!isPricePane}
      >
        <MenuItem label="Pin to left scale" onClick={() => onPinScale("left")} />
        <MenuItem
          label="Pin to right scale"
          onClick={() => onPinScale("right")}
        />
      </SubMenu>
      <MenuSeparator />
      <MenuItem
        icon={<Info className="h-4 w-4" />}
        label="About this script..."
        onClick={() => {
          onAction("about");
          onClose();
        }}
      />
      <MenuItem
        icon={<Braces className="h-4 w-4" />}
        label="Source code..."
        onClick={() => {
          onAction("source");
          onClose();
        }}
      />
      <MenuSeparator />
      <MenuItem
        icon={<Copy className="h-4 w-4" />}
        label="Copy"
        hint="⌘C"
        onClick={() => onAction("copy")}
      />
      <MenuItem
        icon={<EyeOff className="h-4 w-4" />}
        label="Hide"
        onClick={() => onAction("hide")}
      />
      <MenuItem
        icon={<Trash2 className="h-4 w-4" />}
        label="Remove"
        hint="⌫"
        onClick={() => onAction("remove")}
      />
      <MenuSeparator />
      <MenuItem
        icon={<ListTree className="h-4 w-4" />}
        label="Object tree"
        onClick={() => onAction("object-tree")}
      />
      <MenuItem
        icon={<Settings className="h-4 w-4" />}
        label="Settings..."
        onClick={() => onAction("settings")}
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-[14px] text-foreground hover:bg-muted"
    >
      {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-[12px] text-muted-foreground/70">{hint}</span>}
    </button>
  );
}

function SubMenu({
  id,
  openSub,
  setOpenSub,
  icon,
  label,
  disabled,
  children,
}: {
  id: string;
  openSub: string | null;
  setOpenSub: (id: string | null) => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const open = openSub === id;
  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpenSub(open ? null : id)}
        className="flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-[14px] text-foreground hover:bg-muted disabled:opacity-40"
      >
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" />
      </button>
      {open && <div className="border-l-2 border-border ml-6">{children}</div>}
    </div>
  );
}

function MenuSeparator() {
  return <div className="my-1 border-t border-border" />;
}

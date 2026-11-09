"use client";

import { useState } from "react";
import { Check, ChevronRight, RotateCcw, Settings } from "lucide-react";
import type {
  LastValueMode,
  PriceScaleMode,
} from "@/lib/chart/display-settings";
import { Divider, MenuItem } from "./ui";

interface PriceScaleMenuProps {
  readonly priceAutoScale: boolean;
  readonly ratioLocked: boolean;
  readonly ratioLabel: string | null;
  readonly scalePriceOnly: boolean;
  readonly invertScale: boolean;
  readonly activeMode: PriceScaleMode;
  readonly scaleOnLeft: boolean;
  readonly lastValue: LastValueMode;
  readonly highLowLabels: boolean;
  readonly countdown: boolean;
  readonly horzGrid: boolean;
  readonly vertGrid: boolean;
  readonly onResetScale: () => void;
  readonly onToggleAuto: () => void;
  readonly onToggleRatioLock: () => void;
  readonly onTogglePriceOnly: () => void;
  readonly onToggleInvert: () => void;
  readonly onMode: (mode: PriceScaleMode) => void;
  readonly onMoveScale: () => void;
  readonly onLastValue: (mode: LastValueMode) => void;
  readonly onHighLowLabels: (on: boolean) => void;
  readonly onCountdown: (on: boolean) => void;
  readonly onHorzGrid: (on: boolean) => void;
  readonly onVertGrid: (on: boolean) => void;
  readonly onMoreSettings: () => void;
  readonly close: () => void;
  /** Flyout side for the Labels/Lines submenus; bottom-bar popups use "left". */
  readonly submenuSide?: "right" | "left";
}

function CheckRow({
  checked,
  label,
  detail,
  onClick,
}: {
  checked: boolean;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <MenuItem onClick={onClick}>
      <span className="w-5 shrink-0" aria-hidden>
        {checked && <Check className="h-4 w-4 text-foreground" />}
      </span>
      <span className="flex-1">{label}</span>
      {detail && (
        <span className="pl-4 text-[12px] text-muted-foreground/70">
          {detail}
        </span>
      )}
    </MenuItem>
  );
}

/**
 * Right-click menu on the price scale, exactly like TradingView: scale
 * reset, auto, ratio lock, price-only scaling, inversion, scale modes,
 * placement, label/line toggles, the plus button and more settings.
 */
export default function PriceScaleMenu({
  priceAutoScale,
  ratioLocked,
  ratioLabel,
  scalePriceOnly,
  invertScale,
  activeMode,
  scaleOnLeft,
  lastValue,
  highLowLabels,
  countdown,
  horzGrid,
  vertGrid,
  onResetScale,
  onToggleAuto,
  onToggleRatioLock,
  onTogglePriceOnly,
  onToggleInvert,
  onMode,
  onMoveScale,
  onLastValue,
  onHighLowLabels,
  onCountdown,
  onHorzGrid,
  onVertGrid,
  onMoreSettings,
  close,
  submenuSide = "right",
}: PriceScaleMenuProps) {
  const [openSub, setOpenSub] = useState<"labels" | "lines" | null>(null);
  const valueOn = lastValue === "value-line" || lastValue === "value";
  const lineOn = lastValue === "value-line" || lastValue === "line";

  const run = (action: () => void): void => {
    action();
    close();
  };

  const setValueLine = (value: boolean, line: boolean): void => {
    onLastValue(
      value && line ? "value-line" : value ? "value" : line ? "line" : "hidden",
    );
  };

  const submenu = (id: "labels" | "lines", label: string) => (
    <div className="relative" onMouseEnter={() => setOpenSub(id)}>
      <MenuItem
        onClick={() => setOpenSub((open) => (open === id ? null : id))}
        aria-haspopup="menu"
        aria-expanded={openSub === id}
      >
        <span className="w-5" aria-hidden />
        <span className="flex-1">{label}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </MenuItem>
      {openSub === id && (
        <div
          role="menu"
          className={
            submenuSide === "left"
              ? "absolute right-full top-0 z-[80] min-w-56 rounded-lg border border-border bg-card py-1 shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
              : "absolute left-full top-0 z-[80] min-w-56 rounded-lg border border-border bg-card py-1 shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
          }
        >
          {id === "labels" ? (
            <>
              <CheckRow
                checked={valueOn}
                label="Symbol last value label"
                onClick={() => setValueLine(!valueOn, lineOn)}
              />
              <CheckRow
                checked={highLowLabels}
                label="High and low price labels"
                onClick={() => onHighLowLabels(!highLowLabels)}
              />
              <CheckRow
                checked={countdown}
                label="Countdown"
                onClick={() => onCountdown(!countdown)}
              />
            </>
          ) : (
            <>
              <CheckRow
                checked={lineOn}
                label="Price line"
                onClick={() => setValueLine(valueOn, !lineOn)}
              />
              <CheckRow
                checked={horzGrid}
                label="Horizontal grid lines"
                onClick={() => onHorzGrid(!horzGrid)}
              />
              <CheckRow
                checked={vertGrid}
                label="Vertical grid lines"
                onClick={() => onVertGrid(!vertGrid)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-w-72 py-1" onMouseLeave={() => setOpenSub(null)}>
      <MenuItem onClick={() => run(onResetScale)}>
        <RotateCcw className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">Reset price scale</span>
      </MenuItem>
      <CheckRow
        checked={priceAutoScale}
        label="Auto (fits data to screen)"
        onClick={() => run(onToggleAuto)}
      />
      <CheckRow
        checked={ratioLocked}
        label="Lock price to bar ratio"
        detail={ratioLabel ?? undefined}
        onClick={() => run(onToggleRatioLock)}
      />
      <CheckRow
        checked={scalePriceOnly}
        label="Scale price chart only"
        onClick={() => run(onTogglePriceOnly)}
      />
      <CheckRow
        checked={invertScale}
        label="Invert scale"
        onClick={() => run(onToggleInvert)}
      />
      <Divider vertical={false} />
      <CheckRow
        checked={activeMode === "regular"}
        label="Regular"
        onClick={() => run(() => onMode("regular"))}
      />
      <CheckRow
        checked={activeMode === "percent"}
        label="Percent"
        onClick={() => run(() => onMode("percent"))}
      />
      <CheckRow
        checked={activeMode === "indexed"}
        label="Indexed to 100"
        onClick={() => run(() => onMode("indexed"))}
      />
      <CheckRow
        checked={activeMode === "log"}
        label="Logarithmic"
        onClick={() => run(() => onMode("log"))}
      />
      <Divider vertical={false} />
      <MenuItem onClick={() => run(onMoveScale)}>
        <span className="w-5" aria-hidden />
        <span className="flex-1">
          {scaleOnLeft ? "Move scale to right" : "Move scale to left"}
        </span>
      </MenuItem>
      <Divider vertical={false} />
      {submenu("labels", "Labels")}
      {submenu("lines", "Lines")}
      <Divider vertical={false} />
      <MenuItem onClick={() => run(onMoreSettings)}>
        <Settings className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">More settings…</span>
      </MenuItem>
    </div>
  );
}

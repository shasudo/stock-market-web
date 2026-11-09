"use client";

import { useEffect, useState } from "react";
import { CalendarSearch, Check, RotateCcw, Settings } from "lucide-react";
import { RANGE_IDS, type RangeId } from "@/lib/chart/analytics";
import type {
  ButtonVisibility,
  ChartDisplaySettings,
  LastValueMode,
  PriceScaleMode,
} from "@/lib/chart/display-settings";
import type { ScaleMode } from "./terminal-settings";
import PriceScaleMenu from "./PriceScaleMenu";
import { Menu, ToolbarButton } from "./ui";

/** Everything the bottom-bar scale menu needs, mirroring PriceScaleMenu. */
export interface BottomScaleMenu {
  readonly display: ChartDisplaySettings;
  readonly compareActive: boolean;
  readonly onResetPriceScale: () => void;
  readonly onPatchDisplay: (patch: Partial<ChartDisplaySettings>) => void;
  readonly onPriceMode: (mode: PriceScaleMode) => void;
  readonly onMoreSettings: () => void;
}

interface BottomBarProps {
  readonly activeRange: RangeId | null;
  readonly onRange: (range: RangeId) => void;
  readonly onGoToDate: (isoDate: string) => void;
  readonly scaleMode: ScaleMode;
  readonly onScaleMode: (mode: ScaleMode) => void;
  readonly onReset: () => void;
  readonly countdown: string | null;
  readonly scaleControls: ButtonVisibility;
  readonly scaleMenu: BottomScaleMenu;
}

type Timezone = "exchange" | "local" | "utc";

const TIMEZONE_KEY = "chart:terminal:timezone";
const TIMEZONE_LABEL: Record<Timezone, string> = {
  exchange: "Exchange",
  local: "Local",
  utc: "UTC",
};

function loadTimezone(): Timezone {
  try {
    const stored = window.localStorage.getItem(TIMEZONE_KEY);
    if (stored === "local" || stored === "utc" || stored === "exchange")
      return stored;
  } catch {
    // Ignore storage failures.
  }
  return "exchange";
}

function formatOffset(minutes: number): string {
  const sign = minutes <= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `UTC${sign}${hours}${rest === 0 ? "" : `:${String(rest).padStart(2, "0")}`}`;
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  const [timezone, setTimezone] = useState<Timezone>(() =>
    typeof window === "undefined" ? "exchange" : loadTimezone(),
  );
  useEffect(() => {
    const tick = (): void => setNow(new Date());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeZone =
    timezone === "utc"
      ? "UTC"
      : timezone === "exchange"
        ? "Asia/Kolkata"
        : undefined;
  const format = new Intl.DateTimeFormat("en-GB", {
    ...(timeZone ? { timeZone } : {}),
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const suffix =
    timezone === "utc"
      ? "UTC"
      : timezone === "exchange"
        ? "UTC+5:30"
        : now
          ? formatOffset(now.getTimezoneOffset())
          : "";

  const pick = (next: Timezone): void => {
    setTimezone(next);
    try {
      window.localStorage.setItem(TIMEZONE_KEY, next);
    } catch {
      // Ignore storage failures.
    }
  };

  return (
    <Menu
      align="right"
      side="top"
      trigger={({ toggle }) => (
        <button
          type="button"
          title="Time zone (currently Exchange)"
          aria-label="Time zone settings"
          onClick={toggle}
          className="rounded px-1 py-0.5 font-mono text-[12px] text-foreground hover:bg-muted"
          suppressHydrationWarning
        >
          {now ? `${format.format(now)} ${suffix}` : ""}
        </button>
      )}
    >
      {(close) => (
        <div className="w-44">
          {(Object.keys(TIMEZONE_LABEL) as Timezone[]).map((entry) => (
            <button
              key={entry}
              type="button"
              role="menuitemradio"
              aria-checked={timezone === entry}
              onClick={() => {
                pick(entry);
                close();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-muted"
            >
              <span className="flex h-4 w-4 items-center justify-center">
                {timezone === entry && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </span>
              {TIMEZONE_LABEL[entry]}
            </button>
          ))}
        </div>
      )}
    </Menu>
  );
}

export default function BottomBar({
  activeRange,
  onRange,
  onGoToDate,
  scaleMode,
  onScaleMode,
  onReset,
  countdown,
  scaleControls,
  scaleMenu,
}: BottomBarProps) {
  const [date, setDate] = useState("");
  const { display } = scaleMenu;

  return (
    <div className="group/bottombar flex h-9 shrink-0 items-center justify-between border-t border-border bg-card px-2">
      <div className="flex items-center gap-0.5">
        {RANGE_IDS.map((range) => (
          <button
            key={range}
            id={`chart-range-${range}`}
            type="button"
            aria-pressed={activeRange === range}
            onClick={() => onRange(range)}
            className={`rounded px-2 py-1 text-[12px] font-semibold ${
              activeRange === range
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-muted"
            }`}
          >
            {range === "ALL" ? "All" : range}
          </button>
        ))}
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
        <Menu
          trigger={({ toggle }) => (
            <ToolbarButton
              id="chart-date-picker"
              label="Go to date"
              onClick={toggle}
              className="h-7"
            >
              <CalendarSearch className="h-4 w-4" />
            </ToolbarButton>
          )}
        >
          {(close) => (
            <form
              className="flex items-center gap-2 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (date) {
                  onGoToDate(date);
                  close();
                }
              }}
            >
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="rounded border border-border px-2 py-1 text-[13px]"
                aria-label="Date to go to"
              />
              <button
                type="submit"
                disabled={!date}
                className="rounded bg-primary px-3 py-1 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
              >
                Go
              </button>
            </form>
          )}
        </Menu>
      </div>

      <div className="flex items-center gap-1">
        <Clock />
        {countdown !== null && (
          <span
            aria-label="Countdown to bar close"
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] font-semibold text-foreground"
          >
            {countdown}
          </span>
        )}
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
        {scaleControls !== "hidden" && (
          <span
            className={`flex items-center gap-1 ${
              scaleControls === "hover"
                ? "opacity-0 transition-opacity group-hover/bottombar:opacity-100 focus-within:opacity-100"
                : ""
            }`}
          >
            <ToolbarButton
              label="Percentage scale"
              active={scaleMode === "percent"}
              onClick={() =>
                onScaleMode(scaleMode === "percent" ? "auto" : "percent")
              }
              className="h-7 text-[12px] font-bold"
            >
              %
            </ToolbarButton>
            <ToolbarButton
              label="Logarithmic scale"
              active={scaleMode === "log"}
              onClick={() => onScaleMode(scaleMode === "log" ? "auto" : "log")}
              className="h-7 text-[12px] font-bold"
            >
              log
            </ToolbarButton>
          </span>
        )}
        <ToolbarButton
          label="Reset chart view"
          onClick={onReset}
          className="h-7 text-[12px] font-bold"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          auto
        </ToolbarButton>
        <Menu
          align="right"
          side="top"
          trigger={({ toggle }) => (
            <ToolbarButton
              id="chart-scale-settings"
              label="Scale settings"
              onClick={toggle}
              className="h-7"
            >
              <Settings className="h-4 w-4" />
            </ToolbarButton>
          )}
        >
          {(close) => (
            <PriceScaleMenu
              priceAutoScale={display.priceAutoScale}
              ratioLocked={display.lockPriceBarRatio}
              ratioLabel={
                display.lockPriceBarRatio && display.pricePerBar > 0
                  ? display.pricePerBar.toFixed(4)
                  : null
              }
              scalePriceOnly={display.scalePriceOnly}
              invertScale={display.invertScale}
              activeMode={
                scaleMenu.compareActive ? "percent" : display.priceScaleMode
              }
              scaleOnLeft={display.scalePlacement === "left"}
              lastValue={display.lastValue}
              highLowLabels={display.highLow === "value-line"}
              countdown={display.showCountdown}
              horzGrid={display.showHorzGrid}
              vertGrid={display.showVertGrid}
              onResetScale={scaleMenu.onResetPriceScale}
              onToggleAuto={() =>
                scaleMenu.onPatchDisplay({
                  priceAutoScale: !display.priceAutoScale,
                })
              }
              onToggleRatioLock={() => {
                if (display.lockPriceBarRatio) {
                  scaleMenu.onPatchDisplay({ lockPriceBarRatio: false });
                } else {
                  scaleMenu.onPatchDisplay({
                    lockPriceBarRatio: true,
                    priceAutoScale: false,
                    pricePerBar: 0,
                  });
                }
              }}
              onTogglePriceOnly={() =>
                scaleMenu.onPatchDisplay({
                  scalePriceOnly: !display.scalePriceOnly,
                })
              }
              onToggleInvert={() =>
                scaleMenu.onPatchDisplay({ invertScale: !display.invertScale })
              }
              onMode={(mode: PriceScaleMode) => scaleMenu.onPriceMode(mode)}
              onMoveScale={() =>
                scaleMenu.onPatchDisplay({
                  scalePlacement:
                    display.scalePlacement === "left" ? "right" : "left",
                })
              }
              onLastValue={(mode: LastValueMode) =>
                scaleMenu.onPatchDisplay({ lastValue: mode })
              }
              onHighLowLabels={(on: boolean) =>
                scaleMenu.onPatchDisplay({
                  highLow: on ? "value-line" : "hidden",
                })
              }
              onCountdown={(on: boolean) =>
                scaleMenu.onPatchDisplay({ showCountdown: on })
              }
              onHorzGrid={(on: boolean) =>
                scaleMenu.onPatchDisplay({ showHorzGrid: on })
              }
              onVertGrid={(on: boolean) =>
                scaleMenu.onPatchDisplay({ showVertGrid: on })
              }
              onMoreSettings={scaleMenu.onMoreSettings}
              submenuSide="left"
              close={close}
            />
          )}
        </Menu>
      </div>
    </div>
  );
}

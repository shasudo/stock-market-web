"use client";

import { useState, type ReactNode } from "react";
import {
  Bell,
  BarChart3,
  Camera,
  Check,
  ChevronDown,
  Fullscreen,
  LayoutTemplate,
  PanelRight,
  Plus,
  Redo2,
  Rewind,
  Save,
  Search,
  Settings,
  Shrink,
  Trash2,
  Undo2,
  Activity,
} from "lucide-react";
import { CHART_STYLES, type ChartStyle } from "@/lib/chart/chart-styles";
import type { ChartTimeframe } from "@/lib/market/chart-candles";
import type { SavedLayout, ScaleMode } from "./terminal-settings";
import { Divider, Menu, MenuItem, MenuLabel, ToolbarButton } from "./ui";

export const TIMEFRAME_OPTIONS: readonly {
  id: ChartTimeframe;
  short: string;
  label: string;
  group: "Minutes" | "Hours" | "Days";
}[] = [
  { id: "1", short: "1m", label: "1 minute", group: "Minutes" },
  { id: "5", short: "5m", label: "5 minutes", group: "Minutes" },
  { id: "15", short: "15m", label: "15 minutes", group: "Minutes" },
  { id: "60", short: "1h", label: "1 hour", group: "Hours" },
  { id: "D", short: "D", label: "1 day", group: "Days" },
  { id: "W", short: "W", label: "1 week", group: "Days" },
  { id: "M", short: "M", label: "1 month", group: "Days" },
];

interface TopToolbarProps {
  readonly symbol: string;
  readonly exchange: string;
  readonly timeframe: ChartTimeframe;
  readonly onTimeframe: (timeframe: ChartTimeframe) => void;
  readonly style: ChartStyle;
  readonly onStyle: (style: ChartStyle) => void;
  readonly onSearch: () => void;
  readonly onCompare: () => void;
  readonly onIndicators: () => void;
  readonly indicatorCount: number;
  readonly templateNames: readonly string[];
  readonly onSaveTemplate: (name: string) => void;
  readonly onApplyTemplate: (name: string) => void;
  readonly onDeleteTemplate: (name: string) => void;
  readonly alertCount: number;
  readonly onAlert: () => void;
  readonly replayActive: boolean;
  readonly onReplay: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly panelOpen: boolean;
  readonly onPanel: () => void;
  readonly layouts: readonly SavedLayout[];
  readonly onSaveLayout: (name: string) => void;
  readonly onLoadLayout: (name: string) => void;
  readonly onDeleteLayout: (name: string) => void;
  readonly showGrid: boolean;
  readonly showVolume: boolean;
  readonly showPrevClose: boolean;
  readonly scaleMode: ScaleMode;
  readonly onToggle: (key: "showGrid" | "showVolume" | "showPrevClose") => void;
  readonly onScaleMode: (mode: ScaleMode) => void;
  readonly onSettings: () => void;
  readonly fullscreen: boolean;
  readonly onFullscreen: () => void;
  readonly onScreenshot: () => void;
  readonly onTrade: () => void;
  readonly actions: ReactNode;
}

function NamePrompt({
  placeholder,
  onSubmit,
}: {
  readonly placeholder: string;
  readonly onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex items-center gap-1.5 px-3 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) {
          onSubmit(name.trim());
          setName("");
        }
      }}
    >
      <input
        value={name}
        maxLength={40}
        onChange={(event) => setName(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 rounded border border-border px-2 py-1 text-[13px] outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className="rounded bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground disabled:opacity-40"
      >
        Save
      </button>
    </form>
  );
}

const SCALE_OPTIONS: readonly { id: ScaleMode; label: string }[] = [
  { id: "auto", label: "Regular" },
  { id: "log", label: "Logarithmic" },
  { id: "percent", label: "Percentage" },
];

export default function TopToolbar(props: TopToolbarProps) {
  const timeframe = TIMEFRAME_OPTIONS.find(
    (option) => option.id === props.timeframe,
  )!;
  const style = CHART_STYLES.find((option) => option.id === props.style)!;

  return (
    <header
      role="toolbar"
      aria-label="Chart toolbar"
      className="flex h-11 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-card px-2"
    >
      <ToolbarButton
        id="chart-symbol-search"
        label="Search symbol (press /)"
        onClick={props.onSearch}
        className="gap-2 px-2.5 font-bold"
      >
        <Search className="h-4 w-4" />
        <span>{props.symbol}</span>
        <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {props.exchange}
        </span>
      </ToolbarButton>
      <ToolbarButton label="Compare or add a symbol" onClick={props.onCompare}>
        <Plus className="h-4 w-4" />
      </ToolbarButton>
      <Divider />

      <Menu
        trigger={({ toggle }) => (
          <ToolbarButton
            label={`Timeframe: ${timeframe.label}`}
            onClick={toggle}
            className="font-bold"
          >
            {timeframe.short}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </ToolbarButton>
        )}
      >
        {(close) => (
          <div className="w-44">
            {(["Minutes", "Hours", "Days"] as const).map((group) => (
              <div key={group}>
                <MenuLabel>{group}</MenuLabel>
                {TIMEFRAME_OPTIONS.filter(
                  (option) => option.group === group,
                ).map((option) => (
                  <MenuItem
                    key={option.id}
                    active={option.id === props.timeframe}
                    onClick={() => {
                      props.onTimeframe(option.id);
                      close();
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </div>
            ))}
          </div>
        )}
      </Menu>
      <Divider />

      <Menu
        trigger={({ toggle }) => (
          <ToolbarButton
            id="chart-type-switch"
            label={`Chart type: ${style.label}`}
            onClick={toggle}
          >
            <BarChart3 className="h-4 w-4" />
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </ToolbarButton>
        )}
      >
        {(close) => (
          <div className="w-48">
            <MenuLabel>Chart type</MenuLabel>
            {CHART_STYLES.map((option) => (
              <MenuItem
                key={option.id}
                active={option.id === props.style}
                onClick={() => {
                  props.onStyle(option.id);
                  close();
                }}
              >
                {option.label}
              </MenuItem>
            ))}
          </div>
        )}
      </Menu>
      <Divider />

      <ToolbarButton
        id="chart-indicators-button"
        label="Indicators"
        onClick={props.onIndicators}
        className="gap-1.5"
      >
        <Activity className="h-4 w-4" />
        <span className="hidden md:inline">Indicators</span>
        {props.indicatorCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
            {props.indicatorCount}
          </span>
        )}
      </ToolbarButton>

      <Menu
        trigger={({ toggle }) => (
          <ToolbarButton label="Indicator templates" onClick={toggle}>
            <LayoutTemplate className="h-4 w-4" />
          </ToolbarButton>
        )}
      >
        {(close) => (
          <div className="w-60">
            <MenuLabel>Indicator templates</MenuLabel>
            {props.templateNames.length === 0 && (
              <p className="px-3 py-1.5 text-[12px] text-muted-foreground">
                Save your current indicators as a template.
              </p>
            )}
            {props.templateNames.map((name) => (
              <div key={name} className="flex items-center hover:bg-muted">
                <MenuItem
                  className="flex-1"
                  onClick={() => {
                    props.onApplyTemplate(name);
                    close();
                  }}
                >
                  <span className="truncate">{name}</span>
                </MenuItem>
                <button
                  type="button"
                  aria-label={`Delete template ${name}`}
                  onClick={() => props.onDeleteTemplate(name)}
                  className="mr-2 rounded p-1 text-muted-foreground hover:text-error"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="mt-1 border-t border-border">
              <NamePrompt
                placeholder="Template name"
                onSubmit={(name) => {
                  props.onSaveTemplate(name);
                  close();
                }}
              />
            </div>
          </div>
        )}
      </Menu>
      <Divider />

      <ToolbarButton
        id="chart-alerts-button"
        label="Create alert"
        onClick={props.onAlert}
        className="gap-1.5"
      >
        <Bell className="h-4 w-4" />
        <span className="hidden md:inline">Alert</span>
        {props.alertCount > 0 && (
          <span className="rounded-full bg-warning px-1.5 text-[10px] font-bold text-primary-foreground">
            {props.alertCount}
          </span>
        )}
      </ToolbarButton>
      <ToolbarButton
        label="Bar replay"
        active={props.replayActive}
        onClick={props.onReplay}
        className="gap-1.5"
      >
        <Rewind className="h-4 w-4" />
        <span className="hidden md:inline">Replay</span>
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="Undo (Ctrl+Z)"
        onClick={props.onUndo}
        disabled={!props.canUndo}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo (Ctrl+Shift+Z)"
        onClick={props.onRedo}
        disabled={!props.canRedo}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <span className="flex-1" />

      <ToolbarButton
        label={
          props.panelOpen ? "Hide watchlist panel" : "Show watchlist panel"
        }
        active={props.panelOpen}
        onClick={props.onPanel}
      >
        <PanelRight className="h-4 w-4" />
      </ToolbarButton>
      <Divider />

      <Menu
        align="right"
        trigger={({ toggle }) => (
          <ToolbarButton
            label="Layouts"
            onClick={toggle}
            className="gap-1.5 font-semibold"
          >
            <Save className="h-4 w-4" />
            <span className="hidden md:inline">Save</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </ToolbarButton>
        )}
      >
        {(close) => (
          <div className="w-64">
            <MenuLabel>Saved layouts</MenuLabel>
            {props.layouts.length === 0 && (
              <p className="px-3 py-1.5 text-[12px] text-muted-foreground">
                Save the chart type, timeframe and view options.
              </p>
            )}
            {props.layouts.map((layout) => (
              <div
                key={layout.name}
                className="flex items-center hover:bg-muted"
              >
                <MenuItem
                  className="flex-1"
                  onClick={() => {
                    props.onLoadLayout(layout.name);
                    close();
                  }}
                >
                  <span className="truncate">{layout.name}</span>
                </MenuItem>
                <button
                  type="button"
                  aria-label={`Delete layout ${layout.name}`}
                  onClick={() => props.onDeleteLayout(layout.name)}
                  className="mr-2 rounded p-1 text-muted-foreground hover:text-error"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="mt-1 border-t border-border">
              <NamePrompt
                placeholder="Layout name"
                onSubmit={(name) => {
                  props.onSaveLayout(name);
                  close();
                }}
              />
            </div>
          </div>
        )}
      </Menu>

      <Menu
        align="right"
        trigger={({ toggle }) => (
          <ToolbarButton label="Chart settings" onClick={toggle}>
            <Settings className="h-4 w-4" />
          </ToolbarButton>
        )}
      >
        {(close) => (
          <div className="w-56">
            <MenuLabel>Appearance</MenuLabel>
            {(
              [
                ["showGrid", "Grid lines", props.showGrid],
                ["showVolume", "Volume", props.showVolume],
                ["showPrevClose", "Previous close line", props.showPrevClose],
              ] as const
            ).map(([key, label, value]) => (
              <MenuItem
                key={key}
                onClick={() => props.onToggle(key)}
                role="menuitemcheckbox"
                aria-checked={value}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {value && <Check className="h-4 w-4 text-primary" />}
                </span>
                {label}
              </MenuItem>
            ))}
            <MenuLabel>Price scale</MenuLabel>
            {SCALE_OPTIONS.map((option) => (
              <MenuItem
                key={option.id}
                active={props.scaleMode === option.id}
                onClick={() => props.onScaleMode(option.id)}
              >
                {option.label}
              </MenuItem>
            ))}
            <div className="mt-1 border-t border-border">
              <MenuItem
                onClick={() => {
                  props.onSettings();
                  close();
                }}
              >
                All settings…
              </MenuItem>
            </div>
          </div>
        )}
      </Menu>

      <ToolbarButton
        label={props.fullscreen ? "Exit full screen" : "Full screen"}
        onClick={props.onFullscreen}
      >
        {props.fullscreen ? (
          <Shrink className="h-4 w-4" />
        ) : (
          <Fullscreen className="h-4 w-4" />
        )}
      </ToolbarButton>
      <ToolbarButton label="Download chart image" onClick={props.onScreenshot}>
        <Camera className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Trade"
        onClick={props.onTrade}
        className="mx-1 rounded-md border border-border px-3 font-semibold hover:bg-muted"
      >
        Trade
      </ToolbarButton>
      <Divider />
      <div
        className="flex items-center"
        title="Trade, watchlist, notes and more"
      >
        {props.actions}
      </div>
    </header>
  );
}

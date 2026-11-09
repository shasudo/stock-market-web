"use client";

import { useState, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronsLeft,
  CircleHelp,
  Eye,
  EyeOff,
  Lock,
  Magnet,
  Pin,
  PinOff,
  Star,
  Trash2,
  Unlock,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  TOOL_DEFINITIONS,
  getToolDefinition,
  type DrawingType,
  type ToolDefinition,
  type ToolGroup,
} from "@/lib/chart/drawings";
import type { MagnetMode } from "./terminal-settings";
import { CursorIcon, ToolIcon, type CursorKind } from "./tool-icons";
import { Divider, Menu, ToolbarButton } from "./ui";

const GROUP_ORDER: readonly ToolGroup[] = [
  "lines",
  "fib",
  "patterns",
  "forecast",
  "shapes",
  "annotation",
];

const GROUP_TIPS: Readonly<Record<ToolGroup, string>> = {
  lines: "Trend line tools",
  fib: "Gann and Fibonacci tools",
  patterns: "Patterns, Elliott waves and cycles",
  forecast: "Forecasting and measurement tools",
  shapes: "Brushes, arrows and shapes",
  annotation: "Annotation tools",
  emoji: "Emoji",
  measure: "Measure",
};

interface FlyoutSection {
  readonly title: string;
  readonly tools: readonly ToolDefinition[];
}

function sectionsFor(group: ToolGroup): FlyoutSection[] {
  const sections: { title: string; tools: ToolDefinition[] }[] = [];
  for (const definition of TOOL_DEFINITIONS) {
    if (definition.group !== group) continue;
    let section = sections.find((entry) => entry.title === definition.section);
    if (!section) {
      section = { title: definition.section, tools: [] };
      sections.push(section);
    }
    section.tools.push(definition);
  }
  return sections;
}

const SECTIONS = Object.fromEntries(
  GROUP_ORDER.map((group) => [group, sectionsFor(group)]),
) as Record<ToolGroup, FlyoutSection[]>;

const CURSORS: readonly { id: CursorKind; label: string }[] = [
  { id: "cross", label: "Cross" },
  { id: "dot", label: "Dot" },
  { id: "arrow", label: "Arrow" },
  { id: "demo", label: "Demonstration" },
];

export const EMOJIS: readonly string[] = [
  "😀",
  "😎",
  "🤔",
  "😱",
  "🔥",
  "🚀",
  "💰",
  "📈",
  "📉",
  "🐂",
  "🐻",
  "💎",
  "⚠️",
  "✅",
  "❌",
  "⭐",
  "👍",
  "👎",
  "🎯",
  "🏁",
  "💡",
  "🔔",
  "🛑",
  "⏳",
];

export interface LockState {
  readonly drawings: boolean;
  readonly indicators: boolean;
}

export interface HideState {
  readonly drawings: boolean;
  readonly indicators: boolean;
  readonly positions: boolean;
}

interface DrawingToolbarProps {
  readonly tool: DrawingType | null;
  readonly onToolChange: (tool: DrawingType | null) => void;
  readonly cursor: CursorKind;
  readonly onCursor: (cursor: CursorKind) => void;
  readonly valuesTooltip: boolean;
  readonly onValuesTooltip: (value: boolean) => void;
  readonly emoji: string;
  readonly onEmoji: (emoji: string) => void;
  readonly favorites: readonly DrawingType[];
  readonly onToggleFavorite: (type: DrawingType) => void;
  readonly magnet: MagnetMode;
  readonly onMagnet: (mode: MagnetMode) => void;
  readonly snapIndicators: boolean;
  readonly onSnapIndicators: (value: boolean) => void;
  readonly magnetNoticeSeen: boolean;
  readonly onDismissMagnetNotice: () => void;
  readonly keepDrawing: boolean;
  readonly onKeepDrawing: () => void;
  readonly locks: LockState;
  readonly onLocks: (locks: LockState) => void;
  readonly hides: HideState;
  readonly onHides: (hides: HideState) => void;
  readonly drawingCount: number;
  readonly indicatorCount: number;
  readonly alwaysRemoveLocked: boolean;
  readonly onAlwaysRemoveLocked: (value: boolean) => void;
  readonly onRemove: (what: "drawings" | "indicators" | "both") => void;
  readonly onZoom: (direction: "in" | "out") => void;
  readonly onCollapse?: () => void;
}

const ICON = "h-[22px] w-[22px]";
const BUTTON = "h-10 w-10 rounded-md";

function shortcutLabel(definition: ToolDefinition): string | null {
  const { shortcut } = definition;
  if (!shortcut) return null;
  return `⌥ ${shortcut.shift ? "⇧ " : ""}${shortcut.key}`;
}

/** A button with TradingView's dark hover bubble and an optional flyout arrow. */
function Slot({
  tip,
  children,
}: {
  readonly tip: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="group/slot relative">
      {children}
      <span
        role="presentation"
        className="pointer-events-none fixed z-[75] -mt-[34px] ml-[46px] whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground opacity-0 shadow-lg transition-opacity delay-300 group-hover/slot:opacity-100"
      >
        {tip}
      </span>
    </div>
  );
}

function Switch({ on }: { readonly on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? "bg-primary" : "bg-muted-foreground/40"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-all ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </span>
  );
}

const ROW =
  "group/row flex h-11 w-full items-center gap-3 px-4 text-left text-[15px] text-foreground hover:bg-muted";

export default function DrawingToolbar(props: DrawingToolbarProps) {
  const {
    tool,
    onToolChange,
    cursor,
    onCursor,
    favorites,
    onToggleFavorite,
    locks,
    hides,
  } = props;
  const [lastInGroup, setLastInGroup] = useState<
    Readonly<Record<string, DrawingType>>
  >({});
  const [lastMagnet, setLastMagnet] =
    useState<Exclude<MagnetMode, "off">>("weak");

  const arrowButton = (
    label: string,
    toggle: (event: { currentTarget: Element }) => void,
  ) => (
    <button
      type="button"
      aria-label={`${label}: more options`}
      title={`${label}: more options`}
      onClick={toggle}
      className="absolute -right-1 top-1/2 flex h-6 w-3.5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover/slot:opacity-100 focus:opacity-100"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
    </button>
  );

  const toolRow = (
    definition: ToolDefinition,
    choose: (type: DrawingType) => void,
    close: () => void,
  ) => {
    const favorite = favorites.includes(definition.type);
    const shortcut = shortcutLabel(definition);
    return (
      <div
        key={definition.type}
        className={`group/row relative flex items-center hover:bg-muted ${
          tool === definition.type ? "bg-primary/10" : ""
        }`}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            choose(definition.type);
            close();
          }}
          className="flex h-11 min-w-0 flex-1 items-center gap-3 whitespace-nowrap px-4 text-left text-[15px] text-foreground"
        >
          <ToolIcon type={definition.type} className="h-7 w-7 shrink-0" />
          <span className="truncate">{definition.label}</span>
          {definition.help && (
            <span
              title={definition.help}
              className="shrink-0 text-muted-foreground"
            >
              <CircleHelp className="h-4 w-4" />
            </span>
          )}
          <span className="flex-1" />
          {shortcut && (
            <span className="shrink-0 text-[13px] tracking-wide text-muted-foreground">
              {shortcut}
            </span>
          )}
        </button>
        <button
          type="button"
          aria-label={
            favorite
              ? `Remove ${definition.label} from favorites`
              : `Add ${definition.label} to favorites`
          }
          aria-pressed={favorite}
          title={favorite ? "Remove from favorites" : "Add to favorites"}
          onClick={() => onToggleFavorite(definition.type)}
          className={`mr-3 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted ${
            favorite
              ? "opacity-100"
              : "opacity-0 focus:opacity-100 group-hover/row:opacity-100"
          }`}
        >
          <Star
            className={favorite ? "h-4 w-4 text-warning" : "h-4 w-4"}
            fill={favorite ? "currentColor" : "none"}
            stroke="currentColor"
          />
        </button>
      </div>
    );
  };

  const activeLockAll = locks.drawings && locks.indicators;
  const activeHideAll = hides.drawings && hides.indicators && hides.positions;

  return (
    <nav
      aria-label="Drawing tools"
      className="flex w-[52px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto overflow-x-hidden border-r border-border bg-card py-2"
    >
      {/* Cursors */}
      <Slot tip="Cursors">
        <ToolbarButton
          label={`Cursor: ${cursor === "eraser" ? "Eraser" : CURSORS.find((entry) => entry.id === cursor)!.label}`}
          active={tool === null}
          onClick={() => onToolChange(null)}
          className={BUTTON}
        >
          <CursorIcon kind={cursor} className={ICON} />
        </ToolbarButton>
        <Menu
          side="right"
          trigger={({ toggle }) => arrowButton("Cursors", toggle)}
        >
          {(close) => (
            <div className="w-[300px] py-1">
              {CURSORS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onCursor(entry.id);
                    onToolChange(null);
                    close();
                  }}
                  className={`${ROW} ${cursor === entry.id ? "bg-primary/10 font-semibold" : ""}`}
                >
                  <CursorIcon kind={entry.id} className="h-7 w-7 shrink-0" />
                  {entry.label}
                </button>
              ))}
              <div className="mx-3 my-1 h-px bg-border" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCursor("eraser");
                  onToolChange(null);
                  close();
                }}
                className={`${ROW} ${cursor === "eraser" ? "bg-primary/10 font-semibold" : ""}`}
              >
                <CursorIcon kind="eraser" className="h-7 w-7 shrink-0" />
                Eraser
              </button>
              <div className="mx-3 my-1 h-px bg-border" />
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={props.valuesTooltip}
                onClick={() => props.onValuesTooltip(!props.valuesTooltip)}
                className={ROW}
              >
                <span className="flex-1">Values tooltip on long press</span>
                <Switch on={props.valuesTooltip} />
              </button>
            </div>
          )}
        </Menu>
      </Slot>
      <Divider vertical={false} />

      {GROUP_ORDER.map((group) => {
        const sections = SECTIONS[group];
        const all = sections.flatMap((section) => section.tools);
        const current = lastInGroup[group] ?? all[0]!.type;
        const active =
          tool !== null && all.some((entry) => entry.type === tool);
        const shown = active && tool ? tool : current;
        const definition = getToolDefinition(shown);
        const choose = (type: DrawingType): void => {
          setLastInGroup((previous) => ({ ...previous, [group]: type }));
          onToolChange(type);
        };
        const shortcut = shortcutLabel(definition);
        return (
          <Slot key={group} tip={GROUP_TIPS[group]}>
            <ToolbarButton
              label={`${definition.label}${shortcut ? ` (${shortcut})` : ""}`}
              active={active}
              onClick={() => (active ? onToolChange(null) : choose(current))}
              className={BUTTON}
            >
              <ToolIcon type={shown} className={ICON} />
            </ToolbarButton>
            <Menu
              side="right"
              trigger={({ toggle }) => arrowButton(GROUP_TIPS[group], toggle)}
            >
              {(close) => (
                <div className="w-max min-w-[340px] max-w-[440px] py-1">
                  {sections.map((section, index) => (
                    <div key={section.title || "main"}>
                      {index > 0 && (
                        <div className="mx-3 my-1 h-px bg-border" />
                      )}
                      {section.title && (
                        <p className="px-4 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {section.title}
                        </p>
                      )}
                      {section.tools.map((entry) =>
                        toolRow(entry, choose, close),
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Menu>
          </Slot>
        );
      })}

      {/* Emoji */}
      <Slot tip="Emoji">
        <ToolbarButton
          label={`Emoji ${props.emoji}`}
          active={tool === "emoji"}
          onClick={() => onToolChange(tool === "emoji" ? null : "emoji")}
          className={BUTTON}
        >
          <ToolIcon type="emoji" className={ICON} />
        </ToolbarButton>
        <Menu
          side="right"
          trigger={({ toggle }) => arrowButton("Emoji", toggle)}
        >
          {(close) => (
            <div className="w-[280px] p-3">
              <p className="pb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Emoji
              </p>
              <div className="grid grid-cols-6 gap-1">
                {EMOJIS.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    aria-label={`Place ${entry}`}
                    onClick={() => {
                      props.onEmoji(entry);
                      onToolChange("emoji");
                      close();
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-md text-[22px] hover:bg-muted ${
                      props.emoji === entry ? "bg-primary/10" : ""
                    }`}
                  >
                    {entry}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Menu>
      </Slot>

      <Divider vertical={false} />
      <Slot tip="Measure">
        <ToolbarButton
          label="Measure"
          active={tool === "measure"}
          onClick={() => onToolChange(tool === "measure" ? null : "measure")}
          className={BUTTON}
        >
          <ToolIcon type="measure" className={ICON} />
        </ToolbarButton>
      </Slot>
      <Slot tip="Zoom in">
        <ToolbarButton
          label="Zoom in"
          onClick={() => props.onZoom("in")}
          className={BUTTON}
        >
          <ZoomIn className={ICON} strokeWidth={1.5} />
        </ToolbarButton>
      </Slot>
      <Slot tip="Zoom out">
        <ToolbarButton
          label="Zoom out"
          onClick={() => props.onZoom("out")}
          className={BUTTON}
        >
          <ZoomOut className={ICON} strokeWidth={1.5} />
        </ToolbarButton>
      </Slot>
      <Divider vertical={false} />

      {/* Magnet */}
      <Slot tip="Magnets">
        <ToolbarButton
          label="Magnet mode: snap to open, high, low, close"
          active={props.magnet !== "off"}
          onClick={() => {
            if (props.magnet === "off") {
              props.onMagnet(lastMagnet);
            } else {
              props.onMagnet("off");
            }
          }}
          className={BUTTON}
        >
          <Magnet className={ICON} strokeWidth={1.5} />
        </ToolbarButton>
        <Menu
          side="right"
          trigger={({ toggle }) => arrowButton("Magnets", toggle)}
        >
          {(close) => (
            <div className="w-[300px] py-1">
              {(["weak", "strong"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setLastMagnet(mode);
                    props.onMagnet(mode);
                    close();
                  }}
                  className={`${ROW} ${props.magnet === mode ? "bg-primary/10 font-semibold" : ""}`}
                >
                  <Magnet className="h-6 w-6 shrink-0" strokeWidth={1.5} />
                  {mode === "weak" ? "Weak magnet" : "Strong magnet"}
                </button>
              ))}
              <div className="mx-3 my-1 h-px bg-border" />
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={props.snapIndicators}
                onClick={() => props.onSnapIndicators(!props.snapIndicators)}
                className={ROW}
              >
                <span className="flex-1">Snap to indicators</span>
                <Switch on={props.snapIndicators} />
              </button>
            </div>
          )}
        </Menu>
        {props.magnet !== "off" && !props.magnetNoticeSeen && (
          <div
            role="status"
            className="fixed z-[76] -mt-10 ml-[52px] w-[340px] rounded-xl bg-primary p-4 text-[14px] leading-5 text-primary-foreground shadow-2xl"
          >
            Magnet mode is On. Drawing anchors will be snapped to OHLC prices or
            indicator values.
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={props.onDismissMagnetNotice}
                className="rounded-lg bg-white/20 px-3 py-1.5 font-semibold hover:bg-white/30"
              >
                Got it!
              </button>
            </div>
          </div>
        )}
      </Slot>

      <Slot tip="Stay in drawing mode">
        <ToolbarButton
          label="Stay in drawing mode"
          active={props.keepDrawing}
          onClick={props.onKeepDrawing}
          className={BUTTON}
        >
          {props.keepDrawing ? (
            <Pin className={ICON} strokeWidth={1.5} />
          ) : (
            <PinOff className={ICON} strokeWidth={1.5} />
          )}
        </ToolbarButton>
      </Slot>

      {/* Lock */}
      <Slot tip="Lock">
        <ToolbarButton
          label={
            locks.drawings || locks.indicators
              ? "Unlock all"
              : "Lock all drawings"
          }
          active={locks.drawings || locks.indicators}
          onClick={() =>
            props.onLocks(
              locks.drawings || locks.indicators
                ? { drawings: false, indicators: false }
                : { drawings: true, indicators: false },
            )
          }
          className={BUTTON}
        >
          {locks.drawings || locks.indicators ? (
            <Lock className={ICON} strokeWidth={1.5} />
          ) : (
            <Unlock className={ICON} strokeWidth={1.5} />
          )}
        </ToolbarButton>
        <Menu
          side="right"
          trigger={({ toggle }) => arrowButton("Lock", toggle)}
        >
          {(close) => (
            <div className="w-[240px] py-1">
              {(
                [
                  [
                    "Lock drawings",
                    locks.drawings,
                    () =>
                      props.onLocks({ ...locks, drawings: !locks.drawings }),
                  ],
                  [
                    "Lock indicators",
                    locks.indicators,
                    () =>
                      props.onLocks({
                        ...locks,
                        indicators: !locks.indicators,
                      }),
                  ],
                  [
                    "Lock all",
                    activeLockAll,
                    () =>
                      props.onLocks(
                        activeLockAll
                          ? { drawings: false, indicators: false }
                          : { drawings: true, indicators: true },
                      ),
                  ],
                ] as const
              ).map(([label, on, action]) => (
                <button
                  key={label}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => {
                    action();
                    close();
                  }}
                  className={`${ROW} h-10 text-[14px] ${on ? "font-semibold" : ""}`}
                >
                  <span className="flex-1">{label}</span>
                  {on && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </Menu>
      </Slot>

      {/* Hide */}
      <Slot tip="Hide">
        <ToolbarButton
          label={hides.drawings ? "Show all drawings" : "Hide all drawings"}
          active={hides.drawings || hides.indicators || hides.positions}
          onClick={() => props.onHides({ ...hides, drawings: !hides.drawings })}
          className={BUTTON}
        >
          {hides.drawings ? (
            <EyeOff className={ICON} strokeWidth={1.5} />
          ) : (
            <Eye className={ICON} strokeWidth={1.5} />
          )}
        </ToolbarButton>
        <Menu
          side="right"
          trigger={({ toggle }) => arrowButton("Hide", toggle)}
        >
          {(close) => (
            <div className="w-[270px] py-1">
              {(
                [
                  [
                    "Hide drawings",
                    hides.drawings,
                    () =>
                      props.onHides({ ...hides, drawings: !hides.drawings }),
                  ],
                  [
                    "Hide indicators",
                    hides.indicators,
                    () =>
                      props.onHides({
                        ...hides,
                        indicators: !hides.indicators,
                      }),
                  ],
                  [
                    "Hide positions and orders",
                    hides.positions,
                    () =>
                      props.onHides({ ...hides, positions: !hides.positions }),
                  ],
                  [
                    "Hide all",
                    activeHideAll,
                    () =>
                      props.onHides(
                        activeHideAll
                          ? {
                              drawings: false,
                              indicators: false,
                              positions: false,
                            }
                          : {
                              drawings: true,
                              indicators: true,
                              positions: true,
                            },
                      ),
                  ],
                ] as const
              ).map(([label, on, action]) => (
                <button
                  key={label}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => {
                    action();
                    close();
                  }}
                  className={`${ROW} h-10 text-[14px] ${on ? "font-semibold" : ""}`}
                >
                  <span className="flex-1">{label}</span>
                  {on && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </Menu>
      </Slot>

      {/* Remove */}
      <Slot tip="Remove objects">
        <ToolbarButton
          label={`Remove ${props.drawingCount} drawing${props.drawingCount === 1 ? "" : "s"}`}
          disabled={props.drawingCount === 0}
          onClick={() => props.onRemove("drawings")}
          className={BUTTON}
        >
          <Trash2 className={ICON} strokeWidth={1.5} />
        </ToolbarButton>
        <Menu
          side="right"
          trigger={({ toggle }) => arrowButton("Remove", toggle)}
        >
          {(close) => {
            const drawings = `${props.drawingCount} drawing${props.drawingCount === 1 ? "" : "s"}`;
            const indicators = `${props.indicatorCount} indicator${props.indicatorCount === 1 ? "" : "s"}`;
            return (
              <div className="w-[300px] py-1">
                {(
                  [
                    [
                      `Remove ${drawings}`,
                      "drawings",
                      props.drawingCount === 0,
                    ],
                    [
                      `Remove ${indicators}`,
                      "indicators",
                      props.indicatorCount === 0,
                    ],
                    [
                      `Remove ${drawings} & ${indicators}`,
                      "both",
                      props.drawingCount + props.indicatorCount === 0,
                    ],
                  ] as const
                ).map(([label, what, disabled]) => (
                  <button
                    key={what}
                    type="button"
                    role="menuitem"
                    disabled={disabled}
                    onClick={() => {
                      props.onRemove(what);
                      close();
                    }}
                    className={`${ROW} h-10 text-[14px] disabled:opacity-40`}
                  >
                    {label}
                  </button>
                ))}
                <div className="mx-3 my-1 h-px bg-border" />
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={props.alwaysRemoveLocked}
                  onClick={() =>
                    props.onAlwaysRemoveLocked(!props.alwaysRemoveLocked)
                  }
                  className={`${ROW} h-10 text-[14px]`}
                >
                  <span className="flex-1">Always remove locked drawings</span>
                  <Switch on={props.alwaysRemoveLocked} />
                </button>
              </div>
            );
          }}
        </Menu>
      </Slot>

      {props.onCollapse && (
        <>
          <span aria-hidden className="my-1 h-px w-8 bg-border" />
          <Slot tip="Hide drawing toolbar">
            <ToolbarButton
              label="Hide drawing toolbar"
              onClick={props.onCollapse}
              className={BUTTON}
            >
              <ChevronsLeft className={ICON} strokeWidth={1.5} />
            </ToolbarButton>
          </Slot>
        </>
      )}
    </nav>
  );
}

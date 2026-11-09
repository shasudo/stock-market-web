"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  DRAWING_COLORS,
  DRAWING_VISIBILITY_SCOPES,
  getToolDefinition,
  type DashStyle,
  type Drawing,
  type DrawingPoint,
  type DrawingVisibilityScope,
} from "@/lib/chart/drawings";
import type { ChartTimeframe } from "@/lib/market/chart-candles";
import { TIMEFRAME_OPTIONS } from "./TopToolbar";

interface DrawingSettingsDialogProps {
  readonly drawing: Drawing;
  readonly timeframe: ChartTimeframe;
  readonly onApply: (drawing: Drawing) => void;
  readonly onClose: () => void;
}

type Section = "style" | "coordinates" | "visibility";

const SECTIONS: readonly { id: Section; label: string }[] = [
  { id: "style", label: "Style" },
  { id: "coordinates", label: "Coordinates" },
  { id: "visibility", label: "Visibility" },
];

interface PointDraft {
  time: string;
  price: string;
}

function toInputValue(epochSec: number): string {
  return new Date(epochSec * 1000).toISOString().slice(0, 16);
}

function fromInputValue(value: string): number | null {
  const ms = Date.parse(`${value}:00Z`);
  return Number.isNaN(ms) ? null : Math.round(ms / 1000);
}

function timeframeLabel(timeframe: ChartTimeframe): string {
  return (
    TIMEFRAME_OPTIONS.find((option) => option.id === timeframe)?.label ??
    timeframe
  );
}

export default function DrawingSettingsDialog({
  drawing,
  timeframe,
  onApply,
  onClose,
}: DrawingSettingsDialogProps) {
  const [section, setSection] = useState<Section>("style");
  const [color, setColor] = useState(drawing.color);
  const [textColor, setTextColor] = useState(
    drawing.textColor ?? drawing.color,
  );
  const [width, setWidth] = useState(drawing.width);
  const [dash, setDash] = useState<DashStyle>(drawing.dash);
  const [text, setText] = useState(drawing.text ?? "");
  const [points, setPoints] = useState<PointDraft[]>(() =>
    drawing.points.map((point) => ({
      time: toInputValue(point.t),
      price: String(point.p),
    })),
  );
  const [visibleOn, setVisibleOn] = useState<DrawingVisibilityScope>(
    drawing.visibleOn,
  );
  const [hidden, setHidden] = useState(drawing.hidden);

  const supportsText =
    getToolDefinition(drawing.type).text === "prompt" ||
    drawing.text !== undefined;

  const parsedPoints: DrawingPoint[] | null = (() => {
    const next: DrawingPoint[] = [];
    for (const point of points) {
      const t = fromInputValue(point.time);
      const p = Number(point.price);
      if (t === null || t <= 0 || !Number.isFinite(p)) return null;
      next.push({ t, p });
    }
    return next.length === points.length && next.length > 0 ? next : null;
  })();

  const apply = (): void => {
    if (!parsedPoints) return;
    onApply({
      ...drawing,
      color,
      textColor,
      width,
      dash,
      ...(supportsText && text.trim()
        ? { text: text.trim() }
        : drawing.text !== undefined
          ? { text: drawing.text }
          : {}),
      points: parsedPoints,
      visibleOn,
      visibleTimeframe: visibleOn === "all" ? null : timeframe,
      hidden,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 px-4 pt-[8vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${getToolDefinition(drawing.type).label} settings`}
        className="flex max-h-[84vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-[16px] font-bold text-foreground">
            {getToolDefinition(drawing.type).label}
          </h2>
          <button
            type="button"
            aria-label="Close drawing settings"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Drawing settings sections"
            className="w-36 shrink-0 border-r border-border p-2"
          >
            {SECTIONS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSection(entry.id)}
                aria-current={section === entry.id}
                className={`block w-full rounded px-3 py-2 text-left text-[13px] ${
                  section === entry.id
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4">
            {section === "style" && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="pb-2 text-[13px] text-muted-foreground">
                    Line colour
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {DRAWING_COLORS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-label={`Line colour ${option}`}
                        aria-pressed={color === option}
                        onClick={() => setColor(option)}
                        className={`h-6 w-6 rounded-full border border-border ${
                          color === option
                            ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                            : ""
                        }`}
                        style={{ backgroundColor: option }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="pb-2 text-[13px] text-muted-foreground">
                    Text colour
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {DRAWING_COLORS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-label={`Text colour ${option}`}
                        aria-pressed={textColor === option}
                        onClick={() => setTextColor(option)}
                        className={`h-6 w-6 rounded-full border border-border ${
                          textColor === option
                            ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                            : ""
                        }`}
                        style={{ backgroundColor: option }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[13px] text-muted-foreground">
                    Width
                  </span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-label={`Line width ${option}px`}
                        aria-pressed={width === option}
                        onClick={() => setWidth(option)}
                        className={`flex h-7 w-9 items-center justify-center gap-1 rounded hover:bg-muted ${
                          width === option ? "bg-primary/10" : ""
                        }`}
                      >
                        <span
                          aria-hidden
                          className="block w-3 rounded bg-foreground"
                          style={{ height: option }}
                        />
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[13px] text-muted-foreground">
                    Style
                  </span>
                  <select
                    aria-label="Line style"
                    value={dash}
                    onChange={(event) =>
                      setDash(event.target.value as DashStyle)
                    }
                    className="rounded border border-border bg-card px-2 py-1.5 text-[13px] outline-none focus:border-primary"
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </div>
                {supportsText && (
                  <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
                    Text
                    <input
                      value={text}
                      maxLength={120}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="Label shown on the drawing"
                      className="rounded border border-border px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary"
                    />
                  </label>
                )}
              </div>
            )}
            {section === "coordinates" && (
              <div className="flex flex-col gap-2">
                {points.map((point, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-[13px] text-muted-foreground">
                      Point {index + 1}
                    </span>
                    <input
                      type="datetime-local"
                      aria-label={`Point ${index + 1} time`}
                      value={point.time}
                      onChange={(event) =>
                        setPoints((current) =>
                          current.map((entry, position) =>
                            position === index
                              ? { ...entry, time: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      className="min-w-0 flex-1 rounded border border-border px-2 py-1.5 text-[13px] outline-none focus:border-primary"
                    />
                    <input
                      aria-label={`Point ${index + 1} price`}
                      inputMode="decimal"
                      value={point.price}
                      onChange={(event) =>
                        setPoints((current) =>
                          current.map((entry, position) =>
                            position === index
                              ? { ...entry, price: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      placeholder="Price"
                      className="w-28 shrink-0 rounded border border-border px-2 py-1.5 text-[13px] outline-none focus:border-primary"
                    />
                  </div>
                ))}
                {parsedPoints === null && (
                  <p className="text-[12px] text-error">
                    Every point needs a valid date and price.
                  </p>
                )}
              </div>
            )}
            {section === "visibility" && (
              <div className="flex flex-col gap-1">
                {DRAWING_VISIBILITY_SCOPES.map((entry) => (
                  <label
                    key={entry.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-foreground hover:bg-muted"
                  >
                    <input
                      type="radio"
                      name="drawing-visibility"
                      checked={visibleOn === entry.id}
                      onChange={() => setVisibleOn(entry.id)}
                      className="accent-[#2962FF]"
                    />
                    {entry.label}
                  </label>
                ))}
                <p className="px-2 pt-1 text-[12px] text-muted-foreground">
                  Interval choices pin to {timeframeLabel(timeframe)}.
                </p>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-foreground hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={hidden}
                    onChange={(event) => setHidden(event.target.checked)}
                    className="accent-[#2962FF]"
                  />
                  Hidden
                </label>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-4 py-1.5 text-[13px] text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={parsedPoints === null}
            className="rounded bg-foreground px-4 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-foreground/90 disabled:opacity-40"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

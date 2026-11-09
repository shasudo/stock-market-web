"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { measureTerm } from "@/lib/screener/catalog";
import { newId, type Clause, type TimeframeUnit } from "@/lib/screener/scan-types";
import { cn } from "@/lib/utils";

const WIDTH = 520;
const HEIGHT = 220;
const PAD = 24;

interface DrawPatternProps {
  readonly onClose: () => void;
  readonly onGenerate: (clauses: Clause[]) => void;
}

/**
 * Draw the shape the closes should make over the last few candles; each
 * rising or falling leg becomes a close-vs-close filter.
 */
export function DrawPattern({ onClose, onGenerate }: DrawPatternProps) {
  const [count, setCount] = useState(7);
  const [points, setPoints] = useState<number[]>(() => Array.from({ length: 7 }, () => 0.5));
  const [timeframe, setTimeframe] = useState<TimeframeUnit>("day");
  const [field, setField] = useState<"close" | "high" | "low">("close");
  const drawing = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const xAt = (index: number): number => PAD + (index * (WIDTH - PAD * 2)) / Math.max(1, count - 1);

  const resize = (next: number): void => {
    setCount(next);
    setPoints((current) =>
      Array.from({ length: next }, (_, index) => current[Math.round((index * (current.length - 1)) / Math.max(1, next - 1))] ?? 0.5),
    );
  };

  const paint = (event: React.PointerEvent): void => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const index = Math.round(((x - PAD) / (WIDTH - PAD * 2)) * (count - 1));
    if (index < 0 || index >= count) return;
    const level = Math.min(1, Math.max(0, 1 - (y - PAD) / (HEIGHT - PAD * 2)));
    setPoints((current) => current.map((value, position) => (position === index ? level : value)));
  };

  const legs = points.slice(1).map((value, index) => {
    const delta = value - points[index]!;
    return Math.abs(delta) < 0.04 ? 0 : Math.sign(delta);
  });

  const generate = (): void => {
    const clauses: Clause[] = [];
    legs.forEach((direction, index) => {
      if (direction === 0) return;
      // Point index+1 is newer than index; the last point is the latest candle.
      const newer = count - 1 - (index + 1);
      const older = newer + 1;
      clauses.push({
        kind: "clause",
        id: newId("c"),
        enabled: true,
        left: { terms: [measureTerm(field, timeframe, newer)], ops: [] },
        op: direction > 0 ? ">" : "<",
        right: { terms: [measureTerm(field, timeframe, older)], ops: [] },
      });
    });
    onGenerate(clauses);
  };

  const path = points
    .map((value, index) => `${index === 0 ? "M" : "L"}${xAt(index)},${PAD + (1 - value) * (HEIGHT - PAD * 2)}`)
    .join(" ");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-[600px] rounded-2xl bg-card p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-extrabold text-foreground">Draw a price pattern</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Drag across the grid to sketch how price should move. The right edge is the latest candle.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
          <label className="flex items-center gap-2">
            Candles
            <input type="range" min={3} max={15} value={count} onChange={(event) => resize(Number(event.target.value))} />
            <span className="w-5 font-mono">{count}</span>
          </label>
          <select
            value={timeframe}
            onChange={(event) => setTimeframe(event.target.value as TimeframeUnit)}
            className="rounded-md border border-border px-2 py-1"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <select
            value={field}
            onChange={(event) => setField(event.target.value as "close" | "high" | "low")}
            className="rounded-md border border-border px-2 py-1"
          >
            <option value="close">Close</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
          <button
            type="button"
            onClick={() => setPoints(points.map(() => 0.5))}
            className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
          >
            Reset
          </button>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="mt-3 w-full touch-none select-none rounded-xl border border-border bg-muted"
          onPointerDown={(event) => {
            drawing.current = true;
            (event.target as Element).setPointerCapture?.(event.pointerId);
            paint(event);
          }}
          onPointerMove={(event) => drawing.current && paint(event)}
          onPointerUp={() => {
            drawing.current = false;
          }}
        >
          {points.map((_, index) => (
            <line key={index} x1={xAt(index)} x2={xAt(index)} y1={PAD / 2} y2={HEIGHT - PAD / 2} stroke="currentColor" className="text-border" />
          ))}
          <path d={path} fill="none" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" className="text-primary" />
          {points.map((value, index) => (
            <circle
              key={index}
              cx={xAt(index)}
              cy={PAD + (1 - value) * (HEIGHT - PAD * 2)}
              r={5}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={2}
              className="text-primary"
              style={index === count - 1 ? undefined : { fill: "hsl(var(--card))" }}
            />
          ))}
        </svg>

        <div className="mt-3 flex flex-wrap gap-1">
          {legs.map((direction, index) => (
            <span
              key={index}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                direction > 0 ? "bg-success/10 text-success" : direction < 0 ? "bg-error/10 text-error" : "bg-muted text-muted-foreground",
              )}
            >
              {direction > 0 ? "up" : direction < 0 ? "down" : "flat (ignored)"}
            </span>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            type="button"
            disabled={legs.every((direction) => direction === 0)}
            onClick={generate}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            Generate filters
          </button>
        </div>
      </div>
    </div>
  );
}

import type { DashStyle, DrawingPoint } from "../drawings";

export type Segment = [number, number, number, number];

export interface BarData {
  readonly epochs: readonly number[];
  readonly opens: readonly number[];
  readonly highs: readonly number[];
  readonly lows: readonly number[];
  readonly closes: readonly number[];
  readonly volumes: readonly number[];
}

export interface XY {
  readonly x: number;
  readonly y: number;
}

/** Everything the renderer needs from the chart, kept free of chart types. */
export interface Geometry {
  readonly width: number;
  readonly height: number;
  toXY(point: DrawingPoint): XY | null;
  /** Bars between two times, for the measure tool. */
  bars(fromTime: number, toTime: number): number;
  /** Least-squares fit of the closes between two times, for the regression channel. */
  regression?(
    fromTime: number,
    toTime: number,
  ): {
    readonly start: DrawingPoint;
    readonly end: DrawingPoint;
    readonly sigma: number;
  } | null;
  /** The plotted candles, for tools that read price history (VWAP, volume profile, bar patterns). */
  readonly data?: BarData;
  /** Ask the chart to redraw, e.g. once an image has finished loading. */
  invalidate?(): void;
}

export interface Shapes {
  readonly segments: readonly (readonly [number, number, number, number])[];
  /** Areas that count as a hit when the cursor is inside. */
  readonly boxes: readonly (readonly [number, number, number, number])[];
  readonly handles: readonly XY[];
}

export type Hit =
  | { readonly kind: "handle"; readonly index: number }
  | { readonly kind: "body" };

export const DASH: Readonly<Record<DashStyle, number[]>> = {
  solid: [],
  dashed: [8, 5],
  dotted: [2, 4],
};

export function formatPrice(value: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function withAlpha(color: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = parseInt(match[1]!, 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

/**
 * Clips the line through `a` and `b` to the pane. `from`/`to` choose how far it
 * runs past each point: 0 stops at the point, Infinity runs to the edge.
 */
export function clipLine(
  a: XY,
  b: XY,
  extendBackward: boolean,
  extendForward: boolean,
  width: number,
  height: number,
): [number, number, number, number] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return [a.x, a.y, b.x, b.y];

  let low = extendBackward ? -Infinity : 0;
  let high = extendForward ? Infinity : 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const ratio = q / p;
    if (p < 0) {
      if (ratio > high) return false;
      if (ratio > low) low = ratio;
    } else {
      if (ratio < low) return false;
      if (ratio < high) high = ratio;
    }
    return true;
  };
  const margin = 2;
  const visible =
    clip(-dx, a.x + margin) &&
    clip(dx, width + margin - a.x) &&
    clip(-dy, a.y + margin) &&
    clip(dy, height + margin - a.y);
  if (!visible || low > high) return [a.x, a.y, b.x, b.y];
  return [a.x + low * dx, a.y + low * dy, a.x + high * dx, a.y + high * dy];
}

export function rectEdges(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): [number, number, number, number][] {
  return [
    [x1, y1, x2, y1],
    [x2, y1, x2, y2],
    [x2, y2, x1, y2],
    [x1, y2, x1, y1],
  ];
}

export function angleDegrees(a: XY, b: XY): number {
  return (Math.atan2(a.y - b.y, b.x - a.x) * 180) / Math.PI;
}

export function applyStroke(
  ctx: CanvasRenderingContext2D,
  color: string,
  width: number,
  dash: DashStyle,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(DASH[dash]);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
}

export function line(
  ctx: CanvasRenderingContext2D,
  [x1, y1, x2, y2]: readonly [number, number, number, number],
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function tag(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  background: string,
  align: "left" | "right" | "center" = "left",
): void {
  ctx.font = "600 11px Inter, system-ui, sans-serif";
  const lines = text.split("\n");
  const textWidth = Math.max(
    ...lines.map((entry) => ctx.measureText(entry).width),
  );
  const boxWidth = textWidth + 12;
  const boxHeight = lines.length * 15 + 6;
  const left =
    align === "right"
      ? x - boxWidth
      : align === "center"
        ? x - boxWidth / 2
        : x;
  ctx.setLineDash([]);
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(left, y - boxHeight / 2, boxWidth, boxHeight, 4);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  lines.forEach((entry, index) => {
    ctx.fillText(entry, left + 6, y - boxHeight / 2 + 3 + 7.5 + index * 15);
  });
}

export function formatDuration(seconds: number): string {
  const total = Math.abs(seconds);
  const days = Math.floor(total / 86_400);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function percent(from: number, to: number): string {
  if (from === 0) return "0.00%";
  const value = ((to - from) / from) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export const GOLDEN = 1.618033988749895;

export function distance(a: XY, b: XY): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a: XY, b: XY): XY {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function polyline(
  ctx: CanvasRenderingContext2D,
  points: readonly XY[],
  close = false,
): void {
  if (points.length === 0) return;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  if (close) ctx.closePath();
}

export function segmentsOf(points: readonly XY[], close = false): Segment[] {
  const segments: Segment[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    segments.push([from.x, from.y, to.x, to.y]);
  }
  if (close && points.length > 2) {
    const first = points[0]!;
    const last = points[points.length - 1]!;
    segments.push([last.x, last.y, first.x, first.y]);
  }
  return segments;
}

export function arrowHead(
  ctx: CanvasRenderingContext2D,
  from: XY,
  to: XY,
  size = 11,
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - size * Math.cos(angle - Math.PI / 7),
    to.y - size * Math.sin(angle - Math.PI / 7),
  );
  ctx.lineTo(
    to.x - size * Math.cos(angle + Math.PI / 7),
    to.y - size * Math.sin(angle + Math.PI / 7),
  );
  ctx.closePath();
  ctx.fill();
}

/** Word-wrapped text lines for a box of the given width. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

export function inBox(
  box: readonly [number, number, number, number],
  x: number,
  y: number,
): boolean {
  return (
    x >= box[0] && x <= box[0] + box[2] && y >= box[1] && y <= box[1] + box[3]
  );
}

/** What a tool contributes: where it can be hit, and how it is drawn. */
export interface ShapeHandler {
  shapes(
    drawing: {
      readonly points: readonly DrawingPoint[];
      readonly text?: string;
    },
    pixels: readonly XY[],
    geometry: Geometry,
  ): Shapes | null;
  render(
    ctx: CanvasRenderingContext2D,
    drawing: {
      readonly id: string;
      readonly type: string;
      readonly points: readonly DrawingPoint[];
      readonly color: string;
      readonly width: number;
      readonly dash: DashStyle;
      readonly text?: string;
    },
    pixels: readonly XY[],
    geometry: Geometry,
  ): void;
}

/** The fib levels shared by the fibonacci tools, with their usual colours. */
export const FIB_COLORS = [
  "#787B86",
  "#F23645",
  "#FF9800",
  "#4CAF50",
  "#089981",
  "#00BCD4",
  "#2962FF",
  "#9C27B0",
  "#E91E63",
  "#787B86",
  "#F23645",
];

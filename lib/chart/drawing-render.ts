import { FIB_LEVELS, type Drawing, type DrawingPoint } from "./drawings";
import { SHAPE_HANDLERS } from "./shapes";
import {
  angleDegrees,
  applyStroke,
  clipLine,
  formatDuration,
  formatPrice,
  line,
  percent,
  rectEdges,
  tag,
  withAlpha,
  type Geometry,
  type Hit,
  type Segment,
  type Shapes,
  type XY,
} from "./shapes/utils";

export { clipLine, formatPrice };
export type { Geometry, Hit, Shapes, XY };

const HANDLE_RADIUS = 5;
const HANDLE_HIT = 9;
const LINE_HIT = 6;

interface ChannelGeometry {
  readonly a: XY;
  readonly b: XY;
  readonly a2: XY;
  readonly b2: XY;
}

function channelGeometry(points: readonly XY[]): ChannelGeometry | null {
  const [a, b, c] = points;
  if (!a || !b || !c) return null;
  const run = b.x - a.x;
  const lineAtC = run === 0 ? a.y : a.y + ((b.y - a.y) * (c.x - a.x)) / run;
  const offset = c.y - lineAtC;
  return {
    a,
    b,
    a2: { x: a.x, y: a.y + offset },
    b2: { x: b.x, y: b.y + offset },
  };
}

interface TradeGeometry {
  readonly left: number;
  readonly right: number;
  readonly entryY: number;
  readonly targetY: number;
  readonly stopY: number;
}

function tradeGeometry(points: readonly XY[]): TradeGeometry | null {
  const [entry, target, stop] = points;
  if (!entry || !target || !stop) return null;
  const left = entry.x;
  const right = Math.max(target.x, stop.x, left + 80);
  return { left, right, entryY: entry.y, targetY: target.y, stopY: stop.y };
}

function toPixels(drawing: Drawing, geometry: Geometry): XY[] | null {
  const pixels: XY[] = [];
  for (const point of drawing.points) {
    const xy = geometry.toXY(point);
    if (!xy) return null;
    pixels.push(xy);
  }
  return pixels;
}

function textBox(drawing: Drawing, at: XY): [number, number, number, number] {
  const label = drawing.text ?? "";
  const width = Math.max(40, label.length * 7 + 14);
  return [at.x, at.y - 24, width, 24];
}

interface Pitchfork {
  readonly median: Segment;
  readonly upper: Segment;
  readonly lower: Segment;
  readonly fill: readonly XY[];
}

/**
 * Andrews' pitchfork family. The median runs from the origin through the
 * midpoint of the two swing points and the outer tines run parallel to it.
 * Schiff moves the origin halfway toward the second point in price, the
 * modified Schiff moves it halfway in time as well, and the inside fork pulls
 * the tines to half the width.
 */
function pitchfork(
  type: Drawing["type"],
  points: readonly XY[],
  width: number,
  height: number,
): Pitchfork | null {
  const [p1, p2, p3] = points;
  if (!p1 || !p2 || !p3) return null;
  const mid = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
  const origin =
    type === "schiff"
      ? { x: p1.x, y: (p1.y + p2.y) / 2 }
      : type === "modschiff"
        ? { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
        : p1;
  const direction = { x: mid.x - origin.x, y: mid.y - origin.y };
  if (direction.x === 0 && direction.y === 0) return null;

  const spread = type === "insidefork" ? 0.5 : 1;
  const start = (anchor: XY): XY => ({
    x: mid.x + (anchor.x - mid.x) * spread,
    y: mid.y + (anchor.y - mid.y) * spread,
  });
  const a = start(p2);
  const b = start(p3);
  const ray = (from: XY): Segment =>
    clipLine(
      from,
      { x: from.x + direction.x, y: from.y + direction.y },
      false,
      true,
      width,
      height,
    );
  const upper = ray(a);
  const lower = ray(b);
  return {
    median: ray(origin),
    upper,
    lower,
    fill: [a, { x: upper[2], y: upper[3] }, { x: lower[2], y: lower[3] }, b],
  };
}

interface RegressionPixels {
  readonly centre: Segment;
  readonly upper: Segment;
  readonly lower: Segment;
}

const REGRESSION_DEVIATIONS = 2;

function regressionPixels(
  drawing: Drawing,
  geometry: Geometry,
): RegressionPixels | null {
  const [first, second] = drawing.points;
  if (!first || !second || !geometry.regression) return null;
  const fit = geometry.regression(first.t, second.t);
  if (!fit) return null;
  const offset = fit.sigma * REGRESSION_DEVIATIONS;
  const at = (point: DrawingPoint, shift: number): XY | null =>
    geometry.toXY({ t: point.t, p: point.p + shift });
  const a = at(fit.start, 0);
  const b = at(fit.end, 0);
  const ua = at(fit.start, offset);
  const ub = at(fit.end, offset);
  const la = at(fit.start, -offset);
  const lb = at(fit.end, -offset);
  if (!a || !b || !ua || !ub || !la || !lb) return null;
  return {
    centre: [a.x, a.y, b.x, b.y],
    upper: [ua.x, ua.y, ub.x, ub.y],
    lower: [la.x, la.y, lb.x, lb.y],
  };
}

const EMOJI_BOX = 34;

/** Hit geometry for a drawing; also what draws the selection handles. */
export function getShapes(drawing: Drawing, geometry: Geometry): Shapes | null {
  const pixels = toPixels(drawing, geometry);
  if (!pixels || pixels.length === 0) return null;
  const { width, height } = geometry;
  const first = pixels[0]!;
  const second = pixels[1];

  switch (drawing.type) {
    case "trend":
      return second
        ? {
            segments: [[first.x, first.y, second.x, second.y]],
            boxes: [],
            handles: pixels,
          }
        : null;
    case "ray":
      return second
        ? {
            segments: [clipLine(first, second, false, true, width, height)],
            boxes: [],
            handles: pixels,
          }
        : null;
    case "extended":
      return second
        ? {
            segments: [clipLine(first, second, true, true, width, height)],
            boxes: [],
            handles: pixels,
          }
        : null;
    case "hline":
      return {
        segments: [[0, first.y, width, first.y]],
        boxes: [],
        handles: [
          { x: Math.min(Math.max(first.x, 20), width - 20), y: first.y },
        ],
      };
    case "hray":
      return {
        segments: [[first.x, first.y, width, first.y]],
        boxes: [],
        handles: [first],
      };
    case "vline":
      return {
        segments: [[first.x, 0, first.x, height]],
        boxes: [],
        handles: [
          { x: first.x, y: Math.min(Math.max(first.y, 20), height - 20) },
        ],
      };
    case "channel": {
      const channel = channelGeometry(pixels);
      if (!channel) {
        return second
          ? {
              segments: [[first.x, first.y, second.x, second.y]],
              boxes: [],
              handles: pixels,
            }
          : null;
      }
      return {
        segments: [
          [channel.a.x, channel.a.y, channel.b.x, channel.b.y],
          [channel.a2.x, channel.a2.y, channel.b2.x, channel.b2.y],
        ],
        boxes: [],
        handles: [channel.a, channel.b, pixels[2]!],
      };
    }
    case "rect": {
      if (!second) return null;
      return {
        segments: rectEdges(first.x, first.y, second.x, second.y),
        boxes: [
          [
            Math.min(first.x, second.x),
            Math.min(first.y, second.y),
            Math.abs(second.x - first.x),
            Math.abs(second.y - first.y),
          ],
        ],
        handles: pixels,
      };
    }
    case "measure": {
      if (!second) return null;
      return {
        segments: rectEdges(first.x, first.y, second.x, second.y),
        boxes: [],
        handles: pixels,
      };
    }
    case "fib": {
      if (!second) return null;
      const left = Math.min(first.x, second.x);
      const right = Math.max(first.x, second.x, left + 60);
      const segments: [number, number, number, number][] = [
        [first.x, first.y, second.x, second.y],
      ];
      for (const level of FIB_LEVELS) {
        const y = second.y + (first.y - second.y) * level.value;
        segments.push([left, y, right, y]);
      }
      return { segments, boxes: [], handles: pixels };
    }
    case "long":
    case "short": {
      const trade = tradeGeometry(pixels);
      if (!trade) return null;
      const { left, right, entryY, targetY, stopY } = trade;
      return {
        segments: [
          [left, entryY, right, entryY],
          ...rectEdges(left, entryY, right, targetY),
          ...rectEdges(left, entryY, right, stopY),
        ],
        boxes: [
          [
            left,
            Math.min(entryY, targetY),
            right - left,
            Math.abs(targetY - entryY),
          ],
          [
            left,
            Math.min(entryY, stopY),
            right - left,
            Math.abs(stopY - entryY),
          ],
        ],
        handles: pixels,
      };
    }
    case "info":
    case "angle":
      return second
        ? {
            segments: [[first.x, first.y, second.x, second.y]],
            boxes: [],
            handles: pixels,
          }
        : null;
    case "crossline":
      return {
        segments: [
          [0, first.y, width, first.y],
          [first.x, 0, first.x, height],
        ],
        boxes: [],
        handles: [first],
      };
    case "regression": {
      const fit = regressionPixels(drawing, geometry);
      if (!fit) return null;
      return {
        segments: [fit.centre, fit.upper, fit.lower],
        boxes: [],
        handles: pixels,
      };
    }
    case "flat": {
      const third = pixels[2];
      if (!second) return null;
      if (!third) {
        return {
          segments: [[first.x, first.y, second.x, second.y]],
          boxes: [],
          handles: pixels,
        };
      }
      return {
        segments: [
          [first.x, first.y, second.x, second.y],
          [first.x, third.y, second.x, third.y],
        ],
        boxes: [],
        handles: [first, second, { x: (first.x + second.x) / 2, y: third.y }],
      };
    }
    case "disjoint": {
      const third = pixels[2];
      const fourth = pixels[3];
      if (!second) return null;
      const segments: Segment[] = [[first.x, first.y, second.x, second.y]];
      if (third && fourth)
        segments.push([third.x, third.y, fourth.x, fourth.y]);
      return { segments, boxes: [], handles: pixels };
    }
    case "pitchfork":
    case "schiff":
    case "modschiff":
    case "insidefork": {
      const fork = pitchfork(drawing.type, pixels, width, height);
      if (!fork || !second) {
        return second
          ? {
              segments: [[first.x, first.y, second.x, second.y]],
              boxes: [],
              handles: pixels,
            }
          : null;
      }
      const third = pixels[2]!;
      return {
        segments: [
          fork.median,
          fork.upper,
          fork.lower,
          [second.x, second.y, third.x, third.y],
        ],
        boxes: [],
        handles: pixels,
      };
    }
    case "emoji":
      return {
        segments: [],
        boxes: [
          [
            first.x - EMOJI_BOX / 2,
            first.y - EMOJI_BOX / 2,
            EMOJI_BOX,
            EMOJI_BOX,
          ],
        ],
        handles: [first],
      };
    default:
      return (
        SHAPE_HANDLERS[drawing.type]?.shapes(drawing, pixels, geometry) ?? null
      );
    case "brush": {
      const segments: [number, number, number, number][] = [];
      for (let index = 1; index < pixels.length; index += 1) {
        const from = pixels[index - 1]!;
        const to = pixels[index]!;
        segments.push([from.x, from.y, to.x, to.y]);
      }
      return { segments, boxes: [], handles: [] };
    }
    case "text":
      return {
        segments: [],
        boxes: [textBox(drawing, first)],
        handles: [first],
      };
  }
}

function distanceToSegment(
  px: number,
  py: number,
  [x1, y1, x2, y2]: readonly [number, number, number, number],
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const ratio =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared),
        );
  return Math.hypot(px - (x1 + ratio * dx), py - (y1 + ratio * dy));
}

export function hitTestDrawing(
  drawing: Drawing,
  geometry: Geometry,
  x: number,
  y: number,
  selected: boolean,
): Hit | null {
  const shapes = getShapes(drawing, geometry);
  if (!shapes) return null;

  if (selected) {
    for (let index = 0; index < shapes.handles.length; index += 1) {
      const handle = shapes.handles[index]!;
      if (Math.hypot(handle.x - x, handle.y - y) <= HANDLE_HIT) {
        return { kind: "handle", index };
      }
    }
  }
  for (const segment of shapes.segments) {
    if (distanceToSegment(x, y, segment) <= LINE_HIT) return { kind: "body" };
  }
  for (const [bx, by, bw, bh] of shapes.boxes) {
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
      return { kind: "body" };
    }
  }
  return null;
}

export function renderDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  geometry: Geometry,
  options: { readonly selected: boolean; readonly preview?: boolean },
): void {
  const pixels = toPixels(drawing, geometry);
  if (!pixels || pixels.length === 0) return;
  const { width, height } = geometry;
  const { color } = drawing;
  const first = pixels[0]!;
  const second = pixels[1];

  ctx.save();
  ctx.globalAlpha = options.preview ? 0.8 : 1;
  applyStroke(ctx, color, drawing.width, drawing.dash);

  switch (drawing.type) {
    case "trend":
      if (second) line(ctx, [first.x, first.y, second.x, second.y]);
      break;
    case "ray":
      if (second)
        line(ctx, clipLine(first, second, false, true, width, height));
      break;
    case "extended":
      if (second) line(ctx, clipLine(first, second, true, true, width, height));
      break;
    case "hline":
    case "hray": {
      const startX = drawing.type === "hline" ? 0 : first.x;
      line(ctx, [startX, first.y, width, first.y]);
      tag(
        ctx,
        formatPrice(drawing.points[0]!.p),
        width - 4,
        first.y,
        color,
        "right",
      );
      break;
    }
    case "vline":
      line(ctx, [first.x, 0, first.x, height]);
      break;
    case "channel": {
      const channel = channelGeometry(pixels);
      if (!channel) {
        if (second) line(ctx, [first.x, first.y, second.x, second.y]);
        break;
      }
      ctx.fillStyle = withAlpha(color, 0.1);
      ctx.beginPath();
      ctx.moveTo(channel.a.x, channel.a.y);
      ctx.lineTo(channel.b.x, channel.b.y);
      ctx.lineTo(channel.b2.x, channel.b2.y);
      ctx.lineTo(channel.a2.x, channel.a2.y);
      ctx.closePath();
      ctx.fill();
      line(ctx, [channel.a.x, channel.a.y, channel.b.x, channel.b.y]);
      line(ctx, [channel.a2.x, channel.a2.y, channel.b2.x, channel.b2.y]);
      ctx.setLineDash([4, 4]);
      line(ctx, [
        (channel.a.x + channel.a2.x) / 2,
        (channel.a.y + channel.a2.y) / 2,
        (channel.b.x + channel.b2.x) / 2,
        (channel.b.y + channel.b2.y) / 2,
      ]);
      break;
    }
    case "rect": {
      if (!second) break;
      const x = Math.min(first.x, second.x);
      const y = Math.min(first.y, second.y);
      const w = Math.abs(second.x - first.x);
      const h = Math.abs(second.y - first.y);
      ctx.fillStyle = withAlpha(color, 0.12);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      break;
    }
    case "fib": {
      if (!second) break;
      const left = Math.min(first.x, second.x);
      const right = Math.max(first.x, second.x, left + 60);
      const startPrice = drawing.points[0]!.p;
      const endPrice = drawing.points[1]!.p;
      const levelY = (value: number): number =>
        second.y + (first.y - second.y) * value;
      for (let index = 1; index < FIB_LEVELS.length; index += 1) {
        const previous = FIB_LEVELS[index - 1]!;
        const current = FIB_LEVELS[index]!;
        ctx.fillStyle = withAlpha(current.color, 0.08);
        const top = levelY(previous.value);
        const bottom = levelY(current.value);
        ctx.fillRect(
          left,
          Math.min(top, bottom),
          right - left,
          Math.abs(bottom - top),
        );
      }
      for (const level of FIB_LEVELS) {
        const y = levelY(level.value);
        applyStroke(ctx, level.color, 1, "solid");
        line(ctx, [left, y, right, y]);
        const price = endPrice + (startPrice - endPrice) * level.value;
        ctx.setLineDash([]);
        ctx.font = "600 10.5px Inter, system-ui, sans-serif";
        ctx.fillStyle = level.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${level.value} (${formatPrice(price)})`, left + 4, y - 2);
      }
      applyStroke(ctx, "#787B86", 1, "dashed");
      line(ctx, [first.x, first.y, second.x, second.y]);
      break;
    }
    case "measure": {
      if (!second) break;
      const start = drawing.points[0]!;
      const end = drawing.points[1]!;
      const up = end.p >= start.p;
      const tone = up ? "#089981" : "#F23645";
      const x = Math.min(first.x, second.x);
      const y = Math.min(first.y, second.y);
      const w = Math.abs(second.x - first.x);
      const h = Math.abs(second.y - first.y);
      ctx.fillStyle = withAlpha(tone, 0.14);
      ctx.fillRect(x, y, w, h);
      applyStroke(ctx, tone, 1, "dashed");
      ctx.strokeRect(x, y, w, h);
      applyStroke(ctx, tone, 1.5, "solid");
      line(ctx, [first.x, first.y, second.x, second.y]);
      const delta = end.p - start.p;
      const bars = geometry.bars(start.t, end.t);
      tag(
        ctx,
        `${delta >= 0 ? "+" : ""}${formatPrice(delta)} (${percent(start.p, end.p)})\n${bars} bars, ${formatDuration(end.t - start.t)}`,
        (first.x + second.x) / 2,
        up ? y - 22 : y + h + 22,
        tone,
        "center",
      );
      break;
    }
    case "long":
    case "short": {
      const trade = tradeGeometry(pixels);
      if (!trade) {
        if (second) line(ctx, [first.x, first.y, second.x, second.y]);
        break;
      }
      const { left, right, entryY, targetY, stopY } = trade;
      const entry = drawing.points[0]!.p;
      const target = drawing.points[1]!.p;
      const stop = drawing.points[2]!.p;
      ctx.fillStyle = withAlpha("#089981", 0.2);
      ctx.fillRect(
        left,
        Math.min(entryY, targetY),
        right - left,
        Math.abs(targetY - entryY),
      );
      ctx.fillStyle = withAlpha("#F23645", 0.2);
      ctx.fillRect(
        left,
        Math.min(entryY, stopY),
        right - left,
        Math.abs(stopY - entryY),
      );
      applyStroke(ctx, "#787B86", 1.5, "solid");
      line(ctx, [left, entryY, right, entryY]);
      const risk = Math.abs(entry - stop);
      const reward = Math.abs(target - entry);
      const ratio = risk > 0 ? reward / risk : 0;
      tag(
        ctx,
        `Target ${formatPrice(target)} (${percent(entry, target)})`,
        (left + right) / 2,
        targetY + (targetY < entryY ? -12 : 12),
        "#089981",
        "center",
      );
      tag(
        ctx,
        `Stop ${formatPrice(stop)} (${percent(entry, stop)})`,
        (left + right) / 2,
        stopY + (stopY < entryY ? -12 : 12),
        "#F23645",
        "center",
      );
      tag(
        ctx,
        `${drawing.type === "long" ? "Long" : "Short"} · R:R ${ratio.toFixed(2)}`,
        (left + right) / 2,
        entryY,
        "#2962FF",
        "center",
      );
      break;
    }
    case "info": {
      if (!second) break;
      line(ctx, [first.x, first.y, second.x, second.y]);
      const start = drawing.points[0]!;
      const end = drawing.points[1]!;
      const delta = end.p - start.p;
      const angle = angleDegrees(first, second);
      tag(
        ctx,
        `${delta >= 0 ? "+" : ""}${formatPrice(delta)} (${percent(start.p, end.p)})\n${geometry.bars(start.t, end.t)} bars, ${formatDuration(end.t - start.t)}, ${angle.toFixed(0)}°`,
        second.x,
        second.y + (second.y > first.y ? 26 : -26),
        color,
        "center",
      );
      break;
    }
    case "angle": {
      if (!second) break;
      line(ctx, [first.x, first.y, second.x, second.y]);
      applyStroke(ctx, "#787B86", 1, "dashed");
      line(ctx, [first.x, first.y, Math.max(second.x, first.x + 60), first.y]);
      const theta = Math.atan2(second.y - first.y, second.x - first.x);
      applyStroke(ctx, color, 1.5, "solid");
      ctx.beginPath();
      ctx.arc(first.x, first.y, 34, 0, theta, theta < 0);
      ctx.stroke();
      tag(
        ctx,
        `${angleDegrees(first, second).toFixed(0)}°`,
        first.x + 56,
        first.y + (theta < 0 ? -14 : 14),
        color,
        "center",
      );
      break;
    }
    case "crossline":
      line(ctx, [0, first.y, width, first.y]);
      line(ctx, [first.x, 0, first.x, height]);
      break;
    case "regression": {
      const fit = regressionPixels(drawing, geometry);
      if (!fit) break;
      ctx.fillStyle = withAlpha(color, 0.1);
      ctx.beginPath();
      ctx.moveTo(fit.upper[0], fit.upper[1]);
      ctx.lineTo(fit.upper[2], fit.upper[3]);
      ctx.lineTo(fit.lower[2], fit.lower[3]);
      ctx.lineTo(fit.lower[0], fit.lower[1]);
      ctx.closePath();
      ctx.fill();
      line(ctx, fit.upper);
      line(ctx, fit.lower);
      ctx.setLineDash([6, 4]);
      line(ctx, fit.centre);
      break;
    }
    case "flat": {
      const third = pixels[2];
      if (!second) break;
      if (!third) {
        line(ctx, [first.x, first.y, second.x, second.y]);
        break;
      }
      ctx.fillStyle = withAlpha(color, 0.1);
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(second.x, second.y);
      ctx.lineTo(second.x, third.y);
      ctx.lineTo(first.x, third.y);
      ctx.closePath();
      ctx.fill();
      line(ctx, [first.x, first.y, second.x, second.y]);
      line(ctx, [first.x, third.y, second.x, third.y]);
      break;
    }
    case "disjoint": {
      const third = pixels[2];
      const fourth = pixels[3];
      if (!second) break;
      line(ctx, [first.x, first.y, second.x, second.y]);
      if (third && fourth) {
        ctx.fillStyle = withAlpha(color, 0.1);
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        ctx.lineTo(second.x, second.y);
        ctx.lineTo(fourth.x, fourth.y);
        ctx.lineTo(third.x, third.y);
        ctx.closePath();
        ctx.fill();
        line(ctx, [third.x, third.y, fourth.x, fourth.y]);
      } else if (third) {
        ctx.setLineDash([4, 4]);
        line(ctx, [second.x, second.y, third.x, third.y]);
      }
      break;
    }
    case "pitchfork":
    case "schiff":
    case "modschiff":
    case "insidefork": {
      const fork = pitchfork(drawing.type, pixels, width, height);
      if (!fork || !second) {
        if (second) line(ctx, [first.x, first.y, second.x, second.y]);
        break;
      }
      ctx.fillStyle = withAlpha(color, 0.08);
      ctx.beginPath();
      fork.fill.forEach((corner, index) => {
        if (index === 0) ctx.moveTo(corner.x, corner.y);
        else ctx.lineTo(corner.x, corner.y);
      });
      ctx.closePath();
      ctx.fill();
      line(ctx, fork.median);
      line(ctx, fork.upper);
      line(ctx, fork.lower);
      const third = pixels[2]!;
      applyStroke(ctx, "#787B86", 1, "dashed");
      line(ctx, [first.x, first.y, second.x, second.y]);
      line(ctx, [second.x, second.y, third.x, third.y]);
      break;
    }
    case "emoji": {
      ctx.setLineDash([]);
      ctx.font =
        "26px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(drawing.text ?? "🙂", first.x, first.y);
      break;
    }
    default: {
      SHAPE_HANDLERS[drawing.type]?.render(ctx, drawing, pixels, geometry);
      break;
    }
    case "brush": {
      ctx.beginPath();
      pixels.forEach((pixel, index) => {
        if (index === 0) ctx.moveTo(pixel.x, pixel.y);
        else ctx.lineTo(pixel.x, pixel.y);
      });
      ctx.stroke();
      break;
    }
    case "text": {
      const [bx, by, bw, bh] = textBox(drawing, first);
      ctx.setLineDash([]);
      ctx.fillStyle = withAlpha(color, 0.92);
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 5);
      ctx.fill();
      ctx.fillStyle = drawing.textColor ?? "#FFFFFF";
      ctx.font = "600 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(drawing.text ?? "", bx + 7, by + bh / 2);
      break;
    }
  }

  if (options.selected) {
    const shapes = getShapes(drawing, geometry);
    ctx.setLineDash([]);
    for (const handle of shapes?.handles ?? []) {
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#2962FF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

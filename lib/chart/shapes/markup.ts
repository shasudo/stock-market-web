import type { DrawingType } from "../drawings";
import { arcPoints, planHandler, type PlanFn } from "./plan";
import {
  distance,
  midpoint,
  withAlpha,
  type Segment,
  type ShapeHandler,
  type XY,
} from "./utils";

const GRAY = "#787B86";

const highlighter: PlanFn = (drawing, pixels) => {
  if (pixels.length < 2) return null;
  return {
    curves: [
      {
        pts: pixels as XY[],
        color: withAlpha(drawing.color, 0.35),
        width: 14,
        dash: "solid",
      },
    ],
    handles: [],
  };
};

function lerp(a: XY, b: XY, t: number): XY {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

const arrowMarker: PlanFn = (drawing, pixels) => {
  const [tail, tip] = pixels;
  if (!tail || !tip) return null;
  const length = distance(tail, tip);
  if (length < 4) return null;
  const nx = -(tip.y - tail.y) / length;
  const ny = (tip.x - tail.x) / length;
  const wing = Math.min(18, length * 0.22);
  const shaft = wing * 0.28;
  const shoulder = lerp(tail, tip, 0.62);
  const offset = (point: XY, amount: number): XY => ({
    x: point.x + nx * amount,
    y: point.y + ny * amount,
  });
  const pts = [
    offset(tail, shaft),
    offset(shoulder, shaft),
    offset(shoulder, wing),
    tip,
    offset(shoulder, -wing),
    offset(shoulder, -shaft),
    offset(tail, -shaft),
  ];
  return {
    curves: [{ pts, close: true, color: drawing.color, width: 1, fill: 0.9 }],
    handles: [tail, tip],
  };
};

const arrow: PlanFn = (drawing, pixels) => {
  const [tail, tip] = pixels;
  if (!tail || !tip) return null;
  return {
    lines: [
      { seg: [tail.x, tail.y, tip.x, tip.y] as Segment, color: drawing.color },
    ],
    arrows: [
      {
        from: tail,
        to: tip,
        color: drawing.color,
        size: 8 + drawing.width * 2,
      },
    ],
  };
};

function blockArrow(direction: 1 | -1): PlanFn {
  return (drawing, pixels) => {
    const [anchor] = pixels;
    if (!anchor) return null;
    // The tip sits at the anchor and the body extends away from it: +1 grows
    // downward (the arrow points up), -1 grows upward (it points down).
    const sign = direction;
    const pts: XY[] = [
      { x: anchor.x, y: anchor.y },
      { x: anchor.x + 14, y: anchor.y + 16 * sign },
      { x: anchor.x + 6, y: anchor.y + 16 * sign },
      { x: anchor.x + 6, y: anchor.y + 36 * sign },
      { x: anchor.x - 6, y: anchor.y + 36 * sign },
      { x: anchor.x - 6, y: anchor.y + 16 * sign },
      { x: anchor.x - 14, y: anchor.y + 16 * sign },
    ];
    return {
      curves: [
        { pts, close: true, color: drawing.color, width: 1, fill: 0.95 },
      ],
      boxes: [
        [anchor.x - 14, Math.min(anchor.y, anchor.y + 36 * sign), 28, 36],
      ],
      handles: [anchor],
    };
  };
}

const rotatedRect: PlanFn = (drawing, pixels) => {
  const [a, b, c] = pixels;
  if (!a || !b) return null;
  const length = distance(a, b);
  if (length < 2) return null;
  if (!c) return { lines: [{ seg: [a.x, a.y, b.x, b.y] as Segment }] };
  const nx = -(b.y - a.y) / length;
  const ny = (b.x - a.x) / length;
  const width = (c.x - a.x) * nx + (c.y - a.y) * ny;
  const pts = [
    a,
    b,
    { x: b.x + nx * width, y: b.y + ny * width },
    { x: a.x + nx * width, y: a.y + ny * width },
  ];
  return {
    curves: [{ pts, close: true, color: drawing.color, fill: 0.12 }],
    boxes: [],
    handles: [a, b, c],
  };
};

const path: PlanFn = (drawing, pixels) => {
  if (pixels.length < 2) return null;
  const last = pixels[pixels.length - 1]!;
  const before = pixels[pixels.length - 2]!;
  return {
    curves: [{ pts: pixels as XY[], color: drawing.color }],
    arrows: [
      {
        from: before,
        to: last,
        color: drawing.color,
        size: 8 + drawing.width * 2,
      },
    ],
  };
};

const circle: PlanFn = (drawing, pixels) => {
  const [centre, edge] = pixels;
  if (!centre || !edge) return null;
  const radius = distance(centre, edge);
  if (radius < 2) return null;
  const pts = arcPoints(centre, radius, 0, Math.PI * 2, 72);
  return {
    curves: [{ pts, close: true, color: drawing.color, fill: 0.12 }],
    lines: [
      {
        seg: [centre.x, centre.y, edge.x, edge.y] as Segment,
        color: GRAY,
        dash: "dashed" as const,
        width: 1,
      },
    ],
    boxes: [[centre.x - radius, centre.y - radius, radius * 2, radius * 2]],
  };
};

const ellipse: PlanFn = (drawing, pixels) => {
  const [a, b] = pixels;
  if (!a || !b) return null;
  const centre = midpoint(a, b);
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  if (rx < 2 || ry < 2) return null;
  const pts: XY[] = [];
  for (let step = 0; step <= 72; step += 1) {
    const angle = (step / 72) * Math.PI * 2;
    pts.push({
      x: centre.x + rx * Math.cos(angle),
      y: centre.y + ry * Math.sin(angle),
    });
  }
  return {
    curves: [{ pts, close: true, color: drawing.color, fill: 0.12 }],
    boxes: [[centre.x - rx, centre.y - ry, rx * 2, ry * 2]],
  };
};

const polygon: PlanFn = (drawing, pixels) => {
  if (pixels.length < 2) return null;
  const closed = pixels.length >= 3;
  return {
    curves: [
      {
        pts: pixels as XY[],
        close: closed,
        color: drawing.color,
        fill: closed ? 0.12 : undefined,
      },
    ],
  };
};

/** Circle through three points, or null when they are in a line. */
function circumcircle(
  a: XY,
  b: XY,
  c: XY,
): { centre: XY; radius: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-6) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const centre = {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
  return { centre, radius: distance(centre, a) };
}

const arc: PlanFn = (drawing, pixels) => {
  const [a, b, c] = pixels;
  if (!a || !b) return null;
  if (!c) return { lines: [{ seg: [a.x, a.y, b.x, b.y] as Segment }] };
  const circle = circumcircle(a, b, c);
  if (!circle)
    return {
      lines: [{ seg: [a.x, a.y, c.x, c.y] as Segment, color: drawing.color }],
    };
  const angle = (point: XY): number =>
    Math.atan2(point.y - circle.centre.y, point.x - circle.centre.x);
  const from = angle(a);
  const via = angle(b);
  let to = angle(c);
  const turn = (target: number): number => {
    let delta = target - from;
    while (delta < 0) delta += Math.PI * 2;
    return delta;
  };
  // Sweep the way that passes through the middle point.
  const sweepToVia = turn(via);
  let sweep = turn(to);
  if (sweepToVia > sweep) sweep -= Math.PI * 2;
  to = from + sweep;
  return {
    curves: [
      {
        pts: arcPoints(circle.centre, circle.radius, from, to, 64),
        color: drawing.color,
      },
    ],
    handles: [a, b, c],
  };
};

function bezier(points: readonly XY[], steps = 48): XY[] {
  const result: XY[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    let current = [...points];
    while (current.length > 1) {
      current = current
        .slice(1)
        .map((point, index) => lerp(current[index]!, point, t));
    }
    result.push(current[0]!);
  }
  return result;
}

const curve: PlanFn = (drawing, pixels) => {
  const [a, through, c] = pixels;
  if (!a || !through) return null;
  if (!c)
    return { lines: [{ seg: [a.x, a.y, through.x, through.y] as Segment }] };
  // Pick the control point that makes the curve pass through the middle click.
  const control = {
    x: 2 * through.x - (a.x + c.x) / 2,
    y: 2 * through.y - (a.y + c.y) / 2,
  };
  return {
    curves: [{ pts: bezier([a, control, c]), color: drawing.color }],
    handles: [a, through, c],
  };
};

const doubleCurve: PlanFn = (drawing, pixels) => {
  const [a, b, c, d] = pixels;
  if (!a || !b) return null;
  if (!c || !d) return { lines: [{ seg: [a.x, a.y, b.x, b.y] as Segment }] };
  return {
    curves: [{ pts: bezier([a, b, c, d]), color: drawing.color }],
    lines: [
      {
        seg: [a.x, a.y, b.x, b.y] as Segment,
        color: GRAY,
        dash: "dashed" as const,
        width: 1,
      },
      {
        seg: [c.x, c.y, d.x, d.y] as Segment,
        color: GRAY,
        dash: "dashed" as const,
        width: 1,
      },
    ],
  };
};

export const MARKUP_HANDLERS: Partial<Record<DrawingType, ShapeHandler>> = {
  highlighter: planHandler(highlighter),
  arrowmarker: planHandler(arrowMarker),
  arrow: planHandler(arrow),
  arrowup: planHandler(blockArrow(1)),
  arrowdown: planHandler(blockArrow(-1)),
  rotatedrect: planHandler(rotatedRect),
  path: planHandler(path),
  circle: planHandler(circle),
  ellipse: planHandler(ellipse),
  polyline: planHandler(polygon),
  triangle: planHandler(polygon),
  arc: planHandler(arc),
  curve: planHandler(curve),
  doublecurve: planHandler(doubleCurve),
};

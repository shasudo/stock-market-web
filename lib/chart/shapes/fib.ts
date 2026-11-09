import type { DrawingType } from "../drawings";
import {
  arcPoints,
  planHandler,
  type Plan,
  type PlanFn,
  type PlanLabel,
  type PlanLine,
  type PlanPoly,
} from "./plan";
import {
  FIB_COLORS,
  GOLDEN,
  clipLine,
  distance,
  formatPrice,
  midpoint,
  type Segment,
  type ShapeHandler,
  type XY,
} from "./utils";

const GRAY = "#787B86";
const LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const EXTENSION_LEVELS = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236,
];
const CHANNEL_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];
const TIME_LEVELS = [
  0, 0.382, 0.5, 0.618, 1, 1.382, 1.618, 2, 2.618, 3.618, 4.236,
];
const FIB_SEQUENCE = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];
const FAN_LEVELS = [0.382, 0.5, 0.618, 1];
const ARC_LEVELS = [0.382, 0.5, 0.618, 1, 1.382, 1.618];
const CIRCLE_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618];
const PITCHFAN_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

function levelColor(index: number): string {
  return FIB_COLORS[index % FIB_COLORS.length]!;
}

function partial(pixels: readonly XY[]): Plan | null {
  const [first, second] = pixels;
  if (!first || !second) return null;
  return {
    lines: [
      {
        seg: [first.x, first.y, second.x, second.y],
        color: GRAY,
        dash: "dashed",
      },
    ],
  };
}

const fibExtension: PlanFn = (drawing, pixels) => {
  const [p1, p2, p3] = pixels;
  if (!p1 || !p2 || !p3) return partial(pixels);
  const end = p3.x + Math.max(140, Math.abs(p2.x - p1.x));
  const lines: PlanLine[] = [
    { seg: [p1.x, p1.y, p2.x, p2.y], color: GRAY, dash: "dashed", width: 1 },
    { seg: [p2.x, p2.y, p3.x, p3.y], color: GRAY, dash: "dashed", width: 1 },
  ];
  const polys: PlanPoly[] = [];
  const labels: PlanLabel[] = [];
  const basePrice = drawing.points[2]!.p;
  const move = drawing.points[1]!.p - drawing.points[0]!.p;
  const rows = EXTENSION_LEVELS.map((level) => ({
    level,
    y: p3.y + (p2.y - p1.y) * level,
  }));
  rows.forEach((row, index) => {
    const color = levelColor(index);
    lines.push({
      seg: [p3.x, row.y, end, row.y],
      color,
      width: 1,
      dash: "solid",
    });
    labels.push({
      text: `${row.level} (${formatPrice(basePrice + move * row.level)})`,
      x: p3.x + 4,
      y: row.y - 7,
      color,
    });
    const next = rows[index + 1];
    if (next) {
      polys.push({
        pts: [
          { x: p3.x, y: row.y },
          { x: end, y: row.y },
          { x: end, y: next.y },
          { x: p3.x, y: next.y },
        ],
        color,
        alpha: 0.06,
      });
    }
  });
  return { lines, polys, labels };
};

const fibChannel: PlanFn = (_drawing, pixels) => {
  const [p1, p2, p3] = pixels;
  if (!p1 || !p2 || !p3) return partial(pixels);
  const run = p2.x - p1.x;
  const lineAt =
    run === 0 ? p1.y : p1.y + ((p2.y - p1.y) * (p3.x - p1.x)) / run;
  const offset = p3.y - lineAt;
  const lines: NonNullable<Plan["lines"]>[number][] = [];
  const polys: NonNullable<Plan["polys"]>[number][] = [];
  const labels: NonNullable<Plan["labels"]>[number][] = [];
  CHANNEL_LEVELS.forEach((level, index) => {
    const color = levelColor(index);
    const shift = offset * level;
    lines.push({
      seg: [p1.x, p1.y + shift, p2.x, p2.y + shift],
      color,
      width: 1,
    });
    labels.push({ text: String(level), x: p2.x + 4, y: p2.y + shift, color });
    const next = CHANNEL_LEVELS[index + 1];
    if (next !== undefined) {
      const nextShift = offset * next;
      polys.push({
        pts: [
          { x: p1.x, y: p1.y + shift },
          { x: p2.x, y: p2.y + shift },
          { x: p2.x, y: p2.y + nextShift },
          { x: p1.x, y: p1.y + nextShift },
        ],
        color,
        alpha: 0.05,
      });
    }
  });
  return { lines, polys, labels };
};

const fibTimeZone: PlanFn = (_drawing, pixels, geometry) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  const unit = p2.x - p1.x;
  if (Math.abs(unit) < 1) return partial(pixels);
  const lines: NonNullable<Plan["lines"]>[number][] = [
    { seg: [p1.x, p1.y, p2.x, p2.y], color: GRAY, dash: "dashed", width: 1 },
  ];
  const labels: NonNullable<Plan["labels"]>[number][] = [];
  FIB_SEQUENCE.forEach((value, index) => {
    const x = p1.x + unit * value;
    if (x < -2 || x > geometry.width + 2) return;
    const color = levelColor(index);
    lines.push({ seg: [x, 0, x, geometry.height], color, width: 1 });
    labels.push({ text: String(value), x: x + 3, y: 12, color });
  });
  return { lines, labels, handles: [p1, p2] };
};

const fibFan: PlanFn = (_drawing, pixels, geometry) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  const lines: NonNullable<Plan["lines"]>[number][] = [
    { seg: [p2.x, p1.y, p2.x, p2.y], color: GRAY, dash: "dashed", width: 1 },
  ];
  const labels: NonNullable<Plan["labels"]>[number][] = [];
  const polys: NonNullable<Plan["polys"]>[number][] = [];
  let previous: Segment | null = null;
  FAN_LEVELS.forEach((level, index) => {
    const target = { x: p2.x, y: p1.y + (p2.y - p1.y) * level };
    const color = levelColor(index + 1);
    const ray = clipLine(
      p1,
      target,
      false,
      true,
      geometry.width,
      geometry.height,
    );
    lines.push({ seg: ray, color, width: 1 });
    labels.push({ text: String(level), x: p2.x + 4, y: target.y, color });
    if (previous) {
      polys.push({
        pts: [
          { x: p1.x, y: p1.y },
          { x: previous[2], y: previous[3] },
          { x: ray[2], y: ray[3] },
        ],
        color,
        alpha: 0.05,
      });
    }
    previous = ray;
  });
  return { lines, labels, polys };
};

const fibTime: PlanFn = (_drawing, pixels, geometry) => {
  const [p1, p2, p3] = pixels;
  if (!p1 || !p2 || !p3) return partial(pixels);
  const unit = p2.x - p1.x;
  const lines: NonNullable<Plan["lines"]>[number][] = [
    { seg: [p1.x, p1.y, p2.x, p2.y], color: GRAY, dash: "dashed", width: 1 },
    { seg: [p2.x, p2.y, p3.x, p3.y], color: GRAY, dash: "dashed", width: 1 },
  ];
  const labels: NonNullable<Plan["labels"]>[number][] = [];
  TIME_LEVELS.forEach((level, index) => {
    const x = p3.x + unit * level;
    if (x < -2 || x > geometry.width + 2) return;
    const color = levelColor(index);
    lines.push({ seg: [x, 0, x, geometry.height], color, width: 1 });
    labels.push({ text: String(level), x: x + 3, y: 12, color });
  });
  return { lines, labels };
};

const fibCircles: PlanFn = (_drawing, pixels) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  const centre = midpoint(p1, p2);
  const base = distance(p1, p2) / 2;
  if (base < 1) return partial(pixels);
  const curves = CIRCLE_LEVELS.map((level, index) => ({
    pts: arcPoints(centre, base * level, 0, Math.PI * 2, 72),
    close: true,
    color: levelColor(index + 1),
    width: 1,
    fill: 0.03,
  }));
  return {
    lines: [
      {
        seg: [p1.x, p1.y, p2.x, p2.y] as Segment,
        color: GRAY,
        dash: "dashed" as const,
        width: 1,
      },
    ],
    curves,
  };
};

const fibSpiral: PlanFn = (_drawing, pixels) => {
  const [centre, start] = pixels;
  if (!centre || !start) return null;
  const radius = distance(centre, start);
  if (radius < 2) return partial(pixels);
  const angle = Math.atan2(start.y - centre.y, start.x - centre.x);
  const pts: XY[] = [];
  for (let step = 0; step <= 360; step += 1) {
    const theta = (step / 360) * Math.PI * 4;
    const r = radius * Math.pow(GOLDEN, (-2 * theta) / Math.PI);
    pts.push({
      x: centre.x + r * Math.cos(angle + theta),
      y: centre.y + r * Math.sin(angle + theta),
    });
  }
  return {
    lines: [
      {
        seg: [centre.x, centre.y, start.x, start.y] as Segment,
        color: GRAY,
        dash: "dashed" as const,
        width: 1,
      },
    ],
    curves: [{ pts, color: "#F57C00", width: 1.5 }],
  };
};

const fibArcs: PlanFn = (_drawing, pixels) => {
  const [centre, end] = pixels;
  if (!centre || !end) return null;
  const radius = distance(centre, end);
  if (radius < 2) return partial(pixels);
  const angle = Math.atan2(end.y - centre.y, end.x - centre.x);
  const curves = ARC_LEVELS.map((level, index) => ({
    pts: arcPoints(
      centre,
      radius * level,
      angle - Math.PI / 2,
      angle + Math.PI / 2,
      48,
    ),
    color: levelColor(index + 1),
    width: 1,
  }));
  const labels = ARC_LEVELS.map((level, index) => ({
    text: String(level),
    x: centre.x + radius * level * Math.cos(angle) + 4,
    y: centre.y + radius * level * Math.sin(angle),
    color: levelColor(index + 1),
  }));
  return {
    lines: [
      {
        seg: [centre.x, centre.y, end.x, end.y] as Segment,
        color: GRAY,
        dash: "dashed" as const,
        width: 1,
      },
    ],
    curves,
    labels,
  };
};

const fibWedge: PlanFn = (_drawing, pixels) => {
  const [centre, a, b] = pixels;
  if (!centre || !a || !b) return partial(pixels);
  const radius = distance(centre, a);
  if (radius < 2) return partial(pixels);
  const from = Math.atan2(a.y - centre.y, a.x - centre.x);
  let to = Math.atan2(b.y - centre.y, b.x - centre.x);
  while (to - from > Math.PI) to -= Math.PI * 2;
  while (to - from < -Math.PI) to += Math.PI * 2;
  const outer = radius * 1.618;
  const curves = CIRCLE_LEVELS.map((level, index) => ({
    pts: arcPoints(centre, radius * level, from, to, 40),
    color: levelColor(index + 1),
    width: 1,
  }));
  return {
    lines: [
      {
        seg: [
          centre.x,
          centre.y,
          centre.x + outer * Math.cos(from),
          centre.y + outer * Math.sin(from),
        ] as Segment,
      },
      {
        seg: [
          centre.x,
          centre.y,
          centre.x + outer * Math.cos(to),
          centre.y + outer * Math.sin(to),
        ] as Segment,
      },
    ],
    polys: [
      {
        pts: [centre, ...arcPoints(centre, outer, from, to, 40)],
        color: "#089981",
        alpha: 0.05,
      },
    ],
    curves,
  };
};

const pitchfan: PlanFn = (_drawing, pixels, geometry) => {
  const [p1, p2, p3] = pixels;
  if (!p1 || !p2 || !p3) return partial(pixels);
  const rays: Segment[] = PITCHFAN_LEVELS.map((level) => {
    const through = {
      x: p2.x + (p3.x - p2.x) * level,
      y: p2.y + (p3.y - p2.y) * level,
    };
    return clipLine(p1, through, false, true, geometry.width, geometry.height);
  });
  const lines = rays.map((seg, index) => ({
    seg,
    color: levelColor(index),
    width: 1,
  }));
  const polys = rays.slice(1).map((seg, index) => ({
    pts: [
      { x: p1.x, y: p1.y },
      { x: rays[index]![2], y: rays[index]![3] },
      { x: seg[2], y: seg[3] },
    ],
    color: levelColor(index + 1),
    alpha: 0.05,
  }));
  return {
    lines: [
      ...lines,
      {
        seg: [p2.x, p2.y, p3.x, p3.y] as Segment,
        color: GRAY,
        dash: "dashed" as const,
        width: 1,
      },
    ],
    polys,
  };
};

// ── Gann ────────────────────────────────────────────────────────────────

function gridPlan(
  p1: XY,
  p2: XY,
  divisions: readonly number[],
  color: string,
  diagonals: boolean,
): Plan {
  const x = (fraction: number): number => p1.x + (p2.x - p1.x) * fraction;
  const y = (fraction: number): number => p1.y + (p2.y - p1.y) * fraction;
  const lines: NonNullable<Plan["lines"]>[number][] = [];
  for (const fraction of [0, ...divisions, 1]) {
    lines.push({
      seg: [x(0), y(fraction), x(1), y(fraction)],
      color,
      width: 1,
    });
    lines.push({
      seg: [x(fraction), y(0), x(fraction), y(1)],
      color,
      width: 1,
    });
  }
  if (diagonals) {
    lines.push({ seg: [x(0), y(0), x(1), y(1)], color, width: 1.5 });
    lines.push({ seg: [x(0), y(1), x(1), y(0)], color, width: 1.5 });
  }
  const box: [number, number, number, number] = [
    Math.min(p1.x, p2.x),
    Math.min(p1.y, p2.y),
    Math.abs(p2.x - p1.x),
    Math.abs(p2.y - p1.y),
  ];
  return {
    lines,
    polys: [
      {
        pts: [p1, { x: p2.x, y: p1.y }, p2, { x: p1.x, y: p2.y }],
        color,
        alpha: 0.05,
      },
    ],
    boxes: [box],
    handles: [p1, p2],
  };
}

const gannBox: PlanFn = (drawing, pixels) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  return gridPlan(p1, p2, [0.25, 0.382, 0.5, 0.618, 0.75], drawing.color, true);
};

const gannSquare: PlanFn = (drawing, pixels) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  return gridPlan(
    p1,
    p2,
    [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875],
    drawing.color,
    true,
  );
};

const gannFixed: PlanFn = (drawing, pixels) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  const side = Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
  const corner = {
    x: p1.x + Math.sign(p2.x - p1.x || 1) * side,
    y: p1.y + Math.sign(p2.y - p1.y || 1) * side,
  };
  const plan = gridPlan(p1, corner, [0.25, 0.5, 0.75], drawing.color, true);
  return { ...plan, handles: [p1, corner] };
};

const GANN_RATIOS: readonly { label: string; price: number; time: number }[] = [
  { label: "1×8", price: 1, time: 8 },
  { label: "1×4", price: 1, time: 4 },
  { label: "1×3", price: 1, time: 3 },
  { label: "1×2", price: 1, time: 2 },
  { label: "1×1", price: 1, time: 1 },
  { label: "2×1", price: 2, time: 1 },
  { label: "3×1", price: 3, time: 1 },
  { label: "4×1", price: 4, time: 1 },
  { label: "8×1", price: 8, time: 1 },
];

const gannFan: PlanFn = (drawing, pixels, geometry) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (Math.abs(dx) < 1) return partial(pixels);
  const lines: NonNullable<Plan["lines"]>[number][] = [];
  const labels: NonNullable<Plan["labels"]>[number][] = [];
  GANN_RATIOS.forEach((ratio, index) => {
    const target = { x: p1.x + dx * ratio.time, y: p1.y + dy * ratio.price };
    const color = ratio.label === "1×1" ? drawing.color : levelColor(index);
    const seg = clipLine(
      p1,
      target,
      false,
      true,
      geometry.width,
      geometry.height,
    );
    lines.push({ seg, color, width: ratio.label === "1×1" ? 2 : 1 });
    labels.push({
      text: ratio.label,
      x: seg[2] - 4,
      y: seg[3] - 8,
      color,
      align: "right",
    });
  });
  return { lines, labels };
};

export const FIB_HANDLERS: Partial<Record<DrawingType, ShapeHandler>> = {
  fibext: planHandler(fibExtension),
  fibchannel: planHandler(fibChannel),
  fibtimezone: planHandler(fibTimeZone),
  fibfan: planHandler(fibFan),
  fibtime: planHandler(fibTime),
  fibcircles: planHandler(fibCircles),
  fibspiral: planHandler(fibSpiral),
  fibarcs: planHandler(fibArcs),
  fibwedge: planHandler(fibWedge),
  pitchfan: planHandler(pitchfan),
  gannbox: planHandler(gannBox),
  gannfixed: planHandler(gannFixed),
  gannsquare: planHandler(gannSquare),
  gannfan: planHandler(gannFan),
};

export { LEVELS as FIB_RETRACEMENT_LEVELS };

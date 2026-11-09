import type { DrawingType } from "../drawings";
import {
  planHandler,
  type Plan,
  type PlanCurve,
  type PlanFn,
  type PlanLabel,
  type PlanLine,
  type PlanPoly,
} from "./plan";
import { clipLine, midpoint, type ShapeHandler, type XY } from "./utils";

const GRAY = "#787B86";

interface PatternConfig {
  /** Label for each pivot; empty strings are skipped. */
  readonly labels: readonly string[];
  /** Dashed helper lines between pivots. */
  readonly connectors?: readonly (readonly [number, number])[];
  /** Pivots whose polygon is lightly filled. */
  readonly fills?: readonly (readonly number[])[];
  /** Retracement ratios drawn at the middle of a connector: |b-a| / |d-c| in price. */
  readonly ratios?: readonly {
    readonly at: readonly [number, number];
    readonly of: readonly [number, number, number, number];
  }[];
  /** A line through two pivots, extended both ways (the neckline). */
  readonly neckline?: readonly [number, number];
  /** Draw labels on filled tags (wave counts) instead of bare text. */
  readonly boxedLabels?: boolean;
}

function ratioText(
  prices: readonly number[],
  of: readonly [number, number, number, number],
): string {
  const [a, b, c, d] = of;
  const denominator = Math.abs(prices[d]! - prices[c]!);
  if (denominator === 0) return "";
  return (Math.abs(prices[b]! - prices[a]!) / denominator).toFixed(3);
}

function patternPlan(config: PatternConfig): PlanFn {
  return (drawing, pixels, geometry) => {
    if (pixels.length < 2) return null;
    const prices = drawing.points.map((point) => point.p);
    const lines: PlanLine[] = [];
    const polys: PlanPoly[] = [];
    const labels: PlanLabel[] = [];
    const curves: PlanCurve[] = [{ pts: pixels as XY[] }];

    for (const [a, b] of config.connectors ?? []) {
      const from = pixels[a];
      const to = pixels[b];
      if (from && to) {
        lines.push({
          seg: [from.x, from.y, to.x, to.y],
          color: GRAY,
          dash: "dashed",
          width: 1,
        });
      }
    }
    for (const fill of config.fills ?? []) {
      const pts = fill.map((index) => pixels[index]);
      if (pts.every((point): point is XY => point !== undefined)) {
        polys.push({ pts, color: drawing.color, alpha: 0.1 });
      }
    }
    if (config.neckline) {
      const from = pixels[config.neckline[0]];
      const to = pixels[config.neckline[1]];
      if (from && to) {
        lines.push({
          seg: clipLine(from, to, true, true, geometry.width, geometry.height),
          color: GRAY,
          width: 1,
        });
      }
    }
    for (const ratio of config.ratios ?? []) {
      const from = pixels[ratio.at[0]];
      const to = pixels[ratio.at[1]];
      const hasAll = ratio.of.every((index) => prices[index] !== undefined);
      if (!from || !to || !hasAll) continue;
      const centre = midpoint(from, to);
      const text = ratioText(prices, ratio.of);
      if (text) {
        labels.push({
          text,
          x: centre.x,
          y: centre.y,
          color: GRAY,
          align: "center",
          boxed: false,
        });
      }
    }
    pixels.forEach((pixel, index) => {
      const text = config.labels[index];
      if (!text) return;
      const previous = pixels[index - 1];
      const next = pixels[index + 1];
      const lowerThanNeighbours =
        (!previous || pixel.y >= previous.y) && (!next || pixel.y >= next.y);
      labels.push({
        text,
        x: pixel.x,
        y: pixel.y + (lowerThanNeighbours ? 16 : -16),
        color: config.boxedLabels ? drawing.color : drawing.color,
        align: "center",
        boxed: config.boxedLabels,
      });
    });
    return { lines, polys, curves, labels } satisfies Plan;
  };
}

const XABCD: PatternConfig = {
  labels: ["X", "A", "B", "C", "D"],
  connectors: [
    [0, 2],
    [2, 4],
    [1, 3],
    [0, 4],
  ],
  fills: [
    [0, 1, 2],
    [2, 3, 4],
  ],
  ratios: [
    { at: [0, 2], of: [1, 2, 0, 1] },
    { at: [1, 3], of: [2, 3, 1, 2] },
    { at: [2, 4], of: [3, 4, 2, 3] },
    { at: [0, 4], of: [1, 4, 0, 1] },
  ],
};

const PATTERNS: Partial<Record<DrawingType, PatternConfig>> = {
  xabcd: XABCD,
  cypher: XABCD,
  abcd: {
    labels: ["A", "B", "C", "D"],
    connectors: [
      [0, 2],
      [1, 3],
    ],
    fills: [
      [0, 1, 2],
      [1, 2, 3],
    ],
    ratios: [
      { at: [0, 2], of: [1, 2, 0, 1] },
      { at: [1, 3], of: [2, 3, 1, 2] },
    ],
  },
  trianglepattern: {
    labels: ["A", "B", "C", "D"],
    connectors: [
      [0, 2],
      [1, 3],
    ],
    fills: [[0, 1, 3, 2]],
  },
  headshoulders: {
    labels: ["", "Left shoulder", "", "Head", "", "Right shoulder", ""],
    neckline: [2, 4],
    fills: [
      [1, 2, 0],
      [3, 2, 4],
      [5, 4, 6],
    ],
  },
  threedrives: {
    labels: ["", "1", "A", "2", "B", "3", ""],
    connectors: [
      [1, 3],
      [3, 5],
    ],
    fills: [[2, 3, 4]],
  },
  elliottimpulse: {
    labels: ["(0)", "(1)", "(2)", "(3)", "(4)", "(5)"],
    boxedLabels: true,
  },
  elliottcorrection: {
    labels: ["(0)", "(A)", "(B)", "(C)"],
    boxedLabels: true,
  },
  elliotttriangle: {
    labels: ["(0)", "(A)", "(B)", "(C)", "(D)", "(E)"],
    boxedLabels: true,
  },
  elliottdouble: { labels: ["(0)", "(W)", "(X)", "(Y)"], boxedLabels: true },
  elliotttriple: {
    labels: ["(0)", "(W)", "(X)", "(Y)", "(X)", "(Z)"],
    boxedLabels: true,
  },
};

// ── cycles ──────────────────────────────────────────────────────────────

/** Indices k such that x1 + k * period lies on screen (period may be negative). */
function cycleRange(
  x1: number,
  period: number,
  width: number,
): [number, number] {
  const a = Math.ceil((0 - x1) / period);
  const b = Math.floor((width - x1) / period);
  return period > 0 ? [a, b] : [b, a];
}

const cyclicLines: PlanFn = (drawing, pixels, geometry) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  const period = p2.x - p1.x;
  if (Math.abs(period) < 2) return null;
  const [from, to] = cycleRange(p1.x, period, geometry.width);
  const lines: PlanLine[] = [
    { seg: [p1.x, p1.y, p2.x, p1.y], color: GRAY, dash: "dashed", width: 1 },
  ];
  for (let k = Math.max(from, -300); k <= Math.min(to, 300); k += 1) {
    const x = p1.x + period * k;
    lines.push({
      seg: [x, 0, x, geometry.height],
      color: drawing.color,
      width: 1,
    });
  }
  return { lines, handles: [p1, p2] };
};

const timeCycles: PlanFn = (drawing, pixels, geometry) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  const period = p2.x - p1.x;
  if (Math.abs(period) < 4) return null;
  const height = Math.max(8, Math.abs(p2.y - p1.y));
  const [from, to] = cycleRange(p1.x, period, geometry.width);
  const curves: PlanCurve[] = [];
  for (let k = Math.max(from - 1, -150); k <= Math.min(to, 150); k += 1) {
    const start = p1.x + period * k;
    const pts: XY[] = [];
    for (let step = 0; step <= 24; step += 1) {
      const t = (step / 24) * Math.PI;
      pts.push({
        x: start + (period * t) / Math.PI,
        y: p1.y - height * Math.sin(t),
      });
    }
    curves.push({ pts, color: drawing.color, fill: 0.06 });
  }
  return { curves, handles: [p1, p2] };
};

const sineLine: PlanFn = (drawing, pixels, geometry) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  const quarter = p2.x - p1.x;
  if (Math.abs(quarter) < 2) return null;
  const period = Math.abs(quarter) * 4;
  const amplitude = p1.y - p2.y;
  const pts: XY[] = [];
  for (let x = 0; x <= geometry.width; x += 3) {
    pts.push({
      x,
      y: p1.y - amplitude * Math.sin((2 * Math.PI * (x - p1.x)) / period),
    });
  }
  return { curves: [{ pts, color: drawing.color }], handles: [p1, p2] };
};

export const PATTERN_HANDLERS: Partial<Record<DrawingType, ShapeHandler>> = {
  cyclic: planHandler(cyclicLines),
  timecycles: planHandler(timeCycles),
  sine: planHandler(sineLine),
};

for (const [type, config] of Object.entries(PATTERNS)) {
  if (config)
    PATTERN_HANDLERS[type as DrawingType] = planHandler(patternPlan(config));
}

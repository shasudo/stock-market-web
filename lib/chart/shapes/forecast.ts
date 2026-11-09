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
  distance,
  formatDuration,
  formatPrice,
  percent,
  type BarData,
  type Geometry,
  type Segment,
  type ShapeHandler,
  type XY,
} from "./utils";

const UP = "#089981";
const DOWN = "#F23645";
const GRAY = "#787B86";

function firstIndexAtOrAfter(epochs: readonly number[], t: number): number {
  let low = 0;
  let high = epochs.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (epochs[middle]! < t) low = middle + 1;
    else high = middle;
  }
  return low;
}

function nearestIndex(epochs: readonly number[], t: number): number {
  const after = firstIndexAtOrAfter(epochs, t);
  const before = after - 1;
  if (before < 0) return Math.min(after, epochs.length - 1);
  if (after >= epochs.length) return epochs.length - 1;
  return t - epochs[before]! <= epochs[after]! - t ? before : after;
}

function rangeOf(data: BarData, a: number, b: number): [number, number] | null {
  if (data.epochs.length === 0) return null;
  const first = nearestIndex(data.epochs, Math.min(a, b));
  const last = nearestIndex(data.epochs, Math.max(a, b));
  return last > first ? [first, last] : null;
}

function bounds(points: readonly XY[]): [number, number, number, number] {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return [left, top, Math.max(...xs) - left, Math.max(...ys) - top];
}

// ── projected bars ──────────────────────────────────────────────────────

/** Draws bars `first..last` shifted so the first one starts at (anchorTime, anchorPrice). */
function projectBars(
  geometry: Geometry,
  data: BarData,
  first: number,
  last: number,
  anchorTime: number,
  anchorPrice: number,
  alpha: number,
): { lines: PlanLine[]; polys: PlanPoly[]; points: XY[] } {
  const lines: PlanLine[] = [];
  const polys: PlanPoly[] = [];
  const points: XY[] = [];
  const timeShift = anchorTime - data.epochs[first]!;
  const priceShift = anchorPrice - data.closes[first]!;
  const step =
    data.epochs.length > 1
      ? data.epochs[Math.min(first + 1, data.epochs.length - 1)]! -
        data.epochs[first]!
      : 86_400;
  const probe = geometry.toXY({
    t: data.epochs[first]! + timeShift,
    p: anchorPrice,
  });
  const next = geometry.toXY({
    t: data.epochs[first]! + timeShift + step,
    p: anchorPrice,
  });
  const half =
    probe && next ? Math.max(1, Math.abs(next.x - probe.x) * 0.32) : 2;

  for (let index = first; index <= last; index += 1) {
    const t = data.epochs[index]! + timeShift;
    const open = geometry.toXY({ t, p: data.opens[index]! + priceShift });
    const high = geometry.toXY({ t, p: data.highs[index]! + priceShift });
    const low = geometry.toXY({ t, p: data.lows[index]! + priceShift });
    const close = geometry.toXY({ t, p: data.closes[index]! + priceShift });
    if (!open || !high || !low || !close) continue;
    const color = data.closes[index]! >= data.opens[index]! ? UP : DOWN;
    lines.push({
      seg: [high.x, high.y, low.x, low.y],
      color,
      width: 1,
      dash: "solid",
    });
    polys.push({
      pts: [
        { x: open.x - half, y: open.y },
        { x: open.x + half, y: open.y },
        { x: close.x + half, y: close.y },
        { x: close.x - half, y: close.y },
      ],
      color,
      alpha,
    });
    points.push(high, low);
  }
  return { lines, polys, points };
}

const barsPattern: PlanFn = (drawing, pixels, geometry) => {
  const [p1, p2, p3] = pixels;
  if (!p1 || !p2) return null;
  const data = geometry.data;
  const base: Plan = {
    lines: [
      { seg: [p1.x, p1.y, p2.x, p2.y], color: GRAY, dash: "dashed", width: 1 },
    ],
  };
  if (!p3 || !data) return base;
  const range = rangeOf(data, drawing.points[0]!.t, drawing.points[1]!.t);
  if (!range) return base;
  const projected = projectBars(
    geometry,
    data,
    range[0],
    range[1],
    drawing.points[2]!.t,
    drawing.points[2]!.p,
    0.55,
  );
  return {
    lines: [...(base.lines ?? []), ...projected.lines],
    polys: projected.polys,
    boxes: projected.points.length > 0 ? [bounds(projected.points)] : [],
    handles: pixels,
  };
};

const ghostFeed: PlanFn = (drawing, pixels, geometry) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  const data = geometry.data;
  const base: Plan = {
    lines: [
      { seg: [p1.x, p1.y, p2.x, p2.y], color: GRAY, dash: "dashed", width: 1 },
    ],
  };
  if (!data) return base;
  const range = rangeOf(data, drawing.points[0]!.t, drawing.points[1]!.t);
  if (!range) return base;
  const lastIndex = data.epochs.length - 1;
  const step =
    lastIndex > 0
      ? data.epochs[lastIndex]! - data.epochs[lastIndex - 1]!
      : 86_400;
  const projected = projectBars(
    geometry,
    data,
    range[0],
    range[1],
    data.epochs[lastIndex]! + step,
    data.closes[lastIndex]!,
    0.3,
  );
  return {
    lines: [...(base.lines ?? []), ...projected.lines],
    polys: projected.polys,
    boxes: projected.points.length > 0 ? [bounds(projected.points)] : [],
    handles: pixels,
  };
};

// ── volume-based ────────────────────────────────────────────────────────

const PROFILE_BINS = 24;

function profilePlan(
  geometry: Geometry,
  data: BarData,
  first: number,
  last: number,
  left: number,
  widthPx: number,
): Plan | null {
  let low = Infinity;
  let high = -Infinity;
  for (let index = first; index <= last; index += 1) {
    low = Math.min(low, data.lows[index]!);
    high = Math.max(high, data.highs[index]!);
  }
  if (!(high > low)) return null;

  const binSize = (high - low) / PROFILE_BINS;
  const up = new Array<number>(PROFILE_BINS).fill(0);
  const down = new Array<number>(PROFILE_BINS).fill(0);
  for (let index = first; index <= last; index += 1) {
    const from = Math.max(0, Math.floor((data.lows[index]! - low) / binSize));
    const to = Math.min(
      PROFILE_BINS - 1,
      Math.floor((data.highs[index]! - low) / binSize),
    );
    const share = data.volumes[index]! / (to - from + 1);
    const bucket = data.closes[index]! >= data.opens[index]! ? up : down;
    for (let bin = from; bin <= to; bin += 1) bucket[bin]! += share;
  }
  const totals = up.map((value, bin) => value + down[bin]!);
  const peak = Math.max(...totals);
  if (peak <= 0) return null;

  const timeAt = data.epochs[first]!;
  const polys: PlanPoly[] = [];
  const edges: XY[] = [];
  for (let bin = 0; bin < PROFILE_BINS; bin += 1) {
    const top = geometry.toXY({ t: timeAt, p: low + binSize * (bin + 1) });
    const bottom = geometry.toXY({ t: timeAt, p: low + binSize * bin });
    if (!top || !bottom) continue;
    const upWidth = (up[bin]! / peak) * widthPx;
    const downWidth = (down[bin]! / peak) * widthPx;
    const gap = Math.min(1, Math.abs(bottom.y - top.y) * 0.1);
    polys.push({
      pts: [
        { x: left, y: top.y + gap },
        { x: left + upWidth, y: top.y + gap },
        { x: left + upWidth, y: bottom.y - gap },
        { x: left, y: bottom.y - gap },
      ],
      color: "#2962FF",
      alpha: 0.55,
    });
    polys.push({
      pts: [
        { x: left + upWidth, y: top.y + gap },
        { x: left + upWidth + downWidth, y: top.y + gap },
        { x: left + upWidth + downWidth, y: bottom.y - gap },
        { x: left + upWidth, y: bottom.y - gap },
      ],
      color: "#F57C00",
      alpha: 0.55,
    });
    edges.push(top, bottom, { x: left + widthPx, y: top.y });
  }

  const pocBin = totals.indexOf(peak);
  const pocTop = geometry.toXY({
    t: timeAt,
    p: low + binSize * (pocBin + 0.5),
  });
  const lines: PlanLine[] = [];
  const labels: PlanLabel[] = [];
  if (pocTop) {
    lines.push({
      seg: [left, pocTop.y, left + widthPx, pocTop.y],
      color: DOWN,
      dash: "dashed",
      width: 1,
    });
    labels.push({
      text: `POC ${formatPrice(low + binSize * (pocBin + 0.5))}`,
      x: left + widthPx + 4,
      y: pocTop.y,
      color: DOWN,
    });
  }
  return {
    polys,
    lines,
    labels,
    boxes:
      edges.length > 0 ? [bounds([...edges, { x: left, y: edges[0]!.y }])] : [],
  };
}

const volumeProfile: PlanFn = (drawing, pixels, geometry) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2 || !geometry.data)
    return p1 && p2 ? { handles: pixels } : null;
  const range = rangeOf(
    geometry.data,
    drawing.points[0]!.t,
    drawing.points[1]!.t,
  );
  if (!range) return { handles: pixels };
  const left = Math.min(p1.x, p2.x);
  const width = Math.max(80, Math.abs(p2.x - p1.x) * 0.5);
  const plan = profilePlan(
    geometry,
    geometry.data,
    range[0],
    range[1],
    left,
    width,
  );
  return {
    ...(plan ?? {}),
    lines: [
      ...(plan?.lines ?? []),
      {
        seg: [left, 0, left, geometry.height],
        color: GRAY,
        dash: "dashed",
        width: 1,
      },
      {
        seg: [Math.max(p1.x, p2.x), 0, Math.max(p1.x, p2.x), geometry.height],
        color: GRAY,
        dash: "dashed",
        width: 1,
      },
    ],
    handles: pixels,
  };
};

const anchoredProfile: PlanFn = (drawing, pixels, geometry) => {
  const [anchor] = pixels;
  if (!anchor || !geometry.data) return anchor ? { handles: pixels } : null;
  const { data } = geometry;
  const first = nearestIndex(data.epochs, drawing.points[0]!.t);
  const last = data.epochs.length - 1;
  if (last <= first) return { handles: pixels };
  const end = geometry.toXY({ t: data.epochs[last]!, p: drawing.points[0]!.p });
  const width = Math.max(80, end ? Math.abs(end.x - anchor.x) * 0.5 : 120);
  const plan = profilePlan(geometry, data, first, last, anchor.x, width);
  return {
    ...(plan ?? {}),
    lines: [
      ...(plan?.lines ?? []),
      {
        seg: [anchor.x, 0, anchor.x, geometry.height],
        color: GRAY,
        dash: "dashed",
        width: 1,
      },
    ],
    handles: pixels,
  };
};

const anchoredVwap: PlanFn = (drawing, pixels, geometry) => {
  const [anchor] = pixels;
  if (!anchor) return null;
  const { data } = geometry;
  if (!data) return { handles: pixels };
  const first = nearestIndex(data.epochs, drawing.points[0]!.t);
  let priceVolume = 0;
  let volume = 0;
  const pts: XY[] = [];
  for (let index = first; index < data.epochs.length; index += 1) {
    const typical =
      (data.highs[index]! + data.lows[index]! + data.closes[index]!) / 3;
    const traded = data.volumes[index]!;
    priceVolume += typical * traded;
    volume += traded;
    const value = volume > 0 ? priceVolume / volume : typical;
    const at = geometry.toXY({ t: data.epochs[index]!, p: value });
    if (at) pts.push(at);
  }
  const last = pts[pts.length - 1];
  return {
    curves: [{ pts, color: drawing.color, width: 2 }],
    lines: [
      {
        seg: [anchor.x, 0, anchor.x, geometry.height] as Segment,
        color: GRAY,
        dash: "dashed" as const,
        width: 1,
      },
    ],
    labels: last
      ? [{ text: "AVWAP", x: last.x + 6, y: last.y, color: drawing.color }]
      : [],
    handles: [anchor],
  };
};

// ── forecast and measurers ──────────────────────────────────────────────

const positionForecast: PlanFn = (drawing, pixels, geometry) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  const start = drawing.points[0]!;
  const end = drawing.points[1]!;
  const up = end.p >= start.p;
  const color = up ? UP : DOWN;
  const bars = geometry.bars(start.t, end.t);
  const delta = end.p - start.p;
  return {
    polys: [
      {
        pts: [p1, { x: p2.x, y: p1.y }, p2, { x: p1.x, y: p2.y }],
        color,
        alpha: 0.12,
      },
    ],
    lines: [
      { seg: [p1.x, p1.y, p2.x, p1.y], color: GRAY, dash: "dashed", width: 1 },
      { seg: [p1.x, p1.y, p2.x, p2.y], color, width: 2, dash: "solid" },
    ],
    arrows: [{ from: p1, to: p2, color, size: 12 }],
    labels: [
      {
        text: `${delta >= 0 ? "+" : ""}${formatPrice(delta)} (${percent(start.p, end.p)})\n${bars} bars, ${formatDuration(end.t - start.t)}`,
        x: p2.x,
        y: p2.y + (up ? -26 : 26),
        color,
        boxed: true,
        align: "center",
      },
    ],
  };
};

const sector: PlanFn = (_drawing, pixels) => {
  const [centre, a, b] = pixels;
  if (!centre || !a) return null;
  const radius = distance(centre, a);
  if (radius < 2) return null;
  if (!b) {
    return { lines: [{ seg: [centre.x, centre.y, a.x, a.y] as Segment }] };
  }
  const from = Math.atan2(a.y - centre.y, a.x - centre.x);
  let to = Math.atan2(b.y - centre.y, b.x - centre.x);
  while (to - from > Math.PI) to -= Math.PI * 2;
  while (to - from < -Math.PI) to += Math.PI * 2;
  const arc = arcPoints(centre, radius, from, to, 48);
  const end = arc[arc.length - 1]!;
  return {
    polys: [{ pts: [centre, ...arc], color: "#2962FF", alpha: 0.12 }],
    curves: [{ pts: arc }],
    lines: [
      { seg: [centre.x, centre.y, a.x, a.y] as Segment },
      { seg: [centre.x, centre.y, end.x, end.y] as Segment },
    ],
  };
};

const priceRange: PlanFn = (drawing, pixels) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  const start = drawing.points[0]!;
  const end = drawing.points[1]!;
  const up = end.p >= start.p;
  const color = up ? UP : DOWN;
  const x = p2.x;
  const delta = end.p - start.p;
  return {
    polys: [
      {
        pts: [p1, { x: p2.x, y: p1.y }, p2, { x: p1.x, y: p2.y }],
        color,
        alpha: 0.08,
      },
    ],
    lines: [
      { seg: [p1.x, p1.y, x, p1.y], color, dash: "dashed", width: 1 },
      { seg: [p1.x, p2.y, x, p2.y], color, dash: "dashed", width: 1 },
      { seg: [x, p1.y, x, p2.y], color, width: 2, dash: "solid" },
    ],
    arrows: [{ from: p1, to: { x, y: p2.y }, color, size: 10 }],
    labels: [
      {
        text: `${delta >= 0 ? "+" : ""}${formatPrice(delta)} (${percent(start.p, end.p)})`,
        x,
        y: p2.y + (up ? -16 : 16),
        color,
        boxed: true,
        align: "center",
      },
    ],
  };
};

const dateRange: PlanFn = (drawing, pixels, geometry) => {
  const [p1, p2] = pixels;
  if (!p1 || !p2) return null;
  const start = drawing.points[0]!;
  const end = drawing.points[1]!;
  const color = "#2962FF";
  const y = p2.y;
  return {
    polys: [
      {
        pts: [p1, { x: p2.x, y: p1.y }, p2, { x: p1.x, y: p2.y }],
        color,
        alpha: 0.06,
      },
    ],
    lines: [
      { seg: [p1.x, p1.y, p1.x, y], color, dash: "dashed", width: 1 },
      { seg: [p2.x, p1.y, p2.x, y], color, dash: "dashed", width: 1 },
      { seg: [p1.x, y, p2.x, y], color, width: 2, dash: "solid" },
    ],
    arrows: [
      { from: p1, to: { x: p2.x, y }, color, size: 10 },
      { from: { x: p2.x, y }, to: { x: p1.x, y }, color, size: 10 },
    ],
    labels: [
      {
        text: `${geometry.bars(start.t, end.t)} bars, ${formatDuration(end.t - start.t)}`,
        x: (p1.x + p2.x) / 2,
        y: y - 16,
        color,
        boxed: true,
        align: "center",
      },
    ],
  };
};

export const FORECAST_HANDLERS: Partial<Record<DrawingType, ShapeHandler>> = {
  posforecast: planHandler(positionForecast),
  barspattern: planHandler(barsPattern),
  ghostfeed: planHandler(ghostFeed),
  sector: planHandler(sector),
  anchoredvwap: planHandler(anchoredVwap),
  volprofile: planHandler(volumeProfile),
  anchoredvolprofile: planHandler(anchoredProfile),
  pricerange: planHandler(priceRange),
  daterange: planHandler(dateRange),
};

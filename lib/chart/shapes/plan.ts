import type { DashStyle, Drawing } from "../drawings";
import {
  applyStroke,
  arrowHead,
  line,
  polyline,
  segmentsOf,
  tag,
  withAlpha,
  type Geometry,
  type Segment,
  type ShapeHandler,
  type Shapes,
  type XY,
} from "./utils";

export interface PlanLine {
  readonly seg: Segment;
  readonly color?: string;
  readonly width?: number;
  readonly dash?: DashStyle;
}

export interface PlanPoly {
  readonly pts: readonly XY[];
  readonly color: string;
  readonly alpha: number;
}

export interface PlanCurve {
  readonly pts: readonly XY[];
  readonly close?: boolean;
  readonly color?: string;
  readonly width?: number;
  readonly dash?: DashStyle;
  /** Filled with this alpha when set. */
  readonly fill?: number;
}

export interface PlanLabel {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly align?: CanvasTextAlign;
  /** Draw on a coloured tag instead of bare text. */
  readonly boxed?: boolean;
}

export interface PlanArrow {
  readonly from: XY;
  readonly to: XY;
  readonly color?: string;
  readonly size?: number;
}

/** Everything needed to draw and hit-test a tool, computed from its points. */
export interface Plan {
  readonly lines?: readonly PlanLine[];
  readonly polys?: readonly PlanPoly[];
  readonly curves?: readonly PlanCurve[];
  readonly labels?: readonly PlanLabel[];
  readonly arrows?: readonly PlanArrow[];
  /** Extra regions that count as a hit when the cursor is inside. */
  readonly boxes?: readonly (readonly [number, number, number, number])[];
  /** Handles to show when selected; defaults to the anchor points. */
  readonly handles?: readonly XY[];
}

export type PlanFn = (
  drawing: Pick<
    Drawing,
    "points" | "color" | "text" | "id" | "type" | "width" | "dash"
  >,
  pixels: readonly XY[],
  geometry: Geometry,
) => Plan | null;

export function planHandler(compute: PlanFn): ShapeHandler {
  return {
    shapes(drawing, pixels, geometry): Shapes | null {
      const plan = compute(drawing as Drawing, pixels, geometry);
      if (!plan) return null;
      const segments: Segment[] = [];
      for (const entry of plan.lines ?? []) segments.push(entry.seg);
      for (const curve of plan.curves ?? []) {
        segments.push(...segmentsOf(curve.pts, curve.close));
      }
      return {
        segments,
        boxes: plan.boxes ?? [],
        handles: plan.handles ?? pixels,
      };
    },
    render(ctx, drawing, pixels, geometry): void {
      const plan = compute(drawing as Drawing, pixels, geometry);
      if (!plan) return;

      for (const poly of plan.polys ?? []) {
        ctx.fillStyle = withAlpha(poly.color, poly.alpha);
        polyline(ctx, poly.pts, true);
        ctx.fill();
      }
      for (const curve of plan.curves ?? []) {
        const color = curve.color ?? drawing.color;
        if (curve.fill) {
          ctx.fillStyle = withAlpha(color, curve.fill);
          polyline(ctx, curve.pts, true);
          ctx.fill();
        }
        applyStroke(
          ctx,
          color,
          curve.width ?? drawing.width,
          curve.dash ?? drawing.dash,
        );
        polyline(ctx, curve.pts, curve.close);
        ctx.stroke();
      }
      for (const entry of plan.lines ?? []) {
        applyStroke(
          ctx,
          entry.color ?? drawing.color,
          entry.width ?? drawing.width,
          entry.dash ?? drawing.dash,
        );
        line(ctx, entry.seg);
      }
      for (const arrow of plan.arrows ?? []) {
        ctx.setLineDash([]);
        ctx.fillStyle = arrow.color ?? drawing.color;
        arrowHead(ctx, arrow.from, arrow.to, arrow.size);
      }
      for (const label of plan.labels ?? []) {
        if (label.boxed) {
          tag(
            ctx,
            label.text,
            label.x,
            label.y,
            label.color,
            label.align === "right"
              ? "right"
              : label.align === "left"
                ? "left"
                : "center",
          );
        } else {
          ctx.setLineDash([]);
          ctx.font = "600 10.5px Inter, system-ui, sans-serif";
          ctx.fillStyle = label.color;
          ctx.textAlign = label.align ?? "left";
          ctx.textBaseline = "middle";
          ctx.fillText(label.text, label.x, label.y);
        }
      }
    },
  };
}

/** Points on an arc, for circles, spirals and sectors. */
export function arcPoints(
  centre: XY,
  radius: number,
  from: number,
  to: number,
  steps = 48,
): XY[] {
  const points: XY[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = from + ((to - from) * index) / steps;
    points.push({
      x: centre.x + radius * Math.cos(angle),
      y: centre.y + radius * Math.sin(angle),
    });
  }
  return points;
}

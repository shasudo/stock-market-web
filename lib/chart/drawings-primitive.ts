import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from "lightweight-charts";
import { linearRegression } from "./analytics";
import { BarIndex } from "./bar-index";
import {
  hitTestDrawing,
  renderDrawing,
  type Geometry,
  type Hit,
} from "./drawing-render";
import type { Drawing, DrawingPoint } from "./drawings";
import type { BarData } from "./shapes/utils";

const POSITION_TYPES = new Set(["long", "short", "posforecast"]);

type RenderTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

export interface DrawingsState {
  readonly drawings: readonly Drawing[];
  readonly preview: Drawing | null;
  readonly selectedId: string | null;
  readonly hidden: boolean;
  readonly barIndex: BarIndex;
  /** The plotted candles, for tools that read price history. */
  readonly data: BarData | null;
  /** Hide long/short positions and forecasts, as the toolbar's "hide positions". */
  readonly hidePositions: boolean;
}

/**
 * Draws every user drawing in one pass on the main series' pane. Drawing in a
 * primitive (not an overlay canvas) keeps it in step with every zoom, scroll
 * and price-scale change without any event plumbing.
 */
export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType, Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private state: DrawingsState = {
    drawings: [],
    preview: null,
    selectedId: null,
    hidden: false,
    barIndex: new BarIndex([]),
    data: null,
    hidePositions: false,
  };

  private readonly view: IPrimitivePaneView = {
    zOrder: () => "top",
    renderer: () => ({
      draw: (target: RenderTarget) => this.draw(target),
    }),
  };

  public attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart as IChartApi;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  public detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  public paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }

  public updateAllViews(): void {
    // Rendering reads current state on every draw; there is nothing cached.
  }

  public setState(next: Partial<DrawingsState>): void {
    this.state = { ...this.state, ...next };
    this.requestUpdate?.();
  }

  /** Pane geometry for hit testing, or null before the chart has data. */
  public getGeometry(): Geometry | null {
    const chart = this.chart;
    if (!chart) return null;
    const size = chart.paneSize();
    return this.createGeometry(size.width, size.height);
  }

  public findDrawingAt(
    x: number,
    y: number,
  ): { readonly drawing: Drawing; readonly hit: Hit } | null {
    const geometry = this.getGeometry();
    if (!geometry || this.state.hidden) return null;
    for (let index = this.state.drawings.length - 1; index >= 0; index -= 1) {
      const drawing = this.state.drawings[index]!;
      if (this.state.hidePositions && POSITION_TYPES.has(drawing.type))
        continue;
      const hit = hitTestDrawing(
        drawing,
        geometry,
        x,
        y,
        drawing.id === this.state.selectedId,
      );
      if (hit) return { drawing, hit };
    }
    return null;
  }

  /** Cursor position as time and price, or null outside the plotted area. */
  public pointAt(x: number, y: number): DrawingPoint | null {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series) return null;
    const logical = chart.timeScale().coordinateToLogical(x);
    const price = series.coordinateToPrice(y);
    if (logical === null || price === null) return null;
    return { t: this.state.barIndex.toEpoch(logical), p: price };
  }

  private createGeometry(width: number, height: number): Geometry | null {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series) return null;
    const { barIndex } = this.state;
    return {
      width,
      height,
      toXY: (point) => {
        const x = chart
          .timeScale()
          .logicalToCoordinate(barIndex.toLogical(point.t) as Logical);
        const y = series.priceToCoordinate(point.p);
        return x === null || y === null ? null : { x, y };
      },
      regression: (fromTime, toTime) => {
        const closes = this.state.data?.closes ?? [];
        let first = barIndex.nearestIndex(barIndex.toLogical(fromTime));
        let last = barIndex.nearestIndex(barIndex.toLogical(toTime));
        if (first > last) [first, last] = [last, first];
        const fit = linearRegression(closes, first, last);
        if (!fit) return null;
        return {
          start: {
            t: barIndex.epochs[first]!,
            p: fit.slope * first + fit.intercept,
          },
          end: {
            t: barIndex.epochs[last]!,
            p: fit.slope * last + fit.intercept,
          },
          sigma: fit.sigma,
        };
      },
      data: this.state.data ?? undefined,
      invalidate: () => this.requestUpdate?.(),
      bars: (fromTime, toTime) =>
        Math.round(
          Math.abs(barIndex.toLogical(toTime) - barIndex.toLogical(fromTime)),
        ),
    };
  }

  private draw(target: RenderTarget): void {
    const { state } = this;
    if (state.hidden && !state.preview) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const geometry = this.createGeometry(mediaSize.width, mediaSize.height);
      if (!geometry) return;
      if (!state.hidden) {
        for (const drawing of state.drawings) {
          if (state.hidePositions && POSITION_TYPES.has(drawing.type)) continue;
          renderDrawing(context, drawing, geometry, {
            selected: drawing.id === state.selectedId,
          });
        }
      }
      if (state.preview) {
        renderDrawing(context, state.preview, geometry, {
          selected: false,
          preview: true,
        });
      }
    });
  }
}

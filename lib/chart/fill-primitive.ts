import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from "lightweight-charts";

export interface FillBand {
  /** Per-bar values aligned with `times`; null breaks the band. */
  readonly top: ReadonlyArray<number | null>;
  readonly bottom: ReadonlyArray<number | null>;
  readonly times: ReadonlyArray<Time>;
  /** Final rgba() color, opacity already applied. */
  readonly color: string;
}

type RenderTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

/**
 * Fills the region between two indicator plots (or a plot and a constant
 * level) on the indicator's own pane. Bands with no visible overlap draw
 * nothing; nulls split the band so gaps never bridge.
 */
export class FillPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType, Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private bands: readonly FillBand[] = [];

  private readonly view: IPrimitivePaneView = {
    zOrder: () => "bottom",
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
    // Rendering reads the current bands on every draw; nothing is cached.
  }

  public setBands(next: readonly FillBand[]): void {
    this.bands = next;
    this.requestUpdate?.();
  }

  private draw(target: RenderTarget): void {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series || this.bands.length === 0) return;
    target.useMediaCoordinateSpace(({ context }) => {
      for (const band of this.bands) {
        this.drawBand(context, band);
      }
    });
  }

  private drawBand(
    context: CanvasRenderingContext2D,
    band: FillBand,
  ): void {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series) return;
    const length = Math.min(
      band.top.length,
      band.bottom.length,
      band.times.length,
    );
    let open = false;
    context.beginPath();
    const flush = (): void => {
      if (!open) return;
      context.closePath();
      context.fillStyle = band.color;
      context.fill();
      context.beginPath();
      open = false;
    };
    // Forward pass along the top edge, remembering the bottom edge so the
    // polygon can return along it.
    const bottomEdge: Array<{ x: number; y: number }> = [];
    for (let index = 0; index < length; index += 1) {
      const top = band.top[index];
      const bottom = band.bottom[index];
      const time = band.times[index];
      if (
        top === null ||
        top === undefined ||
        bottom === null ||
        bottom === undefined ||
        time === undefined ||
        !Number.isFinite(top) ||
        !Number.isFinite(bottom)
      ) {
        // Close the current polygon through the accumulated bottom edge.
        if (open) {
          for (let back = bottomEdge.length - 1; back >= 0; back -= 1) {
            const point = bottomEdge[back]!;
            context.lineTo(point.x, point.y);
          }
          flush();
          bottomEdge.length = 0;
        }
        continue;
      }
      const x = chart.timeScale().timeToCoordinate(time);
      const yTop = series.priceToCoordinate(top);
      const yBottom = series.priceToCoordinate(bottom);
      if (x === null || yTop === null || yBottom === null) {
        if (open) {
          for (let back = bottomEdge.length - 1; back >= 0; back -= 1) {
            const point = bottomEdge[back]!;
            context.lineTo(point.x, point.y);
          }
          flush();
          bottomEdge.length = 0;
        }
        continue;
      }
      if (!open) {
        context.moveTo(x, yTop);
        open = true;
      } else {
        context.lineTo(x, yTop);
      }
      bottomEdge.push({ x, y: yBottom });
    }
    if (open) {
      for (let back = bottomEdge.length - 1; back >= 0; back -= 1) {
        const point = bottomEdge[back]!;
        context.lineTo(point.x, point.y);
      }
      flush();
    }
  }
}

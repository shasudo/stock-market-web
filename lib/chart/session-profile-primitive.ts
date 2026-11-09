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

/**
 * TradingView-style Session Volume Profile overlay.
 *
 * For every session, within the box spanning the session's first to last bar:
 *  - the value-area background between VAL and VAH,
 *  - one horizontal row per price bucket, split into up volume then down
 *    volume (TradingView's "Up/Down" mode), bright inside the value area and
 *    faded outside it; "Total" and "Delta" modes draw one bar per row,
 *  - the POC across the whole box (optionally extended to the right edge)
 *    and the VAH/VAL segments.
 * For the latest session it can also draw the previous session's POC/VAH/VAL
 * and high/low as labelled lines to the right edge, the initial balance, and
 * a summary table, like the HexaTrades SVP reference.
 */

export interface ProfileDrawBucket {
  readonly top: number;
  readonly bottom: number;
  readonly volume: number;
  readonly upVolume: number;
  readonly downVolume: number;
  readonly inValueArea: boolean;
}

export interface ProfileDrawSession {
  readonly startTime: Time;
  readonly endTime: Time;
  readonly poc: number;
  readonly vah: number;
  readonly val: number;
  readonly high: number;
  readonly low: number;
  readonly ibHigh: number | null;
  readonly ibLow: number | null;
  readonly maxRowVolume: number;
  readonly maxRowDelta: number;
  readonly buckets: readonly ProfileDrawBucket[];
}

export type ProfileVolumeMode = "updown" | "total" | "delta";

export interface ProfileLine {
  readonly visible: boolean;
  readonly color: string;
  readonly width: number;
  readonly style: "solid" | "dashed" | "dotted";
}

export interface SessionProfileStyle {
  readonly volumeMode: ProfileVolumeMode;
  readonly placement: "left" | "right";
  /** Longest row as a percent of the session box width. */
  readonly widthPct: number;
  readonly showHistogram: boolean;
  /** Value-area background; null hides it. */
  readonly valueAreaFill: string | null;
  readonly insideUp: string;
  readonly insideDown: string;
  readonly outsideUp: string;
  readonly outsideDown: string;
  readonly poc: ProfileLine;
  readonly vah: ProfileLine;
  readonly val: ProfileLine;
  readonly extendPocRight: boolean;
  readonly showPrevious: boolean;
  readonly showInitialBalance: boolean;
  readonly showTable: boolean;
  readonly dark: boolean;
}

export const DEFAULT_PROFILE_STYLE: SessionProfileStyle = {
  volumeMode: "updown",
  placement: "left",
  widthPct: 40,
  showHistogram: true,
  valueAreaFill: "rgba(38,198,218,0.08)",
  insideUp: "rgba(38,198,218,0.8)",
  insideDown: "rgba(236,64,122,0.8)",
  outsideUp: "rgba(38,198,218,0.35)",
  outsideDown: "rgba(236,64,122,0.35)",
  poc: { visible: true, color: "#ef5350", width: 2, style: "solid" },
  vah: { visible: false, color: "#2962ff", width: 1, style: "solid" },
  val: { visible: false, color: "#2962ff", width: 1, style: "solid" },
  extendPocRight: false,
  showPrevious: false,
  showInitialBalance: false,
  showTable: false,
  dark: false,
};

const PREVIOUS_COLORS = {
  poc: "#787b86",
  value: "#5b9cf6",
  high: "#f23645",
  low: "#089981",
  ib: "#ff9800",
} as const;

type RenderTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];
type Layer = "lines" | "labels";
type Context = CanvasRenderingContext2D;

const FONT = "11px -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";

function dash(style: ProfileLine["style"], width: number): number[] {
  if (style === "dashed") return [6 * width, 4 * width];
  if (style === "dotted") return [width, 3 * width];
  return [];
}

function formatPrice(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export class SessionVolumeProfilePrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType, Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private sessions: readonly ProfileDrawSession[] = [];
  private style: SessionProfileStyle = DEFAULT_PROFILE_STYLE;
  private lastClose: number | null = null;

  // Histogram and lines sit behind the candles; the price labels and the
  // table sit in front of them so candles never paint over their text.
  private readonly views: readonly IPrimitivePaneView[] = [
    {
      zOrder: () => "bottom",
      renderer: () => ({ draw: (target: RenderTarget) => this.draw(target, "lines") }),
    },
    {
      zOrder: () => "top",
      renderer: () => ({ draw: (target: RenderTarget) => this.draw(target, "labels") }),
    },
  ];

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
    return this.views;
  }

  public updateAllViews(): void {
    // Rendering reads the current sessions on every draw.
  }

  public setSessions(
    sessions: readonly ProfileDrawSession[],
    style: Partial<SessionProfileStyle> = {},
    lastClose: number | null = null,
  ): void {
    this.sessions = sessions;
    this.style = { ...DEFAULT_PROFILE_STYLE, ...style };
    this.lastClose = lastClose;
    this.requestUpdate?.();
  }

  private draw(target: RenderTarget, layer: Layer): void {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series || this.sessions.length === 0) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const barSpacing = chart.timeScale().options().barSpacing;
      const y = (price: number): number | null => series.priceToCoordinate(price);
      if (layer === "lines") {
        for (const session of this.sessions) {
          this.drawSession(context, chart, y, session, barSpacing, mediaSize.width);
        }
      }
      const latest = this.sessions[this.sessions.length - 1]!;
      const previous = this.sessions.length > 1 ? this.sessions[this.sessions.length - 2]! : null;
      const box = this.box(chart, latest, barSpacing);
      if (box && previous && this.style.showPrevious) {
        this.drawPrevious(context, y, previous, box.left, mediaSize.width, layer);
      }
      if (box && this.style.showInitialBalance) {
        this.drawInitialBalance(context, y, latest, box.left, mediaSize.width, layer);
      }
      if (layer === "labels" && this.style.showTable) {
        this.drawTable(context, latest, previous, mediaSize.width);
      }
    });
  }

  private box(
    chart: IChartApi,
    session: ProfileDrawSession,
    barSpacing: number,
  ): { left: number; right: number } | null {
    const x1 = chart.timeScale().timeToCoordinate(session.startTime);
    const x2 = chart.timeScale().timeToCoordinate(session.endTime);
    if (x1 === null || x2 === null) return null;
    return {
      left: Math.min(x1, x2) - barSpacing / 2,
      right: Math.max(x1, x2) + barSpacing / 2,
    };
  }

  private drawSession(
    context: Context,
    chart: IChartApi,
    y: (price: number) => number | null,
    session: ProfileDrawSession,
    barSpacing: number,
    paneWidth: number,
  ): void {
    const box = this.box(chart, session, barSpacing);
    if (!box) return;
    const { left, right } = box;
    if (right < 0 || left > paneWidth || right - left < 2) return;
    const style = this.style;

    if (style.valueAreaFill) {
      const yVah = y(session.vah);
      const yVal = y(session.val);
      if (yVah !== null && yVal !== null) {
        context.fillStyle = style.valueAreaFill;
        context.fillRect(left, Math.min(yVah, yVal), right - left, Math.abs(yVal - yVah));
      }
    }

    if (style.showHistogram) this.drawRows(context, y, session, left, right);

    this.drawLevel(context, y, session.vah, left, right, style.vah);
    this.drawLevel(context, y, session.val, left, right, style.val);
    const isLatest = session === this.sessions[this.sessions.length - 1];
    this.drawLevel(
      context,
      y,
      session.poc,
      left,
      style.extendPocRight && isLatest ? paneWidth : right,
      style.poc,
    );
  }

  private drawRows(
    context: Context,
    y: (price: number) => number | null,
    session: ProfileDrawSession,
    left: number,
    right: number,
  ): void {
    const style = this.style;
    const maxWidth = Math.max(4, ((right - left) * Math.min(100, Math.max(5, style.widthPct))) / 100);
    const scale =
      style.volumeMode === "delta" ? session.maxRowDelta : session.maxRowVolume;
    if (!(scale > 0)) return;
    const anchorRight = style.placement === "right";

    const fill = (x: number, top: number, width: number, height: number, color: string): void => {
      if (width <= 0) return;
      context.fillStyle = color;
      context.fillRect(anchorRight ? right - x - width : left + x, top, width, height);
    };

    for (const bucket of session.buckets) {
      if (!(bucket.volume > 0)) continue;
      const yTop = y(bucket.top);
      const yBottom = y(bucket.bottom);
      if (yTop === null || yBottom === null) continue;
      const top = Math.min(yTop, yBottom);
      const full = Math.abs(yBottom - yTop);
      // TradingView leaves a hairline between rows once they are tall enough.
      const height = full > 3 ? full - 1 : Math.max(1, full);
      const up = bucket.inValueArea ? style.insideUp : style.outsideUp;
      const down = bucket.inValueArea ? style.insideDown : style.outsideDown;

      if (style.volumeMode === "updown") {
        const upWidth = (bucket.upVolume / scale) * maxWidth;
        const downWidth = (bucket.downVolume / scale) * maxWidth;
        fill(0, top, upWidth, height, up);
        fill(upWidth, top, downWidth, height, down);
      } else if (style.volumeMode === "total") {
        fill(0, top, (bucket.volume / scale) * maxWidth, height, up);
      } else {
        const delta = bucket.upVolume - bucket.downVolume;
        fill(0, top, (Math.abs(delta) / scale) * maxWidth, height, delta >= 0 ? up : down);
      }
    }
  }

  private drawLevel(
    context: Context,
    y: (price: number) => number | null,
    price: number,
    left: number,
    right: number,
    line: ProfileLine,
  ): void {
    if (!line.visible) return;
    const at = y(price);
    if (at === null) return;
    const crisp = Math.round(at) + (line.width % 2 ? 0.5 : 0);
    context.save();
    context.strokeStyle = line.color;
    context.lineWidth = line.width;
    context.setLineDash(dash(line.style, line.width));
    context.beginPath();
    context.moveTo(left, crisp);
    context.lineTo(right, crisp);
    context.stroke();
    context.restore();
  }

  private drawLabelledLine(
    context: Context,
    y: (price: number) => number | null,
    price: number | null,
    left: number,
    paneWidth: number,
    color: string,
    lineStyle: ProfileLine["style"],
    label: string,
    layer: Layer,
  ): void {
    if (price === null || !Number.isFinite(price)) return;
    const at = y(price);
    if (at === null) return;
    const text = `${label} ${formatPrice(price)}`;
    context.save();
    context.font = FONT;
    const textWidth = context.measureText(text).width;
    const pillWidth = textWidth + 10;
    const pillLeft = paneWidth - pillWidth - 6;
    if (layer === "lines") {
      const crisp = Math.round(at) + 0.5;
      context.strokeStyle = color;
      context.lineWidth = lineStyle === "solid" ? 1 : 1.5;
      context.setLineDash(dash(lineStyle, 1.5));
      context.beginPath();
      context.moveTo(Math.max(0, left), crisp);
      context.lineTo(pillLeft - 4, crisp);
      context.stroke();
      context.restore();
      return;
    }
    context.fillStyle = this.style.dark ? "rgba(19,23,34,0.92)" : "rgba(255,255,255,0.92)";
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(pillLeft, at - 8, pillWidth, 16, 3);
    context.fill();
    context.stroke();
    context.fillStyle = color;
    context.textBaseline = "middle";
    context.fillText(text, pillLeft + 5, at + 0.5);
    context.restore();
  }

  private drawPrevious(
    context: Context,
    y: (price: number) => number | null,
    previous: ProfileDrawSession,
    left: number,
    paneWidth: number,
    layer: Layer,
  ): void {
    this.drawLabelledLine(context, y, previous.high, left, paneWidth, PREVIOUS_COLORS.high, "dotted", "PDH", layer);
    this.drawLabelledLine(context, y, previous.vah, left, paneWidth, PREVIOUS_COLORS.value, "dashed", "pVAH", layer);
    this.drawLabelledLine(context, y, previous.poc, left, paneWidth, PREVIOUS_COLORS.poc, "solid", "pPOC", layer);
    this.drawLabelledLine(context, y, previous.val, left, paneWidth, PREVIOUS_COLORS.value, "dashed", "pVAL", layer);
    this.drawLabelledLine(context, y, previous.low, left, paneWidth, PREVIOUS_COLORS.low, "dotted", "PDL", layer);
  }

  private drawInitialBalance(
    context: Context,
    y: (price: number) => number | null,
    latest: ProfileDrawSession,
    left: number,
    paneWidth: number,
    layer: Layer,
  ): void {
    this.drawLabelledLine(context, y, latest.ibHigh, left, paneWidth, PREVIOUS_COLORS.ib, "solid", "IBH", layer);
    this.drawLabelledLine(context, y, latest.ibLow, left, paneWidth, PREVIOUS_COLORS.ib, "solid", "IBL", layer);
  }

  private drawTable(
    context: Context,
    latest: ProfileDrawSession,
    previous: ProfileDrawSession | null,
    paneWidth: number,
  ): void {
    const close = this.lastClose;
    const location =
      close === null
        ? "–"
        : close > latest.vah
          ? "Above Value"
          : close < latest.val
            ? "Below Value"
            : "Inside Value";
    const locationColor =
      location === "Above Value" ? "#089981" : location === "Below Value" ? "#f23645" : "#787b86";
    const rows: [string, string, string][] = [
      ["Price Location", location, locationColor],
      ["Session POC", formatPrice(latest.poc), PREVIOUS_COLORS.poc],
      ["Session VAH", formatPrice(latest.vah), PREVIOUS_COLORS.value],
      ["Session VAL", formatPrice(latest.val), PREVIOUS_COLORS.value],
    ];
    if (previous) {
      rows.push(
        ["Prev POC", formatPrice(previous.poc), PREVIOUS_COLORS.poc],
        ["Prev VAH", formatPrice(previous.vah), PREVIOUS_COLORS.value],
        ["Prev VAL", formatPrice(previous.val), PREVIOUS_COLORS.value],
        ["PDH", formatPrice(previous.high), PREVIOUS_COLORS.high],
        ["PDL", formatPrice(previous.low), PREVIOUS_COLORS.low],
      );
    }
    if (latest.ibHigh !== null && latest.ibLow !== null) {
      rows.push(
        ["IBH", formatPrice(latest.ibHigh), PREVIOUS_COLORS.ib],
        ["IBL", formatPrice(latest.ibLow), PREVIOUS_COLORS.ib],
      );
    }

    context.save();
    context.font = FONT;
    const rowHeight = 18;
    const width = 210;
    const height = rowHeight * (rows.length + 1) + 6;
    const left = paneWidth - width - 10;
    // Clears the chart's one-line header (symbol, OHLC, buy/sell).
    const top = 30;
    const dark = this.style.dark;
    context.fillStyle = dark ? "rgba(30,34,45,0.94)" : "rgba(19,23,34,0.9)";
    context.beginPath();
    context.roundRect(left, top, width, height, 4);
    context.fill();
    context.textBaseline = "middle";
    context.fillStyle = "#d1d4dc";
    context.font = `bold ${FONT}`;
    context.fillText("SVP · SESSION", left + 8, top + 3 + rowHeight / 2);
    context.font = FONT;
    rows.forEach(([label, value, color], index) => {
      const rowY = top + 3 + rowHeight * (index + 1) + rowHeight / 2;
      context.fillStyle = "#9598a1";
      context.fillText(label, left + 8, rowY);
      context.fillStyle = color === PREVIOUS_COLORS.poc ? "#d1d4dc" : color;
      const valueWidth = context.measureText(value).width;
      context.fillText(value, left + width - 8 - valueWidth, rowY);
    });
    context.restore();
  }
}

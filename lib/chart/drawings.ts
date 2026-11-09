import {
  CHART_TIMEFRAMES,
  isChartTimeframe,
  type ChartTimeframe,
} from "@/lib/market/chart-candles";

export type DrawingType =
  // lines
  | "trend"
  | "ray"
  | "info"
  | "extended"
  | "angle"
  | "hline"
  | "hray"
  | "vline"
  | "crossline"
  // channels
  | "channel"
  | "regression"
  | "flat"
  | "disjoint"
  // pitchforks
  | "pitchfork"
  | "schiff"
  | "modschiff"
  | "insidefork"
  // fibonacci and gann
  | "fib"
  | "fibext"
  | "fibchannel"
  | "fibtimezone"
  | "fibfan"
  | "fibtime"
  | "fibcircles"
  | "fibspiral"
  | "fibarcs"
  | "fibwedge"
  | "pitchfan"
  | "gannbox"
  | "gannfixed"
  | "gannsquare"
  | "gannfan"
  // chart patterns, elliott waves, cycles
  | "xabcd"
  | "cypher"
  | "headshoulders"
  | "abcd"
  | "trianglepattern"
  | "threedrives"
  | "elliottimpulse"
  | "elliottcorrection"
  | "elliotttriangle"
  | "elliottdouble"
  | "elliotttriple"
  | "cyclic"
  | "timecycles"
  | "sine"
  // forecasting, volume, measurers
  | "long"
  | "short"
  | "posforecast"
  | "barspattern"
  | "ghostfeed"
  | "sector"
  | "anchoredvwap"
  | "volprofile"
  | "anchoredvolprofile"
  | "pricerange"
  | "daterange"
  | "measure"
  // brushes, arrows, shapes
  | "brush"
  | "highlighter"
  | "arrowmarker"
  | "arrow"
  | "arrowup"
  | "arrowdown"
  | "rect"
  | "rotatedrect"
  | "path"
  | "circle"
  | "ellipse"
  | "polyline"
  | "triangle"
  | "arc"
  | "curve"
  | "doublecurve"
  // annotations and content
  | "text"
  | "note"
  | "pricenote"
  | "pin"
  | "table"
  | "callout"
  | "comment"
  | "pricelabel"
  | "signpost"
  | "flag"
  | "image"
  | "post"
  | "idea"
  | "emoji";

export type DashStyle = "solid" | "dashed" | "dotted";

/** A point in time (unix seconds) and price, independent of the timeframe. */
export interface DrawingPoint {
  readonly t: number;
  readonly p: number;
}

export interface Drawing {
  readonly id: string;
  readonly type: DrawingType;
  readonly points: readonly DrawingPoint[];
  readonly color: string;
  readonly width: number;
  readonly dash: DashStyle;
  readonly text?: string;
  /** Text colour for drawings that render a label. */
  readonly textColor?: string;
  /** Stacking order; higher paints later (on top). */
  readonly z: number;
  /** Hidden drawings stay saved but never paint or hit-test. */
  readonly hidden: boolean;
  /** Locked drawings cannot move, restyle or delete. */
  readonly locked: boolean;
  /** Which timeframes paint this drawing. */
  readonly visibleOn: DrawingVisibilityScope;
  /**
   * Interval pinned when the scope was chosen; null keeps legacy drawings
   * visible everywhere.
   */
  readonly visibleTimeframe: ChartTimeframe | null;
}

/**
 * Which timeframes show a drawing, mirroring TradingView's
 * "Visibility on intervals" menu.
 */
export type DrawingVisibilityScope =
  "all" | "current" | "current-and-above" | "current-and-below";

export const DRAWING_VISIBILITY_SCOPES: readonly {
  readonly id: DrawingVisibilityScope;
  readonly label: string;
}[] = [
  { id: "all", label: "All intervals" },
  { id: "current-and-above", label: "Current interval and above" },
  { id: "current-and-below", label: "Current interval and below" },
  { id: "current", label: "Current interval only" },
];

export function isDrawingVisibilityScope(
  value: unknown,
): value is DrawingVisibilityScope {
  return DRAWING_VISIBILITY_SCOPES.some((entry) => entry.id === value);
}

const TIMEFRAME_RANK: Readonly<Record<ChartTimeframe, number>> =
  Object.fromEntries(
    CHART_TIMEFRAMES.map((timeframe, index) => [timeframe, index]),
  ) as Record<ChartTimeframe, number>;

/**
 * Whether a drawing paints on the given interval. Hidden drawings never
 * paint; drawings saved before visibility existed (null pin) paint
 * everywhere so nothing the user drew disappears.
 */
export function isDrawingVisibleOn(
  drawing: Pick<Drawing, "hidden" | "visibleOn" | "visibleTimeframe">,
  timeframe: ChartTimeframe,
): boolean {
  if (drawing.hidden) return false;
  if (drawing.visibleOn === "all" || drawing.visibleTimeframe === null) {
    return true;
  }
  const current = TIMEFRAME_RANK[timeframe];
  const pinned = TIMEFRAME_RANK[drawing.visibleTimeframe];
  switch (drawing.visibleOn) {
    case "current":
      return current === pinned;
    case "current-and-above":
      return current >= pinned;
    case "current-and-below":
      return current <= pinned;
  }
}

/** Paint order: lower `z` first so higher `z` lands on top. */
export function sortByVisualOrder(drawings: readonly Drawing[]): Drawing[] {
  return [...drawings].sort((a, b) => a.z - b.z);
}

export type VisualOrderDirection = "front" | "back" | "forward" | "backward";

/**
 * TradingView's Visual order operations, expressed as `z` changes. Bring
 * forward/backward swap with the neighbour in that direction and no-op at
 * the ends.
 */
export function reorderDrawing(
  drawings: readonly Drawing[],
  id: string,
  direction: VisualOrderDirection,
): Drawing[] {
  const target = drawings.find((entry) => entry.id === id);
  if (!target) return [...drawings];
  const ordered = sortByVisualOrder(drawings);
  if (direction === "front") {
    const top = ordered[ordered.length - 1]?.z ?? 0;
    return drawings.map((entry) =>
      entry.id === id ? { ...entry, z: top + 1 } : entry,
    );
  }
  if (direction === "back") {
    const bottom = ordered[0]?.z ?? 0;
    return drawings.map((entry) =>
      entry.id === id ? { ...entry, z: bottom - 1 } : entry,
    );
  }
  const position = ordered.findIndex((entry) => entry.id === id);
  const neighbour =
    direction === "forward" ? ordered[position + 1] : ordered[position - 1];
  if (!neighbour) return [...drawings];
  const targetZ = target.z;
  return drawings.map((entry) => {
    if (entry.id === id) return { ...entry, z: neighbour.z };
    if (entry.id === neighbour.id) return { ...entry, z: targetZ };
    return entry;
  });
}

/** Duplicate with a fresh id, optionally shifted in time and price. */
export function cloneDrawing(
  drawing: Drawing,
  deltaTime = 0,
  deltaPrice = 0,
): Drawing {
  return {
    ...moveDrawing(drawing, deltaTime, deltaPrice),
    id: createDrawingId(),
  };
}

/** Which left-toolbar button a tool lives under. */
export type ToolGroup =
  | "lines"
  | "fib"
  | "patterns"
  | "forecast"
  | "shapes"
  | "annotation"
  | "emoji"
  | "measure";

export type TextMode =
  /** Opens a text box when the drawing is placed. */
  | "prompt"
  /** Text is the price at the placed point. */
  | "price"
  /** Opens a file picker for an image. */
  | "image";

export interface ToolShortcut {
  /** Physical key letter, matched on the keyboard code. */
  readonly key: string;
  readonly shift?: boolean;
}

export interface ToolDefinition {
  readonly type: DrawingType;
  readonly label: string;
  readonly group: ToolGroup;
  /** Heading inside the flyout, e.g. "Channels". */
  readonly section: string;
  /**
   * Clicks needed to place it. "drag" collects points while the mouse is held;
   * "multi" keeps adding points until double-click or Enter (at least `minPoints`).
   */
  readonly points: number | "drag" | "multi";
  readonly minPoints?: number;
  readonly hint: string;
  readonly defaultColor: string;
  readonly text?: TextMode;
  /** Alt + key (plus Shift when set) activates the tool. */
  readonly shortcut?: ToolShortcut;
  /** Shown as a "?" next to the row, as for the less obvious tools. */
  readonly help?: string;
}

const BLUE = "#2962FF";
const ORANGE = "#F57C00";
const GREEN = "#089981";
const RED = "#F23645";
const PURPLE = "#7E57C2";
const GRAY = "#787B86";
const PINK = "#E91E63";
const INK = "#1D1D1F";

type Extra = Pick<ToolDefinition, "text" | "shortcut" | "help" | "minPoints">;

function tool(
  type: DrawingType,
  label: string,
  group: ToolGroup,
  section: string,
  points: ToolDefinition["points"],
  hint: string,
  defaultColor: string,
  extra: Extra = {},
): ToolDefinition {
  return { type, label, group, section, points, hint, defaultColor, ...extra };
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  tool(
    "trend",
    "Trendline",
    "lines",
    "Lines",
    2,
    "Click the start, then the end",
    BLUE,
    { shortcut: { key: "T" } },
  ),
  tool(
    "ray",
    "Ray",
    "lines",
    "Lines",
    2,
    "Click the start, then a point to extend through",
    BLUE,
  ),
  tool(
    "info",
    "Info line",
    "lines",
    "Lines",
    2,
    "Click the start, then the end",
    BLUE,
  ),
  tool(
    "extended",
    "Extended line",
    "lines",
    "Lines",
    2,
    "Click two points on the line",
    BLUE,
  ),
  tool(
    "angle",
    "Trend angle",
    "lines",
    "Lines",
    2,
    "Click the start, then the end",
    BLUE,
  ),
  tool(
    "hline",
    "Horizontal line",
    "lines",
    "Lines",
    1,
    "Click to place at a price",
    ORANGE,
    { shortcut: { key: "H" } },
  ),
  tool(
    "hray",
    "Horizontal ray",
    "lines",
    "Lines",
    1,
    "Click to place a ray at a price",
    ORANGE,
    { shortcut: { key: "J" } },
  ),
  tool(
    "vline",
    "Vertical line",
    "lines",
    "Lines",
    1,
    "Click to place at a time",
    PURPLE,
    { shortcut: { key: "V" } },
  ),
  tool(
    "crossline",
    "Crossline",
    "lines",
    "Lines",
    1,
    "Click to place at a time and price",
    PURPLE,
    { shortcut: { key: "C" } },
  ),
  tool(
    "channel",
    "Parallel channel",
    "lines",
    "Channels",
    3,
    "Click two points, then the channel width",
    GREEN,
  ),
  tool(
    "regression",
    "Regression trend",
    "lines",
    "Channels",
    2,
    "Click the first bar, then the last bar",
    GREEN,
  ),
  tool(
    "flat",
    "Flat top/bottom",
    "lines",
    "Channels",
    3,
    "Click two points, then the flat level",
    GREEN,
  ),
  tool(
    "disjoint",
    "Disjoint channel",
    "lines",
    "Channels",
    4,
    "Click two points for each line",
    GREEN,
  ),
  tool(
    "pitchfork",
    "Pitchfork",
    "lines",
    "Pitchforks",
    3,
    "Click the pivot, then the two swing points",
    RED,
  ),
  tool(
    "schiff",
    "Schiff pitchfork",
    "lines",
    "Pitchforks",
    3,
    "Click the pivot, then the two swing points",
    RED,
  ),
  tool(
    "modschiff",
    "Modified Schiff pitchfork",
    "lines",
    "Pitchforks",
    3,
    "Click the pivot, then the two swing points",
    RED,
  ),
  tool(
    "insidefork",
    "Inside pitchfork",
    "lines",
    "Pitchforks",
    3,
    "Click the pivot, then the two swing points",
    RED,
  ),

  tool(
    "fib",
    "Fib retracement",
    "fib",
    "Fibonacci",
    2,
    "Click the swing start, then the swing end",
    GRAY,
    { shortcut: { key: "F" } },
  ),
  tool(
    "fibext",
    "Trend-based fib extension",
    "fib",
    "Fibonacci",
    3,
    "Click the move start, the move end, then the retracement",
    GRAY,
    {
      help: "Projects levels from the third point using the size of the first move.",
    },
  ),
  tool(
    "fibchannel",
    "Fib channel",
    "fib",
    "Fibonacci",
    3,
    "Click two points, then the channel width",
    GRAY,
  ),
  tool(
    "fibtimezone",
    "Fib time zone",
    "fib",
    "Fibonacci",
    2,
    "Click two points that set the unit width",
    GRAY,
  ),
  tool(
    "fibfan",
    "Fib speed resistance fan",
    "fib",
    "Fibonacci",
    2,
    "Click the start, then the end of the move",
    GRAY,
  ),
  tool(
    "fibtime",
    "Trend-based fib time",
    "fib",
    "Fibonacci",
    3,
    "Click the move start, the move end, then the anchor",
    GRAY,
  ),
  tool(
    "fibcircles",
    "Fib circles",
    "fib",
    "Fibonacci",
    2,
    "Click two points that set the radius",
    GRAY,
  ),
  tool(
    "fibspiral",
    "Fib spiral",
    "fib",
    "Fibonacci",
    2,
    "Click the centre, then the start of the spiral",
    GRAY,
  ),
  tool(
    "fibarcs",
    "Fib speed resistance arcs",
    "fib",
    "Fibonacci",
    2,
    "Click the centre, then the end of the move",
    GRAY,
  ),
  tool(
    "fibwedge",
    "Fib wedge",
    "fib",
    "Fibonacci",
    3,
    "Click the centre, then the two wedge edges",
    GRAY,
  ),
  tool(
    "pitchfan",
    "Pitchfan",
    "fib",
    "Fibonacci",
    3,
    "Click the pivot, then the two swing points",
    GRAY,
  ),
  tool(
    "gannbox",
    "Gann box",
    "fib",
    "Gann",
    2,
    "Click two opposite corners",
    ORANGE,
  ),
  tool(
    "gannfixed",
    "Gann square fixed",
    "fib",
    "Gann",
    2,
    "Click the corner, then set the size",
    ORANGE,
  ),
  tool(
    "gannsquare",
    "Gann square",
    "fib",
    "Gann",
    2,
    "Click two opposite corners",
    ORANGE,
  ),
  tool(
    "gannfan",
    "Gann fan",
    "fib",
    "Gann",
    2,
    "Click the pivot, then the 1x1 point",
    ORANGE,
  ),

  tool(
    "xabcd",
    "XABCD pattern",
    "patterns",
    "Chart patterns",
    5,
    "Click X, A, B, C, then D",
    BLUE,
  ),
  tool(
    "cypher",
    "Cypher pattern",
    "patterns",
    "Chart patterns",
    5,
    "Click X, A, B, C, then D",
    BLUE,
  ),
  tool(
    "headshoulders",
    "Head and shoulders",
    "patterns",
    "Chart patterns",
    7,
    "Click the 7 pivots in order",
    BLUE,
    {
      help: "Click the start, left shoulder, left trough, head, right trough, right shoulder, then the end.",
    },
  ),
  tool(
    "abcd",
    "ABCD pattern",
    "patterns",
    "Chart patterns",
    4,
    "Click A, B, C, then D",
    BLUE,
  ),
  tool(
    "trianglepattern",
    "Triangle pattern",
    "patterns",
    "Chart patterns",
    4,
    "Click A, B, C, then D",
    BLUE,
  ),
  tool(
    "threedrives",
    "Three drives pattern",
    "patterns",
    "Chart patterns",
    7,
    "Click the 7 pivots in order",
    BLUE,
  ),
  tool(
    "elliottimpulse",
    "Elliott impulse wave (1·2·3·4·5)",
    "patterns",
    "Elliott waves",
    6,
    "Click the wave 0 start, then waves 1 to 5",
    BLUE,
  ),
  tool(
    "elliottcorrection",
    "Elliott correction wave (A·B·C)",
    "patterns",
    "Elliott waves",
    4,
    "Click the start, then A, B and C",
    BLUE,
  ),
  tool(
    "elliotttriangle",
    "Elliott triangle wave (A·B·C·D·E)",
    "patterns",
    "Elliott waves",
    6,
    "Click the start, then A to E",
    BLUE,
  ),
  tool(
    "elliottdouble",
    "Elliott double combo wave (W·X·Y)",
    "patterns",
    "Elliott waves",
    4,
    "Click the start, then W, X and Y",
    BLUE,
  ),
  tool(
    "elliotttriple",
    "Elliott triple combo wave (W·X·Y·X·Z)",
    "patterns",
    "Elliott waves",
    6,
    "Click the start, then W, X, Y, X and Z",
    BLUE,
  ),
  tool(
    "cyclic",
    "Cyclic lines",
    "patterns",
    "Cycles",
    2,
    "Click two points that set the period",
    PURPLE,
  ),
  tool(
    "timecycles",
    "Time cycles",
    "patterns",
    "Cycles",
    2,
    "Click two points that set the period",
    PURPLE,
  ),
  tool(
    "sine",
    "Sine line",
    "patterns",
    "Cycles",
    2,
    "Click the start, then a peak",
    PURPLE,
  ),

  tool(
    "long",
    "Long position",
    "forecast",
    "Forecasting",
    3,
    "Click entry, target, then stop",
    GREEN,
  ),
  tool(
    "short",
    "Short position",
    "forecast",
    "Forecasting",
    3,
    "Click entry, target, then stop",
    RED,
  ),
  tool(
    "posforecast",
    "Position forecast",
    "forecast",
    "Forecasting",
    2,
    "Click the entry, then the forecast target",
    BLUE,
  ),
  tool(
    "barspattern",
    "Bars pattern",
    "forecast",
    "Forecasting",
    3,
    "Click the first and last bar, then where to copy it",
    BLUE,
    { help: "Copies the selected bars to a new place on the chart." },
  ),
  tool(
    "ghostfeed",
    "Ghost feed",
    "forecast",
    "Forecasting",
    2,
    "Click the first and last bar to project after the latest bar",
    GRAY,
    { help: "Projects the selected bars forward from the newest candle." },
  ),
  tool(
    "sector",
    "Sector",
    "forecast",
    "Forecasting",
    3,
    "Click the centre, the start, then the end of the sector",
    BLUE,
  ),
  tool(
    "anchoredvwap",
    "Anchored VWAP",
    "forecast",
    "Volume-based",
    1,
    "Click the bar to anchor the VWAP",
    ORANGE,
  ),
  tool(
    "volprofile",
    "Fixed range volume profile",
    "forecast",
    "Volume-based",
    2,
    "Click the first and last bar of the range",
    BLUE,
  ),
  tool(
    "anchoredvolprofile",
    "Anchored volume profile",
    "forecast",
    "Volume-based",
    1,
    "Click the bar to start the profile",
    BLUE,
  ),
  tool(
    "pricerange",
    "Price range",
    "forecast",
    "Measurers",
    2,
    "Click the start, then the end",
    BLUE,
  ),
  tool(
    "daterange",
    "Date range",
    "forecast",
    "Measurers",
    2,
    "Click the start, then the end",
    BLUE,
  ),
  tool(
    "measure",
    "Date and price range",
    "forecast",
    "Measurers",
    2,
    "Click the start, then the end",
    BLUE,
  ),

  tool(
    "brush",
    "Brush",
    "shapes",
    "Brushes",
    "drag",
    "Hold and drag to draw",
    PINK,
  ),
  tool(
    "highlighter",
    "Highlighter",
    "shapes",
    "Brushes",
    "drag",
    "Hold and drag to highlight",
    "#FFD600",
  ),
  tool(
    "arrowmarker",
    "Arrow marker",
    "shapes",
    "Arrows",
    2,
    "Click the tail, then the tip",
    INK,
  ),
  tool(
    "arrow",
    "Arrow",
    "shapes",
    "Arrows",
    2,
    "Click the tail, then the tip",
    INK,
  ),
  tool(
    "arrowup",
    "Arrow mark up",
    "shapes",
    "Arrows",
    1,
    "Click to place",
    GREEN,
  ),
  tool(
    "arrowdown",
    "Arrow mark down",
    "shapes",
    "Arrows",
    1,
    "Click to place",
    RED,
  ),
  tool(
    "rect",
    "Rectangle",
    "shapes",
    "Shapes",
    2,
    "Click two opposite corners",
    BLUE,
    { shortcut: { key: "R", shift: true } },
  ),
  tool(
    "rotatedrect",
    "Rotated rectangle",
    "shapes",
    "Shapes",
    3,
    "Click two points on one edge, then the width",
    BLUE,
  ),
  tool(
    "path",
    "Path",
    "shapes",
    "Shapes",
    "multi",
    "Click each point; double-click or press Enter to finish",
    BLUE,
    { minPoints: 2 },
  ),
  tool(
    "circle",
    "Circle",
    "shapes",
    "Shapes",
    2,
    "Click the centre, then a point on the edge",
    BLUE,
  ),
  tool(
    "ellipse",
    "Ellipse",
    "shapes",
    "Shapes",
    2,
    "Click two opposite corners",
    BLUE,
  ),
  tool(
    "polyline",
    "Polyline",
    "shapes",
    "Shapes",
    "multi",
    "Click each corner; double-click or press Enter to finish",
    BLUE,
    { minPoints: 3 },
  ),
  tool(
    "triangle",
    "Triangle",
    "shapes",
    "Shapes",
    3,
    "Click the three corners",
    BLUE,
  ),
  tool(
    "arc",
    "Arc",
    "shapes",
    "Shapes",
    3,
    "Click the start, a point on the arc, then the end",
    BLUE,
  ),
  tool(
    "curve",
    "Curve",
    "shapes",
    "Shapes",
    3,
    "Click the start, the bend, then the end",
    BLUE,
  ),
  tool(
    "doublecurve",
    "Double curve",
    "shapes",
    "Shapes",
    4,
    "Click the start, two bends, then the end",
    BLUE,
  ),

  tool("text", "Text", "annotation", "", 1, "Click to place a note", INK, {
    text: "prompt",
  }),
  tool("note", "Note", "annotation", "", 1, "Click to place a note", ORANGE, {
    text: "prompt",
  }),
  tool(
    "pricenote",
    "Price note",
    "annotation",
    "",
    1,
    "Click to label a price",
    BLUE,
    { text: "price" },
  ),
  tool("pin", "Pin", "annotation", "", 1, "Click to drop a pin", RED, {
    text: "prompt",
  }),
  tool("table", "Table", "annotation", "", 1, "Click to place a table", GRAY, {
    text: "prompt",
    help: "Rows on separate lines, columns separated by |.",
  }),
  tool(
    "callout",
    "Callout",
    "annotation",
    "",
    2,
    "Click the target, then where the text goes",
    BLUE,
    { text: "prompt" },
  ),
  tool(
    "comment",
    "Comment",
    "annotation",
    "",
    1,
    "Click to place a comment",
    GREEN,
    { text: "prompt" },
  ),
  tool(
    "pricelabel",
    "Price label",
    "annotation",
    "",
    1,
    "Click to label a price",
    BLUE,
    { text: "price" },
  ),
  tool(
    "signpost",
    "Signpost",
    "annotation",
    "",
    1,
    "Click to place a signpost",
    PURPLE,
    { text: "prompt" },
  ),
  tool("flag", "Flag mark", "annotation", "", 1, "Click to plant a flag", RED, {
    text: "prompt",
  }),
  tool(
    "image",
    "Image",
    "annotation",
    "Content",
    1,
    "Click to place an image",
    INK,
    { text: "image" },
  ),
  tool(
    "post",
    "Post",
    "annotation",
    "Content",
    1,
    "Click to place a post",
    BLUE,
    { text: "prompt" },
  ),
  tool(
    "idea",
    "Idea",
    "annotation",
    "Content",
    1,
    "Click to place an idea",
    ORANGE,
    { text: "prompt" },
  ),
  tool("emoji", "Emoji", "emoji", "Emoji", 1, "Click to place the emoji", INK),
];

/** Tool for an Alt+key shortcut (matched on the physical key, e.g. "KeyT"). */
export function toolForShortcut(
  code: string,
  shift = false,
): DrawingType | null {
  const key = code.startsWith("Key") ? code.slice(3) : "";
  if (!key) return null;
  return (
    TOOL_DEFINITIONS.find(
      (entry) =>
        entry.shortcut?.key === key && Boolean(entry.shortcut.shift) === shift,
    )?.type ?? null
  );
}

export function getToolDefinition(type: DrawingType): ToolDefinition {
  return TOOL_DEFINITIONS.find((tool) => tool.type === type)!;
}

export const DRAWING_COLORS: readonly string[] = [
  "#2962FF",
  "#089981",
  "#F23645",
  "#F57C00",
  "#7E57C2",
  "#E91E63",
  "#00BCD4",
  "#787B86",
  "#1D1D1F",
];

export const FIB_LEVELS: readonly { value: number; color: string }[] = [
  { value: 0, color: "#787B86" },
  { value: 0.236, color: "#F23645" },
  { value: 0.382, color: "#FF9800" },
  { value: 0.5, color: "#4CAF50" },
  { value: 0.618, color: "#089981" },
  { value: 0.786, color: "#00BCD4" },
  { value: 1, color: "#787B86" },
];

let drawingCounter = 0;

export function createDrawingId(): string {
  drawingCounter += 1;
  return `d${Date.now().toString(36)}${drawingCounter.toString(36)}`;
}

export function createDrawing(
  type: DrawingType,
  points: readonly DrawingPoint[],
  overrides: Partial<
    Pick<
      Drawing,
      | "color"
      | "width"
      | "dash"
      | "text"
      | "textColor"
      | "z"
      | "hidden"
      | "locked"
      | "visibleOn"
      | "visibleTimeframe"
    >
  > = {},
): Drawing {
  return {
    id: createDrawingId(),
    type,
    points,
    color: overrides.color ?? getToolDefinition(type).defaultColor,
    width: overrides.width ?? 2,
    dash: overrides.dash ?? "solid",
    ...(overrides.text !== undefined ? { text: overrides.text } : {}),
    ...(overrides.textColor !== undefined
      ? { textColor: overrides.textColor }
      : {}),
    z: overrides.z ?? 0,
    hidden: overrides.hidden ?? false,
    locked: overrides.locked ?? false,
    visibleOn: overrides.visibleOn ?? "all",
    visibleTimeframe: overrides.visibleTimeframe ?? null,
  };
}

export function moveDrawing(
  drawing: Drawing,
  deltaTime: number,
  deltaPrice: number,
): Drawing {
  return {
    ...drawing,
    points: drawing.points.map((point) => ({
      t: point.t + deltaTime,
      p: point.p + deltaPrice,
    })),
  };
}

export function movePoint(
  drawing: Drawing,
  index: number,
  point: DrawingPoint,
): Drawing {
  return {
    ...drawing,
    points: drawing.points.map((existing, position) =>
      position === index ? point : existing,
    ),
  };
}

const VALID_TYPES = new Set<string>(TOOL_DEFINITIONS.map((tool) => tool.type));

/** Drops anything malformed so a corrupt save can never break the chart. */
export function sanitizeDrawings(value: unknown): Drawing[] {
  if (!Array.isArray(value)) return [];
  const result: Drawing[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Partial<Drawing>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.type !== "string" ||
      !VALID_TYPES.has(candidate.type) ||
      !Array.isArray(candidate.points)
    ) {
      continue;
    }
    const points = candidate.points.filter(
      (point): point is DrawingPoint =>
        typeof point === "object" &&
        point !== null &&
        Number.isFinite((point as DrawingPoint).t) &&
        Number.isFinite((point as DrawingPoint).p),
    );
    if (points.length === 0) continue;
    result.push({
      id: candidate.id,
      type: candidate.type as DrawingType,
      points,
      color: typeof candidate.color === "string" ? candidate.color : "#2962FF",
      width: Number.isFinite(candidate.width) ? Number(candidate.width) : 2,
      dash:
        candidate.dash === "dashed" || candidate.dash === "dotted"
          ? candidate.dash
          : "solid",
      ...(typeof candidate.text === "string" ? { text: candidate.text } : {}),
      ...(typeof candidate.textColor === "string"
        ? { textColor: candidate.textColor }
        : {}),
      z:
        typeof candidate.z === "number" && Number.isFinite(candidate.z)
          ? candidate.z
          : 0,
      hidden: candidate.hidden === true,
      locked: candidate.locked === true,
      visibleOn: isDrawingVisibilityScope(candidate.visibleOn)
        ? candidate.visibleOn
        : "all",
      visibleTimeframe:
        typeof candidate.visibleTimeframe === "string" &&
        isChartTimeframe(candidate.visibleTimeframe)
          ? candidate.visibleTimeframe
          : null,
    });
  }
  return result;
}

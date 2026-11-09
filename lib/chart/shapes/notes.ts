import type { DrawingType } from "../drawings";
import {
  formatPrice,
  inBox,
  withAlpha,
  type Geometry,
  type Segment,
  type ShapeHandler,
  type Shapes,
  type XY,
} from "./utils";

const CHAR_WIDTH = 6.9;
const LINE_HEIGHT = 16;
const PAD = 8;
const FONT = "600 12px Inter, system-ui, sans-serif";

type Box = [number, number, number, number];

/** Text wrapped by an estimated glyph width, so hit-testing needs no canvas. */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && candidate.length > maxChars) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

interface Card {
  readonly lines: readonly string[];
  readonly box: Box;
}

function card(
  text: string,
  left: number,
  top: number,
  maxChars: number,
  minWidth = 56,
): Card {
  const lines = wrap(text || " ", maxChars);
  const width = Math.max(
    minWidth,
    Math.max(...lines.map((line) => line.length)) * CHAR_WIDTH + PAD * 2,
  );
  const height = lines.length * LINE_HEIGHT + PAD * 2 - 4;
  return { lines, box: [left, top, width, height] };
}

function roundedBox(ctx: CanvasRenderingContext2D, box: Box, radius = 6): void {
  ctx.beginPath();
  ctx.roundRect(box[0], box[1], box[2], box[3], radius);
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: readonly string[],
  box: Box,
  color: string,
  align: CanvasTextAlign = "left",
): void {
  ctx.font = FONT;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  const x = align === "center" ? box[0] + box[2] / 2 : box[0] + PAD;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, box[1] + PAD + index * LINE_HEIGHT + 6);
  });
}

interface Layout {
  readonly box: Box | null;
  readonly handles: readonly XY[];
  readonly segments: readonly Segment[];
}

type Draw = (
  ctx: CanvasRenderingContext2D,
  drawing: {
    color: string;
    text?: string;
    id: string;
    points: readonly { t: number; p: number }[];
  },
  pixels: readonly XY[],
  geometry: Geometry,
) => void;

interface NoteKind {
  layout(
    drawing: { text?: string; points: readonly { t: number; p: number }[] },
    pixels: readonly XY[],
  ): Layout | null;
  draw: Draw;
}

const WHITE = "#FFFFFF";

const note: NoteKind = {
  layout(drawing, [anchor]) {
    if (!anchor) return null;
    const { box } = card(drawing.text ?? "", anchor.x + 16, anchor.y - 16, 26);
    const placed: Box = [box[0], box[1] - box[3], box[2], box[3]];
    return {
      box: placed,
      handles: [anchor],
      segments: [[anchor.x, anchor.y, placed[0], placed[1] + placed[3]]],
    };
  },
  draw(ctx, drawing, [anchor]) {
    if (!anchor) return;
    const { lines, box } = card(
      drawing.text ?? "",
      anchor.x + 16,
      anchor.y - 16,
      26,
    );
    const placed: Box = [box[0], box[1] - box[3], box[2], box[3]];
    ctx.strokeStyle = drawing.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(placed[0], placed[1] + placed[3]);
    ctx.stroke();
    ctx.fillStyle = drawing.color;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(drawing.color, 0.95);
    roundedBox(ctx, placed);
    ctx.fill();
    drawLines(ctx, lines, placed, WHITE);
  },
};

function priceTag(
  drawing: { points: readonly { t: number; p: number }[] },
  [anchor]: readonly XY[],
  arrowTip: boolean,
): { box: Box; text: string; tip: XY } | null {
  if (!anchor) return null;
  const text = formatPrice(drawing.points[0]!.p);
  const { box } = card(
    text,
    anchor.x + (arrowTip ? 10 : 14),
    anchor.y - 11,
    40,
  );
  const height = 22;
  return {
    box: [box[0], anchor.y - height / 2, box[2], height],
    text,
    tip: anchor,
  };
}

const priceNote: NoteKind = {
  layout(drawing, pixels) {
    const tag = priceTag(drawing, pixels, false);
    return tag
      ? {
          box: tag.box,
          handles: [tag.tip],
          segments: [[tag.tip.x, tag.tip.y, tag.box[0], tag.tip.y]],
        }
      : null;
  },
  draw(ctx, drawing, pixels) {
    const tag = priceTag(drawing, pixels, false);
    if (!tag) return;
    ctx.strokeStyle = drawing.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tag.tip.x, tag.tip.y);
    ctx.lineTo(tag.box[0], tag.tip.y);
    ctx.stroke();
    ctx.fillStyle = drawing.color;
    ctx.beginPath();
    ctx.arc(tag.tip.x, tag.tip.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(drawing.color, 0.95);
    roundedBox(ctx, tag.box, 5);
    ctx.fill();
    drawLines(
      ctx,
      [tag.text],
      [tag.box[0], tag.box[1] - 1, tag.box[2], tag.box[3]],
      WHITE,
    );
  },
};

const priceLabel: NoteKind = {
  layout(drawing, pixels) {
    const tag = priceTag(drawing, pixels, true);
    return tag ? { box: tag.box, handles: [tag.tip], segments: [] } : null;
  },
  draw(ctx, drawing, pixels) {
    const tag = priceTag(drawing, pixels, true);
    if (!tag) return;
    const [x, y, w, h] = tag.box;
    ctx.fillStyle = withAlpha(drawing.color, 0.95);
    ctx.beginPath();
    ctx.moveTo(tag.tip.x, tag.tip.y);
    ctx.lineTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    drawLines(ctx, [tag.text], [x, y - 1, w, h], WHITE);
  },
};

const comment: NoteKind = {
  layout(drawing, [anchor]) {
    if (!anchor) return null;
    const { box } = card(drawing.text ?? "", anchor.x + 8, anchor.y - 12, 26);
    const placed: Box = [box[0], box[1] - box[3], box[2], box[3]];
    return { box: placed, handles: [anchor], segments: [] };
  },
  draw(ctx, drawing, [anchor]) {
    if (!anchor) return;
    const { lines, box } = card(
      drawing.text ?? "",
      anchor.x + 8,
      anchor.y - 12,
      26,
    );
    const [x, y, w, h] = [box[0], box[1] - box[3], box[2], box[3]];
    ctx.fillStyle = withAlpha(drawing.color, 0.95);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 10, y + h - 1);
    ctx.lineTo(anchor.x, anchor.y);
    ctx.lineTo(x + 24, y + h - 1);
    ctx.closePath();
    ctx.fill();
    drawLines(ctx, lines, [x, y, w, h], WHITE);
  },
};

const callout: NoteKind = {
  layout(drawing, pixels) {
    const [target, place] = pixels;
    if (!target) return null;
    if (!place) return { box: null, handles: pixels, segments: [] };
    const { box } = card(drawing.text ?? "", place.x, place.y, 26);
    return {
      box,
      handles: [target, place],
      segments: [
        [target.x, target.y, box[0] + box[2] / 2, box[1] + box[3] / 2],
      ],
    };
  },
  draw(ctx, drawing, pixels) {
    const [target, place] = pixels;
    if (!target || !place) return;
    const { lines, box } = card(drawing.text ?? "", place.x, place.y, 26);
    ctx.fillStyle = withAlpha(drawing.color, 0.95);
    ctx.strokeStyle = drawing.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(target.x, target.y);
    ctx.lineTo(box[0] + box[2] / 2, box[1] + box[3] / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(target.x, target.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    roundedBox(ctx, box);
    ctx.fill();
    drawLines(ctx, lines, box, WHITE);
  },
};

const signpost: NoteKind = {
  layout(drawing, [anchor]) {
    if (!anchor) return null;
    const { box } = card(
      drawing.text ?? "",
      anchor.x - 28,
      anchor.y - 46,
      22,
      56,
    );
    const placed: Box = [box[0], box[1] - box[3] + 14, box[2], box[3]];
    return {
      box: placed,
      handles: [anchor],
      segments: [[anchor.x, anchor.y, anchor.x, placed[1] + placed[3]]],
    };
  },
  draw(ctx, drawing, [anchor]) {
    if (!anchor) return;
    const { lines, box } = card(
      drawing.text ?? "",
      anchor.x - 28,
      anchor.y - 46,
      22,
      56,
    );
    const placed: Box = [box[0], box[1] - box[3] + 14, box[2], box[3]];
    ctx.strokeStyle = "#787B86";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(anchor.x, placed[1] + placed[3]);
    ctx.stroke();
    ctx.fillStyle = withAlpha(drawing.color, 0.95);
    roundedBox(ctx, placed, 4);
    ctx.fill();
    drawLines(ctx, lines, placed, WHITE);
  },
};

const FLAG_POLE = 36;

const flag: NoteKind = {
  layout(drawing, [anchor]) {
    if (!anchor) return null;
    const box: Box = [anchor.x, anchor.y - FLAG_POLE, 26, 18];
    void drawing;
    return {
      box,
      handles: [anchor],
      segments: [[anchor.x, anchor.y, anchor.x, anchor.y - FLAG_POLE]],
    };
  },
  draw(ctx, drawing, [anchor]) {
    if (!anchor) return;
    ctx.strokeStyle = "#434651";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(anchor.x, anchor.y - FLAG_POLE);
    ctx.stroke();
    ctx.fillStyle = withAlpha(drawing.color, 0.95);
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y - FLAG_POLE);
    ctx.lineTo(anchor.x + 26, anchor.y - FLAG_POLE + 6);
    ctx.lineTo(anchor.x, anchor.y - FLAG_POLE + 18);
    ctx.closePath();
    ctx.fill();
    if (drawing.text) {
      ctx.font = FONT;
      ctx.fillStyle = drawing.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(drawing.text, anchor.x + 32, anchor.y - FLAG_POLE + 9);
    }
  },
};

const pin: NoteKind = {
  layout(drawing, [anchor]) {
    if (!anchor) return null;
    const box: Box = [anchor.x - 11, anchor.y - 30, 22, 30];
    void drawing;
    return { box, handles: [anchor], segments: [] };
  },
  draw(ctx, drawing, [anchor]) {
    if (!anchor) return;
    ctx.fillStyle = withAlpha(drawing.color, 0.95);
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.bezierCurveTo(
      anchor.x - 14,
      anchor.y - 16,
      anchor.x - 11,
      anchor.y - 30,
      anchor.x,
      anchor.y - 30,
    );
    ctx.bezierCurveTo(
      anchor.x + 11,
      anchor.y - 30,
      anchor.x + 14,
      anchor.y - 16,
      anchor.x,
      anchor.y,
    );
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y - 20, 4, 0, Math.PI * 2);
    ctx.fill();
    if (drawing.text) {
      const { lines, box } = card(
        drawing.text,
        anchor.x + 14,
        anchor.y - 34,
        24,
      );
      const placed: Box = [box[0], box[1] - box[3] / 2, box[2], box[3]];
      ctx.fillStyle = withAlpha(drawing.color, 0.95);
      roundedBox(ctx, placed);
      ctx.fill();
      drawLines(ctx, lines, placed, WHITE);
    }
  },
};

const DEFAULT_TABLE = "Level|Price\nEntry|—\nStop|—\nTarget|—";

function tableLayout(
  text: string,
  anchor: XY,
): { rows: string[][]; cols: number[]; box: Box } {
  const rows = (text || DEFAULT_TABLE)
    .split("\n")
    .map((row) => row.split("|").map((cell) => cell.trim()));
  const columns = Math.max(...rows.map((row) => row.length));
  const cols: number[] = [];
  for (let column = 0; column < columns; column += 1) {
    cols.push(
      Math.max(
        48,
        Math.max(...rows.map((row) => (row[column] ?? "").length)) *
          CHAR_WIDTH +
          18,
      ),
    );
  }
  const width = cols.reduce((total, value) => total + value, 0);
  return { rows, cols, box: [anchor.x, anchor.y, width, rows.length * 24] };
}

const table: NoteKind = {
  layout(drawing, [anchor]) {
    if (!anchor) return null;
    return {
      box: tableLayout(drawing.text ?? "", anchor).box,
      handles: [anchor],
      segments: [],
    };
  },
  draw(ctx, drawing, [anchor]) {
    if (!anchor) return;
    const { rows, cols, box } = tableLayout(drawing.text ?? "", anchor);
    ctx.fillStyle = "#FFFFFF";
    roundedBox(ctx, box, 4);
    ctx.fill();
    ctx.fillStyle = withAlpha(drawing.color, 0.18);
    ctx.fillRect(box[0], box[1], box[2], 24);
    ctx.strokeStyle = drawing.color;
    ctx.lineWidth = 1;
    roundedBox(ctx, box, 4);
    ctx.stroke();
    ctx.font = FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    rows.forEach((row, rowIndex) => {
      let x = box[0];
      ctx.strokeStyle = withAlpha(drawing.color, 0.35);
      if (rowIndex > 0) {
        ctx.beginPath();
        ctx.moveTo(box[0], box[1] + rowIndex * 24);
        ctx.lineTo(box[0] + box[2], box[1] + rowIndex * 24);
        ctx.stroke();
      }
      cols.forEach((width, column) => {
        if (rowIndex === 0 && column > 0) {
          // header separators handled by the vertical rule below
        }
        ctx.fillStyle = "#1D1D1F";
        ctx.fillText(row[column] ?? "", x + 9, box[1] + rowIndex * 24 + 12);
        if (column > 0) {
          ctx.beginPath();
          ctx.moveTo(x, box[1]);
          ctx.lineTo(x, box[1] + box[3]);
          ctx.stroke();
        }
        x += width;
      });
    });
  },
};

function cardKind(title: string, icon: string): NoteKind {
  const dims = (text: string, anchor: XY): { lines: string[]; box: Box } => {
    const { lines, box } = card(text, anchor.x, anchor.y, 34, 190);
    return { lines: [...lines], box: [box[0], box[1], box[2], box[3] + 24] };
  };
  return {
    layout(drawing, [anchor]) {
      if (!anchor) return null;
      return {
        box: dims(drawing.text ?? "", anchor).box,
        handles: [anchor],
        segments: [],
      };
    },
    draw(ctx, drawing, [anchor]) {
      if (!anchor) return;
      const { lines, box } = dims(drawing.text ?? "", anchor);
      ctx.fillStyle = "#FFFFFF";
      roundedBox(ctx, box, 10);
      ctx.fill();
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = 1.5;
      roundedBox(ctx, box, 10);
      ctx.stroke();
      ctx.fillStyle = drawing.color;
      ctx.beginPath();
      ctx.arc(box[0] + 18, box[1] + 18, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "13px sans-serif";
      ctx.fillStyle = WHITE;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, box[0] + 18, box[1] + 19);
      ctx.font = FONT;
      ctx.fillStyle = "#1D1D1F";
      ctx.textAlign = "left";
      ctx.fillText(title, box[0] + 36, box[1] + 18);
      drawLines(
        ctx,
        lines,
        [box[0], box[1] + 24, box[2], box[3] - 24],
        "#1D1D1F",
      );
    },
  };
}

const imageCache = new Map<string, HTMLImageElement>();
const IMAGE_WIDTH = 150;

function imageBox(anchor: XY, image: HTMLImageElement | undefined): Box {
  const ratio =
    image && image.naturalWidth > 0
      ? image.naturalHeight / image.naturalWidth
      : 0.66;
  return [anchor.x, anchor.y, IMAGE_WIDTH, Math.round(IMAGE_WIDTH * ratio)];
}

const image: NoteKind = {
  layout(drawing, [anchor]) {
    if (!anchor) return null;
    return {
      box: imageBox(anchor, imageCache.get(drawing.text ?? "")),
      handles: [anchor],
      segments: [],
    };
  },
  draw(ctx, drawing, [anchor], geometry) {
    if (!anchor) return;
    const source = drawing.text ?? "";
    let element = imageCache.get(source);
    if (
      !element &&
      typeof Image !== "undefined" &&
      source.startsWith("data:image/")
    ) {
      element = new Image();
      element.onload = () => geometry.invalidate?.();
      element.src = source;
      imageCache.set(source, element);
    }
    const box = imageBox(anchor, element);
    if (element && element.complete && element.naturalWidth > 0) {
      ctx.save();
      roundedBox(ctx, box, 6);
      ctx.clip();
      ctx.drawImage(element, box[0], box[1], box[2], box[3]);
      ctx.restore();
    } else {
      ctx.fillStyle = "#F0F3FA";
      roundedBox(ctx, box, 6);
      ctx.fill();
    }
    ctx.strokeStyle = "#B2B5BE";
    ctx.lineWidth = 1;
    roundedBox(ctx, box, 6);
    ctx.stroke();
  },
};

const KINDS: Partial<Record<DrawingType, NoteKind>> = {
  note,
  pricenote: priceNote,
  pricelabel: priceLabel,
  comment,
  callout,
  signpost,
  flag,
  pin,
  table,
  image,
  post: cardKind("Post", "✎"),
  idea: cardKind("Idea", "💡"),
};

function handlerFor(kind: NoteKind): ShapeHandler {
  return {
    shapes(drawing, pixels): Shapes | null {
      const layout = kind.layout(drawing, pixels);
      if (!layout) return null;
      return {
        segments: layout.segments as Segment[],
        boxes: layout.box ? [layout.box] : [],
        handles: layout.handles,
      };
    },
    render(ctx, drawing, pixels, geometry) {
      ctx.setLineDash([]);
      kind.draw(ctx, drawing, pixels, geometry);
    },
  };
}

export const NOTE_HANDLERS: Partial<Record<DrawingType, ShapeHandler>> = {};
for (const [type, kind] of Object.entries(KINDS)) {
  if (kind) NOTE_HANDLERS[type as DrawingType] = handlerFor(kind);
}

export { inBox };

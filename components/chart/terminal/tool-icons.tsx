import {
  Brush,
  Ruler,
  Smile,
  Square,
  TrendingDown,
  TrendingUp,
  Type,
} from "lucide-react";
import type { ReactNode } from "react";
import type { DrawingType } from "@/lib/chart/drawings";
import { Glyph, Node, type IconProps } from "./icon-base";
import { EXTRA_ICONS } from "./tool-icons-extra";

export type CursorKind = "cross" | "dot" | "arrow" | "demo" | "eraser";

const cursorIcons: Record<CursorKind, (props: IconProps) => ReactNode> = {
  cross: (p) => (
    <Glyph {...p}>
      <path d="M14 4v7M14 17v7M4 14h7M17 14h7" />
    </Glyph>
  ),
  dot: (p) => (
    <Glyph {...p}>
      <circle cx="14" cy="14" r="3" fill="currentColor" />
    </Glyph>
  ),
  demo: (p) => (
    <Glyph {...p}>
      <circle cx="14" cy="14" r="7" />
      <circle cx="14" cy="14" r="2.5" fill="currentColor" />
    </Glyph>
  ),
  eraser: (p) => (
    <Glyph {...p}>
      <path d="M17 5l7 7-9 9H9l-5-5z" />
      <path d="M8 12l8 8M12 24h12" />
    </Glyph>
  ),
  arrow: (p) => (
    <Glyph {...p}>
      <path d="M9 5l11 8.5-5 1.2 3 5.8-2.4 1.2-3-5.8L9 20z" />
    </Glyph>
  ),
};

const icons: Record<string, (props: IconProps) => ReactNode> = {
  trend: (p) => (
    <Glyph {...p}>
      <path d="M7 21L21 7" />
      <Node x={6} y={22} />
      <Node x={22} y={6} />
    </Glyph>
  ),
  ray: (p) => (
    <Glyph {...p}>
      <path d="M7 21L24 5" />
      <path d="M21 4.5h3.5V8" />
      <Node x={6} y={22} />
      <Node x={14} y={14} />
    </Glyph>
  ),
  info: (p) => (
    <Glyph {...p}>
      <path d="M7 21L19 9" />
      <rect x="15" y="14" width="9" height="7" rx="1.5" />
      <path d="M17.5 17.5h4" />
      <Node x={6} y={22} />
      <Node x={20} y={8} />
    </Glyph>
  ),
  extended: (p) => (
    <Glyph {...p}>
      <path d="M3 25L25 3" />
      <Node x={9} y={19} />
      <Node x={19} y={9} />
    </Glyph>
  ),
  angle: (p) => (
    <Glyph {...p}>
      <path d="M5 22L22 8" />
      <path d="M5 22h18" strokeDasharray="2 2.5" />
      <path d="M13 22a8 8 0 0 0-2.4-5.7" />
      <Node x={5} y={22} />
      <Node x={22} y={8} />
    </Glyph>
  ),
  hline: (p) => (
    <Glyph {...p}>
      <path d="M3 14h22" />
      <Node x={14} y={14} />
    </Glyph>
  ),
  hray: (p) => (
    <Glyph {...p}>
      <path d="M7 14h18" />
      <Node x={6} y={14} />
    </Glyph>
  ),
  vline: (p) => (
    <Glyph {...p}>
      <path d="M14 3v22" />
      <Node x={14} y={14} />
    </Glyph>
  ),
  crossline: (p) => (
    <Glyph {...p}>
      <path d="M3 14h22M14 3v22" />
      <Node x={14} y={14} />
    </Glyph>
  ),
  channel: (p) => (
    <Glyph {...p}>
      <path d="M5 17L21 5M8 23l16-12" />
      <Node x={5} y={17} />
      <Node x={21} y={5} />
      <Node x={10} y={21.5} />
    </Glyph>
  ),
  regression: (p) => (
    <Glyph {...p}>
      <path d="M5 14L23 8M5 22l18-6" />
      <path d="M5 18l18-6" strokeDasharray="2 2.5" />
      <Node x={5} y={18} />
      <Node x={23} y={12} />
    </Glyph>
  ),
  flat: (p) => (
    <Glyph {...p}>
      <path d="M5 21L23 8M5 21h18" />
      <path d="M23 8v13" strokeDasharray="2 2.5" />
      <Node x={5} y={21} />
      <Node x={23} y={8} />
      <Node x={14} y={21} />
    </Glyph>
  ),
  disjoint: (p) => (
    <Glyph {...p}>
      <path d="M5 11L23 5M5 24l18-9" />
      <path d="M5 11v13M23 5v10" strokeDasharray="2 2.5" />
      <Node x={5} y={11} />
      <Node x={23} y={5} />
      <Node x={5} y={24} />
      <Node x={23} y={15} />
    </Glyph>
  ),
  pitchfork: (p) => (
    <Glyph {...p}>
      <path d="M5 23L25 9M8 14l17-12M16 24l9-7" />
      <path d="M8 14l8 10" strokeDasharray="2 2.5" />
      <Node x={5} y={23} />
      <Node x={8} y={14} />
      <Node x={16} y={24} />
    </Glyph>
  ),
  schiff: (p) => (
    <Glyph {...p}>
      <path d="M5 19L25 7M8 12l17-10M16 24l9-6" />
      <path d="M5 23v-4" strokeDasharray="2 2.5" />
      <path d="M8 12l8 12" strokeDasharray="2 2.5" />
      <Node x={5} y={23} />
      <Node x={8} y={12} />
      <Node x={16} y={24} />
    </Glyph>
  ),
  modschiff: (p) => (
    <Glyph {...p}>
      <path d="M8 17L25 6M9 11l16-9M17 24l8-5" />
      <path d="M5 23l3-6" strokeDasharray="2 2.5" />
      <path d="M9 11l8 13" strokeDasharray="2 2.5" />
      <Node x={5} y={23} />
      <Node x={9} y={11} />
      <Node x={17} y={24} />
    </Glyph>
  ),
  insidefork: (p) => (
    <Glyph {...p}>
      <path d="M5 23L25 9M9 15l15-10.5M14 22.5l11-8" />
      <path d="M8 14l8 10" strokeDasharray="2 2.5" />
      <Node x={5} y={23} />
      <Node x={8} y={14} />
      <Node x={16} y={24} />
    </Glyph>
  ),
  fib: (p) => (
    <Glyph {...p}>
      <path d="M4 6h20M4 11h20M4 16h20M4 22h20" />
      <path d="M7 22L21 6" strokeDasharray="2 2.5" />
      <Node x={7} y={22} />
      <Node x={21} y={6} />
    </Glyph>
  ),
};

function lucide(Icon: typeof Ruler): (props: IconProps) => ReactNode {
  function LucideGlyph({ className }: IconProps) {
    return (
      <Icon
        className={className}
        strokeWidth={1.5}
        style={{ width: 24, height: 24 }}
      />
    );
  }
  return LucideGlyph;
}

icons.measure = lucide(Ruler);
icons.long = lucide(TrendingUp);
icons.short = lucide(TrendingDown);
icons.brush = lucide(Brush);
icons.rect = lucide(Square);
icons.text = lucide(Type);
icons.emoji = lucide(Smile);

// The dedicated glyphs win over the generic icon-set fallbacks above.
Object.assign(icons, EXTRA_ICONS);

export function ToolIcon({
  type,
  className,
}: {
  readonly type: DrawingType;
  readonly className?: string;
}) {
  const render = icons[type];
  return render ? <>{render({ className })}</> : null;
}

export function CursorIcon({
  kind,
  className,
}: {
  readonly kind: CursorKind;
  readonly className?: string;
}) {
  return <>{cursorIcons[kind]({ className })}</>;
}

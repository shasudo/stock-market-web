import { Dash, Glyph, Node, type IconRenderer } from "./icon-base";

/** Icons for the fib/gann, pattern, forecasting, markup and annotation tools. */
export const EXTRA_ICONS: Record<string, IconRenderer> = {
  // ── fibonacci ─────────────────────────────────────────────────────────
  fibext: (p) => (
    <Glyph {...p}>
      <path d="M12 7h12M12 11h12M12 15h12M12 20h12" />
      <path d="M4 22l4-13 3 9" />
      <Node x={4} y={22} />
      <Node x={8} y={9} />
      <Node x={11} y={18} />
    </Glyph>
  ),
  fibchannel: (p) => (
    <Glyph {...p}>
      <path d="M4 18L22 8M4 13L22 3M6 24l18-10" />
      <Node x={4} y={18} />
      <Node x={22} y={8} />
      <Node x={8} y={22.5} />
    </Glyph>
  ),
  fibtimezone: (p) => (
    <Glyph {...p}>
      <path d="M5 4v20M9 4v20M14 4v20M22 4v20" />
      <Dash d="M5 14h4" />
      <Node x={5} y={14} />
      <Node x={9} y={14} />
    </Glyph>
  ),
  fibfan: (p) => (
    <Glyph {...p}>
      <path d="M4 23L24 5M4 23L24 11M4 23L24 17M4 23h20" />
      <Node x={4} y={23} />
      <Node x={24} y={5} />
    </Glyph>
  ),
  fibtime: (p) => (
    <Glyph {...p}>
      <path d="M13 4v20M17 4v20M21 4v20M25 4v20" />
      <path d="M4 20l5-8" />
      <Node x={4} y={20} />
      <Node x={9} y={12} />
      <Node x={13} y={17} />
    </Glyph>
  ),
  fibcircles: (p) => (
    <Glyph {...p}>
      <circle cx="14" cy="14" r="4" />
      <circle cx="14" cy="14" r="7.5" />
      <circle cx="14" cy="14" r="11" />
      <Node x={14} y={14} />
    </Glyph>
  ),
  fibspiral: (p) => (
    <Glyph {...p}>
      <path d="M14 14c0-2 3-2 3 0s-4 3-5 0 1-6 6-5 6 7 2 11-12 3-14-3 1-12 9-13" />
      <Node x={14} y={14} />
    </Glyph>
  ),
  fibarcs: (p) => (
    <Glyph {...p}>
      <path d="M6 5a15 15 0 0 1 0 18M10 7a11 11 0 0 1 0 14M14 9a7 7 0 0 1 0 10" />
      <Dash d="M4 14h12" />
      <Node x={4} y={14} />
    </Glyph>
  ),
  fibwedge: (p) => (
    <Glyph {...p}>
      <path d="M4 22L24 6M4 22L24 20" />
      <path d="M12 16.5a9 9 0 0 1 4 4.5M17 12.5a14 14 0 0 1 6 7" />
      <Node x={4} y={22} />
      <Node x={24} y={6} />
      <Node x={24} y={20} />
    </Glyph>
  ),
  pitchfan: (p) => (
    <Glyph {...p}>
      <path d="M4 22L24 6M4 22L24 11M4 22L24 16M4 22L24 21" />
      <Dash d="M24 6v15" />
      <Node x={4} y={22} />
      <Node x={24} y={6} />
      <Node x={24} y={21} />
    </Glyph>
  ),
  gannbox: (p) => (
    <Glyph {...p}>
      <rect x="4" y="4" width="20" height="20" rx="1" />
      <path d="M4 4l20 20M24 4L4 24M4 14h20M14 4v20" />
    </Glyph>
  ),
  gannfixed: (p) => (
    <Glyph {...p}>
      <rect x="5" y="5" width="18" height="18" rx="1" />
      <path d="M5 5l18 18M5 14h18M14 5v18" />
      <Node x={5} y={5} />
      <Node x={23} y={23} />
    </Glyph>
  ),
  gannsquare: (p) => (
    <Glyph {...p}>
      <rect x="4" y="4" width="20" height="20" rx="1" />
      <path d="M4 9h20M4 14h20M4 19h20M9 4v20M14 4v20M19 4v20M4 4l20 20" />
    </Glyph>
  ),
  gannfan: (p) => (
    <Glyph {...p}>
      <path d="M4 23L24 4M4 23L24 9M4 23L24 14M4 23L24 20M4 23L18 4M4 23L11 4" />
      <Node x={4} y={23} />
    </Glyph>
  ),

  // ── patterns ──────────────────────────────────────────────────────────
  xabcd: (p) => (
    <Glyph {...p}>
      <path d="M4 20L9 6l5 11 5-8 5 14" />
      <Dash d="M4 20l10-3M9 6l10 3M4 20l20 3" />
      <Node x={4} y={20} />
      <Node x={9} y={6} />
      <Node x={14} y={17} />
      <Node x={19} y={9} />
      <Node x={24} y={23} />
    </Glyph>
  ),
  cypher: (p) => (
    <Glyph {...p}>
      <path d="M4 17L9 7l6 13 5-11 4 9" />
      <Dash d="M4 17l11 3M9 7l11 2" />
      <Node x={4} y={17} />
      <Node x={9} y={7} />
      <Node x={15} y={20} />
      <Node x={20} y={9} />
      <Node x={24} y={18} />
    </Glyph>
  ),
  headshoulders: (p) => (
    <Glyph {...p}>
      <path d="M3 21l3-7 3 4 3-11 3 11 3-4 3 7" />
      <path d="M3 19h22" strokeDasharray="2 2.5" />
      <Node x={12} y={7} />
    </Glyph>
  ),
  abcd: (p) => (
    <Glyph {...p}>
      <path d="M4 22L10 6l7 12 7-14" />
      <Dash d="M4 22l13-4M10 6l14-2" />
      <Node x={4} y={22} />
      <Node x={10} y={6} />
      <Node x={17} y={18} />
      <Node x={24} y={4} />
    </Glyph>
  ),
  trianglepattern: (p) => (
    <Glyph {...p}>
      <path d="M4 22L9 5l6 14 5-9" />
      <path d="M4 22l16-12M9 5l11 5" />
      <Node x={4} y={22} />
      <Node x={9} y={5} />
      <Node x={15} y={19} />
      <Node x={20} y={10} />
    </Glyph>
  ),
  threedrives: (p) => (
    <Glyph {...p}>
      <path d="M3 22l3-9 3 5 4-11 3 8 4-12 5 8" />
      <Dash d="M6 13l7 5M13 7l7 8" />
    </Glyph>
  ),
  elliottimpulse: (p) => (
    <Glyph {...p}>
      <path d="M3 22l5-9 3 4 6-12 3 7 5-9" />
      <path d="M5 8h2M12 20h2M20 5h2" />
    </Glyph>
  ),
  elliottcorrection: (p) => (
    <Glyph {...p}>
      <path d="M4 7l8 13 4-6 8 9" />
      <path d="M10 20h2M16 17h2" />
    </Glyph>
  ),
  elliotttriangle: (p) => (
    <Glyph {...p}>
      <path d="M3 18l5-11 4 9 4-7 3 5 4-3 2 3" />
    </Glyph>
  ),
  elliottdouble: (p) => (
    <Glyph {...p}>
      <path d="M3 8l6 12 4-7 5 8 6-13" />
    </Glyph>
  ),
  elliotttriple: (p) => (
    <Glyph {...p}>
      <path d="M3 9l4 11 3-6 4 8 3-7 4 5 4-12" />
    </Glyph>
  ),
  cyclic: (p) => (
    <Glyph {...p}>
      <path d="M5 4v20M10 4v20M15 4v20M20 4v20M25 4v20" />
      <Node x={5} y={14} />
      <Node x={10} y={14} />
    </Glyph>
  ),
  timecycles: (p) => (
    <Glyph {...p}>
      <path d="M3 20a5.5 9 0 0 1 11 0M14 20a5.5 9 0 0 1 11 0" />
      <Node x={3} y={20} />
      <Node x={14} y={20} />
    </Glyph>
  ),
  sine: (p) => (
    <Glyph {...p}>
      <path d="M2 14c3-12 6-12 9 0s6 12 9 0 4-8 6-4" />
      <Node x={2} y={14} />
      <Node x={7} y={7} />
    </Glyph>
  ),

  // ── forecasting, volume, measurers ───────────────────────────────────
  long: (p) => (
    <Glyph {...p}>
      <rect x="4" y="5" width="20" height="8" rx="1" />
      <rect x="4" y="13" width="20" height="9" rx="1" />
      <path d="M4 13h20" />
      <Node x={14} y={13} />
    </Glyph>
  ),
  short: (p) => (
    <Glyph {...p}>
      <rect x="4" y="6" width="20" height="9" rx="1" />
      <rect x="4" y="15" width="20" height="8" rx="1" />
      <path d="M4 15h20" />
      <Node x={14} y={15} />
    </Glyph>
  ),
  posforecast: (p) => (
    <Glyph {...p}>
      <rect x="4" y="7" width="20" height="14" rx="1" />
      <path d="M6 19L22 9" />
      <path d="M18 8.5l4 .5-1 4" />
      <Node x={6} y={19} />
    </Glyph>
  ),
  barspattern: (p) => (
    <Glyph {...p}>
      <path d="M6 7v14M6 10h-2v6h2M11 5v13M11 8h-2v7h2M20 11v13M20 14h-2v6h2M25 8v14" />
      <Dash d="M13 14h4" />
    </Glyph>
  ),
  ghostfeed: (p) => (
    <Glyph {...p}>
      <path d="M5 8v14M10 6v13M15 11v12" />
      <path d="M20 8v10M25 5v12" strokeDasharray="2 2.5" />
    </Glyph>
  ),
  sector: (p) => (
    <Glyph {...p}>
      <path d="M6 22L6 6a16 16 0 0 1 16 16z" />
      <Node x={6} y={22} />
      <Node x={6} y={6} />
      <Node x={22} y={22} />
    </Glyph>
  ),
  anchoredvwap: (p) => (
    <Glyph {...p}>
      <path d="M5 4v20" strokeDasharray="2 2.5" />
      <path d="M5 16c4-4 7 0 11-3s6-4 8-7" />
      <Node x={5} y={16} />
    </Glyph>
  ),
  volprofile: (p) => (
    <Glyph {...p}>
      <path d="M5 4v20M25 4v20" strokeDasharray="2 2.5" />
      <path d="M6 7h6M6 11h12M6 15h9M6 19h5" />
    </Glyph>
  ),
  anchoredvolprofile: (p) => (
    <Glyph {...p}>
      <path d="M4 4v20" strokeDasharray="2 2.5" />
      <path d="M5 7h7M5 11h13M5 15h10M5 19h6" />
      <Node x={4} y={12} />
    </Glyph>
  ),
  pricerange: (p) => (
    <Glyph {...p}>
      <path d="M6 6h14M6 22h14M13 6v16" />
      <path d="M10 9l3-3 3 3M10 19l3 3 3-3" />
    </Glyph>
  ),
  daterange: (p) => (
    <Glyph {...p}>
      <path d="M6 6v16M22 6v16M6 14h16" />
      <path d="M9 11l-3 3 3 3M19 11l3 3-3 3" />
    </Glyph>
  ),
  measure: (p) => (
    <Glyph {...p}>
      <rect x="5" y="5" width="18" height="18" rx="1" strokeDasharray="2 2.5" />
      <path d="M5 14h18M14 5v18" />
      <path d="M11 11l-3 3 3 3M17 11l3 3-3 3" />
    </Glyph>
  ),

  // ── markup ────────────────────────────────────────────────────────────
  highlighter: (p) => (
    <Glyph {...p}>
      <path d="M17 5l6 6-9 9-6-6z" />
      <path d="M8 14l-3 6 6-1M6 24h16" />
    </Glyph>
  ),
  arrowmarker: (p) => (
    <Glyph {...p}>
      <path d="M5 23l2-5 9-9 4-2-2 4-9 9z" />
    </Glyph>
  ),
  arrow: (p) => (
    <Glyph {...p}>
      <path d="M5 23L22 6M14 6h8v8" />
      <Node x={5} y={23} />
    </Glyph>
  ),
  arrowup: (p) => (
    <Glyph {...p}>
      <path d="M14 4l8 9h-5v11h-6V13H6z" />
    </Glyph>
  ),
  arrowdown: (p) => (
    <Glyph {...p}>
      <path d="M14 24l8-9h-5V4h-6v11H6z" />
    </Glyph>
  ),
  rect: (p) => (
    <Glyph {...p}>
      <rect x="5" y="7" width="18" height="14" rx="1" />
      <Node x={5} y={7} />
      <Node x={23} y={21} />
    </Glyph>
  ),
  rotatedrect: (p) => (
    <Glyph {...p}>
      <path d="M5 14L16 4l7 8-11 10z" />
      <Node x={5} y={14} />
      <Node x={16} y={4} />
      <Node x={12} y={22} />
    </Glyph>
  ),
  path: (p) => (
    <Glyph {...p}>
      <path d="M4 20l7-9 5 6 7-11" />
      <path d="M18 6h5v5" />
      <Node x={4} y={20} />
      <Node x={11} y={11} />
      <Node x={16} y={17} />
    </Glyph>
  ),
  circle: (p) => (
    <Glyph {...p}>
      <circle cx="14" cy="14" r="9" />
      <Node x={14} y={14} />
      <Node x={23} y={14} />
    </Glyph>
  ),
  ellipse: (p) => (
    <Glyph {...p}>
      <ellipse cx="14" cy="14" rx="10" ry="6.5" />
      <Node x={4} y={14} />
      <Node x={24} y={14} />
    </Glyph>
  ),
  polyline: (p) => (
    <Glyph {...p}>
      <path d="M5 20l3-12 9-3 6 9-6 9z" />
      <Node x={5} y={20} />
      <Node x={8} y={8} />
      <Node x={17} y={5} />
    </Glyph>
  ),
  triangle: (p) => (
    <Glyph {...p}>
      <path d="M14 5l10 17H4z" />
      <Node x={14} y={5} />
      <Node x={24} y={22} />
      <Node x={4} y={22} />
    </Glyph>
  ),
  arc: (p) => (
    <Glyph {...p}>
      <path d="M5 21a12 12 0 0 1 18 0" />
      <Node x={5} y={21} />
      <Node x={14} y={10} />
      <Node x={23} y={21} />
    </Glyph>
  ),
  curve: (p) => (
    <Glyph {...p}>
      <path d="M4 21C10 4 18 4 24 21" />
      <Node x={4} y={21} />
      <Node x={24} y={21} />
    </Glyph>
  ),
  doublecurve: (p) => (
    <Glyph {...p}>
      <path d="M4 20C10 2 14 26 24 8" />
      <Node x={4} y={20} />
      <Node x={24} y={8} />
    </Glyph>
  ),

  // ── annotations ───────────────────────────────────────────────────────
  note: (p) => (
    <Glyph {...p}>
      <rect x="4" y="5" width="18" height="14" rx="2" />
      <path d="M8 10h10M8 14h6M10 19l-3 5" />
    </Glyph>
  ),
  pricenote: (p) => (
    <Glyph {...p}>
      <rect x="4" y="5" width="20" height="14" rx="2" />
      <path d="M14 8v8M17 10.5c-1-1.5-5-1.5-5 .5s5 1.5 5 3.5-4 2-5 .5" />
      <path d="M10 19l-3 5" />
    </Glyph>
  ),
  pin: (p) => (
    <Glyph {...p}>
      <path d="M14 25c-5-6-8-9-8-13a8 8 0 0 1 16 0c0 4-3 7-8 13z" />
      <circle cx="14" cy="12" r="3" />
    </Glyph>
  ),
  table: (p) => (
    <Glyph {...p}>
      <rect x="4" y="6" width="20" height="16" rx="1.5" />
      <path d="M4 11h20M4 16h20M12 6v16" />
    </Glyph>
  ),
  callout: (p) => (
    <Glyph {...p}>
      <rect x="9" y="4" width="15" height="11" rx="2" />
      <path d="M12 9h9M12 12h5M9 12L4 23" />
      <Node x={4} y={23} />
    </Glyph>
  ),
  comment: (p) => (
    <Glyph {...p}>
      <path d="M5 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8l-5 5v-5H8a3 3 0 0 1-3-3z" />
    </Glyph>
  ),
  pricelabel: (p) => (
    <Glyph {...p}>
      <path d="M3 14l5-6h15v12H8z" />
      <path d="M12 11h8M12 14h6" />
    </Glyph>
  ),
  signpost: (p) => (
    <Glyph {...p}>
      <path d="M14 8v17M7 4h14l3 4-3 4H7z" />
    </Glyph>
  ),
  flag: (p) => (
    <Glyph {...p}>
      <path d="M6 24V4M6 5h15l-3 5 3 5H6" />
    </Glyph>
  ),
  image: (p) => (
    <Glyph {...p}>
      <rect x="4" y="5" width="20" height="18" rx="2" />
      <circle cx="10" cy="11" r="2" />
      <path d="M4 20l6-6 4 4 4-5 6 6" />
    </Glyph>
  ),
  post: (p) => (
    <Glyph {...p}>
      <rect x="4" y="5" width="20" height="18" rx="3" />
      <circle cx="10" cy="11" r="2.4" />
      <path d="M15 10h6M15 13h4M8 18h12" />
    </Glyph>
  ),
  idea: (p) => (
    <Glyph {...p}>
      <path d="M10 18c-3-2-4-5-3-8a7 7 0 0 1 14 0c1 3 0 6-3 8v3h-8z" />
      <path d="M11 24h6" />
    </Glyph>
  ),
};

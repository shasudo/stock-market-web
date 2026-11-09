import type { DrawingType } from "../drawings";
import { FIB_HANDLERS } from "./fib";
import { FORECAST_HANDLERS } from "./forecast";
import { MARKUP_HANDLERS } from "./markup";
import { NOTE_HANDLERS } from "./notes";
import { PATTERN_HANDLERS } from "./patterns";
import type { ShapeHandler } from "./utils";

/** Every tool that is drawn from a plan or custom handler rather than the core switch. */
export const SHAPE_HANDLERS: Partial<Record<DrawingType, ShapeHandler>> = {
  ...FIB_HANDLERS,
  ...PATTERN_HANDLERS,
  ...FORECAST_HANDLERS,
  ...MARKUP_HANDLERS,
  ...NOTE_HANDLERS,
};

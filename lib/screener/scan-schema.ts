/**
 * Validates a scan that arrived from outside (the API body, a pasted scan, a
 * shared link). Bounded in size and nesting so a crafted scan cannot make the
 * evaluator walk an enormous tree for every stock in the universe.
 */
import { z } from "zod";
import {
  ARITH_OPS,
  COMPARE_OPS,
  SOURCE_FIELDS,
  TIMEFRAME_UNITS,
  type Clause,
  type Expr,
  type Group,
  type Scan,
} from "./scan-types";

const MAX_TERMS = 12;
const MAX_ITEMS = 40;
const MAX_COLUMNS = 20;
const MAX_NODES = 200;
const MAX_DEPTH = 6;

const finite = z.number().finite();

const exprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.object({
    terms: z.array(termSchema).max(MAX_TERMS),
    ops: z.array(z.enum(ARITH_OPS)).max(MAX_TERMS),
  }),
);

const argSchema = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("number"), value: finite }),
    z.object({ kind: z.literal("source"), value: z.enum(SOURCE_FIELDS) }),
    z.object({ kind: z.literal("expr"), expr: exprSchema }),
    z.object({ kind: z.literal("filter"), clause: clauseSchema }),
  ]),
);

const termSchema = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("number"), value: finite }),
    z.object({ kind: z.literal("text"), value: z.string().max(120) }),
    z.object({
      kind: z.literal("measure"),
      measure: z.string().min(1).max(60),
      timeframe: z.enum(TIMEFRAME_UNITS),
      offset: z.number().int().min(0).max(500),
      args: z.array(argSchema).max(6),
    }),
  ]),
);

const clauseSchema: z.ZodType<Clause> = z.lazy(() =>
  z.object({
    kind: z.literal("clause"),
    id: z.string().min(1).max(64),
    enabled: z.boolean(),
    left: exprSchema,
    op: z.enum(COMPARE_OPS).nullable(),
    right: exprSchema.nullable(),
  }),
);

const groupSchema: z.ZodType<Group> = z.lazy(() =>
  z.object({
    kind: z.literal("group"),
    id: z.string().min(1).max(64),
    enabled: z.boolean(),
    mode: z.enum(["passes", "fails"]),
    match: z.union([z.literal("all"), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    items: z.array(z.union([clauseSchema, groupSchema])).max(MAX_ITEMS),
  }),
);

export const scanSchema: z.ZodType<Scan> = z.object({
  version: z.literal(1),
  name: z.string().max(120),
  segment: z.string().min(1).max(60),
  root: groupSchema,
  columns: z
    .array(z.object({ id: z.string().min(1).max(64), label: z.string().max(80), expr: exprSchema }))
    .max(MAX_COLUMNS),
});

function countNodes(group: Group, depth: number): number {
  if (depth > MAX_DEPTH) return Infinity;
  let total = 1;
  for (const item of group.items) {
    total += item.kind === "group" ? countNodes(item, depth + 1) : 1;
  }
  return total;
}

export type ScanParseResult =
  | { readonly ok: true; readonly scan: Scan }
  | { readonly ok: false; readonly error: string };

export function parseScan(value: unknown): ScanParseResult {
  const parsed = scanSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: "The scan is not in a recognised format." };
  }
  if (countNodes(parsed.data.root, 0) > MAX_NODES) {
    return { ok: false, error: `A scan can hold at most ${MAX_NODES} filters, nested ${MAX_DEPTH} deep.` };
  }
  return { ok: true, scan: parsed.data };
}

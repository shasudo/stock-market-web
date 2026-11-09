import { z } from "zod";

/**
 * Keys the chart terminal may store. Anything else is rejected so the table
 * can only ever hold the shapes the terminal itself writes.
 */
const FIXED_KEYS = [
  "settings",
  "layouts",
  "favorites",
  "templates",
  "indicators",
] as const;

const DRAWINGS_KEY = /^drawings:[A-Z0-9&._:-]{1,40}$/;

export const MAX_CHART_STATE_BYTES = 1_500_000;
export const MAX_CHART_STATE_KEYS = 600;

export function isChartStateKey(key: string): boolean {
  return (
    (FIXED_KEYS as readonly string[]).includes(key) || DRAWINGS_KEY.test(key)
  );
}

export const chartStateKeySchema = z
  .string()
  .refine(isChartStateKey, "Unknown chart state key");

const payloadSchema = z.unknown().refine((value) => {
  if (value === undefined) return false;
  try {
    return JSON.stringify(value).length <= MAX_CHART_STATE_BYTES;
  } catch {
    return false;
  }
}, `Chart state must be JSON under ${MAX_CHART_STATE_BYTES} bytes`);

export const saveChartStateSchema = z.object({
  key: chartStateKeySchema,
  payload: payloadSchema,
});

export const deleteChartStateSchema = z.object({ key: chartStateKeySchema });

export const listChartStateSchema = z.object({
  /** "drawings:RELIANCE" or a fixed key; omit to list everything but drawings. */
  keys: z
    .string()
    .optional()
    .transform((value) =>
      value ? value.split(",").map((entry) => entry.trim()) : [],
    ),
});

export type SaveChartStateInput = z.infer<typeof saveChartStateSchema>;

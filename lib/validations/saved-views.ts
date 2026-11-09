import { z } from "zod";

// Scopes are per-screen: a view saved on the market table must not show up on
// a table with different columns. Add a scope here when a new screen adopts
// saved views.
export const savedViewScopes = ["market"] as const;
export const savedViewScopeSchema = z.enum(savedViewScopes).default("market");

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NAME_LENGTH = 60;
const MAX_LIST_VALUES = 200;
const MAX_VALUE_LENGTH = 100;

const filterValues = z
  .array(z.string().min(1).max(MAX_VALUE_LENGTH))
  .max(MAX_LIST_VALUES)
  .default([]);

// Mirrors FilterPanel's FilterState. The numeric fields are strings because
// that is what the inputs hold — "" means "not set", same as the live page.
const numericField = z.string().max(32).default("");

export const savedViewFiltersSchema = z.object({
  sectors: filterValues,
  industries: filterValues,
  marketCaps: filterValues,
  priceBands: filterValues,
  series: filterValues,
  priceMin: numericField,
  priceMax: numericField,
  changeMin: numericField,
  changeMax: numericField,
  volumeMin: numericField,
  marketCapMin: numericField,
  marketCapMax: numericField,
});

export const savedViewPayloadSchema = z.object({
  filters: savedViewFiltersSchema,
  hiddenColumns: filterValues,
  addColumns: z
    .object({
      timeframes: filterValues,
      groups: z.record(z.string().max(MAX_VALUE_LENGTH), filterValues),
    })
    .default({ timeframes: [], groups: {} }),
  exchange: z.string().max(20).optional(),
  tab: z.string().max(40).optional(),
  sort: z.string().max(40).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  // Without these a view saved on the Customize Date tab would restore the tab
  // but not the range it was built around.
  customDate: z.string().regex(ISO_DATE_PATTERN).optional(),
  customEndDate: z.string().regex(ISO_DATE_PATTERN).optional(),
});

export const savedViewNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or fewer`);

export const listSavedViewsSchema = z.object({
  scope: savedViewScopeSchema,
});

export const saveSavedViewSchema = z.object({
  name: savedViewNameSchema,
  scope: savedViewScopeSchema,
  payload: savedViewPayloadSchema,
});

export const deleteSavedViewSchema = z.object({
  id: z.string().min(1, "Saved view ID is required"),
});

export type SavedViewScope = z.infer<typeof savedViewScopeSchema>;
export type SavedViewPayload = z.infer<typeof savedViewPayloadSchema>;
export type SaveSavedViewInput = z.infer<typeof saveSavedViewSchema>;
export type DeleteSavedViewInput = z.infer<typeof deleteSavedViewSchema>;

import { z } from "zod";
import { watchlistCategorySchema } from "./watchlist";

export const alertDirections = ["above", "below"] as const;
export const alertDirectionSchema = z.enum(alertDirections);

export const alertSources = [
  "watchlist",
  "preposition",
  "paper",
  "live",
  "others",
] as const;
export const alertSourceSchema = z.enum(alertSources);

export const createAlertSchema = z.object({
  tradingSymbol: z.string().min(1, "Trading symbol is required"),
  displayName: z.string().min(1, "Display name is required"),
  targetPrice: z.number().positive("Target price must be positive"),
  direction: alertDirectionSchema,
  source: alertSourceSchema.default("others"),
  category: watchlistCategorySchema.default("swing"),
});

export const deleteAlertSchema = z.object({
  id: z.string().min(1, "Alert ID is required"),
});

// Modify: only an alert that hasn't fired yet can be edited (see
// AlertService.update). At least one of the two fields must be present -
// a bare {id} would be a no-op update.
export const updateAlertSchema = z
  .object({
    id: z.string().min(1, "Alert ID is required"),
    targetPrice: z
      .number()
      .positive("Target price must be positive")
      .optional(),
    direction: alertDirectionSchema.optional(),
  })
  .refine(
    (value) => value.targetPrice !== undefined || value.direction !== undefined,
    { message: "Provide a target price or a direction to update" },
  );

export type AlertDirection = z.infer<typeof alertDirectionSchema>;
export type AlertSource = z.infer<typeof alertSourceSchema>;
export type CreateAlertInput = z.infer<typeof createAlertSchema>;
export type DeleteAlertInput = z.infer<typeof deleteAlertSchema>;
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;

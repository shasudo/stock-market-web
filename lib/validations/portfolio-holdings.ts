import { z } from "zod";

export const addHoldingSchema = z.object({
  tradingSymbol: z.string().min(1, "Trading symbol is required"),
  displayName: z.string().min(1, "Display name is required"),
  quantity: z.number().positive("Quantity must be positive"),
  avgPrice: z.number().positive("Average price must be positive"),
});

export const deleteHoldingSchema = z.object({
  id: z.string().min(1, "Holding ID is required"),
});

export type AddHoldingInput = z.infer<typeof addHoldingSchema>;
export type DeleteHoldingInput = z.infer<typeof deleteHoldingSchema>;

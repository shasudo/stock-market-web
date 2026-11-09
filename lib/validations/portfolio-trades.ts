import { z } from "zod";
import { watchlistCategorySchema } from "./watchlist";

export const tradeModes = ["paper", "live"] as const;
export const tradeModeSchema = z.enum(tradeModes);

export const addTradeSchema = z.object({
  mode: tradeModeSchema,
  tradingType: watchlistCategorySchema,
  instrument: z.string().min(1).default("EQUITY"),
  tradingSymbol: z.string().min(1, "Trading symbol is required"),
  sector: z.string().default("-"),
  industry: z.string().default("-"),
  quantity: z.number().positive("Quantity must be positive"),
  entryPrice: z.number().positive("Entry price must be positive"),
});

export const listTradesSchema = z.object({
  mode: tradeModeSchema,
});

export const deleteTradeSchema = z.object({
  id: z.string().min(1, "Trade ID is required"),
});

// Hand-entered per trade, edited in place on the table (same convention as
// the watchlist's levels). exitPrice is 0 while the position stays open;
// setting it is what turns the P&L column from unrealized-vs-LTP into
// realized-vs-exit.
export const tradeLevelFields = [
  "entryPrice",
  "stopLoss",
  "target1",
  "target2",
  "target3",
  "exitPrice",
] as const;
export type TradeLevelField = (typeof tradeLevelFields)[number];

export const updateTradeLevelSchema = z.object({
  id: z.string().min(1, "Trade ID is required"),
  mode: tradeModeSchema,
  field: z.enum(tradeLevelFields),
  value: z.number().min(0, "Value must be non-negative"),
});

export const moveTradeSchema = z.object({
  id: z.string().min(1, "Trade ID is required"),
  mode: tradeModeSchema,
  tradingType: watchlistCategorySchema,
});

export type TradeMode = z.infer<typeof tradeModeSchema>;
export type AddTradeInput = z.infer<typeof addTradeSchema>;
export type ListTradesInput = z.infer<typeof listTradesSchema>;
export type DeleteTradeInput = z.infer<typeof deleteTradeSchema>;
export type UpdateTradeLevelInput = z.infer<typeof updateTradeLevelSchema>;
export type MoveTradeInput = z.infer<typeof moveTradeSchema>;

import { z } from "zod";

export const watchlistCategories = [
  "intraday",
  "fno",
  "swing",
  "positional",
  "multibagger",
] as const;

export const watchlistCategorySchema = z.enum(watchlistCategories);

export const watchlistListTypes = ["normal", "preposition"] as const;

export const watchlistListTypeSchema = z.enum(watchlistListTypes);

const MAX_FOLDER_NAME_LENGTH = 40;

export const watchlistFolderNameSchema = z
  .string()
  .trim()
  .min(1, "Folder name is required")
  .max(
    MAX_FOLDER_NAME_LENGTH,
    `Folder name must be ${MAX_FOLDER_NAME_LENGTH} characters or fewer`,
  );

export const createWatchlistFolderSchema = z.object({
  name: watchlistFolderNameSchema,
});

export const renameWatchlistFolderSchema = z.object({
  watchlistId: z.string().min(1, "Watchlist ID is required"),
  name: watchlistFolderNameSchema,
});

export const deleteWatchlistFolderSchema = z.object({
  watchlistId: z.string().min(1, "Watchlist ID is required"),
});

export const moveWatchlistStockSchema = z.object({
  stockId: z.string().min(1, "Stock ID is required"),
  watchlistId: z.string().min(1, "Watchlist ID is required"),
});

const watchlistLevel = (label: string) =>
  z.number().min(0, `${label} must be non-negative`).default(0);

export const watchlistLevelFields = [
  "entryPrice",
  "stopLoss",
  "target1",
  "target2",
  "target3",
] as const;

export type WatchlistLevelField = (typeof watchlistLevelFields)[number];

export const watchlistStockSchema = z.object({
  // Which folder to add to. Omitted means the user's default folder, which is
  // what every quick-add from a three-dot menu does.
  watchlistId: z.string().min(1).optional(),
  sNo: z.number().int().positive(),
  date: z.coerce.date(),
  sourceFrom: z.string().min(1, "Source is required"),
  segments: z.string().min(1, "Segment is required"),
  tradingSymbol: z.string().min(1, "Trading symbol is required"),
  sector: z.string().min(1, "Sector is required"),
  industry: z.string().min(1, "Industry is required"),
  ltp: z.number().min(0, "LTP must be non-negative"),
  // Levels are the user's own numbers, typed in on the table after adding.
  // Zero means "not set" and is what a quick-add leaves behind.
  entryPrice: watchlistLevel("Entry price"),
  stopLoss: watchlistLevel("Stop loss"),
  target1: watchlistLevel("Target 1"),
  target2: watchlistLevel("Target 2"),
  target3: watchlistLevel("Target 3"),
  redFlags: z.string().default(""),
  note: z.string().default(""),
  category: watchlistCategorySchema,
  listType: watchlistListTypeSchema.default("normal"),
});

export const addStockSchema = watchlistStockSchema;

export const removeStockSchema = z.object({
  stockId: z.string().min(1, "Stock ID is required"),
});

export const updateStockSchema = watchlistStockSchema.partial().extend({
  stockId: z.string().min(1, "Stock ID is required"),
});

/**
 * A single in-place edit of one level on one row. Deliberately narrow: the
 * table only ever writes one number at a time.
 */
export const updateWatchlistLevelSchema = z.object({
  stockId: z.string().min(1, "Stock ID is required"),
  field: z.enum(watchlistLevelFields),
  value: z.number().min(0, "Value must be non-negative"),
});

export type CreateWatchlistFolderInput = z.infer<
  typeof createWatchlistFolderSchema
>;
export type RenameWatchlistFolderInput = z.infer<
  typeof renameWatchlistFolderSchema
>;
export type DeleteWatchlistFolderInput = z.infer<
  typeof deleteWatchlistFolderSchema
>;
export type MoveWatchlistStockInput = z.infer<typeof moveWatchlistStockSchema>;
export type UpdateWatchlistLevelInput = z.infer<
  typeof updateWatchlistLevelSchema
>;
export type WatchlistCategory = z.infer<typeof watchlistCategorySchema>;
export type WatchlistListType = z.infer<typeof watchlistListTypeSchema>;
export type WatchlistStockInput = z.infer<typeof watchlistStockSchema>;
export type AddStockInput = z.infer<typeof addStockSchema>;
export type RemoveStockInput = z.infer<typeof removeStockSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;

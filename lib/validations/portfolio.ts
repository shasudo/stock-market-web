import { z } from "zod";

export const marketConditions = [
  "Bull Market",
  "Bullish to Bearish",
  "Side Ways Market",
  "Bear Market",
  "Bearish to Bullish",
] as const;

export const marketConditionSchema = z.enum(marketConditions);

export const strategySchema = z.object({
  name: z.string().trim().min(1, "Strategy name is required").max(120),
  allocationPercent: z.number().finite().min(0).max(100).default(0),
  allocationRupees: z.number().finite().min(0).default(0),
  usedFunds: z.number().finite().min(0).default(0),
  unusedFunds: z.number().finite().min(0).default(0),
});

export const getPortfolioSchema = z.object({
  marketCondition: marketConditionSchema,
});

export const experienceNoteSchema = z.object({
  positive: z.string().default(""),
  negative: z.string().default(""),
});

export const updatePortfolioSchema = z
  .object({
    marketCondition: marketConditionSchema,
    totalCapital: z.number().finite().min(0).default(100000),
    strategies: z
      .array(strategySchema)
      .min(1, "At least one strategy is required"),
    experienceNotes: z.array(experienceNoteSchema).optional().default([]),
  })
  .superRefine(({ strategies }, context) => {
    const totalAllocation = strategies.reduce(
      (total, strategy) => total + strategy.allocationPercent,
      0,
    );

    if (totalAllocation > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["strategies"],
        message: "Total strategy allocation must not exceed 100%",
      });
    }
  });

export type MarketCondition = z.infer<typeof marketConditionSchema>;
export type Strategy = z.infer<typeof strategySchema>;
export type GetPortfolioInput = z.infer<typeof getPortfolioSchema>;
export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;

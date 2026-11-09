import { z } from "zod";
import { getIndicatorDefinition } from "@/lib/technical/indicator-catalog";
import { isBasicCandlestickPattern } from "@/lib/technical/patterns";
import { COMPARISON_OPERATORS, PRICE_FIELDS } from "@/lib/backtest/types";

const priceFieldSchema = z.enum(PRICE_FIELDS);
const indicatorInputValueSchema = z.union([z.number(), z.string(), z.boolean()]);

const seriesRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("price"), source: priceFieldSchema }),
  z.object({
    kind: z.literal("indicator"),
    indicatorId: z
      .string()
      .trim()
      .min(1)
      .refine((id) => getIndicatorDefinition(id) !== undefined, {
        message: "Unknown indicator id",
      }),
    plotKey: z.string().trim().min(1),
    inputs: z.record(z.string(), indicatorInputValueSchema).default({}),
  }),
]);

const conditionTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("value"), value: z.number().finite() }),
  ...seriesRefSchema.options,
]);

const strategyConditionSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().trim().min(1),
    kind: z.literal("comparison"),
    left: seriesRefSchema,
    operator: z.enum(COMPARISON_OPERATORS),
    right: conditionTargetSchema,
  }),
  z.object({
    id: z.string().trim().min(1),
    kind: z.literal("pattern"),
    patternId: z
      .string()
      .trim()
      .min(1)
      .refine(isBasicCandlestickPattern, { message: "Unknown candlestick pattern id" }),
  }),
]);

const stopLossConfigSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("percent"), percent: z.number().finite().positive().max(100) }),
  z.object({
    kind: z.literal("atrMultiple"),
    atrLength: z.number().int().positive().max(500),
    multiple: z.number().finite().positive().max(50),
  }),
]);

const partialBookingConfigSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({
    kind: z.literal("targetPercent"),
    percent: z.number().finite().positive().max(1000),
    bookFraction: z.number().finite().min(0.01).max(1),
  }),
]);

const strategyLegsSchema = z.object({
  buy: z.array(strategyConditionSchema).max(10),
  exit: z.array(strategyConditionSchema).max(10),
  initialStopLoss: stopLossConfigSchema,
  trailingStopLoss: stopLossConfigSchema,
  partialBooking: partialBookingConfigSchema,
});

export const saveStrategySchema = z.object({
  name: z.string().trim().min(1, "Strategy name is required").max(120),
  timeframe: z.string().trim().min(1).max(40),
  instrument: z.string().trim().min(1).max(40),
  tradingType: z.string().trim().min(1).max(40),
  legs: strategyLegsSchema,
});

export type SaveStrategyInput = z.infer<typeof saveStrategySchema>;
export type StrategyLegsInput = z.infer<typeof strategyLegsSchema>;
export type StrategyConditionInput = z.infer<typeof strategyConditionSchema>;

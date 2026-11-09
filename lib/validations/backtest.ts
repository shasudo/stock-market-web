import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const runBacktestSchema = z
  .object({
    strategyId: z.string().trim().min(1),
    symbol: z.string().trim().min(1).max(40),
    fromDate: isoDateSchema,
    toDate: isoDateSchema,
    initialCapital: z.number().finite().positive().max(1_000_000_000),
  })
  .superRefine(({ fromDate, toDate }, context) => {
    if (fromDate >= toDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toDate"],
        message: "toDate must be after fromDate",
      });
    }
  });

export type RunBacktestInput = z.infer<typeof runBacktestSchema>;

export const listBacktestRunsSchema = z.object({
  strategyId: z.string().trim().min(1),
});

export type ListBacktestRunsInput = z.infer<typeof listBacktestRunsSchema>;

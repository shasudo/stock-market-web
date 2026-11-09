import { z } from "zod";

export const diaryMoods = ["great", "good", "neutral", "bad", "terrible"] as const;

export const diaryMoodSchema = z.enum(diaryMoods);

export const createDiaryEntrySchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters")
    .transform((val) => val.trim()),
  content: z.string().default(""),
  mood: diaryMoodSchema.default("neutral"),
  entryDate: z.coerce.date().default(() => new Date()),
  tags: z.array(z.string().max(50)).max(10).default([]),
});

export const updateDiaryEntrySchema = z.object({
  id: z.string().min(1, "Diary entry ID is required"),
  title: z
    .string()
    .min(1, "Title cannot be empty")
    .max(200, "Title must be at most 200 characters")
    .transform((val) => val.trim())
    .optional(),
  content: z.string().optional(),
  mood: diaryMoodSchema.optional(),
  entryDate: z.coerce.date().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const deleteDiaryEntrySchema = z.object({
  id: z.string().min(1, "Diary entry ID is required"),
});

export type DiaryMood = z.infer<typeof diaryMoodSchema>;
export type CreateDiaryEntryInput = z.infer<typeof createDiaryEntrySchema>;
export type UpdateDiaryEntryInput = z.infer<typeof updateDiaryEntrySchema>;
export type DeleteDiaryEntryInput = z.infer<typeof deleteDiaryEntrySchema>;

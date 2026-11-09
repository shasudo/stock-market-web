import { z } from "zod";

export const noteColors = [
  "slate",
  "zinc",
  "stone",
  "neutral",
  "gray",
  "dark",
] as const;

export const noteColorSchema = z.enum(noteColors);

export const createNoteSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters")
    .transform((val) => val.trim()),
  content: z.string().default(""),
  color: noteColorSchema.default("slate"),
  tags: z.array(z.string().max(50)).max(10).default([]),
});

export const updateNoteSchema = z.object({
  id: z.string().min(1, "Note ID is required"),
  title: z
    .string()
    .min(1, "Title cannot be empty")
    .max(200, "Title must be at most 200 characters")
    .transform((val) => val.trim())
    .optional(),
  content: z.string().optional(),
  color: noteColorSchema.optional(),
  isPinned: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const deleteNoteSchema = z.object({
  id: z.string().min(1, "Note ID is required"),
});

export type NoteColor = z.infer<typeof noteColorSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type DeleteNoteInput = z.infer<typeof deleteNoteSchema>;

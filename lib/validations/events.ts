import { z } from "zod";

export const eventCategories = [
  "personal",
  "market",
  "earnings",
  "meeting",
  "reminder",
  "other",
] as const;

export const eventCategorySchema = z.enum(eventCategories);

export const createEventSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters")
    .transform((val) => val.trim()),
  description: z.string().default(""),
  eventDate: z.coerce.date(),
  isAllDay: z.boolean().default(true),
  category: eventCategorySchema.default("personal"),
  location: z.string().max(200).default(""),
});

export const updateEventSchema = z.object({
  id: z.string().min(1, "Event ID is required"),
  title: z
    .string()
    .min(1, "Title cannot be empty")
    .max(200, "Title must be at most 200 characters")
    .transform((val) => val.trim())
    .optional(),
  description: z.string().optional(),
  eventDate: z.coerce.date().optional(),
  isAllDay: z.boolean().optional(),
  category: eventCategorySchema.optional(),
  location: z.string().max(200).optional(),
});

export const deleteEventSchema = z.object({
  id: z.string().min(1, "Event ID is required"),
});

export type EventCategory = z.infer<typeof eventCategorySchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type DeleteEventInput = z.infer<typeof deleteEventSchema>;

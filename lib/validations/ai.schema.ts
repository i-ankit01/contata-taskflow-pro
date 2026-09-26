import { z } from "zod";

export const aiSuggestionSchema = z.object({
  taskId: z.string().min(1),
  dependsOnTaskId: z.string().min(1),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const aiSuggestionResponseSchema = z.object({
  suggestions: z.array(aiSuggestionSchema),
});

export type AISuggestion = z.infer<typeof aiSuggestionSchema>;
export type AISuggestionResponse = z.infer<typeof aiSuggestionResponseSchema>;
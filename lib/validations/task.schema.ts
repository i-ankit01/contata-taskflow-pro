import { z } from "zod";

export const taskStatusEnum = z.enum(["BACKLOG", "IN_PROGRESS", "REVIEW", "DONE"]);

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: taskStatusEnum.optional().default("BACKLOG"),
  startDate: z.coerce.date().optional(),
  duration: z.number().int().positive().optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    status: taskStatusEnum.optional(),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    duration: z.number().int().positive().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
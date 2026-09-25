import { z } from "zod";

export const createDependencySchema = z
  .object({
    taskId: z.string().min(1),
    dependsOnTaskId: z.string().min(1),
  })
  .refine((data) => data.taskId !== data.dependsOnTaskId, {
    message: "A task cannot depend on itself",
  });

export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
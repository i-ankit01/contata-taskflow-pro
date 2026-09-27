import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
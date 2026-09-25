import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { createTaskSchema } from "@/lib/validations/task.schema";
import { listTasksWithReadiness, createTask } from "@/lib/services/taskService";

export async function GET() {
  try {
    const tasks = await listTasksWithReadiness();
    return ok(tasks);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to list tasks", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  try {
    const task = await createTask(parsed.data);
    return ok(task, 201);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to create task", 500);
  }
}
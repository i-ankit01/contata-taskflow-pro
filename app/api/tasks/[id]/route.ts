import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { updateTaskSchema } from "@/lib/validations/task.schema";
import { updateTask } from "@/lib/services/taskService";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  try {
    const { id } = await params;
    const task = await updateTask(id, parsed.data);
    return ok(task);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update task";
    return fail(message, message === "Task not found" ? 404 : 500);
  }
}
import { db } from "@/lib/db";
import { loadGraph } from "./graphState";
import { getReadiness } from "@/lib/graph/readiness";
import { propagateSchedule } from "@/lib/graph/propagation";
import { computeCascadingRegressions } from "@/lib/graph/rollback";
import { CreateTaskInput, UpdateTaskInput } from "@/lib/validations/task.schema";

export async function listTasksWithReadiness() {
  const graph = await loadGraph();
  const tasks = await db.task.findMany({ orderBy: { createdAt: "asc" } });

  return tasks.map((t) => ({
    ...t,
    readiness: getReadiness(graph, t.id),
  }));
}

export async function createTask(input: CreateTaskInput) {
  const endDate =
    input.startDate && input.duration
      ? new Date(new Date(input.startDate).getTime() + input.duration * 86400000)
      : undefined;

  return db.task.create({
    data: {
      title: input.title,
      description: input.description,
      status: input.status,
      startDate: input.startDate,
      endDate,
      duration: input.duration,
    },
  });
}

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const existing = await db.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error("Task not found");

  const isRegressionFromDone =
    existing.status === "DONE" &&
    input.status !== undefined &&
    input.status !== "DONE";

  const datesChanged =
    (input.startDate !== undefined && input.startDate?.getTime() !== existing.startDate?.getTime()) ||
    (input.endDate !== undefined && input.endDate?.getTime() !== existing.endDate?.getTime()) ||
    (input.duration !== undefined && input.duration !== existing.duration);

  const updated = await db.task.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.endDate !== undefined && { endDate: input.endDate }),
      ...(input.duration !== undefined && { duration: input.duration }),
    },
  });

  // Readiness needs no extra write — it's derived fresh on every GET via
  // getReadiness(). But status IS a stored field, and a task sitting in
  // Done while its prerequisite chain is no longer satisfied shouldn't
  // stay there silently. Cascade any downstream DONE tasks back to REVIEW.
  if (isRegressionFromDone) {
    const graph = await loadGraph(); // reflects the status write above
    const cascadeIds = computeCascadingRegressions(graph, taskId);

    if (cascadeIds.length > 0) {
      await db.$transaction(
        cascadeIds.map((id) =>
          db.task.update({ where: { id }, data: { status: "REVIEW" } })
        )
      );
    }
  }

  if (datesChanged) {
    const graph = await loadGraph();
    const propagated = propagateSchedule(graph, taskId);

    const writes = [];
    for (const [id, node] of propagated.nodes) {
      if (id === taskId) continue;
      const original = graph.nodes.get(id);
      if (
        original &&
        (original.startDate?.getTime() !== node.startDate?.getTime() ||
          original.endDate?.getTime() !== node.endDate?.getTime())
      ) {
        writes.push(
          db.task.update({
            where: { id },
            data: { startDate: node.startDate, endDate: node.endDate },
          })
        );
      }
    }
    if (writes.length > 0) await db.$transaction(writes);
  }

  return updated;
}
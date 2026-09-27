import { db } from "@/lib/db";
import { loadGraph } from "./graphState";
import { getReadiness } from "@/lib/graph/readiness";
import { propagateSchedule, addDays } from "@/lib/graph/propagation";
import { computeCascadingRegressions } from "@/lib/graph/rollback";
import { CreateTaskInput, UpdateTaskInput } from "@/lib/validations/task.schema";

export async function listTasksWithReadiness(projectId: string) {
  const graph = await loadGraph(projectId);
  const tasks = await db.task.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  return tasks.map((t) => ({
    ...t,
    readiness: getReadiness(graph, t.id),
  }));
}

export async function createTask(projectId: string, input: CreateTaskInput) {
  const endDate =
    input.startDate && input.duration
      ? addDays(new Date(input.startDate), input.duration)
      : undefined;

  return db.task.create({
    data: {
      projectId,
      title: input.title,
      description: input.description,
      status: input.status,
      startDate: input.startDate,
      endDate,
      duration: input.duration,
    },
  });
}

export async function updateTask(projectId: string, taskId: string, input: UpdateTaskInput) {
  const existing = await db.task.findUnique({ where: { id: taskId } });
  if (!existing || existing.projectId !== projectId) throw new Error("Task not found");

  const isRegressionFromDone =
    existing.status === "DONE" && input.status !== undefined && input.status !== "DONE";

  const durationChanged = input.duration !== undefined && input.duration !== existing.duration;

  let computedEndDate = input.endDate;
  if (
    durationChanged &&
    input.startDate === undefined &&
    input.endDate === undefined &&
    existing.startDate
  ) {
    computedEndDate = addDays(existing.startDate, input.duration!);
  }

  const datesChanged =
    durationChanged ||
    (input.startDate !== undefined && input.startDate?.getTime() !== existing.startDate?.getTime()) ||
    (input.endDate !== undefined && input.endDate?.getTime() !== existing.endDate?.getTime());

  const updated = await db.task.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(computedEndDate !== undefined && { endDate: computedEndDate }),
      ...(input.duration !== undefined && { duration: input.duration }),
    },
  });

  if (isRegressionFromDone) {
    const graph = await loadGraph(projectId);
    const cascadeIds = computeCascadingRegressions(graph, taskId);
    if (cascadeIds.length > 0) {
      await db.$transaction(
        cascadeIds.map((id) => db.task.update({ where: { id }, data: { status: "REVIEW" } }))
      );
    }
  }

  if (datesChanged) {
    const graph = await loadGraph(projectId);
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
          db.task.update({ where: { id }, data: { startDate: node.startDate, endDate: node.endDate } })
        );
      }
    }
    if (writes.length > 0) await db.$transaction(writes);
  }

  return updated;
}
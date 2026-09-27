import { db } from "@/lib/db";
import { loadGraph } from "./graphState";
import { validateNewEdge, CycleError } from "@/lib/graph/cycleDetection";
import { CreateDependencyInput } from "@/lib/validations/dependency.schema";

export class CrossProjectError extends Error {
  constructor(message = "Both tasks must belong to the same project.") {
    super(message);
    this.name = "CrossProjectError";
  }
}

export async function createDependency(projectId: string, input: CreateDependencyInput) {
  const [taskA, taskB] = await Promise.all([
    db.task.findUnique({ where: { id: input.taskId } }),
    db.task.findUnique({ where: { id: input.dependsOnTaskId } }),
  ]);

  if (!taskA || !taskB) throw new Error("One or both tasks do not exist");
  if (taskA.projectId !== projectId || taskB.projectId !== projectId) {
    throw new CrossProjectError();
  }

  const graph = await loadGraph(projectId);

  // Cycle check runs BEFORE any DB write — a rejected request touches nothing.
  validateNewEdge(graph, { taskId: input.taskId, dependsOnTaskId: input.dependsOnTaskId });

  return db.dependency.create({
    data: { taskId: input.taskId, dependsOnTaskId: input.dependsOnTaskId },
  });
}

export async function listDependencies(projectId: string) {
  return db.dependency.findMany({
    where: { task: { projectId } },
    orderBy: { createdAt: "asc" },
  });
}

export async function deleteDependency(projectId: string, id: string) {
  const existing = await db.dependency.findUnique({ where: { id }, include: { task: true } });
  if (!existing || existing.task.projectId !== projectId) throw new Error("Dependency not found");
  return db.dependency.delete({ where: { id } });
}

export { CycleError };
import { db } from "@/lib/db";
import { loadGraph } from "./graphState";
import { validateNewEdge, CycleError } from "@/lib/graph/cycleDetection";
import { CreateDependencyInput } from "@/lib/validations/dependency.schema";

export async function createDependency(input: CreateDependencyInput) {
  const graph = await loadGraph();

  if (!graph.nodes.has(input.taskId) || !graph.nodes.has(input.dependsOnTaskId)) {
    throw new Error("One or both tasks do not exist");
  }

  // Cycle check runs BEFORE any DB write — a rejected request touches nothing.
  validateNewEdge(graph, {
    taskId: input.taskId,
    dependsOnTaskId: input.dependsOnTaskId,
  });

  return db.dependency.create({
    data: {
      taskId: input.taskId,
      dependsOnTaskId: input.dependsOnTaskId,
    },
  });
}

export async function deleteDependency(id: string) {
  const existing = await db.dependency.findUnique({ where: { id } });
  if (!existing) throw new Error("Dependency not found");
  return db.dependency.delete({ where: { id } });
}

export { CycleError };
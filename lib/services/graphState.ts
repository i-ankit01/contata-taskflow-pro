import { db } from "@/lib/db";
import { Graph, GraphNode, GraphEdge } from "@/lib/graph/types";
import { buildGraph } from "@/lib/graph/buildGraph";

/** Loads the full task/dependency graph from the DB as plain objects. */
export async function loadGraph(): Promise<Graph> {
  const [tasks, dependencies] = await Promise.all([
    db.task.findMany(),
    db.dependency.findMany(),
  ]);

  const nodes: GraphNode[] = tasks.map((t) => ({
    id: t.id,
    startDate: t.startDate,
    endDate: t.endDate,
    duration: t.duration,
    status: t.status,
  }));

  const edges: GraphEdge[] = dependencies.map((d) => ({
    taskId: d.taskId,
    dependsOnTaskId: d.dependsOnTaskId,
  }));

  return buildGraph(nodes, edges);
}
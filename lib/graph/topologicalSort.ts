import { Graph } from "./types";

/**
 * Kahn's algorithm. Returns task ids in an order where every task appears
 * after all of its own prerequisites.
 * Throws if the graph has a cycle (should never happen if cycleDetection
 * gated every write, but this is a safety net).
 */
export function topologicalSort(graph: Graph): string[] {
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // prereqId -> [taskIds that depend on it]

  for (const id of graph.nodes.keys()) {
    inDegree.set(id, 0);
    dependents.set(id, []);
  }

  for (const e of graph.edges) {
    // e.taskId depends on e.dependsOnTaskId
    if (!inDegree.has(e.taskId) || !dependents.has(e.dependsOnTaskId)) continue;
    inDegree.set(e.taskId, (inDegree.get(e.taskId) ?? 0) + 1);
    dependents.get(e.dependsOnTaskId)!.push(e.taskId);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const dep of dependents.get(current) ?? []) {
      inDegree.set(dep, inDegree.get(dep)! - 1);
      if (inDegree.get(dep) === 0) queue.push(dep);
    }
  }

  if (order.length !== graph.nodes.size) {
    throw new Error("Graph contains a cycle — cannot produce a topological order.");
  }

  return order;
}
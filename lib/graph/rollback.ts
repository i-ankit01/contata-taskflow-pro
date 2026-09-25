import { Graph, TaskStatus } from "./types";
import { getDependents } from "./buildGraph";
import { getReadiness } from "./readiness";

/**
 * Called when a task's status moves away from DONE. Walks all downstream
 * dependents (recursively) and returns the set of task ids whose readiness
 * is now BLOCKED as a result. Does not mutate the graph — readiness is
 * always derived, never stored, so this is just informational for the
 * caller (e.g. to know which cards to re-render / notify about).
 */
export function recomputeDownstreamReadiness(
  graph: Graph,
  regressedTaskId: string
): Map<string, "READY" | "BLOCKED"> {
  const result = new Map<string, "READY" | "BLOCKED">();
  const visited = new Set<string>();
  const queue: string[] = getDependents(graph, regressedTaskId);

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const readiness = getReadiness(graph, id);
    result.set(id, readiness);

    for (const dep of getDependents(graph, id)) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }

  return result;
}
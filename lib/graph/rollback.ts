import { Graph, TaskStatus } from "./types";
import { getDependents, getPrerequisites } from "./buildGraph";
import { getReadiness } from "./readiness";
import { topologicalSort } from "./topologicalSort";

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

/**
 * When a task regresses off DONE, any downstream task that is currently
 * marked DONE but whose prerequisites are no longer all DONE (directly or
 * transitively) should not remain DONE. Returns the ids of downstream
 * tasks that should move from DONE to REVIEW.
 *
 * Does NOT persist anything and does NOT store a "blocked" flag — readiness
 * stays fully derived. This only decides which *status* writes the caller
 * should make, since status (unlike readiness) is a real stored field.
 *
 * `graph` must reflect the root task's own status change already (i.e.
 * call this after the root's status write has landed and been reloaded).
 * Processes strictly in topological order so multi-step transitive
 * cascades (A -> B -> C, both B and C were DONE) resolve in one pass, using
 * simulated status overrides rather than recursion or repeated DB reads.
 */
export function computeCascadingRegressions(
  graph: Graph,
  regressedTaskId: string
): string[] {
  const order = topologicalSort(graph);
  const startIndex = order.indexOf(regressedTaskId);
  if (startIndex === -1) return [];

  const statusOverride = new Map<string, TaskStatus>();
  const toRegress: string[] = [];

  for (let i = startIndex + 1; i < order.length; i++) {
    const id = order[i];
    const node = graph.nodes.get(id);
    if (!node) continue;

    const prereqIds = getPrerequisites(graph, id);
    if (prereqIds.length === 0) continue;

    const allPrereqsDone = prereqIds.every((pid) => {
      const status = statusOverride.get(pid) ?? graph.nodes.get(pid)?.status;
      return status === "DONE";
    });

    if (allPrereqsDone) continue;

    const currentStatus = statusOverride.get(id) ?? node.status;
    if (currentStatus === "DONE") {
      toRegress.push(id);
      statusOverride.set(id, "REVIEW");
    }
  }

  return toRegress;
}
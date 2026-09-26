import { Graph } from "./types";
import { getPrerequisites, getDependents } from "./buildGraph";
import { topologicalSort } from "./topologicalSort";

/**
 * Returns the ordered list of task ids forming the critical path — the
 * longest chain of durations from a root task to a sink task. This is the
 * chain that determines the overall project length; anything on it has
 * zero slack.
 */
export function computeCriticalPath(graph: Graph): string[] {
  const order = topologicalSort(graph);
  const earliestFinish = new Map<string, number>();
  const bestPrereq = new Map<string, string | null>();

  for (const id of order) {
    const duration = graph.nodes.get(id)?.duration ?? 0;
    const prereqs = getPrerequisites(graph, id);

    if (prereqs.length === 0) {
      earliestFinish.set(id, duration);
      bestPrereq.set(id, null);
      continue;
    }

    let maxPrereqFinish = -Infinity;
    let chosen: string | null = null;
    for (const p of prereqs) {
      const pf = earliestFinish.get(p) ?? 0;
      if (pf > maxPrereqFinish) {
        maxPrereqFinish = pf;
        chosen = p;
      }
    }
    earliestFinish.set(id, maxPrereqFinish + duration);
    bestPrereq.set(id, chosen);
  }

  // The path ends at whichever sink (no dependents) has the max finish time.
  let endNode: string | null = null;
  let maxFinish = -Infinity;
  for (const id of graph.nodes.keys()) {
    if (getDependents(graph, id).length === 0) {
      const f = earliestFinish.get(id) ?? 0;
      if (f > maxFinish) {
        maxFinish = f;
        endNode = id;
      }
    }
  }
  if (!endNode) return [];

  const path: string[] = [];
  let current: string | null = endNode;
  while (current) {
    path.unshift(current);
    current = bestPrereq.get(current) ?? null;
  }
  return path;
}
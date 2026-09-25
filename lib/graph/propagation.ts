import { Graph } from "./types";
import { getPrerequisites } from "./buildGraph";
import { topologicalSort } from "./topologicalSort";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Recomputes startDate/endDate for every node reachable from the changed
 * task, in topological order, single pass. Each node's startDate = MAX
 * over its direct prerequisites' endDate (never a sum). Mutates and
 * returns a NEW graph (does not mutate the input).
 */
export function propagateSchedule(graph: Graph, changedTaskId: string): Graph {
  const nodes = new Map(graph.nodes);
  const order = topologicalSort(graph);

  const changedIndex = order.indexOf(changedTaskId);
  if (changedIndex === -1) return { nodes, edges: graph.edges };

  // Process changedTaskId and everything after it in topo order exactly once.
  for (let i = changedIndex; i < order.length; i++) {
    const id = order[i];
    const node = nodes.get(id);
    if (!node) continue;

    if (id === changedTaskId) {
      // The changed task's own dates are assumed already set by the caller
      // (e.g. a manual date edit). Just ensure endDate is consistent.
      if (node.startDate && node.duration != null && !node.endDate) {
        nodes.set(id, { ...node, endDate: addDays(node.startDate, node.duration) });
      }
      continue;
    }

    const prereqIds = getPrerequisites({ nodes, edges: graph.edges }, id);
    if (prereqIds.length === 0) continue; // no upstream change reaches this node

    const prereqEndDates = prereqIds
      .map((pid) => nodes.get(pid)?.endDate)
      .filter((d): d is Date => d != null);

    if (prereqEndDates.length === 0) continue;

    const newStart = new Date(Math.max(...prereqEndDates.map((d) => d.getTime())));
    const duration = node.duration ?? 0;
    const newEnd = addDays(newStart, duration);

    nodes.set(id, { ...node, startDate: newStart, endDate: newEnd });
  }

  return { nodes, edges: graph.edges };
}
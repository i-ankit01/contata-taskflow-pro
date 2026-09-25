import { Graph } from "./types";
import { getPrerequisites } from "./buildGraph";

export type Readiness = "READY" | "BLOCKED";

/** A task is Ready iff every direct prerequisite has status DONE. */
export function getReadiness(graph: Graph, taskId: string): Readiness {
  const prereqs = getPrerequisites(graph, taskId);
  if (prereqs.length === 0) return "READY";

  for (const prereqId of prereqs) {
    const prereqNode = graph.nodes.get(prereqId);
    if (!prereqNode || prereqNode.status !== "DONE") return "BLOCKED";
  }
  return "READY";
}

/** Readiness for every node in the graph, keyed by task id. */
export function getAllReadiness(graph: Graph): Map<string, Readiness> {
  const result = new Map<string, Readiness>();
  for (const id of graph.nodes.keys()) {
    result.set(id, getReadiness(graph, id));
  }
  return result;
}
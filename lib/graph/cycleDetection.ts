import { Graph, GraphEdge } from "./types";

type Color = "white" | "gray" | "black";

/**
 * Returns true if adding `newEdge` to `graph` would create a cycle.
 * Does NOT mutate the passed-in graph.
 */
export function wouldCreateCycle(graph: Graph, newEdge: GraphEdge): boolean {
  const edges = [...graph.edges, newEdge];
  const adjacency = new Map<string, string[]>();

  for (const id of graph.nodes.keys()) adjacency.set(id, []);
  for (const e of edges) {
    if (!adjacency.has(e.taskId)) adjacency.set(e.taskId, []);
    if (!adjacency.has(e.dependsOnTaskId)) adjacency.set(e.dependsOnTaskId, []);
    // edge direction for traversal: taskId -> dependsOnTaskId
    adjacency.get(e.taskId)!.push(e.dependsOnTaskId);
  }

  const color = new Map<string, Color>();
  for (const id of adjacency.keys()) color.set(id, "white");

  function dfs(node: string): boolean {
    color.set(node, "gray");
    for (const neighbor of adjacency.get(node) ?? []) {
      const c = color.get(neighbor);
      if (c === "gray") return true; // back-edge -> cycle
      if (c === "white" && dfs(neighbor)) return true;
    }
    color.set(node, "black");
    return false;
  }

  for (const id of adjacency.keys()) {
    if (color.get(id) === "white") {
      if (dfs(id)) return true;
    }
  }
  return false;
}

export class CycleError extends Error {
  constructor(message = "This dependency would create a circular reference.") {
    super(message);
    this.name = "CycleError";
  }
}

/**
 * Validates a proposed edge against the graph. Throws CycleError if invalid.
 * Never mutates `graph`.
 */
export function validateNewEdge(graph: Graph, newEdge: GraphEdge): void {
  if (newEdge.taskId === newEdge.dependsOnTaskId) {
    throw new CycleError("A task cannot depend on itself.");
  }
  if (wouldCreateCycle(graph, newEdge)) {
    throw new CycleError();
  }
}
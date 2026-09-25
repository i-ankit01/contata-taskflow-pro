import { Graph, GraphNode, GraphEdge } from "./types";

export function buildGraph(nodes: GraphNode[], edges: GraphEdge[]): Graph {
  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) nodeMap.set(n.id, { ...n });
  return { nodes: nodeMap, edges: edges.map((e) => ({ ...e })) };
}

/** Direct prerequisites of a task (edges where taskId === id). */
export function getPrerequisites(graph: Graph, taskId: string): string[] {
  return graph.edges
    .filter((e) => e.taskId === taskId)
    .map((e) => e.dependsOnTaskId);
}

/** Direct dependents of a task (edges where dependsOnTaskId === id). */
export function getDependents(graph: Graph, taskId: string): string[] {
  return graph.edges
    .filter((e) => e.dependsOnTaskId === taskId)
    .map((e) => e.taskId);
}
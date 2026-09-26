import { describe, it, expect } from "vitest";
import { buildGraph } from "../buildGraph";
import { computeCriticalPath } from "../criticalPath";
import { GraphNode, GraphEdge } from "../types";

function node(id: string, duration: number): GraphNode {
  return { id, startDate: null, endDate: null, duration, status: "BACKLOG" };
}

describe("computeCriticalPath", () => {
  it("picks the longer of two parallel paths in a diamond", () => {
    // A -> B -> D and A -> C -> D, C is the longer branch (5 vs 2)
    const nodes = [node("A", 2), node("B", 2), node("C", 5), node("D", 1)];
    const edges: GraphEdge[] = [
      { taskId: "B", dependsOnTaskId: "A" },
      { taskId: "C", dependsOnTaskId: "A" },
      { taskId: "D", dependsOnTaskId: "B" },
      { taskId: "D", dependsOnTaskId: "C" },
    ];
    const graph = buildGraph(nodes, edges);
    expect(computeCriticalPath(graph)).toEqual(["A", "C", "D"]);
  });

  it("returns the full chain for a simple linear graph", () => {
    const nodes = [node("A", 1), node("B", 1), node("C", 1)];
    const edges: GraphEdge[] = [
      { taskId: "B", dependsOnTaskId: "A" },
      { taskId: "C", dependsOnTaskId: "B" },
    ];
    const graph = buildGraph(nodes, edges);
    expect(computeCriticalPath(graph)).toEqual(["A", "B", "C"]);
  });
});
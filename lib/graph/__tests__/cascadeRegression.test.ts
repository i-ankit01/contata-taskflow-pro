import { describe, it, expect } from "vitest";
import { buildGraph } from "../buildGraph";
import { computeCascadingRegressions } from "../rollback";
import { GraphNode, GraphEdge, TaskStatus } from "../types";

function node(id: string, status: TaskStatus = "BACKLOG"): GraphNode {
  return { id, startDate: null, endDate: null, duration: null, status };
}

describe("computeCascadingRegressions", () => {
  it("cascades a downstream DONE task when its only prerequisite regresses", () => {
    const nodes = [node("A", "IN_PROGRESS"), node("B", "DONE")];
    const edges: GraphEdge[] = [{ taskId: "B", dependsOnTaskId: "A" }];
    const graph = buildGraph(nodes, edges);

    expect(computeCascadingRegressions(graph, "A")).toEqual(["B"]);
  });

  it("does not cascade a downstream task that isn't DONE", () => {
    const nodes = [node("A", "IN_PROGRESS"), node("B", "IN_PROGRESS")];
    const edges: GraphEdge[] = [{ taskId: "B", dependsOnTaskId: "A" }];
    const graph = buildGraph(nodes, edges);

    expect(computeCascadingRegressions(graph, "A")).toEqual([]);
  });

  it("cascades transitively through a multi-step chain (A -> B -> C, both DONE)", () => {
    const nodes = [node("A", "IN_PROGRESS"), node("B", "DONE"), node("C", "DONE")];
    const edges: GraphEdge[] = [
      { taskId: "B", dependsOnTaskId: "A" },
      { taskId: "C", dependsOnTaskId: "B" },
    ];
    const graph = buildGraph(nodes, edges);

    expect(computeCascadingRegressions(graph, "A")).toEqual(["B", "C"]);
  });

  it("cascades a convergence point even when only one of its prerequisites regressed", () => {
    const nodes = [
      node("A", "IN_PROGRESS"),
      node("B", "DONE"),
      node("C", "DONE"),
      node("D", "DONE"),
    ];
    const edges: GraphEdge[] = [
      { taskId: "B", dependsOnTaskId: "A" },
      { taskId: "D", dependsOnTaskId: "B" },
      { taskId: "D", dependsOnTaskId: "C" },
    ];
    const graph = buildGraph(nodes, edges);

    expect(computeCascadingRegressions(graph, "A")).toEqual(["B", "D"]);
  });

  it("leaves an unrelated DONE chain untouched", () => {
    const nodes = [
      node("A", "IN_PROGRESS"),
      node("B", "DONE"),
      node("X", "DONE"),
      node("Y", "DONE"),
    ];
    const edges: GraphEdge[] = [
      { taskId: "B", dependsOnTaskId: "A" },
      { taskId: "Y", dependsOnTaskId: "X" },
    ];
    const graph = buildGraph(nodes, edges);

    expect(computeCascadingRegressions(graph, "A")).toEqual(["B"]);
  });
});
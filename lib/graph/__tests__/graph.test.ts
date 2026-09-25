import { describe, it, expect } from "vitest";
import { buildGraph } from "../buildGraph";
import { wouldCreateCycle, validateNewEdge, CycleError } from "../cycleDetection";
import { getReadiness } from "../readiness";
import { propagateSchedule } from "../propagation";
import { GraphNode, GraphEdge } from "../types";

function node(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    startDate: null,
    endDate: null,
    duration: null,
    status: "BACKLOG",
    ...overrides,
  };
}

describe("cycle detection", () => {
  it("rejects an edge that would create a cycle, graph stays unchanged", () => {
    // A -> B -> C (C depends on B, B depends on A)
    const nodes = [node("A"), node("B"), node("C")];
    const edges: GraphEdge[] = [
      { taskId: "B", dependsOnTaskId: "A" },
      { taskId: "C", dependsOnTaskId: "B" },
    ];
    const graph = buildGraph(nodes, edges);
    const edgeCountBefore = graph.edges.length;

    // Proposing A depends on C would close the loop A -> B -> C -> A
    const proposed: GraphEdge = { taskId: "A", dependsOnTaskId: "C" };

    expect(wouldCreateCycle(graph, proposed)).toBe(true);
    expect(() => validateNewEdge(graph, proposed)).toThrow(CycleError);
    expect(graph.edges.length).toBe(edgeCountBefore); // untouched
    expect(graph.edges.some(e => e.taskId === "A" && e.dependsOnTaskId === "C")).toBe(false);

  });

  it("accepts a valid non-cyclic edge", () => {
    const nodes = [node("A"), node("B")];
    const graph = buildGraph(nodes, []);
    const proposed: GraphEdge = { taskId: "B", dependsOnTaskId: "A" };
    expect(wouldCreateCycle(graph, proposed)).toBe(false);
    expect(() => validateNewEdge(graph, proposed)).not.toThrow();

  });
});

describe("readiness", () => {
  it("a task with no prerequisites is always Ready", () => {
    const graph = buildGraph([node("A")], []);
    expect(getReadiness(graph, "A")).toBe("READY");
  });

  it("a task with a non-DONE prerequisite is Blocked", () => {
    const nodes = [node("A", { status: "IN_PROGRESS" }), node("B")];
    const edges: GraphEdge[] = [{ taskId: "B", dependsOnTaskId: "A" }];
    const graph = buildGraph(nodes, edges);
    expect(getReadiness(graph, "B")).toBe("BLOCKED");
  });

  it("flipping prerequisite to DONE unblocks; flipping back re-blocks", () => {
    let nodes = [node("A", { status: "IN_PROGRESS" }), node("B")];
    const edges: GraphEdge[] = [{ taskId: "B", dependsOnTaskId: "A" }];
    let graph = buildGraph(nodes, edges);
    expect(getReadiness(graph, "B")).toBe("BLOCKED");

    nodes = [node("A", { status: "DONE" }), node("B")];
    graph = buildGraph(nodes, edges);
    expect(getReadiness(graph, "B")).toBe("READY");

    nodes = [node("A", { status: "IN_PROGRESS" }), node("B")];
    graph = buildGraph(nodes, edges);
    expect(getReadiness(graph, "B")).toBe("BLOCKED");
  });

  it("requires all prerequisites to be DONE", () => {
  const nodes = [
    node("A", { status: "DONE" }),
    node("B", { status: "DONE" }),
    node("C", { status: "IN_PROGRESS" }),
    node("D"),
  ];

  const edges: GraphEdge[] = [
    { taskId: "D", dependsOnTaskId: "A" },
    { taskId: "D", dependsOnTaskId: "B" },
    { taskId: "D", dependsOnTaskId: "C" },
  ];

  const graph = buildGraph(nodes, edges);

  expect(getReadiness(graph, "D")).toBe("BLOCKED");

  // Now C becomes DONE
  graph.nodes.get("C")!.status = "DONE";

  expect(getReadiness(graph, "D")).toBe("READY");
});

it("recomputes readiness through multiple downstream levels", () => {
  const nodes = [
    node("A", { status: "DONE" }),
    node("B"),
    node("C"),
  ];

  const edges: GraphEdge[] = [
    { taskId: "B", dependsOnTaskId: "A" },
    { taskId: "C", dependsOnTaskId: "B" },
  ];

  const graph = buildGraph(nodes, edges);

  // A DONE -> B READY
  expect(getReadiness(graph, "B")).toBe("READY");

  // B isn't DONE, so C remains BLOCKED
  expect(getReadiness(graph, "C")).toBe("BLOCKED");

  // A regresses
  graph.nodes.get("A")!.status = "IN_PROGRESS";

  expect(getReadiness(graph, "B")).toBe("BLOCKED");
  expect(getReadiness(graph, "C")).toBe("BLOCKED");

  // A becomes DONE again
  graph.nodes.get("A")!.status = "DONE";

  expect(getReadiness(graph, "B")).toBe("READY");
  expect(getReadiness(graph, "C")).toBe("BLOCKED");
});

});

describe("propagation — no compounding (mandatory)", () => {
  it("A -> B -> D and A -> C -> D: delaying A by 3 days shifts D by 3, not 6", () => {
    const base = new Date("2026-01-01T00:00:00.000Z");
    const day = (n: number) => {
      const d = new Date(base);
      d.setDate(d.getDate() + n);
      return d;
    };

    // All start equal, duration 2 days each, before the delay.
    const nodes: GraphNode[] = [
      node("A", { startDate: day(0), endDate: day(2), duration: 2 }),
      node("B", { startDate: day(2), endDate: day(4), duration: 2 }),
      node("C", { startDate: day(2), endDate: day(4), duration: 2 }),
      node("D", { startDate: day(4), endDate: day(6), duration: 2 }),
    ];
    const edges: GraphEdge[] = [
      { taskId: "B", dependsOnTaskId: "A" },
      { taskId: "C", dependsOnTaskId: "A" },
      { taskId: "D", dependsOnTaskId: "B" },
      { taskId: "D", dependsOnTaskId: "C" },
    ];
    const graph = buildGraph(nodes, edges);

    // Delay A's endDate by 3 days (e.g. it ran long).
    const delayedA = { ...graph.nodes.get("A")!, endDate: day(5) }; // was day(2), +3
    graph.nodes.set("A", delayedA);

    const result = propagateSchedule(graph, "A");

    const b = result.nodes.get("B")!;
    const c = result.nodes.get("C")!;
    const d = result.nodes.get("D")!;

    // B and C each shift by exactly 3 days
    expect(b.endDate!.getTime()).toBe(day(4 + 3).getTime());
    expect(c.endDate!.getTime()).toBe(day(4 + 3).getTime());

    // D's start = MAX(B.end, C.end) = day(7), not day(7)+day(7) summed
    expect(d.startDate!.getTime()).toBe(day(4 + 3).getTime());
    // D's end shifts by exactly 3 days (day(6) -> day(9)), not 6 (-> day(12))
    expect(d.endDate!.getTime()).toBe(day(6 + 3).getTime());
    expect(d.endDate!.getTime()).not.toBe(day(6 + 6).getTime());
  });
});
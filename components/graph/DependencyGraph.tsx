"use client";

import { useMemo } from "react";
import ReactFlow, { Background, Controls, MarkerType, Node, Edge } from "reactflow";
import "reactflow/dist/style.css";
import { Task, Dependency } from "@/types";
import { buildGraph } from "@/lib/graph/buildGraph";
import { computeCriticalPath } from "@/lib/graph/criticalPath";
import { getReadiness } from "@/lib/graph/readiness";
import { GraphNode, GraphEdge } from "@/lib/graph/types";
import { computeLayout } from "./layout";

function toGraphNodes(tasks: Task[]): GraphNode[] {
  return tasks.map((t) => ({
    id: t.id,
    startDate: t.startDate ? new Date(t.startDate) : null,
    endDate: t.endDate ? new Date(t.endDate) : null,
    duration: t.duration,
    status: t.status,
  }));
}

function toGraphEdges(dependencies: Dependency[]): GraphEdge[] {
  return dependencies.map((d) => ({ taskId: d.taskId, dependsOnTaskId: d.dependsOnTaskId }));
}

function nodeColors(status: Task["status"], readiness: "READY" | "BLOCKED", isCritical: boolean) {
  if (status === "DONE") return { background: "#dcfce7", border: isCritical ? "#dc2626" : "#16a34a" };
  if (readiness === "READY") return { background: "#dbeafe", border: isCritical ? "#dc2626" : "#2563eb" };
  return { background: "#f3f4f6", border: isCritical ? "#dc2626" : "#9ca3af" };
}

export function DependencyGraph({ tasks, dependencies }: { tasks: Task[]; dependencies: Dependency[] }) {
  const { nodes, edges } = useMemo(() => {
    if (tasks.length === 0) return { nodes: [] as Node[], edges: [] as Edge[] };

    const graph = buildGraph(toGraphNodes(tasks), toGraphEdges(dependencies));
    const positions = computeLayout(graph);
    const posById = new Map(positions.map((p) => [p.id, p]));
    const criticalPath = computeCriticalPath(graph);
    const criticalSet = new Set(criticalPath);

    const criticalEdgeKeys = new Set<string>();
    for (let i = 0; i < criticalPath.length - 1; i++) {
      criticalEdgeKeys.add(`${criticalPath[i]}::${criticalPath[i + 1]}`);
    }

    const rfNodes: Node[] = tasks.map((t) => {
      const pos = posById.get(t.id) ?? { x: 0, y: 0 };
      const readiness = getReadiness(graph, t.id);
      const isCritical = criticalSet.has(t.id);
      const colors = nodeColors(t.status, readiness, isCritical);

      return {
        id: t.id,
        position: { x: pos.x, y: pos.y },
        data: {
          label: (
            <div className="text-xs">
              <div className="font-medium">{t.title}</div>
              <div className="text-[10px] opacity-70">
                {t.status === "DONE" ? "Completed" : readiness === "READY" ? "Ready" : "Blocked"}
              </div>
            </div>
          ),
        },
        style: {
          background: colors.background,
          border: `2px solid ${colors.border}`,
          borderRadius: 8,
          padding: 6,
          width: 180,
        },
      };
    });

    const rfEdges: Edge[] = dependencies.map((d) => {
      const key = `${d.dependsOnTaskId}::${d.taskId}`;
      const isCritical = criticalEdgeKeys.has(key);
      return {
        id: d.id,
        source: d.dependsOnTaskId, // prerequisite ...
        target: d.taskId, // ... flows into the dependent
        type: "smoothstep",
        animated: isCritical,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isCritical ? "#dc2626" : "#334155",
        },
        style: { stroke: isCritical ? "#dc2626" : "#334155", strokeWidth: isCritical ? 4 : 2.5 },
      };
    });

    return { nodes: rfNodes, edges: rfEdges };
  }, [tasks, dependencies]);

  if (tasks.length === 0) {
    return <div className="p-8 text-muted-foreground text-sm">No tasks yet.</div>;
  }

  return (
    <div style={{ width: "100%", height: "calc(100vh - 140px)" }} className="rounded-lg border">
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.2} nodesDraggable={false} nodesConnectable={false}>
        <Background gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
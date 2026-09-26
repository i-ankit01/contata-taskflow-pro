import { Graph } from "@/lib/graph/types";
import { getPrerequisites } from "@/lib/graph/buildGraph";
import { topologicalSort } from "@/lib/graph/topologicalSort";

export type PositionedNode = { id: string; x: number; y: number; level: number };

const LEVEL_SPACING_X = 260;
const NODE_SPACING_Y = 110;

/** Simple layered layout: level = longest chain from any root to this node. */
export function computeLayout(graph: Graph): PositionedNode[] {
  const order = topologicalSort(graph);
  const level = new Map<string, number>();

  for (const id of order) {
    const prereqs = getPrerequisites(graph, id);
    level.set(
      id,
      prereqs.length === 0 ? 0 : Math.max(...prereqs.map((p) => level.get(p) ?? 0)) + 1
    );
  }

  const countPerLevel = new Map<number, number>();
  return order.map((id) => {
    const lvl = level.get(id) ?? 0;
    const indexInLevel = countPerLevel.get(lvl) ?? 0;
    countPerLevel.set(lvl, indexInLevel + 1);
    return { id, level: lvl, x: lvl * LEVEL_SPACING_X, y: indexInLevel * NODE_SPACING_Y };
  });
}
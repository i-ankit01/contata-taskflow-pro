type NodeState = "done" | "ready" | "blocked";

type GraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  state: NodeState;
};

const NODES: GraphNode[] = [
  { id: "rg", label: "RG", x: 30, y: 138, state: "done" },
  { id: "db", label: "DB", x: 105, y: 48, state: "done" },
  { id: "api", label: "API", x: 175, y: 48, state: "ready" },
  { id: "fe", label: "FE", x: 175, y: 138, state: "ready" },
  { id: "int", label: "INT", x: 245, y: 98, state: "blocked" },
  { id: "sec", label: "SEC", x: 315, y: 48, state: "blocked" },
  { id: "prd", label: "PRD", x: 315, y: 148, state: "blocked" },
  { id: "dep", label: "DEP", x: 375, y: 98, state: "blocked" },
];

const EDGES: [string, string][] = [
  ["rg", "db"],
  ["db", "api"],
  ["db", "fe"],
  ["api", "int"],
  ["fe", "int"],
  ["int", "sec"],
  ["int", "prd"],
  ["sec", "dep"],
  ["prd", "dep"],
];

const NODE_W = 30;
const NODE_H = 24;

function nodeCenter(n: GraphNode) {
  return { cx: n.x + NODE_W / 2, cy: n.y + NODE_H / 2 };
}

function nodeClasses(state: NodeState) {
  switch (state) {
    case "done":
      return { rect: "fill-ink stroke-ink", text: "fill-paper" };
    case "ready":
      return { rect: "fill-transparent stroke-ink stroke-[1.6]", text: "fill-dim" };
    case "blocked":
    default:
      return {
        rect: "fill-transparent stroke-line-strong stroke-[1.2] [stroke-dasharray:3_3]",
        text: "fill-dim",
      };
  }
}

export function DependencyGraph() {
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

  return (
    <svg viewBox="0 0 410 190" className="block h-auto w-full">
      <g className="stroke-line-strong stroke-[1.1]">
        {EDGES.map(([from, to]) => {
          const a = nodeCenter(byId[from]);
          const b = nodeCenter(byId[to]);
          return (
            <path
              key={`${from}-${to}`}
              className="draw-in"
              d={`M${a.cx},${a.cy} L${b.cx},${b.cy}`}
              fill="none"
            />
          );
        })}
      </g>
      <g>
        {NODES.map((n) => {
          const c = nodeClasses(n.state);
          const { cx, cy } = nodeCenter(n);
          return (
            <g key={n.id}>
              <rect
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={NODE_H}
                rx={3}
                className={c.rect}
              />
              <text
                x={cx}
                y={cy + 3}
                textAnchor="middle"
                className={`font-mono text-[8.5px] ${c.text}`}
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
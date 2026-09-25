export type TaskStatus = "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE";

export type GraphNode = {
  id: string;
  startDate: Date | null;
  endDate: Date | null;
  duration: number | null;
  status: TaskStatus;
};

export type GraphEdge = {
  taskId: string;          // depends on dependsOnTaskId
  dependsOnTaskId: string;
};

export type Graph = {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
};
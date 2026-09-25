export type TaskStatus = "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type Readiness = "READY" | "BLOCKED";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  startDate: string | null;
  endDate: string | null;
  duration: number | null;
  createdAt: string;
  updatedAt: string;
  readiness: Readiness;
};

export type Dependency = {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  createdAt: string;
};

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
"use client";

import { useCallback } from "react";
import { Dependency, ApiResponse } from "@/types";

export class CycleRejectedError extends Error {}

export function useDependencies(projectId: string, onChanged: () => Promise<void>) {
  const createDependency = useCallback(
    async (taskId: string, dependsOnTaskId: string) => {
      const res = await fetch(`/api/projects/${projectId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, dependsOnTaskId }),
      });
      const json: ApiResponse<Dependency> = await res.json();
      if (!json.success) {
        if (res.status === 409) throw new CycleRejectedError(json.error);
        throw new Error(json.error);
      }
      await onChanged();
      return json.data;
    },
    [projectId, onChanged]
  );

  const deleteDependency = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/projects/${projectId}/dependencies/${id}`, { method: "DELETE" });
      const json: ApiResponse<{ id: string }> = await res.json();
      if (!json.success) throw new Error(json.error);
      await onChanged();
    },
    [projectId, onChanged]
  );

  return { createDependency, deleteDependency };
}
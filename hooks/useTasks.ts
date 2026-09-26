"use client";

import { useCallback, useEffect, useState } from "react";
import { Task, TaskStatus, ApiResponse } from "@/types";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
      const json: ApiResponse<Task[]> = await res.json();
      if (!json.success) throw new Error(json.error);
      setTasks(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const updateTaskStatus = useCallback(
    async (id: string, status: TaskStatus) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));

      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json: ApiResponse<Task> = await res.json();
      if (!json.success) {
        await fetchTasks();
        throw new Error(json.error);
      }
      await fetchTasks();
    },
    [fetchTasks]
  );

  const createTask = useCallback(
    async (input: {
      title: string;
      description?: string;
      startDate?: string;
      duration?: number;
    }) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json: ApiResponse<Task> = await res.json();
      if (!json.success) throw new Error(json.error);
      await fetchTasks();
      return json.data;
    },
    [fetchTasks]
  );

  // Duration-only edit. startDate is intentionally never sent from here —
  // the task's own start stays fixed; only its duration (and therefore its
  // own + every downstream task's endDate) changes.
  const updateTaskDuration = useCallback(
    async (id: string, duration: number) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration }),
      });
      const json: ApiResponse<Task> = await res.json();
      if (!json.success) throw new Error(json.error);
      await fetchTasks(); // pulls in propagated downstream dates too
      return json.data;
    },
    [fetchTasks]
  );

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    updateTaskStatus,
    createTask,
    updateTaskDuration,
  };
}
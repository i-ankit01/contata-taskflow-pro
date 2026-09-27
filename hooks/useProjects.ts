"use client";

import { useCallback, useEffect, useState } from "react";
import { Project, ApiResponse } from "@/types";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const json: ApiResponse<Project[]> = await res.json();
      if (!json.success) throw new Error(json.error);
      setProjects(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(
    async (name: string) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json: ApiResponse<Project> = await res.json();
      if (!json.success) throw new Error(json.error);
      await fetchProjects();
      return json.data;
    },
    [fetchProjects]
  );

  return { projects, loading, error, fetchProjects, createProject };
}
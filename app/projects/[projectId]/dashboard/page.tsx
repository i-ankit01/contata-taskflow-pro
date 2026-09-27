"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DependencyGraph } from "@/components/graph/DependencyGraph";
import { Task, Dependency, ApiResponse } from "@/types";
import { Button } from "@/components/ui/button";

export default function DashboardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [tasksRes, depsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/tasks`, { cache: "no-store" }),
        fetch(`/api/projects/${projectId}/dependencies`, { cache: "no-store" }),
      ]);
      const tasksJson: ApiResponse<Task[]> = await tasksRes.json();
      const depsJson: ApiResponse<Dependency[]> = await depsRes.json();
      if (tasksJson.success) setTasks(tasksJson.data);
      if (depsJson.success) setDependencies(depsJson.data);
      setLoading(false);
    }
    load();
  }, [projectId]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft size={14} className="mr-1" /> Back to Board
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Dependency Graph</h1>
        </div>
        {/* legend unchanged */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-100 border-2 border-green-600" /> Completed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-100 border-2 border-blue-600" /> Ready
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-gray-100 border-2 border-gray-400" /> Blocked
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm border-2 border-red-600" /> Critical path
          </span>
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground p-8">Loading graph…</div>
      ) : (
        <DependencyGraph tasks={tasks} dependencies={dependencies} />
      )}
    </div>
  );
}
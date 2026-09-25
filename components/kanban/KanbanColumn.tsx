"use client";

import { useDroppable } from "@dnd-kit/core";
import { Task, TaskStatus } from "@/types";
import { TaskCard } from "./TaskCard";

export function KanbanColumn({
  status,
  title,
  tasks,
  getPrereqTitles,
}: {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  getPrereqTitles: (taskId: string) => string[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] rounded-lg border bg-muted/30 p-3 transition-colors ${
        isOver ? "bg-muted/60 border-primary" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} prerequisiteTitles={getPrereqTitles(task.id)} />
      ))}
    </div>
  );
}
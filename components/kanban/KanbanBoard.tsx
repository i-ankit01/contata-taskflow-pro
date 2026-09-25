"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { useTasks } from "@/hooks/useTasks";
import { Dependency, TaskStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { AddDependencyDialog } from "@/components/dependencies/AddDependencyDialog";

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "BACKLOG", title: "Backlog" },
  { status: "IN_PROGRESS", title: "In Progress" },
  { status: "REVIEW", title: "Review" },
  { status: "DONE", title: "Done" },
];

export function KanbanBoard() {
  const { tasks, loading, error, fetchTasks, updateTaskStatus, createTask } =
    useTasks();
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [depDialogOpen, setDepDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const fetchAll = async () => {
    await fetchTasks();
    const res = await fetch("/api/dependencies", { cache: "no-store" });
    const json = await res.json();
    if (json.success) setDependencies(json.data);
  };

  useEffect(() => {
    fetchAll();
  }, []); // ← moved up here, before any early return

  const getPrereqTitles = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t.title]));
    return (taskId: string) =>
      dependencies
        .filter((d) => d.taskId === taskId)
        .map((d) => byId.get(d.dependsOnTaskId))
        .filter((x): x is string => Boolean(x));
  }, [tasks, dependencies]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    try {
      await updateTaskStatus(taskId, newStatus);
      toast.success(`"${task.title}" moved to ${newStatus.replace("_", " ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to move task");
    }
  }

  const activeTask = tasks.find((t) => t.id === activeId);

  // early returns now come AFTER every hook has been called
  if (loading)
    return <div className="p-8 text-muted-foreground">Loading board…</div>;
  if (error) return <div className="p-8 text-destructive">Error: {error}</div>;
  
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">TaskFlow Pro</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDepDialogOpen(true)}>
            Add Dependency
          </Button>
          <Button onClick={() => setTaskDialogOpen(true)}>Add Task</Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              title={col.title}
              tasks={tasks.filter((t) => t.status === col.status)}
              getPrereqTitles={getPrereqTitles}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              prerequisiteTitles={getPrereqTitles(activeTask.id)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <AddTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        onCreate={async (input) => {
          await createTask(input);
          toast.success("Task created");
        }}
      />
      <AddDependencyDialog
        open={depDialogOpen}
        onOpenChange={setDepDialogOpen}
        tasks={tasks}
        onCreated={async () => {
          await fetchAll();
        }}
      />
    </div>
  );
}

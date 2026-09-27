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
import { ArrowLeft, Loader2 } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { useTasks } from "@/hooks/useTasks";
import { Dependency, Task, TaskStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { AddDependencyDialog } from "@/components/dependencies/AddDependencyDialog";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { AISuggestionsPanel } from "@/components/ai/AISuggestionsPanel";
import Link from "next/link";

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "BACKLOG", title: "Backlog" },
  { status: "IN_PROGRESS", title: "In Progress" },
  { status: "REVIEW", title: "Review" },
  { status: "DONE", title: "Done" },
];

export function KanbanBoard({ projectId }: { projectId: string }) {
  const { tasks, loading, refreshing, error, fetchTasks, updateTaskStatus, createTask, updateTaskDuration } =
    useTasks(projectId);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [depDialogOpen, setDepDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const fetchAll = async () => {
    await fetchTasks();
    const res = await fetch(`/api/projects/${projectId}/dependencies`, { cache: "no-store" });
    const json = await res.json();
    if (json.success) setDependencies(json.data);
  };

  useEffect(() => {
    fetchAll();
  }, []);

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

    // A task can only reach Done once it's actually Ready — its prerequisites
    // must be Done, per the derived readiness computed server-side.
    if (newStatus === "DONE" && task.readiness === "BLOCKED") {
      toast.error(
        `"${task.title}" is blocked — move it through Review or In Progress first, not directly to Done.`,
      );
      return;
    }

    try {
      await updateTaskStatus(taskId, newStatus);
      toast.success(`"${task.title}" moved to ${newStatus.replace("_", " ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to move task");
    }
  }

  const activeTask = tasks.find((t) => t.id === activeId);

  // Only the very first load shows the full-page state — every subsequent
  // refetch (drag, status change, duration edit) uses the slim top bar below
  // instead, so the board never unmounts/blinks.
  if (loading)
    return <div className="p-8 text-muted-foreground">Loading board…</div>;
  if (error) return <div className="p-8 text-destructive">Error: {error}</div>;

  return (
    <div className="p-6">
      {/* Slim updating indicator — fixed height, doesn't shift layout, doesn't unmount the board */}
      <div
        className={`fixed top-0 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-150 ${
          refreshing ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="mt-2 flex items-center gap-2 rounded-full bg-foreground text-background text-xs px-3 py-1.5 shadow-md">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating…
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1" /> Back to Projects
            </Button>
          </Link>
          <h1 className="text-xl font-bold">TaskFlow Pro</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDepDialogOpen(true)}>
            Add Dependency
          </Button>
          <Button onClick={() => setTaskDialogOpen(true)}>Add Task</Button>
          <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
            AI Suggestions
          </Button>
          <Link href={`/projects/${projectId}/dashboard`}>
            <Button variant="outline">View Dependency Graph</Button>
          </Link>
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
              onEditTask={setEditingTask}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              prerequisiteTitles={getPrereqTitles(activeTask.id)}
              onEdit={() => {}}
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
        projectId={projectId}
        open={depDialogOpen}
        onOpenChange={setDepDialogOpen}
        tasks={tasks}
        onCreated={async () => {
          await fetchAll();
        }}
      />
      <EditTaskDialog
        task={editingTask}
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSave={async (id, duration) => {
          await updateTaskDuration(id, duration);
          await fetchAll();
          toast.success("Duration updated — propagation applied downstream");
        }}
      />
      <AISuggestionsPanel
      projectId={projectId}
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        tasks={tasks}
        onAccepted={fetchAll}
      />
    </div>
  );
}

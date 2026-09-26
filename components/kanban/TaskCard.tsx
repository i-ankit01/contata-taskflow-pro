"use client";

import { useDraggable } from "@dnd-kit/core";
import { Pencil } from "lucide-react";
import { Task } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getStatusBadge(task: Task): { label: string; variant: "default" | "secondary" } {
  if (task.status === "DONE") return { label: "Completed", variant: "default" };
  if (task.readiness === "READY") return { label: "Ready", variant: "default" };
  return { label: "Blocked", variant: "secondary" };
}

export function TaskCard({
  task,
  prerequisiteTitles,
  onEdit,
}: {
  task: Task;
  prerequisiteTitles: string[];
  onEdit: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const badge = getStatusBadge(task);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing mb-3 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <span className="font-medium text-sm">{task.title}</span>
        <div className="flex items-center gap-1">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <button
            type="button"
            aria-label="Edit dates"
            className="text-muted-foreground hover:text-foreground p-1"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
          >
            <Pencil size={14} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
        <div>
          {formatDate(task.startDate)} → {formatDate(task.endDate)}
        </div>
        {prerequisiteTitles.length > 0 && (
          <div>
            <span className="font-medium">Depends on: </span>
            {prerequisiteTitles.join(", ")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
"use client";

import { useDraggable } from "@dnd-kit/core";
import { Task } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskCard({
  task,
  prerequisiteTitles,
}: {
  task: Task;
  prerequisiteTitles: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

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
        <Badge variant={task.readiness === "READY" ? "default" : "secondary"}>
          {task.readiness === "READY" ? "Ready" : "Blocked"}
        </Badge>
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
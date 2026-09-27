"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Task } from "@/types";
import { useDependencies, CycleRejectedError } from "@/hooks/useDependencies";

export function AddDependencyDialog({
  projectId,
  open,
  onOpenChange,
  tasks,
  onCreated,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onCreated: () => Promise<void>;
}) {
  const { createDependency } = useDependencies(projectId, onCreated);
  const [taskId, setTaskId] = useState<string>("");
  const [dependsOnTaskId, setDependsOnTaskId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const taskTitle = (id: string) => tasks.find((task) => task.id === id)?.title ?? "";

  async function handleSubmit() {
    if (!taskId || !dependsOnTaskId || taskId === dependsOnTaskId) return;
    setSubmitting(true);
    try {
      await createDependency(taskId, dependsOnTaskId);
      toast.success("Dependency added");
      setTaskId("");
      setDependsOnTaskId("");
      onOpenChange(false);
    } catch (e) {
      if (e instanceof CycleRejectedError) {
        toast.error("This would create a circular dependency and was not added.");
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to add dependency");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Dependency</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Task</Label>
            <Select value={taskId} onValueChange={(value) => setTaskId(value ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select task">{taskTitle(taskId)}</SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[320px] max-w-[calc(100vw-2rem)] p-1.5">
                {tasks.map((t) => (
                  <SelectItem className="px-2.5 py-2" key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Depends on</Label>
            <Select value={dependsOnTaskId} onValueChange={(value) => setDependsOnTaskId(value ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select prerequisite">{taskTitle(dependsOnTaskId)}</SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[320px] max-w-[calc(100vw-2rem)] p-1.5">
                {tasks
                  .filter((t) => t.id !== taskId)
                  .map((t) => (
                    <SelectItem className="px-2.5 py-2" key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !taskId || !dependsOnTaskId || taskId === dependsOnTaskId}
          >
            {submitting ? "Adding…" : "Add Dependency"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
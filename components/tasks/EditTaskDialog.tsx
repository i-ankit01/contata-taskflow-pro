"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Task } from "@/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function addDaysToIso(iso: string | null, days: number): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function EditTaskDialog({
  task,
  open,
  onOpenChange,
  onSave,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, duration: number) => Promise<void>;
}) {
  const [duration, setDuration] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setDuration(task.duration != null ? String(task.duration) : "");
    }
  }, [task]);

  if (!task) return null;

  const durationNum = duration ? Number(duration) : null;
  const previewEndDate =
    durationNum && durationNum > 0 ? addDaysToIso(task.startDate, durationNum) : null;

  async function handleSubmit() {
    if (!durationNum || durationNum <= 0) return;
    setSubmitting(true);
    try {
      await onSave(task!.id, durationNum);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit duration — {task.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Start date: <span className="font-medium">{formatDate(task.startDate)}</span>{" "}
            (fixed — only duration is editable)
          </div>
          <div>
            <Label htmlFor="edit-duration">Duration (days)</Label>
            <Input
              id="edit-duration"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            New end date:{" "}
            <span className="font-medium">
              {previewEndDate ? formatDate(previewEndDate) : "—"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            This recomputes the task's own end date and propagates it to every
            downstream task, in topological order — each downstream task's new
            start is the latest end date among ITS direct prerequisites, so
            shared descendants shift by this delay exactly once, never
            compounded across converging paths.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting || !durationNum || durationNum <= 0}>
            {submitting ? "Saving…" : "Save & Propagate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Task, AISuggestion, ApiResponse } from "@/types";
import { useDependencies, CycleRejectedError } from "@/hooks/useDependencies";

export function AISuggestionsPanel({
  projectId,
  open,
  onOpenChange,
  tasks,
  onAccepted,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onAccepted: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [acceptingKey, setAcceptingKey] = useState<string | null>(null);
  const { createDependency } = useDependencies(projectId, onAccepted);

  const titleOf = (id: string) => tasks.find((t) => t.id === id)?.title ?? id;
  const keyOf = (s: AISuggestion) => `${s.taskId}::${s.dependsOnTaskId}`;

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/ai/suggestions`, { method: "POST" });
      const json: ApiResponse<{ suggestions: AISuggestion[] }> = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuggestions(json.data.suggestions);
      setHasRun(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate suggestions");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(s: AISuggestion) {
    const key = keyOf(s);
    setAcceptingKey(key);
    try {
      // Same endpoint, same cycle validation as any manual dependency —
      // no AI-only write path exists anywhere in this flow.
      await createDependency(s.taskId, s.dependsOnTaskId);
      setSuggestions((prev) => prev.filter((x) => keyOf(x) !== key));
      toast.success("Dependency added");
    } catch (e) {
      if (e instanceof CycleRejectedError) {
        toast.error("This would create a circular dependency and was not added.");
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to add dependency");
      }
    } finally {
      setAcceptingKey(null);
    }
  }

  function handleReject(s: AISuggestion) {
    // No network call — purely client-side removal from local state.
    setSuggestions((prev) => prev.filter((x) => keyOf(x) !== keyOf(s)));
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setSuggestions([]);
      setHasRun(false);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} /> AI Dependency Suggestions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!hasRun && !loading && (
            <div className="text-sm text-muted-foreground">
              Analyze current tasks and existing dependencies to suggest missing
              links. Nothing is written until you explicitly accept a suggestion.
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing task graph…
            </div>
          )}

          {!loading && hasRun && suggestions.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Graph is complete. No additional dependency suggestions required.
            </div>
          )}

          {!loading &&
            suggestions.map((s) => {
              const key = keyOf(s);
              return (
                <Card key={key}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {titleOf(s.taskId)}{" "}
                        <span className="text-muted-foreground font-normal">depends on</span>{" "}
                        {titleOf(s.dependsOnTaskId)}
                      </div>
                      <Badge variant="secondary">
                        {Math.round(s.confidence * 100)}% confident
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.reason}</p>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => handleAccept(s)}
                        disabled={acceptingKey === key}
                      >
                        <Check size={14} className="mr-1" />
                        {acceptingKey === key ? "Adding…" : "Accept"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(s)}
                        disabled={acceptingKey === key}
                      >
                        <X size={14} className="mr-1" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? "Generating…" : hasRun ? "Regenerate Suggestions" : "Suggest Dependencies"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
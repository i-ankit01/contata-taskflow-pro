"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { LoadingState } from "@/components/ui/loading-state";

export function ProjectsList() {
  const { projects, loading, error, createProject } = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (loading) return <LoadingState label="projects" />;
  if (error) return <div className="p-8 text-destructive">Error: {error}</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">TaskFlow Pro - Projects</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus size={16} className="mr-1" /> New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-16 border rounded-lg">
          No projects yet. Create one to get started.
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {p._count?.tasks ?? 0} task{p._count?.tasks === 1 ? "" : "s"}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={async (name) => {
          await createProject(name);
          toast.success("Project created");
        }}
      />
    </div>
  );
}
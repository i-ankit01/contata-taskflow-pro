import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export default async function ProjectBoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <KanbanBoard projectId={projectId} />;
}
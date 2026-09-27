import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { deleteDependency } from "@/lib/services/dependencyService";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; id: string }> }
) {
  try {
    const { projectId, id } = await params;
    await deleteDependency(projectId, id);
    return ok({ id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete dependency";
    return fail(message, message === "Dependency not found" ? 404 : 500);
  }
}
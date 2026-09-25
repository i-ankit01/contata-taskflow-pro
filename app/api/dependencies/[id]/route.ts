import { ok, fail } from "@/lib/api-response";
import { deleteDependency } from "@/lib/services/dependencyService";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteDependency(id);
    return ok({ id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete dependency";
    return fail(message, message === "Dependency not found" ? 404 : 500);
  }
}
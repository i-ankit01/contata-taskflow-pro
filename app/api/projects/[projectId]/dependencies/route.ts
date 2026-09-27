import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { createDependencySchema } from "@/lib/validations/dependency.schema";
import {
  createDependency,
  listDependencies,
  CycleError,
  CrossProjectError,
} from "@/lib/services/dependencyService";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    return ok(await listDependencies(projectId));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to list dependencies", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const body = await req.json();
  const parsed = createDependencySchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join(", "), 400);
  }
  try {
    const { projectId } = await params;
    const dependency = await createDependency(projectId, parsed.data);
    return ok(dependency, 201);
  } catch (e) {
    if (e instanceof CycleError) return fail(e.message, 409);
    if (e instanceof CrossProjectError) return fail(e.message, 400);
    return fail(e instanceof Error ? e.message : "Failed to create dependency", 500);
  }
}
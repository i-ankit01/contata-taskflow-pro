import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { createProjectSchema } from "@/lib/validations/project.schema";
import { listProjects, createProject } from "@/lib/services/projectService";

export async function GET() {
  try {
    return ok(await listProjects());
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to list projects", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join(", "), 400);
  }
  try {
    const project = await createProject(parsed.data);
    return ok(project, 201);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to create project", 500);
  }
}
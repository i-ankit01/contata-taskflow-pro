import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { createDependencySchema } from "@/lib/validations/dependency.schema";
import { createDependency, CycleError } from "@/lib/services/dependencyService";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createDependencySchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  try {
    const dependency = await createDependency(parsed.data);
    return ok(dependency, 201);
  } catch (e) {
    if (e instanceof CycleError) {
      return fail(e.message, 409);
    }
    return fail(e instanceof Error ? e.message : "Failed to create dependency", 500);
  }
}

export async function GET() {
  try {
    const dependencies = await db.dependency.findMany({ orderBy: { createdAt: "asc" } });
    return ok(dependencies);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to list dependencies", 500);
  }
}
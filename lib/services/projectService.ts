import { db } from "@/lib/db";
import { CreateProjectInput } from "@/lib/validations/project.schema";

export async function listProjects() {
  return db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tasks: true } } },
  });
}

export async function createProject(input: CreateProjectInput) {
  return db.project.create({ data: { name: input.name } });
}

export async function getProject(projectId: string) {
  return db.project.findUnique({ where: { id: projectId } });
}
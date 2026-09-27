import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createDependency, CycleError } from "@/lib/services/dependencyService";

describe("dependencyService — cycle rejection has zero DB side effects", () => {
  let projectId: string;
  let a: string, b: string, c: string;

  beforeAll(async () => {
    const project = await db.project.create({ data: { name: "Test Project — Cycle" } });
    projectId = project.id;

    const taskA = await db.task.create({ data: { projectId, title: "Test A" } });
    const taskB = await db.task.create({ data: { projectId, title: "Test B" } });
    const taskC = await db.task.create({ data: { projectId, title: "Test C" } });
    a = taskA.id;
    b = taskB.id;
    c = taskC.id;

    // A -> B -> C  (B depends on A, C depends on B)
    await db.dependency.create({ data: { taskId: b, dependsOnTaskId: a } });
    await db.dependency.create({ data: { taskId: c, dependsOnTaskId: b } });
  });

  afterAll(async () => {
    await db.dependency.deleteMany({ where: { OR: [{ taskId: { in: [a, b, c] } }] } });
    await db.task.deleteMany({ where: { id: { in: [a, b, c] } } });
    await db.project.delete({ where: { id: projectId } });
  });

  it("rejects a cyclic dependency and writes nothing to the DB", async () => {
    const countBefore = await db.dependency.count({
      where: { task: { projectId } },
    });

    await expect(
      createDependency(projectId, { taskId: a, dependsOnTaskId: c }) // would close A->B->C->A
    ).rejects.toThrow(CycleError);

    const countAfter = await db.dependency.count({
      where: { task: { projectId } },
    });
    expect(countAfter).toBe(countBefore);
  });

  it("rejects a dependency between tasks from different projects", async () => {
    const otherProject = await db.project.create({ data: { name: "Test Project — Other" } });
    const outsider = await db.task.create({
      data: { projectId: otherProject.id, title: "Outsider" },
    });

    await expect(
      createDependency(projectId, { taskId: a, dependsOnTaskId: outsider.id })
    ).rejects.toThrow();

    await db.task.delete({ where: { id: outsider.id } });
    await db.project.delete({ where: { id: otherProject.id } });
  });
});
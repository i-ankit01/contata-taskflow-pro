import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createDependency, CycleError } from "@/lib/services/dependencyService";

describe("dependencyService — cycle rejection has zero DB side effects", () => {
  let a: string, b: string, c: string;

  beforeAll(async () => {
    const taskA = await db.task.create({ data: { title: "Test A" } });
    const taskB = await db.task.create({ data: { title: "Test B" } });
    const taskC = await db.task.create({ data: { title: "Test C" } });
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
  });

  it("rejects a cyclic dependency and writes nothing to the DB", async () => {
    const countBefore = await db.dependency.count();

    await expect(
      createDependency({ taskId: a, dependsOnTaskId: c }) // would close A->B->C->A
    ).rejects.toThrow(CycleError);

    const countAfter = await db.dependency.count();
    expect(countAfter).toBe(countBefore);
  });
});
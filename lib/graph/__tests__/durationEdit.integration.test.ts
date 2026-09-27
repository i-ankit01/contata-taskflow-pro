import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { updateTask } from "@/lib/services/taskService";

describe("updateTask — duration edit propagates and persists without compounding", () => {
  let projectId: string;
  let a: string, b: string, c: string, d: string;
  const base = new Date("2026-02-01T00:00:00.000Z");
  const day = (n: number) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + n);
    return dt;
  };

  beforeAll(async () => {
    const project = await db.project.create({ data: { name: "Test Project — Propagation" } });
    projectId = project.id;

    const taskA = await db.task.create({
      data: { projectId, title: "Int A", startDate: day(0), endDate: day(2), duration: 2 },
    });
    const taskB = await db.task.create({
      data: { projectId, title: "Int B", startDate: day(2), endDate: day(4), duration: 2 },
    });
    const taskC = await db.task.create({
      data: { projectId, title: "Int C", startDate: day(2), endDate: day(4), duration: 2 },
    });
    const taskD = await db.task.create({
      data: { projectId, title: "Int D", startDate: day(4), endDate: day(6), duration: 2 },
    });
    a = taskA.id;
    b = taskB.id;
    c = taskC.id;
    d = taskD.id;

    // Diamond: A -> B -> D, A -> C -> D
    await db.dependency.create({ data: { taskId: b, dependsOnTaskId: a } });
    await db.dependency.create({ data: { taskId: c, dependsOnTaskId: a } });
    await db.dependency.create({ data: { taskId: d, dependsOnTaskId: b } });
    await db.dependency.create({ data: { taskId: d, dependsOnTaskId: c } });
  });

  afterAll(async () => {
    await db.dependency.deleteMany({ where: { taskId: { in: [a, b, c, d] } } });
    await db.task.deleteMany({ where: { id: { in: [a, b, c, d] } } });
    await db.project.delete({ where: { id: projectId } });
  });

  it("increasing A's duration by 3 days shifts B, C, D by exactly 3 — not summed — and persists", async () => {
    await updateTask(projectId, a, { duration: 5 }); // was 2, +3 days

    const [freshA, freshB, freshC, freshD] = await Promise.all([
      db.task.findUnique({ where: { id: a } }),
      db.task.findUnique({ where: { id: b } }),
      db.task.findUnique({ where: { id: c } }),
      db.task.findUnique({ where: { id: d } }),
    ]);

    expect(freshA!.endDate!.getTime()).toBe(day(5).getTime()); // 0 + 5
    expect(freshB!.startDate!.getTime()).toBe(day(5).getTime());
    expect(freshB!.endDate!.getTime()).toBe(day(7).getTime());
    expect(freshC!.startDate!.getTime()).toBe(day(5).getTime());
    expect(freshC!.endDate!.getTime()).toBe(day(7).getTime());

    // D's start = MAX(B.end, C.end) — both equal — not their sum
    expect(freshD!.startDate!.getTime()).toBe(day(7).getTime());
    expect(freshD!.endDate!.getTime()).toBe(day(9).getTime()); // was day(6), shifted +3
    expect(freshD!.endDate!.getTime()).not.toBe(day(12).getTime()); // would be +6 if compounded
  });

  it("rejects updateTask on a task that belongs to a different project", async () => {
    const otherProject = await db.project.create({ data: { name: "Test Project — Isolation" } });
    const outsider = await db.task.create({
      data: { projectId: otherProject.id, title: "Outsider Task", duration: 1 },
    });

    await expect(updateTask(projectId, outsider.id, { duration: 9 })).rejects.toThrow(
      "Task not found"
    );

    await db.task.delete({ where: { id: outsider.id } });
    await db.project.delete({ where: { id: otherProject.id } });
  });
});
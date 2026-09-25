import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TaskStatus } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  await prisma.dependency.deleteMany();
  await prisma.task.deleteMany();

  const today = new Date();
  const days = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  };

  const taskDefs = [
    { key: "requirements", title: "Requirements Gathering", start: 0, duration: 2 },
    { key: "schema", title: "Database Schema", start: 2, duration: 3 },
    { key: "backend", title: "Backend API", start: 5, duration: 5 },
    { key: "auth", title: "Authentication", start: 10, duration: 3 },
    { key: "frontend", title: "Frontend Development", start: 5, duration: 6 },
    { key: "integration", title: "API Integration", start: 11, duration: 3 },
    { key: "testing", title: "Integration Testing", start: 14, duration: 3 },
    { key: "security", title: "Security Review", start: 17, duration: 2 },
    { key: "prodsetup", title: "Production Setup", start: 17, duration: 2 },
    { key: "deploy", title: "Deployment", start: 19, duration: 1 },
  ];

  const idMap: Record<string, string> = {};

  for (const t of taskDefs) {
    const startDate = days(t.start);
    const endDate = days(t.start + t.duration);
    const task = await prisma.task.create({
      data: {
        title: t.title,
        status: TaskStatus.BACKLOG,
        startDate,
        endDate,
        duration: t.duration,
      },
    });
    idMap[t.key] = task.id;
  }

  const deps: [string, string][] = [
    ["schema", "requirements"],
    ["backend", "schema"],
    ["auth", "backend"],
    ["frontend", "schema"],
    ["integration", "backend"],
    ["integration", "frontend"],
    ["testing", "auth"],
    ["testing", "integration"],
    ["security", "testing"],
    ["prodsetup", "testing"],
    ["deploy", "security"],
    ["deploy", "prodsetup"],
  ];

  for (const [taskKey, dependsOnKey] of deps) {
    await prisma.dependency.create({
      data: {
        taskId: idMap[taskKey],
        dependsOnTaskId: idMap[dependsOnKey],
      },
    });
  }

  console.log("Seeded 10 tasks and 12 dependencies.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
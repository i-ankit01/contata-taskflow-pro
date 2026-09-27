import OpenAI from "openai";
import { db } from "@/lib/db";
import { buildGraph } from "@/lib/graph/buildGraph";
import { wouldCreateCycle } from "@/lib/graph/cycleDetection";
import { aiSuggestionResponseSchema, AISuggestion } from "@/lib/validations/ai.schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a project-planning assistant for a dependency-aware Kanban tool.

You will receive:
- tasks with id, title, and description
- existing dependency edges
A dependency means: "taskId depends on dependsOnTaskId".

Your job is to suggest ONLY genuinely missing DIRECT dependencies.

Rules:
- Use only exact task IDs from the provided tasks.
- Never suggest an existing dependency.
- Never suggest a task depending on itself.
- Never suggest an edge that creates a cycle.
- Do not suggest indirect, transitive, or redundant dependencies.
- A dependency that is already implied through a chain of existing dependencies
  is NOT a missing dependency.
- Do not suggest a dependency merely because one task ultimately depends on
  another through multiple intermediate tasks.
- Only suggest a direct dependency when the task descriptions provide a clear
  reason that the two tasks must have a direct dependency relationship.
- If no genuinely missing direct dependency exists, return an empty array.
- Never force a suggestion.
- confidence must be between 0 and 1.
- reason must be short and grounded in the task titles/descriptions.

Examples:

Example 1:
Existing:
A → B
B → C

Do NOT suggest:
A → C

Reason: C already depends on A indirectly through B.

Example 2:
Existing:
A → B
B → C
C → D

Do NOT suggest:
A → D
B → D
A → C

These are already implied by the existing dependency chain.

Example 3:
Existing:
A → B
C → D

If the task descriptions clearly state that D cannot begin until B is completed,
then suggesting B → D is valid because that direct dependency is missing.

Example 4:
Existing:
Frontend → API Integration
API Integration → Integration Testing
Integration Testing → Deployment

Do NOT suggest:
Frontend → Deployment
Frontend → Integration Testing
API Integration → Deployment

These are transitive dependencies already implied by the chain.

Example 5:
If no meaningful direct dependency is missing, return:
[]

Do not invent dependencies simply because two tasks are related.`;

function buildUserPrompt(
  tasks: { id: string; title: string; description: string | null }[],
  dependencies: { taskId: string; dependsOnTaskId: string }[]
): string {
  return JSON.stringify(
    {
      tasks: tasks.map((t) => ({ id: t.id, title: t.title, description: t.description ?? "" })),
      existingDependencies: dependencies,
    },
    null,
    2
  );
}

const responseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "dependency_suggestions",
    strict: true,
    schema: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              taskId: { type: "string" },
              dependsOnTaskId: { type: "string" },
              reason: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["taskId", "dependsOnTaskId", "reason", "confidence"],
            additionalProperties: false,
          },
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
  },
};

/**
 * Calls OpenAI grounded in the real task list + real dependency edges.
 * Never writes to the DB — returns a plain array the caller/client can
 * accept or reject. Every candidate is defensively re-validated against
 * the actual graph (real ids, no self-loop, not already existing, no
 * cycle) before being returned, so a hallucinated or unsafe suggestion
 * never reaches the UI even before a human decides to accept it.
 */
export async function generateDependencySuggestions(projectId: string): Promise<AISuggestion[]> {
  const [tasks, dependencies] = await Promise.all([
    db.task.findMany({
      where: { projectId },
      select: { id: true, title: true, description: true, status: true, startDate: true, endDate: true, duration: true },
    }),
    db.dependency.findMany({
      where: { task: { projectId } },
      select: { taskId: true, dependsOnTaskId: true },
    }),
  ]);

  if (tasks.length === 0) return [];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(tasks, dependencies) },
    ],
    response_format: responseFormat,
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return [];

  let parsed;
  try {
    parsed = aiSuggestionResponseSchema.parse(JSON.parse(raw));
  } catch {
    // Malformed output from the model — fail safe to "no suggestions"
    // rather than surfacing garbage or throwing into the UI.
    return [];
  }

  const validTaskIds = new Set(tasks.map((t) => t.id));
  const existingEdgeKeys = new Set(dependencies.map((d) => `${d.taskId}::${d.dependsOnTaskId}`));
  const graph = buildGraph(
    tasks.map((t) => ({
      id: t.id,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      duration: t.duration,
    })),
    dependencies
  );

  const seen = new Set<string>();
  const validated: AISuggestion[] = [];

  for (const s of parsed.suggestions) {
    if (s.taskId === s.dependsOnTaskId) continue; // self-loop
    if (!validTaskIds.has(s.taskId) || !validTaskIds.has(s.dependsOnTaskId)) continue; // hallucinated id
    const key = `${s.taskId}::${s.dependsOnTaskId}`;
    if (existingEdgeKeys.has(key)) continue; // already exists
    if (seen.has(key)) continue; // duplicate suggestion from the model
    if (wouldCreateCycle(graph, { taskId: s.taskId, dependsOnTaskId: s.dependsOnTaskId })) continue; // reuses Phase 1's pure cycle check

    seen.add(key);
    validated.push(s);
  }

  return validated;
}
import OpenAI from "openai";
import { db } from "@/lib/db";
import { buildGraph } from "@/lib/graph/buildGraph";
import { wouldCreateCycle } from "@/lib/graph/cycleDetection";
import { aiSuggestionResponseSchema, AISuggestion } from "@/lib/validations/ai.schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a project-planning assistant for a dependency-aware Kanban tool.
You will be given a list of existing tasks (id, title, description) and existing
dependency edges (a dependency means "taskId depends on dependsOnTaskId", i.e.
dependsOnTaskId must be done before taskId can start).

Your job: suggest MISSING dependencies that logically should exist based on the
task titles/descriptions, but do not already exist in the given edge list.

Rules:
- Only use taskId and dependsOnTaskId values that are EXACT ids from the provided
  task list. Never invent an id or use a title as an id.
- Never suggest an edge that already exists in the given dependency list.
- Never suggest a task depending on itself.
- Never suggest an edge that would create a cycle given the existing graph.
- If you are not confident a dependency is genuinely missing, do not include it.
- If there are no missing dependencies worth suggesting, return an empty array.
  Do not force a suggestion just to have something to say.
- confidence is a number between 0 and 1 reflecting how sure you are.
- reason must be a short, concrete explanation grounded in the task titles/descriptions.`;

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
export async function generateDependencySuggestions(): Promise<AISuggestion[]> {
  const [tasks, dependencies] = await Promise.all([
    db.task.findMany({ select: { id: true, title: true, description: true, status: true, startDate: true, endDate: true, duration: true } }),
    db.dependency.findMany({ select: { taskId: true, dependsOnTaskId: true } }),
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
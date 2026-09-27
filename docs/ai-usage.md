# AI and LLM usage

This document covers two distinct things, and keeps them clearly
separated: the AI feature built into the product itself, and the use of
AI coding tools during development of this project.

## Table of contents

1. The AI feature in the product
2. Prompt design and grounding
3. Safety and validation of AI output
4. Rate limiting and cost control
5. Why the AI can never write to the database
6. Disclosure of AI assisted development

## 1. The AI feature in the product

TaskFlow Pro uses OpenAI's gpt 4o mini model, called from
lib/services/aiService.ts, to suggest dependencies that appear to be
missing from a project's current task graph. This is the only place in
the codebase an LLM is called, and it is called exclusively from a server
route, POST /api/projects/[projectId]/ai/suggestions, never from the
client.

The feature is presented in the UI as an AI Suggestions dialog. A user
clicks Suggest Dependencies, the server route generates suggestions, and
each one is shown as a card with the proposed edge (in the form of task
titles, not raw ids), the model's stated reason, and a confidence
percentage, with Accept and Reject buttons.

## 2. Prompt design and grounding

The prompt sent to the model is built from the project's actual data,
never from invented or placeholder content. Specifically, every task's
real id, title, and description, and every existing dependency edge
(as real id pairs), are serialized into the user message. The system
prompt instructs the model explicitly to use only exact ids from the
provided task list, never a title in place of an id, never to invent an
id, never to suggest an edge that already exists, never to suggest a task
depending on itself, never to suggest an edge that would create a cycle,
and to return an empty list rather than a forced suggestion if nothing is
genuinely missing.

The response is requested as strict structured JSON via OpenAI's
json_schema response format, with a schema that requires exactly the
fields the product needs: taskId, dependsOnTaskId, reason, and a
numeric confidence. This removes an entire class of parsing failures
that free form text output would introduce.

If the graph genuinely has no missing dependencies worth suggesting, the
UI shows "Graph is complete. No additional dependency suggestions
required." rather than fabricating a suggestion to have something to
display. This is enforced both by the system prompt's explicit
instruction and, more importantly, by the fact that every candidate the
model does return is independently reverified as described in the next
section, so even if the model were to hallucinate a suggestion under
pressure to produce output, that suggestion would be filtered out before
ever reaching the person using the product.

## 3. Safety and validation of AI output

The model's raw output is never trusted on its own. After parsing and Zod
validating the response shape, every individual suggestion is checked
against the real current state of the project before it is returned to
the client:

* Both taskId and dependsOnTaskId must be real ids belonging to a task
  in this project. A hallucinated id is dropped silently.
* A suggestion where a task depends on itself is dropped.
* A suggestion that duplicates an edge that already exists in the
  database is dropped.
* A duplicate suggestion within the same response (the model suggesting
  the same edge twice) is dropped.
* The suggestion is run through wouldCreateCycle, the exact same pure
  function from lib/graph/cycleDetection.ts used for a manually
  created dependency. A suggestion that would create a cycle is dropped.

Only suggestions that survive every one of these checks are ever shown to
the user. This means the AI's role is strictly advisory. It can propose,
but every proposal is independently confirmed safe using the same logic
that governs manual dependency creation, before a human ever sees it, and
again when a human accepts it.

## 4. Rate limiting and cost control

The suggestions endpoint enforces a limit of 10 requests per minute per
client IP address, implemented server side in
lib/services/rateLimiter.ts. A request beyond that limit receives a
429 response with a clear message stating how long to wait. This protects
both against runaway OpenAI API cost and against a single client
overwhelming the endpoint. See docs/architecture.md section 9 for the
scaling tradeoff this simple approach makes.

## 5. Why the AI can never write to the database

This is enforced structurally, not just by convention. generateDependencySuggestions
only ever reads from the database (db.task.findMany,
db.dependency.findMany) and returns a plain array. It has no reference
to db.dependency.create anywhere in its implementation. The only path
that writes a suggested dependency to the database is the user clicking
Accept, which calls useDependencies().createDependency, the exact same
client hook and the exact same POST /api/projects/[projectId]/dependencies
endpoint used by the manual Add Dependency dialog. There is no
alternate, AI only endpoint or write path anywhere in the codebase.
Rejecting a suggestion makes no network request at all; it only filters
the suggestion out of local client state.

## 6. Disclosure of AI assisted development

This project was built with the assistance of an AI coding assistant
(Claude) used interactively throughout development, phase by phase,
following the build order: scaffolding and schema, the pure dependency
engine and its test suite, the API layer, the Kanban UI, the AI
suggestions feature itself, the dependency graph visualization, and
finally multi project support. Each phase's code was generated by the
assistant based on a detailed specification, then reviewed, run, and
verified by the developer before moving to the next phase. Several bugs
surfaced during this review process and were fixed with further AI
assistance, including a hooks ordering issue in the Kanban board
component, a cascading regression gap where a Done task could remain
Done after its prerequisites regressed, and a TypeScript type mismatch in
a shadcn Select component.

This disclosure is included in the interest of transparency about how the
codebase was produced, consistent with responsible use of AI development
tools: the assistant was used as an implementation aid under continuous
human direction and review, not as an unsupervised code generator, and
every piece of core logic, in particular everything in
lib/graph/, is backed by a unit or integration test that the
developer ran and confirmed passing before relying on it.
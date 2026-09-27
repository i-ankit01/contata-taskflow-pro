# AI and LLM Usage

TaskFlow Pro uses AI in two distinct ways:

1. **AI inside the product** — suggesting missing task dependencies.
2. **AI-assisted development** — Claude was used as a coding assistant during implementation.

These two uses are intentionally kept separate and are described independently below.

---

## Table of Contents

1. [The AI Feature in the Product](#1-the-ai-feature-in-the-product)
2. [Prompt Design and Grounding](#2-prompt-design-and-grounding)
3. [Safety and Validation of AI Output](#3-safety-and-validation-of-ai-output)
4. [Rate Limiting and Cost Control](#4-rate-limiting-and-cost-control)
5. [Why AI Cannot Write to the Database](#5-why-ai-cannot-write-to-the-database)
6. [Disclosure of AI-Assisted Development](#6-disclosure-of-ai-assisted-development)

---

## 1. The AI Feature in the Product

TaskFlow Pro uses **OpenAI's `gpt-4o-mini`** to suggest dependencies that may be missing from a project's task graph.

The model is called from:

```text
lib/services/aiService.ts
```

and is accessed exclusively through the server-side endpoint:

```text
POST /api/projects/[projectId]/ai/suggestions
```

The client never calls OpenAI directly.

### User Flow

```text
User
  │
  ▼
AI Suggestions Dialog
  │
  ▼
Server API Route
  │
  ▼
OpenAI
  │
  ▼
Validation
  │
  ▼
Suggestion Cards
  │
  ├── Accept → Existing Dependency API
  │
  └── Reject → Local UI only
```

Each suggestion is displayed as a card containing:

* Proposed dependency using task titles
* Model-generated reason
* Confidence percentage
* **Accept** button
* **Reject** button

The AI therefore acts as an advisory layer rather than an autonomous workflow executor.

---

## 2. Prompt Design and Grounding

The model receives the project's **real current data** rather than invented or placeholder information.

The prompt contains:

* Every task's real ID
* Task title
* Task description
* Every existing dependency as a real task-ID pair

The system prompt instructs the model to:

* Use only exact task IDs from the provided task list.
* Never use a title in place of an ID.
* Never invent an ID.
* Never suggest an existing dependency.
* Never suggest a self-dependency.
* Never suggest a dependency that would create a cycle.
* Never suggest indirect, transitive, or redundant dependencies.
* Return an empty list when no genuinely missing dependency exists.
* Avoid forcing a suggestion simply because the model is expected to produce output.

### Structured Output

The response is requested using OpenAI's structured JSON response format.

The schema contains exactly the fields required by the product:

```json
{
  "taskId": "string",
  "dependsOnTaskId": "string",
  "reason": "string",
  "confidence": 0.0
}
```

This avoids relying on free-form text parsing and makes the model response easier to validate deterministically.

### Complete Graph Handling

If the graph already contains all meaningful direct dependencies, the system does not force the model to invent another one.

The UI displays:

```text
Graph is complete. No additional dependency suggestions required.
```

This behavior is reinforced at two levels:

1. The prompt explicitly tells the model to return an empty list when appropriate.
2. Every returned suggestion is independently validated before reaching the user.

---

## 3. Safety and Validation of AI Output

The model's output is **never trusted on its own**.

After parsing and Zod validation, every suggestion is checked against the project's current database state.

### Validation Pipeline

```text
OpenAI Response
      │
      ▼
Structured Response Validation
      │
      ▼
Real Task ID Validation
      │
      ▼
Self-Dependency Check
      │
      ▼
Existing Dependency Check
      │
      ▼
Duplicate Suggestion Check
      │
      ▼
Cycle Detection
      │
      ▼
Safe Suggestion
```

A candidate is discarded if:

| Check          | Invalid candidate                           |
| -------------- | ------------------------------------------- |
| Task IDs       | ID does not belong to a task in the project |
| Self-reference | `taskId === dependsOnTaskId`                |
| Existing edge  | Dependency already exists                   |
| Duplicate      | Same suggestion appears twice               |
| Cycle          | New edge would create a cycle               |

The cycle check uses the same pure graph function used by manual dependency creation:

```text
lib/graph/cycleDetection.ts
```

Specifically:

```text
wouldCreateCycle(...)
```

This is important because AI-generated dependencies do not receive a separate or weaker validation path.

Only suggestions that survive every check are shown to the user.

When a user accepts a suggestion, the dependency is **validated again** through the normal dependency API.

Therefore:

```text
AI Suggestion
      ↓
Validation
      ↓
Human Approval
      ↓
Normal Dependency API
      ↓
Cycle Validation
      ↓
Database
```

The AI can propose a dependency, but it cannot bypass the application's deterministic validation rules.

---

## 4. Rate Limiting and Cost Control

The AI suggestions endpoint is limited to:

```text
10 requests per minute per client IP
```

The limiter is implemented server-side in:

```text
lib/services/rateLimiter.ts
```

Requests beyond the limit receive:

```text
HTTP 429
```

with a message indicating how long the client should wait.

This provides two benefits:

* Reduces abuse of the AI endpoint.
* Limits unnecessary OpenAI API usage and associated cost.

The current limiter is intentionally in-memory and process-local. See [Architecture — Rate Limiting](architecture.md#9-rate-limiting) for the scaling tradeoff.

---

## 5. Why AI Cannot Write to the Database

This restriction is enforced **structurally**, not only through a prompt or convention.

The AI suggestion service only reads project data:

```text
db.task.findMany(...)
db.dependency.findMany(...)
```

and returns a plain array of suggestions.

It has no database write operation for dependencies.

In particular, the AI service does not contain:

```text
db.dependency.create(...)
```

### Only the Normal Dependency API Can Persist a Suggestion

The only path that writes an accepted AI suggestion is the same path used for manually created dependencies:

```text
User clicks Accept
       ↓
useDependencies().createDependency()
       ↓
POST /api/projects/[projectId]/dependencies
       ↓
Dependency validation
       ↓
Database
```

There is no separate AI-only database write endpoint.

### Rejecting a Suggestion

Rejecting a suggestion does not call the server.

The suggestion is simply removed from the local client state.

```text
Reject
  ↓
Local UI state
  ↓
No API request
  ↓
No database change
```

This keeps the AI feature human-controlled and prevents the model from directly modifying project state.

---

## 6. Disclosure of AI-Assisted Development

TaskFlow Pro was developed with assistance from **Claude**, used interactively throughout the implementation process.

Claude was used phase by phase for areas including:

* Initial project scaffolding
* Database schema
* Pure dependency engine
* Automated tests
* API layer
* Kanban UI
* AI dependency suggestions
* Dependency graph visualization
* Multi-project support
* Debugging and documentation

The development process was iterative rather than fully autonomous.

A typical workflow was:

```text
Specification
      ↓
AI-assisted implementation
      ↓
Developer review
      ↓
Run application/tests
      ↓
Identify issues
      ↓
Fix and re-test
```

Several implementation issues were identified during this process and corrected with further AI assistance, including:

* A hooks ordering issue in the Kanban board.
* A cascading regression case where a completed task could remain `DONE` after its prerequisite regressed.
* A TypeScript type mismatch involving a shadcn/ui `Select` component.

The core dependency engine was independently tested using unit and integration tests before being relied upon by the application.

The AI coding assistant therefore acted as an **implementation aid under continuous human direction and review**, rather than as an unsupervised code generator.

This disclosure is included to make the development process transparent and distinguish AI-assisted implementation from the AI functionality that is actually shipped as part of TaskFlow Pro.

# Architecture

TaskFlow Pro is a dependency-aware Kanban workflow system. The core technical component is its dependency engine, which manages DAG validation, derived readiness, deterministic schedule propagation, rollback handling, and critical-path calculation.

The Kanban interface is built on top of this engine rather than containing the dependency logic itself.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Data Model](#2-data-model)
3. [Dependency Engine](#3-dependency-engine)
4. [Schedule Propagation](#4-schedule-propagation)
5. [Rollback and Cascading Regression](#5-rollback-and-cascading-regression)
6. [API Layer](#6-api-layer)
7. [Multi-Project Support](#7-multi-project-support)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Rate Limiting](#9-rate-limiting)
10. [Scalability and Business Impact](#10-scalability-and-business-impact)
11. [Feasibility and Production Readiness](#11-feasibility-and-production-readiness)

---

## 1. Design Philosophy

Three architectural decisions shape the system.

### 1.1 Readiness Is Derived, Never Stored

There is no `ready`, `blocked`, or `isBlocked` field in the database.

Whether a task is Ready or Blocked is computed from:

```text
Current task status
        +
Dependency graph
        ↓
Derived readiness
```

A task is Ready when all of its direct prerequisites are `DONE`.

This prevents stored readiness from becoming stale when task statuses change. For example, when a prerequisite regresses, downstream readiness automatically reflects the new state without requiring a separate readiness mutation.

### 1.2 The Dependency Engine Is Pure

All graph logic lives under:

```text
lib/graph/
```

These functions operate only on plain TypeScript objects and arrays.

They do **not** import:

* Prisma
* Next.js
* API routes
* React
* UI components

This separation makes cycle detection, readiness, propagation, rollback, and critical-path calculation independently testable without a database.

It also allows the same engine to be reused by the API, projects feature, AI validation, and dependency graph visualization.

### 1.3 Minimal Infrastructure

The project intentionally uses:

```text
One Next.js application
        +
One PostgreSQL database
```

There are no:

* Redis instances
* Kafka queues
* Background workers
* Microservices
* Additional infrastructure

This keeps the architecture simple and appropriate for the project's scope.

Where this creates tradeoffs — such as the process-local rate limiter — the limitation is documented explicitly.

---

## 2. Data Model

The database contains three primary entities:

```text
Project
   │
   └── Task
         │
         ├── Dependency → prerequisite Task
         └── Dependency → dependent Task
```

### Project

```prisma
model Project {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tasks Task[]
}
```

### Task

```prisma
model Task {
  id          String     @id @default(cuid())
  projectId   String
  title       String
  description String?
  status      TaskStatus @default(BACKLOG)
  startDate   DateTime?
  endDate     DateTime?
  duration    Int?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  project    Project      @relation(
    fields: [projectId],
    references: [id],
    onDelete: Cascade
  )
  dependsOn  Dependency[] @relation("TaskDependsOn")
  dependents Dependency[] @relation("DependsOnTask")

  @@index([projectId])
}
```

### Dependency

```prisma
model Dependency {
  id              String   @id @default(cuid())
  taskId          String
  dependsOnTaskId String
  createdAt       DateTime @default(now())

  task          Task @relation(
    "TaskDependsOn",
    fields: [taskId],
    references: [id],
    onDelete: Cascade
  )

  dependsOnTask Task @relation(
    "DependsOnTask",
    fields: [dependsOnTaskId],
    references: [id],
    onDelete: Cascade
  )

  @@unique([taskId, dependsOnTaskId])
}
```

### Task Status

```prisma
enum TaskStatus {
  BACKLOG
  IN_PROGRESS
  REVIEW
  DONE
}
```

A dependency row has the following meaning:

```text
taskId depends on dependsOnTaskId
```

Therefore:

```text
dependsOnTaskId
       ↓
     taskId
```

There is intentionally no readiness column.

Deleting a project cascades to its tasks, and deleting a task cascades to dependency rows referencing that task. This prevents orphaned dependency records.

### Seed Graph

The seed script creates one sample project containing:

* 10 tasks
* 12 dependencies

The graph intentionally contains several useful structures:

```text
Linear chain:
Requirements → Database Schema → Backend API

Branch:
Database Schema
      ├── Backend API
      └── Frontend Development

Convergence:
Backend API ─────┐
                 ├── API Integration
Frontend ────────┘

Final convergence:
Security Review ───┐
                   ├── Deployment
Production Setup ──┘
```

This allows the sample data to exercise cycle detection, readiness, multi-parent propagation, diamond behavior, and regression handling.

---

## 3. Dependency Engine

The dependency engine lives entirely under:

```text
lib/graph/
```

### `types.ts`

Defines framework-independent graph structures such as:

* `GraphNode`
* `GraphEdge`
* `Graph`

These are plain TypeScript types and do not depend on Prisma-generated types.

### `buildGraph.ts`

Converts task and dependency arrays into the internal graph representation.

It also provides helpers for:

* Finding prerequisites
* Finding dependents

Other graph modules build on these helpers.

### `cycleDetection.ts`

Implements cycle detection using depth-first search with white/gray/black node states.

The important operation is:

```text
wouldCreateCycle(graph, proposedEdge)
```

The candidate edge is evaluated against a copy of the edge list rather than mutating the existing graph.

A gray node encountered again during the same traversal represents a back edge and therefore a cycle.

`validateNewEdge` wraps this validation and rejects:

* Self-dependencies
* Cyclic dependencies

Most importantly, a rejected dependency does not mutate the existing graph.

### `readiness.ts`

`getReadiness` examines a task's direct prerequisites.

```text
No prerequisites
      ↓
    READY

All prerequisites DONE
      ↓
    READY

At least one prerequisite not DONE
      ↓
   BLOCKED
```

Readiness only considers direct prerequisites.

Transitive dependencies are handled naturally because the status of each direct prerequisite already reflects changes further upstream.

### `topologicalSort.ts`

The engine uses Kahn's topological sorting algorithm.

The algorithm repeatedly:

1. Finds nodes with zero remaining in-degree.
2. Removes them from consideration.
3. Decrements the in-degree of their dependents.
4. Continues until all nodes are processed.

The resulting ordering guarantees:

```text
Every prerequisite
        ↓
is processed before
        ↓
its dependent
```

This ordering is used by schedule propagation and cascading regression logic.

### `propagation.ts`

Implements deterministic schedule propagation.

See [Schedule Propagation](#4-schedule-propagation).

### `rollback.ts`

Provides rollback-related graph operations, including:

* `recomputeDownstreamReadiness`
* `computeCascadingRegressions`

These functions allow the service layer to determine how downstream tasks are affected when an upstream task regresses.

### `criticalPath.ts`

`computeCriticalPath` uses dynamic programming over the DAG to find the longest duration chain.

The resulting chain represents the sequence of work that determines the overall project duration.

It is used by the dependency graph visualization.

---

## 4. Schedule Propagation

The propagation rule is:

```text
For every downstream task:

startDate = MAX(endDate of direct prerequisites)

endDate = startDate + duration
```

Each task is processed once during a propagation run in topological order.

### Why Topological Order?

Consider:

```text
A → B → D
A → C → D
```

If `A` is delayed by three days:

```text
A +3 days
│
├── B +3 days
│
└── C +3 days
      │
      └── D
```

`D` does **not** receive six days of delay.

Instead:

```text
D.startDate =
MAX(B.endDate, C.endDate)
```

Both paths already contain the same three-day shift.

Therefore:

```text
D shift = 3 days
```

rather than:

```text
D shift = 6 days
```

### Why This Works Without a Diamond-Specific Case

There is no special implementation for diamond-shaped graphs.

The general rule is sufficient:

1. Process prerequisites before dependents.
2. Calculate each task from its direct prerequisites.
3. Use `MAX`, not a sum.
4. Visit each task once.

This makes the propagation algorithm deterministic and general.

### Persistence

When `taskService.updateTask` changes a task's duration:

1. The edited task's end date is recalculated.
2. The current project graph is reloaded.
3. Downstream schedules are propagated.
4. Only changed dates are written back.
5. The updates occur inside a single Prisma transaction.

Therefore, a propagation run either completes successfully or the transaction rolls back.

---

## 5. Rollback and Cascading Regression

Readiness is derived, so moving a task from `DONE` to another status does not require a readiness mutation.

For example:

```text
A → B → C
```

If `A` regresses:

```text
A = IN_PROGRESS

B = BLOCKED
C = BLOCKED
```

The readiness values are recalculated from the current graph and statuses.

### Why Status Requires Additional Handling

Unlike readiness, workflow status is stored.

Without additional logic, this could happen:

```text
A = IN_PROGRESS
B = DONE
C = DONE
```

even though `B` and `C` can no longer satisfy their prerequisites.

`computeCascadingRegressions` handles this case.

The algorithm:

1. Starts from the regressed task.
2. Traverses downstream tasks in topological order.
3. Maintains a simulated status override map.
4. Checks each downstream task against the current simulated prerequisite states.
5. Marks completed tasks for demotion when their prerequisites are no longer satisfied.
6. Persists the resulting status changes in the same transaction.

This handles both:

```text
A → B → C
```

and converging graphs such as:

```text
A ──┐
    ├── C
B ──┘
```

without recursive database operations or repeated reads.

---

## 6. API Layer

API routes are responsible for HTTP concerns, while graph logic remains in the service and graph layers.

The general flow is:

```text
API Route
   ↓
Zod Validation
   ↓
Service Layer
   ↓
Pure Graph Engine
   ↓
Prisma
   ↓
PostgreSQL
```

Every API route validates its request with Zod before calling a service function.

Services:

1. Load the relevant project graph.
2. Call the appropriate pure graph function.
3. Persist only validated changes.

Routes do not reimplement graph logic.

### API Response Shape

All API responses use:

```ts
{ success: true, data }
```

or:

```ts
{ success: false, error }
```

The response helper is defined centrally in:

```text
lib/api-response.ts
```

### Dependency Creation

The most important dependency endpoint is:

```text
POST /api/projects/[projectId]/dependencies
```

The flow is:

```text
Request
  ↓
Zod validation
  ↓
Load project graph
  ↓
Validate proposed edge
  ↓
Cycle detected?
  ├── Yes → 409 response, no DB write
  └── No  → Create dependency
```

A rejected cyclic dependency never reaches `db.dependency.create`.

---

## 7. Multi-Project Support

Every task belongs to exactly one project.

Dependencies belong to tasks and therefore belong to the same project.

When loading a graph, the service scopes both task and dependency queries by `projectId`:

```text
Project A
  ├── Task 1
  ├── Task 2
  └── Dependencies

Project B
  ├── Task 3
  ├── Task 4
  └── Dependencies
```

The graph engine itself is completely unaware of projects.

Only the database-backed service layer and API routes need to pass `projectId`.

Dependency creation also verifies that both referenced tasks belong to the same project before cycle validation is performed.

This prevents cross-project dependency edges.

---

## 8. Frontend Architecture

The frontend consumes the API rather than directly accessing Prisma.

### Kanban Board

The board:

1. Fetches project data from the API.
2. Displays tasks in four workflow columns.
3. Uses `dnd-kit` for drag and drop.
4. Sends mutations through the API.
5. Refetches after mutations.

This keeps persisted state on the server as the source of truth.

After a mutation, the board can therefore reflect readiness changes affecting other tasks.

### Loading Behavior

Routine background refetches display a small loading indicator rather than unmounting the board.

This prevents unnecessary visual flashes during normal mutations.

### Dependency Graph

The dependency graph is a separate read-only view built using React Flow.

It visualizes:

* Task status
* Derived readiness
* Dependency edges
* Critical path

This provides evaluators with a visual way to inspect the DAG rather than relying only on task dates and status badges.

---

## 9. Rate Limiting

The AI suggestions endpoint is limited to:

```text
10 requests / minute / client IP
```

The current implementation uses a simple in-memory sliding window.

The limiter is intentionally process-local because the project avoids additional infrastructure.

### Current Tradeoff

The limiter:

* Resets when the process restarts.
* Does not share state between application instances.

For the current single-instance deployment model, this is sufficient.

If the application is horizontally scaled, rate limiting should move to a shared store such as Redis so that the limit applies consistently across instances.

---

## 10. Scalability and Business Impact

### Problem Being Addressed

Traditional Kanban boards track status but do not necessarily model task ordering.

This creates two recurring problems:

1. Teams must manually determine which work is actually unblocked.
2. Schedule changes must be manually propagated across downstream tasks.

TaskFlow Pro makes both of these properties computable from the dependency graph.

### Scaling the Core Engine

The dependency engine operates on the graph representation rather than performing database operations for each dependency calculation.

For a propagation run, each processed task is evaluated once in topological order.

The database schema also includes:

```prisma
@@index([projectId])
```

which supports project-scoped task queries as the number of projects grows.

Multi-project support already isolates project graphs, providing a foundation for future multi-tenant deployment.

### Scaling the Application

The current prototype intentionally avoids additional infrastructure.

A larger production deployment could introduce:

* PostgreSQL connection pooling
* Additional database indexes
* Horizontal scaling of stateless application instances
* Shared rate limiting
* Caching
* Background processing for expensive AI workloads

The process-local rate limiter is the main component that would need to change when moving to a horizontally scaled deployment.

---

## 11. Feasibility and Production Readiness

TaskFlow Pro is deployable as a single Next.js application backed by a cloud PostgreSQL database.

The current architecture provides:

* API input validation
* Server-side secret handling
* Deterministic graph validation
* Transactional schedule propagation
* Human approval for AI-generated dependencies
* Revalidation of AI-generated dependency suggestions
* Automated testing of core graph behavior

### Known Production Hardening Steps

Two limitations are explicitly documented:

**1. Server-side Blocked → Done validation**

The client currently prevents a Blocked task from being dragged into Done. The same rule should also be enforced in the server-side task service before a production launch.

**2. Shared rate limiting**

The current rate limiter is process-local. A shared store would be required when horizontally scaling the application.

These are targeted production-hardening steps rather than architectural rewrites.

---

## Related Documentation

* [README](../README.md) — project overview, setup, features, and evaluator checklist
* [AI Usage](ai-usage.md) — AI inside the product and AI tools used during development
* [Testing](testing.md) — automated tests and verification strategy

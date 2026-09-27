# Architecture

This document describes the system design of TaskFlow Pro in full, with a
particular focus on the dependency engine, since that is the core
deliverable of this project rather than the Kanban interface layered on
top of it.

## Table of contents

1. Design philosophy
2. Data model
3. The dependency engine
4. Schedule propagation in detail
5. Rollback and cascading regression
6. API layer
7. Multi project support
8. Frontend architecture
9. Rate limiting
10. Scalability and business impact
11. Feasibility and production readiness

## 1. Design philosophy

Three decisions shape everything else in this codebase.

Readiness is derived, never stored. There is no ready or blocked
column anywhere in the schema. Whether a task is Ready or Blocked is
recomputed from its current status and the dependency graph on every read.
This avoids an entire class of bugs where a stored readiness value drifts
out of sync with the statuses that actually determine it. A rollback,
for example, requires no special mutation logic at all, because the value
is simply recalculated correctly the next time it is read.

The dependency engine is pure. Every file under lib/graph/
operates only on plain TypeScript objects and arrays passed in as
arguments, and returns plain objects. Nothing in that folder imports
Prisma, Next.js, or any UI code. This is what makes cycle detection,
readiness, propagation, rollback, and critical path calculation fully
unit testable without a database, and it is also what let every later
feature (projects, AI suggestions, the graph visualization) reuse the same
engine without touching it.

No infrastructure beyond what the problem needs. One Next.js
application, one PostgreSQL database. No queues, no caches, no background
workers, no microservices. Every tradeoff this choice implies (for
example the in memory rate limiter) is called out explicitly rather than
hidden.

## 2. Data model

model Project {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tasks Task[]
}

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

  project    Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  dependsOn  Dependency[] @relation("TaskDependsOn")
  dependents Dependency[] @relation("DependsOnTask")

  @@index([projectId])
}

model Dependency {
  id              String   @id @default(cuid())
  taskId          String
  dependsOnTaskId String
  createdAt       DateTime @default(now())

  task          Task @relation("TaskDependsOn", fields: [taskId], references: [id], onDelete: Cascade)
  dependsOnTask Task @relation("DependsOnTask", fields: [dependsOnTaskId], references: [id], onDelete: Cascade)

  @@unique([taskId, dependsOnTaskId])
}

enum TaskStatus {
  BACKLOG
  IN_PROGRESS
  REVIEW
  DONE
}

A Dependency row means taskId depends on dependsOnTaskId. There is
intentionally no ready, blocked, or isBlocked field anywhere. Deleting
a Project cascades to its Task rows, and deleting a Task cascades to
any Dependency row that references it, so the graph can never point at a
task that no longer exists.

The seed script creates one sample project containing 10 tasks and 12
dependencies, deliberately shaped to exercise every scenario this document
describes: a linear chain (Requirements Gathering through Backend API), a
branch (Database Schema feeding both Backend API and Frontend Development),
a convergence (Backend API and Frontend Development both feeding API
Integration), and a double convergence at the end (Security Review and
Production Setup both feeding Deployment).

## 3. The dependency engine

Located entirely under lib/graph/.

types.ts defines GraphNode, GraphEdge, and Graph as plain
object shapes, with no dependency on any Prisma generated type.

buildGraph.ts turns arrays of nodes and edges into a Graph
(a Map of nodes plus an edge array), and provides getPrerequisites and
getDependents, simple filters over the edge list. Every other file in
this folder is built on these two helpers.

cycleDetection.ts implements wouldCreateCycle, a depth first search
with white, gray, black color marking over the graph plus one proposed
edge. A gray node reached again during the same traversal is a back edge,
meaning a cycle. validateNewEdge wraps this and throws a CycleError
if the proposed edge is a self loop or would create a cycle. Crucially,
wouldCreateCycle builds its adjacency list from a copy of the edge array
with the candidate edge appended, and never mutates the Graph object
passed in. If the edge is rejected, the graph the caller holds is exactly
as it was before the call.

readiness.ts implements getReadiness, which looks up a task's
direct prerequisites and returns READY only if every one of them has
status === 'DONE'. A task with no prerequisites is always READY. This
function does not traverse beyond one level, because readiness is defined
purely in terms of direct prerequisites; anything transitive is handled
naturally, since a task's own readiness depends on whether its direct
prerequisites are individually Done, and those prerequisites' own
statuses already reflect whatever happened further upstream.

topologicalSort.ts implements Kahn's algorithm: repeatedly remove
nodes with zero remaining in degree, decrementing the in degree of their
dependents as they are removed. The result is an order in which every task
appears strictly after every one of its own prerequisites. This ordering
is the mechanism that guarantees propagation and cascade logic each visit
every task exactly once, in an order where a task's prerequisites are
always already finalized by the time that task is processed.

propagation.ts implements propagateSchedule, described in detail
in section 4.

rollback.ts implements recomputeDownstreamReadiness, which walks a
regressed task's dependents breadth first and returns their current
derived readiness for the caller's convenience (for example, to decide
which cards need a UI update), and computeCascadingRegressions,
described in section 5.

criticalPath.ts implements computeCriticalPath, a dynamic
programming pass over the same topological order that finds the longest
duration chain through the DAG (the sequence of tasks that determines the
overall project length, since delaying anything on this chain delays the
whole project). Added for the optional dependency graph visualization.

## 4. Schedule propagation in detail

The rule, stated precisely: when a task's own schedule changes, walk the
graph in topological order starting from that task. For every downstream
task reached, its new start date is the maximum end date among its direct
prerequisites, and its new end date is that start date plus its own
duration. Each task is visited exactly once per propagation run.

This is what prevents compounding at a diamond shaped convergence. Given
A -> B -> D and A -> C -> D, if A is delayed by three days:

* B's new start becomes A's new end date, so B shifts by three days.
* C's new start becomes A's new end date, so C also shifts by three
  days, independently of B.
* D's new start is the maximum of B's new end date and C's new end
  date. Since both already reflect the same three day shift from A, D
  shifts by exactly three days as well, never six. Taking a maximum
  rather than summing across incoming paths, combined with visiting each
  node exactly once, is the entire mechanism. There is no special case
  code for diamonds; the general rule produces the correct diamond
  behavior on its own.

In the service layer, taskService.updateTask recomputes the edited
task's own end date from its existing start date and its new duration
before reloading the graph, so the propagation pass that follows starts
from a value that is already correct for the edited task itself, not a
stale one. Every downstream task whose computed start or end date differs
from what is currently stored is written back to the database inside a
single Prisma transaction, so a propagation run either fully lands or
fully rolls back.

## 5. Rollback and cascading regression

Because readiness is derived, moving a task backward from Done to any
other status requires no readiness mutation at all. The next time
getReadiness is called for any downstream task, it simply reads the
current statuses and produces the correct answer, including for tasks more
than one step removed from the change.

Status, unlike readiness, is a real stored field, and this created a
distinct problem: a task could sit in the Done column even after one of
its prerequisites regressed, since nothing was forcing its status to
change. computeCascadingRegressions solves this. Given the task that
just regressed, it walks every downstream task in topological order,
tracking a simulated status override map as it goes, and for each task
still marked Done in the database whose direct prerequisites (considering
any earlier cascade decisions made earlier in the same pass) are no longer
all Done, it marks that task for demotion to Review. taskService.updateTask
then persists every demotion in the same transaction. This correctly
handles a multi step chain (A feeds B feeds C, both B and C were Done) and
a convergence point (a task with two prerequisites, only one of which
regressed) in a single pass, with no recursion and no repeated database
reads.

## 6. API layer

Every route under app/api/ validates its request body with Zod
before calling into a service function, and every service function is a
thin layer that loads the current graph from Prisma, calls into the pure
functions in lib/graph/, and writes back only what changed. Routes
never reimplement graph logic themselves. Responses use a single
consistent shape, { success: true, data } or { success: false, error },
defined once in lib/api response.ts.

POST /api/projects/[projectId]/dependencies is the one endpoint that
matters most for correctness: it loads the graph, validates the proposed
edge with validateNewEdge before any database write is attempted, and
only writes the row if that validation passes. A rejected request returns
a 409 with a clear message and never reaches db.dependency.create.

## 7. Multi project support

Every task and, transitively through its tasks, every dependency belongs
to exactly one project. loadGraph takes a projectId and scopes both
its task and dependency queries to that project, so the in memory graph
handed to the pure engine only ever contains one project's data.
createDependency additionally checks that both referenced tasks belong
to the same project before running the cycle check, so a dependency can
never be created across two unrelated projects. Because the dependency
engine itself is agnostic to what a project even is, none of the files
under lib/graph/ needed to change to support this feature; only the
Prisma backed services and the API routes needed a projectId threaded
through them.

## 8. Frontend architecture

The Kanban board fetches from the API on mount and refetches after every
mutation, rather than relying on client only state for anything persisted,
so the board survives a browser refresh. Drag and drop uses dnd kit;
dropping a card calls PATCH on the task and the board refetches to pick
up any readiness changes on other cards caused by the status change. A
background refetch shows a small fixed pill at the top of the screen
rather than unmounting the board, so routine updates do not cause a
visible flash. The dependency graph page is a separate, read only view
built with React Flow, colored by each task's status and derived
readiness and with the critical path highlighted, giving evaluators an at
a glance way to see the DAG structure and confirm propagation behavior
visually rather than by comparing dates on individual cards.

## 9. Rate limiting

The AI suggestions endpoint is limited to 10 requests per minute per
client IP using a simple in memory sliding window, implemented in
lib/services/rateLimiter.ts. This is intentionally simple, matching
the constraint that this project should not introduce infrastructure
beyond a single Next.js process and one database. The tradeoff is explicit:
this limiter resets on a process restart and does not share state across
multiple running instances. For a single instance deployment, which is
what this project targets, that is entirely correct. If the application
were ever scaled horizontally across multiple instances, this would need
to move to a shared store such as Upstash Redis so that the limit applies
across all instances rather than per instance.

## 10. Scalability and business impact

The real world problem this project solves is one every software team
runs into: a Kanban board that tracks status but has no concept of
ordering forces a team to manually remember which work is actually
unblocked, and any schedule slip has to be recalculated by hand across
every downstream task. TaskFlow Pro makes both of those computed rather
than remembered, which is exactly the kind of small, structural
correctness improvement that compounds in value as a team's task graph
grows larger and more interconnected, precisely because it removes manual
recalculation at the point where manual recalculation is most error prone.

The design scales cleanly beyond this prototype in a few concrete ways.
The dependency engine's cost per propagation run is proportional to the
number of tasks reachable downstream of the changed task, not to the total
number of tasks in the project, since the topological sort only needs to
walk from the changed node forward. The schema's @@index([projectId])
on Task keeps every project scoped query efficient as the number of
projects grows. Multi project support already isolates one team's or
one project's graph from another's, which is the natural foundation for a
future multi tenant deployment. The one component that would need to
change before a larger deployment, the in memory rate limiter, is already
called out explicitly above rather than hidden as a silent limitation.

## 11. Feasibility and production readiness

The application deploys as a single Next.js app against a cloud hosted
Postgres database with no additional infrastructure, which makes it
realistically deployable as is. Every API route validates input before it
reaches the database. No secret value is ever exposed to the client. AI
generated suggestions are revalidated in full before they can ever be
accepted, so a compromised or misbehaving model response can never bypass
the same cycle detection every manual dependency goes through. The two
gaps that stand between this prototype and a hardened production system,
a server side enforced check on the Blocked to Done transition and a
shared rate limiter store for multi instance deployments, are both
narrow, well understood, and documented in README.md rather than left
implicit.
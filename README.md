# TaskFlow Pro

A dependency aware Kanban workflow tool. Unlike a standard Kanban board, tasks
here can depend on other tasks. A task cannot be marked Ready until every
task it depends on is Done. The backend maintains a directed acyclic graph
(DAG) of tasks and dependencies and is the single source of truth for
whether a dependency is valid, whether a task is Ready or Blocked, and how
schedule delays propagate downstream without compounding.

An LLM (OpenAI) is used only to suggest missing dependencies. It never
writes to the database. Every suggestion passes through the same cycle
validation as a manually created dependency and must be explicitly accepted
by a human before it is persisted.

This document is the entry point for evaluators. It covers setup, features,
architecture summary, and how to verify each requirement in the problem
statement. Deeper detail lives in docs/architecture.md,
docs/ai usage.md, and docs/testing.md.

## Table of contents

1. Tech stack
2. Project structure
3. Setup and running locally
4. Environment variables
5. Core features
6. How to verify the dependency engine (evaluator checklist)
7. Security notes
8. Deployment notes
9. Known limitations
10. Links to further documentation

## 1. Tech stack

* Next.js (App Router) with TypeScript
* Tailwind CSS and shadcn/ui components
* Prisma ORM against PostgreSQL, hosted on Neon (cloud, serverless Postgres)
* dnd kit for drag and drop
* React Flow for the dependency graph visualization
* OpenAI (gpt 4o mini) for dependency suggestions, called only from a server
  route
* Vitest for unit and integration tests
* Zod for request validation on every API route

No Redis, Kafka, background workers, or additional services are used. This
is a single deployable Next.js application backed by one PostgreSQL
database, by design (see docs/architecture.md for the reasoning).

## 2. Project structure

taskflow-pro/
  prisma/
    schema.prisma          Data model: Project, Task, Dependency
    seed.ts                 Seeds one sample project with 10 tasks and 12 dependencies
  
    app/
      page.tsx                       Projects list (landing page)
      projects/[projectId]/
        page.tsx                     Kanban board for one project
        dashboard/page.tsx           Dependency graph and critical path view
      api/
        projects/route.ts            List and create projects
        projects/[projectId]/
          tasks/route.ts             List and create tasks
          tasks/[id]/route.ts        Update a task (status, duration)
          dependencies/route.ts      List and create dependencies
          dependencies/[id]/route.ts Delete a dependency
          ai/suggestions/route.ts    Generate AI dependency suggestions
    components/
      kanban/                        Board, columns, task cards
      tasks/                         Add and edit task dialogs
      dependencies/                  Add dependency dialog
      ai/                            AI suggestions panel
      graph/                         React Flow dependency graph
      projects/                      Projects list and creation dialog
    hooks/                           Client data hooks (useTasks, useDependencies, useProjects)
    lib/
      graph/                         Pure dependency engine, framework agnostic
      services/                      Prisma backed services that call into lib/graph
      validations/                   Zod schemas per resource
      api response.ts                Consistent { success, data } / { success, error } shape
    types/                           Shared frontend types
  docs/
    architecture.md
    ai usage.md
    testing.md
  README.md

## 3. Setup and running locally

Requirements: Node.js 18 or newer, a free Neon PostgreSQL project, an
OpenAI API key.

git clone <your repo url>
cd taskflow-pro
npm install

Create .env in the project root (see section 4 for the full list of
variables), then run:

npx prisma migrate dev --name init
npx prisma db seed
npm run test
npm run dev

Open http://localhost:3000. You will land on the projects list, which
already contains the seeded sample project with 10 tasks and 12
dependencies (see the seed data description in docs/architecture.md).
Click into it to reach the Kanban board.

## 4. Environment variables

# Neon PostgreSQL. Use the pooled connection string for DATABASE_URL
# and the direct connection string for DIRECT_URL (required by Prisma
# migrations against Neon's connection pooler).
DATABASE_URL="postgresql://user:password@host/db?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:password@host/db?sslmode=require"

# OpenAI, used only server side inside lib/services/aiService.ts.
# Never referenced from any client component.
OPENAI_API_KEY="sk-..."

No secret is ever sent to the browser. See section 7 and
docs/ai usage.md for how the OpenAI key is scoped.

## 5. Core features

* Kanban board with four columns: Backlog, In Progress, Review, Done.
  Drag and drop persists via PATCH /api/projects/[projectId]/tasks/[id].
* Derived readiness. Every task card shows Ready, Blocked, or Completed.
  This value is never stored. It is computed on every read from the
  current task statuses and the dependency graph.
* Cycle safe dependency creation. Adding a dependency runs a
  depth first search for a back edge before anything touches the
  database. A cyclic request is rejected with a clear toast and the
  graph remains completely unchanged.
* Deterministic, single pass schedule propagation. Editing a task's
  duration recalculates its own end date, then walks every downstream task
  exactly once in topological order. Each task's new start date is the
  maximum end date among its direct prerequisites, never a sum across
  converging paths. This is what prevents delays from compounding at a
  diamond shaped convergence point.
* Automatic cascade on regression. Moving a Done task backward to
  Review or In Progress recomputes readiness for every downstream task
  live, and any downstream task that was Done but whose prerequisite
  chain is no longer fully satisfied is moved back to Review, so the
  board never shows a Done task sitting on top of an unmet dependency.
* Blocked tasks cannot be dropped directly into Done. The client
  blocks the drop and shows an explanatory toast; see
  docs/architecture.md for the note on why this same rule should also be
  enforced server side before a production launch.
* AI dependency suggestions. A dialog calls OpenAI, grounded in the
  project's real task list and real existing dependencies, and returns
  structured suggestions with a reason and a confidence score. Every
  candidate is revalidated against real task ids and the real cycle check
  before it ever reaches the UI. Accepting a suggestion calls the exact
  same POST /api/projects/[projectId]/dependencies endpoint used for a
  manual dependency. Rejecting a suggestion makes no network call at all.
* Rate limiting. The AI suggestions endpoint is limited to 10 requests
  per minute per client IP, enforced server side.
* Multi project support. A projects list page lets a user create a new
  empty project and get a dedicated board and dependency graph for it. All
  data model, service, and API changes required to isolate one project's
  tasks and dependencies from another's are described in
  docs/architecture.md.
* Dependency graph view with critical path highlighting. A separate
  page renders the graph with React Flow, color coded by readiness and
  status, with the critical path (longest duration chain through the DAG)
  highlighted in red with animated edges.

## 6. How to verify the dependency engine (evaluator checklist)

The pure dependency engine lives entirely in lib/graph/ and has zero
imports from Prisma, Next.js, or any UI code. Every requirement below has
both an automated test and a way to see it live in the browser.

Requirement: Cycle detection, graph left untouched on rejection
  Automated test: cycleDetection tests in lib/graph/__tests__/graph.test.ts,
  plus the integration test in dependencyService.integration.test.ts
  Manual check: Try to add a dependency that would close a loop, confirm
  the toast and that nothing changed

Requirement: Diamond dependency, no compounding
  Automated test: propagation test in graph.test.ts, plus
  durationEdit.integration.test.ts against a real database
  Manual check: Edit the duration of a shared ancestor task (for example
  Backend API) and confirm every convergence point downstream (for
  example API Integration) shifts by the same delay exactly once

Requirement: Multi parent MAX propagation
  Automated test: same as above
  Manual check: Give two prerequisites different end dates and confirm
  the dependent's start date equals the later of the two, never their sum

Requirement: Rollback, multi step
  Automated test: readiness tests plus cascadeRegression.test.ts
  Manual check: Move a Done task back to In Progress and confirm every
  downstream task, including ones more than one step away, updates its
  readiness badge and, if it was Done, moves back to Review

Requirement: No dependency case
  Automated test: readiness tests
  Manual check: A task with no prerequisites always shows Ready
  regardless of anything else on the board

Requirement: Multiple prerequisites, all must be Done
  Automated test: readiness tests
  Manual check: A task with three prerequisites stays Blocked until the
  last one flips to Done

Requirement: Zero side effects on a rejected cycle
  Automated test: dependencyService.integration.test.ts, a real database test
  Manual check: Count dependency rows before and after a rejected cyclic
  request

Full details, including exactly which files hold which test, are in
docs/testing.md.

## 7. Security notes

* The OpenAI API key and both database connection strings live only in
  .env on the server. Nothing in app/api/ returns them, and no
  client component reads process.env for a secret value.
* Every API route validates its input with Zod before it reaches Prisma.
  Malformed requests return a 400 with a clear error message rather than
  reaching the database layer at all.
* Dependency creation validates that both tasks belong to the same
  project before running the cycle check, preventing a dependency from
  being created across two unrelated projects.
* AI suggestions are defensively revalidated after the model responds:
  every candidate's task ids are checked against the real task list, self
  references and duplicate or already existing edges are dropped, and each
  surviving candidate is run through the same pure cycle check used for a
  manual dependency, before the suggestion is ever shown to the user. A
  hallucinated or unsafe suggestion cannot reach the UI, let alone the
  database.
* The AI endpoint is rate limited server side to reduce abuse and control
  OpenAI cost exposure once deployed publicly.

## 8. Deployment notes

The application is a single Next.js app and deploys cleanly to any
platform that supports Next.js (for example Vercel) with the environment
variables listed in section 4 configured in that platform's dashboard.
The database is already cloud hosted on Neon, so no additional
infrastructure is required beyond the Next.js deployment itself.

One item worth flagging for a real production launch, not just this
prototype: the rate limiter described in section 5 is in memory and scoped
to a single running process. That is correct for one Next.js instance,
which is what this project intentionally uses, but it would need to move
to a shared store such as Upstash Redis if the app were ever horizontally
scaled across multiple instances. This tradeoff and its reasoning are
documented in docs/architecture.md.

## 9. Known limitations

* The client blocks dragging a Blocked task into Done, but this is
  currently a client side guard only. A direct API request could still
  set a Blocked task to Done. Adding the same check inside
  taskService.updateTask, returning a 409 the same way the cycle check
  does, would close this gap and is a natural next step.
* The rate limiter is per process and in memory, as noted above.
* React Flow's dependency graph view is read only. Editing a dependency
  from that view directly (rather than from the Add Dependency dialog) is
  not implemented.

## 10. Further documentation

* docs/architecture.md, the full system design, data model, and the
  reasoning behind every algorithmic choice in the dependency engine.
* docs/ai usage.md, disclosure of how AI was used both to build this
  project and inside the shipped product itself.
* docs/testing.md, the complete test suite, what each test proves, and
  how to run it.
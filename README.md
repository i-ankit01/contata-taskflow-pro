# TaskFlow Pro

> **[Live Demo](https://contata-taskflow-pro.vercel.app/)**

> A dependency-aware Kanban workflow tool for managing tasks, dependencies, and schedule propagation.

Unlike a standard Kanban board, tasks in TaskFlow Pro can depend on other tasks. A task is **Ready** only when every task it depends on is **Done**.

The backend maintains a **directed acyclic graph (DAG)** of tasks and dependencies and acts as the single source of truth for:

* Dependency validity
* Task readiness
* Schedule propagation
* Downstream delay calculation without compounding

An LLM (OpenAI) is used only to **suggest missing dependencies**. It never writes directly to the database. Every suggestion goes through the same cycle validation as a manually created dependency and requires explicit human approval before persistence.

Detailed documentation is available in the [Architecture](docs/architecture.md), [AI Usage](docs/ai-usage.md), and [Testing](docs/testing.md) documents.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Setup and Running Locally](#3-setup-and-running-locally)
4. [Environment Variables](#4-environment-variables)
5. [Core Features](#5-core-features)
6. [Dependency Engine — Evaluator Checklist](#6-dependency-engine--evaluator-checklist)
7. [Security](#7-security)
8. [Deployment](#8-deployment)
9. [Known Limitations](#9-known-limitations)
10. [Further Documentation](#10-further-documentation)

---

## 1. Tech Stack

| Technology        | Purpose                        |
| ----------------- | ------------------------------ |
| Next.js           | App Router + TypeScript        |
| Tailwind CSS      | Styling                        |
| shadcn/ui         | UI components                  |
| Prisma            | ORM                            |
| PostgreSQL / Neon | Database                       |
| dnd-kit           | Kanban drag and drop           |
| React Flow        | Dependency graph visualization |
| OpenAI            | Dependency suggestions         |
| Zod               | API request validation         |
| Vitest            | Automated testing              |

The project intentionally uses a simple architecture:

```text
One Next.js application
        ↓
   PostgreSQL database
```

No Redis, Kafka, background workers, or additional infrastructure is required.

See [Architecture](docs/architecture.md) for the reasoning behind this design.

---

## 2. Project Structure

```text
taskflow-pro/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── app/
│   ├── page.tsx
│   ├── projects/
│   │   └── [projectId]/
│   │       ├── page.tsx
│   │       └── dashboard/
│   │           └── page.tsx
│   │
│   └── api/
│       ├── projects/
│       │   └── route.ts
│       └── ...
│
├── components/
│   ├── kanban/
│   ├── tasks/
│   ├── dependencies/
│   ├── ai/
│   ├── graph/
│   └── projects/
│
├── hooks/
├── lib/
│   ├── graph/          # Pure dependency engine
│   ├── services/       # Prisma-backed services
│   ├── validations/    # Zod schemas
│   └── api-response.ts # Consistent API response shape
│
├── types/
│
├── docs/
│   ├── architecture.md
│   ├── ai-usage.md
│   └── testing.md
│
└── README.md
```

The dependency engine in `lib/graph/` is framework-agnostic and has no imports from Prisma, Next.js, or UI code.

---

## 3. Setup and Running Locally

### Requirements

* Node.js 18+
* A PostgreSQL database
* A Neon PostgreSQL project
* An OpenAI API key

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/i-ankit01/contata-taskflow-pro.git
cd taskflow-pro
npm install
```

Create a `.env` file in the project root using the variables in [Environment Variables](#4-environment-variables).

Run the database migration:

```bash
npx prisma migrate dev --name init
```

Seed the sample project:

```bash
npx prisma db seed
```

Run the test suite:

```bash
npm run test
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The application opens on the Projects page and includes a seeded sample project containing **10 tasks and 12 dependencies**.

---

## 4. Environment Variables

Create a `.env` file in the project root:

```env
# Neon PostgreSQL
DATABASE_URL="postgresql://user:password@host/db?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:password@host/db?sslmode=require"

# OpenAI
OPENAI_API_KEY="sk-..."
```

`DATABASE_URL` uses the pooled Neon connection, while `DIRECT_URL` is used for Prisma migrations.

The OpenAI API key is used only on the server and is never exposed to client components.

See [AI Usage](docs/ai-usage.md) for details about the AI integration and development-time AI usage.

---

## 5. Core Features

### Dependency-Aware Kanban

The board contains four workflow columns:

* **Backlog**
* **In Progress**
* **Review**
* **Done**

Drag-and-drop status changes are persisted through the task API.

### Derived Readiness

Readiness is **never stored in the database**.

It is computed from the current task statuses and dependency graph:

```text
All prerequisites are DONE
            ↓
          READY

Any prerequisite is not DONE
            ↓
         BLOCKED
```

Completed tasks are displayed as **Completed** rather than Ready.

### Cycle-Safe Dependency Creation

Before creating a dependency, the graph engine checks whether the new edge would introduce a cycle.

If a cycle would be created:

* The request is rejected.
* No dependency is persisted.
* The existing graph remains unchanged.

### Deterministic Schedule Propagation

When a task's duration changes, its schedule is recalculated and downstream tasks are propagated in **topological order**.

For a task with multiple prerequisites:

```text
startDate = MAX(prerequisite endDates)
endDate   = startDate + duration
```

This prevents delays from compounding at converging paths.

For example:

```text
       B
      / \
     /   \
    A     D
     \   /
      \ /
       C
```

A three-day delay to `A` shifts the downstream schedule by three days rather than adding the delay multiple times at the convergence point.

### Automatic Regression Handling

When a completed task is moved back to an incomplete state, readiness is recomputed for its downstream tasks.

Any downstream task whose prerequisite chain is no longer fully satisfied is updated according to the project's regression rules.

See [Architecture](docs/architecture.md) for the detailed behavior.

### Blocked Tasks Cannot Be Dropped Into Done

The client prevents a Blocked task from being dragged directly into the Done column and displays an explanatory message.

The corresponding server-side validation is documented as a production hardening step in [Architecture](docs/architecture.md).

### AI Dependency Suggestions

OpenAI receives the project's current task list and dependency graph and suggests **missing direct dependencies**.

AI suggestions:

* Use real task IDs.
* Cannot create dependencies directly.
* Cannot suggest self-dependencies.
* Cannot suggest existing dependencies.
* Cannot suggest transitive or redundant dependencies.
* Cannot introduce cycles.

Every suggestion is revalidated against the real task data and graph before being displayed.

The user must explicitly **Accept** a suggestion.

Accepted suggestions are sent through the same dependency API used for manually created dependencies.

Rejecting a suggestion makes no network request.

### Rate Limiting

The AI suggestions endpoint is limited to **10 requests per minute per client IP** using a server-side in-memory rate limiter.

### Multi-Project Support

Users can:

1. View existing projects.
2. Create a new project.
3. Open a project-specific Kanban board.
4. Manage tasks and dependencies independently.

Tasks and dependencies are isolated by project.

### Dependency Graph

A dedicated graph view uses React Flow to visualize:

* Dependency relationships
* Task status
* Task readiness
* Critical path

The critical path is highlighted visually within the DAG.

---

## 6. Dependency Engine — Evaluator Checklist

The pure dependency engine lives entirely in `lib/graph/` and has zero imports from Prisma, Next.js, or UI code.

Every major requirement has both automated and manual verification.

| Requirement                         | Automated Verification              | Manual Verification                                        |
| ----------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| Cycle detection                     | Cycle detection tests               | Try to create a dependency that closes a loop              |
| No side effects on rejected cycle   | Dependency service integration test | Confirm dependency count remains unchanged                 |
| Diamond dependency / no compounding | Propagation test                    | Delay a shared ancestor and inspect downstream dates       |
| Multi-parent MAX propagation        | Propagation test                    | Give prerequisites different end dates                     |
| Multi-step rollback                 | Readiness + regression tests        | Move a Done task backward and inspect downstream readiness |
| No dependency                       | Readiness tests                     | Task without prerequisites shows Ready                     |
| Multiple prerequisites              | Readiness tests                     | Task remains Blocked until all prerequisites are Done      |
| Zero side effects                   | Dependency service integration test | Compare dependency rows before and after rejection         |

### Cycle Detection

**Automated:**
`lib/graph/__tests__/graph.test.ts` and `dependencyService.integration.test.ts`

**Manual:**
Attempt to add a dependency that would close an existing loop.

Expected result:

```text
Request rejected
      ↓
Graph unchanged
      ↓
No dependency row added
```

### Diamond Dependency

**Automated:**
Propagation test and `durationEdit.integration.test.ts`

**Manual:**
Edit the duration of a shared ancestor such as `Backend API` and verify that downstream convergence points shift by the same delay exactly once.

### Multi-Parent MAX Propagation

**Manual:**
Give two prerequisites different end dates and verify:

```text
Dependent start date = later prerequisite end date
```

The dates must not be summed.

### Rollback

**Automated:**
Readiness tests and `cascadeRegression.test.ts`

**Manual:**
Move a Done task back to In Progress and verify that downstream tasks update their readiness correctly.

### No Dependencies

A task with no prerequisites should always be Ready.

### Multiple Prerequisites

A task with multiple prerequisites remains Blocked until **all** prerequisites are Done.

For the complete test suite, see [Testing](docs/testing.md).

---

## 7. Security

* Secrets are stored in environment variables and are not committed to the repository.
* The OpenAI API key is server-side only.
* API inputs are validated with Zod before reaching Prisma.
* Malformed requests are rejected before database operations.
* Dependency creation verifies that both tasks belong to the same project.
* AI responses are revalidated against the real task and dependency data.
* Invalid task IDs, self-dependencies, duplicate dependencies, existing dependencies, and cyclic edges are rejected before persistence.
* AI suggestions require explicit human approval before database persistence.
* The AI endpoint is rate limited to reduce abuse and unnecessary OpenAI costs.

---

## 8. Deployment

TaskFlow Pro is designed as a single Next.js deployment backed by PostgreSQL.

```text
User
  │
  ▼
Next.js Application
  │
  ▼
Prisma
  │
  ▼
Neon PostgreSQL
```

The application can be deployed to a Next.js-compatible platform such as Vercel.

Required environment variables should be configured in the deployment platform rather than committed to the repository.

### Scaling Considerations

The current implementation intentionally avoids additional infrastructure.

For a larger production deployment, possible next steps include:

* PostgreSQL indexing and connection pooling
* Horizontal scaling of stateless application instances
* Shared/distributed rate limiting
* Background processing for expensive AI workloads
* Caching for frequently accessed project data

These are future scaling options and are **not required by the current prototype**.

The current rate limiter is process-local. If the application is horizontally scaled, a shared store such as Redis would be required for consistent rate limiting across instances.

---

## 9. Known Limitations

* The client blocks dragging a Blocked task into Done, but this is currently a client-side guard. A direct API request could still set a Blocked task to Done. Server-side enforcement is a planned production hardening step.
* The rate limiter is currently process-local and stored in memory.
* The React Flow dependency graph is read-only. Dependency editing is performed through the Add Dependency dialog.
* Authentication, team permissions, and collaborative multi-user editing are outside the current scope.

---

## 10. Further Documentation

* **[Architecture](docs/architecture.md)**
  System design, data model, graph algorithms, schedule propagation, and architectural decisions.

* **[AI Usage](docs/ai-usage.md)**
  How AI is used inside TaskFlow Pro and how AI tools were used during development.

* **[Testing](docs/testing.md)**
  Test cases, test commands, and what each test verifies.

---

## Evaluation Highlights

TaskFlow Pro directly addresses the core technical challenges of dependency-aware workflow management:

* **DAG validation** prevents circular dependencies.
* **Derived readiness** prevents stale Ready/Blocked state.
* **Topological propagation** provides deterministic schedule updates.
* **MAX-based multi-parent scheduling** prevents diamond-path delay compounding.
* **AI suggestions remain human-controlled** and pass deterministic validation.
* **Pure graph logic** is separated from the database and UI layers.
* **Automated tests** cover the critical dependency and propagation scenarios.
* **Multi-project isolation** keeps project data independent.

# Testing

TaskFlow Pro treats testing of the dependency engine as a core project requirement.

This document describes:

* What is tested
* What each test proves
* How to run the test suite
* Which scenarios are verified against the real database
* How the application can be manually verified through the UI
* How API and AI failures are handled

---

## Table of Contents

1. [How to Run the Tests](#1-how-to-run-the-tests)
2. [Pure Function Tests](#2-pure-function-tests)
3. [Integration Tests](#3-integration-tests)
4. [Manual Verification Checklist](#4-manual-verification-checklist)
5. [Error Handling and Failure Behavior](#5-error-handling-and-failure-behavior)

---

## 1. How to Run the Tests

Run the complete test suite with:

```bash id="n1q1y9"
npm run test
```

The pure graph tests use **Vitest** and operate entirely on in-memory objects.

The integration tests require a valid `DATABASE_URL` pointing to the configured Neon PostgreSQL database because they exercise the actual Prisma service and transaction behavior.

### Test Categories

| Test Type           | Database Required | Purpose                                       |
| ------------------- | ----------------: | --------------------------------------------- |
| Pure graph tests    |                No | Validate dependency algorithms in isolation   |
| Integration tests   |               Yes | Validate service + Prisma + database behavior |
| Manual verification |       Running app | Verify end-to-end UI behavior                 |

---

## 2. Pure Function Tests

The dependency engine tests are located under:

```text id="n1ujv8"
lib/graph/__tests__/
```

These tests use plain in-memory objects and do not require a database connection.

### Cycle Detection

The test builds:

```text id="g9y8mb"
A → B → C
```

and attempts to add:

```text id="f0i9sh"
C → A
```

which would create a cycle.

The test verifies that:

* The operation is rejected with `CycleError`.
* The graph remains unchanged.
* The number of existing edges does not change.

A second test confirms that a valid non-cyclic dependency is accepted.

This verifies both **cycle detection** and **zero mutation on rejection** at the pure graph level.

---

### Readiness — No Dependency

A task with no prerequisites is always:

```text id="2r8j8x"
READY
```

This verifies the base readiness rule.

---

### Readiness — Single Prerequisite

For:

```text id="4a7x2g"
A → B
```

when `A` is not `DONE`:

```text id="8e0dtu"
B = BLOCKED
```

When `A` becomes `DONE`:

```text id="k1z4nb"
B = READY
```

When `A` becomes incomplete again, `B` becomes Blocked again.

The test repeatedly calls the same `getReadiness` function rather than using a separate rollback-specific readiness path.

This verifies that readiness is genuinely **derived state**.

---

### Diamond Dependency — No Compounding

The test constructs:

```text id="i6wz4u"
      B
     / \
    A   D
     \ /
      C
```

More precisely:

```text id="8k9j5n"
A → B → D
A → C → D
```

Each task initially has the same starting date and a two-day duration.

`A` is then delayed by three days.

The test verifies:

* `B` shifts by three days.
* `C` shifts by three days.
* `D` starts at the maximum of `B` and `C`'s new end dates.
* `D` shifts by three days, not six.

This directly tests the project's mandatory **no-compounding** requirement.

---

### Cascading Regression

`cascadeRegression.test.ts` contains five regression scenarios:

1. A Done task is correctly demoted when its prerequisite regresses.
2. A downstream task that is not Done is left unchanged.
3. A three-step chain cascades transitively in one pass.
4. A convergence point with two prerequisites is handled correctly when only one prerequisite regresses.
5. An unrelated Done chain remains untouched when a different part of the graph regresses.

These tests verify that regression handling is both **multi-level** and **properly scoped**.

---

### Critical Path

`criticalPath.test.ts` contains two tests.

#### Parallel branches

The test creates a diamond-shaped graph with branches of different total durations and verifies that the longer duration branch is selected as the critical path.

#### Linear chain

A simple linear dependency chain is expected to return the complete path in the correct order.

---

## 3. Integration Tests

Integration tests are located under:

```text id="7f8k7h"
lib/graph/__tests__/
├── dependencyService.integration.test.ts
└── durationEdit.integration.test.ts
```

Unlike the pure tests, these use the actual:

* Prisma client
* Service layer
* PostgreSQL database
* Transaction behavior

The tests create temporary rows in the configured Neon database and clean up the data they create afterward.

---

### Rejected Cycle — Zero Database Side Effects

The test creates a real chain:

```text id="l2qf72"
A → B → C
```

It then attempts to create:

```text id="u0f3vz"
C → A
```

The test verifies both:

```text id="0e3b6q"
CycleError is thrown
        +
Dependency row count is unchanged
```

This is important because it proves the cycle validation occurs **before the database write**, not merely inside the pure graph engine.

---

### Cross-Project Isolation

The test creates tasks belonging to different projects and attempts to create a dependency between them.

The operation must be rejected.

This verifies that a dependency cannot connect tasks belonging to unrelated projects.

---

### Duration Edit Propagation

A real diamond-shaped graph is created in the database.

The test then calls:

```text id="1j5r2v"
updateTask(...)
```

to increase the duration of one task by three days.

The test reads the resulting tasks back from the database and verifies the expected schedule.

This confirms that:

* Propagation occurs correctly.
* The no-compounding rule is preserved.
* The calculated dates are actually persisted.
* Prisma transaction behavior works correctly.

---

### Task Update Project Isolation

The test attempts to update a task using a different project ID from the one the task actually belongs to.

The operation is rejected instead of silently updating the wrong project's data.

This verifies project-level isolation in the task service.

---

## 4. Manual Verification Checklist

The following checklist mirrors the seeded demo flow and provides a final end-to-end verification of the running application.

### 1. Initial Readiness

Open the seeded project.

Verify:

```text id="3ibmqu"
Database Schema = not DONE
        ↓
Backend API = BLOCKED
```

### 2. Readiness Updates

Mark **Database Schema** as Done.

Verify:

```text id="rjkj2q"
Database Schema = DONE
        ↓
Backend API = READY
```

The readiness badge should update without a full page reload.

### 3. Regression

Move **Database Schema** back to In Progress.

Verify that:

* Backend API becomes Blocked.
* Downstream readiness is recalculated.
* Any downstream task that was Done and is affected by the regression is moved back according to the regression rules.

### 4. Cycle Rejection

Attempt to create a dependency that would close an existing loop.

Verify:

* The request is rejected.
* A rejection toast/message appears.
* The existing dependency graph remains unchanged.

### 5. Schedule Propagation

Edit the duration of **Requirements Gathering**.

Verify that the delay propagates through the downstream dependency chain.

Check both:

* Task card dates
* Dependency graph visualization

### 6. Diamond / No-Compounding Test

Edit **Backend API**, which is a shared ancestor of downstream tasks.

Verify that the convergence point:

```text id="6v4c4j"
Backend API
     │
     ├── Authentication
     │
     └── API Integration
```

shifts by the same delay rather than receiving the delay multiple times through different paths.

### 7. AI Suggestions

Open the **AI Suggestions** dialog.

Verify:

1. Suggestions are generated.
2. A suggestion displays its proposed dependency and reason.
3. Accepting a suggestion creates a real dependency.
4. Rejecting a suggestion does not make a network request.
5. The accepted dependency appears on the board/graph.

### 8. Critical Path

Open the dependency graph page.

Verify that:

* The dependency graph is displayed.
* Task status/readiness is represented correctly.
* The critical path is highlighted.
* The critical path updates after a duration change.

---

## 5. Error Handling and Failure Behavior

API routes use a consistent error response structure:

```ts id="m3h8sa"
{
  success: false,
  error: "..."
}
```

Expected HTTP status codes include:

| Status | Meaning                                                             |
| -----: | ------------------------------------------------------------------- |
|  `400` | Invalid request / Zod validation failure                            |
|  `404` | Resource does not exist or does not belong to the requested project |
|  `409` | Dependency would create a cycle                                     |
|  `429` | AI rate limit exceeded                                              |
|  `500` | Unexpected server error                                             |

This keeps API failure behavior predictable for the frontend.

### AI Failure Handling

The AI service also fails safely.

If the model response cannot be parsed or does not conform to the expected structured response:

```text id="73u4ha"
Invalid AI response
       ↓
Empty suggestion list
       ↓
"No suggestions"
```

The application therefore does not expose raw model output or an unhandled parsing exception to the user.

A malformed AI response degrades to an empty suggestion result rather than causing an unsafe database operation.

---

## Test Coverage Summary

The test suite covers the core correctness requirements:

| Area                                 | Coverage           |
| ------------------------------------ | ------------------ |
| Cycle detection                      | Pure + integration |
| Zero side effects on rejected cycles | Integration        |
| Derived readiness                    | Pure               |
| Multiple prerequisites               | Pure               |
| Multi-level regression               | Pure               |
| Diamond propagation                  | Pure + integration |
| MAX-based scheduling                 | Pure + integration |
| Critical path                        | Pure               |
| Project isolation                    | Integration        |
| Transactional persistence            | Integration        |
| AI failure handling                  | Service behavior   |
| API error handling                   | API behavior       |

For the architectural reasoning behind these behaviors, see the [Architecture](architecture.md) document.

For the complete project overview and evaluator checklist, see the [README](../README.md).

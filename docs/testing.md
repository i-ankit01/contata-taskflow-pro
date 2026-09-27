# Testing

This document lists every test in the codebase, what it proves, and how
to run the suite. Testing the dependency engine is treated as a mandatory,
graded requirement of this project, not an optional addition, per the
original problem statement, and every test below exists specifically to
satisfy one of those requirements.

## Table of contents

1. How to run the tests
2. Pure function tests, the dependency engine
3. Integration tests, the service and database layer
4. Manual verification checklist
5. Error handling and failure behavior

## 1. How to run the tests

npm run test

This runs every file under lib/graph/__tests__/ using Vitest. The
integration tests (see section 3) require a real DATABASE_URL pointing
at your Neon database, since they exercise the actual Prisma and
transaction behavior, not just the pure functions.

## 2. Pure function tests, the dependency engine

Located in lib/graph/__tests__/graph.test.ts,
cascadeRegression.test.ts, and criticalPath.test.ts. These use plain
in memory objects, no database connection required.

Cycle detection. Builds A -> B -> C (B depends on A, C depends on
B), then attempts to add A depends on C, which would close the loop.
Asserts the attempt is rejected with a CycleError, and separately
asserts graph.edges.length is unchanged after the rejected attempt,
proving the graph object itself was never mutated. A second test confirms
a genuinely valid, non cyclic edge is accepted without error.

Readiness, no dependency case. A task with no prerequisites always
returns READY.

Readiness, single prerequisite. A task with one prerequisite that is
not Done returns BLOCKED. Flipping that prerequisite to DONE and
rebuilding the graph flips the dependent to READY, and flipping the
prerequisite back re blocks the dependent, using nothing but repeated
calls to the same getReadiness function, proving readiness requires no
separate rollback code path of its own.

Diamond dependency, no compounding. Builds A -> B -> D and
A -> C -> D with equal starting dates and a two day duration on every
task. Delays A's end date by three days and runs propagateSchedule.
Asserts B's and C's end dates each shift by exactly three days, that
D's new start date equals the shared new end date of B and C (the
maximum, not the sum), and explicitly asserts D's new end date does not
equal what a six day, compounded shift would produce.

Cascading regression. Five tests in cascadeRegression.test.ts:
a single Done task correctly cascades to Review when its only
prerequisite regresses; a downstream task that is not currently Done is
left alone; a three step chain (A feeds B feeds C, both B and C Done)
cascades transitively in one pass; a convergence point with two
prerequisites, only one of which regressed, still correctly cascades; and
an entirely unrelated Done chain elsewhere in the graph is left untouched
by a regression in a different part of the graph.

Critical path. Two tests in criticalPath.test.ts confirm the longer
of two parallel branches in a diamond shaped graph is selected as the
critical path based on summed duration, and that a simple linear chain
returns its full path in order.

## 3. Integration tests, the service and database layer

Located in lib/graph/__tests__/dependencyService.integration.test.ts
and durationEdit.integration.test.ts. These create real rows in the
connected Neon database inside beforeAll, exercise the actual service
functions (createDependency, updateTask), and clean up everything they
created inside afterAll.

Zero side effects on a rejected cycle. Creates a real three task chain
in the database (A -> B -> C), counts the existing dependency rows,
attempts a cyclic createDependency call, and asserts both that the call
rejects with CycleError and that the dependency row count in the
database is completely unchanged afterward. This is what proves the cycle
check genuinely runs before any database write is attempted, at the
service layer, not only inside the pure function.

Cross project isolation. Creates a task in a second, unrelated
project and asserts that attempting to create a dependency between it and
a task in the first project is rejected.

Duration edit propagation, real database. Creates a real diamond
shaped graph of four tasks in the database, calls updateTask to
increase one task's duration by three days, then reads every task back
fresh from the database and asserts the same no compounding behavior
proven by the pure function test, but this time confirming the correct
values were actually persisted through a real Prisma transaction, not
just computed in memory.

Task update project isolation. Confirms updateTask rejects an
attempt to update a task that belongs to a different project than the one
specified, returning a clear error rather than silently succeeding.

## 4. Manual verification checklist

The following mirrors the demo flow and can be walked through directly in
the browser against the seeded sample project, as a final check that the
automated tests reflect what the running application actually does.

1. Load the seeded project. Confirm Backend API shows Blocked, since
   Database Schema has not been marked Done.
2. Mark Database Schema Done. Confirm Backend API becomes Ready without a
   page reload.
3. Move Database Schema back to In Progress. Confirm Backend API, and
   everything downstream of it that was Done, becomes Blocked again and
   any downstream Done task moves back to Review.
4. Attempt to create a dependency that would form a cycle. Confirm the
   rejection toast and that the graph is otherwise unchanged.
5. Edit Requirements Gathering's duration. Confirm the delay propagates
   downstream through the chain, visible both on task card dates and in
   the dependency graph view.
6. Edit Backend API's duration specifically, since it is a shared
   ancestor of both Authentication and API Integration. Confirm API
   Integration, the convergence point, shifts by the same delay, not
   double.
7. Open the AI Suggestions dialog, generate suggestions, accept one and
   confirm it appears on the board as a real dependency, reject another
   and confirm nothing about it is written anywhere.
8. Open the dependency graph page and confirm the critical path is
   highlighted correctly and updates after any duration edit.

## 5. Error handling and failure behavior

Every API route wraps its logic in a try and catch block and returns a
consistent { success: false, error } shape with an appropriate status
code rather than an unhandled server error: 400 for a Zod validation
failure, 404 for a resource that does not exist or does not belong to the
specified project, 409 for a rejected cyclic dependency, 429 for a rate
limited AI request, and 500 for anything unexpected. The AI service
specifically fails safe: if the model's response cannot be parsed as the
expected structured JSON, generateDependencySuggestions returns an
empty array rather than throwing, so a malformed model response degrades
to "no suggestions" in the UI instead of surfacing a raw error to the
user.
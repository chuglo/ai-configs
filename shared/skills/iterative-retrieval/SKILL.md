---
name: iterative-retrieval
description: Pattern for progressively refining context retrieval to solve the subagent context problem in {{PROJECT_NAME}}'s Go + Next.js codebase
---

# Iterative Retrieval Pattern

Solves the "context problem" in multi-agent workflows where subagents don't know what context they need until they start working.

## The Problem

Subagents are spawned with limited context. They don't know:
- Which files contain relevant code
- What patterns exist in the codebase
- What terminology the project uses (e.g., `handler` not `controller`, `store` not `repository`, `domain` not `service`)

Standard approaches fail:
- **Send everything**: Exceeds context limits
- **Send nothing**: Agent lacks critical information
- **Guess what's needed**: Often wrong

## The Solution: Iterative Retrieval

A 4-phase loop that progressively refines context:

```
+---------------------------------------------+
|                                             |
|   +----------+      +----------+            |
|   | DISPATCH |----->| EVALUATE |            |
|   +----------+      +----------+            |
|        ^                  |                 |
|        |                  v                 |
|   +----------+      +----------+            |
|   |   LOOP   |<-----+  REFINE  |            |
|   +----------+      +----------+            |
|                                             |
|        Max 3 cycles, then proceed           |
+---------------------------------------------+
```

### Phase 1: DISPATCH

Initial broad query to gather candidate files. Start with the domain-specific directories:

```
Go backend search order:
  1. internal/handler/     -- HTTP handlers by domain
  2. internal/domain/      -- Pure business logic
  3. internal/store/queries/ -- SQL queries (sqlc input)
  4. internal/worker/      -- Background job runner and handlers
  5. internal/middleware/   -- Auth, org context, rate limiting
  6. internal/server/      -- Routes, server setup

Frontend search order:
  1. web/src/app/          -- App Router pages
  2. web/src/components/   -- UI components by domain
  3. web/src/lib/          -- API client, types, validators
  4. web/src/hooks/        -- Custom React hooks
```

### Phase 2: EVALUATE

Assess retrieved content for relevance:

Scoring criteria:
- **High (0.8-1.0)**: Directly implements target functionality
- **Medium (0.5-0.7)**: Contains related patterns or types
- **Low (0.2-0.4)**: Tangentially related
- **None (0-0.2)**: Not relevant, exclude

### Phase 3: REFINE

Update search criteria based on evaluation:
- Add new patterns discovered in high-relevance files
- Add terminology found in codebase (project naming conventions)
- Exclude confirmed irrelevant paths
- Target specific gaps identified in evaluation

### Phase 4: LOOP

Repeat with refined criteria (max 3 cycles). Stop early if:
- 3+ files with relevance >= 0.7
- No critical context gaps remain

## Examples

### Example 1: Bug Fix in Status Transitions

```
Task: "Fix status transition validation"

Cycle 1:
  DISPATCH: Search "status", "transition" in internal/
  EVALUATE: Found domain/item.go (0.95), handler/items.go (0.8)
  REFINE: Need store queries for status updates

Cycle 2:
  DISPATCH: Search store/queries/ for status
  EVALUATE: Found queries/items.sql (0.9), store/sqlc/items.sql.go (0.7)
  REFINE: Sufficient context

Result: domain/item.go, handler/items.go, queries/items.sql
```

### Example 2: Adding a New API Endpoint

```
Task: "Add webhook management endpoints"

Cycle 1:
  DISPATCH: Search "webhook" in internal/
  EVALUATE: No existing webhook handler -- new feature
  REFINE: Look for similar handler patterns (team.go, items.go)

Cycle 2:
  DISPATCH: Read handler/team.go for CRUD pattern, middleware/auth.go for RBAC
  EVALUATE: Found handler pattern (0.9), RBAC check pattern (0.85)
  REFINE: Need router registration pattern

Cycle 3:
  DISPATCH: Read internal/server/ for route registration
  EVALUATE: Found server/routes.go (0.9)
  REFINE: Sufficient context

Result: handler/team.go (pattern), middleware/auth.go, server/routes.go
```

### Example 3: Frontend Feature

```
Task: "Add data export button"

Cycle 1:
  DISPATCH: Search "export" in web/src/
  EVALUATE: Found components/dashboard/ (0.9), app/(dashboard)/settings/ (0.8)
  REFINE: Need API client pattern for downloads

Cycle 2:
  DISPATCH: Search "export", "download" in web/src/lib/
  EVALUATE: Found lib/api.ts (0.85) -- has typed fetch wrapper
  REFINE: Sufficient context

Result: components/dashboard/, app/(dashboard)/settings/, lib/api.ts
```

## Integration with Agents

When retrieving context for a task:
1. Start with the relevant layer (handler -> domain -> store for backend; app -> components -> lib for frontend)
2. Evaluate each file's relevance (0-1 scale)
3. Identify what context is still missing
4. Refine search criteria and repeat (max 3 cycles)
5. Return files with relevance >= 0.7

## Terminology Map

Common terms agents should search for in a Go + Next.js + PostgreSQL project:
- **Handler** (not controller) -- HTTP request handling
- **Store/queries** (not repository) -- Database access
- **Domain** (not service) -- Business logic
- **Worker** (not job/task) -- Background processing via Postgres jobs table
- **Middleware** (not interceptor) -- HTTP middleware via Chi
- **Project** (not workspace) -- Top-level organizational entity
- **Item** (not record/entry) -- Core domain entity (adapt to your project)

## Best Practices

1. **Start broad, narrow progressively** -- Don't over-specify initial queries
2. **Learn codebase terminology** -- First cycle often reveals naming conventions
3. **Track what's missing** -- Explicit gap identification drives refinement
4. **Stop at "good enough"** -- 3 high-relevance files beats 10 mediocre ones
5. **Exclude confidently** -- Low-relevance files won't become relevant
6. **Never read generated files** -- Skip `internal/store/sqlc/` (read `queries/` instead) and `web/src/components/ui/` (shadcn/ui)

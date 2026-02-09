---
description: "Orchestrate multiple agents for complex cross-stack tasks. Usage: /orchestrate <task description>"
---

# Orchestrate Command

Coordinate multiple specialized agents for tasks that span Go backend, Next.js frontend, and PostgreSQL.

## When to Use

- Features touching all 3 layers (API + UI + DB)
- Large refactoring across backend and frontend
- Security-sensitive changes requiring review from multiple angles

## Orchestration Workflow

### Phase 1: Plan

Run `/plan` to generate competing architecture approaches:
- Explore codebase for existing patterns
- Generate 2-3 approaches (Minimal, Clean, Pragmatic) with trade-offs
- Present comparison table and recommendation
- **WAIT for user to pick an approach** before proceeding
- Expand chosen approach into detailed implementation steps with acceptance criteria

The plan will be saved to `.plans/YYYY-MM-DD-<feature-slug>.md` automatically. Note the file path — it will be referenced by reviewers in Phase 5 and serves as a permanent record of the architectural decision.

### Phase 2: Database

Use **build** agent (default) to write the database changes:
- Write goose migration(s) in `internal/store/migrations/`
- Write sqlc queries in `internal/store/queries/`
- Run `sqlc generate`
- Run `sqlc compile` to verify

Then invoke **database-reviewer** agent to review what was written:
- Verify schema design (types, constraints, indexes)
- Check multi-tenancy (organization_id on all tenant tables, RLS)
- Check query patterns (no SELECT *, no N+1, pagination)
- Use the **postgres** MCP to inspect the current schema and validate changes against the live dev database
- Flag any issues — fix them before proceeding

### Phase 3: Backend

Use **build** agent (default):
- Load the `golang-patterns` skill before writing Go code
- Implement Go handlers, domain logic, workers
- Run `go build ./...` and `golangci-lint run ./...` after changes
- Run `go test -race` on changed packages and fix any breakage

### Phase 4: Frontend

Use **build** agent (default):
- Load the `frontend-patterns` and `frontend-design` skills before writing frontend code
- Implement TypeScript types, API client, query factories, components, pages
- Scaffold `error.tsx` and `loading.tsx` for new routes
- Run `cd web && npm run build` and `cd web && npx eslint .` after changes
- Run tests on changed components and fix any breakage

Invoke **build-fixer** agent (if errors):
- Fix any Go or TypeScript/Next.js build errors

### — Checkpoint —

**STOP and present a summary to the user:**

```
Implementation complete. Here's what was built:

Database: [tables/columns added, queries written]
Backend:  [handlers, domain functions, routes added]
Frontend: [pages, components, query factories added]
Files:    [count] new, [count] modified

Build: passing
Lint:  passing
Tests: existing tests passing

Ready for review and test generation? Or want to adjust anything first?
```

**WAIT for user confirmation before proceeding.**

### Phase 5: Review Battle

Run `/review-battle` with the plan context. When dispatching reviewers, include this preamble:

> **Feature context:** [read the saved plan from `.plans/` — what was being built, which approach was chosen, and why]

This lets reviewers flag architectural mismatches, not just generic code quality issues.

The review battle dispatches two competing go-reviewers + the security-reviewer, all told they're being graded. The **review-coach** grades all three on thoroughness, accuracy, and actionability, declares a winner, and synthesizes the best findings into a single final review.

**If the synthesized review contains CRITICAL or HIGH issues:**

1. Present the issues to the user
2. Fix them (re-run the relevant build phase — Phase 2 for DB, Phase 3 for backend, Phase 4 for frontend)
3. Re-run build + lint + existing tests on the fixed code
4. **Do NOT re-run the full review battle** — just verify the fixes compile and pass

### Phase 6: Test

Invoke **tdd-guide** agent:
- Go table-driven tests for new backend logic (handlers, domain functions)
- Frontend component tests for new UI

Invoke **e2e-runner** agent:
- Playwright tests for critical user flows affected by the change

Tests are written against the reviewed, final code — not a draft that might change.

### Phase 7: Verify

Run `/verify full` to ensure everything passes:
- Go: build, golangci-lint, tests with race detector
- Frontend: build (includes type checking), ESLint, tests
- Debug audit (no stray console.log/fmt.Println)
- Git status summary

## Available Agents for Orchestration

| Agent | Phase | Role |
|-------|-------|------|
| plan | 1 | Competing approaches, detailed implementation plan |
| build | 2-4 | Write code (loads skills, runs build + lint + tests) |
| database-reviewer | 2 | Review migrations, queries, indexes, RLS |
| go-build-resolver | 3 | Fix Go compilation errors |
| build-fixer | 3-4 | Fix Go and/or TypeScript build errors |
| go-reviewer (x2) | 5 | Competing Go-focused reviews |
| security-reviewer | 5 | OWASP, auth, tenant isolation |
| review-coach | 5 | Grade all three, synthesize final review |
| tdd-guide | 6 | Generate tests, enforce 80%+ coverage |
| e2e-runner | 6 | Playwright E2E tests |

## MCP Servers Used

| MCP | Phase | Purpose |
|-----|-------|---------|
| postgres | 2 | Inspect dev schema, test queries, verify RLS |
| context7 | 3-4 | Look up library docs when needed |

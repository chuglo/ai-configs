# {{PROJECT_NAME}} — Claude Code Configuration

You are the primary development agent for {{PROJECT_NAME}}.

**Stack:** Go 1.25+ (Chi, sqlc, goose) + Next.js 16 (React 19, TypeScript, shadcn/ui, TanStack Query) + PostgreSQL 16+

Refer to INSTRUCTIONS.md (in the project root or `.claude/`) for project structure, conventions, and coding standards. Follow all rules there strictly — especially multi-tenancy isolation, generated file restrictions, and enterprise code boundaries.

## Skill Loading

Before writing code, read the relevant skill files for the stack you're working in:

- **Go code**: Read `.claude/skills/golang-patterns/SKILL.md`
- **Frontend code**: Read `.claude/skills/frontend-patterns/SKILL.md` AND `.claude/skills/frontend-design/SKILL.md`
- **Database changes**: Read `.claude/skills/postgres-patterns/SKILL.md`
- **Testing**: Read `.claude/skills/golang-testing/SKILL.md` or `.claude/skills/tdd-workflow/SKILL.md`
- **Security**: Read `.claude/skills/security-review/SKILL.md`

Read skills once at the start of a task, not before every file edit.

## Writing Code

- Go: handler -> domain -> store layering, sqlc for queries, zerolog for logging
- Go: write godoc comments on all exported symbols
- Frontend: TanStack Query for server state, zod for validation, shadcn/ui components
- Frontend: use `queryOptions()` factories in `web/src/lib/queries/` (not inline query keys)
- Frontend: when creating new routes, always scaffold `error.tsx` and `loading.tsx` files
- Frontend: wrap data-fetching regions with error boundaries
- Always verify changes after writing code (see Post-Change Verification below)

## Post-Change Verification

After making changes, run the appropriate checks based on what was modified:

### Go changes (any `.go` file modified)
1. `go build ./...` — must compile
2. `golangci-lint run ./...` — must pass

### Frontend changes (any `.ts`/`.tsx` file modified)
1. `cd web && npm run build` — must compile
2. `cd web && npx eslint .` — must pass

### Both changed
Run all four checks.

Fix any errors or warnings before considering the task complete.

### Existing tests

After build and lint pass, run existing tests for the packages you modified:

- **Go**: `go test -race ./internal/path/to/changed/package/...`
- **Frontend**: `cd web && npx vitest run --reporter=verbose`

If any existing tests break due to your changes, **fix them**.

### Test coverage reminder

After completing a task that adds new logic, remind the user:

> New logic was added. Consider running `/tdd` to generate unit/component tests for coverage, and `/e2e` for critical user flows.

## Critical Rules

### Do NOT Edit Generated Files
- `internal/store/sqlc/` — Edit `internal/store/queries/*.sql` instead, then run `sqlc generate`
- `web/src/components/ui/` — Modify via shadcn CLI, not by hand

### Multi-Tenancy
- ALWAYS derive `organization_id` from session context, NEVER from request body
- Every database query on tenant data MUST filter by `organization_id`

### Enterprise Code
- Enterprise features live in `/ee`, gated by `//go:build enterprise`
- Never import `/ee` from `/internal`

## Session Notes

At logical workflow boundaries, suggest running `/session-notes` to capture session state.

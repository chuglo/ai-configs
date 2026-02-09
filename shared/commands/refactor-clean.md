---
description: Remove dead code and consolidate duplicates across Go and TypeScript.
---

# Refactor Clean

1. Run detection tools:
   - Go: `golangci-lint run ./...` (includes govet, staticcheck, unused, and 24 more)
   - Frontend: `cd web && npx knip`, `cd web && npx depcheck`

2. Categorize by risk:
   - **SAFE**: Unused utilities, unused components, dead imports
   - **CAUTION**: Handlers, API routes, store functions
   - **DANGER**: Config files, migration files, enterprise stubs

3. For each safe deletion:
   - Run `go test ./...` and `cd web && npm test`
   - Apply change
   - Re-run tests
   - Rollback if tests fail

4. Post-cleanup:
   - `go mod tidy`
   - `cd web && npm prune`

5. Show summary of removed items.

NEVER delete migration files or sqlc generated code.

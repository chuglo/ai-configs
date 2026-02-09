---
description: Fix Go build, vet, and compilation errors with minimal changes.
---

# Go Build Fix

1. Run: `go build ./...`

2. For each error:
   - Parse error message
   - Read affected file
   - Apply minimal fix
   - Re-run build

4. Special cases:
   - sqlc errors: fix SQL in `internal/store/queries/`, run `sqlc generate`
   - Enterprise build: check `//go:build` tags
   - Module errors: `go mod tidy`

4. Verification:
```bash
go build ./...          # Must succeed
golangci-lint run ./... # No issues (includes govet)
go test ./...           # Tests pass
```

Fix errors only. No refactoring. Minimal changes.

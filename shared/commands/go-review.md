---
description: Go code review for idiomatic patterns, concurrency, and performance.
---

# Go Review

Invokes the **go-reviewer** agent.

1. Analyze Go code changes: `git diff -- '*.go'`
2. Run: `golangci-lint run ./...` (includes govet, staticcheck, and 25 more)

## Review Checklist

- [ ] Idiomatic Go (naming, early returns, error handling)
- [ ] Error handling (wrapped, not ignored)
- [ ] Concurrency (no goroutine leaks, proper context)
- [ ] Performance (no N+1, pre-allocated slices)
- [ ] Security (org_id filtering, input validation)
- [ ] Tests (table-driven, race detector)

## Report Format

```
[SEVERITY] Issue
File: path:line
Issue: Description
Fix: How to resolve
```

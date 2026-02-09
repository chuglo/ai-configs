---
description: Analyze test coverage across Go backend and Next.js frontend.
---

# Test Coverage

Invokes the **tdd-guide** agent for coverage analysis.

## Go Coverage

```bash
# Generate coverage report
go test -coverprofile=coverage.out ./...

# View summary
go tool cover -func=coverage.out

# View HTML report
go tool cover -html=coverage.out -o coverage.html

# Coverage by package
go test -cover ./internal/domain/...
go test -cover ./internal/handler/...
go test -cover ./internal/worker/...
```

## Frontend Coverage

```bash
cd web && npm test -- --coverage
```

## Coverage Requirements

| Area | Minimum | Target |
|------|---------|--------|
| Overall | 80% | 90% |
| `internal/domain/` (business logic, RBAC) | **100%** | 100% |
| `internal/handler/` (HTTP handlers) | 80% | 90% |
| `internal/worker/` (background jobs) | 70% | 80% |
| `web/src/lib/` (API client, validators) | 80% | 90% |
| `web/src/components/` | 60% | 80% |

## Analysis

1. Run coverage for both Go and frontend
2. Identify uncovered files and functions
3. Prioritize: security-critical code (auth, RBAC, tenant isolation) must be at 100%
4. Generate a report with gaps and recommended test additions

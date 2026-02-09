---
description: Enforce TDD workflow with 80%+ test coverage across Go and TypeScript.
---

# TDD Command

Invokes the **tdd-guide** agent.

## TDD Cycle

```
RED -> GREEN -> REFACTOR -> REPEAT
```

1. **RED**: Write failing test first
2. **GREEN**: Minimal implementation to pass
3. **REFACTOR**: Improve code, tests stay green
4. **VERIFY**: Coverage 80%+

## Go Tests

```bash
go test -v ./...                    # Run tests
go test -race ./...                 # Race detector
go test -cover ./...                # Coverage
go test -coverprofile=c.out ./... && go tool cover -html=c.out
```

## Frontend Tests

```bash
cd web && npm test                  # Unit/component tests
cd web && npm test -- --coverage    # With coverage
```

## Coverage Requirements

- **80% minimum** for all code
- **100% required** for: RBAC logic, status transitions, auth handlers, input validation

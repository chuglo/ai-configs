---
name: tdd-workflow
description: TDD methodology for {{PROJECT_NAME}}. Red-Green-Refactor cycle, 80%+ coverage, Go table-driven tests, React Testing Library patterns, fuzz testing. Use when writing new features, fixing bugs, or adding test coverage.
allowed-tools: Bash(go test *) Bash(npx vitest *) Bash(npx playwright *)
compatibility: Go 1.25+, Vitest, React Testing Library, Playwright
---

# TDD Workflow for {{PROJECT_NAME}}

## When to Activate

- Writing new features or functionality
- Fixing bugs
- Refactoring existing code
- Adding API endpoints or components

## Core Principles

### 1. Tests BEFORE Code
ALWAYS write tests first, then implement to make them pass.

### 2. Coverage Requirements
- Minimum 80% overall (unit + integration)
- 100% for auth/RBAC logic
- 100% for status transitions
- All error paths tested
- All edge cases covered

### 3. RED -> GREEN -> REFACTOR
```
RED     -> Write a failing test
GREEN   -> Write minimal code to pass
REFACTOR -> Improve code, keep tests green
```

## Go TDD Steps

### Step 1: Define Interface
```go
type ItemStore interface {
    GetItem(ctx context.Context, orgID, id uuid.UUID) (*Item, error)
    CreateItem(ctx context.Context, params CreateItemParams) (*Item, error)
}

// Compile-time verification
var _ ItemStore = (*MockStore)(nil)
```

### Step 2: Write Failing Test (RED)
```go
func TestGetItem_NotFound(t *testing.T) {
    store := &MockStore{
        GetItemFunc: func(ctx context.Context, orgID, id uuid.UUID) (*Item, error) {
            return nil, sql.ErrNoRows
        },
    }
    handler := NewItemHandler(store)

    req := httptest.NewRequest("GET", "/api/v1/items/"+testID.String(), nil)
    ctx := context.WithValue(req.Context(), orgContextKey, testOrgID)
    req = req.WithContext(ctx)
    w := httptest.NewRecorder()

    handler.GetItem(w, req)

    require.Equal(t, http.StatusNotFound, w.Code)
}
```

### Step 3: Minimal Implementation (GREEN)
```go
func (h *ItemHandler) GetItem(w http.ResponseWriter, r *http.Request) {
    // Minimal code to pass the test
}
```

### Step 4: Refactor (IMPROVE)
Improve code quality while keeping tests green.

### Step 5: Verify Coverage
```bash
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out
```

## Go Test Patterns

### Table-Driven Tests (Mandatory)
```go
func TestValidateItem(t *testing.T) {
    tests := []struct {
        name    string
        input   CreateItemRequest
        wantErr bool
    }{
        {name: "valid item", input: validItem(), wantErr: false},
        {name: "missing title", input: itemWithout("title"), wantErr: true},
        {name: "title too long", input: itemWithTitle(strings.Repeat("a", 256)), wantErr: true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := Validate(tt.input)
            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

### Error Path Testing
```go
func TestGetItem_Errors(t *testing.T) {
    tests := []struct {
        name       string
        storeErr   error
        wantStatus int
    }{
        {name: "not found", storeErr: sql.ErrNoRows, wantStatus: http.StatusNotFound},
        {name: "internal error", storeErr: errors.New("db down"), wantStatus: http.StatusInternalServerError},
        {name: "context cancelled", storeErr: context.Canceled, wantStatus: http.StatusInternalServerError},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            store := &MockStore{
                GetItemFunc: func(ctx context.Context, orgID, id uuid.UUID) (*Item, error) {
                    return nil, tt.storeErr
                },
            }
            // ... setup and assert
        })
    }
}
```

### Fuzz Testing for Parsers/Validators
```go
func FuzzValidateTitle(f *testing.F) {
    f.Add("Valid Title")
    f.Add("")
    f.Add(strings.Repeat("a", 1000))

    f.Fuzz(func(t *testing.T, title string) {
        err := ValidateTitle(title)
        // Should never panic, regardless of input
        if len(title) == 0 || len(title) > 255 {
            assert.Error(t, err)
        }
    })
}
```

### Benchmark for Performance-Critical Code
```go
func BenchmarkCanTransition(b *testing.B) {
    b.ReportAllocs()
    for i := 0; i < b.N; i++ {
        CanTransition(StatusActive, StatusPending)
    }
}
```

## Frontend TDD Steps

### Component Test (React Testing Library)
```typescript
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

test('renders correct status color for critical', () => {
    render(<StatusBadge status="critical" />)
    expect(screen.getByText('critical')).toHaveClass('bg-red-500')
})

test('renders correct status color for low', () => {
    render(<StatusBadge status="low" />)
    expect(screen.getByText('low')).toHaveClass('bg-blue-500')
})
```

### API Hook Test (TanStack Query)
```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useItems } from './useItems'

test('fetches items successfully', async () => {
    const { result } = renderHook(() => useItems(), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(5)
})
```

## Test Commands

```bash
# Go
go test ./...                    # All tests
go test -race ./...              # Race detector (always in CI)
go test -cover ./...             # Coverage summary
go test -short ./...             # Skip integration
go test -fuzz=FuzzName -fuzztime=30s  # Fuzz testing
go test -bench=. -benchmem      # Benchmarks

# Frontend
cd web && npx vitest run         # All tests
cd web && npx vitest run --coverage  # With coverage
cd web && npx playwright test    # E2E
```

## What MUST Be Tested

- Status transitions (100%)
- RBAC permission checks (100%)
- Input validation (Go validator + Zod)
- HTTP handler responses (all status codes)
- Multi-tenant isolation (cross-org access denied)
- File upload validation (type, size, content)
- API client functions
- Form validation
- Error paths (not just happy path)

## Design-for-Testability

1. **Accept interfaces, return structs** — makes mocking easy
2. **Inject dependencies** — pass deps via constructors, not package globals
3. **Inject `time.Now`** — use `func() time.Time` field for deterministic tests
4. **Small interfaces at the consumer** — 1-3 methods, defined where used
5. **Compile-time verification**: `var _ Interface = (*Impl)(nil)`
6. **Use `context.Context`** — enables timeout/cancellation in tests
7. **Return errors, don't panic** — tests can use `require.NoError`, not `recover()`

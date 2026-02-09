---
name: golang-testing
description: Go testing patterns for {{PROJECT_NAME}}. Table-driven tests, HTTP handler testing with Chi, sqlc mock patterns, coverage targets, fuzz testing, benchmarks. Use when writing Go tests, adding coverage, or following TDD workflow.
allowed-tools: Bash(go test *)
compatibility: Go 1.25+, testify, go-cmp
---

# Go Testing Patterns for {{PROJECT_NAME}}

## When to Activate

- Writing new Go functions or methods
- Adding test coverage to existing code
- Following TDD workflow
- Testing Chi handlers, domain logic, or sqlc queries

## TDD Cycle

```
RED     -> Write a failing test first
GREEN   -> Write minimal code to pass
REFACTOR -> Improve while keeping tests green
```

## Table-Driven Tests (Mandatory)

```go
func TestCanTransition(t *testing.T) {
    tests := []struct {
        name string
        from Status
        to   Status
        want bool
    }{
        {name: "active to pending", from: StatusActive, to: StatusPending, want: true},
        {name: "active to archived", from: StatusActive, to: StatusArchived, want: false},
        {name: "pending to active", from: StatusPending, to: StatusActive, want: true},
        {name: "archived to active", from: StatusArchived, to: StatusActive, want: true},
        {name: "pending to archived", from: StatusPending, to: StatusArchived, want: false},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := CanTransition(tt.from, tt.to)
            if got != tt.want {
                t.Errorf("CanTransition(%s, %s) = %v, want %v",
                    tt.from, tt.to, got, tt.want)
            }
        })
    }
}
```

### Table-Driven Test Rules

1. **Always use `t.Run()` with subtests** — enables `-run` filtering, parallel execution, and independent failure reporting
2. **Always include a `name` field** — describe the *scenario*, not the expected result
3. **Use named struct fields** — `{name: "x", from: StatusActive}` not `{"x", StatusActive, ...}`
4. **Omit zero-value fields** that aren't relevant — highlights what's different about each case
5. **Use `cmp.Diff()` for complex comparisons** — not `reflect.DeepEqual`

### Using cmp.Diff for Structs
```go
import "github.com/google/go-cmp/cmp"

if diff := cmp.Diff(want, got); diff != "" {
    t.Errorf("GetItem() mismatch (-want +got):\n%s", diff)
}
```

### Parallel Table Tests (Go 1.22+)
```go
for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
        t.Parallel()
        // No need for `tt := tt` in Go 1.22+
        got := fn(tt.input)
        if got != tt.want {
            t.Errorf("fn(%v) = %v, want %v", tt.input, got, tt.want)
        }
    })
}
```

## Error Message Format

Error messages must be self-sufficient — include function name, inputs, got, and want:

```go
// GOOD: contains all context needed to debug
t.Errorf("Split(%q, %q) = %v, want %v", tt.input, tt.sep, got, tt.want)
t.Errorf("Validate(%v) error = %v, wantErr %v", tt.input, err, tt.wantErr)
t.Errorf("CreateUser() mismatch (-want +got):\n%s", diff)

// BAD: useless on failure
t.Error("test failed")
t.Errorf("got wrong result")
t.Errorf("expected X but got Y") // use got/want terminology
```

Use `got`/`want` terminology consistently (Go standard).

## Assertion Patterns

### require vs assert (testify)
```go
// require: stops test immediately — use for preconditions/setup
user, err := createUser(input)
require.NoError(t, err)       // if this fails, no point continuing
require.NotNil(t, user)

// assert: continues on failure — use for the actual assertions
assert.Equal(t, "expected_name", user.Name)
assert.Equal(t, "expected_email", user.Email)
```

### Common Testify Anti-Patterns
```go
// BAD: poor failure messages
assert.True(t, a == b)         // use assert.Equal(t, a, b)
assert.True(t, err == nil)     // use assert.NoError(t, err)
assert.True(t, obj != nil)     // use assert.NotNil(t, obj)

// BAD: wrong argument order (expected, actual)
assert.Equal(t, got, want)     // WRONG! It's assert.Equal(t, want, got)

// BAD: assert for error checks when subsequent code depends on no error
assert.NoError(t, err)         // use require.NoError(t, err)
result.DoSomething()           // panics if err was non-nil

// BAD: asserting on error strings (fragile)
assert.EqualError(t, err, "connection refused")  // breaks on rewording
// GOOD: use errors.Is
assert.ErrorIs(t, err, ErrConnectionFailed)
```

## RBAC Tests (100% Coverage Required)

```go
func TestHasPermission(t *testing.T) {
    tests := []struct {
        name string
        role Role
        perm Permission
        want bool
    }{
        {name: "owner can delete org", role: RoleOwner, perm: PermDeleteOrg, want: true},
        {name: "admin cannot delete org", role: RoleAdmin, perm: PermDeleteOrg, want: false},
        {name: "editor can edit items", role: RoleEditor, perm: PermEditItems, want: true},
        {name: "viewer cannot edit items", role: RoleViewer, perm: PermEditItems, want: false},
        {name: "viewer can view items", role: RoleViewer, perm: PermViewItems, want: true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := HasPermission(tt.role, tt.perm)
            if got != tt.want {
                t.Errorf("HasPermission(%s, %s) = %v, want %v",
                    tt.role, tt.perm, got, tt.want)
            }
        })
    }
}
```

## HTTP Handler Tests (Chi)

```go
func TestGetItem(t *testing.T) {
    store := NewMockStore()
    store.GetItemFunc = func(ctx context.Context, orgID, id uuid.UUID) (*Item, error) {
        return &Item{ID: id, Title: "Test Item"}, nil
    }

    handler := NewItemHandler(store)
    r := chi.NewRouter()
    r.Get("/api/v1/items/{id}", handler.GetItem)

    req := httptest.NewRequest("GET", "/api/v1/items/"+testItemID.String(), nil)
    ctx := context.WithValue(req.Context(), orgContextKey, testOrgID)
    req = req.WithContext(ctx)
    w := httptest.NewRecorder()

    r.ServeHTTP(w, req)

    resp := w.Result()
    defer resp.Body.Close()

    require.Equal(t, http.StatusOK, resp.StatusCode)

    var item Item
    err := json.NewDecoder(resp.Body).Decode(&item)
    require.NoError(t, err)
    assert.Equal(t, "Test Item", item.Title)
}
```

## Interface-Based Mocking

```go
// Define mock for store interface
type MockStore struct {
    GetItemFunc    func(ctx context.Context, orgID, id uuid.UUID) (*Item, error)
    ListItemsFunc  func(ctx context.Context, orgID uuid.UUID, limit, offset int) ([]*Item, error)
    CreateItemFunc func(ctx context.Context, params CreateItemParams) (*Item, error)
}

func (m *MockStore) GetItem(ctx context.Context, orgID, id uuid.UUID) (*Item, error) {
    return m.GetItemFunc(ctx, orgID, id)
}

// Compile-time verification
var _ ItemStore = (*MockStore)(nil)
```

### Mocking Rules
- **Prefer hand-written mocks** for interfaces with 1-3 methods
- **Use gomock/mockery** for interfaces with many methods
- **Mock at the boundary**, not deep in the call stack
- **Never mock what you don't own** — wrap external dependencies in your own interface first

## Integration Tests (with Test DB)

```go
func TestCreateItem_Integration(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }
    db := setupTestDB(t)

    store := NewStore(db)
    // Test against real PostgreSQL
}

func setupTestDB(t *testing.T) *pgxpool.Pool {
    t.Helper()
    dsn := os.Getenv("TEST_DATABASE_URL")
    if dsn == "" {
        t.Skip("TEST_DATABASE_URL not set")
    }
    pool, err := pgxpool.New(context.Background(), dsn)
    if err != nil {
        t.Fatalf("connect to test db: %v", err)
    }
    t.Cleanup(func() { pool.Close() })
    return pool
}
```

## Test Helper Functions

```go
// Always mark helpers with t.Helper()
func createTestUser(t *testing.T, name string) *User {
    t.Helper()
    user, err := NewUser(name)
    require.NoError(t, err)
    return user
}

// Use t.Cleanup() for resource cleanup (not defer)
func setupTestDB(t *testing.T) *sql.DB {
    t.Helper()
    db, err := sql.Open("postgres", testDSN)
    require.NoError(t, err)
    t.Cleanup(func() { db.Close() })
    return db
}

// Use t.TempDir() for temporary directories (auto-cleaned)
func TestWriteFile(t *testing.T) {
    dir := t.TempDir()
    path := filepath.Join(dir, "output.txt")
    // dir is automatically removed after test completes
}

// Use t.Setenv() for environment variables (auto-restored)
func TestConfig(t *testing.T) {
    t.Setenv("DATABASE_URL", "postgres://test:test@localhost/test")
    cfg := LoadConfig()
    // env var is restored after test
}
```

## Fuzz Testing (Go 1.18+)

Use fuzz testing for parsers, validators, and any function that processes untrusted input:

```go
func FuzzParseItem(f *testing.F) {
    // Seed corpus with representative inputs
    f.Add([]byte(`{"id": "1", "status": "active"}`))
    f.Add([]byte(`{}`))
    f.Add([]byte(`invalid`))

    f.Fuzz(func(t *testing.T, data []byte) {
        item, err := ParseItem(data)
        if err != nil {
            return // Invalid input, not a bug
        }
        // Test properties/invariants, not specific outputs
        // Round-trip: marshal then unmarshal should be equal
        encoded, err := json.Marshal(item)
        require.NoError(t, err)

        item2, err := ParseItem(encoded)
        require.NoError(t, err)
        assert.Equal(t, item, item2)
    })
}
```

Rules:
- Fuzz targets must be fast and deterministic
- Use `return` for invalid inputs, not `t.Fatal()`
- Test properties (round-trips, invariants), not specific outputs
- Run with: `go test -fuzz=FuzzParseItem -fuzztime=30s`

## Benchmark Testing

```go
func BenchmarkProcess(b *testing.B) {
    data := generateTestData()
    b.ResetTimer()
    b.ReportAllocs()

    for i := 0; i < b.N; i++ {
        result := Process(data)
        _ = result // prevent compiler optimization
    }
}

// Table-driven benchmarks for different sizes
func BenchmarkSort(b *testing.B) {
    for _, size := range []int{10, 100, 1000, 10000} {
        b.Run(fmt.Sprintf("size=%d", size), func(b *testing.B) {
            data := generateData(size)
            b.ResetTimer()
            for i := 0; i < b.N; i++ {
                sort.Ints(data)
            }
        })
    }
}
```

Run with: `go test -bench=. -benchmem`

## Golden File / Snapshot Testing

```go
var update = flag.Bool("update", false, "update golden files")

func TestRender(t *testing.T) {
    got := Render(input)

    golden := filepath.Join("testdata", t.Name()+".golden")
    if *update {
        os.WriteFile(golden, []byte(got), 0644)
    }

    want, err := os.ReadFile(golden)
    require.NoError(t, err)

    if diff := cmp.Diff(string(want), got); diff != "" {
        t.Errorf("Render() mismatch (-want +got):\n%s", diff)
    }
}
```

Rules:
- Store golden files in `testdata/` (ignored by Go tooling)
- Use `-update` flag to regenerate: `go test -run TestRender -update`
- Commit golden files to version control

## Testing Goroutines

### Never Call t.Fatal from a Non-Test Goroutine
```go
// BAD: t.Fatal from goroutine panics (runtime.Goexit in wrong goroutine)
go func() {
    if err := engine.Vroom(); err != nil {
        t.Fatalf("No vroom: %v", err) // PANICS
    }
}()

// GOOD: use t.Errorf + return from goroutine
go func() {
    defer wg.Done()
    if err := engine.Vroom(); err != nil {
        t.Errorf("No vroom: %v", err) // safe
        return
    }
}()
```

### Test Helpers Should t.Fatal, Not Return Errors
```go
// GOOD: setup helper kills test on failure
func mustCreateUser(t *testing.T, name string) *User {
    t.Helper()
    user, err := NewUser(name)
    if err != nil {
        t.Fatalf("create user %q: %v", name, err)
    }
    return user
}

// BAD: forces every caller to check error
func createUser(t *testing.T, name string) (*User, error) { ... }
```

## Goroutine Leak Detection

Use `go.uber.org/goleak` to detect goroutine leaks in tests:

```go
func TestMain(m *testing.M) {
    goleak.VerifyTestMain(m)
}

// Or per-test:
func TestNoLeak(t *testing.T) {
    defer goleak.VerifyNone(t)
    // ... test code
}
```

## Coverage Targets

| Code Area | Target |
|-----------|--------|
| Auth/RBAC (domain/rbac.go) | 100% |
| Status transitions | 100% |
| Domain logic | 80%+ |
| HTTP handlers | 80%+ |
| Store layer | Integration tests |
| Generated code (sqlc) | Exclude |

## Test Commands

```bash
go test ./...                           # All tests
go test -race ./...                     # Race detector (always in CI)
go test -cover ./...                    # Coverage summary
go test -coverprofile=coverage.out ./...  # Coverage profile
go tool cover -html=coverage.out        # Browser coverage
go test -run TestSpecific ./internal/domain/  # Single test
go test -short ./...                    # Skip integration
go test -count=10 ./...                 # Flaky detection
go test -fuzz=FuzzName -fuzztime=30s    # Fuzz testing
go test -bench=. -benchmem             # Benchmarks
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Do Instead |
|---|---|---|
| `reflect.DeepEqual` | No diff output, unsafe with unexported fields | `cmp.Diff()` |
| `t.Fatal` in table loop (no `t.Run`) | Stops all remaining cases | Use `t.Run()` subtests |
| Testing implementation details | Brittle tests | Test behavior/contracts |
| Asserting on error *strings* | Fragile, breaks on rewording | `errors.Is()` / `errors.As()` |
| Ignoring `-race` flag | Misses data races | Always `go test -race` |
| Mocking everything | Over-coupled tests | Mock only at boundaries |
| No `t.Helper()` on helpers | Wrong line numbers in failures | Always call `t.Helper()` |
| `time.Sleep` in tests | Flaky, slow | Channels, conditions, or `time.After` |
| Global test state mutation | Order-dependent tests | Dependency injection |
| Wrong `assert.Equal` order | Confusing diff output | `assert.Equal(t, want, got)` |

## Design-for-Testability Rules

1. **Accept interfaces, return structs** — makes mocking easy
2. **Inject dependencies** — pass deps via constructors, not package globals
3. **Inject `time.Now`** — use `func() time.Time` field, not `time.Now()` directly
4. **Small interfaces at the consumer** — don't import large interfaces from providers
5. **Verify interface compliance**: `var _ Interface = (*Impl)(nil)`
6. **Use `context.Context`** — enables timeout/cancellation in tests
7. **Return errors, don't panic** — tests can use `t.Fatal`, not `recover()`

---
name: golang-patterns
description: Idiomatic Go patterns for {{PROJECT_NAME}}. Error handling, concurrency, interfaces, Chi handlers, sqlc usage, background workers, performance.
---

# Go Development Patterns for {{PROJECT_NAME}}

## When to Activate

- Writing new Go code in internal/
- Reviewing Go code
- Refactoring existing Go code
- Designing new handlers, domain logic, or workers

## Philosophy

When making tradeoffs, prioritize in this order (per Google Go Style Guide):

1. **Clarity** — The code's purpose and logic are clear to the reader
2. **Simplicity** — The code accomplishes its goal in the simplest way
3. **Concision** — The code has a high signal-to-noise ratio
4. **Maintainability** — The code is easy to evolve over time
5. **Consistency** — The code is consistent with the broader codebase

Use the **Least Mechanism Principle**: prefer core language constructs (channel, slice, map, loop, struct) when sufficient. Then standard library. Then third-party.

## Core Principles

### 1. Accept Interfaces, Return Structs
```go
// GOOD: accepts interface, returns concrete type
func ProcessData(r io.Reader) (*Result, error) {
    data, err := io.ReadAll(r)
    if err != nil {
        return nil, fmt.Errorf("read data: %w", err)
    }
    return &Result{Data: data}, nil
}

// BAD: accepts concrete type
func ProcessData(f *os.File) (*Result, error) { ... }
```

### 2. Compile-Time Interface Verification
```go
// Verify *Handler implements http.Handler at compile time.
// This fails to compile if the interface is not satisfied.
var _ http.Handler = (*Handler)(nil)
var _ email.Provider = (*SESProvider)(nil)
var _ storage.Provider = (*S3Provider)(nil)
```

Always add this for types that implement interfaces — catches drift immediately.

### 3. Make the Zero Value Useful
```go
type Counter struct {
    mu    sync.Mutex
    count int // zero value is 0, ready to use
}
```

### 4. Context First, Errors Last
```go
func (h *Handler) GetItem(ctx context.Context, orgID, itemID uuid.UUID) (*Item, error)
```

## Error Handling (Standard)

### Wrap with Context, No "failed to" Prefix
```go
// GOOD: concise, chains well
return fmt.Errorf("get item %s: %w", itemID, err)
// Produces: "get item abc123: sql: no rows"

// BAD: "failed to" creates noisy chains
return fmt.Errorf("failed to get item: %w", err)
// Produces: "failed to x: failed to y: failed to get item: the error"
```

### Use errors.Is/errors.As, Never ==
```go
// GOOD
if errors.Is(err, sql.ErrNoRows) {
    return nil, ErrNotFound
}

// BAD: doesn't work with wrapped errors
if err == sql.ErrNoRows { ... }
```

### Handle Errors Once — Don't Log AND Return
```go
// GOOD: return the error for the caller to handle
func (s *Store) GetItem(ctx context.Context, id uuid.UUID) (*Item, error) {
    item, err := s.q.GetItem(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("get item %s: %w", id, err)
    }
    return item, nil
}

// BAD: logs AND returns — error gets logged multiple times up the chain
func (s *Store) GetItem(ctx context.Context, id uuid.UUID) (*Item, error) {
    item, err := s.q.GetItem(ctx, id)
    if err != nil {
        log.Error().Err(err).Msg("failed to get item") // logged here
        return nil, fmt.Errorf("get item: %w", err)    // AND returned
    }
    return item, nil
}
```

Log at the handler level (the top of the call chain), return errors everywhere else.

### %w vs %v Decision Guide
```go
// Use %w when callers need errors.Is/errors.As
return fmt.Errorf("get item: %w", err)

// Use %v at system boundaries to hide internal details
// (e.g., when wrapping errors from external services, RPC, storage)
return fmt.Errorf("external service error: %v", err)
```

### Never Ignore Errors
```go
// FORBIDDEN
result, _ := doSomething()

// If you truly don't need the error, document why
_ = conn.Close() //nolint:errcheck // best-effort cleanup
```

### Sentinel Errors
```go
var (
    ErrNotFound     = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrForbidden    = errors.New("forbidden")
)
```

## Chi Handler Pattern

```go
func (h *ItemHandler) GetItem(w http.ResponseWriter, r *http.Request) {
    orgID := middleware.OrgID(r.Context())  // From session, NEVER request body
    id := chi.URLParam(r, "id")

    item, err := h.store.GetItem(r.Context(), orgID, id)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            respondError(w, http.StatusNotFound, "item not found")
            return
        }
        log.Error().Err(err).Str("item_id", id).Msg("failed to get item")
        respondError(w, http.StatusInternalServerError, "internal error")
        return
    }

    respondJSON(w, http.StatusOK, item)
}
```

## sqlc Query Pattern

```sql
-- internal/store/queries/items.sql

-- name: GetItem :one
SELECT * FROM items
WHERE id = $1 AND organization_id = $2;

-- name: ListItems :many
SELECT * FROM items
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
```

## Background Worker Pattern

Background jobs use a Postgres `jobs` table with `FOR UPDATE SKIP LOCKED`. Workers are simple functions dispatched by job kind.

```go
// internal/worker/email_send.go

// HandleEmailSend processes an email delivery job.
func HandleEmailSend(ctx context.Context, emailProvider email.Provider, args json.RawMessage) error {
    var a struct {
        To      string `json:"to"`
        Subject string `json:"subject"`
        Body    string `json:"body"`
    }
    if err := json.Unmarshal(args, &a); err != nil {
        return fmt.Errorf("unmarshal email args: %w", err)
    }
    return emailProvider.Send(ctx, &email.Message{
        To:      a.To,
        Subject: a.Subject,
        Body:    a.Body,
    })
}
```

## Concurrency Patterns

### Worker Pool with errgroup
```go
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(runtime.NumCPU()) // Bound concurrency
for _, url := range urls {
    url := url // Go < 1.22 loop variable capture
    g.Go(func() error {
        data, err := fetch(ctx, url)
        if err != nil {
            return fmt.Errorf("fetch %s: %w", url, err)
        }
        results[i] = data
        return nil
    })
}
if err := g.Wait(); err != nil {
    return nil, err
}
```

### Graceful Shutdown
```go
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

if err := server.Shutdown(ctx); err != nil {
    log.Fatal().Err(err).Msg("server forced shutdown")
}
```

### Prefer Synchronous Functions
```go
// GOOD: synchronous — caller can wrap in goroutine if needed
func Process(ctx context.Context, item Item) error { ... }

// BAD: async API forces concurrency on caller
func ProcessAsync(item Item) <-chan error { ... }
```

The caller can always `go Process(...)` but cannot remove unwanted concurrency.

### Channel Direction in Signatures
```go
// GOOD: prevents accidental close or wrong-direction send
func consume(values <-chan int) { ... }
func produce(out chan<- int) { ... }

// BAD: allows caller to close or send/receive unexpectedly
func consume(values chan int) { ... }
```

### Channel Size: One or None
```go
// GOOD: unbuffered (synchronous handoff) or size 1
c := make(chan int)    // unbuffered
c := make(chan int, 1) // single-item buffer

// BAD: arbitrary large buffers are a code smell
c := make(chan int, 64) // Why 64? What if it fills?
```

Any buffer size > 1 must be justified with a comment explaining the sizing rationale.

### Never Fire-and-Forget Goroutines
```go
// BAD: no way to stop this goroutine
go func() {
    for {
        processItem()
    }
}()

// GOOD: context-controlled lifecycle
func startWorker(ctx context.Context) {
    go func() {
        for {
            select {
            case <-ctx.Done():
                return
            default:
                processItem()
            }
        }
    }()
}
```

Every goroutine must have a predictable time at which it will stop running, or a way to signal it to stop.

### Context Cancellation in Loops
```go
func processItems(ctx context.Context, items []Item) error {
    for _, item := range items {
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
        }
        if err := process(ctx, item); err != nil {
            return fmt.Errorf("process item %s: %w", item.ID, err)
        }
    }
    return nil
}
```

## Performance

### Preallocate Slices and Maps (When Size is Known)
```go
// GOOD: single allocation when size is known
data := make([]T, 0, len(items))
m := make(map[string]V, len(items))

// BAD: O(log n) reallocations
data := make([]T, 0)
m := make(map[string]V)
```

Don't over-preallocate without evidence — arbitrary large capacities waste memory across the fleet.

### Use fmt.Fprintf Directly to Writers
```go
// GOOD: writes directly, no intermediate allocation
fmt.Fprintf(w, "count: %d", n)

// BAD: allocates temporary string
w.Write([]byte(fmt.Sprintf("count: %d", n)))
```

### strings.Builder for Concatenation
```go
// GOOD: O(n) amortized
var b strings.Builder
for _, item := range items {
    b.WriteString(item.Name)
    b.WriteByte(',')
}

// BAD: O(n^2) — creates new string each iteration
var s string
for _, item := range items {
    s += item.Name + ","
}
```

### Prefer strconv Over fmt for Conversions
```go
// GOOD: 2x faster
s := strconv.Itoa(n)
s := strconv.FormatFloat(f, 'f', -1, 64)

// BAD: slower, more allocations
s := fmt.Sprint(n)
s := fmt.Sprintf("%f", f)
```

### sync.Pool for Frequent Short-Lived Allocations
```go
var bufPool = sync.Pool{
    New: func() any { return new(bytes.Buffer) },
}

func process(data []byte) string {
    buf := bufPool.Get().(*bytes.Buffer)
    defer func() {
        buf.Reset()
        bufPool.Put(buf)
    }()
    // use buf...
    return buf.String()
}
```

### Struct Field Ordering for Memory Alignment
```go
// BAD: 24 bytes (padding waste)
type Bad struct {
    a bool   // 1 byte + 7 padding
    b int64  // 8 bytes
    c bool   // 1 byte + 7 padding
}

// GOOD: 16 bytes (optimal packing)
type Good struct {
    b int64  // 8 bytes
    a bool   // 1 byte
    c bool   // 1 byte + 6 padding
}
```

Order struct fields largest to smallest.

### Atomic vs Mutex
```go
// Use atomic for simple counters/flags (lock-free)
type Server struct {
    requestCount atomic.Int64
    isReady      atomic.Bool
}

// Use sync.RWMutex when reads >> writes
type Cache struct {
    mu   sync.RWMutex
    data map[string]any
}
```

### No N+1 Queries (use JOINs via sqlc)
```sql
-- BAD: N+1 — one query per item for related data
-- GOOD: single query with JOIN
SELECT i.*, t.id as tag_id, t.name as tag_name
FROM items i
LEFT JOIN item_tags t ON t.item_id = i.id
WHERE i.organization_id = $1;
```

### pgx Batch Operations (Reduce Round Trips)
```go
batch := &pgx.Batch{}
for _, u := range users {
    batch.Queue("INSERT INTO users (name, email) VALUES ($1, $2)", u.Name, u.Email)
}
br := conn.SendBatch(ctx, batch)
defer br.Close()
```

### Connection Pool Configuration
```go
config.MaxConns = 20                      // Match expected concurrency
config.MinConns = 5                       // Keep warm connections
config.MaxConnLifetime = time.Hour        // Recycle stale connections
config.MaxConnIdleTime = 30 * time.Minute // Release idle connections
```

## Interface Design

```go
// Small, focused interfaces at consumer
type EmailProvider interface {
    Send(ctx context.Context, msg *Message) error
}

type StorageProvider interface {
    Upload(ctx context.Context, key string, r io.Reader, contentType string, size int64) error
    GetPresignedURL(ctx context.Context, key string, expiry time.Duration) (string, error)
    Delete(ctx context.Context, key string) error
}

// Compile-time verification
var _ EmailProvider = (*SESProvider)(nil)
var _ StorageProvider = (*S3Provider)(nil)
```

## Naming Conventions

### Package Names
- Lowercase, no underscores: `handler`, `store`, `domain`
- Don't repeat package name in symbols: `widget.New` not `widget.NewWidget`
- No `util`, `helper`, `common` package names — name by what it provides

### Getters: No "Get" Prefix
```go
// GOOD
func (i *Item) Title() string { return i.title }
func (i *Item) Status() ItemStatus { return i.status }

// BAD
func (i *Item) GetTitle() string { return i.title }
```

### Enums: Start at iota+1
```go
const (
    StatusUnknown ItemStatus = iota // zero value = unknown/unset
    StatusActive
    StatusPending
    StatusArchived
)
```

Reserve zero for "unset/unknown" unless the zero case is the desired default.

### Variable Name Length ~ Scope Size
```go
// Small scope: short names
for i, v := range items { ... }

// Large scope: descriptive names
var itemsByOrganization map[uuid.UUID][]*Item
```

## Defensive Coding

### Copy Slices and Maps at API Boundaries
```go
// BAD: caller can mutate the internal slice
func (d *Driver) SetTrips(trips []Trip) {
    d.trips = trips
}

// GOOD: defensive copy
func (d *Driver) SetTrips(trips []Trip) {
    d.trips = make([]Trip, len(trips))
    copy(d.trips, trips)
}

// Same for maps
func (c *Config) SetOptions(opts map[string]string) {
    c.opts = make(map[string]string, len(opts))
    for k, v := range opts {
        c.opts[k] = v
    }
}
```

### Nil Slice Preference
```go
// GOOD: nil slice (marshals to null in JSON, but usually fine)
var s []string

// BAD: empty slice literal (unnecessary allocation)
s := []string{}
```

Don't create APIs that force clients to distinguish between nil and empty slices.

### Handle Type Assertion Failures
```go
// GOOD: comma-ok idiom
t, ok := i.(string)
if !ok {
    return ErrInvalidType
}

// BAD: panics on failure
t := i.(string)
```

### Field Tags on All Marshaled Structs
```go
// GOOD: explicit JSON field names
type Item struct {
    ID        uuid.UUID    `json:"id"`
    Title     string       `json:"title"`
    CreatedAt time.Time    `json:"created_at"`
    Internal  string       `json:"-"` // omit from JSON
}

// BAD: relies on Go's default field name casing
type Item struct {
    ID        uuid.UUID
    Title     string
}
```

## Godoc Comments

Every exported symbol (function, type, interface, constant, variable) MUST have a godoc comment. Unexported symbols should have comments when the intent isn't obvious.

### Package Comments
```go
// Package handler provides HTTP handlers for the {{PROJECT_NAME}} API.
// Handlers are organized by domain and follow the handler -> domain -> store pattern.
package handler
```

Every package needs a package comment. Place it in `doc.go` if the package has multiple files, or above the `package` declaration in the primary file.

### Function Comments
```go
// GetItem retrieves an item by ID within the given organization.
// It returns ErrNotFound if the item does not exist or belongs to a different org.
func (h *ItemHandler) GetItem(w http.ResponseWriter, r *http.Request) {
```

Rules:
- Start with the function name: `// FuncName does...`
- Describe what it does, not how
- Document error conditions and edge cases
- Document any side effects (sends email, enqueues job, etc.)

### Interface Comments
```go
// Provider sends transactional emails. Implementations must be safe for
// concurrent use.
type Provider interface {
    // Send delivers a single email message. It returns an error if the
    // provider rejects the message or the context is cancelled.
    Send(ctx context.Context, msg *Message) error
}
```

Document the interface AND each method. The interface comment describes the contract; method comments describe individual operations.

### Type and Struct Comments
```go
// Item represents a resource managed within an organization.
// Items belong to a project and progress through statuses defined
// by domain.CanTransition.
type Item struct {
```

### Constants and Variables
```go
// ErrNotFound indicates the requested resource does not exist or is not
// accessible within the current organization scope.
var ErrNotFound = errors.New("not found")

// MaxFileSize is the maximum allowed upload size per attachment (5MB).
const MaxFileSize = 5 << 20
```

### Deprecation
```go
// GetItemBySlug retrieves an item by its URL slug.
//
// Deprecated: Use GetItem with the item UUID instead. This will be
// removed in v2.
func (h *ItemHandler) GetItemBySlug(w http.ResponseWriter, r *http.Request) {
```

### What NOT to Do
```go
// Bad: restates the signature
// GetItem gets an item.
func GetItem(...)

// Bad: missing function name
// Retrieves the item from the database.
func GetItem(...)

// Bad: no comment at all on exported function
func GetItem(...)
```

## Context Patterns

### Context Stomping vs Shadowing Bug
```go
// GOOD: unconditionally replaces ctx ("stomping")
ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
defer cancel()

// BUG: shadowing inside if block — ctx reverts after block
if needTimeout {
    ctx, cancel := context.WithTimeout(ctx, 3*time.Second) // NEW ctx in block scope!
    defer cancel()
}
// ctx here is the ORIGINAL, not the timeout one

// FIX: use = not :=
if needTimeout {
    var cancel func()
    ctx, cancel = context.WithTimeout(ctx, 3*time.Second) // stomps outer ctx
    defer cancel()
}
```

### Context Cancellation is Implied — Don't Re-Document
```go
// BAD: redundant — all ctx-accepting functions respect cancellation
// Run processes work until the context is cancelled.
func (w *Worker) Run(ctx context.Context) error

// GOOD: only document non-standard behavior
// Run executes the worker's run loop. Returns nil on context cancellation.
func (w *Worker) Run(ctx context.Context) error
```

## Logging

### log.Error Should Be Actionable
```go
// GOOD: someone should investigate this
log.Error().Err(err).Str("item_id", id).Msg("failed to transition item status")

// BAD: informational, not actionable — use Warn
log.Error().Msg("cache miss for item")
```

Use `Error` only when the message requires human action. Use `Warn` for informational severity.

### Don't Log AND Return — Choose One
Log at the handler level (top of call chain). Return errors everywhere else. See Error Handling section.

## Anti-Patterns to Avoid

- **Panic for control flow** — only panic on programmer errors (unreachable code, invalid state)
- **Recovering panics in handlers** — let monitoring surface crashes; `net/http`'s recovery is a historical mistake
- **Context in structs** — always first function parameter
- **Package-level mutable state** — use dependency injection (including for `time.Now`)
- **Naked returns in long functions** — only acceptable in very short functions
- **Mixing value and pointer receivers** on same type
- **Goroutines without cancellation path** — every goroutine needs a stop signal
- **`init()` functions** — prefer explicit initialization in `main()` or constructors
- **`os.Exit` outside `main()`** — return errors instead; use the `run()` pattern
- **Embedding types in public structs** — leaks implementation details; prefer delegation
- **Logging AND returning errors** — handle at one level only
- **Mutable globals** — inject dependencies (time, random, config) via constructors
- **`math/rand` for security** — use `crypto/rand` for tokens, keys, session IDs
- **Returning `err.Error()` to clients** — expose generic messages, log details server-side
- **`Must` functions in request handlers** — `Must` is for init-time only (package-level vars)
- **`util`/`helper`/`common` packages** — name packages by what they provide
- **Returning concrete error types** from exported functions — always return `error` interface
- **`break` in `switch` inside `for`** — `break` exits the `switch`, not the loop; use labels
- **Copying types with `sync.Mutex` or pointer receivers** — causes aliased state bugs

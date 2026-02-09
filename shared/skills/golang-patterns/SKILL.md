---
name: golang-patterns
description: Idiomatic Go patterns for {{PROJECT_NAME}}. Error handling, interfaces, Chi handlers, sqlc usage, godoc comments, naming conventions. Use when writing, reviewing, or refactoring Go code.
compatibility: Go 1.25+, Chi, sqlc, zerolog, pgx/v5
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

## Additional References

- For concurrency patterns (errgroup, graceful shutdown, goroutine lifecycle), see [references/concurrency.md](references/concurrency.md)
- For performance optimization (preallocation, sync.Pool, struct alignment), see [references/performance.md](references/performance.md)
- For defensive coding (slice copying, type assertions, context shadowing), see [references/defensive-coding.md](references/defensive-coding.md)

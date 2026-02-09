---
name: coding-standards
description: Universal coding standards for {{PROJECT_NAME}}. Go conventions, TypeScript strict mode, API design, file organization, naming philosophy. Use when writing new code, reviewing code style, or onboarding to the codebase.
compatibility: Go 1.25+, Next.js 16, TypeScript strict mode
---

# Coding Standards for {{PROJECT_NAME}}

## Philosophy

When making tradeoffs, prioritize in this order:

1. **Clarity** — The code's purpose and logic are clear to the reader
2. **Simplicity** — The code accomplishes its goal in the simplest way
3. **Concision** — The code has a high signal-to-noise ratio
4. **Maintainability** — The code is easy to evolve over time
5. **Consistency** — The code is consistent with the broader codebase

**Least Mechanism Principle**: Use core language constructs first (channel, slice, map, loop, struct). Then standard library. Then third-party libraries. Only add complexity when simpler tools are insufficient.

## Go Backend Standards

### Package Organization
```
internal/
  config/      -- Env-based configuration
  server/      -- HTTP server setup, routes
  handler/     -- HTTP handlers by domain
  domain/      -- Pure business logic (no HTTP, no DB)
  store/
    queries/   -- Raw SQL for sqlc input
    sqlc/      -- Generated Go code (DO NOT EDIT)
    migrations/ -- goose SQL migrations
  worker/      -- Background job runner and handlers
  email/       -- Email provider abstraction
  storage/     -- S3 storage abstraction
  middleware/  -- Auth, org context, rate limiting
```

### Naming

**Packages**: `lowercase` (handler, store, domain)

**Don't Repeat Package Name in Symbols**:
```go
// GOOD
widget.New()           // not widget.NewWidget()
db.Load()              // not db.LoadFromDatabase()
item.Status()          // not item.ItemStatus()

// BAD
widget.NewWidget()
db.LoadFromDatabase()
```

**Getters: No "Get" Prefix**:
```go
// GOOD
func (i *Item) Title() string { return i.title }
func (i *Item) Status() ItemStatus { return i.status }

// BAD
func (i *Item) GetTitle() string { return i.title }
```

**Other Naming Conventions**:
- Interfaces: `-er` suffix (Provider, Sender, Store)
- Errors: `Err` prefix (ErrNotFound, ErrUnauthorized)
- Constructors: `New` prefix (NewItemHandler)
- Context first param, error last return
- No `util`, `helper`, `common` package names — name by what it provides
- Use `Compute` or `Fetch` (not `Get`) for expensive operations

**Variable Name Length ~ Scope Size**:
```go
// Small scope: short names
for i, v := range items { ... }
if err := doSomething(); err != nil { ... }

// Large scope: descriptive names
var itemsByOrganization map[uuid.UUID][]*Item
var maxConcurrentWorkers = runtime.NumCPU()
```

### Error Messages
```go
// lowercase, no punctuation, wrapped with context, no "failed to"
return fmt.Errorf("get item %s: %w", id, err)

// BAD
return fmt.Errorf("Failed to get item: %w", err)
return fmt.Errorf("failed to get item.") // no punctuation
```

### Logging (zerolog)
```go
log.Info().Str("item_id", id).Msg("item created")
log.Error().Err(err).Str("handler", "GetItem").Msg("failed to fetch")
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

## TypeScript/Frontend Standards

### Type Safety
- Strict mode, no `any` types
- Zod schemas for runtime validation
- Types mirror Go structs in `web/src/lib/types.ts`

### Component Organization
```
web/src/components/
  ui/          -- shadcn/ui (DO NOT EDIT)
  items/       -- Item-specific components
  dashboard/   -- Dashboard widgets
  forms/       -- Form components
  settings/    -- Settings pages
```

### State Management
- Server state: TanStack Query (caching, optimistic updates)
- Form state: react-hook-form + zod validation
- NO global state library (no Redux, Zustand)

### Styling
- Tailwind CSS 4 utility classes
- shadcn/ui for standard components
- No CSS modules, no styled-components

### API Client
```typescript
// All API calls through web/src/lib/api.ts
// Credentials: 'include' for session cookies
// Base: /api/v1/
```

## Universal Principles

### KISS - Keep It Simple
- Simplest solution that works
- No premature optimization
- Easy to understand > clever code

### DRY - Don't Repeat Yourself
- Extract common logic into functions
- Create reusable components
- Share utilities across modules

### YAGNI - You Aren't Gonna Need It
- Don't build features before needed
- Start simple, refactor when needed

### Early Returns (Guard Clauses)
```go
// GOOD: handle errors first, happy path un-indented
if err != nil {
    return err
}
// happy path continues

// BAD: deep nesting
if err == nil {
    if valid {
        // ...
    }
}
```

### No Else After Return
```go
// GOOD
if condition {
    return x
}
return y

// BAD
if condition {
    return x
} else {
    return y
}
```

## Generated Code -- DO NOT EDIT

- `internal/store/sqlc/` -- Edit queries/*.sql, run `sqlc generate`
- `web/src/components/ui/` -- Modify via shadcn CLI

## Git Commit Format

```
<type>(<scope>): <description>

Types: feat, fix, refactor, docs, test, chore, perf, ci
Scopes: api, web, db, auth, worker, docker
```

## Receiver Type Rules

- Needs to mutate? -> pointer receiver
- Contains `sync.Mutex` or uncopyable fields? -> pointer receiver
- Map, function, or channel? -> value receiver
- Small immutable struct? -> value receiver
- When in doubt? -> pointer receiver
- **All methods on a type must be consistent** (all pointer or all value)

## Module Hygiene

- Run `go mod tidy` after adding/removing dependencies
- Commit `go.sum` for integrity verification
- Review dependency changes before merging
- Prefer standard library over third-party when functionality is equivalent

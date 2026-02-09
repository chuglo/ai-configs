# Defensive Coding Patterns

## Copy Slices and Maps at API Boundaries
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

## Nil Slice Preference
```go
// GOOD: nil slice (marshals to null in JSON, but usually fine)
var s []string

// BAD: empty slice literal (unnecessary allocation)
s := []string{}
```

Don't create APIs that force clients to distinguish between nil and empty slices.

## Handle Type Assertion Failures
```go
// GOOD: comma-ok idiom
t, ok := i.(string)
if !ok {
    return ErrInvalidType
}

// BAD: panics on failure
t := i.(string)
```

## Field Tags on All Marshaled Structs
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

## Context Stomping vs Shadowing Bug
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

## Context Cancellation is Implied — Don't Re-Document
```go
// BAD: redundant — all ctx-accepting functions respect cancellation
// Run processes work until the context is cancelled.
func (w *Worker) Run(ctx context.Context) error

// GOOD: only document non-standard behavior
// Run executes the worker's run loop. Returns nil on context cancellation.
func (w *Worker) Run(ctx context.Context) error
```

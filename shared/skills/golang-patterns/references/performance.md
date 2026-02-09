# Performance Patterns

## Preallocate Slices and Maps (When Size is Known)
```go
// GOOD: single allocation when size is known
data := make([]T, 0, len(items))
m := make(map[string]V, len(items))

// BAD: O(log n) reallocations
data := make([]T, 0)
m := make(map[string]V)
```

Don't over-preallocate without evidence — arbitrary large capacities waste memory across the fleet.

## Use fmt.Fprintf Directly to Writers
```go
// GOOD: writes directly, no intermediate allocation
fmt.Fprintf(w, "count: %d", n)

// BAD: allocates temporary string
w.Write([]byte(fmt.Sprintf("count: %d", n)))
```

## strings.Builder for Concatenation
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

## Prefer strconv Over fmt for Conversions
```go
// GOOD: 2x faster
s := strconv.Itoa(n)
s := strconv.FormatFloat(f, 'f', -1, 64)

// BAD: slower, more allocations
s := fmt.Sprint(n)
s := fmt.Sprintf("%f", f)
```

## sync.Pool for Frequent Short-Lived Allocations
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

## Struct Field Ordering for Memory Alignment
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

## Atomic vs Mutex
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

## No N+1 Queries (use JOINs via sqlc)
```sql
-- BAD: N+1 — one query per item for related data
-- GOOD: single query with JOIN
SELECT i.*, t.id as tag_id, t.name as tag_name
FROM items i
LEFT JOIN item_tags t ON t.item_id = i.id
WHERE i.organization_id = $1;
```

## pgx Batch Operations (Reduce Round Trips)
```go
batch := &pgx.Batch{}
for _, u := range users {
    batch.Queue("INSERT INTO users (name, email) VALUES ($1, $2)", u.Name, u.Email)
}
br := conn.SendBatch(ctx, batch)
defer br.Close()
```

## Connection Pool Configuration
```go
config.MaxConns = 20                      // Match expected concurrency
config.MinConns = 5                       // Keep warm connections
config.MaxConnLifetime = time.Hour        // Recycle stale connections
config.MaxConnIdleTime = 30 * time.Minute // Release idle connections
```

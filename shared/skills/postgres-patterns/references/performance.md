# Performance

## Reading EXPLAIN ANALYZE

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...;
```

**Red flags:**
- `Seq Scan` on large table with selective WHERE -> needs index
- `Rows Removed by Filter: 100000` with `rows=10` -> wrong or missing index
- `Sort Method: external merge Disk` -> increase `work_mem`
- Estimated `rows=1` but actual `rows=50000` -> run `ANALYZE`
- `Hash Batches: 4` -> hash table spilled to disk

## EXISTS vs IN vs JOIN

```sql
-- EXISTS: best for semi-joins, short-circuits on first match
SELECT i.* FROM items i
WHERE EXISTS (
    SELECT 1 FROM projects p WHERE p.id = i.project_id AND p.organization_id = $1
);

-- NOT EXISTS > NOT IN (NULL-safe!)
-- NOT IN returns no rows if subquery contains ANY NULL
SELECT i.* FROM items i
WHERE NOT EXISTS (SELECT 1 FROM archived a WHERE a.id = i.id);
-- NEVER: WHERE id NOT IN (SELECT id FROM archived)  -- breaks on NULLs
```

## Pagination

### Offset-Based (Simple, OK for Small Tables)

```sql
-- name: ListItems :many
SELECT * FROM items
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
-- O(offset) cost — fine for <10K rows, slow at scale
```

### Keyset/Cursor Pagination (Fast, Scalable)

```sql
-- First page
-- name: ListItemsFirstPage :many
SELECT id, title, created_at FROM items
WHERE organization_id = $1
ORDER BY created_at DESC, id DESC
LIMIT $2;

-- Next page: use last row's values as cursor
-- name: ListItemsNextPage :many
SELECT id, title, created_at FROM items
WHERE organization_id = $1
  AND (created_at, id) < ($2, $3)  -- row value comparison
ORDER BY created_at DESC, id DESC
LIMIT $4;

-- Supporting index:
CREATE INDEX idx_items_cursor ON items (organization_id, created_at DESC, id DESC);
```

**Rules:**
- Always include a unique tiebreaker column (usually `id`) in the sort
- Use row-value comparison `(col1, col2) < ($1, $2)` for composite cursors
- O(1) cost regardless of page depth
- Encode cursor as opaque token (base64 of `created_at:id`) for API consumers

## Connection Pool Configuration

```go
config.MaxConns = 20                      // 2-3x CPU cores for OLTP
config.MinConns = 5                       // Keep warm connections
config.MaxConnLifetime = time.Hour        // Recycle stale connections
config.MaxConnIdleTime = 30 * time.Minute // Release idle connections
config.HealthCheckPeriod = time.Minute    // Detect dead connections
```

**Rule:** More connections != better. Too many -> lock contention, context switching.
Formula: `connections = (core_count * 2) + effective_spindle_count`

## Advisory Locks

```sql
-- Transaction-scoped (auto-released on commit/rollback)
SELECT pg_advisory_xact_lock(hashtext('process_item_' || $1::text));

-- Non-blocking try (returns boolean)
SELECT pg_try_advisory_lock(hashtext('deploy_migration'));
-- ... do work ...
SELECT pg_advisory_unlock(hashtext('deploy_migration'));

-- Two-key for multi-tenant scoping
SELECT pg_advisory_xact_lock(
    hashtext($1::text),      -- organization_id
    hashtext('item_gen')     -- operation type
);
```

## Monitoring Queries

```sql
-- Top slow queries (requires pg_stat_statements extension)
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;

-- Cache hit rate (should be >99%)
SELECT sum(heap_blks_hit) / nullif(sum(heap_blks_hit + heap_blks_read), 0) * 100
FROM pg_statio_user_tables;

-- Unused indexes (candidates for removal)
SELECT indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes WHERE idx_scan = 0 ORDER BY pg_relation_size(indexrelid) DESC;

-- Tables needing VACUUM
SELECT relname, n_dead_tup, n_live_tup, last_autovacuum
FROM pg_stat_user_tables WHERE n_dead_tup > 1000 ORDER BY n_dead_tup DESC;

-- Long-running queries
SELECT pid, now() - query_start AS duration, query, state
FROM pg_stat_activity WHERE state != 'idle' AND query_start < now() - interval '30s';
```

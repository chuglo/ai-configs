---
name: postgres-patterns
description: PostgreSQL patterns for {{PROJECT_NAME}}. Multi-tenant queries, sqlc patterns, index design, RLS, full-text search, goose migrations, query optimization, partitioning, monitoring.
---

# PostgreSQL Patterns for {{PROJECT_NAME}}

## When to Activate

- Writing SQL queries in internal/store/queries/
- Creating goose migrations
- Designing database schemas
- Troubleshooting slow queries
- Implementing Row Level Security

## Multi-Tenancy (CRITICAL)

Every tenant-scoped query MUST filter by organization_id:

```sql
-- REQUIRED: Filter by org
SELECT * FROM items
WHERE organization_id = $1;

-- FORBIDDEN: No org filter
SELECT * FROM items WHERE id = $1;

-- PREFERRED: Composite lookup (faster, prevents IDOR)
SELECT * FROM items
WHERE id = $1 AND organization_id = $2;
```

## sqlc Annotations

```sql
-- name: GetItem :one        -- Single row (QueryRow)
-- name: ListItems :many     -- Multiple rows (Query)
-- name: CreateItem :one     -- INSERT RETURNING * (single row back)
-- name: UpdateItem :exec    -- No return value (Exec)
-- name: DeleteItem :execrows -- Returns affected row count

-- pgx-only annotations:
-- name: CreateItems :copyfrom  -- Bulk insert via COPY protocol (10-100x faster)
-- name: DeleteItems :batchexec   -- Batched exec via pgx pipeline
-- name: GetItems :batchmany      -- Batched multi-row query
```

### sqlc Config Best Practices

```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "internal/store/queries/"
    schema: "internal/store/migrations/"
    gen:
      go:
        package: "sqlc"
        out: "internal/store/sqlc"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_empty_slices: true          # Return [] not nil for empty results
        emit_pointers_for_null_types: true
        query_parameter_limit: 3         # Use params struct if >3 args
```

### Transactions with sqlc + pgx

```go
tx, err := db.Begin(ctx)
if err != nil {
    return fmt.Errorf("begin tx: %w", err)
}
defer tx.Rollback(ctx)

qtx := queries.WithTx(tx)  // Wrap queries in transaction
// ... use qtx for all queries in this transaction ...

return tx.Commit(ctx)
```

## Index Design

### Index Type Selection

| Query Pattern | Index Type | Example |
|---|---|---|
| `WHERE col = value` | B-tree (default) | `CREATE INDEX idx ON t (col)` |
| `WHERE col > value` | B-tree | `CREATE INDEX idx ON t (col)` |
| `WHERE a = x AND b > y` | Composite B-tree | `CREATE INDEX idx ON t (a, b)` |
| `WHERE jsonb @> '{}'` | GIN | `CREATE INDEX idx ON t USING gin (col)` |
| `WHERE tsv @@ query` | GIN | `CREATE INDEX idx ON t USING gin (col)` |
| Time-series ranges (append-only) | BRIN | `CREATE INDEX idx ON t USING brin (col)` |
| Geometry, ranges, exclusion | GiST | `CREATE INDEX idx ON t USING gist (col)` |

### Composite Index Ordering Rules

```sql
-- RULE: Equality columns FIRST, range columns LAST, then ORDER BY
CREATE INDEX idx_items_lookup ON items (organization_id, status, created_at DESC);
-- Works for: WHERE organization_id = $1 AND status = $2 ORDER BY created_at DESC

-- WRONG: Range column before equality
CREATE INDEX idx_bad ON items (created_at, organization_id, status);
```

### Covering Indexes (Avoid Table Lookup)

```sql
-- INCLUDE columns are stored in leaf pages but not searchable
-- Enables index-only scans for listing queries
CREATE INDEX idx_items_list ON items (organization_id, status)
    INCLUDE (title, created_at, assignee_id);
-- Serves: SELECT title, created_at, assignee_id
--         WHERE organization_id = $1 AND status = $2
```

### Partial Indexes (Smaller, Faster)

```sql
-- Only index active records (most queries filter for non-archived)
CREATE INDEX idx_items_active ON items (organization_id, created_at)
    WHERE status != 'archived';

-- Partial unique constraint
CREATE UNIQUE INDEX idx_one_active_session ON sessions (user_id)
    WHERE is_active = true;

-- Index for job queue (tiny fraction of table)
CREATE INDEX idx_jobs_pending ON jobs (created_at)
    WHERE status = 'pending';
```

### Expression Indexes

```sql
-- Case-insensitive email lookup
CREATE UNIQUE INDEX idx_users_email_lower ON users (lower(email));
-- Query MUST use same expression: WHERE lower(email) = lower($1)

-- JSONB field extraction
CREATE INDEX idx_metadata_type ON events ((metadata->>'type'));
```

### BRIN for Time-Series (10-1000x Smaller)

```sql
-- Only useful when rows are physically ordered by the column (append-only)
CREATE INDEX idx_audit_log_ts ON audit_log USING brin (created_at);
```

## Full-Text Search

```sql
-- Generated tsvector column
search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B')
) STORED;

CREATE INDEX idx_items_search ON items USING GIN(search_vector);

-- Search with ranking (use websearch_to_tsquery for user-facing search)
-- name: SearchItems :many
SELECT i.id, i.title,
       ts_rank(i.search_vector, websearch_to_tsquery('english', $1)) AS rank
FROM items i
WHERE i.search_vector @@ websearch_to_tsquery('english', $1)
  AND i.organization_id = $2
ORDER BY rank DESC
LIMIT $3;

-- Autocomplete with prefix matching
-- name: AutocompleteItems :many
SELECT id, title FROM items
WHERE search_vector @@ to_tsquery('english', $1 || ':*')
  AND organization_id = $2
ORDER BY created_at DESC LIMIT 10;
```

## RLS Pattern (Defense-in-Depth)

```sql
-- Enable on tenant-scoped tables
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE items FORCE ROW LEVEL SECURITY;  -- Applies to table owner too

-- Policy with cached function call (wrapping in SELECT enables initPlan caching)
CREATE POLICY org_isolation ON items
  FOR ALL
  USING (organization_id = (SELECT current_setting('app.current_org_id')::uuid));

-- ALWAYS index RLS-referenced columns
CREATE INDEX idx_items_org ON items (organization_id);
```

### RLS Performance Rules (from Supabase benchmarks)

1. **Always index RLS-referenced columns** (99.94% improvement)
2. **Wrap functions in `(SELECT ...)`** to enable initPlan caching (94-99% improvement)
3. **Use separate policies per command** (SELECT, INSERT, UPDATE, DELETE) for clarity
4. **Minimize joins in policies** — restructure to avoid joining source table

### Setting Tenant Context from Go

```go
// In middleware, before any queries:
_, err := pool.Exec(ctx,
    "SELECT set_config('app.current_org_id', $1::text, true)", // true = local to transaction
    orgID.String(),
)
```

## Query Optimization

### Reading EXPLAIN ANALYZE

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...;
```

**Red flags:**
- `Seq Scan` on large table with selective WHERE -> needs index
- `Rows Removed by Filter: 100000` with `rows=10` -> wrong or missing index
- `Sort Method: external merge Disk` -> increase `work_mem`
- Estimated `rows=1` but actual `rows=50000` -> run `ANALYZE`
- `Hash Batches: 4` -> hash table spilled to disk

### EXISTS vs IN vs JOIN

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

### DISTINCT ON (Top-1 Per Group)

```sql
-- Much faster than window functions for top-1-per-group
-- name: GetLatestItemPerProject :many
SELECT DISTINCT ON (project_id)
    id, project_id, title, created_at
FROM items
WHERE organization_id = $1
ORDER BY project_id, created_at DESC;

-- Supporting index:
CREATE INDEX idx_items_project_created ON items (project_id, created_at DESC);
```

### LATERAL Joins (Top-N Per Group)

```sql
-- Get latest 3 comments per item
-- name: GetItemsWithRecentComments :many
SELECT i.id, i.title, c.*
FROM items i
CROSS JOIN LATERAL (
    SELECT comment_text, created_at
    FROM comments
    WHERE comments.item_id = i.id
    ORDER BY created_at DESC
    LIMIT 3
) c
WHERE i.organization_id = $1;
```

### CTE Materialization (PostgreSQL 12+)

```sql
-- Single-reference CTEs are auto-inlined (good, allows predicate push-down)
-- Multi-reference CTEs are auto-materialized (may prevent push-down)

-- Force inlining for multi-reference CTEs when beneficial:
WITH w AS NOT MATERIALIZED (
    SELECT * FROM big_table
)
SELECT * FROM w AS w1 JOIN w AS w2 ON w1.key = w2.ref
WHERE w2.key = 123;

-- Force materialization for expensive function calls:
WITH w AS MATERIALIZED (
    SELECT key, expensive_function(val) as f FROM some_table
)
SELECT * FROM w AS w1 JOIN w AS w2 ON w1.f = w2.f;
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

## Upsert Patterns

```sql
-- Basic upsert
-- name: UpsertUser :one
INSERT INTO users (email, name, updated_at)
VALUES ($1, $2, NOW())
ON CONFLICT (email)
DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
RETURNING *;

-- Idempotent insert (do nothing on conflict)
-- name: EnsureUserExists :exec
INSERT INTO users (id, email) VALUES ($1, $2)
ON CONFLICT (id) DO NOTHING;

-- Bulk upsert with unnest
-- name: BulkUpsertTags :exec
INSERT INTO tags (name, organization_id)
SELECT unnest($1::text[]), $2
ON CONFLICT (name, organization_id) DO NOTHING;
```

## Batch Operations

```sql
-- Batch UPDATE with unnest
-- name: BatchUpdateStatuses :exec
UPDATE items SET status = data.new_status
FROM (
    SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS new_status
) AS data
WHERE items.id = data.id AND items.organization_id = $3;

-- Batch DELETE
-- name: DeleteItemsByIDs :execrows
DELETE FROM items
WHERE id = ANY($1::uuid[]) AND organization_id = $2;

-- Bulk insert via COPY protocol (10-100x faster, pgx only)
-- name: BulkCreateEvents :copyfrom
INSERT INTO events (type, payload, created_at) VALUES ($1, $2, $3);
```

## CTE Patterns

```sql
-- Multi-step operation in single query
-- name: TransitionItemStatus :one
WITH updated AS (
    UPDATE items SET status = $3, updated_at = NOW()
    WHERE id = $1 AND organization_id = $2 AND status = $4
    RETURNING *
)
INSERT INTO item_status_history (item_id, old_status, new_status, changed_by)
SELECT id, $4, $3, $5 FROM updated
RETURNING (SELECT id FROM updated);

-- Dashboard aggregation with FILTER
-- name: GetItemStats :one
SELECT
    COUNT(*) FILTER (WHERE status = 'active') AS active_count,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'archived') AS archived_count,
    COUNT(*) AS total_count,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at)))
        FILTER (WHERE completed_at IS NOT NULL) AS avg_completion_seconds
FROM items
WHERE organization_id = $1 AND created_at >= $2;
```

## Window Functions

```sql
-- Running totals
-- name: GetDailyItemCounts :many
SELECT
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*) AS daily_count,
    SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC('day', created_at)) AS running_total
FROM items
WHERE organization_id = $1 AND created_at >= $2
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day;

-- Change detection with LAG
-- name: GetStatusTransitions :many
SELECT id, status, updated_at,
    LAG(status) OVER (PARTITION BY item_id ORDER BY updated_at) AS previous_status
FROM item_status_history
WHERE item_id = $1
ORDER BY updated_at;
```

## JSONB Patterns

```sql
-- Always use JSONB, never JSON
metadata JSONB NOT NULL DEFAULT '{}'::jsonb

-- Containment query (uses GIN index)
SELECT * FROM items WHERE metadata @> '{"tags": ["critical"]}'::jsonb;

-- Key existence
SELECT * FROM items WHERE metadata ? 'priority';

-- Text extraction
SELECT id, metadata ->> 'priority' AS priority FROM items;

-- Nested path
SELECT id, metadata #>> '{contact,email}' AS email FROM items;

-- Update: set field
UPDATE items SET metadata = metadata || jsonb_build_object('priority', 'high')
WHERE id = $1;

-- Update: remove key
UPDATE items SET metadata = metadata - 'old_key' WHERE id = $1;

-- GIN index for JSONB
CREATE INDEX idx_items_metadata ON items USING gin(metadata);
-- Or path-specific: CREATE INDEX idx_tags ON items USING gin((metadata -> 'tags'));
```

## Queue Pattern (FOR UPDATE SKIP LOCKED)

```sql
-- name: ClaimNextJob :one
UPDATE jobs SET
    status = 'processing',
    locked_at = NOW(),
    locked_by = $1
WHERE id = (
    SELECT id FROM jobs
    WHERE status = 'pending'
        AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '5 minutes')
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
) RETURNING *;
```

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

## Migration Standards (goose)

```sql
-- +goose Up
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'pending', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS items;
```

### Safe vs Dangerous Operations

| Safe (Brief or No Lock) | Dangerous (Long Lock / Rewrite) |
|---|---|
| `CREATE TABLE` | `ALTER COLUMN TYPE` (full table rewrite) |
| `ADD COLUMN` (nullable or with DEFAULT, PG 11+) | `ADD COLUMN NOT NULL` without DEFAULT (pre-PG 11) |
| `CREATE INDEX CONCURRENTLY` | `CREATE INDEX` (blocks writes) |
| `ADD CONSTRAINT ... NOT VALID` | `ADD CONSTRAINT` (scans all rows) |
| `DROP INDEX CONCURRENTLY` | `DROP COLUMN` (data loss) |
| `ALTER TYPE ADD VALUE` | `ALTER TYPE` rename value |
| `VALIDATE CONSTRAINT` (after NOT VALID) | Large single-statement backfills |

### Zero-Downtime Migration Patterns

**Always create indexes concurrently:**
```sql
-- +goose NO TRANSACTION
-- +goose Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_org_status
    ON items (organization_id, status);
-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS idx_items_org_status;
```

**Add NOT NULL constraints safely (two-phase):**
```sql
-- Phase 1: Add CHECK constraint without validation (instant)
ALTER TABLE items ADD CONSTRAINT chk_title_nn
    CHECK (title IS NOT NULL) NOT VALID;

-- Phase 2: Validate (lightweight lock, no rewrite)
ALTER TABLE items VALIDATE CONSTRAINT chk_title_nn;

-- Phase 3: Now SET NOT NULL skips the scan
ALTER TABLE items ALTER COLUMN title SET NOT NULL;

-- Phase 4: Drop redundant CHECK
ALTER TABLE items DROP CONSTRAINT chk_title_nn;
```

**Change column types safely (column swap):**
```sql
-- Step 1: Add new column
ALTER TABLE items ADD COLUMN status_new VARCHAR(50);
-- Step 2: Backfill in batches (in Go code)
-- Step 3: Add NOT NULL constraint (two-phase above)
-- Step 4: Swap columns
ALTER TABLE items RENAME COLUMN status TO status_old;
ALTER TABLE items RENAME COLUMN status_new TO status;
-- Step 5: Drop old column (later migration)
ALTER TABLE items DROP COLUMN status_old;
```

**Backfill data safely (batched):**
```sql
-- NEVER: UPDATE items SET new_col = compute(old_col);  -- locks all rows
-- ALWAYS: batch with LIMIT + SKIP LOCKED
UPDATE items SET new_col = compute(old_col)
WHERE id IN (
    SELECT id FROM items WHERE new_col IS NULL
    ORDER BY id LIMIT 5000
    FOR UPDATE SKIP LOCKED
);
```

**Migration ordering for schema changes:**
1. Migration 1: Add new columns/tables/indexes (additive)
2. Deploy app: Code reads old + new, writes to both
3. Migration 2: Backfill data
4. Migration 3: Add constraints (NOT VALID then VALIDATE)
5. Deploy app: Code reads/writes only new
6. Migration 4: Drop old columns/tables (cleanup)

### PL/pgSQL in Migrations

```sql
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION prevent_org_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.organization_id != NEW.organization_id THEN
        RAISE EXCEPTION 'Cannot change organization_id on %', TG_TABLE_NAME;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd
```

## Data Integrity

### CHECK Constraints

```sql
-- Enum-like validation
CHECK (status IN ('active', 'pending', 'archived', 'completed'))

-- Range validation
CHECK (min_value >= 0 AND max_value >= min_value)

-- Conditional constraint
CHECK ((status != 'completed') OR (completed_at IS NOT NULL))
```

### EXCLUSION Constraints (Prevent Overlaps)

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent overlapping schedules per user per org
CREATE TABLE on_call_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    during TSTZRANGE NOT NULL,
    EXCLUDE USING gist (organization_id WITH =, user_id WITH =, during WITH &&)
);
```

### Domain Types

```sql
CREATE DOMAIN email AS TEXT
    CHECK (VALUE ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

CREATE DOMAIN slug AS TEXT
    CHECK (VALUE ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(VALUE) BETWEEN 1 AND 128);
```

## Partitioning

### Range Partitioning (Time-Series)

```sql
CREATE TABLE audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    organization_id UUID NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_2024_q1 PARTITION OF audit_log
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

-- Drop old data instantly (no VACUUM needed)
ALTER TABLE audit_log DETACH PARTITION audit_log_2023_q1 CONCURRENTLY;
DROP TABLE audit_log_2023_q1;
```

**When to partition:**
- Tables exceeding ~100M rows where queries always filter on partition key
- Time-series data with retention policies
- Avoid if queries don't consistently filter on partition key

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

## Anti-Patterns

| Anti-Pattern | Correct Pattern |
|---|---|
| `SELECT *` in production | Select only needed columns |
| `OFFSET` pagination on large tables | Cursor/keyset pagination |
| Missing index on foreign keys | Always index FK columns |
| `timestamp` without timezone | Always use `timestamptz` |
| `float`/`double` for money | Use `numeric(12,2)` |
| N+1 queries in loops | Use JOINs or batch queries |
| Missing `organization_id` filter | Every tenant query filters by org |
| `NOT IN (subquery)` with NULLs | Use `NOT EXISTS` instead |
| `CREATE INDEX` in migration | `CREATE INDEX CONCURRENTLY` |
| `COUNT(*)` for existence check | `EXISTS (SELECT 1 ...)` |
| `json` column type | Always use `jsonb` |
| `DELETE` from large tables | Partitioning + `DROP TABLE` for retention |
| Single large backfill UPDATE | Batch with LIMIT + SKIP LOCKED |
| `ADD CONSTRAINT` (validates immediately) | `ADD CONSTRAINT ... NOT VALID` then `VALIDATE` |
| `ALTER COLUMN TYPE` | Column swap pattern (add -> backfill -> rename) |
| Functions on indexed columns in WHERE | Expression index matching the function |

---
name: postgres-patterns
description: PostgreSQL patterns for {{PROJECT_NAME}}. Multi-tenant queries, sqlc patterns, index design, RLS, full-text search, goose migrations. Use when writing SQL queries, creating migrations, designing schemas, or troubleshooting slow queries.
compatibility: PostgreSQL 16+, sqlc, goose, pgx/v5
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

**Always create indexes concurrently:**
```sql
-- +goose NO TRANSACTION
-- +goose Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_org_status
    ON items (organization_id, status);
-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS idx_items_org_status;
```

**Migration ordering for schema changes:**
1. Migration 1: Add new columns/tables/indexes (additive)
2. Deploy app: Code reads old + new, writes to both
3. Migration 2: Backfill data
4. Migration 3: Add constraints (NOT VALID then VALIDATE)
5. Deploy app: Code reads/writes only new
6. Migration 4: Drop old columns/tables (cleanup)

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

## Additional References

- For advanced query patterns (window functions, CTEs, LATERAL joins, JSONB), see [references/advanced-queries.md](references/advanced-queries.md)
- For migration safety and zero-downtime patterns, see [references/migration-safety.md](references/migration-safety.md)
- For query optimization and monitoring, see [references/performance.md](references/performance.md)
- For data integrity constraints and partitioning, see [references/data-integrity.md](references/data-integrity.md)

# Advanced Query Patterns

## DISTINCT ON (Top-1 Per Group)

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

## LATERAL Joins (Top-N Per Group)

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

## CTE Materialization (PostgreSQL 12+)

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

## CTE Multi-Step Operations

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

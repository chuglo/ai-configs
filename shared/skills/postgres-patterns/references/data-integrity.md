# Data Integrity

## CHECK Constraints

```sql
-- Enum-like validation
CHECK (status IN ('active', 'pending', 'archived', 'completed'))

-- Range validation
CHECK (min_value >= 0 AND max_value >= min_value)

-- Conditional constraint
CHECK ((status != 'completed') OR (completed_at IS NOT NULL))
```

## EXCLUSION Constraints (Prevent Overlaps)

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

## Domain Types

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

# Migration Safety

## Safe vs Dangerous Operations

| Safe (Brief or No Lock) | Dangerous (Long Lock / Rewrite) |
|---|---|
| `CREATE TABLE` | `ALTER COLUMN TYPE` (full table rewrite) |
| `ADD COLUMN` (nullable or with DEFAULT, PG 11+) | `ADD COLUMN NOT NULL` without DEFAULT (pre-PG 11) |
| `CREATE INDEX CONCURRENTLY` | `CREATE INDEX` (blocks writes) |
| `ADD CONSTRAINT ... NOT VALID` | `ADD CONSTRAINT` (scans all rows) |
| `DROP INDEX CONCURRENTLY` | `DROP COLUMN` (data loss) |
| `ALTER TYPE ADD VALUE` | `ALTER TYPE` rename value |
| `VALIDATE CONSTRAINT` (after NOT VALID) | Large single-statement backfills |

## Zero-Downtime Migration Patterns

### Add NOT NULL Constraints Safely (Two-Phase)

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

### Change Column Types Safely (Column Swap)

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

### Backfill Data Safely (Batched)

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

### Migration Ordering for Schema Changes

1. Migration 1: Add new columns/tables/indexes (additive)
2. Deploy app: Code reads old + new, writes to both
3. Migration 2: Backfill data
4. Migration 3: Add constraints (NOT VALID then VALIDATE)
5. Deploy app: Code reads/writes only new
6. Migration 4: Drop old columns/tables (cleanup)

## PL/pgSQL in Migrations

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

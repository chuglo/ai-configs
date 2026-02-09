---
description: "Create or review database migrations with goose. Usage: /migrate <name>"
---

# Migrate Command

Invokes the **database-reviewer** agent for migration work.

**Migration name**: $1

## Create Migration

```bash
goose -dir internal/store/migrations create $1 sql
```

## Migration Rules

1. **Always reversible** -- Include both Up and Down sections
2. **Non-locking** -- Use `CREATE INDEX CONCURRENTLY` for indexes
3. **Safe defaults** -- `ADD COLUMN ... DEFAULT ...` (Postgres 11+)
4. **Test rollback** -- Verify Down migration works

## Template

```sql
-- +goose Up
-- +goose StatementBegin
CREATE TABLE new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_new_table_org ON new_table(organization_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS new_table;
-- +goose StatementEnd
```

## After Migration

1. Update sqlc queries if needed: `internal/store/queries/*.sql`
2. Regenerate: `sqlc generate`
3. Update `docs/ARCHITECTURE.md` data model section
4. Run: `make migrate && make test`

## Commands

```bash
make migrate                    # Run migrations up
make migrate-down               # Roll back one
goose -dir internal/store/migrations postgres "$DATABASE_URL" status
```

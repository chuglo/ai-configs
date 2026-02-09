---
description: Review PostgreSQL schema, sqlc queries, goose migrations, and RLS policies.
---

# Database Review

Invokes the **database-reviewer** agent.

## Checks

1. **Schema Design** -- Proper types, constraints, indexes
2. **sqlc Queries** -- Correct annotations, parameterized, org_id filtered
3. **Migrations** -- Non-locking, reversible, CONCURRENTLY for indexes
4. **RLS Policies** -- Enabled on tenant tables, optimized
5. **Performance** -- EXPLAIN ANALYZE on complex queries, no N+1

## Key Files

- `internal/store/queries/*.sql` -- sqlc query definitions
- `internal/store/migrations/*.sql` -- goose migrations
- `sqlc.yaml` -- sqlc configuration

## Commands

```bash
sqlc generate                       # Regenerate Go from SQL
goose -dir internal/store/migrations postgres "$DATABASE_URL" up
goose -dir internal/store/migrations postgres "$DATABASE_URL" status
```

---
description: Update architecture and API documentation to match current codebase.
---

# Update Docs

Invokes the **doc-updater** agent.

## Documentation Files

Scan ALL project documentation for staleness:

- `docs/ARCHITECTURE.md` -- Tech stack, data model, API design, security, deployment
- `docs/ROADMAP.md` -- Feature phases, completion status, exit criteria
- `.opencode/instructions/INSTRUCTIONS.md` -- Dev workflow, conventions, agent table
- `README.md` -- Project overview, quick start

Also check for any other `*.md` files in `docs/` that may have been added.

## Process

1. Check `git diff --name-only` and `git log --oneline -10` to identify what changed
2. If a DocWatch alert is present (plugin detected architecture-relevant edits), use that as your starting point for which areas to focus on
3. If a DecisionWatch alert is present (plugin detected decision-like language), prioritize capturing those decisions with rationale
4. **If ROADMAP.md will be affected**, ask the user about current project status before making changes (in-progress work, deferrals, new items, priority shifts). The user can say "just sync from git" to skip.
5. For each doc, scan its headings to understand what it covers
6. Match changed source files against doc content to find stale or missing sections
7. Update ONLY the affected sections across ALL relevant docs -- examples:
   - **Code changes** (handlers, domain, middleware) -> ARCHITECTURE.md
   - **Feature completion** (new migration, handler, tests passing) -> ROADMAP.md phase checklists
   - **Feature deferral/promotion** -> ROADMAP.md (add rationale inline)
   - **Architecture decisions** -> ARCHITECTURE.md (relevant section or "Key Decisions")
   - **Workflow changes** (new agent, command, skill) -> INSTRUCTIONS.md tables
   - **Setup changes** (new env var, Docker change) -> README.md + ARCHITECTURE.md deployment
8. Verify accuracy: file paths exist, code examples match, endpoints match routes
9. Update `**Last Updated:** YYYY-MM-DD` timestamps on modified docs
10. Show the user a summary of what was changed and why, per doc

## When to Update

- New API endpoints added
- Database schema changed (new migrations)
- RBAC roles or permissions modified
- New background job types
- New environment variables
- Docker Compose changes
- Build/dev workflow changes
- New agents, commands, or skills added
- Feature milestone completed (update ROADMAP.md phase status)
- Feature deferred or promoted between phases (capture rationale)
- Architectural decisions made during session (capture the "why")
- Scope changes (features added, removed, or redefined)

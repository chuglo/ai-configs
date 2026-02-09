---
name: parallel-worktrees
description: Git worktree management for parallel multi-agent development. Setup, conventions, conflict avoidance, and merge strategy for running multiple agents on separate features simultaneously. Use via /worktree command or when setting up parallel development.
disable-model-invocation: true
argument-hint: "[create|list|remove] [name]"
---

# Parallel Worktrees for Multi-Agent Development

Use git worktrees to run multiple agents on separate features simultaneously, each in their own isolated working directory sharing the same git history.

## CRITICAL: Working Directory Enforcement

**When you create or use a worktree, you MUST switch your working directory to it.**

This is the #1 failure mode: creating a worktree but continuing to edit files and run commands in the main repo directory. This causes:
- Changes committed to `main` instead of the feature branch
- Files modified in the wrong directory (main repo instead of worktree)
- The worktree sitting empty while all work lands on `main`

### Rules

1. **After `git worktree add`**, immediately switch ALL operations to the worktree path:
   - Bash tool: use `workdir="{{PROJECT_ROOT}}/.worktrees/<name>"` on EVERY call
   - Read/Write/Edit tools: use absolute paths under `{{PROJECT_ROOT}}/.worktrees/<name>/`
   - NEVER use `{{PROJECT_ROOT}}/internal/...` when a worktree is active — use `{{PROJECT_ROOT}}/.worktrees/<name>/internal/...`

2. **Git commands run from the worktree directory automatically target the worktree's branch.** You do NOT need to `git checkout` — the worktree is already on its branch.

3. **Announce the switch** so it's visible in the conversation:
   > "All subsequent operations will use worktree `.worktrees/<name>/` on branch `feat/<name>`."

4. **When removing a worktree**, switch back to the main repo directory and announce it.

5. **Verify you're in the right place** before committing:
   ```bash
   # From the worktree directory:
   git branch --show-current   # Should show feat/<name>, NOT main
   pwd                          # Should show .worktrees/<name>
   ```

## Why Worktrees?

Multiple agents on the same branch = merge conflicts, overwritten files, broken builds. Worktrees solve this by giving each agent a **physically separate directory** with its own branch checkout, while sharing the same `.git` repository.

```
{{PROJECT_ROOT}}/                              <-- main worktree (primary agent)
{{PROJECT_ROOT}}/.worktrees/
  +-- team-dashboard/                      <-- agent 2
  +-- api-keys/                            <-- agent 3
  +-- export-fix/                          <-- agent 4
```

**Key properties:**
- Each worktree has its own branch — git prevents two worktrees from checking out the same branch
- All worktrees share the same git history — commits from any worktree are visible to all
- No clone overhead — worktrees are lightweight checkouts, not full copies
- Each worktree has its own working files, staged changes, and build artifacts
- `.worktrees/` is gitignored — worktrees are local-only, never committed

## Worktree Lifecycle

### 1. Create a Worktree

```bash
# From the main repo directory:
git worktree add .worktrees/<name> -b <branch-name>

# Examples:
git worktree add .worktrees/team-dashboard -b feat/team-dashboard
git worktree add .worktrees/export-fix -b fix/export main
```

**Naming conventions:**
- Directory: `.worktrees/<short-name>` (kebab-case, no `feat/` prefix in dir name)
- Branch: `feat/<feature-name>`, `fix/<bug-name>`, `chore/<task-name>` (standard git flow)

### 2. Initialize the Worktree

After creating a worktree, it needs its own dependency installation:

```bash
# Frontend dependencies (each worktree needs its own node_modules)
cd .worktrees/<name>/web && npm install

# Go dependencies are shared via module cache, no action needed
# But verify the build works:
cd .worktrees/<name> && go build ./...
```

### 3. Switch to the Worktree (CRITICAL)

**If you are the agent that created the worktree, YOU must switch to it immediately.** Do not continue working in the main repo directory.

From this point forward, every tool call must target the worktree:
- `workdir="{{PROJECT_ROOT}}/.worktrees/<name>"` for Bash
- `{{PROJECT_ROOT}}/.worktrees/<name>/...` for file paths

Alternatively, launch a separate Claude Code session with the worktree as its working directory. Either way, the agent works in complete isolation — it cannot see or modify files in other worktrees.

### 4. Merge When Complete

```bash
# From the main worktree:
git merge feat/team-dashboard

# Or create a PR from the branch (worktree doesn't matter for PRs):
cd .worktrees/team-dashboard
gh pr create --title "feat(api): add team dashboard" --body "..."
```

### 5. Clean Up

```bash
# Remove the worktree (after merge):
git worktree remove .worktrees/team-dashboard

# Delete the branch (after merge):
git branch -d feat/team-dashboard

# List all worktrees to verify:
git worktree list
```

## Conflict Avoidance Strategy

The main risk with parallel development isn't file-level conflicts (worktrees prevent that) — it's **logical conflicts** when features touch the same shared resources.

### High-Risk Shared Files

These files are modified by almost every feature. Coordinate carefully:

| File | Risk | Mitigation |
|------|------|------------|
| `internal/server/routes.go` | Route registration | Each agent adds routes in a clearly separated block. Merge conflicts are simple line additions. |
| `internal/config/config.go` | New env vars | Each agent adds config fields in alphabetical order within their section. |
| `internal/handler/handler.go` | Handler struct / interfaces | Add new interface methods at the end. Merge conflicts are append-only. |
| `go.mod` / `go.sum` | Dependencies | Run `go mod tidy` after merge to reconcile. |
| `web/package.json` | NPM dependencies | Run `npm install` after merge to reconcile. |
| `web/src/lib/types.ts` | Shared TypeScript types | Each agent adds types in their own clearly-commented section. |

### Database Migration Numbering

**This is the most critical coordination point.** Two agents creating migration `005_*.sql` will collide.

**Rule: Pre-assign migration numbers before creating worktrees.**

```
Agent 1 (feature A):  005_feature_a.sql
Agent 2 (feature B):  006_feature_b.sql
Agent 3 (feature C):  007_feature_c.sql
```

After merging all branches, verify migration order is correct:
```bash
ls -1 internal/store/migrations/*.sql
goose -dir internal/store/migrations postgres "$DATABASE_URL" status
```

### sqlc Code Generation

Each worktree has its own `internal/store/sqlc/` directory. This is fine during development. But after merging:

```bash
# Re-run sqlc to pick up all merged queries:
sqlc generate

# Verify the build:
go build ./...
```

**Rule:** Never commit sqlc-generated code from a worktree merge without re-running `sqlc generate` on the merged result.

### Frontend Route Conflicts

If two agents add pages under the same route group, they'll conflict in the App Router directory structure.

**Rule:** Assign route ownership per agent:
```
Agent 1: web/src/app/(dashboard)/feature-a/     <-- owns this route tree
Agent 2: web/src/app/(dashboard)/feature-b/      <-- owns this route tree
Agent 3: web/src/app/(dashboard)/settings/keys/  <-- owns this route tree
```

## Pre-Flight Checklist

Before creating worktrees for parallel work, verify:

- [ ] **Main branch is clean** — no uncommitted changes, all tests pass
- [ ] **Migration numbers assigned** — each agent knows their migration sequence number(s)
- [ ] **Route ownership assigned** — each agent knows which URL paths they own
- [ ] **Shared file strategy agreed** — who modifies `config.go`, `routes.go`, etc. (or defer to merge time)
- [ ] **Each worktree initialized** — `npm install` in `web/`, `go build ./...` passes

## Post-Merge Checklist

After merging a feature branch back:

- [ ] `sqlc generate` — regenerate from all merged queries
- [ ] `go build ./...` — verify Go compilation
- [ ] `golangci-lint run ./...` — verify lint passes
- [ ] `cd web && npm install && npm run build` — verify frontend compilation
- [ ] `go test -race ./...` — run full test suite
- [ ] `goose status` — verify migration sequence is correct
- [ ] Resolve any merge conflicts in shared files (`config.go`, `routes.go`, `types.ts`)

## Worktree Status Overview

To see all active worktrees and their state:

```bash
# List all worktrees with branch info:
git worktree list

# Check status of a specific worktree:
git -C .worktrees/<name> status

# See all branches across worktrees:
git branch -a
```

## Troubleshooting

### "fatal: '<branch>' is already checked out"
A branch can only be checked out in one worktree at a time. Either:
- Use a different branch name
- Remove the existing worktree first: `git worktree remove <path>`

### Worktree has uncommitted changes when trying to remove
```bash
# Force remove (discards changes):
git worktree remove --force <path>

# Or commit/stash first:
cd <worktree-path> && git stash
git worktree remove <path>
```

### Stale worktree references
If a worktree directory was deleted without `git worktree remove`:
```bash
git worktree prune
```

### Build fails after merge
Almost always caused by:
1. Missing `sqlc generate` — run it
2. Conflicting migration numbers — renumber and re-run `goose up`
3. Missing `npm install` — dependency added by the other branch

## Integration with Other Skills

| Skill | Integration |
|-------|-------------|
| `verification-loop` | Run `/verify` in each worktree independently before merging, and again on the merged result |
| `strategic-compact` | Each agent session manages its own compaction independently |
| `coding-standards` | All worktrees follow the same standards — no divergence |
| `continuous-learning-v2` | Instincts are shared (they live in the main `.opencode/` which all worktrees see via git) |

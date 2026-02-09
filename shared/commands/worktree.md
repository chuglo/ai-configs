---
description: Manage git worktrees for parallel multi-agent development. Usage: /worktree create feat-name | /worktree list | /worktree remove feat-name | /worktree status
---

# Worktree Management

**Action**: $1 (create, list, remove, status)
**Name**: $2

Load the `parallel-worktrees` skill for full conventions and conflict avoidance strategy.

## CRITICAL: Working Directory Rule

**After creating or switching to a worktree, ALL subsequent file operations and commands MUST use the worktree path as the working directory.**

- Use `workdir` parameter on every Bash tool call: `workdir="{{PROJECT_ROOT}}/.worktrees/$2"`
- Use absolute paths for Read/Write/Edit tools: `{{PROJECT_ROOT}}/.worktrees/$2/internal/...`
- Git commits go to the worktree's branch automatically when you run git commands from the worktree directory
- NEVER run git add/commit/status from the main repo directory when intending to commit worktree changes

**Announce the switch clearly:**
> "Switching working directory to `.worktrees/$2/`. All subsequent operations will target this worktree on branch `feat/$2`."

## Actions

### create

Create a new worktree for parallel agent development.

1. Verify main worktree is clean (`git status`)
2. Create worktree and branch:
   ```bash
   git worktree add .worktrees/$2 -b feat/$2
   ```
3. **SWITCH WORKING DIRECTORY** — from this point forward, ALL commands use:
   - `workdir="{{PROJECT_ROOT}}/.worktrees/$2"` for Bash calls
   - Absolute paths under `{{PROJECT_ROOT}}/.worktrees/$2/` for file reads/writes
4. Initialize frontend dependencies (from worktree):
   ```bash
   # workdir: .worktrees/$2/web
   npm install
   ```
5. Verify Go build (from worktree):
   ```bash
   # workdir: .worktrees/$2
   go build ./...
   ```
6. Report:
   - Worktree path: `.worktrees/$2/`
   - Branch name: `feat/$2`
   - **Working directory is now**: `{{PROJECT_ROOT}}/.worktrees/$2`
   - Next available migration number (check `ls internal/store/migrations/*.sql`)
   - Reminder to assign route ownership if adding frontend pages

### list

List all active worktrees with their branch and status:
```bash
git worktree list
```

For each worktree, also show:
- Uncommitted changes count
- Branch ahead/behind status
- Last commit message

### remove

Remove a worktree after its branch has been merged.

1. Check for uncommitted changes in the worktree
2. Warn if the branch hasn't been merged to main
3. Remove the worktree:
   ```bash
   git worktree remove .worktrees/$2
   ```
4. Optionally delete the branch if merged:
   ```bash
   git branch -d feat/$2
   ```
5. **SWITCH WORKING DIRECTORY BACK** to main repo:
   > "Switching working directory back to `{{PROJECT_ROOT}}/` (main worktree)."

### status

Show detailed status of all worktrees:
```bash
git worktree list
```

For each worktree, report:
- Branch name and last commit
- Files changed (staged + unstaged)
- Migration files present (to detect numbering conflicts)
- Whether `sqlc generate` or `npm install` may be needed

### merge-check

Pre-merge validation for a worktree branch:

1. Run verification loop in the worktree (`/verify`)
2. Check for migration number conflicts with other branches
3. Dry-run merge to detect conflicts:
   ```bash
   git merge --no-commit --no-ff feat/$2
   git merge --abort
   ```
4. Report potential conflicts and resolution strategy

## Default

If no action specified, default to `list`.

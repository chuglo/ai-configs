---
description: "Show current project status — phase, progress, recent decisions, and next steps. Read-only synthesis from existing docs."
---

# Project Status

Synthesize the current project state from existing documentation and git history. This is a **read-only** command — it does NOT modify any files.

**Optional focus area**: $ARGUMENTS

## Your Task

Produce a concise project status report by reading and cross-referencing existing sources. Think of this as `git status` but for the project as a whole.

## Process

1. **Read project docs** — Scan these files (skip any that don't exist):
   - `docs/ROADMAP.md` — phases, completion status, exit criteria
   - `docs/ARCHITECTURE.md` — tech stack, current design
   - `docs/PRD.md` — product requirements, success criteria
   - `README.md` — project overview
   - Any other `docs/*.md` files

2. **Read recent git history**:
   - `git log --oneline -20` — recent commits
   - `git status --short` — uncommitted work
   - `git branch --show-current` — current branch
   - `git stash list` — any stashed work

3. **Read session notes** (if they exist):
   - Check `.opencode/sessions/` for the most recent session notes file
   - Extract any "In Progress", "Next Steps", or "Open Questions" sections

4. **Synthesize** — Produce the status report using the template below.

## Output Template

```
## Project Status — <date>

### Current Phase
<Which phase/milestone is active? What's the goal?>

### Progress
- **Completed**: <recent completions from ROADMAP.md checked items and git log>
- **In Progress**: <what's being worked on now — from session notes, uncommitted changes, branch name>
- **Remaining**: <unchecked items in current phase>

### Recent Decisions
<Any decisions visible in git log messages, session notes, or ROADMAP.md deferral notes>
- **<Decision>**: <Rationale if available>

### Blockers / Open Questions
<Anything marked as blocked, deferred, or needing human input>

### Next Steps
<What should be picked up next based on ROADMAP.md priority and current state>

### Health Check
- **Branch**: <current branch>
- **Uncommitted changes**: <yes/no>
- **Stashes**: <count or none>
- **Exit criteria progress**: <X of Y met for current phase>
```

## Important Notes

- This command is **read-only** — do NOT edit any files
- If the user provided a focus area (e.g. `/status auth` or `/status phase 1.4`), zoom into that area specifically
- Be concise — this is a quick status check, not a full report
- Cross-reference sources — if ROADMAP.md says something is "IN PROGRESS" but git log shows it was completed 3 days ago, note the discrepancy
- If no ROADMAP.md exists, synthesize from whatever docs are available
- If no docs exist at all, report based on git history and file structure alone

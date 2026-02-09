---
description: "Generate session notes (work log + continuity context). Usage: /session-notes [descriptive-name]"
---

# Session Notes

Generate a structured session handoff document capturing what happened and what's next.

**Optional name/context**: $ARGUMENTS

## Your Task

Create a session notes file at `.opencode/sessions/SESSION_<YYYY-MM-DD_HH-MM>_<descriptive-name>.md` that serves two purposes:

1. **Work log** — What was accomplished this session (for your future self)
2. **Continuity context** — What to pick up next session (for the next agent instance)

## Process

1. **Gather state** — Run these commands to understand the current state:
   - `git branch --show-current`
   - `git status --short`
   - `git log --oneline -10`
   - `git diff --stat`
   - `git stash list` (if any)

2. **Read previous notes** — Check `.opencode/sessions/` for the most recent session notes file. Read it to understand continuity from the last session.

3. **Review conversation** — Look at the conversation history and todo list to capture:
   - What tasks were worked on
   - What decisions were made and why
   - What's partially done
   - What's blocked or needs human input

4. **Write the notes** — Generate the file using the template below.

5. **Prune old files** — List files in `.opencode/sessions/`, sort by name (they're timestamp-based), and delete all but the 5 most recent.

## Template

```markdown
# Session Notes — <YYYY-MM-DD HH:MM>

## Summary
<2-3 sentence overview of what this session accomplished>

## Work Completed
- <completed item with relevant file paths>
- <completed item>

## Decisions Made
- **<Decision>**: <Rationale>

## Files Changed
<from git status/diff — list modified files with brief description of what changed>

## Current State
- **Branch**: <current branch>
- **Build status**: <passing/failing/unknown>
- **Uncommitted changes**: <yes/no — brief summary>
- **Todo list**: <summary of pending todos if any>

## In Progress
<what's partially done, where it left off, what state it's in>

## Next Steps
- [ ] <what to pick up next>
- [ ] <follow-up items>

## Open Questions
<anything unresolved that needs human decision — omit section if none>

## Context for Next Session
<any important context that would be lost without this note — key file paths,
architectural decisions in progress, tricky bugs being debugged, etc.>
```

## Filename Convention

The filename should be: `SESSION_<YYYY-MM-DD_HH-MM>_<descriptive-name>.md`

- If the user provided a name argument (e.g. `/session-notes security-fixes`), use that as the descriptive name
- Otherwise, derive a short descriptive name from the work done:
  - Use the primary domain/feature worked on (e.g. `auth-csrf`, `report-handler`, `frontend-dashboard`)
  - Keep it to 2-4 words, kebab-case
  - Examples: `security-fixes`, `handler-auth-team`, `plugin-refactor`, `db-migration-roles`

## Important Notes

- Be **concrete** — include file paths, function names, error messages
- Be **concise** — this is a reference document, not a narrative
- Focus on **what would be lost** if the conversation context disappeared
- If the user provided a message with the command, incorporate it as additional context
- The notes file should be self-contained — a new agent instance should be able to read it and pick up where you left off

---

**TIP**: Run `/session-notes` before `/compact`, at the end of a session, or after completing a major milestone.

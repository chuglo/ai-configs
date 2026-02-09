---
name: strategic-compact
description: Suggests manual context compaction at logical workflow boundaries rather than relying on arbitrary auto-compaction.
---

# Strategic Compact Skill

Suggests manual `/compact` at strategic points in your workflow rather than relying on arbitrary auto-compaction.

## Why Strategic Compaction?

Auto-compaction triggers at arbitrary points:
- Often mid-task, losing important context
- No awareness of logical task boundaries
- Can interrupt complex multi-step operations

Strategic compaction at logical boundaries:
- **After exploration, before execution** -- Compact research context, keep implementation plan
- **After completing a milestone** -- Fresh start for next phase
- **Before major context shifts** -- Clear exploration context before different task

## When to Compact in {{PROJECT_NAME}} Workflows

### Backend Development (Go)
1. **After reading architecture docs + domain code, before writing handler** -- You've gathered context, now compact to start clean
2. **After writing SQL queries, before running sqlc generate** -- Query design is done, implementation phase begins
3. **After fixing build errors, before writing tests** -- Error resolution context is no longer needed
4. **After completing a migration, before writing handler code** -- Schema is set, move to application layer

### Frontend Development (Next.js)
1. **After reviewing API types + existing components, before writing new component** -- Research is done
2. **After implementing a page, before writing tests** -- Implementation context can be summarized
3. **After resolving TypeScript errors, before feature work** -- Type fixes are done

### Cross-Stack Work
1. **After planning phase (/plan), before implementation** -- Plan is captured in todo list
2. **After backend API is complete, before frontend integration** -- API contract is defined
3. **After each completed feature in a multi-feature task** -- Reset for next feature

## Threshold Guidelines

| Session Activity | Suggested Compact Point |
|------------------|------------------------|
| 30-50 tool calls | Consider if transitioning phases |
| 50-75 tool calls | Strongly recommended at next boundary |
| 75+ tool calls | Compact immediately at any logical pause |

## How to Compact Effectively

Before compacting, ensure:
1. **Run `/session-notes`** -- Capture rich session state with conversation context before it's lost
2. **Todo list is current** -- All progress tracked in todos (survives compaction)
3. **Key decisions are in code** -- Comments, variable names, not just conversation
4. **Files are saved** -- All edits written to disk

> **Note**: The plugin automatically writes lightweight session notes on compaction via the `experimental.session.compacting` hook. Running `/session-notes` manually produces richer notes that include conversation context and decision rationale.

After compacting:
1. Review the compacted summary
2. Check todo list for next task
3. Re-read only the files needed for the next phase

## Best Practices

1. **Compact after planning** -- Once plan is finalized, compact to start fresh
2. **Compact after debugging** -- Clear error-resolution context before continuing
3. **Don't compact mid-implementation** -- Preserve context for related changes
4. **Use todo list as persistence** -- Todos survive compaction, conversation doesn't
5. **Never compact during a migration** -- Schema changes need full context until committed

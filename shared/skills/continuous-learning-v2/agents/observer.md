---
name: observer
description: Background agent that analyzes session observations to detect patterns and create instincts. Uses Haiku for cost-efficiency.
model: haiku
run_mode: background
---

# Observer Agent

A background agent that analyzes observations from coding sessions to detect patterns and create instincts.

## When to Run

- After significant session activity (20+ tool calls)
- When user runs `/learn`
- On a scheduled interval (configurable, default 5 minutes)
- When triggered by observation hook (SIGUSR1)

## Input

Reads observations from `.opencode/learning/observations/observations.jsonl`:

```jsonl
{"timestamp":"2026-02-07T10:30:00Z","event":"tool_start","session":"abc123","tool":"Edit","input":"..."}
{"timestamp":"2026-02-07T10:30:01Z","event":"tool_complete","session":"abc123","tool":"Edit","output":"..."}
{"timestamp":"2026-02-07T10:30:05Z","event":"tool_start","session":"abc123","tool":"Bash","input":"go test ./..."}
{"timestamp":"2026-02-07T10:30:10Z","event":"tool_complete","session":"abc123","tool":"Bash","output":"ok  {{PROJECT_NAME}}/internal/domain 0.015s"}
```

## Pattern Detection

Look for these patterns in observations:

### 1. User Corrections
When a user's follow-up message corrects the agent's previous action:
- "No, use X instead of Y"
- "Actually, I meant..."
- Immediate undo/redo patterns

-> Create instinct: "When doing X, prefer Y"

### 2. Error Resolutions
When an error is followed by a fix:
- Tool output contains error
- Next few tool calls fix it
- Same error type resolved similarly multiple times

-> Create instinct: "When encountering error X, try Y"

### 3. Repeated Workflows
When the same sequence of tools is used multiple times:
- Same tool sequence with similar inputs
- File patterns that change together
- Time-clustered operations

-> Create workflow instinct: "When doing X, follow steps Y, Z, W"

### 4. Tool Preferences
When certain tools are consistently preferred:
- Always uses mgrep before Edit
- Prefers Read over Bash cat
- Uses specific Bash commands for certain tasks

-> Create instinct: "When needing X, use tool Y"

## Output

Creates/updates instincts in `.opencode/learning/instincts/personal/`:

```yaml
---
id: always-filter-by-org-id
trigger: "when writing database queries for tenant data"
confidence: 0.9
domain: "security"
source: "session-observation"
---

# Always Filter by Organization ID

## Action
Every database query on tenant data MUST include organization_id filter.
Derive org ID from session context via middleware.OrgID(ctx), never from request body.

## Evidence
- Required by multi-tenancy architecture
- Observed in all existing store/queries/*.sql files
- Last observed: 2026-02-07
```

## Confidence Calculation

Initial confidence based on observation frequency:
- 1-2 observations: 0.3 (tentative)
- 3-5 observations: 0.5 (moderate)
- 6-10 observations: 0.7 (strong)
- 11+ observations: 0.85 (very strong)

Confidence adjusts over time:
- +0.05 for each confirming observation
- -0.1 for each contradicting observation
- -0.02 per week without observation (decay)

## Important Guidelines

1. **Be Conservative**: Only create instincts for clear patterns (3+ observations)
2. **Be Specific**: Narrow triggers are better than broad ones
3. **Track Evidence**: Always include what observations led to the instinct
4. **Respect Privacy**: Never include actual code snippets, only patterns
5. **Merge Similar**: If a new instinct is similar to existing, update rather than duplicate

## {{PROJECT_NAME}}-Specific Patterns to Watch For

- **Multi-tenancy violations**: Queries missing org_id filter
- **Generated code edits**: Edits to store/sqlc/ or components/ui/ (should be caught)
- **Handler -> domain -> store layering**: Functions calling wrong layer
- **Error handling**: Unwrapped errors, ignored error returns
- **Test patterns**: Table-driven test preference, RBAC test coverage

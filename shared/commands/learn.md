---
description: Extract patterns and learnings from current session
---

# Learn Command

Analyze the current session to extract reusable patterns and instincts: $ARGUMENTS

## Your Task

Review the conversation history and code changes to extract:

1. **Patterns discovered** -- Recurring solutions or approaches specific to the project stack
2. **Best practices applied** -- Go/Next.js/PostgreSQL techniques that worked well
3. **Mistakes to avoid** -- Issues encountered and how they were resolved
4. **Workflow insights** -- Effective sequences (e.g., "edit SQL -> sqlc generate -> go build")

## Process

1. Review recent conversation and tool use
2. Identify patterns worth remembering
3. Save as instincts to `.opencode/learning/instincts/personal/`

## Output Format

### Patterns Discovered

**Pattern: [Name]**
- Context: When to use this pattern
- Stack: Go / Next.js / PostgreSQL / Cross-stack
- Implementation: How to apply it

### Instincts Extracted

For each pattern, create an instinct file at `.opencode/learning/instincts/personal/`:

```json
{
  "id": "instinct-[slug]-[timestamp]",
  "trigger": "[situation that triggers this learning]",
  "action": "[what to do]",
  "confidence": 0.7,
  "category": "[workflow|coding|testing|security|error-resolution|database]",
  "applications": 1,
  "successes": 1,
  "source": "session-extraction",
  "timestamp": "[ISO timestamp]",
  "evidence": ["Description of what happened"]
}
```

### Categories

| Category | Examples |
|----------|---------|
| `workflow` | sqlc generate flow, migration workflow, dev setup |
| `coding` | Go error handling, Chi handler patterns, React hooks |
| `testing` | Table-driven tests, mock patterns, E2E flows |
| `security` | RBAC checks, tenant isolation, input validation |
| `error-resolution` | Build fixes, type errors, migration issues |
| `database` | Index strategies, query optimization, RLS patterns |

## Observation Data

Check `.opencode/learning/observations/` for raw session data (JSONL files).
These contain tool calls, file edits, and outcomes from this and previous sessions.

---

**TIP**: Run `/learn` periodically during long sessions to capture insights before context compaction.

---
name: continuous-learning-v2
description: Instinct-based learning system that observes sessions, creates atomic instincts with confidence scoring, and evolves them into skills/commands/agents.
version: 2.0.0
---

# Continuous Learning v2 - Instinct-Based Architecture

An advanced learning system that turns your coding sessions into reusable knowledge through atomic "instincts" -- small learned behaviors with confidence scoring.

## The Instinct Model

An instinct is a small learned behavior:

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
Derive org ID from session context, never from request body.

## Evidence
- Required by multi-tenancy architecture
- Observed in all existing store/queries/*.sql files
- RLS is defense-in-depth, not a replacement
```

**Properties:**
- **Atomic** -- one trigger, one action
- **Confidence-weighted** -- 0.3 = tentative, 0.9 = near certain
- **Domain-tagged** -- code-style, testing, security, git, debugging, workflow, etc.
- **Evidence-backed** -- tracks what observations created it

## How It Works

```
Session Activity
      |
      | Commands capture patterns mid-session
      v
+---------------------------------------------+
|       /learn command analysis                |
|   (prompts, tool calls, outcomes)            |
+---------------------------------------------+
      |
      | Extracts patterns
      v
+---------------------------------------------+
|          PATTERN DETECTION                   |
|   * User corrections -> instinct             |
|   * Error resolutions -> instinct            |
|   * Repeated workflows -> instinct           |
+---------------------------------------------+
      |
      | Creates/updates
      v
+---------------------------------------------+
|     .opencode/learning/instincts/            |
|   personal/                                  |
|   * always-filter-org-id.md (0.9)            |
|   * prefer-table-driven-tests.md (0.8)       |
|   * use-chi-urlparam.md (0.7)                |
|   inherited/                                 |
|   * (imported from teammates)                |
+---------------------------------------------+
      |
      | /evolve clusters 3+ related instincts
      v
+---------------------------------------------+
|     .opencode/learning/evolved/              |
|   * skills/handler-patterns.md               |
|   * commands/new-endpoint.md                 |
|   * agents/migration-specialist.md           |
+---------------------------------------------+
```

## Commands

| Command | Description |
|---------|-------------|
| `/learn` | Extract patterns and instincts from current session |
| `/instinct-status` | Show all learned instincts with confidence scores |
| `/evolve` | Cluster 3+ related instincts (confidence > 0.75) into skills/commands/agents |
| `/instinct-export` | Export instincts for sharing with teammates |
| `/instinct-import <file>` | Import instincts from external source |

## File Structure

```
.opencode/learning/
+-- observations/           # Raw JSONL per session (gitignored, ephemeral)
+-- instincts/
|   +-- personal/           # Auto-learned instincts (version controlled)
|   +-- inherited/          # Imported from teammates (version controlled)
+-- evolved/
    +-- agents/             # Generated specialist agents
    +-- skills/             # Generated skills from instinct clusters
    +-- commands/           # Generated commands
```

## Confidence Scoring

```
confidence = (successes + 1) / (applications + 2)    # Bayesian smoothing
```

| Score | Meaning | Behavior |
|-------|---------|----------|
| 0.3 | Tentative | Suggested but needs more evidence |
| 0.5 | Moderate | Applied when relevant context matches |
| 0.7 | Strong | Auto-approved for application |
| 0.9 | Near-certain | Core behavior, always applied |

**Confidence increases** when:
- Pattern is repeatedly observed across sessions
- User doesn't correct the suggested behavior
- Similar instincts from other sources agree

**Confidence decreases** when:
- User explicitly corrects the behavior
- Pattern isn't observed for extended periods
- Contradicting evidence appears

## {{PROJECT_NAME}}-Specific Instinct Domains

| Domain | Examples |
|--------|----------|
| `security` | org_id filtering, input validation, CSRF tokens |
| `go-patterns` | error wrapping, Chi handler structure, sqlc usage |
| `frontend` | TanStack Query patterns, zod schemas, component structure |
| `testing` | table-driven tests, mock patterns, coverage targets |
| `database` | index strategy, migration naming, RLS policies |
| `workflow` | branch naming, commit format, PR structure |
| `architecture` | handler->domain->store layering, enterprise split |

## Evolution Rules

An instinct cluster evolves into a higher-order artifact when:
1. **3+ related instincts** share the same domain
2. **All instincts have confidence > 0.75**
3. **No contradictions** between instincts in the cluster

Evolution targets:
- **Skill**: Pattern documentation (like this file)
- **Command**: Reusable workflow template
- **Agent**: Specialist with specific expertise

## Privacy

- Observations stay **local** in `.opencode/learning/observations/` (gitignored)
- Only **instincts** (abstract patterns) are version controlled
- No actual code or conversation content is stored in instincts
- You control what gets exported via `/instinct-export`

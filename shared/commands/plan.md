---
description: "Create a detailed implementation plan with competing architecture approaches. WAIT for user CONFIRM before writing code. Usage: /plan <feature description>"
---

# Plan Command

Creates a comprehensive implementation plan with multiple architecture approaches before writing code. Inspired by the "competing architects" pattern — instead of one plan, you get 2-3 options with trade-offs so you can make an informed choice.

## Process

### Phase 1: Discovery

1. **Restate Requirements** — Clarify what needs to be built in your own words
2. **Ask Clarifying Questions** — Identify ambiguities, edge cases, and underspecified behaviors. Present questions in an organized list. **WAIT for answers before proceeding.**

If the user says "whatever you think is best", state your recommendation and get explicit confirmation.

### Phase 2: Codebase Exploration

1. **Explore existing patterns** — Launch 2-3 `explore` agents in parallel to understand:
   - Similar features already implemented (trace their handler -> domain -> store flow)
   - Architecture patterns and abstractions in the affected area
   - Database schema and query patterns relevant to the feature
2. **Read key files** — After agents return, read all files they identified as essential
3. **Summarize findings** — Present what you learned about existing patterns

### Phase 3: Architecture Approaches

Launch 2-3 `architect` agents in parallel, each with a different philosophy:

| Approach | Philosophy | Optimizes For |
|----------|-----------|---------------|
| **Minimal** | Smallest diff, maximum reuse of existing code | Speed, low risk, fewer files changed |
| **Clean** | Best abstractions, most maintainable long-term | Maintainability, testability, extensibility |
| **Pragmatic** | Balance of speed and quality | Practical trade-off, "good enough" architecture |

Each approach must specify:
- Which layers are affected (handler, domain, store, worker, web)
- Database changes (migrations, sqlc queries, indexes)
- API contract (new/modified endpoints, request/response types)
- Frontend changes (pages, components, queries)
- Estimated file count (new + modified)

### Phase 4: Comparison & Recommendation

Present all approaches in a comparison table:

```markdown
| Dimension          | Minimal          | Clean            | Pragmatic        |
|--------------------|------------------|------------------|------------------|
| Files changed      | ~5               | ~12              | ~8               |
| New abstractions   | 0                | 2 interfaces     | 1 interface      |
| Migration changes  | 1 table          | 2 tables         | 1 table          |
| Risk level         | Low              | Medium           | Low              |
| Future flexibility | Limited          | High             | Moderate         |
| Estimated effort   | 1-2 hours        | 4-6 hours        | 2-3 hours        |
```

Then give **your recommendation** with reasoning. Consider:
- Is this a quick fix or a foundational feature?
- How likely is this area to change again soon?
- Does the team context favor speed or quality right now?
- Are there security/multi-tenancy implications that demand the cleaner approach?

### Phase 5: Detailed Plan

After the user picks an approach, expand it into a full implementation plan:

1. **Database First** — Migration and sqlc query changes
2. **Backend Phases** — Handler, domain, store changes in dependency order
3. **Frontend Phases** — Types, API client, components, pages
4. **Risk Assessment** — Security, tenant isolation, performance, breaking changes
5. **Acceptance Criteria** — How to verify the feature works

### Phase 6: Save & Confirm

1. **Save the plan** to `.plans/YYYY-MM-DD-<feature-slug>.md`
   - Use today's date and a slug derived from the feature name
   - Include the full plan with chosen approach, rationale, all phases, risks, and acceptance criteria
   - Set the status to `Approved`
   - Tell the user where the plan was saved

2. **WAIT for confirmation** — Do NOT write code until the user explicitly approves.

Present a clear summary:
- Chosen approach and why
- Ordered list of implementation steps
- Known risks and mitigations
- Where the plan was saved (e.g., "Plan saved to `.plans/2026-02-08-file-attachments.md`")
- Ask: "Ready to implement?"

## When to Use

- Starting a new feature (especially cross-stack: Go + Next.js + SQL)
- Architectural changes or new abstractions
- Complex refactoring where multiple approaches exist
- Any change where you're unsure of the best path

## When NOT to Use

- Single-file bug fixes
- Trivial changes with obvious implementation
- Adding a field to an existing CRUD endpoint
- Changes where only one reasonable approach exists (just do it)

## Tips

- **Be specific in your feature request** — more detail = fewer clarifying questions
- **"Minimal" isn't always bad** — for urgent fixes or low-risk changes, smallest diff wins
- **"Clean" isn't always good** — over-engineering a simple feature wastes time
- **Trust the recommendation** — it's based on codebase analysis, but you know your priorities

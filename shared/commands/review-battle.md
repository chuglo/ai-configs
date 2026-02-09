---
description: Dispatch competing code reviewers, then grade them. Best findings win.
---

# Review Battle

Dispatches two instances of a reviewer agent plus the security reviewer, all in parallel. A coach grades all three reviews and synthesizes the best findings.

## Usage

```
/review-battle [agent] [target]
```

- **agent** (optional): The reviewer agent to duplicate. Default: `go-reviewer`. Can be `go-reviewer` or `code-reviewer`.
- **target** (optional): A file path, directory, or git ref to scope the review. Default: uncommitted changes (`git diff HEAD`).

## Examples

```
/review-battle                          # Two go-reviewers + security-reviewer on uncommitted changes
/review-battle code-reviewer            # Two code-reviewers + security-reviewer on uncommitted changes
/review-battle go-reviewer internal/handler/item.go  # Scoped to one file
```

## Workflow

### Phase 1: Dispatch Reviewers (parallel)

Launch **three** agents in parallel using the Task tool:

1. **Reviewer A** — the chosen reviewer agent with this added preamble:
   > You are Reviewer A in a competitive review. A coach will grade your review against another reviewer's. Be thorough — the highest grade wins. Do not hold back.

2. **Reviewer B** — the same reviewer agent with this added preamble:
   > You are Reviewer B in a competitive review. A coach will grade your review against another reviewer's. Be thorough — the highest grade wins. Do not hold back.

3. **Security Reviewer** — the `security-reviewer` agent with this added preamble:
   > You are the Security Reviewer in a competitive review battle. A coach will grade your review against two other reviewers. Focus on your security expertise — find what they'll miss.

If a **target** is specified, tell each reviewer to focus on that file/directory/ref instead of the full diff.

### Phase 2: Grade (sequential)

Once all three reviews are returned, dispatch the **review-coach** agent with this prompt:

```
Here are three independent reviews of the same code changes. Grade each reviewer and produce a synthesized final review.

## Reviewer A ([agent name])
[paste Reviewer A output]

## Reviewer B ([agent name])
[paste Reviewer B output]

## Security Reviewer
[paste Security Reviewer output]
```

### Phase 3: Report

Present the coach's output to the user. Include:
1. The grade table for all three reviewers
2. The winner declaration
3. The synthesized review (the actual deliverable)
4. Any issues missed by everyone

## Notes

- The competitive framing is the point. Reviewers told they're being graded produce better reviews.
- The security reviewer adds a different lens — they'll catch tenant isolation and auth issues the code reviewers might gloss over.
- The synthesized review from the coach is the final output. Individual reviews are supporting evidence.
- All agents are read-only. No code is modified.

---
description: View learned instincts with confidence scores
---

# Instinct Status

Display all learned instincts and their confidence scores: $ARGUMENTS

## Your Task

1. Read instinct files from:
   - `.opencode/learning/instincts/personal/` (auto-learned)
   - `.opencode/learning/instincts/inherited/` (imported from others)

2. Display summary table:

```
| Category | Count | Avg Confidence |
|----------|-------|----------------|
| workflow | X | 0.XX |
| coding | X | 0.XX |
| security | X | 0.XX |
| ...      | X | 0.XX |
```

3. List high-confidence instincts (>0.7):

```
[trigger] -> [action] (confidence: 0.XX, applications: N)
```

4. List recent instincts (last 5 created)

5. Show observation stats:
   - Count JSONL files in `.opencode/learning/observations/`
   - Total observations across all sessions

## Confidence Scale

| Score | Meaning |
|-------|---------|
| 0.3 | Tentative -- needs more evidence |
| 0.5 | Moderate -- applied when relevant |
| 0.7 | Strong -- auto-approved for application |
| 0.9 | Near-certain -- core behavior |

## Confidence Calculation

```
confidence = (successes + 1) / (applications + 2)
```

Bayesian smoothing prevents extreme scores from small samples.

---

**TIP**: Use `/evolve` when you have 3+ related instincts with confidence > 0.75.

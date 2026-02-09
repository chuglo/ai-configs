---
description: Export instincts for sharing
---

# Instinct Export

Export instincts for sharing with teammates: $ARGUMENTS

## Usage

```
/instinct-export                           # Export all
/instinct-export --min-confidence 0.8      # High confidence only
/instinct-export --category security       # By category
/instinct-export --output ./my-instincts.json
```

## Process

1. Read all instincts from `.opencode/learning/instincts/personal/`
2. Apply filters (confidence, category) if specified
3. Write to output file (default: `.opencode/learning/instincts-export.json`)

## Export Format

```json
{
  "instincts": [
    {
      "id": "instinct-xxx",
      "trigger": "[situation]",
      "action": "[recommendation]",
      "confidence": 0.85,
      "category": "coding",
      "applications": 10,
      "successes": 9,
      "source": "session-observation"
    }
  ],
  "metadata": {
    "version": "1.0",
    "exported": "[ISO timestamp]",
    "project": "{{PROJECT_NAME}}",
    "total": 25,
    "filter": "confidence >= 0.8"
  }
}
```

## Output

```
Export Summary
==============
Output: ./instincts-export.json
Total instincts: X
Filtered: Y
Exported: Z

Categories:
- workflow: N
- coding: N
- security: N
- database: N

Top by confidence:
1. [trigger] (0.XX)
2. [trigger] (0.XX)
```

---

**TIP**: Export high-confidence instincts (>0.8) for better quality shares.

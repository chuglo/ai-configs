---
description: Import instincts from external sources
---

# Instinct Import

Import instincts from a file or teammate: $ARGUMENTS

## Usage

```
/instinct-import path/to/instincts.json
/instinct-import https://example.com/instincts.json
```

## Expected Format

```json
{
  "instincts": [
    {
      "trigger": "[situation description]",
      "action": "[recommended action]",
      "confidence": 0.7,
      "category": "coding",
      "source": "imported"
    }
  ],
  "metadata": {
    "version": "1.0",
    "exported": "2026-01-15T10:00:00Z",
    "author": "username"
  }
}
```

## Import Process

1. **Read** the source file or URL
2. **Validate** JSON structure
3. **Deduplicate** -- skip instincts with >60% trigger word overlap with existing
4. **Adjust confidence** -- multiply by 0.8 (imported instincts start with less trust)
5. **Save** to `.opencode/learning/instincts/inherited/`
6. **Report** summary

## Conflict Resolution

When duplicate detected:
- Keep the version with higher confidence
- Merge application counts
- Update timestamp

## Output

```
Import Summary
==============
Source: [path]
Total in file: X
Imported: Y
Skipped (duplicates): Z

Imported:
- [trigger] (confidence: 0.XX)
```

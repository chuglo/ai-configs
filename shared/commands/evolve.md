---
description: Cluster related instincts into skills, commands, or agents
---

# Evolve Command

Analyze instincts and promote clusters to skills: $ARGUMENTS

## Process

### Step 1: Load Instincts

Read all instincts from:
- `.opencode/learning/instincts/personal/`
- `.opencode/learning/instincts/inherited/`

### Step 2: Cluster by Similarity

Group instincts by:
- Category (workflow, coding, testing, security, database, error-resolution)
- Trigger word similarity
- Action pattern similarity

### Step 3: Evaluate Clusters

A cluster is promotable when:
- **3+ instincts** in the cluster
- **Average confidence > 0.75**
- **Cohesive theme** (instincts are about the same topic)

### Step 4: Generate Skill

For each promotable cluster, create a skill file:

```
.opencode/learning/evolved/skills/[skill-name].md
```

Format:
```markdown
# [Skill Name]

## Overview
[What this skill teaches, generated from clustered instincts]

## Patterns

### 1. [Pattern from instinct 1]
**Trigger**: [instinct trigger]
**Action**: [instinct action]
**Confidence**: [score]

### 2. [Pattern from instinct 2]
...

## Source Instincts
- [instinct-id-1] (confidence: X)
- [instinct-id-2] (confidence: X)
```

### Step 5: Report

```
Evolution Summary
=================

Clusters Found: X

Cluster 1: [Name]
- Instincts: N
- Avg Confidence: 0.XX
- Status: Promoted to skill / Needs more confidence / Needs more instincts

Skills Created:
- .opencode/learning/evolved/skills/[name].md

Remaining Instincts: X
```

## Thresholds

| Metric | Required |
|--------|----------|
| Min instincts per cluster | 3 |
| Min average confidence | 0.75 |
| Min cluster cohesion | 0.6 |

## Evolved Skills Integration

After a skill is created, consider adding it to `opencode.json` instructions:

```json
{
  "instructions": [
    ".opencode/learning/evolved/skills/[name].md"
  ]
}
```

---

**TIP**: Run `/evolve` periodically as your instinct collection grows.

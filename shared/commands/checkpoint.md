---
description: Create or verify a workflow checkpoint. Usage: /checkpoint create my-feature
---

# Checkpoint

**Action**: $1 (create, verify, or list)
**Name**: $2

## Actions

### create
1. Run quick verification (build + types pass)
2. Create a git stash or commit with checkpoint name `$2`
3. Report checkpoint created with git SHA

### verify
Compare current state to checkpoint `$2`:
- Files changed since checkpoint
- Test pass rate
- Build status

### list
Show all checkpoints with name, timestamp, and git SHA.

If no action specified, default to `list`.

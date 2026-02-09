---
description: Fix Next.js/TypeScript frontend build and type errors with minimal changes.
---

# Build Fix (Frontend)

1. Run build: `cd web && npm run build`
2. Run type check: `cd web && npx tsc --noEmit --pretty`

3. For each error:
   - Show error context
   - Explain the issue
   - Apply minimal fix
   - Re-run build
   - Verify error resolved

4. Stop if:
   - Fix introduces new errors
   - Same error persists after 3 attempts

5. Summary: errors fixed, errors remaining, new errors introduced.

Fix one error at a time. Minimal diffs only. No refactoring.

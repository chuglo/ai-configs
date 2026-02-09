---
description: Review uncommitted changes for quality, security, and maintainability.
---

# Code Review

1. Get changed files: `git diff --name-only HEAD`

2. For each changed file, check:

**Security (CRITICAL):**
- Hardcoded credentials, API keys, tokens
- Missing org_id filtering (tenant isolation)
- Missing RBAC checks
- XSS/injection vulnerabilities
- Missing input validation
- Insecure file upload handling

**Code Quality (HIGH):**
- Go: error handling, functions >50 lines, missing tests
- TypeScript: any types, missing null checks, console.log
- SQL: missing indexes, N+1 patterns, missing org_id filter

**Best Practices (MEDIUM):**
- Commit message format
- Test coverage on new code
- Documentation for public APIs

3. Generate report with severity, file:line, description, and fix suggestion.
4. Block if CRITICAL or HIGH issues found.

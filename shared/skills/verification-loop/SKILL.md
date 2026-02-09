---
name: verification-loop
description: Comprehensive verification system for {{PROJECT_NAME}}. Build, type check, lint, test, security scan across Go and Next.js.
---

# Verification Loop for {{PROJECT_NAME}}

## When to Activate

- After completing a feature or significant code change
- Before creating a PR
- After refactoring
- When running `/verify` command

## Verification Phases

### Phase 1: Go Build & Lint
```bash
go build ./...
golangci-lint run ./...
```
If build fails, STOP and fix before continuing. `golangci-lint` includes go vet, staticcheck, errcheck, and more.

### Phase 2: Go Tests
```bash
go test -race -count=1 ./...
```
Report: Total tests, Passed, Failed, Coverage.

### Phase 3: Frontend Build
```bash
cd web && npm run build
```
This includes TypeScript type checking. Report all type errors. Fix critical ones.

### Phase 4: Frontend Tests
```bash
cd web && npx vitest run --reporter=verbose
```

### Phase 5: Frontend Lint
```bash
cd web && npx eslint .
```

### Phase 6: Security Scan
```bash
# Go vulnerability check
govulncheck ./...

# npm audit
cd web && npm audit

# Check for secrets (gitleaks -- proper secret scanner, not grep)
gitleaks protect -v

# Check for console.log in production
mgrep "console.log statements in production TypeScript code" web/src/

# Check for math/rand in security paths (should use crypto/rand)
mgrep "usage of math/rand instead of crypto/rand in non-test Go files"

# Check for err.Error() returned to clients (leaks internal details)
mgrep "err.Error() returned directly to HTTP clients" internal/handler/
```

### Phase 7: Diff Review
```bash
git diff --stat
git diff HEAD~1 --name-only
```
Review each changed file for:
- Unintended changes
- Missing error handling (no `_ =` without justification)
- Missing tenant isolation (organization_id filter)
- Security issues (secrets, input validation, body size limits)
- Missing godoc comments on exported symbols
- Compile-time interface verification where applicable

## Output Format

```
VERIFICATION REPORT
==================

Go Build:       [PASS/FAIL]
Go Lint:        [PASS/FAIL] (X warnings)
Go Tests:       [PASS/FAIL] (X/Y passed, Z% coverage)
Frontend Build: [PASS/FAIL]
Frontend Tests: [PASS/FAIL] (X/Y passed)
Frontend Lint:  [PASS/FAIL] (X warnings)
Security:       [PASS/FAIL] (X issues)
Diff:           [X files changed]

Overall:        [READY/NOT READY] for PR

Issues to Fix:
1. ...
2. ...
```

## When to Run

- After completing each function/component
- After finishing a feature
- Before moving to next task
- Before creating commits
- Before creating PRs

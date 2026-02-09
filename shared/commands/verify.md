---
description: "Run comprehensive verification. Usage: /verify [quick|full|backend|frontend]"
---

# Verification

**Scope**: $1 (quick, full, backend, or frontend -- defaults to full)

## Checks by Scope

### full (default)
1. **Go Build**: `go build ./...`
2. **Go Lint**: `golangci-lint run ./...` (includes govet, staticcheck, errcheck, and 24 more)
3. **Go Tests**: `go test -race ./...`
4. **sqlc Check**: `sqlc compile` (if installed)
5. **Frontend Build**: `cd web && npm run build`
6. **Frontend Types**: `cd web && npx tsc --noEmit`
7. **Frontend Lint**: `cd web && npm run lint`
8. **Frontend Tests**: `cd web && npm test`
9. **Debug Audit**: Search for console.log/fmt.Println in source
10. **Git Status**: Show uncommitted changes

### quick
Go build + lint + frontend build only (steps 1, 2, 5).

### backend
Go checks only (steps 1-4).

### frontend
Web checks only (steps 5-8).

## Output

```
VERIFICATION: [PASS/FAIL]

Go Build:     [OK/FAIL]
Go Lint:      [OK/X issues]
Go Tests:     [X/Y passed]
Web Build:    [OK/FAIL]
Web Types:    [OK/X errors]
Web Lint:     [OK/X issues]
Web Tests:    [X/Y passed]
Debug:        [OK/X statements]

Ready for PR: [YES/NO]
```

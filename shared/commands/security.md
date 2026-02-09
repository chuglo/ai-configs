---
description: Run comprehensive security review for {{PROJECT_NAME}}.
---

# Security Review

Invokes the **security-reviewer** agent.

## Checks

1. **OWASP Top 10** -- Injection, broken auth, XSS, CSRF, etc.
2. **Tenant Isolation** -- org_id filtering, RLS policies
3. **Auth/AuthZ** -- Session security, RBAC enforcement
4. **Input Validation** -- Go validator, Zod schemas
5. **File Uploads** -- Type whitelist, size limits
6. **Secrets** -- No hardcoded keys, passwords, tokens
7. **Rate Limiting** -- Public endpoints protected
8. **Audit Logging** -- Security events captured

## Commands

```bash
golangci-lint run ./...         # Go static analysis (includes govet, gosec, and 25 more)
govulncheck ./...               # Known vulnerabilities
cd web && npm audit             # npm dependency audit
```

Security is paramount. Every vulnerability is a risk to the platform and its users.

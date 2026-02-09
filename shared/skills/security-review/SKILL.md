---
name: security-review
description: Security checklist for {{PROJECT_NAME}}. Multi-tenant isolation, auth, input validation, OWASP Top 10, file uploads, logging security. Use when implementing auth, handling user input, creating API endpoints, modifying multi-tenant queries, or reviewing code for security.
allowed-tools: Read Grep Glob
compatibility: Go 1.25+, Next.js 16, PostgreSQL 16+
---

# Security Review for {{PROJECT_NAME}}

## When to Activate

- Implementing authentication or authorization
- Handling user input or file uploads
- Creating new API endpoints
- Working with external communication (email, webhooks)
- Modifying multi-tenant queries
- Changing session or token handling

## Security Checklist

### 1. Multi-Tenant Isolation (CRITICAL)

```go
// REQUIRED: org_id from session context
orgID := middleware.OrgID(r.Context())

// FORBIDDEN: org_id from request body, header, or query param
var req struct { OrgID string `json:"org_id"` }  // NEVER
orgID := r.Header.Get("X-Org-ID")                // NEVER
orgID := r.URL.Query().Get("org_id")              // NEVER
```

- [ ] Every DB query on tenant data filters by organization_id
- [ ] organization_id comes from session middleware, NEVER from request
- [ ] PostgreSQL RLS enabled as defense-in-depth
- [ ] Cross-org data leakage tested
- [ ] Cache keys are tenant-prefixed: `tenant:{org_id}:resource:{id}`
- [ ] File storage paths are tenant-prefixed
- [ ] Audit logs include tenant context
- [ ] Use composite lookups: `WHERE id = $1 AND organization_id = $2`

### 2. Authentication

**Auth Tokens (passwordless, reset, invite)**
- [ ] Token generated with `crypto/rand` (not `math/rand` or `math/rand/v2`)
- [ ] Hash stored in DB (not plaintext token)
- [ ] Short expiry enforced (e.g., 15 minutes)
- [ ] Single-use (marked as used after verification)
- [ ] Constant-time comparison for token validation

**Sessions**
- [ ] HTTP-only, Secure, SameSite=Lax cookies
- [ ] 24h inactivity timeout, 7-day max lifetime
- [ ] Session stored in PostgreSQL (not in cookie)
- [ ] Invalidated on password/2FA change

```go
http.SetCookie(w, &http.Cookie{
    Name:     "session_id",
    Value:    sessionToken,
    Path:     "/",
    HttpOnly: true,
    Secure:   true,
    SameSite: http.SameSiteLaxMode,
    MaxAge:   86400 * 7,
})
```

**OAuth**
- [ ] State parameter validated
- [ ] PKCE where supported
- [ ] Token exchange server-side only

**JWT (if used)**
- [ ] Enforce expected signing algorithm — never read `alg` from token header
- [ ] Validate `iss`, `aud`, `exp`, `nbf` claims
- [ ] Never allow `{"alg":"none"}` (unsigned JWTs)

### 3. Cryptography

**Use `crypto/rand`, Never `math/rand`**
```go
// CORRECT: cryptographically secure
import "crypto/rand"
b := make([]byte, 32)
if _, err := rand.Read(b); err != nil {
    return fmt.Errorf("generate token: %w", err)
}

// WRONG: predictable
import "math/rand"
token := rand.Intn(999999)
```

Flag any import of `math/rand` or `math/rand/v2` in security-sensitive code.

**Constant-Time Comparison**
```go
import "crypto/subtle"

// CORRECT: prevents timing attacks
if subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
    return ErrInvalidToken
}

// WRONG: variable-time comparison leaks information
if provided != expected { ... }
```

Use `crypto/subtle.ConstantTimeCompare` for comparing tokens, hashes, HMACs, and any secret material.

**Password Hashing**
- [ ] Argon2id (preferred) or bcrypt (cost >= 10)
- [ ] Never MD5, SHA-1, or plain SHA-256 for passwords
- [ ] bcrypt: handle 72-byte input limit (pre-hash if needed)

### 4. Input Validation

**Request Body Size Limits**
```go
// REQUIRED: limit request body size on all endpoints
r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit

if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
    var maxBytesErr *http.MaxBytesError
    if errors.As(err, &maxBytesErr) {
        respondError(w, http.StatusRequestEntityTooLarge, "request too large")
        return
    }
    respondError(w, http.StatusBadRequest, "invalid request")
    return
}

// WRONG: unlimited body size — DoS vector
json.NewDecoder(r.Body).Decode(&req)
```

**Go Backend**
- [ ] All inputs validated with `go-playground/validator`
- [ ] SQL queries parameterized via sqlc (no string concatenation)
- [ ] User-generated HTML/markdown sanitized before storage
- [ ] UUID inputs parsed and validated (not raw strings to queries)
- [ ] Content-Type header validated on POST/PUT requests

**TypeScript Frontend**
- [ ] Zod schemas for all form inputs
- [ ] API responses validated before use
- [ ] No `dangerouslySetInnerHTML` without sanitization

### 5. SQL Injection Prevention

```go
// CORRECT: parameterized queries via sqlc
// name: GetUserByEmail :one
// SELECT * FROM users WHERE email = $1 AND organization_id = $2;

// WRONG: string concatenation
query := fmt.Sprintf("SELECT * FROM items WHERE title = '%s'", userInput)

// Dynamic filtering: allowlist column names
var allowedSortColumns = map[string]string{
    "created_at": "created_at",
    "title":      "title",
    "priority":   "priority",
}
```

### 6. File Uploads

```go
func (h *Handler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
    // 1. Limit upload size
    r.Body = http.MaxBytesReader(w, r.Body, 5<<20) // 5MB

    // 2. Parse multipart form
    if err := r.ParseMultipartForm(5 << 20); err != nil {
        respondError(w, http.StatusRequestEntityTooLarge, "file too large")
        return
    }

    file, header, err := r.FormFile("file")
    if err != nil {
        respondError(w, http.StatusBadRequest, "invalid file")
        return
    }
    defer file.Close()

    // 3. Validate content type by reading magic bytes
    buf := make([]byte, 512)
    n, _ := file.Read(buf)
    contentType := http.DetectContentType(buf[:n])
    file.Seek(0, io.SeekStart)

    // 4. Check against allowlist
    allowedTypes := map[string]bool{
        "image/png": true, "image/jpeg": true, "image/gif": true,
        "text/plain": true, "application/json": true,
    }
    if !allowedTypes[contentType] {
        respondError(w, http.StatusBadRequest, "file type not allowed")
        return
    }

    // 5. Generate storage key (NEVER use user-supplied filename)
    ext := filepath.Ext(header.Filename)
    storageKey := fmt.Sprintf("%s/%s%s", orgID, uuid.New().String(), ext)
}
```

- [ ] Allowed types whitelist (configure per project)
- [ ] Max file size enforced
- [ ] Content-type validated by magic bytes (not just extension or Content-Type header)
- [ ] Storage key not user-controlled (UUID-based)
- [ ] Presigned URLs expire (15 minutes)
- [ ] Files served through Go backend, never direct storage access
- [ ] Storage paths are tenant-prefixed

### 7. API Security

**HTTP Security Headers**
```go
func securityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        w.Header().Set("Cache-Control", "no-store")
        w.Header().Set("Referrer-Policy", "no-referrer")
        w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        next.ServeHTTP(w, r)
    })
}
```

**Server Timeouts (DoS Prevention)**
```go
srv := &http.Server{
    Addr:              ":8080",
    Handler:           router,
    ReadTimeout:       5 * time.Second,
    ReadHeaderTimeout: 2 * time.Second,
    WriteTimeout:      10 * time.Second,
    IdleTimeout:       120 * time.Second,
    MaxHeaderBytes:    1 << 20,
}
```

- [ ] Rate limiting on all endpoints (httprate)
  - Auth: 5/min per IP
  - Public endpoints: 10/hour per IP
  - API: 100/min per user
  - Per-tenant rate limiting for multi-tenant (prevent noisy neighbor)
- [ ] CSRF: SameSite cookies + CSRF token header
- [ ] CORS properly configured (specific origins, never `AllowAll()` with credentials)
- [ ] Error messages don't leak internals
- [ ] RBAC checked: `domain.HasPermission(role, perm)`
- [ ] `context.WithTimeout` on all DB queries and external service calls

### 8. Error Handling and Information Leakage

```go
// CORRECT: generic error to client, detailed log internally
if err != nil {
    log.Error().Err(err).Str("handler", "GetItem").Msg("failed to fetch item")
    respondError(w, http.StatusInternalServerError, "internal error")
    return
}

// WRONG: leaking internals to client
http.Error(w, err.Error(), 500)
http.Error(w, fmt.Sprintf("query failed: %v", err), 500)
```

- [ ] Never return `err.Error()` directly to clients
- [ ] Never expose stack traces, SQL statements, or file paths
- [ ] Return 404 for both "not found" and "not authorized to view" (prevent enumeration)
- [ ] Use consistent error response format

### 9. Logging Security

**Never Log Sensitive Data**
```go
// CORRECT: structured logging without sensitive data
log.Info().
    Str("user_id", userID).
    Str("action", "login_attempt").
    Str("ip", clientIP).
    Msg("authentication attempt")

// WRONG: logging sensitive data
log.Info().
    Str("password", password).           // NEVER
    Str("token", sessionToken).          // NEVER
    Str("api_key", apiKey).              // NEVER
    Str("ssn", user.SSN).               // NEVER
    Msg("user action")
```

**Security Events to Log**
```go
log.Info().Str("event", "auth_success").Str("user_id", uid).Msg("user authenticated")
log.Warn().Str("event", "auth_failure").Str("email", email).Msg("failed login attempt")
log.Warn().Str("event", "authz_failure").Str("user_id", uid).Msg("access denied")
log.Warn().Str("event", "rate_limit_exceeded").Str("ip", ip).Msg("rate limit hit")
log.Info().Str("event", "rbac_change").Str("target_user", uid).Msg("role changed")
```

- [ ] Use structured logging (zerolog) — prevents log injection
- [ ] Never log passwords, tokens, API keys, PII
- [ ] Log all security-relevant events (auth, authz, rate limits, RBAC changes)

### 10. Audit Logging

- [ ] All state-changing actions logged (structured audit events)
- [ ] Audit events are append-only
- [ ] No sensitive data in audit events (no passwords, tokens)
- [ ] Actor, target, and action recorded

### 11. No Secrets in Code

- [ ] No hardcoded API keys, passwords, tokens
- [ ] All secrets in environment variables
- [ ] .env files in .gitignore
- [ ] No secrets in git history

### 12. Dependency Security

```bash
# Basic source scan
govulncheck ./...

# SARIF output for GitHub Security tab integration
govulncheck -format sarif ./... > govulncheck.sarif

# Binary scanning (scan compiled artifacts, catches more)
govulncheck -mode binary ./cmd/server/server

# npm audit for frontend
cd web && npm audit
```

- [ ] `govulncheck ./...` in CI pipeline (use `golang/govulncheck-action` GitHub Action)
- [ ] Binary scanning post-build for production artifacts
- [ ] Keep Go version up to date (security patches in point releases)
- [ ] `go.sum` committed for integrity verification
- [ ] Regular dependency updates with review

### 13. Race Detector as Security Tool

The `-race` flag catches TOCTOU (time-of-check-time-of-use) bugs in auth checks, which are direct security vulnerabilities — not just correctness issues.

```bash
# REQUIRED in CI — catches auth race conditions
go test -race ./...
```

### 14. Fuzzing Security-Critical Code

Use Go's built-in fuzzing for validators, parsers, and sanitizers that process untrusted input:

```go
func FuzzValidateTitle(f *testing.F) {
    f.Add("Normal Title")
    f.Add("<script>alert(1)</script>")
    f.Add("'; DROP TABLE items; --")
    f.Add(strings.Repeat("A", 10000))

    f.Fuzz(func(t *testing.T, title string) {
        result, err := domain.ValidateTitle(title)
        if err != nil {
            return // validation correctly rejected
        }
        // If validation passed, result must be safe
        if strings.Contains(result, "<script") {
            t.Errorf("XSS payload survived validation: %q", result)
        }
    })
}
```

Run with: `go test -fuzz=FuzzValidateTitle -fuzztime=30s`

## Go-Specific Security Anti-Patterns

| Anti-Pattern | Risk | Fix |
|---|---|---|
| `math/rand` for tokens | Predictable values | `crypto/rand` |
| `==` for token comparison | Timing attack | `crypto/subtle.ConstantTimeCompare` |
| No `http.MaxBytesReader` | DoS via large body | Always limit body size |
| `err.Error()` to client | Information leakage | Generic error messages |
| No server timeouts | Resource exhaustion | Set Read/Write/Idle timeouts |
| TOCTOU in auth checks | Race condition | Atomic check-and-act in DB transaction |
| Goroutine leaks | Resource exhaustion | Context-controlled lifecycle |
| `unsafe` package | Memory safety bypass | Avoid unless absolutely necessary |
| `AllowedOrigins: ["*"]` with credentials | CORS bypass | Specific origins only |

## Pre-Commit Security Checklist

- [ ] No hardcoded secrets
- [ ] All user inputs validated
- [ ] SQL injection prevention (sqlc only)
- [ ] XSS prevention (HTML sanitization + React escaping + CSP)
- [ ] CSRF protection
- [ ] Auth verified on protected routes
- [ ] RBAC checked
- [ ] Rate limiting on public endpoints
- [ ] File uploads validated (magic bytes, size, type)
- [ ] Error messages safe (no internal details)
- [ ] organization_id from session only
- [ ] Request body size limited
- [ ] No sensitive data in logs
- [ ] Server timeouts configured

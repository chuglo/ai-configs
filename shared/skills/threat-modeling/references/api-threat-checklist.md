# API Threat Checklist

Systematic threat checklist for REST API endpoints. Use when adding new endpoints, reviewing existing ones, or conducting a security assessment.

## Per-Endpoint Checklist

For every API endpoint, verify:

### Authentication & Authorization
- [ ] Authentication required (`RequireAuth()` middleware)
- [ ] Authorization checked (`RequirePermission()` middleware)
- [ ] `organization_id` derived from session (multi-tenant isolation)
- [ ] Resource ownership verified (composite lookup: `WHERE id = $1 AND org_id = $2`)
- [ ] Appropriate HTTP method used (GET for reads, POST/PUT/PATCH for writes, DELETE for removal)

### Input Validation
- [ ] Request body size limited (`http.MaxBytesReader`)
- [ ] Content-Type header validated
- [ ] All path parameters validated (UUID format, allowed values)
- [ ] All query parameters validated (type, range, length)
- [ ] Request body validated (required fields, types, lengths, formats)
- [ ] No mass assignment (explicit struct binding, not `map[string]interface{}`)
- [ ] File uploads validated (magic bytes, size, type allowlist)

### Output Security
- [ ] Response uses explicit DTO (not raw database model)
- [ ] No sensitive data in response (password hashes, internal IDs, tokens)
- [ ] Error messages are generic (no stack traces, SQL errors, file paths)
- [ ] 404 returned for both "not found" and "not authorized" (prevent enumeration)
- [ ] Content-Type header set on response
- [ ] No sensitive data in response headers

### Rate Limiting
- [ ] Rate limit applied (per-IP for public, per-user for authenticated)
- [ ] Per-tenant rate limit for multi-tenant endpoints
- [ ] Appropriate limits for endpoint sensitivity:
  - Auth endpoints: 5/min per IP
  - Public endpoints: 10/hour per IP
  - Authenticated API: 100/min per user
  - File uploads: 10/hour per user

### CSRF Protection
- [ ] State-changing endpoints require CSRF token (POST, PUT, PATCH, DELETE)
- [ ] SameSite=Lax cookies configured
- [ ] CSRF token validated in middleware

### Logging & Audit
- [ ] Request logged (method, path, user, org, status code)
- [ ] State-changing actions produce audit events
- [ ] No sensitive data in logs (tokens, passwords, PII)
- [ ] Failed auth/authz attempts logged as warnings

## Endpoint-Type Specific Threats

### List Endpoints (GET /resources)

| Threat | Description | Mitigation |
|---|---|---|
| Data over-exposure | Returning all fields including sensitive ones | Explicit response DTO with only needed fields |
| Unbounded results | No pagination returns millions of rows | Default page size, max page size limit |
| Filter injection | Malicious filter/sort parameters | Allowlist of sortable/filterable columns |
| Cross-tenant listing | Missing org filter returns all tenants' data | Always filter by `organization_id` |
| Timing attack | Response time reveals record count | Consistent response times, don't expose total count to unauthenticated users |

### Detail Endpoints (GET /resources/:id)

| Threat | Description | Mitigation |
|---|---|---|
| IDOR | Accessing resource by guessing/enumerating ID | Composite lookup with org_id, use UUIDs |
| Cross-tenant access | Valid ID from another tenant | `WHERE id = $1 AND organization_id = $2` |
| Information disclosure | Returning more data than needed | Explicit response DTO |
| Enumeration | 403 vs 404 reveals existence | Always return 404 for unauthorized access |

### Create Endpoints (POST /resources)

| Threat | Description | Mitigation |
|---|---|---|
| Mass assignment | Extra fields in request body | Explicit struct binding with known fields only |
| Missing validation | Invalid data stored in database | Server-side validation (domain layer) |
| CSRF | Forged cross-origin request | CSRF token + SameSite cookies |
| Duplicate creation | Race condition creates duplicates | Unique constraints, idempotency keys |
| Tenant injection | org_id in request body | Derive from session, ignore request body |

### Update Endpoints (PUT/PATCH /resources/:id)

| Threat | Description | Mitigation |
|---|---|---|
| IDOR | Updating another user's resource | Composite lookup with org_id |
| Mass assignment | Updating fields user shouldn't modify (role, org_id) | Explicit update struct, ignore protected fields |
| Race condition | Concurrent updates cause data loss | Optimistic locking (version column) or `SELECT FOR UPDATE` |
| State transition bypass | Skipping required workflow steps | Domain-layer state machine validation |
| CSRF | Forged update request | CSRF token + SameSite cookies |

### Delete Endpoints (DELETE /resources/:id)

| Threat | Description | Mitigation |
|---|---|---|
| IDOR | Deleting another tenant's resource | Composite lookup with org_id |
| Cascade damage | Deleting parent removes children unexpectedly | Soft delete, confirmation for destructive actions |
| CSRF | Forged delete request | CSRF token + SameSite cookies |
| Missing audit | Deletion without trace | Audit log before delete, soft delete preferred |

### File Upload Endpoints (POST /resources/:id/attachments)

| Threat | Description | Mitigation |
|---|---|---|
| Malicious file | Executable uploaded as image | Magic byte validation, type allowlist |
| Path traversal | Filename contains `../` | Server-generated UUID storage key |
| Size DoS | Massive file exhausts disk/memory | `http.MaxBytesReader`, file size limit |
| Type spoofing | Wrong Content-Type header | Detect type from magic bytes, not header |
| Storage exhaustion | Unlimited uploads per tenant | Per-tenant storage quotas |

### Authentication Endpoints (POST /auth/*)

| Threat | Description | Mitigation |
|---|---|---|
| Brute force | Automated password/token guessing | Rate limiting (5/min per IP), account lockout |
| Credential stuffing | Breached credentials from other sites | MFA, breach detection, rate limiting |
| Token replay | Reusing captured auth token | Single-use tokens, short expiry (15 min) |
| Timing attack | Response time reveals valid emails | Constant-time comparison, uniform response |
| Session fixation | Setting session before authentication | Regenerate session ID on login |
| Token in URL | Auth token in query parameter (logged) | POST body only, never in URL |

### Webhook/Callback Endpoints (POST /webhooks/*)

| Threat | Description | Mitigation |
|---|---|---|
| Spoofed sender | Attacker sends fake webhook | HMAC signature verification |
| Replay attack | Replaying captured webhook | Timestamp validation, nonce/idempotency |
| Payload tampering | Modified webhook body | Signature covers entire body |
| DoS via flooding | Rapid webhook deliveries | Rate limiting, async processing via job queue |
| SSRF | Webhook triggers internal requests | Validate/restrict callback URLs |

## Security Headers Checklist

Every API response should include:

```
Content-Type: application/json
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=63072000; includeSubDomains
Cache-Control: no-store
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
```

## HTTP Method Security

| Method | Idempotent | Safe | CSRF Required | Cacheable |
|---|---|---|---|---|
| GET | Yes | Yes | No | Yes (but use no-store for API) |
| HEAD | Yes | Yes | No | Yes |
| POST | No | No | Yes | No |
| PUT | Yes | No | Yes | No |
| PATCH | No | No | Yes | No |
| DELETE | Yes | No | Yes | No |
| OPTIONS | Yes | Yes | No | No |

- **Safe** methods must not modify state
- **Idempotent** methods can be retried safely
- **CSRF** protection required on all non-safe methods

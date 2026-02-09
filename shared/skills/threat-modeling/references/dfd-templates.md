# Data Flow Diagram Templates

Text-based DFD templates for common web application architectures. Use these as starting points when threat modeling a feature or system.

## DFD Element Notation

```
[Rectangle]    = External Entity (users, third-party systems)
(Circle)       = Process (servers, workers, functions)
[[Double]]     = Data Store (databases, file storage, caches)
-->            = Data Flow (label with protocol and data type)
--- TB ---     = Trust Boundary
```

## Template 1: Full-Stack Web Application

```
                        --- Internet (TB1) ---

[Browser]                                    [External API]
    |                                             |
    | HTTPS (HTML, JSON, cookies)                 | HTTPS (webhooks)
    v                                             v
                    --- DMZ (TB2) ---

              (Next.js Server)
                    |
                    | HTTP/internal (JSON, session cookie)
                    v
              --- App Tier (TB3) ---

              (Go API Server)
               /     |      \
              /      |       \
             v       v        v
    --- DB (TB4) ---  --- Storage (TB5) ---  --- External (TB6) ---

[[PostgreSQL]]    [[Object Storage]]    [Email Service]
                                        [Payment Provider]
                                        [Analytics]
```

### Trust Boundaries

| ID | Boundary | Controls |
|---|---|---|
| TB1 | Internet ↔ DMZ | TLS termination, WAF, rate limiting |
| TB2 | DMZ ↔ App Tier | Internal network, auth middleware |
| TB3 | App Tier ↔ Services | Service-specific credentials |
| TB4 | App ↔ Database | DB credentials, TLS, connection pooling |
| TB5 | App ↔ Storage | API keys, presigned URLs |
| TB6 | App ↔ External | API keys, webhook signatures |

## Template 2: Authentication Flow

```
[Browser]
    |
    | 1. POST /auth/login {email}
    v
(Go API) -----> [[sessions]] (check existing)
    |
    | 2. Generate token (crypto/rand)
    v
[[tokens]] (store hashed token)
    |
    | 3. Send email with token link
    v
[Email Service] -----> [User's Inbox]
    |
    | 4. GET /auth/verify?token=xxx
    v
(Go API) -----> [[tokens]] (validate, mark used)
    |
    | 5. Create session
    v
[[sessions]] (store session)
    |
    | 6. Set-Cookie: session_id (HttpOnly, Secure, SameSite)
    v
[Browser] (authenticated)
```

### Threats at Each Step

| Step | STRIDE | Threat | Mitigation |
|---|---|---|---|
| 1 | S | Email enumeration (timing) | Constant-time response regardless of email existence |
| 1 | D | Login request flooding | Rate limit: 5/min per IP |
| 2 | S | Predictable token | `crypto/rand` (not `math/rand`) |
| 3 | I | Token in email (intercepted) | Short expiry (15 min), single-use |
| 4 | S | Token replay | Mark as used after verification |
| 4 | S | Token brute force | Rate limit verification endpoint |
| 5 | S | Session fixation | New session ID on every login |
| 6 | S | Cookie theft (XSS) | HttpOnly, Secure, SameSite=Lax |

## Template 3: File Upload Flow

```
[Browser]
    |
    | 1. POST /api/v1/items/:id/attachments (multipart/form-data)
    v
(Go API)
    |
    | 2. Validate: auth, org_id, file type, file size
    v
(Validation) -----> REJECT if invalid
    |
    | 3. Generate storage key: {org_id}/{uuid}.{ext}
    | 4. Upload to storage
    v
[[Object Storage]] (tenant-prefixed path)
    |
    | 5. Store metadata in DB
    v
[[PostgreSQL]] (attachment record with storage key)
    |
    | 6. Return attachment metadata (no direct storage URL)
    v
[Browser]

--- Later: Download ---

[Browser]
    |
    | 7. GET /api/v1/attachments/:id/download
    v
(Go API)
    |
    | 8. Verify auth + org_id ownership
    | 9. Generate presigned URL (15 min expiry)
    v
[[Object Storage]] (presigned URL)
    |
    | 10. Redirect or proxy file to browser
    v
[Browser]
```

### Threats at Each Step

| Step | STRIDE | Threat | Mitigation |
|---|---|---|---|
| 1 | D | Large file DoS | `http.MaxBytesReader` (e.g., 5MB) |
| 1 | T | CSRF upload | CSRF token required |
| 2 | T | Malicious file type | Magic byte detection, type allowlist |
| 2 | E | Cross-tenant upload | org_id from session |
| 3 | T | Path traversal | Server-generated UUID key, never user filename |
| 4 | I | Unencrypted storage | Encryption at rest (S3 SSE) |
| 7 | E | IDOR on download | Composite lookup: attachment + org_id |
| 9 | I | Long-lived URL | Presigned URL expires in 15 minutes |
| 10 | I | Direct storage access | Files served through API, never direct |

## Template 4: Background Job Processing

```
(Go API Handler)
    |
    | 1. INSERT INTO jobs (kind, args, org_id)
    v
[[PostgreSQL - jobs table]]
    |
    | 2. SELECT ... FOR UPDATE SKIP LOCKED (polling)
    v
(Worker Process)
    |
    | 3. Process job (email, webhook, cleanup, etc.)
    |
    +-----> [Email Service] (send notification)
    +-----> [External API] (webhook delivery)
    +-----> [[PostgreSQL]] (data updates)
    |
    | 4. UPDATE jobs SET status = 'completed'
    v
[[PostgreSQL - jobs table]]
```

### Threats at Each Step

| Step | STRIDE | Threat | Mitigation |
|---|---|---|---|
| 1 | T | Job payload tampering | Validate args on dequeue, not just enqueue |
| 1 | D | Queue flooding | Per-tenant job limits, deduplication |
| 1 | E | Tenant context injection | org_id from session at enqueue time |
| 2 | S | Job impersonation | Validate org_id in job matches expected context |
| 3 | I | Sensitive data in job args | Reference by ID, minimize payload |
| 3 | D | Poison pill (always fails) | Max retry count, dead-letter handling |
| 3 | R | Silent failure | Log job start, completion, failure with job ID |
| 4 | T | Status manipulation | Worker owns status transitions |

## Template 5: Multi-Tenant Data Access

```
[Browser - Tenant A User]          [Browser - Tenant B User]
         |                                    |
         | session_a (org_id = A)             | session_b (org_id = B)
         v                                    v
              (Go API - Auth Middleware)
              Sets org_id from session
                        |
                        v
              (Go API - Handler)
              Uses org_id in all queries
                        |
                        v
              [[PostgreSQL]]
              RLS: organization_id = current_setting('app.current_org_id')
              
              +------------------+------------------+
              | Tenant A Data    | Tenant B Data    |
              | org_id = A       | org_id = B       |
              +------------------+------------------+
```

### Trust Boundaries

```
--- TB-Auth ---     Session ↔ Unauthenticated
--- TB-Tenant ---   Tenant A ↔ Tenant B (logical, same DB)
--- TB-Role ---     Admin ↔ Regular User (within tenant)
```

### Critical Invariants

1. `organization_id` ALWAYS comes from session middleware
2. Every query includes `AND organization_id = $org_id`
3. RLS provides defense-in-depth (not primary control)
4. 404 returned for cross-tenant access (not 403)
5. Audit logs include `organization_id` for every action

## Creating Custom DFDs

When modeling a new feature:

1. **Start with Template 1** as the base system diagram
2. **Zoom into the feature area** — create a Level 1 DFD for the specific subsystem
3. **Identify all data flows** — what data moves, where, using what protocol
4. **Mark trust boundaries** — where does trust level change?
5. **Label everything** — protocols, data types, authentication mechanisms
6. **Apply STRIDE** — use the stride-per-element reference for each element
7. **Document findings** — use the threat entry template from SKILL.md

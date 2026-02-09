# STRIDE-per-Element Analysis

Systematic threat enumeration by applying STRIDE to each DFD element type. For each component in your system, ask every applicable question.

## External Entities (Users, Browsers, Third-Party APIs)

Applicable: **Spoofing, Repudiation**

### Spoofing

| Component | Threat | Example | Mitigation |
|---|---|---|---|
| Browser user | Session hijacking | Stolen session cookie via XSS | HttpOnly + Secure + SameSite cookies |
| Browser user | Credential theft | Phishing, keylogger | MFA, passwordless auth |
| Browser user | Token replay | Reusing a captured auth token | Short-lived tokens, single-use tokens |
| API client | API key theft | Key exposed in client code or logs | Server-side key storage, key rotation |
| Webhook sender | Forged webhook | Attacker sends fake webhook payload | HMAC signature verification |
| Email sender | Spoofed sender | Forged From header on inbound email | SPF/DKIM/DMARC validation |

### Repudiation

| Component | Threat | Example | Mitigation |
|---|---|---|---|
| Browser user | Deny action | User claims they didn't submit data | Audit log with user ID, timestamp, IP |
| API client | Deny API call | Client denies making a destructive call | Request logging with authentication context |
| Webhook sender | Deny delivery | Sender claims webhook was never sent | Log webhook receipt with signature, timestamp |

## Processes (Go API Server, Next.js SSR, Background Workers)

Applicable: **All six STRIDE categories**

### Spoofing

| Component | Threat | Example | Mitigation |
|---|---|---|---|
| Go API | Bypass authentication | Missing `RequireAuth()` middleware on endpoint | Auth middleware on all protected routes |
| Go API | Session fixation | Attacker sets session ID before login | Regenerate session ID on authentication |
| Next.js SSR | Server-side auth bypass | SSR fetches data without verifying session | Forward session cookie, verify server-side |
| Worker | Job impersonation | Injecting jobs with spoofed tenant context | Validate job args, derive context from job metadata |

### Tampering

| Component | Threat | Example | Mitigation |
|---|---|---|---|
| Go API | Request body manipulation | Mass assignment (extra fields in JSON) | Explicit struct binding, ignore unknown fields |
| Go API | Path parameter tampering | Changing resource ID in URL (IDOR) | Composite lookup: `WHERE id = $1 AND org_id = $2` |
| Go API | Header injection | Manipulated `Content-Type` or custom headers | Validate Content-Type, ignore untrusted headers |
| Next.js | Client state manipulation | Modifying React state or localStorage | Server-side validation of all state-dependent actions |
| Worker | Job payload tampering | Modified job args in database | Validate job args on dequeue, not just enqueue |

### Repudiation

| Component | Threat | Example | Mitigation |
|---|---|---|---|
| Go API | Missing audit trail | State change without logging | Audit log all create/update/delete operations |
| Go API | Log injection | User input in log messages | Structured logging (zerolog) — auto-escapes values |
| Worker | Silent job failure | Job fails without trace | Log job start, completion, and failure with job ID |

### Information Disclosure

| Component | Threat | Example | Mitigation |
|---|---|---|---|
| Go API | Verbose error responses | Stack trace or SQL error in HTTP response | Generic error messages; log details internally |
| Go API | Excessive data in response | Returning full user object with password hash | Explicit response structs (never return DB models directly) |
| Go API | Timing side-channel | Login response time reveals if email exists | Constant-time comparison, uniform response times |
| Next.js SSR | Server props leaking | Sensitive data passed to client via SSR props | Filter server data before passing to client components |
| Next.js | Source maps in production | Full source code accessible | Disable source maps in production build |
| Worker | Sensitive data in job args | PII stored in jobs table | Minimize job payload; reference by ID, not value |

### Denial of Service

| Component | Threat | Example | Mitigation |
|---|---|---|---|
| Go API | Unbounded request body | 10GB POST body exhausts memory | `http.MaxBytesReader` on all endpoints |
| Go API | Regex DoS (ReDoS) | Crafted input causes exponential regex backtracking | Avoid complex regex on user input; use `re2` semantics |
| Go API | Connection exhaustion | Slowloris or many concurrent connections | Read/Write/Idle timeouts, connection limits |
| Go API | DB pool exhaustion | Slow queries hold all connections | `context.WithTimeout`, connection pool limits |
| Next.js | Client-side memory leak | Uncleanup'd subscriptions or intervals | Cleanup in useEffect return, proper component lifecycle |
| Worker | Queue flooding | Millions of jobs enqueued | Per-tenant job limits, deduplication |
| Worker | Poison pill job | Job that always fails, retried forever | Max retry count, dead-letter handling |

### Elevation of Privilege

| Component | Threat | Example | Mitigation |
|---|---|---|---|
| Go API | Missing permission check | Endpoint lacks `RequirePermission()` | RBAC middleware on all protected routes |
| Go API | Tenant isolation bypass | Query without `organization_id` filter | Derive org from session; code review checklist |
| Go API | Role manipulation | User modifies their own role | Role changes require admin permission + audit log |
| Next.js | Client-side auth bypass | Hiding UI elements but not checking server-side | Server-side authorization on every request |
| Worker | Worker runs as superuser | Worker process has excessive DB permissions | Least-privilege DB role for worker connections |

## Data Stores (PostgreSQL, Object Storage, Session Store)

Applicable: **Tampering, Information Disclosure, Denial of Service**

### Tampering

| Component | Threat | Example | Mitigation |
|---|---|---|---|
| PostgreSQL | SQL injection | Raw SQL with string concatenation | sqlc parameterized queries only |
| PostgreSQL | Direct DB access | Attacker gains DB credentials | Network segmentation, strong credentials, TLS |
| PostgreSQL | Migration tampering | Malicious migration alters data | Migration review process, checksums |
| Object storage | File replacement | Overwriting existing files | Immutable keys (UUID-based), versioning |
| Session store | Session data manipulation | Modifying session record directly | Server-side sessions, integrity checks |

### Information Disclosure

| Component | Threat | Example | Mitigation |
|---|---|---|---|
| PostgreSQL | Unencrypted connections | Sniffing DB traffic on network | TLS for all DB connections (`sslmode=require`) |
| PostgreSQL | Backup exposure | Unencrypted backups accessible | Encrypted backups, restricted access |
| PostgreSQL | Cross-tenant query | Missing RLS or org filter | RLS + application-level org filter |
| Object storage | Direct URL access | Guessable or leaked storage URLs | Presigned URLs with short expiry (15 min) |
| Object storage | Path traversal | Accessing files outside tenant prefix | UUID-based keys, tenant-prefixed paths |
| Session store | Session data exposure | Reading another user's session | Session ID entropy (256-bit), HttpOnly cookies |

### Denial of Service

| Component | Threat | Example | Mitigation |
|---|---|---|---|
| PostgreSQL | Long-running queries | Unindexed query locks tables | Query timeouts, proper indexing, EXPLAIN ANALYZE |
| PostgreSQL | Connection exhaustion | Too many concurrent connections | Connection pooling (pgx pool), max connections |
| PostgreSQL | Disk exhaustion | Unbounded data growth | Monitoring, retention policies, per-tenant quotas |
| Object storage | Storage exhaustion | Uploading massive files | File size limits, per-tenant storage quotas |

## Data Flows (HTTP Requests, DB Queries, File Uploads)

Applicable: **Tampering, Information Disclosure, Denial of Service**

### Tampering

| Flow | Threat | Example | Mitigation |
|---|---|---|---|
| Browser → API | MITM modification | Altering request in transit | HTTPS everywhere (TLS 1.2+) |
| Browser → API | CSRF | Forged cross-origin request | SameSite cookies + CSRF token header |
| API → DB | Query manipulation | SQL injection | sqlc parameterized queries |
| API → Storage | Path injection | Manipulated storage key | Server-generated UUID keys |
| Webhook → API | Payload tampering | Modified webhook body | HMAC signature verification |

### Information Disclosure

| Flow | Threat | Example | Mitigation |
|---|---|---|---|
| API → Browser | Sensitive data in response | Password hashes, internal IDs | Explicit response DTOs |
| API → Browser | Data in URL | Sensitive params in query string | POST for sensitive data, no PII in URLs |
| API → DB | Connection string exposure | DB URL in logs or error messages | Environment variables, never log connection strings |
| API → Email | PII in email | Sensitive data in email body | Minimize PII, use links to authenticated views |

### Denial of Service

| Flow | Threat | Example | Mitigation |
|---|---|---|---|
| Browser → API | Request flooding | Automated requests overwhelming API | Rate limiting (httprate), per-IP and per-user |
| Browser → API | Large payload | Oversized JSON or file upload | `http.MaxBytesReader`, upload size limits |
| API → DB | Expensive queries | Full table scan on large table | Query timeouts, proper indexes, pagination |
| External → Webhook | Webhook flooding | Rapid-fire webhook deliveries | Rate limiting on webhook endpoints |

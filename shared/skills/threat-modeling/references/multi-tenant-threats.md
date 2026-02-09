# Multi-Tenant Threat Analysis

Multi-tenant SaaS applications share infrastructure across tenants, creating unique threat vectors beyond standard web application security. Every feature must be evaluated for tenant isolation.

## Threat Categories

### 1. Cross-Tenant Data Leakage

**Description**: Bugs or missing filters expose one tenant's data to another.

**Attack Vectors**:
- Database query missing `organization_id` filter
- Cache key collision (no tenant prefix)
- File storage path traversal across tenant boundaries
- Search index returning cross-tenant results
- Background job processing data from wrong tenant
- API response including data from multiple tenants
- Log aggregation mixing tenant data

**Mitigations**:
```go
// REQUIRED: Every tenant-scoped query filters by org_id
// -- name: GetItem :one
// SELECT * FROM items WHERE id = $1 AND organization_id = $2;

// REQUIRED: org_id from session, NEVER from request
orgID := middleware.OrgID(r.Context())

// REQUIRED: Composite lookups prevent IDOR
// WHERE id = $1 AND organization_id = $2
// NOT: WHERE id = $1

// REQUIRED: Tenant-prefixed cache keys
cacheKey := fmt.Sprintf("tenant:%s:item:%s", orgID, itemID)

// REQUIRED: Tenant-prefixed storage paths
storagePath := fmt.Sprintf("%s/%s/%s", orgID, resourceType, uuid.New())
```

**Testing**:
- Create test with two tenants, verify Tenant A cannot access Tenant B's data
- Test every endpoint with a valid resource ID belonging to a different tenant
- Verify 404 (not 403) to prevent enumeration

### 2. Tenant Context Injection

**Description**: Attacker manipulates the tenant identifier to impersonate another tenant.

**Attack Vectors**:
- `organization_id` accepted from request body, header, or query parameter
- Tenant ID in URL path without session validation
- Tenant context stored in client-side state (localStorage, cookie)
- Webhook or API callback with spoofed tenant context

**Mitigations**:
```go
// CORRECT: Derive from authenticated session
orgID := middleware.OrgID(r.Context())  // Set by auth middleware from session

// FORBIDDEN: Accept from request
var req struct { OrgID string `json:"org_id"` }  // NEVER
orgID := r.Header.Get("X-Org-ID")                // NEVER
orgID := r.URL.Query().Get("org_id")              // NEVER
orgID := chi.URLParam(r, "orgID")                 // NEVER (unless platform admin)
```

### 3. Noisy Neighbor (Resource Exhaustion)

**Description**: One tenant consumes disproportionate shared resources, degrading service for others.

**Attack Vectors**:
- Excessive API requests from one tenant
- Large file uploads consuming storage
- Expensive database queries holding connections
- Background job flooding
- Memory-intensive operations

**Mitigations**:
```go
// Per-tenant rate limiting
r.Use(httprate.Limit(
    100,                          // requests
    time.Minute,                  // window
    httprate.WithKeyFuncs(func(r *http.Request) (string, error) {
        orgID, _ := middleware.OrgID(r.Context())
        return orgID.String(), nil
    }),
))

// Per-tenant storage quotas
// Check quota before accepting upload
if currentUsage + fileSize > tenantQuota {
    respondError(w, http.StatusPaymentRequired, "storage quota exceeded")
    return
}

// Per-tenant job limits
// Check active job count before enqueuing
// SELECT COUNT(*) FROM jobs WHERE organization_id = $1 AND status = 'pending'
```

### 4. Cross-Tenant Privilege Escalation

**Description**: User in Tenant A gains admin or elevated access in Tenant B.

**Attack Vectors**:
- RBAC check uses role without verifying tenant membership
- Invitation system allows joining arbitrary tenants
- Admin endpoints accessible across tenant boundaries
- Platform admin functions exposed to tenant admins

**Mitigations**:
```go
// RBAC must be org-scoped
// Verify user belongs to the org AND has the required role
membership, err := h.queries.GetMembership(ctx, sqlc.GetMembershipParams{
    UserID:         userID,
    OrganizationID: orgID,
})
if err != nil {
    respondError(w, http.StatusForbidden, "access denied")
    return
}
if !domain.HasPermission(membership.Role, requiredPermission) {
    respondError(w, http.StatusForbidden, "insufficient permissions")
    return
}
```

### 5. Shared Resource Poisoning

**Description**: Attacker injects malicious data into shared infrastructure components.

**Attack Vectors**:
- Cache poisoning (writing to another tenant's cache key)
- Message queue injection (inserting jobs for another tenant)
- Shared temp directory exploitation
- DNS rebinding against internal services

**Mitigations**:
- Tenant-prefix ALL shared resource keys (cache, queue, storage)
- Validate tenant context on both write AND read operations
- Isolate temp directories per request/tenant
- Internal service authentication (not just network-level trust)

### 6. Insecure Tenant Lifecycle

**Description**: Vulnerabilities in tenant onboarding, offboarding, or data management.

**Attack Vectors**:
- Incomplete tenant provisioning leaves default/weak credentials
- Tenant deletion doesn't purge all data (orphaned records, files, cache)
- Suspended tenant can still access API via cached sessions
- Tenant data export includes data from other tenants

**Mitigations**:
- Provisioning checklist: verify all resources created, defaults overridden
- Deletion cascade: database records, storage files, cache entries, sessions, jobs
- Suspension: invalidate all active sessions immediately
- Export: verify every query in export pipeline filters by `organization_id`

## Database Isolation Strategies

| Strategy | Isolation Level | Complexity | Use When |
|---|---|---|---|
| Separate databases | Highest | High | Regulated industries, enterprise customers |
| Separate schemas | High | Medium | Need strong isolation with shared infrastructure |
| Shared tables + RLS | Medium | Low | Cost-sensitive, high tenant count |
| Hybrid | Variable | Variable | Different tiers for different customer segments |

### Shared Tables with RLS (Recommended for Most SaaS)

```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE items FORCE ROW LEVEL SECURITY;  -- Applies to table owner too

-- Policy: users can only see their org's data
CREATE POLICY tenant_isolation ON items
    USING (organization_id = current_setting('app.current_org_id')::uuid);

-- Set context before queries (in middleware or connection setup)
SET LOCAL app.current_org_id = 'org-uuid-here';
```

**Important**: RLS is defense-in-depth, NOT a replacement for application-level `organization_id` filtering. Always filter in application code AND use RLS.

## Multi-Tenant Threat Checklist

Use this checklist when reviewing any feature in a multi-tenant application:

### Data Access
- [ ] Every query on tenant data includes `organization_id` filter
- [ ] `organization_id` derived from session, never from request
- [ ] Composite lookups used: `WHERE id = $1 AND organization_id = $2`
- [ ] PostgreSQL RLS enabled on tenant-scoped tables
- [ ] IDOR tested: valid ID from Tenant B returns 404 for Tenant A

### Shared Resources
- [ ] Cache keys prefixed with tenant ID
- [ ] Storage paths prefixed with tenant ID
- [ ] Background jobs include and validate tenant context
- [ ] Search indexes scoped to tenant
- [ ] Temp files isolated per request

### Access Control
- [ ] RBAC checks verify tenant membership (not just role)
- [ ] Invitation/join flows validate authorization
- [ ] Admin functions scoped to tenant (not platform-wide)
- [ ] Session invalidated on tenant suspension

### Logging & Monitoring
- [ ] All log entries include `organization_id`
- [ ] Alerts on cross-tenant access attempts
- [ ] Per-tenant usage metrics tracked
- [ ] Audit trail includes tenant context

### Resource Limits
- [ ] Per-tenant rate limiting configured
- [ ] Per-tenant storage quotas enforced
- [ ] Per-tenant job queue limits set
- [ ] Per-tenant API call quotas defined

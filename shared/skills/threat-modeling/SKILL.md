---
name: threat-modeling
description: Threat modeling for {{PROJECT_NAME}}. STRIDE analysis, DFDs, trust boundaries, attack trees, multi-tenant threats, risk rating. Use when designing new features, reviewing architecture, adding API endpoints, or assessing security posture.
allowed-tools: Read Grep Glob
compatibility: Go 1.25+, Next.js 16, PostgreSQL 16+
---

# Threat Modeling for {{PROJECT_NAME}}

## When to Activate

- Designing a new feature or subsystem
- Adding new API endpoints or data flows
- Changing authentication, authorization, or session handling
- Introducing new external integrations (webhooks, email, storage)
- Reviewing architecture for security posture
- After a security incident (update the threat model)
- Before a major release

## The Four Questions

Every threat model answers these questions (from the Threat Modeling Manifesto):

1. **What are we working on?** — System model (DFD, trust boundaries, data classification)
2. **What can go wrong?** — Threat identification (STRIDE, attack trees, CAPEC/CWE)
3. **What are we going to do about it?** — Mitigate, eliminate, transfer, or accept
4. **Did we do a good enough job?** — Validate mitigations, review coverage

## Step 1: Create a Data Flow Diagram

Map the system using these elements:

| Symbol | Element | Description |
|---|---|---|
| Rectangle | External Entity | Users, browsers, third-party APIs, email providers |
| Circle | Process | Go API server, Next.js SSR, background workers |
| Parallel lines | Data Store | PostgreSQL, object storage, session store |
| Arrow | Data Flow | HTTP requests, DB queries, file uploads (label with protocol) |
| Dashed line | Trust Boundary | Where trust levels change |

### Typical Web App DFD

```
[Browser] --(HTTPS)--> [Next.js SSR/SPA]
[Next.js] --(HTTP/internal)--> [Go API Server]
[Go API] --(pgx/TLS)--> [PostgreSQL]
[Go API] --(S3 API)--> [Object Storage]
[Go API] --(SMTP)--> [Email Service]
[Go Worker] --(pgx)--> [PostgreSQL] (polling jobs table)
[External] --(Webhook)--> [Go Inbound Handler]
```

### Trust Boundaries to Identify

| ID | Boundary | From → To |
|---|---|---|
| TB1 | Internet ↔ Application | Anonymous users → Load balancer / Next.js |
| TB2 | Frontend ↔ Backend API | Next.js → Go API (authenticated) |
| TB3 | Application ↔ Database | Go API → PostgreSQL (DB credentials) |
| TB4 | Application ↔ Object Storage | Go API → S3/MinIO (API keys) |
| TB5 | Tenant A ↔ Tenant B | Logical boundary (organization_id) |
| TB6 | Unauthenticated ↔ Authenticated | Session middleware boundary |
| TB7 | Regular User ↔ Admin | RBAC middleware boundary |
| TB8 | Application ↔ External Services | Go API → email, webhooks, third-party APIs |

For each boundary, document: what data crosses it, what controls exist, what threats apply.

## Step 2: Apply STRIDE to Each Element

STRIDE classifies threats by the security property they violate:

| Category | Violates | Question to Ask |
|---|---|---|
| **S**poofing | Authentication | Can an attacker pretend to be someone/something else? |
| **T**ampering | Integrity | Can an attacker modify data they shouldn't? |
| **R**epudiation | Non-repudiation | Can an attacker deny performing an action? |
| **I**nformation Disclosure | Confidentiality | Can an attacker access data they shouldn't see? |
| **D**enial of Service | Availability | Can an attacker make the system unavailable? |
| **E**levation of Privilege | Authorization | Can an attacker gain access beyond their role? |

### STRIDE-per-Element (Which Threats Apply Where)

| Element Type | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| External Entity | ✓ | | ✓ | | | |
| Process | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Data Store | | ✓ | | ✓ | ✓ | |
| Data Flow | | ✓ | | ✓ | ✓ | |

See `references/stride-per-element.md` for detailed per-component analysis.

## Step 3: Rate Each Threat

Use a qualitative rating for speed:

| Rating | Likelihood × Impact | Action |
|---|---|---|
| **Critical** | Exploitable + catastrophic damage | Fix before release |
| **High** | Likely + significant damage | Fix in current sprint |
| **Medium** | Possible + moderate damage | Schedule for next sprint |
| **Low** | Unlikely + minimal damage | Accept or backlog |

For more granular scoring, use DREAD:

```
Score = (Damage + Reproducibility + Exploitability + Affected Users + Discoverability) / 5

Damage:          1 (minimal) → 10 (complete system compromise)
Reproducibility: 1 (rare conditions) → 10 (always reproducible)
Exploitability:  1 (requires advanced skills) → 10 (browser address bar)
Affected Users:  1 (single user) → 10 (all users/tenants)
Discoverability: 1 (very difficult) → 10 (publicly documented)
```

| Score | Risk Level |
|---|---|
| 12–15 | Critical |
| 8–11 | High |
| 4–7 | Medium |
| 1–3 | Low |

## Step 4: Define Mitigations

For each identified threat, choose a response:

| Response | When to Use |
|---|---|
| **Mitigate** | Reduce risk with a security control (most common) |
| **Eliminate** | Remove the feature or data flow entirely |
| **Transfer** | Shift risk to a third party (insurance, managed service) |
| **Accept** | Risk is low enough to tolerate (document the decision) |

### Mitigation Patterns by STRIDE Category

| Threat | Primary Mitigations |
|---|---|
| Spoofing | Strong authentication, MFA, secure session management, constant-time token comparison |
| Tampering | Input validation, parameterized queries (sqlc), digital signatures, integrity checks |
| Repudiation | Structured audit logging (zerolog), immutable audit trail, correlation IDs |
| Information Disclosure | Encryption (TLS + at-rest), access control (RBAC), generic error messages, data minimization |
| Denial of Service | Rate limiting (httprate), request size limits, timeouts, connection pooling, background jobs for heavy work |
| Elevation of Privilege | RBAC (`middleware.RequirePermission()`), least privilege, tenant isolation (`organization_id` from session) |

## Step 5: Document the Threat Model

### Threat Entry Template

```markdown
### T-{number}: {Threat Title}

- **Category**: Spoofing | Tampering | Repudiation | Info Disclosure | DoS | EoP
- **Element**: {DFD element affected}
- **Trust Boundary**: {boundary crossing, if applicable}
- **Description**: {What can go wrong}
- **Risk**: Critical | High | Medium | Low
- **DREAD**: D={n} R={n} E={n} A={n} D={n} → Score: {avg}
- **Mitigation**: {What we do about it}
- **Status**: Mitigated | Accepted | Open
- **References**: CWE-{id}, CAPEC-{id}
```

### Example

```markdown
### T-001: Cross-Tenant Data Leakage via Missing Org Filter

- **Category**: Information Disclosure / Elevation of Privilege
- **Element**: Go API → PostgreSQL data flow
- **Trust Boundary**: TB5 (Tenant A ↔ Tenant B)
- **Description**: A query missing the `organization_id` filter could return
  data belonging to another tenant. An attacker could enumerate resource IDs
  to access cross-tenant data.
- **Risk**: Critical
- **DREAD**: D=10 R=8 E=7 A=10 D=6 → Score: 8.2 (High)
- **Mitigation**:
  - All queries filter by `organization_id` (derived from session, never request)
  - PostgreSQL RLS as defense-in-depth
  - Composite lookups: `WHERE id = $1 AND organization_id = $2`
  - Code review checklist enforces org filter on every query
- **Status**: Mitigated
- **References**: CWE-639 (Authorization Bypass Through User-Controlled Key)
```

## Multi-Tenant Threat Considerations

Multi-tenant SaaS applications have an additional threat surface. See `references/multi-tenant-threats.md` for the full analysis. Key concerns:

| Threat | Description | Mitigation |
|---|---|---|
| Cross-tenant data leakage | Queries missing org filter expose other tenants' data | Always filter by `organization_id` from session |
| Tenant context injection | Attacker manipulates tenant identifier | Derive from authenticated session, never request |
| Noisy neighbor | One tenant exhausts shared resources | Per-tenant rate limiting and quotas |
| Cross-tenant privilege escalation | Admin of Tenant A accesses Tenant B | Org-scoped RBAC, composite lookups |
| Shared resource poisoning | Cache or queue injection across tenants | Tenant-prefixed cache keys and storage paths |

## Attack Trees

For high-risk threats, build attack trees to enumerate all paths. See `references/attack-trees.md` for the methodology and examples.

```
Goal: Access another tenant's data
├── OR: Bypass org_id filter
│   ├── Find endpoint missing org filter
│   ├── SQL injection to bypass WHERE clause
│   └── Manipulate org_id in request (if not from session)
├── OR: Escalate to platform admin
│   ├── Exploit RBAC misconfiguration
│   └── Session fixation / hijacking
└── OR: Direct database access
    ├── Steal DB credentials from config
    └── Exploit network segmentation gap
```

## Threat Libraries (Cross-Reference)

Map identified threats to standard taxonomies:

| Taxonomy | Purpose | Use For |
|---|---|---|
| **CWE** | Common Weakness Enumeration | Categorize the underlying weakness |
| **CAPEC** | Common Attack Pattern Enumeration | Describe how the attack works |
| **OWASP Top 10** | Most critical web app risks | Prioritize common web threats |
| **MITRE ATT&CK** | Adversary tactics and techniques | Operational threat intelligence |

### Common CWE Mappings for Web Apps

| CWE | Name | STRIDE |
|---|---|---|
| CWE-89 | SQL Injection | Tampering, Info Disclosure, EoP |
| CWE-79 | Cross-Site Scripting (XSS) | Tampering, Info Disclosure |
| CWE-352 | Cross-Site Request Forgery (CSRF) | Spoofing |
| CWE-639 | Authorization Bypass via User-Controlled Key (IDOR) | EoP |
| CWE-200 | Exposure of Sensitive Information | Info Disclosure |
| CWE-307 | Improper Restriction of Excessive Auth Attempts | Spoofing, DoS |
| CWE-862 | Missing Authorization | EoP |
| CWE-863 | Incorrect Authorization | EoP |
| CWE-918 | Server-Side Request Forgery (SSRF) | Info Disclosure, EoP |
| CWE-400 | Uncontrolled Resource Consumption | DoS |
| CWE-502 | Deserialization of Untrusted Data | Tampering, EoP |
| CWE-778 | Insufficient Logging | Repudiation |

## When to Update the Threat Model

- New feature or endpoint added
- Architecture or infrastructure change
- New external integration
- Security incident occurred
- New technology adopted
- Significant data model change
- Quarterly review (at minimum)

## Agent Workflow for Threat Modeling

When an AI agent performs threat modeling:

1. **Analyze** — Read codebase structure, identify components, data flows, trust boundaries
2. **Diagram** — Produce a text-based DFD of the system or feature
3. **Enumerate** — Apply STRIDE-per-element to each component and boundary crossing
4. **Cross-reference** — Map threats to CWE/CAPEC entries
5. **Check mitigations** — Verify existing security controls address identified threats
6. **Report** — Generate structured threat entries using the template above
7. **Recommend** — Prioritize unmitigated threats and suggest specific fixes

### Limitations

- AI-generated threat models should always be reviewed by a security-aware human
- Subtle business logic flaws may be missed — domain expertise is essential
- Treat AI output as a starting point, not a final assessment

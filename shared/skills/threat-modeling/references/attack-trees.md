# Attack Trees

Attack trees are hierarchical decompositions of an attacker's goal into sub-goals and atomic attack steps. They help enumerate all known paths to a security breach and identify which mitigations provide the most value.

## Structure

```
Root: Attacker's Goal
├── OR: Sub-goal A (any child suffices)
│   ├── AND: Sub-goal A1 (all children required)
│   │   ├── Leaf: Atomic step
│   │   └── Leaf: Atomic step
│   └── Leaf: Atomic step
└── OR: Sub-goal B
    └── Leaf: Atomic step
```

- **OR nodes**: Any single child path achieves the parent goal
- **AND nodes**: All child conditions must be met together
- **Leaf nodes**: Atomic attack steps (annotate with cost, skill, detectability)

## Leaf Annotations

Each leaf node can carry attributes for risk comparison:

| Attribute | Scale | Description |
|---|---|---|
| Cost | $ / $$ / $$$ | Resources needed (time, money, tools) |
| Skill | Low / Medium / High | Technical expertise required |
| Detectability | Easy / Medium / Hard | How likely the attack is detected |
| Probability | Low / Medium / High | Likelihood of success |

## Propagation Rules

- **OR node**: Takes the **minimum** (cheapest/easiest) child value
- **AND node**: Takes the **sum** (all costs combined) of child values

This reveals the cheapest/easiest attack path through the tree.

## Building Attack Trees

1. **Define the root goal** — What does the attacker want? (e.g., "Access admin panel", "Read another tenant's data")
2. **Decompose into sub-goals** — What intermediate objectives lead to the goal?
3. **Continue decomposition** — Break sub-goals into smaller steps until reaching atomic actions
4. **Annotate leaves** — Add cost, skill, detectability, probability
5. **Propagate values** — Calculate the cheapest/easiest path
6. **Identify critical nodes** — Single points of failure, high-value mitigations
7. **Map mitigations** — Mark which controls block which paths

## Common Attack Trees for Web Applications

### Tree 1: Steal User Credentials

```
Goal: Obtain valid user credentials
├── OR: Phishing
│   ├── AND: Targeted phishing
│   │   ├── Gather target email (Cost: $, Skill: Low, Detect: Hard)
│   │   ├── Craft convincing email (Cost: $, Skill: Medium, Detect: Medium)
│   │   └── Host fake login page (Cost: $, Skill: Medium, Detect: Medium)
│   └── Spray phishing campaign (Cost: $$, Skill: Low, Detect: Easy)
├── OR: Credential stuffing
│   ├── Obtain breached credential list (Cost: $, Skill: Low, Detect: Hard)
│   └── Automate login attempts (Cost: $, Skill: Low, Detect: Easy)
├── OR: Session hijacking
│   ├── XSS to steal cookie (Cost: $, Skill: Medium, Detect: Medium)
│   ├── Network sniffing (no TLS) (Cost: $, Skill: Medium, Detect: Hard)
│   └── Session fixation (Cost: $, Skill: Medium, Detect: Hard)
├── OR: Brute force
│   └── Automated password guessing (Cost: $, Skill: Low, Detect: Easy)
└── OR: Token theft
    ├── Auth token in URL/logs (Cost: $, Skill: Low, Detect: Hard)
    └── Token reuse after expiry (Cost: $, Skill: Low, Detect: Medium)
```

**Cheapest path**: Credential stuffing (low cost, low skill)
**Key mitigations**: MFA (blocks most paths), rate limiting (blocks brute force), HttpOnly cookies (blocks XSS session theft)

### Tree 2: Cross-Tenant Data Access (Multi-Tenant)

```
Goal: Access another tenant's data
├── OR: Bypass organization_id filter
│   ├── Find endpoint missing org filter (Cost: $, Skill: Medium, Detect: Hard)
│   ├── SQL injection to bypass WHERE clause (Cost: $$, Skill: High, Detect: Medium)
│   └── Manipulate org_id in request body (Cost: $, Skill: Low, Detect: Easy)
├── OR: IDOR (Insecure Direct Object Reference)
│   ├── Enumerate resource IDs (Cost: $, Skill: Low, Detect: Medium)
│   └── Guess predictable IDs (Cost: $, Skill: Low, Detect: Medium)
├── OR: Escalate to platform admin
│   ├── AND: Exploit RBAC misconfiguration
│   │   ├── Find role assignment endpoint (Cost: $, Skill: Medium, Detect: Medium)
│   │   └── Assign admin role to self (Cost: $, Skill: Low, Detect: Easy)
│   └── AND: Session manipulation
│       ├── Modify session data (Cost: $$, Skill: High, Detect: Medium)
│       └── Change org context in session (Cost: $$, Skill: High, Detect: Medium)
├── OR: Direct database access
│   ├── Steal DB credentials from config/env (Cost: $$, Skill: Medium, Detect: Hard)
│   ├── Exploit network segmentation gap (Cost: $$$, Skill: High, Detect: Medium)
│   └── Access unencrypted backup (Cost: $$, Skill: Medium, Detect: Hard)
└── OR: Cache/queue poisoning
    ├── Inject data into shared cache (Cost: $$, Skill: High, Detect: Hard)
    └── Manipulate job queue (Cost: $$, Skill: High, Detect: Medium)
```

**Cheapest path**: IDOR with enumerable IDs (low cost, low skill)
**Key mitigations**: Composite lookups (`WHERE id = $1 AND org_id = $2`), UUIDs for resource IDs, org_id always from session

### Tree 3: Denial of Service

```
Goal: Make the application unavailable
├── OR: Application layer
│   ├── Request flooding (Cost: $, Skill: Low, Detect: Easy)
│   ├── Large payload attack (Cost: $, Skill: Low, Detect: Easy)
│   ├── Regex DoS (ReDoS) (Cost: $, Skill: Medium, Detect: Hard)
│   └── Expensive query trigger (Cost: $, Skill: Medium, Detect: Medium)
├── OR: Resource exhaustion
│   ├── DB connection pool exhaustion (Cost: $$, Skill: Medium, Detect: Medium)
│   ├── Disk space exhaustion (Cost: $$, Skill: Low, Detect: Easy)
│   ├── Memory exhaustion (large uploads) (Cost: $, Skill: Low, Detect: Easy)
│   └── Worker queue flooding (Cost: $, Skill: Medium, Detect: Medium)
├── OR: Network layer
│   ├── Volumetric DDoS (Cost: $$$, Skill: Low, Detect: Easy)
│   └── Slowloris (slow connections) (Cost: $, Skill: Medium, Detect: Medium)
└── OR: Dependency disruption
    ├── DNS poisoning (Cost: $$$, Skill: High, Detect: Medium)
    └── Upstream service outage (Cost: N/A, Skill: N/A, Detect: Easy)
```

**Cheapest path**: Request flooding or large payload (low cost, low skill)
**Key mitigations**: Rate limiting, `http.MaxBytesReader`, server timeouts, CDN/WAF

### Tree 4: Privilege Escalation

```
Goal: Gain admin access from regular user
├── OR: RBAC bypass
│   ├── Find endpoint without permission check (Cost: $, Skill: Medium, Detect: Hard)
│   ├── Manipulate role in request (Cost: $, Skill: Low, Detect: Easy)
│   └── Exploit role inheritance bug (Cost: $$, Skill: High, Detect: Hard)
├── OR: Session manipulation
│   ├── Modify session cookie (Cost: $$, Skill: High, Detect: Medium)
│   └── Session fixation with admin session (Cost: $$, Skill: High, Detect: Medium)
├── OR: JWT tampering (if used)
│   ├── Algorithm confusion (alg:none) (Cost: $, Skill: Medium, Detect: Easy)
│   ├── Key confusion (RS256→HS256) (Cost: $$, Skill: High, Detect: Medium)
│   └── Modify claims without re-signing (Cost: $, Skill: Low, Detect: Easy)
└── OR: Exploit application logic
    ├── Race condition in permission check (Cost: $$, Skill: High, Detect: Hard)
    └── Parameter pollution (Cost: $, Skill: Medium, Detect: Medium)
```

**Cheapest path**: Missing permission check on endpoint (low cost, medium skill)
**Key mitigations**: `RequirePermission()` middleware on all routes, server-side sessions (not JWT), RBAC tests

## Using Attack Trees in Code Review

When reviewing code, mentally trace the relevant attack tree:

1. **New endpoint?** → Check Tree 4 (privilege escalation) — is auth/authz middleware present?
2. **New query?** → Check Tree 2 (cross-tenant) — is org_id filter present?
3. **New input?** → Check Tree 3 (DoS) — is input bounded?
4. **New auth flow?** → Check Tree 1 (credential theft) — are tokens secure?

## Documenting Attack Trees

Include attack trees in threat model documents for high-risk features. Update them when:

- New attack paths are discovered (security research, incidents)
- New mitigations are deployed (mark paths as blocked)
- Architecture changes add or remove components

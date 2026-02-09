# OWASP ASVS 5.0 — Condensed Verification Checklist

Condensed checklist of OWASP Application Security Verification Standard (ASVS) 5.0 requirements at Level 1 (L1) and Level 2 (L2). L1 is the minimum for all applications; L2 is recommended for applications handling sensitive data.

Requirements are grouped by chapter with the most actionable items highlighted. Full standard: https://github.com/OWASP/ASVS/tree/v5.0.0

> **How to use:** During security review, check each applicable section against the code under review. Mark items as verified, not applicable, or needing remediation.

---

## V1 — Encoding and Sanitization

### V1.1 Architecture (L2)
- [ ] Input decoded/unescaped into canonical form only once, before further processing
- [ ] Output encoding performed as final step before interpreter use

### V1.2 Injection Prevention (L1)
- [ ] Output encoding matches context (HTML elements, attributes, CSS, headers)
- [ ] URLs built from untrusted data use context-appropriate encoding; only safe protocols allowed
- [ ] JavaScript/JSON content dynamically built with proper escaping
- [ ] **Database queries use parameterized queries, ORMs, or equivalent — no string concatenation**
- [ ] OS command calls use parameterized APIs or contextual encoding

### V1.2 Injection Prevention (L2)
- [ ] LDAP queries protected against injection
- [ ] XPath queries use parameterization or precompiled queries
- [ ] Regular expressions escape user-supplied special characters

### V1.3 Sanitization (L1)
- [ ] Untrusted HTML sanitized with a well-known sanitization library
- [ ] No use of `eval()` or dynamic code execution with user input

### V1.3 Sanitization (L2)
- [ ] SSRF protection: untrusted URLs validated against allowlist of protocols, domains, ports
- [ ] Template injection protection: templates not built from untrusted input
- [ ] SMTP/IMAP injection: user input sanitized before passing to mail systems

### V1.5 Safe Deserialization (L1)
- [ ] XML parsers configured to disable external entities and DTDs

### V1.5 Safe Deserialization (L2)
- [ ] Deserialization of untrusted data uses allowlist of object types or restricts client-defined types

---

## V2 — Validation and Business Logic

### V2.2 Input Validation (L1)
- [ ] Input validated against business/functional expectations (allowlist of values, patterns, ranges)
- [ ] **Input validation enforced at trusted service layer — client-side validation is not a security control**

### V2.3 Business Logic (L1)
- [ ] Business logic flows processed in expected sequential order without skipping steps

### V2.3 Business Logic (L2)
- [ ] Business logic limits enforced per documentation
- [ ] Transactions used at business logic level (all-or-nothing)
- [ ] Limited-quantity resources protected against double-booking

### V2.4 Anti-automation (L2)
- [ ] Anti-automation controls protect against excessive calls (data exfiltration, DoS, quota exhaustion)

---

## V3 — Web Frontend Security

### V3.2 Content Interpretation (L1)
- [ ] Controls prevent browsers from rendering content in incorrect context (Sec-Fetch-* validation, CSP sandbox)
- [ ] Text content uses safe rendering functions (`textContent`, `createTextNode`) — not `innerHTML`

### V3.3 Cookie Setup (L1)
- [ ] Cookies have `Secure` attribute set

### V3.3 Cookie Setup (L2)
- [ ] `SameSite` attribute set according to cookie purpose
- [ ] `__Host-` prefix used for cookies (unless explicitly shared across hosts)
- [ ] Session cookies have `HttpOnly` attribute; session values only transferred via `Set-Cookie`

### V3.4 Security Headers (L1)
- [ ] `Strict-Transport-Security` header on all responses (max-age ≥ 1 year)
- [ ] CORS `Access-Control-Allow-Origin` is fixed value or validated against trusted origin allowlist

### V3.4 Security Headers (L2)
- [ ] Content-Security-Policy defined (minimum: `object-src 'none'`, `base-uri 'none'`)
- [ ] `X-Content-Type-Options: nosniff` on all responses
- [ ] Referrer-Policy set to prevent leaking sensitive URL data
- [ ] `frame-ancestors` directive in CSP (replaces X-Frame-Options)

### V3.5 Origin Separation (L1)
- [ ] **Anti-CSRF tokens or non-CORS-safelisted headers used for state-changing requests**
- [ ] CORS preflight cannot be bypassed for sensitive functionality
- [ ] Sensitive operations use appropriate HTTP methods (POST/PUT/DELETE, not GET)

### V3.5 Origin Separation (L2)
- [ ] Separate applications hosted on different hostnames (same-origin policy)
- [ ] `postMessage` validates origin and message syntax

---

## V4 — API and Web Service

### V4.1 Generic Security (L1)
- [ ] Every response with a body has correct `Content-Type` with charset parameter

### V4.1 Generic Security (L2)
- [ ] Only user-facing endpoints redirect HTTP→HTTPS (API endpoints don't silently redirect)
- [ ] Intermediary headers (X-Forwarded-*, X-Real-IP) cannot be overridden by end users

### V4.2 HTTP Message Validation (L2)
- [ ] All components agree on HTTP message boundaries (prevent request smuggling)

### V4.3 GraphQL (L2)
- [ ] Query depth limiting, cost analysis, or allowlist prevents DoS via nested queries
- [ ] Introspection disabled in production (unless API is public)

### V4.4 WebSocket (L1)
- [ ] WebSocket connections use WSS (TLS)

### V4.4 WebSocket (L2)
- [ ] Origin header validated during WebSocket handshake

---

## V5 — File Handling

### V5.2 Upload and Content (L1)
- [ ] File size limits enforced (prevent DoS)
- [ ] **File extension validated AND content validated (magic bytes) — both must match**

### V5.2 Upload and Content (L2)
- [ ] Compressed files checked against max uncompressed size and max file count

### V5.3 Storage (L1)
- [ ] Uploaded files in public folders cannot be executed as server-side code
- [ ] **File paths use internally generated names — never user-supplied filenames directly**

---

## V6 — Authentication

### V6.1 Documentation (L1)
- [ ] Rate limiting, anti-automation, and adaptive response documented and configured

### V6.2 Password Security (L1)
- [ ] Minimum password length: 8 characters (15+ recommended)
- [ ] Users can change their password
- [ ] Password change requires current password
- [ ] Passwords checked against top 3000+ common passwords
- [ ] No composition rules (no required uppercase/numbers/special chars)
- [ ] Password fields use `type=password`
- [ ] Paste and password managers permitted
- [ ] Password verified exactly as received (no truncation or case transformation)

### V6.2 Password Security (L2)
- [ ] Passwords up to 64 characters permitted
- [ ] No periodic password rotation required
- [ ] Passwords checked against breached password databases

### V6.3 General Auth (L1)
- [ ] **Credential stuffing and brute force protections implemented**
- [ ] Default accounts disabled or removed

### V6.3 General Auth (L2)
- [ ] MFA or combination of single-factor mechanisms required
- [ ] All authentication pathways enforce consistent security controls

### V6.4 Lifecycle (L1)
- [ ] Initial passwords/activation codes are random, follow policy, and expire quickly
- [ ] No knowledge-based "secret questions"

### V6.5 MFA Requirements (L2)
- [ ] Lookup secrets, OOB codes, and TOTPs are single-use
- [ ] MFA secrets generated with CSPRNG
- [ ] OOB codes have minimum 20 bits of entropy
- [ ] OOB requests expire within 10 minutes; TOTP within 30 seconds

---

## V7 — Session Management

### V7.2 Fundamentals (L1)
- [ ] Session token verification performed server-side
- [ ] Session tokens are dynamically generated (not static API keys)
- [ ] Reference tokens have ≥128 bits of entropy from CSPRNG
- [ ] **New session token generated on authentication (prevents session fixation)**

### V7.3 Timeout (L2)
- [ ] Inactivity timeout enforced
- [ ] Absolute maximum session lifetime enforced

### V7.4 Termination (L1)
- [ ] Session invalidated on logout (server-side)
- [ ] Sessions terminated when account is disabled/deleted

### V7.4 Termination (L2)
- [ ] Option to terminate all sessions after authentication factor change
- [ ] Logout functionality easily accessible
- [ ] Administrators can terminate sessions for individual users

### V7.5 Session Abuse Defense (L2)
- [ ] Re-authentication required before modifying sensitive account attributes
- [ ] Users can view and terminate active sessions

---

## V8 — Authorization

### V8.1 Documentation (L1)
- [ ] Authorization rules defined for function-level and data-specific access

### V8.1 Documentation (L2)
- [ ] Field-level access restrictions defined (both read and write)

### V8.2 Application-Level (L1)
- [ ] **Deny by default — access requires explicit grant**
- [ ] Authorization enforced at trusted service layer (not client-side)
- [ ] Authorization checks use user identity from session — never from untrusted input

### V8.2 Application-Level (L2)
- [ ] Authorization checked on every request (not just initial navigation)
- [ ] Directory browsing disabled unless intentional
- [ ] Multi-tenant: users cannot access other tenants' data

### V8.3 Data-Level (L1)
- [ ] Users can only access their own data (or data explicitly shared with them)
- [ ] Principle of least privilege applied to all data access

---

## V9 — Self-Contained Tokens

### V9.1 Token Fundamentals (L1)
- [ ] Token signature validated before trusting claims
- [ ] Signing algorithm enforced server-side (not read from token header)

### V9.2 Token Content (L2)
- [ ] Tokens contain minimum necessary claims
- [ ] Audience (`aud`) claim validated
- [ ] Issuer (`iss`) claim validated against expected value

---

## V10 — OAuth and OIDC

### V10.1 Generic (L1)
- [ ] Client secrets not exposed in browser or mobile apps
- [ ] Authorization code flow used (not implicit flow)

### V10.2 Authorization Code (L2)
- [ ] PKCE used for all OAuth clients
- [ ] State parameter validated to prevent CSRF

---

## V11 — Cryptography

### V11.1 General (L1)
- [ ] **Cryptographic operations use well-vetted libraries — no custom crypto**
- [ ] Random values generated with CSPRNG

### V11.2 Algorithms (L1)
- [ ] No deprecated algorithms (MD5, SHA-1, DES, RC4, etc.)
- [ ] Passwords hashed with adaptive algorithms (Argon2id, bcrypt, scrypt)

### V11.3 Key Management (L2)
- [ ] Keys stored securely (not hardcoded in source)
- [ ] Key rotation mechanism exists

---

## V12 — Secure Communication

### V12.1 TLS (L1)
- [ ] **TLS used for all connections (no plaintext HTTP for sensitive data)**
- [ ] TLS configuration uses strong cipher suites and protocols (TLS 1.2+ minimum)

### V12.1 TLS (L2)
- [ ] Certificate validation performed properly (no disabled verification)
- [ ] HSTS enforced with appropriate max-age

---

## V13 — Configuration

### V13.1 General (L1)
- [ ] Server components hardened (unnecessary features disabled)
- [ ] No default credentials in production

### V13.2 Dependency Management (L1)
- [ ] All components up to date with security patches
- [ ] Unused dependencies removed

### V13.2 Dependency Management (L2)
- [ ] Component inventory maintained (SBOM)
- [ ] Components sourced from trusted repositories with integrity verification

---

## V14 — Data Protection

### V14.1 General (L1)
- [ ] **Sensitive data not logged (passwords, tokens, PII)**
- [ ] Sensitive data not included in URL parameters
- [ ] Caching disabled for responses containing sensitive data

### V14.2 Client-Side (L1)
- [ ] Autocomplete disabled on sensitive form fields where appropriate
- [ ] Sensitive data not stored in browser storage (localStorage, sessionStorage) unless encrypted

---

## V15 — Secure Coding and Architecture

### V15.1 General (L1)
- [ ] Application does not output detailed error messages or stack traces to users
- [ ] Security controls centralized and reusable (not duplicated)

### V15.2 Concurrency (L2)
- [ ] Shared resources protected against race conditions
- [ ] Locking mechanisms used for critical sections

---

## V16 — Security Logging and Error Handling

### V16.1 Logging (L1)
- [ ] **Security-relevant events logged (auth success/failure, access control failures, input validation failures)**
- [ ] Log entries contain sufficient context (who, what, when, where)
- [ ] Logs protected against injection and tampering

### V16.1 Logging (L2)
- [ ] High-value transactions have audit trails with integrity controls
- [ ] Monitoring and alerting configured for suspicious activity

### V16.2 Error Handling (L1)
- [ ] Generic error messages returned to clients
- [ ] Error handling does not bypass security controls
- [ ] Errors logged with sufficient detail for investigation

---

## Verification Levels Summary

| Level | Target | Description |
|---|---|---|
| **L1** | All applications | Minimum security baseline — low-hanging fruit, easily testable |
| **L2** | Applications handling sensitive data | Recommended for most applications — defense in depth |
| **L3** | Critical applications | Highest assurance — military, healthcare, financial infrastructure |

This checklist covers L1 and L2. For L3 requirements (hardware MFA, per-response CSP nonces, HSTS preload, etc.), consult the full ASVS 5.0 standard.

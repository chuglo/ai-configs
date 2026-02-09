# OWASP Top 10:2025 — Security Risk Reference

Quick-reference for the OWASP Top 10 (2025 edition). Each entry includes the risk description, how it manifests, and generic prevention strategies.

> Source: https://owasp.org/Top10/2025/

## A01:2025 — Broken Access Control

**What it is:** Restrictions on what authenticated users are allowed to do are not properly enforced. Attackers exploit these flaws to access unauthorized functionality or data.

**How it manifests:**
- Missing access control checks on API endpoints or functions
- IDOR (Insecure Direct Object References) — accessing another user's data by changing an ID parameter
- Vertical privilege escalation — regular user accessing admin functions
- Horizontal privilege escalation — user A accessing user B's resources
- Metadata manipulation — tampering with JWTs, cookies, or hidden fields to elevate privileges
- CORS misconfiguration allowing unauthorized cross-origin access
- Force browsing to authenticated pages as unauthenticated user
- Missing function-level access control on POST, PUT, DELETE operations
- Multi-step process bypass — skipping authorization checks in later steps

**Prevention:**
- Deny by default — require explicit grants for every resource
- Implement access control once, reuse throughout the application
- Enforce record ownership — users can only CRUD their own records unless explicitly authorized
- Disable directory listing and ensure metadata/backup files are not served
- Log access control failures and alert on repeated violations
- Rate-limit API and controller access to minimize automated attack impact
- Invalidate stateful session tokens on logout; stateless tokens should be short-lived
- Use ABAC or RBAC consistently — never rely on obscurity

**ASVS mapping:** V8 (Authorization)

---

## A02:2025 — Security Misconfiguration

**What it is:** Missing or incorrect security hardening across the application stack — from cloud services to web servers, frameworks, libraries, and databases.

**How it manifests:**
- Default credentials left unchanged
- Unnecessary features enabled (ports, services, pages, accounts, privileges)
- Error handling reveals stack traces or overly informative error messages
- Security headers missing or misconfigured
- Software is out of date or vulnerable
- Cloud storage buckets with overly permissive ACLs
- XML external entity (XXE) processing enabled
- Directory listing enabled on web servers

**Prevention:**
- Repeatable hardening process — identical configuration across dev, QA, and production
- Minimal platform — remove unused features, frameworks, and dependencies
- Review and update configurations as part of patch management
- Segmented application architecture with separation between components
- Send security directives to clients (security headers)
- Automated verification of configuration effectiveness in all environments

**ASVS mapping:** V13 (Configuration)

---

## A03:2025 — Software Supply Chain Failures

**What it is:** Failures related to the integrity of software updates, critical data, and CI/CD pipelines. Includes vulnerable or malicious third-party components.

**How it manifests:**
- Using components with known vulnerabilities
- Dependency confusion attacks
- Compromised build pipelines injecting malicious code
- Auto-update mechanisms without integrity verification
- Unsigned or unverified packages
- Typosquatting in package registries

**Prevention:**
- Maintain an inventory of all components and their versions (SBOM)
- Remove unused dependencies, features, and documentation
- Continuously monitor for vulnerabilities (CVE databases, security advisories)
- Obtain components only from official sources over secure links
- Verify digital signatures and checksums
- Monitor for unmaintained libraries and components
- Ensure CI/CD pipelines have proper access control, segregation, and audit logging
- Use lock files and verify integrity hashes

**ASVS mapping:** V15 (Secure Coding and Architecture)

---

## A04:2025 — Cryptographic Failures

**What it is:** Failures related to cryptography (or lack thereof) that lead to exposure of sensitive data.

**How it manifests:**
- Transmitting data in cleartext (HTTP, SMTP, FTP)
- Using deprecated or weak cryptographic algorithms (MD5, SHA-1, DES, RC4)
- Using default or weak cryptographic keys
- Not enforcing encryption (missing HSTS, TLS)
- Improper certificate validation
- Using encryption without authentication (ECB mode, no HMAC)
- Insufficient key management (hardcoded keys, no rotation)
- Passwords stored with reversible encryption or weak hashing

**Prevention:**
- Classify data by sensitivity and apply controls accordingly
- Don't store sensitive data unnecessarily — discard it as soon as possible
- Encrypt all sensitive data at rest and in transit
- Use strong, current algorithms and protocols (AES-256-GCM, ChaCha20-Poly1305, Argon2id)
- Enforce HTTPS with HSTS
- Disable caching for responses containing sensitive data
- Use authenticated encryption (GCM, Poly1305) — never just encryption
- Generate keys using cryptographically secure random number generators
- Store passwords using adaptive salted hashing (Argon2id, bcrypt, scrypt)

**ASVS mapping:** V11 (Cryptography), V12 (Secure Communication)

---

## A05:2025 — Injection

**What it is:** User-supplied data is sent to an interpreter as part of a command or query without proper validation, filtering, or escaping.

**How it manifests:**
- SQL injection — manipulating database queries
- NoSQL injection — manipulating document database queries
- OS command injection — executing system commands
- LDAP injection — manipulating directory queries
- XSS (Cross-Site Scripting) — injecting client-side scripts
- Template injection — injecting into server-side templates (SSTI)
- Expression Language injection — injecting into EL evaluators
- Header injection — injecting into HTTP response headers
- Log injection — injecting into log entries to forge or corrupt logs

**Prevention:**
- Use parameterized queries / prepared statements for all data access
- Use positive server-side input validation (allowlists)
- Escape special characters for the specific interpreter context
- Use LIMIT and other SQL controls to prevent mass disclosure
- Use ORMs — but understand they don't prevent all injection
- Separate data from commands in every interpreter context
- Automated testing (SAST, DAST) in CI/CD pipelines

**ASVS mapping:** V1 (Encoding and Sanitization), V1.2 (Injection Prevention)

---

## A06:2025 — Insecure Design

**What it is:** A category representing weaknesses in design and architecture — missing or ineffective security controls that cannot be fixed by a perfect implementation.

**How it manifests:**
- Missing threat modeling during design phase
- No security requirements defined for the application
- Business logic flaws that allow abuse (e.g., unlimited resource consumption)
- Missing rate limiting on expensive operations
- Credential recovery that relies on knowledge-based questions
- No separation of privilege for critical operations
- Trust boundaries not defined or enforced

**Prevention:**
- Establish a secure development lifecycle with security professionals
- Use threat modeling for authentication, access control, business logic, and key flows
- Integrate security language and controls into user stories
- Write unit and integration tests to validate security-critical flows
- Segregate tenant processing and data at all tiers
- Limit resource consumption by user or service
- Use design patterns from established security frameworks

**ASVS mapping:** V2 (Validation and Business Logic), V15 (Secure Coding and Architecture)

---

## A07:2025 — Authentication Failures

**What it is:** Weaknesses in authentication mechanisms that allow attackers to compromise passwords, keys, or session tokens, or to exploit implementation flaws to assume other users' identities.

**How it manifests:**
- Credential stuffing — automated use of breached username/password lists
- Brute force attacks — no rate limiting or account lockout
- Default, weak, or well-known passwords permitted
- Weak credential recovery (knowledge-based answers)
- Plaintext or weakly hashed passwords
- Missing or ineffective multi-factor authentication
- Session identifiers exposed in URLs
- Session tokens not rotated after login
- Session tokens not invalidated on logout

**Prevention:**
- Implement multi-factor authentication
- Don't ship with default credentials
- Check passwords against known breached password lists
- Enforce password length (minimum 8, recommend 15+) — no composition rules
- Limit failed login attempts with progressive delays or lockout
- Use a server-side session manager that generates high-entropy random session IDs
- Rotate session IDs after login
- Invalidate sessions on logout, idle timeout, and absolute timeout

**ASVS mapping:** V6 (Authentication), V7 (Session Management)

---

## A08:2025 — Software or Data Integrity Failures

**What it is:** Code and infrastructure that does not protect against integrity violations — insecure deserialization, use of untrusted plugins/libraries/modules, and insecure CI/CD pipelines.

**How it manifests:**
- Deserializing untrusted data without validation
- Using libraries from untrusted sources without integrity checks
- Insecure CI/CD pipelines allowing unauthorized code changes
- Auto-update functionality without signature verification
- Objects or data structures that attackers can manipulate

**Prevention:**
- Use digital signatures to verify software and data integrity
- Ensure libraries and dependencies are consumed from trusted repositories
- Use a software supply chain security tool to verify components
- Ensure CI/CD pipelines have proper access control and segregation
- Do not send unsigned or unencrypted serialized data to untrusted clients
- Use integrity checks or digital signatures on serialized data
- Implement a review process for code and configuration changes

**ASVS mapping:** V1.5 (Safe Deserialization), V15 (Secure Coding and Architecture)

---

## A09:2025 — Security Logging and Alerting Failures

**What it is:** Insufficient logging, monitoring, and alerting that prevents or delays detection of breaches and active attacks.

**How it manifests:**
- Auditable events (logins, failed logins, high-value transactions) not logged
- Warnings and errors generate no, inadequate, or unclear log messages
- Logs only stored locally with no centralized monitoring
- Alerting thresholds and response escalation processes not in place
- Penetration testing and DAST scans don't trigger alerts
- Application cannot detect, escalate, or alert for active attacks in real time
- Log data exposed to injection or tampering

**Prevention:**
- Log all login, access control, and server-side input validation failures with sufficient context
- Use a consistent log format that can be consumed by log management solutions
- Encode log data correctly to prevent log injection
- Ensure high-value transactions have an audit trail with integrity controls
- Establish effective monitoring and alerting — detect and respond to suspicious activity
- Establish or adopt an incident response and recovery plan
- Use tamper-evident logging mechanisms (append-only, signed logs)

**ASVS mapping:** V16 (Security Logging and Error Handling)

---

## A10:2025 — Mishandling of Exceptional Conditions

**What it is:** Failure to properly handle errors, exceptions, and unexpected conditions, leading to information disclosure, denial of service, or security bypasses.

**How it manifests:**
- Stack traces or internal error details exposed to users
- Error conditions that bypass security controls
- Missing error handling that causes crashes or undefined behavior
- Overly broad exception catching that swallows security-relevant errors
- Resource exhaustion from unhandled edge cases
- Inconsistent error responses that enable enumeration

**Prevention:**
- Design error handling as part of the security architecture
- Return generic error messages to clients — log detailed errors server-side
- Ensure error handling does not bypass security controls
- Handle all expected and unexpected error conditions
- Use consistent error response formats
- Test error handling paths — don't just test the happy path
- Set appropriate timeouts and resource limits
- Fail securely — deny access when errors occur in security-critical paths

**ASVS mapping:** V16 (Security Logging and Error Handling), V10 (Mishandling of Exceptional Conditions — implied)

---

## Cross-Reference: OWASP Top 10 ↔ PortSwigger Topics

| OWASP Top 10 | PortSwigger Web Academy Topics |
|---|---|
| A01 Broken Access Control | Access control, IDOR, CORS, Clickjacking |
| A02 Security Misconfiguration | Information disclosure, HTTP Host header attacks |
| A03 Supply Chain Failures | (No direct topic — dependency management) |
| A04 Cryptographic Failures | (Covered in JWT attacks, OAuth) |
| A05 Injection | SQL injection, XSS, NoSQL injection, SSTI, Command injection, XXE |
| A06 Insecure Design | Business logic vulnerabilities, Race conditions |
| A07 Authentication Failures | Authentication, OAuth, JWT attacks |
| A08 Integrity Failures | Insecure deserialization, Prototype pollution |
| A09 Logging Failures | (No direct topic) |
| A10 Exceptional Conditions | (No direct topic — covered in information disclosure) |

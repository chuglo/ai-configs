# Web Frontend Security — Browser Mechanisms and Client-Side Attacks

Reference for browser security mechanisms, their correct configuration, common bypasses, and client-side attack patterns. Framework-agnostic — applies to any web application.

---

## 1. Same-Origin Policy (SOP)

**What it is:** The fundamental browser security mechanism. Scripts from one origin can only access resources from the same origin. An origin is defined by the tuple: `(scheme, host, port)`.

**What SOP prevents:**
- JavaScript on `evil.com` reading responses from `bank.com`
- Cross-origin DOM access (reading/modifying another origin's DOM)
- Cross-origin cookie access

**What SOP does NOT prevent:**
- Cross-origin requests being *sent* (forms, images, scripts can trigger requests)
- Embedding cross-origin resources (`<img>`, `<script>`, `<iframe>`, `<link>`)
- CSRF attacks (cookies are attached to cross-origin requests)

**Key implication:** SOP prevents *reading* cross-origin responses, not *sending* cross-origin requests. This is why CSRF is possible and why CORS exists.

---

## 2. Content Security Policy (CSP)

**What it is:** HTTP response header that tells the browser which sources of content are trusted. Primary defense-in-depth against XSS.

### Essential Directives

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self';
  style-src 'self';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'none';
  form-action 'self';
  object-src 'none';
```

### Directive Reference

| Directive | Controls | Recommended |
|---|---|---|
| `default-src` | Fallback for all fetch directives | `'none'` (explicit allowlist) |
| `script-src` | JavaScript sources | `'self'` + nonces or hashes |
| `style-src` | CSS sources | `'self'` (avoid `'unsafe-inline'`) |
| `img-src` | Image sources | `'self' data:` |
| `connect-src` | Fetch, XHR, WebSocket targets | `'self'` + API domains |
| `font-src` | Web font sources | `'self'` |
| `frame-src` | iframe sources | `'none'` (unless needed) |
| `frame-ancestors` | Who can embed this page | `'none'` (prevents clickjacking) |
| `base-uri` | Allowed `<base>` element URLs | `'none'` (prevents base tag injection) |
| `form-action` | Form submission targets | `'self'` |
| `object-src` | Plugin content (Flash, etc.) | `'none'` (always) |

### Nonce-Based CSP (Recommended for L3)

```
Content-Security-Policy: script-src 'nonce-{random}'; object-src 'none'; base-uri 'none'
```

- Generate a unique cryptographic nonce per response
- Add `nonce="{random}"` attribute to every legitimate `<script>` tag
- Attacker-injected scripts won't have the correct nonce

### Hash-Based CSP

```
Content-Security-Policy: script-src 'sha256-{hash}'; object-src 'none'
```

- Compute SHA-256 hash of each inline script's content
- Only scripts matching the hash execute
- Any modification to the script (including XSS injection) changes the hash

### Common CSP Bypasses (What to Watch For)

| Bypass | How | Prevention |
|---|---|---|
| `'unsafe-inline'` | Allows all inline scripts — defeats CSP's XSS protection | Use nonces or hashes instead |
| `'unsafe-eval'` | Allows `eval()`, `Function()`, `setTimeout(string)` | Refactor code to avoid eval |
| Overly broad allowlist | `script-src *.googleapis.com` includes JSONP endpoints | Use specific URLs, not wildcards |
| `base-uri` missing | Attacker injects `<base href="https://evil.com">` to hijack relative URLs | Always set `base-uri 'none'` |
| JSONP endpoints | Allowlisted domain has JSONP that reflects attacker input | Audit all allowlisted domains |
| Policy injection | Attacker controls part of CSP header value | Never include user input in CSP |
| `data:` in script-src | `<script src="data:text/javascript,alert(1)">` | Never allow `data:` in script-src |

### CSP Reporting

```
Content-Security-Policy-Report-Only: ...; report-uri /csp-report
Content-Security-Policy: ...; report-uri /csp-report
```

- `Report-Only` mode: logs violations without blocking — use for testing
- `report-uri` (deprecated) or `report-to` directive sends violation reports
- Monitor reports to detect XSS attempts and policy issues

---

## 3. Cross-Origin Resource Sharing (CORS)

**What it is:** Mechanism that relaxes SOP by allowing servers to specify which origins can read their responses.

### How CORS Works

1. Browser sends request with `Origin` header
2. Server responds with `Access-Control-Allow-Origin` header
3. Browser checks if the response origin matches — if not, blocks JavaScript from reading the response

### Simple vs. Preflight Requests

**Simple requests** (no preflight):
- Methods: GET, HEAD, POST
- Headers: only CORS-safelisted headers (Accept, Content-Type with limited values, etc.)
- Content-Type: `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`

**Preflighted requests** (OPTIONS sent first):
- Non-simple methods (PUT, DELETE, PATCH)
- Custom headers (Authorization, X-CSRF-Token, etc.)
- Content-Type: `application/json`

### CORS Headers

| Header | Purpose | Safe Value |
|---|---|---|
| `Access-Control-Allow-Origin` | Which origin can read response | Specific origin (never `*` with credentials) |
| `Access-Control-Allow-Credentials` | Allow cookies/auth | `true` only with specific origin |
| `Access-Control-Allow-Methods` | Allowed methods for preflight | Only needed methods |
| `Access-Control-Allow-Headers` | Allowed request headers | Only needed headers |
| `Access-Control-Max-Age` | Preflight cache duration | Reasonable value (e.g., 3600) |
| `Access-Control-Expose-Headers` | Response headers readable by JS | Only needed headers |

### CORS Misconfigurations (Security Risks)

| Misconfiguration | Risk | Fix |
|---|---|---|
| `Access-Control-Allow-Origin: *` with credentials | Any site can read authenticated responses | Use specific origin |
| Reflecting `Origin` header without validation | Attacker's origin is trusted | Validate against allowlist |
| Null origin allowed | Sandboxed iframes and `data:` URLs have null origin | Never allow `null` |
| Subdomain wildcard | `*.example.com` trusts any subdomain (XSS on subdomain = full access) | Use exact origins |
| Pre-domain wildcard | Trusting `trusted-origin.evil.com` | Exact match, not suffix match |

### CORS Security Rules

1. **Never reflect the Origin header** without validating against a strict allowlist
2. **Never use `Access-Control-Allow-Origin: *`** with `Access-Control-Allow-Credentials: true`
3. **Never allow `null` origin** — it can be forged from sandboxed contexts
4. **Validate Origin server-side** — don't rely on CORS alone for access control
5. **CORS is not a substitute for authentication/authorization** — it only controls browser behavior

---

## 4. Cookie Security

### Cookie Attributes

| Attribute | Purpose | Recommended |
|---|---|---|
| `Secure` | Only sent over HTTPS | Always set for session cookies |
| `HttpOnly` | Not accessible via JavaScript | Always set for session cookies |
| `SameSite` | Controls cross-site sending | `Lax` (default) or `Strict` |
| `Domain` | Which domains receive the cookie | Omit (most restrictive) or set explicitly |
| `Path` | URL path scope | `/` for session cookies |
| `Max-Age` / `Expires` | Cookie lifetime | Set appropriate expiry |

### Cookie Prefixes

| Prefix | Requirements | Purpose |
|---|---|---|
| `__Host-` | Must have `Secure`, no `Domain`, `Path=/` | Strongest — locked to exact origin |
| `__Secure-` | Must have `Secure` | Ensures HTTPS-only |

**Recommendation:** Use `__Host-` prefix for session cookies. It prevents subdomain attacks and ensures the cookie is locked to the exact host.

### SameSite Attribute Deep Dive

| Value | Behavior | Use Case |
|---|---|---|
| `Strict` | Never sent cross-site | Maximum protection, but breaks legitimate cross-site navigation |
| `Lax` | Sent on top-level navigations (GET) but not on cross-site POST/iframe/AJAX | Good default — protects against CSRF POST while allowing links |
| `None` | Always sent cross-site (requires `Secure`) | Only for intentional cross-site use (embedded widgets, OAuth) |

**`Lax` limitations:** Still sends cookie on top-level GET navigations. If the application has state-changing GET endpoints, `Lax` doesn't protect them. Ensure state changes use POST/PUT/DELETE.

### Cookie Security Checklist

- [ ] Session cookies: `Secure`, `HttpOnly`, `SameSite=Lax` (minimum)
- [ ] Use `__Host-` prefix for session cookies
- [ ] Session values only transmitted via `Set-Cookie` header (never in response body, URL, or JavaScript)
- [ ] Cookie name + value combined ≤ 4096 bytes
- [ ] Don't store sensitive data in cookies (store server-side, reference by session ID)
- [ ] Rotate session cookie on authentication state change (login, privilege change)

---

## 5. HTTP Security Headers

### Essential Headers

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: [see CSP section]
```

### Header Reference

| Header | Purpose | Recommended Value |
|---|---|---|
| `Strict-Transport-Security` | Force HTTPS | `max-age=63072000; includeSubDomains` |
| `X-Content-Type-Options` | Prevent MIME sniffing | `nosniff` |
| `Referrer-Policy` | Control Referer leakage | `strict-origin-when-cross-origin` or `no-referrer` |
| `Permissions-Policy` | Disable browser features | Disable unused: `camera=(), microphone=()` |
| `X-Frame-Options` | Prevent framing (legacy) | `DENY` (use CSP `frame-ancestors` instead) |
| `Cross-Origin-Opener-Policy` | Isolate browsing context | `same-origin` |
| `Cross-Origin-Resource-Policy` | Control cross-origin resource loading | `same-origin` or `same-site` |
| `Cross-Origin-Embedder-Policy` | Require CORS/CORP for subresources | `require-corp` (for cross-origin isolation) |

### Headers to Remove

| Header | Why Remove |
|---|---|
| `Server` | Reveals server software and version |
| `X-Powered-By` | Reveals framework (e.g., Express, PHP) |
| `X-AspNet-Version` | Reveals ASP.NET version |

---

## 6. Cross-Site Request Forgery (CSRF) Defense

### Defense Layers

**Layer 1: SameSite Cookies**
- Set `SameSite=Lax` or `Strict` on session cookies
- Prevents cookies from being sent on most cross-site requests

**Layer 2: Anti-CSRF Tokens**
- Generate a unique, unpredictable token per session (or per request)
- Include token in a hidden form field or custom header
- Validate token server-side on every state-changing request
- Token must not be in a cookie (defeats the purpose)

**Layer 3: Origin/Referer Validation**
- Check `Origin` header (preferred) or `Referer` header
- Reject requests with unexpected or missing origin
- Be aware: some privacy tools strip Referer

**Layer 4: Custom Request Headers**
- Require a custom header (e.g., `X-Requested-With`) on API requests
- Simple cross-origin requests can't set custom headers without preflight
- Combined with CORS preflight, this prevents cross-origin POST attacks

### CSRF Token Implementation Rules

1. Token must be cryptographically random (≥128 bits of entropy)
2. Token must be tied to the user's session
3. Token must be validated on every state-changing request
4. Token must not be transmitted in a cookie
5. Token must not be logged or cached
6. Token must be regenerated on login (prevent session fixation + CSRF combo)

---

## 7. Subresource Integrity (SRI)

**What it is:** Allows browsers to verify that fetched resources (scripts, stylesheets) haven't been tampered with.

```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8w"
        crossorigin="anonymous"></script>
```

**When to use:** Any resource loaded from an external CDN or third-party domain.

**Rules:**
- Use `sha384` or `sha512` (not `sha256` alone)
- Include `crossorigin="anonymous"` attribute
- Only works for static, versioned resources (not dynamically generated)
- Update hashes when updating the resource version

---

## 8. Clickjacking Defense

**What it is:** Attacker overlays a transparent iframe of the target site over a decoy page, tricking users into clicking on the target site's buttons.

**Defense:**

```
Content-Security-Policy: frame-ancestors 'none'
```

Or for specific allowed embedders:
```
Content-Security-Policy: frame-ancestors 'self' https://trusted-partner.com
```

**Legacy fallback:**
```
X-Frame-Options: DENY
```

**Note:** `X-Frame-Options` is obsolete. Use CSP `frame-ancestors` — it's more flexible and takes precedence in modern browsers.

---

## 9. DOM Security

### Dangerous Sinks (Never Use with Untrusted Data)

| Sink | Risk | Safe Alternative |
|---|---|---|
| `innerHTML` | XSS — parses HTML | `textContent` |
| `outerHTML` | XSS — parses HTML | `textContent` + `replaceWith` |
| `document.write()` | XSS — writes to document | `createElement` + `appendChild` |
| `eval()` | Code execution | `JSON.parse()` for JSON |
| `setTimeout(string)` | Code execution | `setTimeout(function)` |
| `setInterval(string)` | Code execution | `setInterval(function)` |
| `Function(string)` | Code execution | Avoid entirely |
| `location.href = userInput` | Open redirect | Validate against allowlist |
| `element.setAttribute('href', userInput)` | XSS via `javascript:` | Validate URL scheme |

### Safe DOM Patterns

```javascript
// SAFE: Setting text content
element.textContent = userInput;

// SAFE: Creating elements programmatically
const el = document.createElement('a');
el.textContent = userInput;
el.href = sanitizeUrl(userInput); // validate scheme
parent.appendChild(el);

// SAFE: Setting attributes (non-event, non-URL)
element.setAttribute('data-id', userInput);

// DANGEROUS: Never do this
element.innerHTML = userInput;           // XSS
document.write(userInput);              // XSS
eval(userInput);                        // RCE
location.href = userInput;              // Open redirect
element.setAttribute('onclick', userInput); // XSS
```

### DOM Clobbering

**What it is:** HTML elements with `id` or `name` attributes create global variables on `window` and `document`, potentially overriding application variables.

```html
<!-- Attacker injects: -->
<img id="config">
<!-- Now window.config and document.config reference the img element -->
```

**Prevention:**
- Use explicit variable declarations (`const`, `let`)
- Don't rely on global variables
- Use strict type checking before using DOM-sourced values
- Namespace isolation (modules, closures)

---

## 10. postMessage Security

**What it is:** API for cross-origin communication between windows/iframes.

### Sending Messages Safely

```javascript
// SAFE: Specify exact target origin
targetWindow.postMessage(data, 'https://trusted-origin.com');

// DANGEROUS: Wildcard allows any origin to receive
targetWindow.postMessage(data, '*');
```

### Receiving Messages Safely

```javascript
window.addEventListener('message', (event) => {
  // REQUIRED: Validate origin
  if (event.origin !== 'https://trusted-origin.com') {
    return; // reject untrusted origins
  }

  // REQUIRED: Validate message structure
  if (typeof event.data !== 'object' || !event.data.type) {
    return; // reject malformed messages
  }

  // SAFE: Process validated message
  handleMessage(event.data);
});
```

### postMessage Security Rules

1. **Always specify target origin** when sending (never use `*`)
2. **Always validate `event.origin`** when receiving
3. **Validate message structure and content** — don't trust the data blindly
4. **Never use `eval()` or `innerHTML`** with received message data
5. **Don't expose sensitive operations** via postMessage without authentication

---

## 11. Open Redirect Prevention

**What it is:** Application redirects users to a URL specified in a parameter, which an attacker can manipulate to redirect to a malicious site.

**Attack patterns:**
- `https://trusted.com/redirect?url=https://evil.com`
- Protocol-relative: `//evil.com`
- Encoded: `https://trusted.com/redirect?url=%68%74%74%70%73%3a%2f%2f%65%76%69%6c%2e%63%6f%6d`
- Backslash trick: `https://trusted.com\@evil.com`

**Prevention:**
- Allowlist of permitted redirect destinations
- Validate that redirect URL is relative (starts with `/`, not `//`)
- If absolute URLs needed, validate against allowlist of trusted domains
- Show interstitial page for external redirects: "You are leaving [app]. Continue to [url]?"

---

## Quick Reference: Header Checklist

```
# Copy-paste starting point — adjust per application

Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

Remove these if present:
```
Server: [remove or genericize]
X-Powered-By: [remove]
```

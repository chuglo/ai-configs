---
description: Generate and run E2E tests with Playwright for critical application flows.
---

# E2E Command

Invokes the **e2e-runner** agent.

## Critical Flows

1. User registration / sign-up
2. Login / authentication (password, SSO, passwordless)
3. CRUD operations on primary entities
4. List filtering, sorting, and pagination
5. File upload and attachment handling
6. Role-based access control (admin vs. member views)

## Commands

```bash
cd web && npx playwright test                    # Run all
cd web && npx playwright test --headed           # See browser
cd web && npx playwright test --debug            # Debug
cd web && npx playwright codegen http://localhost:3000  # Generate
cd web && npx playwright show-report             # View report
```

## Test Organization

```
web/tests/e2e/
  public/           -- Public pages, registration
  auth/             -- Login, logout, session management
  dashboard/        -- Main app flows, CRUD, filtering
```

Use Page Object Model pattern. Prefer `data-testid` selectors.

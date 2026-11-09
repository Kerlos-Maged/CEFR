# Security Implementation

> Document: `security-implementation.md`
> Status: Phase 7 — implemented
> Related: [`security-audit.md`](security-audit.md), [`content-integrity.md`](content-integrity.md),
> [`architecture/security-and-permissions.md`](architecture/security-and-permissions.md)

This document records the security controls **actually implemented** in the codebase, the
remediations applied during Phase 7, how to verify them, and the checks that can only be performed
against a hosted Supabase project.

---

## 1. Control inventory (implemented)

### 1.1 Authentication and session

| Control                                                           | Where                                                                               |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Email magic-link (no passwords)                                   | `app/[lang]/login/page.tsx`, `components/admin/login-form.tsx`                      |
| PKCE code exchange with generic error redirects                   | `app/auth/callback/route.ts:30-37`                                                  |
| Open-redirect defense (`next` must be same-origin root-relative)  | `app/auth/callback/route.ts:44-51` (+ `tests/unit/auth/sanitize-next-path.test.ts`) |
| Server-verified identity (`auth.getUser()`, not the cookie claim) | `lib/auth/session.ts:40`                                                            |
| Cookie session refresh on every request                           | `proxy.ts:26-46`                                                                    |
| Session revocation on sign-out                                    | `lib/actions/auth.ts`                                                               |

### 1.2 Authorization (defense in depth)

| Layer       | Control                                                   | Where                                                       |
| ----------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| Application | Role/scope guards, fail fast                              | `lib/auth/authorization.ts`                                 |
| Application | Every action re-checks session + validates input          | `lib/actions/*.ts`                                          |
| Database    | RLS on every table                                        | `supabase/migrations/20261019000006_rls_policies.sql:12-29` |
| Database    | Membership helpers (SECURITY DEFINER, pinned search_path) | `20261019000005_functions_and_triggers.sql:94-219`          |
| Database    | Sole status writer + immutability trigger                 | `20261019000005_functions_and_triggers.sql:224-372`         |
| Database    | Publishing gated to `church_approver` (no admin override) | `20261019000005_functions_and_triggers.sql:263-267`         |

### 1.3 Input validation and output safety

| Control                                                                  | Where                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Strict zod schemas; protected fields absent (mass-assignment protection) | `lib/validation/object.ts`                                   |
| Server-generated, format-checked public ids                              | `lib/validation/generate-public-id.ts` + DB check constraint |
| http(s)-only URL validation; storage-path traversal rejection            | `lib/validation/object.ts`                                   |
| Safe action error envelope (no SQL/stack leakage)                        | `lib/actions/result.ts:41-78`                                |
| QR route returns generic 500 and logs server-side                        | `app/api/qr/[publicId]/route.ts`                             |

### 1.4 Transport and response headers (added this phase)

Configured in `next.config.ts` and applied globally to `/:path*`:

| Header                                                                                              | Value                                                          | Protects against                                |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `X-Content-Type-Options`                                                                            | `nosniff`                                                      | MIME-sniffing / drive-by content-type confusion |
| `X-Frame-Options`                                                                                   | `DENY`                                                         | Clickjacking                                    |
| `Referrer-Policy`                                                                                   | `strict-origin-when-cross-origin`                              | Cross-origin referrer leakage                   |
| `Permissions-Policy`                                                                                | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Feature/API abuse                               |
| **Content-Security-Policy is not set.** Nonce-based CSP disables Partial Prerendering. A production |
| Webpack build with Next's experimental SRI enabled still emitted inline React streaming scripts and |
| external scripts without integrity hashes; `script-src 'self'` would block those scripts, while     |
| `unsafe-inline` would remove the intended script-injection protection. See ADR-032.                 |

---

## 2. Remediations applied in Phase 7

| #   | Change                                                          | File                                              | Rationale                                                                                                                                      |
| --- | --------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Added baseline security response headers                        | `next.config.ts`                                  | No security headers were previously emitted (verified live: `nosniff`, `DENY`, referrer, permissions).                                         |
| R2  | Stopped the QR route from returning an internal error message   | `app/api/qr/[publicId]/route.ts`                  | Removed the `DalError`-message branch; failures now log server-side and return a generic message.                                              |
| R3  | Made media update/delete fail loudly on RLS no-op               | `lib/actions/media.ts`                            | RLS filters unauthorized rows silently (0 affected); actions now return `FORBIDDEN`/`NOT_FOUND` instead of a false success.                    |
| R4  | Same guard for claim delete                                     | `lib/actions/sources.ts`                          | Consistency with R3.                                                                                                                           |
| R5  | Same guard for object-translation delete and hard object delete | `lib/actions/objects.ts`                          | Consistency with R3; a non-admin delete can no longer appear to succeed.                                                                       |
| R6  | New hardening test suite                                        | `tests/integration/db/security-hardening.test.ts` | Covers privilege escalation, audit immutability, alias integrity, media publish gate, church-scope isolation, hard-delete boundary (10 tests). |

### 2.1 The RLS "silent no-op" class (R3–R5)

A key verified DB semantic: **an `UPDATE`/`DELETE` that targets a row the caller may not write
affects zero rows and raises no error** (RLS `USING` filters the row set). Correct application
behavior is to request the affected row back and treat "no row" as a permission/not-found failure.
This is now applied uniformly to the mutation actions that operate on potentially foreign rows.

---

## 3. Verification

### 3.1 Run locally (no external services)

```
npm run lint
npm run typecheck
npm run format:check
npm test          # includes tests/integration/db/security*.test.ts (PGlite) and tests/unit/**
npm run build
```

`npm test` exercises the real migrations against in-process PostgreSQL (PGlite), so RLS policies,
the workflow functions, and the immutability trigger are validated against actual SQL — not mocks.

### 3.2 Verified in this phase

| Check                                          | Result                                                         |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `npm run lint`                                 | Passed                                                         |
| `npm run typecheck`                            | Passed                                                         |
| `npm test`                                     | 136 passed / 14 files                                          |
| `npm run build`                                | Succeeded (proxy active; `/api/qr` + `/auth/callback` dynamic) |
| Security headers (live `next start` + request) | All four headers present                                       |

### 3.3 Production-only checklist (require a hosted Supabase project)

1. Magic-link sign-in end to end, including expired/used links.
2. Cookie attributes under HTTPS (`Secure`, `HttpOnly`, `SameSite`), and refresh-token rotation.
3. Auth redirect-URL allow-list and email templates.
4. Storage buckets `object-media` / `incoming`, their policies, upload, promotion, and deletion.
5. Supabase provider rate limits for magic-link requests.
6. `npm audit` on the deployed dependency set.

---

## 4. Residual risks and accepted gaps

| Risk                                                                          | Status        | Tracking               |
| ----------------------------------------------------------------------------- | ------------- | ---------------------- |
| Upload implemented; Supabase Storage RLS/promotion unverified                 | Accepted gap  | `security-audit.md` F1 |
| Dev-only high-severity advisories in the eslint chain                         | Accepted      | `security-audit.md` F2 |
| Process-local analytics limiter only; no distributed limits on auth/QR/upload | Partial       | `security-audit.md` F3 |
| No configurable publish-time required-field gate                              | Accepted      | `security-audit.md` F4 |
| No CSP compatible with current PPR/streaming output                           | Follow-up     | ADR-032                |
| Supabase-native surfaces unverified locally                                   | Informational | §3.3                   |

No finding of High or Critical severity affecting the implemented Phase 6 surface was identified.

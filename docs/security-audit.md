# Security Audit

> Document: `security-audit.md`
> Status: Phase 7 — audit complete; see [`security-implementation.md`](security-implementation.md) for remediation
> Related: [`architecture/security-and-permissions.md`](architecture/security-and-permissions.md),
> [`permissions-and-roles.md`](permissions-and-roles.md), [`content-integrity.md`](content-integrity.md)

This audit reviews the platform as implemented through Phase 6. It states the trust boundaries and
threat model, then lists findings by severity, each with a concrete reference to the code or SQL, an
impact assessment, and a disposition (fixed / accepted / deferred).

---

## 1. Scope and method

**In scope:** authentication and session handling; application authorization; Postgres RLS, helper
functions, and workflow functions; server actions; the QR route handler; input validation;
secret handling; and the append-only audit trail.

**Out of scope (this phase):** deployment/infrastructure hardening (CDN, WAF, headers at the edge),
Supabase project configuration (redirect URL allow-lists, email templates, rate limits), and
third-party dependency patching policy beyond noting advisories.

**Method:** manual review of the application (`lib/`, `app/`, `proxy.ts`) and the database
(`supabase/migrations/*`), cross-checked against the Phase 1 design contract, plus the automated
suites in `tests/unit/**` and `tests/integration/db/**`. Local execution uses an in-process PGlite
harness; Supabase-native surfaces (real Auth, real Storage) are marked **unverified**.

---

## 2. Assets

| Asset                                                                 | Why it matters                                        |
| --------------------------------------------------------------------- | ----------------------------------------------------- |
| Unpublished heritage content (drafts, in-review translations, claims) | Confidentiality; premature or unauthorized disclosure |
| Publication state (`objects.status`, `published_at`)                  | Integrity; public trust in what is "approved"         |
| Staff identity, roles, and church scope                               | Access control root of trust                          |
| The service-role key                                                  | Full database bypass if leaked                        |
| The audit trail (`review_records`, `publication_history`)             | Non-repudiation                                       |
| QR codes / permanent URLs                                             | Must resolve only to published content                |

---

## 3. Trust boundaries

```
Internet ─▶ Next.js edge (proxy.ts): auth-cookie refresh + locale routing
              │
              ▼
        App Router (server): getSession() → server-verified getUser()
              │                        │
              │ server actions         │ route handlers (/api/qr, /auth/callback)
              ▼                        ▼
        Supabase JS client (anon key + user JWT)  ──┐
                                                     │ RLS + SECURITY DEFINER functions
                                                     ▼
                                            Postgres (source of truth)
```

- The **browser** is untrusted: it holds only the anon key and a session cookie.
- The **service-role key** is server-only and never reaches the browser bundle.
- **RLS and the workflow functions** are the security boundary; application checks are UX.

---

## 4. Threat model (STRIDE)

| #   | Category               | Threat                                             | Primary control                                                                                                   | Residual |
| --- | ---------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| T1  | Spoofing               | Forged/expired session cookie grants admin         | `auth.getUser()` validates the JWT with the Auth server on every request; cookies are HTTP-only                   | Low      |
| T2  | Spoofing               | Attacker supplies a role/church in a request       | Role/scope always derived server-side from `church_memberships`; schema rejects unknown fields                    | Low      |
| T3  | Tampering              | Editor sets `status='published'` directly          | `enforce_object_immutables` trigger + no update policy covers status; sole writer is `transition_object_status()` | Low      |
| T4  | Tampering              | Mass-assignment of protected columns via an action | Strict zod schemas omit `status`, `church_id`, `public_id`, `created_by`, timestamps                              | Low      |
| T5  | Repudiation            | "I never approved that"                            | Append-only `review_records` + `publication_history`; no write policies                                           | Low      |
| T6  | Information disclosure | Draft/in-review content leaks to `anon`            | RLS `*_public_read` gated by `is_object_published()`; DAL uses the caller's client                                | Low      |
| T7  | Information disclosure | Cross-church content leak                          | RLS church scope via `is_church_member` / `has_church_role`                                                       | Low      |
| T8  | Information disclosure | Service key in the client bundle                   | Server-only import; only `NEXT_PUBLIC_*` exposed                                                                  | Low      |
| T9  | Denial of service      | Auth/analytics/QR/upload flooding                  | Process-local analytics quota; provider/CDN limits; distributed limits remain absent                              | Medium   |
| T10 | Elevation of privilege | Editor self-grants admin/church role               | `church_memberships` / `profiles` writable only by platform admins (RLS)                                          | Low      |
| T11 | Elevation of privilege | Non-approver publishes                             | Publishing requires `church_approver`; no admin override (ADR-018)                                                | Low      |
| T12 | Elevation of privilege | Open redirect after login                          | `sanitizeNextPath` accepts only same-origin root-relative paths                                                   | Low      |
| T13 | Tampering              | Unique `public_id` collision / enumeration         | 10-char Crockford id, 32^10 space; format check constraint; non-sequential                                        | Low      |
| T14 | Information disclosure | QR endpoint confirms drafts                        | Returns 404 for any non-published object                                                                          | Low      |
| T15 | Tampering              | Audit rows edited/deleted                          | Append-only tables; insert/update/delete policy absent                                                            | Low      |
| T16 | Tampering              | Storage path traversal on upload                   | Server-generated UUID paths; strict shape validation and magic-byte verification                                  | Low      |

---

## 5. Findings

Severity reflects exploitability × impact given the current Phase 6 feature set.

### F1 — Storage upload lifecycle needs hosted verification (Medium, open)

- **Evidence:** `POST /api/media/upload` validates size, extension, and magic bytes; stages uploads in
  `incoming`; re-reads and verifies staged bytes; hashes the file; and only publication promotes it
  into `object-media`. `setMediaPublication` removes the public copy when unpublishing.
- **Impact:** Storage policies, promotion, and delete behavior have not been exercised against a
  live Supabase Storage service. Route-level limits and actions reduce exposure but do not replace
  hosted verification or rate limiting.
- **Disposition:** Implementation added; hosted verification and malformed/edge-case metadata
  fixtures remain open. See `media-management.md` and `content-integrity.md`.

### F2 — Dev-only high-severity dependency advisories (Medium, accepted)

- **Evidence:** `npm audit` reports 5 high-severity issues, all transitive dev dependencies
  (`braces` ReDoS via `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`).
  `npm audit --omit=dev` reports **0** production vulnerabilities; the only suggested fix is a
  breaking downgrade to `eslint-config-next@14`.
- **Impact:** Tooling-only, not shipped to production. No runtime exposure.
- **Disposition:** Accepted. Re-evaluate when `eslint-config-next` releases a patched line.

### F3 — Rate limiting is partial and process-local (Medium, open)

- **Evidence:** `lib/analytics/rate-limit.ts` applies an in-process quota to analytics events using
  HMAC-derived keys. It does not coordinate across serverless instances and does not cover magic-link,
  QR, or media upload requests.
- **Impact:** Analytics floods are bounded per warm process; other endpoints and multi-instance
  traffic rely on provider/edge protections.
- **Disposition:** Partially implemented. A distributed limiter needs a shared provider or
  database-backed atomic counter; deployment selection remains open.

### F4 — Publishing has no configurable required-field gate (Low, accepted)

- **Evidence:** `submitForReview` checks only a default-language title; publishing itself enforces no
  additional completeness rule (`editorial-workflow.md` §8).
- **Impact:** A spare but complete-enough object can be published. Not a confidentiality or
  privilege issue.
- **Disposition:** Accepted; product decision. Could become a check in `transition_object_status`.

### F5 — Supabase-native auth/storage behaviour unverified locally (Low, informational)

- **Evidence:** No Docker/WSL/Supabase CLI, so real magic-link sign-in, cookie-refresh rotation,
  storage buckets/policies, and signed uploads could not be exercised; verification is at the
  RLS/RPC layer via PGlite.
- **Impact:** Unknown unknowns in provider-configured surfaces (OAuth redirect allow-lists, cookie
  attributes under HTTPS).
- **Disposition:** Documented; production-only checklist in `security-implementation.md` §Verification.

### F6 — QR renderer error response (Low, fixed)

- **Evidence:** `app/api/qr/[publicId]/route.ts` now logs a server-side marker and returns a generic
  500 response for rendering failures.
- **Impact:** Internal exception details are no longer returned to QR clients.
- **Disposition:** Fixed.

### F7 — No Content-Security-Policy compatible with current PPR output (Low, tracked)

- **Evidence:** `script-src 'self'` would block inline React streaming scripts found in a production
  build. Enabling experimental SRI adds integrity attributes to only some external scripts and does
  not hash the inline streaming payloads.
- **Impact:** No browser-level CSP defense is present; the four baseline headers and safe text/media
  rendering remain active. Public content is not rendered as raw HTML.
- **Disposition:** Tracked in ADR-032. Revisit when Next supports SRI for PPR streaming or if the
  product accepts disabling PPR for nonce-based CSP.

No findings of High or Critical severity affecting confidentiality, integrity, or availability were
identified in the implemented Phase 6 surface.

---

## 6. Positive controls verified

- **Deny by default:** RLS enabled on every table (`20261019000006_rls_policies.sql:12-29`).
- **Sole status writer:** `enforce_object_immutables` rejects direct `status` writes
  (`20261019000005_functions_and_triggers.sql:350-372`); the transition function sets a
  transaction-local flag.
- **No self-approval / no admin publish bypass:** `transition_object_status` requires
  `church_approver` for `church_review → published` (`:263-267`).
- **Append-only audit:** `review_records` / `publication_history` have no insert/update/delete
  policies; writes occur only inside `SECURITY DEFINER` functions.
- **Verified identity:** `getSession()` uses `auth.getUser()` (`lib/auth/session.ts:40`); no client
  value is trusted.
- **Mass-assignment resistance:** strict zod schemas omit protected fields.
- **Safe error envelope:** `mapDatabaseError` + `runAction` never leak SQL/stack details
  (`lib/actions/result.ts:41-78`).
- **Open-redirect defense:** `sanitizeNextPath` (`app/auth/callback/route.ts:44-51`).
- **Draft confidentiality at the QR boundary:** non-published → 404.

---

## 7. Prioritized remediation plan

| Priority | Finding                | Action                                                                                           |
| -------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| P1       | F1 storage upload      | Verify Storage RLS/promotion on Supabase; add a shared upload quota if the chosen host lacks one |
| P2       | F2 dev advisories      | Track upstream; re-run `npm audit` each phase                                                    |
| P3       | F3 rate limiting       | Select shared rate-limit storage; cover auth, QR, uploads, and multi-instance analytics          |
| P4       | F4 publish gate        | Optional configurable required-field check                                                       |
| P5       | F5 native verification | Run the production checklist on a hosted project                                                 |

Remediations actually performed this phase are recorded in
[`security-implementation.md`](security-implementation.md); content-integrity guarantees are in
[`content-integrity.md`](content-integrity.md).

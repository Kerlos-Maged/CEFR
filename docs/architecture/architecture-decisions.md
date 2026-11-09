# Architecture Decision Records

> Document: `architecture-decisions.md`
> Status: Phase 1 — approved for implementation planning
> Related: [`requirements.md`](./requirements.md), [`architecture.md`](./architecture.md), [`database-schema.md`](./database-schema.md), [`security-and-permissions.md`](./security-and-permissions.md), [`api-contracts.md`](./api-contracts.md), [`implementation-roadmap.md`](./implementation-roadmap.md)

Format: each decision has **Context**, **Decision**, **Alternatives considered**,
**Consequences**, and **Status**.

---

## ADR-001 — Modular monolith on Next.js + Supabase

- **Context:** Read-heavy public pages and low-write editorial workflows; thousands of objects;
  small team; requirement to avoid unnecessary infrastructure.
- **Decision:** One Next.js (App Router) application on Vercel, one managed Supabase project
  (Postgres + Auth + Storage), with module boundaries as folders.
- **Alternatives:** (a) Microservices per domain — rejected (operational overhead, no scaling
  need). (b) Separate backend API (NestJS/Express) — rejected (duplicates Next.js server
  capabilities, extra deploy). (c) Static site + headless CMS — rejected (workflow and RLS
  requirements are easier in one DB).
- **Consequences:** Simple deploys and costs; single scaling axis; must keep module boundaries
  disciplined to avoid a big ball of mud.
- **Status:** Accepted.

---

## ADR-002 — Supabase as the backend platform

- **Context:** Need PostgreSQL, auth, and object storage with minimal ops and a low pilot cost.
- **Decision:** Use Supabase Postgres + Auth + Storage directly from Next.js with RLS as the
  enforcement layer.
- **Alternatives:** (a) Self-managed Postgres — rejected (ops burden). (b) Firebase — rejected
  (NoSQL model fits relational heritage data poorly; weaker SQL/RLS). (c) NextAuth + external DB +
  S3 — more moving parts for the same result.
- **Consequences:** Fast delivery, RLS provides strong guarantees; some vendor coupling; Supabase
  region/plan constraints (Q3, cost) must be validated.
- **Status:** Accepted.

---

## ADR-003 — Opaque stable `public_id` for QR codes

- **Context:** Printed QR codes must keep working for years while content, naming, and languages
  change.
- **Decision:** Each object gets a random 10-char Crockford Base32 `public_id`, generated once,
  never reused. QR encodes `https://{host}/o/{publicId}`. The token is locale-independent;
  middleware negotiates language without changing it. Renamed objects keep the token; retired
  tokens move to `object_aliases` and are never reassigned.
- **Alternatives:** (a) Sequential integer IDs — rejected (enumerable, reveals volume, mutable
  mapping risk). (b) Human-readable slugs in the QR URL — rejected (slugs change with language/
  naming, breaking print). (c) UUID in URL — rejected (too long for QR density / typo-prone).
- **Consequences:** Stable, non-enumerable URLs; need an alias/redirect table and a resolver that
  distinguishes 404 vs 410; human-friendly slugs become optional redirects only.
- **Status:** Accepted.

---

## ADR-004 — Database-enforced authorization via RLS as the primary control

- **Context:** The platform must guarantee that unpublished or unapproved content is never
  exposed, even if the application has a bug.
- **Decision:** Enable RLS on every table; public (`anon`) reads restricted to
  `status='published'` in active churches and public/permitted media; writes scoped by
  `church_memberships` via `SECURITY DEFINER` helpers (`auth.has_church_role`,
  `auth.is_church_member`, `auth.is_platform_admin`). Application checks remain for UX but are not
  the guarantee.
- **Alternatives:** (a) Application-only authorization — rejected (single bug leaks drafts).
  (b) Middleware-only — rejected (doesn't protect direct PostgREST access / leaked anon key).
- **Consequences:** Strong, testable guarantees; policies must be maintained with schema changes;
  RLS tested with SQL/pgTAP in CI.
- **Status:** Accepted.

---

## ADR-005 — Sources attach to claims, not only to objects

- **Context:** An object may have several independently verifiable attributes (date, attribution,
  provenance), each with different evidence. Object-level citations cannot express which source
  supports which assertion, undermining the reviewer role.
- **Decision:** Introduce `claims` (with `verification_status`) as the unit of assertion, and
  many-to-many `claim_sources`. Retain `object_sources` for genuinely object-wide references.
- **Alternatives:** (a) Single `object_sources` only — rejected (cannot attribute evidence to a
  specific claim; no per-claim verification). (b) Free-text citations inside a description —
  rejected (not structured, not auditable, not reviewable).
- **Consequences:** Richer, reviewable historical model; more tables and UI work; ensures the
  "verified vs uncertain/disputed" requirement (FR-OB-5) is representable.
- **Status:** Accepted.

---

## ADR-006 — All status transitions through one guarded database function

- **Context:** The workflow (Draft → Historical Review → Church Approval → Published) must not be
  bypassable, and every transition must be audited.
- **Decision:** A single `SECURITY DEFINER` function `transition_object_status()` is the only
  writer of `objects.status`. It validates the allowed transition matrix and the required role,
  then writes `publication_history`. No RLS policy permits direct status mutation.
- **Alternatives:** (a) Status updates in server actions with RLS checks — rejected (multiple
  code paths, risk of missing role checks). (b) Database trigger validating arbitrary updates —
  possible but centralizing on one function is clearer and testable.
- **Consequences:** One authoritative, testable place for workflow rules and audit; FR-PB-9 is
  enforced structurally; admin publish override (Q6) requires an explicit, audited branch.
- **Status:** Accepted.

---

## ADR-007 — Translations as separate tables keyed by language

- **Context:** Bilingual now (Arabic/English), more languages later; Arabic is RTL; translations
  must be independent and trackable.
- **Decision:** Content lives in the base record; language-specific content lives in
  `*_translations` tables with unique `(entity_id, language_code)`, referencing a `languages`
  table. Each object has a `default_language` used for fallback. Missing translation renders the
  default with a visible notice.
- **Alternatives:** (a) `jsonb` columns of translations — rejected (weak constraints, harder
  queries/indexing, awkward completeness tracking). (b) Language columns
  (`title_en`, `title_ar`) — rejected (schema change per language; violates extensibility).
- **Consequences:** No schema change to add languages; explicit completeness tracking;
  slightly more joins.
- **Status:** Accepted.

---

## ADR-008 — Server Actions first, Route Handlers only where required

- **Context:** Need a clear mutation pattern with validation and authorization.
- **Decision:** Use Server Actions for all app mutations and internal queries; use Route Handlers
  only for analytics ingest, QR binary export, upload orchestration, and auth callbacks.
- **Alternatives:** A full REST/GraphQL API — rejected (overkill for a single app; more surface
  to secure; no external consumers currently).
- **Consequences:** Less boilerplate, typed end-to-end; must keep actions server-only and
  validated; a public API can be added later without disturbing the QR URL contract.
- **Status:** Accepted.

---

## ADR-009 — Locale negotiation in middleware; token stays language-agnostic

- **Context:** A single printed QR code may be scanned by Arabic-first and English-first visitors;
  the URL must never fork by language.
- **Decision:** QR encodes `/o/{publicId}`. Middleware negotiates locale (cookie →
  `Accept-Language` → platform default) and serves `/en/o/{publicId}` or `/ar/o/{publicId}`
  without altering the token.
- **Alternatives:** Encode a fixed locale in the QR URL — rejected (forces one language or
  duplicate QR codes). Client-side language detection only — rejected (worse SSR/SEO, slower
  first paint).
- **Consequences:** One QR per object; correct default language SSR; language choice remembered
  client-side without accounts.
- **Status:** Accepted.

---

## ADR-010 — Privacy-conscious, first-party analytics

- **Context:** Churches want engagement insight; visitors must not be tracked or profiled.
- **Decision:** Collect page views, language selection, and audio engagement only. Store no IP,
  user-agent string, cookies, or precise location; use a salted, rotating, non-reversible
  `session_hash` for coarse unique counts. Raw events retained ≤90 days; durable daily
  aggregates. Analytics ingest is non-blocking and never breaks the page.
- **Alternatives:** (a) Third-party analytics (Google Analytics) — rejected (privacy, consent
  overhead, heavier client). (b) No analytics — rejected (churches need feedback).
- **Consequences:** Compliant, lightweight; limited funnel depth; must document retention and
  honor DNT/GPC.
- **Status:** Accepted.

---

## ADR-011 — Media permission gating and separate storage staging

- **Context:** Heritage media frequently has copyright/permission constraints that must be
  respected before publication.
- **Decision:** Media rows carry `permission_status` and `is_public`; public display requires
  `is_public = true` and `permission_status ∈ {granted, public_domain}`. Uploads stage in a
  private `incoming` bucket, are server-validated, then promoted to public `object-media`.
- **Alternatives:** (a) Upload directly to public storage — rejected (unvalidated/unapproved
  media exposed). (b) No permission metadata — rejected (legal/ethical risk).
- **Consequences:** Safer publication; extra upload step and background cleanup; aligns with
  possible non-public media (Q2).
- **Status:** Accepted.

---

## ADR-012 — Bilingual-first but language-agnostic data model

- **Context:** The pilot targets Arabic and English but may expand (e.g. Coptic, French).
- **Decision:** No hard-coded language columns; `languages` is data, `direction` is a column, and
  all content translation tables are keyed by `language_code`.
- **Alternatives:** Hard-code `en`/`ar` — rejected (extensibility, churn).
- **Consequences:** Adding a language is a data operation; UI must handle arbitrary `dir`.
- **Status:** Accepted.

---

## ADR-013 — Test stack: Vitest (unit/integration) + Playwright (E2E) + SQL/pgTAP (RLS)

- **Context:** Need TypeScript-friendly testing for logic, UI flows, and—critically—RLS policies.
- **Decision:** Vitest for unit/integration, Playwright for E2E and RTL/a11y visual checks,
  and pgTAP (or equivalent SQL tests) for RLS and the transition function.
- **Alternatives:** Jest — viable but slower DX with ESM/Next; Cypress — rejected in favor of
  Playwright's multi-browser and a11y tooling.
- **Consequences:** Fast unit tests, real browser E2E, and security guarantees tested at the DB
  layer; slightly more tooling to maintain.
- **Status:** Accepted.

---

## ADR-014 — Documentation-first, phase-gated delivery

- **Context:** Implementation will be continued by future AI agents; ambiguity is expensive.
- **Decision:** Freeze contracts (schema, public URL, RLS model) at Phase 1–3 and gate each later
  phase on its own tests and Definition of Done. Later phases must not change frozen contracts
  without a new ADR.
- **Alternatives:** Agile implementation without fixed contracts — rejected (risk of invented
  schema/route structure across agents).
- **Consequences:** Predictable, resumable development; changes to frozen contracts require
  deliberate ADR updates.
- **Status:** Accepted.

---

## ADR-015 — Extension-free database schema (no `citext`, `pg_trgm`, or `pgcrypto`)

- **Context:** `database-schema.md` specified `citext` (case-insensitive slugs), `pg_trgm`
  (trigram title search), and `pgcrypto` (`gen_random_uuid`). Phase 3 discovered that the
  in-process PostgreSQL used for Docker-free testing (PGlite) does not ship `citext`/`pg_trgm`,
  and the platform has no Docker/WSL to run the real Supabase stack.
- **Decision:** Ship a portable, extension-free schema. `gen_random_uuid()` is core since
  PostgreSQL 13. Church slugs are `text` constrained to lowercase by
  `check (slug ~ '^[a-z0-9-]{3,60}$')` plus a unique constraint. Trigram search indexes are
  **dropped** and deferred to the search phase (Phase 5), where they can be added together with
  the feature that needs them (via `pg_trgm` on a managed Supabase project that supports it).
- **Alternatives:** Require Docker locally and use `citext`/`pg_trgm` — rejected (blocks
  development on the current machines); store lowercased slug in an extra column — rejected
  (redundant).
- **Consequences:** Identical schema runs on managed Supabase and in the PGlite test harness.
  Case-insensitive lookups are the application's responsibility (slugs are normalized to
  lowercase before querying). Title search will require a follow-up migration when implemented.
- **Status:** Accepted (revisits `database-schema.md` §1/§4/§7 indexing strategy).

---

## ADR-016 — Authorization helpers live in the `public` schema

- **Context:** `security-and-permissions.md` sketched helpers as `auth.has_church_role(...)`,
  `auth.is_church_member(...)`, and `auth.is_platform_admin()`. Managed Supabase reserves the
  `auth` schema for its own objects; creating functions there is brittle and unnecessary.
- **Decision:** Define the `SECURITY DEFINER` helpers in `public`
  (`public.has_church_role`, `public.is_church_member`, `public.is_any_church_member`,
  `public.is_platform_admin`, plus object-scoped helpers such as `public.is_object_published`
  and `public.can_write_object_content`). Each pins `set search_path = public`. They continue to
  consume the Supabase-provided `auth.uid()`.
- **Alternatives:** Keep them in `auth` — rejected (schema ownership/portability).
- **Consequences:** Policies are written as `public.…`. Ownership of tables and functions must
  stay with a role that bypasses RLS (Supabase `postgres`) for the definer trick to work.
- **Status:** Accepted.

---

## ADR-017 — Public-id resolution RPC for 404-vs-410

- **Context:** Public pages must show 404 for unknown/in-progress ids and 410 for retired
  (archived) ids (FR-QR-4/6). RLS hides all non-published objects from `anon`, so an anon client
  cannot tell "archived" from "never existed".
- **Decision:** Add `public.resolve_public_id(text)` as a `SECURITY DEFINER` function returning a
  row **only** for ids whose status is `published` or `archived` (direct `public_id` first, then
  `object_aliases`). It never reveals `draft`/`historical_review`/`church_review` ids, which
  resolve to no row. The DAL maps the result to `{ kind: "available" }`, `{ kind: "gone" }`, or
  `null`.
- **Alternatives:** Service-role lookup in the page — rejected (leaks more, heavier); a plain anon
  query — impossible under RLS.
- **Consequences:** A tiny, audited surface that intentionally discloses only archived-vs-missing.
- **Status:** Accepted.

---

## ADR-018 — Status writes go through a transition function + immutability guard trigger

- **Context:** `security-and-permissions.md` requires that `objects.status` is written only by
  `transition_object_status()` and never by an editor's direct `UPDATE`.
- **Decision:** `BEFORE UPDATE` trigger `enforce_object_immutables` on `objects` rejects any change
  to `status` unless the transaction-local GUC `app.allow_status_change = 'true'`, which the
  transition function sets around its own update (and resets immediately after). The trigger also
  makes `church_id` and `public_id` immutable. Role checks per `(from_status, to_status)` live in
  the function; the previously missing `church_review → draft` check now requires the
  `church_approver` role. Publishing (`church_review → published`) requires the church approver
  **only** — the platform-admin override remains unimplemented per **Q6**. `record_review()`
  records an append-only `review_records` row and then transitions atomically.
- **Alternatives:** Enforce via RLS `WITH CHECK` alone — rejected (cannot express per-transition
  role rules or write history cleanly).
- **Consequences:** Even a compromised application cannot bypass the workflow. Changing the
  matrix requires a migration (deliberate by design).
- **Status:** Accepted.

---

## ADR-019 — PGlite integration harness as the Docker-free test path

- **Context:** ADR-013 specifies SQL/pgTAP RLS tests against a Supabase database, but this
  environment has no Docker/WSL, so `supabase start`/`supabase test db` cannot run.
- **Decision:** Test the real migrations with Vitest against an in-process PostgreSQL
  (`@electric-sql/pglite`). The harness creates the `anon`/`authenticated`/`service_role` roles
  (the latter with `BYPASSRLS`), an `auth.users` shim, and an `auth.uid()` shim backed by the
  `request.jwt.claim.sub` GUC, then applies every `supabase/migrations/*.sql` file in order and
  exercises RLS and the workflow functions. Types are generated from the same migrations by
  `scripts/generate-db-types.mts`.
- **Alternatives:** Skip DB tests until Docker is available — rejected (security behavior would be
  unverified); use a hosted Supabase instance — rejected (no credentials, no network guarantee).
- **Consequences:** RLS and workflow behavior are covered in CI without Docker. pgTAP against a
  real Supabase instance remains the documented complement once Docker is available; the PGlite
  path must be kept honest about this limitation.
- **Status:** Accepted.

---

## ADR-020 — Two storage buckets (`incoming` staging → `object-media` public)

- **Context:** `security-and-permissions.md` §6 requires signed uploads, server-side validation,
  and non-guessable paths, while published media must be CDN-servable.
- **Decision:** Create two buckets in `20261019000009_storage_buckets.sql`: private `incoming`
  for signed editor uploads and public-read `object-media` for promoted media, both limited to
  25 MiB and an explicit image/audio MIME allow-list. Paths follow
  `<church_id>/<object_id>/<uuid>.<ext>`. `storage.objects` policies restrict writes to members
  passing `public.can_write_object_content(<object_id>)`. The migration is a deliberate no-op when
  the `storage` schema is absent so the PGlite test harness stays green.
- **Alternatives:** A single public bucket — rejected (no staging boundary, weaker validation);
  seeding buckets via `supabase/storage.sql` — rejected as Supabase-only and unverifiable locally.
- **Consequences:** Uploads are validated before promotion; public readability is decoupled from
  the `public.media` row gate. Real bucket/policy behavior must be verified on Docker/Supabase.
- **Status:** Accepted.

---

## ADR-021 — Locale-prefixed routes with Next.js 16 `proxy.ts`

- **Context:** The architecture specifies `/en/o/{id}` and `/ar/o/{id}` while a single printed QR
  code must work language-independently. Next.js 16 deprecates `middleware.ts` in favor of
  `proxy.ts`, and this project enables Cache Components.
- **Decision:** Keep a single root layout at `app/[lang]/layout.tsx` (it renders `<html lang dir>`)
  with `generateStaticParams()` for `en`/`ar`. `proxy.ts` redirects `/` and bare `/o/{id}` to a
  negotiated locale and remembers it in the `NEXT_LOCALE` cookie. Negotiation lives in a pure
  module so it is unit-tested without a server.
- **Alternatives:** `headers()`-based locale detection in a shared root layout — rejected (needs a
  Suspense boundary around the whole app under Cache Components and is less cacheable); a
  client-only switcher — rejected (no RTL-correct SSR shell).
- **Consequences:** Every public page is statically shell-able per language. Adding a language
  requires updating the TS registry and the DB seed together.
- **Status:** Accepted.

---

## ADR-022 — Hand-built Supabase `srcset` instead of `next/image`

- **Context:** Published images are served from Supabase Storage, which exposes an image
  transformation endpoint.
- **Decision:** Build `/storage/v1/render/image/public/...?width=...` URLs for a fixed width ladder
  and emit a plain `<img>` with `srcset`/`sizes` and intrinsic dimensions. Disable
  `@next/next/no-img-element` only for `components/media/**`.
- **Alternatives:** `next/image` — rejected (redundant optimizer, requires `remotePatterns` per
  deployment, and cannot express pre-built Supabase variants); a custom image loader — deferred
  until Phase 8 performance work.
- **Consequences:** No Next.js image-optimizer cost, but transformations depend on the Supabase
  plan; the URL builder is pure and tested. LCP/bandwidth budgets are re-evaluated in Phase 8.
- **Status:** Accepted.

---

## ADR-023 — Magic-byte upload validation and an explicit publication gate

- **Context:** Browser-provided `Content-Type` and filenames are untrusted; FR-MD requires
  server-side rejection of invalid MIME/size and alt text for public images.
- **Decision:** `lib/media/mime.ts` validates declared type, extension, per-kind size limits, and
  (when bytes are available) the file signature. `canPublishMedia()` requires
  `granted`/`public_domain` rights and alt text for images. These mirror the database `CHECK`
  constraints rather than replacing them.
- **Alternatives:** Trust `Content-Type` — rejected; rely only on the DB constraint — rejected
  (it cannot inspect file content or size before storage).
- **Consequences:** The same pure functions can run in the future signed-upload action and in
  tests. Dimensions/duration/checksum extraction remain Phase 6 server-action work.
- **Status:** Accepted.

---

## ADR-024 — Supabase Auth via `@supabase/ssr` cookie clients

- **Context:** Phase 6 needs authenticated server rendering and server actions. `@supabase/supabase-js`
  alone has no Next.js cookie adapter, and the bundled `auth-js` exposes no `getAll`/`setAll`
  storage helpers for App Router cookies.
- **Decision:** Add `@supabase/ssr`. Server-side code uses `createServerClient` bound to
  `next/headers` cookies (`createServerSessionClient` in `lib/db/client.ts`); the browser uses
  `createBrowserClient` (`lib/db/browser-client.ts`). The `proxy.ts` refreshes the session on each
  request and writes rotated cookies back to the response. Identity is always taken from the
  server-verified `auth.getUser()` result, never from client input.
- **Alternatives:** Hand-rolled cookie session — rejected (a second auth system); `auth-helpers` —
  deprecated in favour of `@supabase/ssr`.
- **Consequences:** Browser-only and server-only client factories are split so `next/headers` never
  enters the client bundle. Magic-link sign-in ("no passwords") matches `security-and-permissions.md`
  §7. Real sign-in/callback flows still require a hosted Supabase project to verify.
- **Status:** Accepted.

---

## ADR-025 — Admin CMS lives under the localized `app/[lang]/admin` tree

- **Context:** The public site is locale-prefixed with a single root layout that owns
  `<html lang dir>` (`ADR-021`); Phase 6 adds a protected CMS ("/admin").
- **Decision:** Admin routes live at `app/[lang]/admin/*` (URLs `/en/admin`, `/ar/admin`), inside
  the existing root layout, so RTL/Arabic chrome is inherited. The layout is a Suspense-wrapped
  dynamic shell (`cacheComponents: true` forbids `export const dynamic`); it redirects
  unauthenticated users to the localized `/login` and shows a neutral "no access" page to
  signed-in users without a role.
- **Alternatives:** A separate top-level `/admin` with its own `<html>` — rejected (duplicate layouts,
  no RTL inheritance); a `(public)` route group — rejected (nothing is private in Phase 5).
- **Consequences:** Programmatic post-login redirects use localized paths. `/api/qr` and
  `/auth/callback` remain unlocalized route handlers.
- **Status:** Accepted.

---

## ADR-026 — Authorization helpers wrap RLS; server actions whitelist fields

- **Context:** `security-and-permissions.md` §5 makes clear application checks provide UX while the
  database provides the guarantee. Server actions must not trust browser-supplied role/church/status.
- **Decision:** `lib/auth/authorization.ts` mirrors the RLS rules for guards and affordances only
  (`requireSession`, `requirePlatformAdmin`, `requireRoleInChurch`, …). Every mutation
  (`lib/actions/*`) validates with a **strict** zod schema that enumerates writable fields — protected
  columns (`status`, `church_id`, `public_id`, `created_by`, timestamps) are absent and therefore
  rejected, not silently dropped. Status changes occur only via `transition_object_status()` /
  `record_review()`.
- **Consequences:** A direct call to any action cannot escalate privilege or skip the workflow; RLS
  re-checks church scope with the user's own JWT. Add a field by editing the schema explicitly.
- **Status:** Accepted.

---

## ADR-027 — Checked QR rendering behind an authorized route handler

- **Context:** The roadmap requires `/api/qr/[objectId]`. No QR utility existed; `api-contracts.md`
  §8.2 defines an authorized export that must not leak unpublished objects.
- **Decision:** Add `lib/qr/index.ts` (pure `objectPublicUrl` + `renderQrSvg`/`renderQrPng` using the
  `qrcode` package) and `app/api/qr/[publicId]/route.ts`. The handler requires a session, resolves the
  object by `publicId`, returns **404** for anything not `published` (never confirming drafts), and
  **403** unless the caller is a platform admin or an editor/approver of the object's church.
- **Consequences:** The permanent `/o/{publicId}` URL is built from `NEXT_PUBLIC_SITE_URL` (Q1).
  Exports are `no-store`. PNG returns raw bytes; SVG returns a document.
- **Status:** Accepted.

---

## ADR-028 — Baseline security headers, no static CSP

- **Context:** Phase 7 hardening found no security response headers were emitted. A full
  Content-Security-Policy needs per-request nonces for Next.js's inline bootstrap scripts.
- **Decision:** Apply `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy`
  globally via `next.config.ts` `headers()`. Defer the CSP to a follow-up that mints nonces in
  `proxy.ts`.
- **Alternatives:** A static CSP with `unsafe-inline` — rejected (defeats the purpose); no headers —
  rejected.
- **Consequences:** Clickjacking, MIME sniffing, referrer leakage, and feature-API abuse are covered
  now; XSS defence-in-depth via CSP is a tracked follow-up.
- **Status:** Accepted.

---

## ADR-029 — Treat RLS zero-row mutations as failures

- **Context:** RLS `UPDATE`/`DELETE` against a row the caller may not write affects zero rows and
  raises no error (verified by `tests/integration/db/security-hardening.test.ts`). Silent success
  would mislead the UI and hide authorization denials.
- **Decision:** Mutations that target potentially foreign rows (media, claims, translations,
  objects) request the affected row back and return `FORBIDDEN`/`NOT_FOUND` when none is returned.
- **Alternatives:** Rely on the post-write read to reflect no change — rejected (ambiguous UX and no
  error surface).
- **Consequences:** Actions report authorization outcomes accurately; the pattern is uniform across
  `lib/actions/*`.
- **Status:** Accepted.

---

## Open Decisions Pending Human Input

| Ref | Decision needed | Affects |
| --- | --- | --- |
| Q1 | Production domain; per-church subdomains | Routing, SEO, QR base URL |
| Q2 | Whether any media must be non-public | Storage RLS, signed URLs (ADR-011 extension) |
| Q3 | Data residency / legal retention | Supabase region, retention policy |
| Q5 | Wording of verification indicators | UI copy (claims) |
| Q7 | Offline/service-worker expectations | Public page caching strategy |

Q4 was resolved by ADR-030 (public active-church directory). Q6 is resolved for this phase by
ADR-018: only a church approver can publish; platform administrators have no bypass.

Each will be recorded as a new ADR when resolved.

## ADR-030 — Public active-church directory

- **Context:** Q4 left public discovery undecided. The product now has active church profile routes
  and object pages link to their owning church.
- **Decision:** List active churches in a public directory and expose active church profiles. Archived
  churches and their objects remain absent from public discovery.
- **Consequences:** Church names and descriptions are public content; keep the directory filtered by
  active status and respect translated content fallback.
- **Status:** Accepted by the user on 2026-11-06.

## ADR-031 — Return correct HTTP statuses for QR identifiers

- **Context:** App Router pages cannot reliably emit required 404/410 statuses after a PPR shell
  streams. Retired QR IDs remain permanent; unknown and unpublished IDs must stay hidden.
- **Decision:** The Next.js Proxy resolves locale-prefixed QR paths before rendering. Archived IDs
  return a neutral localized 410; unknown and unpublished IDs return a neutral localized 404.
  Resolver failures continue to the page handler rather than replacing available content. Sourced
  static reference IDs bypass database resolution because their pages are bundled with the app.
- **Consequences:** QR requests incur one resolver lookup before response. Status behavior needs a
  Supabase-backed runtime check.
- **Status:** Accepted.

## ADR-032 — Defer CSP until PPR-compatible script integrity is available

- **Context:** ADR-028 deferred CSP because nonce-based CSP disables Partial Prerendering. The Next
  16 CSP guide recommends experimental SRI as a static alternative.
- **Evidence:** A production Webpack build with SHA-256 SRI emitted inline React streaming scripts
  and external script tags without integrity attributes. A `script-src 'self'` policy would block
  valid page scripts; `unsafe-inline` would allow injected inline scripts and defeat the intended
  protection.
- **Decision:** Keep the four baseline security headers and do not emit CSP or enable experimental
  SRI until Next provides integrity coverage compatible with PPR streaming, or the product accepts
  the performance/rendering cost of nonce-based dynamic rendering.
- **Consequences:** CSP remains a documented security hardening gap. Do not describe SRI alone as a
  CSP control.
- **Status:** Accepted; revisit when Next.js streaming/SRI support changes.

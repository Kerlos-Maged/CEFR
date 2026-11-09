# Phase Status

Tracks progress against the roadmap in
[`architecture/implementation-roadmap.md`](architecture/implementation-roadmap.md).

## Phase 1 — Requirements and Architecture: complete

Seven approved design documents exist under `docs/architecture/` and are preserved as-authored:

- `requirements.md`, `architecture.md`, `database-schema.md`, `security-and-permissions.md`,
  `api-contracts.md`, `implementation-roadmap.md`, `architecture-decisions.md`

Outstanding architecture decisions (see `architecture-decisions.md`): **Q1** production domain,
**Q2** non-public media, **Q3** data residency, **Q5** verification wording, and **Q7** offline
caching expectations. **Q4** is resolved by ADR-030 (active church directory); **Q6** is resolved
for this phase by ADR-018 (no platform-admin publish bypass).

## Phase 2 — Repository and Development Infrastructure: complete

Established a runnable Next.js skeleton matching the Phase 1 architecture. **No application
features were implemented.**

### What was created

- **Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS v4** application with
  a placeholder landing page (`app/`).
- **Environment handling:** `.env.example` plus zod-validated `lib/env.ts` (browser-safe) and
  `lib/env.server.ts` (server-only, refuses client evaluation).
- **Validation:** `lib/validation/public-id.ts` implementing the canonical 10-character Crockford
  Base32 object ID format (FR-QR-2).
- **Documented directories** reserved for later phases: `components/`, `lib/db/`, `lib/authz/`,
  `lib/actions/`, `types/`, `supabase/migrations/`, `tests/`.
- **Code quality:** ESLint flat config (Next.js + `eslint-config-prettier`), Prettier with Tailwind
  class sorting, strict `tsc`, and `.gitignore`/`.prettierignore` rules.
- **Testing:** Vitest (unit) with a smoke suite for the public-ID validator.
- **CI:** `.github/workflows/ci.yml` running `npm ci`, lint, typecheck, tests, and build.
- **Docs:** `README.md`, `docs/development-setup.md`, and this file.

### Historical Phase 9 command results

These are the Phase 9 baseline results from 2026-10-20, not a claim that the full suite was rerun
after later follow-up changes. Current-source lint and typecheck were rerun on 2026-11-08; see
`docs/test-matrix.md`. Browser, database, and build checks still need to be repeated for release.

| Command                                                                                             | Result                                                           |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `node --version`                                                                                    | `v22.15.0`                                                       |
| `npm --version`                                                                                     | `10.9.2`                                                         |
| `npm install`                                                                                       | 363 packages added (non-fatal OneDrive `EPERM` cleanup warnings) |
| `npm install zod`                                                                                   | 1 package changed                                                |
| `npm install -D @types/node@^22 prettier prettier-plugin-tailwindcss eslint-config-prettier vitest` | 30 packages added                                                |
| `npm audit --omit=dev`                                                                              | 0 vulnerabilities                                                |
| `npm run format`                                                                                    | Succeeded (formatted 4 files)                                    |
| `npm run lint`                                                                                      | Passed (no findings)                                             |
| `npm run typecheck`                                                                                 | Passed (runs `next typegen` then `tsc --noEmit`)                 |
| `npm test`                                                                                          | 5 tests passed                                                   |
| `npm run build`                                                                                     | Succeeded; static routes `/` and `/_not-found`                   |
| `next start -p 3100`                                                                                | HTTP 200, page title present                                     |
| `next dev -p 3101`                                                                                  | HTTP 200, page title present                                     |

> The GitHub Actions workflow was created but not executed, because no push was authorized in
> this phase. Its steps were all run locally with identical commands.

### Known issues and limitations

- **Dev-only audit findings:** `npm audit` reports 5 high-severity issues in the
  `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` chain
  (stack-exhaustion DoS). Production dependencies report 0 vulnerabilities. Not force-fixed, as
  the suggested fix is a breaking downgrade to `eslint-config-next@14`; will be resolved by an
  upstream bump.
- **Windows/OneDrive `EPERM` warnings** during `npm install` are non-fatal (file locks from
  sync/antivirus).
- **End-to-end tests (Playwright)** are specified in ADR-013 but deferred to Phase 4, where public
  routes exist to exercise them. Only Vitest is installed now, per the Phase 2 minimal-test-stack
  instruction.
- `npm run typecheck` must run `next typegen` first because Next.js 16 generates the `LayoutProps`
  route type into `.next/types`.
- No external service, database, or deployment was created.

## Phase 3 — Database and Backend Foundation: complete

Implemented the full PostgreSQL/Supabase schema, Row Level Security, workflow functions, typed
data-access layer, and regression tests described in `database-schema.md`,
`security-and-permissions.md`, and `api-contracts.md`. No public routes were added (Phase 4).

### What was created

- **Supabase project config:** `supabase/config.toml` (local stack definition; no hosted project).
- **Versioned migrations** in `supabase/migrations/`, applied in lexical order:
  1. `20261019000001_init_enums.sql` — 9 enum types.
  2. `20261019000002_init_core_tables.sql` — `languages`, `churches`, `profiles`,
     `church_memberships`, `church_translations`.
  3. `20261019000003_init_content_tables.sql` — `objects`, `object_translations`, `claims`,
     `sources`, `claim_sources`, `object_sources`, `media`, `media_translations` (+ deferred
     `churches.cover_media_id` FK).
  4. `20261019000004_init_audit_tables.sql` — `review_records`, `publication_history`,
     `object_aliases`, `analytics_events`, `analytics_daily`.
  5. `20261019000005_functions_and_triggers.sql` — `updated_at` triggers, profile provisioning,
     authorization helpers, `transition_object_status()`, `record_review()`, the objects
     immutability guard trigger, and the `object_translation_status` view.
  6. `20261019000006_rls_policies.sql` — RLS enabled on every table, explicit role grants, and
     the full policy set.
  7. `20261019000007_seed_languages.sql` — `en`/`ar` registry rows.
  8. `20261019000008_public_resolve_rpc.sql` — `resolve_public_id()` for 404-vs-410 routing.
- **Dev seed:** `supabase/seed.sql` (fictional fixtures only; no credentials or real data).
- **Generated types:** `lib/db/database.types.ts` (Supabase-compatible) produced from the
  migrations by `scripts/generate-db-types.mts`.
- **Data-access layer** in `lib/db/`: `client.ts` (anon + service-role clients, storage URL
  helper), `errors.ts` (`DalError`/`ErrorCode` per `api-contracts.md` §10), `localization.ts`
  (locale fallback), `objects.ts` (`getPublishedObjectByPublicId`, `resolvePublicId`),
  `churches.ts` (`getChurchBySlug`).
- **Tests** in `tests/integration/db/`: a PGlite harness (`harness.ts`) plus schema and
  RLS/workflow suites.
- **Docs:** this section and new ADRs 015–019 in `architecture/architecture-decisions.md`.

### Commands executed and actual results

| Command                               | Result                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `npm install @supabase/supabase-js`   | 8 packages added (non-fatal OneDrive `EPERM` warnings)                    |
| `npm install -D @electric-sql/pglite` | 1 package added                                                           |
| `npm run db:types:pglite`             | Generated `lib/db/database.types.ts` (9 enums, 151 columns, 15 functions) |
| `npm run lint`                        | Passed                                                                    |
| `npm run typecheck`                   | Passed                                                                    |
| `npm run format:check`                | Passed                                                                    |
| `npm test`                            | 27 tests passed (5 unit + 22 integration)                                 |
| `npm run check`                       | lint + typecheck + tests all passed                                       |

> The integration suite boots an in-process PostgreSQL (PGlite) and applies every migration in
> `beforeAll`; Vitest is configured to run test files sequentially (`fileParallelism: false`,
> `isolate: false`) with raised hook/test timeouts to accommodate this.

### Known issues and limitations

- **Supabase-native path not exercised.** There is no Docker/WSL on the development machine, so
  `supabase start`, `supabase db reset`, `supabase test db`, and `supabase gen types typescript
--local` could not be run. The migrations were instead validated against PGlite, and types were
  generated by `scripts/generate-db-types.mts`. On a Docker-capable machine, the `npm run db:*`
  scripts run the same migrations against real Supabase; the two paths must be kept in sync.
- **Extension-free schema:** `citext`/`pg_trgm`/`pgcrypto` are intentionally not used; trigram
  title search is deferred to Phase 5 (ADR-015).
- **Admin publish override (Q6) remains unimplemented.** Only a church approver can move an object
  to `published`; the platform-admin bypass is deliberately absent (ADR-018).
- **`sources` has no church scope** in the schema, so its write policy uses
  `is_any_church_member()`. Revisit if source ownership needs stricter scoping.
- **Claim verification granularity:** a historical reviewer may `UPDATE` any column of a claim in
  their church (not just `verification`); the application restricts fields. Column-level
  enforcement can be added if required.
- **Dev-only audit findings** (unchanged from Phase 2): 5 high-severity issues in the
  `eslint-config-next` chain; production dependencies report 0 vulnerabilities.
- No external service, database, or deployment was created; nothing has been committed.

### Architecture questions resolved in this phase

- **Q6 (admin publish override):** resolved as **not implemented** for this phase — the church
  approver remains the sole publisher (ADR-018).
- **Q2 (non-public media):** unchanged; media already carries `is_public` + `permission_status`
  and the extension remains additive.

## Phase 4 — Public Pages, QR Routing, and Analytics: implemented, with remaining gaps

Phase 4 was **not present** when Phase 5 began (`app/` contained only the Phase 2 placeholders).
Because Phase 5's responsive-image requirement needs a public object page, a **minimal Phase 4
integration surface** was built as part of Phase 5:

- locale-prefixed routing with `proxy.ts` (`/` and bare `/o/{id}` redirect to a negotiated locale);
- `app/[lang]/` root layout with correct `<html lang dir>`, landing page, and bilingual 404;
- `app/[lang]/o/[publicId]/page.tsx` wired to `resolvePublicId()` /
  `getPublishedObjectByPublicId()`, rendering localized content, fallback notice, images, audio,
  claims, sources, and the language switch.

Follow-up work adds active church directory/profile routes (Q4 resolved; see ADR-030), analytics
ingestion/reporting, public cache tags, and per-object metadata. Proxy now returns a neutral HTTP 410
for archived QR IDs (ADR-031). Monitoring, production performance measurement, and hosted service
verification remain outstanding.

## Phase 5 — Media and Multilingual Support: complete (with documented gaps)

Implemented the media validation/presentation layer and the multilingual infrastructure. The
signed-upload HTTP action, upload UI, translation editing, and completeness dashboard remain Phase 6
deliverables, per the roadmap.

### What was created

- **Language registry and negotiation:** `lib/i18n/languages.ts` (codes, native names, direction,
  cookie name), `lib/i18n/negotiate.ts` (cookie → `Accept-Language` q-values → default),
  `lib/i18n/paths.ts` (locale matching/prefixing), `lib/i18n/messages.ts` (minimal en/ar UI strings).
- **Routing:** `proxy.ts` (Next.js 16 replacement for `middleware.ts`) and the `app/[lang]/` route
  tree (root layout, landing, bilingual 404, object page, object Suspense skeleton).
- **Media validation:** `lib/media/mime.ts` — MIME allow-list, magic-byte sniffing, extension and
  per-kind size checks, `canPublishMedia()` (rights + alt text).
- **Responsive media:** `lib/media/urls.ts` (Supabase render URLs, 320–1920 px srcset ladder),
  `components/media/heritage-image.tsx`, `components/media/narration-player.tsx`.
- **Language switch:** `components/language-switch.tsx` (server-computed alternate URLs, client
  cookie write).
- **DAL extensions:** `pickMediaCaption()` in `lib/db/localization.ts`; `isSupabaseConfigured()` in
  `lib/db/client.ts` so pages degrade gracefully without credentials.
- **Storage:** `supabase/migrations/20261019000009_storage_buckets.sql` (`object-media` public,
  `incoming` private, MIME/size limits, `storage.objects` member-write policies; no-op outside
  Supabase).
- **Tests:** `tests/unit/i18n/{languages,negotiate}.test.ts`,
  `tests/unit/media/{mime,urls}.test.ts`, `tests/unit/db/localization.test.ts` (43 new tests).
- **Docs:** `docs/media-management.md`, `docs/multilingual-content.md`, ADRs 020–023, and an ESLint
  override allowing hand-built `srcset` in `components/media/**`.

### Commands executed and actual results

| Command                | Result                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `npm run lint`         | Passed (no findings)                                                                   |
| `npm run typecheck`    | Passed (after clearing stale `.next/dev` types from the removed root routes)           |
| `npm run format:check` | Passed                                                                                 |
| `npm test`             | 70 tests passed (8 files: 48 unit + 22 integration)                                    |
| `npm run build`        | Succeeded; `/en`, `/ar` static shells, object routes partial-prerendered, proxy active |

> The integration suite applies the new storage migration; it correctly no-ops under PGlite,
> confirming the `storage` schema guard.

### Known issues and limitations

- **Supabase Storage is unverified locally.** No Docker/WSL, so bucket creation and
  `storage.objects` policies could not be exercised. The migration must be run against a
  Docker-capable Supabase stack or a hosted project.
- **Upload UI and multipart route are implemented** in a follow-up; live Storage bucket/policy
  behavior remains unverified without a Supabase project.
- **Translation editing and completeness dashboard** were delivered in Phase 6 (`/admin/translations`);
  the original Phase 5 limitation is resolved by that follow-up.
- **Arabic UI copy needs native-speaker review**; RTL direction and layout are implemented.
- **Archived object HTTP 410** is implemented in Proxy (ADR-031), but needs runtime verification
  against a configured database.
- **Caching** now uses tags for published object and church reads; performance remains unmeasured.
  Object pages stream dynamically under `cacheComponents: true`; runtime cache behavior still needs
  measurement on the deployment platform.
- **Image transforms depend on the Supabase plan.** The URL builder is tested; actual resizing must
  be confirmed on the target project.
- **Per-object metadata** was added in the Phase 8 follow-up; production share previews still need
  verification with hosted content and the production origin.
- **Dev-only audit findings** (unchanged): 5 high-severity issues in the `eslint-config-next` chain;
  production dependencies report 0 vulnerabilities.

## Phase 6 — Administrative Dashboard and CMS: complete (with documented gaps)

Implemented Supabase Auth (magic link, cookie sessions), a protected admin route area, role-aware
dashboard, object CRUD with multilingual editing, media/source management, an editorial review
queue wired to the workflow functions, church/user membership administration, and checked QR export.
Deployment, machine translation, bulk import/QR printing, and payment remain out of scope.

### What was created

- **Auth (`lib/auth/`, `lib/db/client.ts`, `lib/db/browser-client.ts`, `app/auth/callback/route.ts`,
  `proxy.ts`):** `@supabase/ssr` server/browser cookie clients, `getSession()` (server-verified
  `auth.getUser()` + memberships), session refresh in `proxy.ts`, magic-link callback with a
  same-origin `next` sanitiser, sign-out action, and `app/[lang]/login/page.tsx` with a browser
  magic-link form.
- **Authorization (`lib/auth/authorization.ts`):** guards mirroring RLS (`requireSession`,
  `requirePlatformAdmin`, `requireRoleInChurch`, `roleSummary`, `canEditObjectContent`).
- **Server actions (`lib/actions/`):** `result.ts` (shared `ActionResult` + Postgres→`DalError`
  mapping with no stack/detail leakage), `objects.ts`, `workflow.ts` (submit/review/publish-unpublish/
  archive via RPCs), `sources.ts`, `media.ts`, `membership.ts`, `auth.ts`. All strict-validated.
- **Validation (`lib/validation/`):** strict zod schemas (`object.ts`) that whitelist writable fields;
  Crockford Base32 `generate-public-id.ts`.
- **Admin data layer (`lib/admin/data.ts`):** RLS-scoped reads for objects, dashboard counts, review
  queues, churches, and users.
- **Admin UI (`app/[lang]/admin/**`, `components/admin/**`):** layout with auth guard + nav, dashboard,
  object list, new-object form, full object editor (details, translations, media, claims, sources,
  history/audit, QR links), review queue, churches (read-only), users & memberships. RTL-aware.
- **QR (`lib/qr/index.ts`, `app/api/qr/[publicId]/route.ts`):** permanent-URL builder and checked
  SVG/PNG export.
- **Tests:** `tests/integration/db/phase6-authorization.test.ts` (22 DB-policy tests),
  `tests/unit/validation/{object-schemas,generate-public-id}.test.ts`,
  `tests/unit/auth/sanitize-next-path.test.ts`, `tests/unit/qr/qr.test.ts` (43 new).
- **Docs:** ADRs 024–027 and this section.

### Commands executed and actual results

| Command                                                 | Result                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm install @supabase/ssr qrcode` / `-D @types/qrcode` | 28 packages added (non-fatal OneDrive `EPERM` warnings)                                 |
| `npm run lint`                                          | Passed (no findings)                                                                    |
| `npm run typecheck`                                     | Passed                                                                                  |
| `npm run format:check`                                  | Passed                                                                                  |
| `npm test`                                              | 126 tests passed (13 files: 70 unit + 56 integration)                                   |
| `npm run build`                                         | Succeeded; admin/login routes partial-prerender, `/api/qr/*` + `/auth/callback` dynamic |

### Known issues and limitations

- **Supabase-native auth/storage unverified.** No Docker/WSL, so real magic-link sign-in, session
  refresh, storage buckets, and signed uploads could not be exercised. Admin authorization is proven
  at the RLS/RPC layer via PGlite, not via HTTP E2E.
- **Media upload and church-management UI are implemented** in follow-up work; live Storage behavior
  remains unverified.
- **Arabic admin copy needs native-speaker review.**
- **Dev-only audit findings** (unchanged): 5 high-severity issues in the `eslint-config-next` chain;
  `npm audit --omit=dev` reports 0 production vulnerabilities.

## Phase 7 — Security Hardening and Content Integrity: complete (with documented gaps)

Audited the Phase 6 application, produced a threat model and prioritized findings, applied
incremental remediations, strengthened the security test suite, and documented the controls. No
finding of High or Critical severity affecting the implemented surface was identified.

### What was created

- **`docs/security-audit.md`** — scope/method, asset inventory, trust boundaries, STRIDE threat
  model, findings by severity with dispositions, and a prioritized remediation plan.
- **`docs/security-implementation.md`** — control inventory, the six remediations applied this phase,
  verification steps, and a production-only checklist.
- **`docs/content-integrity.md`** — the eleven integrity invariants (publication gate, immutability,
  atomic review+transition, append-only audit, media gate, QR permanence) and open items.
- **`tests/integration/db/security-hardening.test.ts`** — 10 tests covering privilege escalation,
  audit immutability, alias integrity, the media publish-gate constraint, church-scope isolation,
  and the hard-delete boundary.

### Remediations applied

- **R1** Baseline security response headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`) in `next.config.ts`; verified live.
- **R2** QR route no longer returns an internal error message.
- **R3–R5** Media/claim/translation/object mutations now fail loudly when RLS affects zero rows
  (the RLS "silent no-op" class) instead of returning a false success.
- **R6** New hardening test suite (above).

### Commands executed and actual results

| Command                 | Result                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `npm run lint`          | Passed                                                        |
| `npm run typecheck`     | Passed                                                        |
| `npm run format:check`  | Passed                                                        |
| `npm test`              | 136 tests passed (14 files; +10 vs Phase 6)                   |
| `npm run build`         | Succeeded; Proxy active, `/api/qr` + `/auth/callback` dynamic |
| Live `next start` probe | All four security headers present on `/en`                    |

### Known issues and limitations

- **Storage upload flow implemented**; its RLS and promotion lifecycle remain unverified against
  Supabase Storage (`security-audit.md` F1).
- **No Content-Security-Policy yet** — nonce-based CSP disables PPR, and generated HTML still has
  inline streaming scripts not covered by build-time SRI (ADR-032).
- **Rate limiting is partial** — analytics has a process-local quota; auth, QR, upload, and
  cross-instance limits still need a shared provider (F3).
- **Dev-only advisories** in the `eslint-config-next` chain remain (F2); 0 production vulnerabilities.
- **Supabase-native surfaces unverified locally** (F5); production checklist in
  `security-implementation.md` §3.3.

## Prerequisites for later phases

1. A Docker-capable environment (or hosted Supabase project) to validate migrations, storage policies,
   signed uploads, and the real auth flow.
2. **Q1** (production domain / QR base URL) resolved before QR distribution.
3. **Q2** (non-public media) decided before any restricted-media upload feature.
4. Supabase Auth redirect URLs and email templates configured for the deployment origin.

## Phase 8 — Analytics, Monitoring, and Performance: partially implemented

The Phase 9 audit originally found no Phase 8 work. Follow-up implementation added analytics
ingestion and reporting, retention aggregation/purge, tagged public caching, per-object metadata,
public church pages, `/api/health`, structured request-error logs, and media metadata extraction.
Production performance measurement, deployment alert configuration, and hosted Supabase/Storage
verification remain outstanding.

The implemented capabilities now include:

- analytics ingestion endpoint and service-role writer (FR-AN-1/4/5/6/8),
- analytics dashboard and reporting UI (FR-AN-5),
- cache-tag invalidation and per-object metadata, and
- public church pages.

The bundled historic reference section now includes five Egyptian sites: the Hanging Church, Abu
Serga, the Virgin Mary Church in Maadi, the Red Monastery in Sohag, and Deir al-Surian in Wadi
al-Natrun. These are sourced reference profiles, not a claim that every Egyptian church has been
catalogued or that any site is a platform partner. Individual icons still require item-level
documentation and church review before publication.

The requirement matrix has been refreshed for the follow-up features. Hosted behavior and
performance acceptance still require the deployment environment.

## Phase 9 — End-to-End Testing, QA, and Pilot Preparation: complete (with documented gaps)

Audited the implemented surface, built a requirement-to-test traceability matrix, added journey
tests at the data-access layer, added a gated browser E2E suite, ran accessibility/multilingual
review, and wrote a controlled pilot plan. Two defects were found; one was fixed.

### What was created

- **`docs/test-matrix.md`** — every requirement (`FR-CH/OB/ML/QR/PB/MD/AN`) mapped to its verifying
  test and an honest status (`Pass` / `Manual` / `Unverified` / `Not implemented`).
- **`docs/end-to-end-testing.md`** — the two-layer strategy, journeys, defects (D-1/D-2/D-3),
  fidelity limits, and CI integration notes.
- **`docs/accessibility-qa.md`** — automated structural checks, inspection findings, and open a11y
  items.
- **`docs/pilot-plan.md`** — a small, reversible pilot with placeholder institutional approvals and
  manual QR handling (no auto-printing).
- **`tests/integration/db/fake-supabase-client.ts`** — a minimal PostgREST-shaped adapter that lets
  the **real** DAL run against PGlite under RLS.
- **`tests/integration/db/journey-visitor.test.ts`** (12 tests) and
  **`tests/integration/db/journey-lifecycle.test.ts`** (13 tests) — Journeys A and C end-to-end.
- **`tests/e2e/*.spec.ts`** + **`playwright.config.ts`** — a gated browser suite (landing/localization,
  unknown-id handling, admin boundary, accessibility) that runs when `E2E_BASE_URL` is set and is
  skipped otherwise.

### Defects

- **D-2 (fixed).** `transition_object_status` did not clear `published_at` when moving
  `published → draft`, violating `objects_published_at_status_check` and making unpublish fail.
  Fixed in `supabase/migrations/20261019000005_functions_and_triggers.sql`; regression-tested.
- **D-1 / D-3 (implemented; runtime verification pending).** Proxy resolves configured QR IDs
  before PPR streaming: archived IDs return localized 410, while unknown, unpublished, and malformed
  IDs return localized 404. Bundled reference/demo IDs remain available without Supabase. The gated
  E2E status assertions are enabled; verify them against a configured Supabase project before
  production.

### Commands executed and actual results

| Command                                     | Result                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run lint`                              | Passed                                                                                                  |
| `npm run typecheck`                         | Passed                                                                                                  |
| `npm run format:check`                      | Passed                                                                                                  |
| `npm test`                                  | **161 tests passed (16 files; +25 vs Phase 7)**                                                         |
| `npm run build`                             | Succeeded; Proxy active; PPR routes prerendered                                                         |
| `npx playwright test` (with `E2E_BASE_URL`) | Historical run: **13 passed, 5 skipped** (at that time 2 status-defect `fixme`, 3 env-gated deep links) |
| `npx playwright test` (no `E2E_BASE_URL`)   | Suite skipped, exit 0                                                                                   |

### Known issues and limitations

- **Phase 8 follow-up is partially implemented** (analytics/reporting, caching, metadata, health and
  structured errors); hosted monitoring and production performance checks remain.
- **D-1/D-3** receive Proxy-level 410/404 responses (ADR-031); runtime status verification remains.
- The two status-defect E2E assertions are now enabled; they were not part of the historical result
  above and still need a rerun against configured Supabase/browser infrastructure.
- **Media upload transport and metadata extraction are implemented** but need Supabase-native
  verification and malformed/edge-case media fixture coverage.
- **Supabase-native surfaces unverified locally** (magic link, storage policies) — see
  `end-to-end-testing.md` §5.
- **Accessibility is structurally verified, not fully audited** (no axe/screen-reader/contrast pass).

## Recommended next work

Refresh the requirement-to-test matrix against the follow-up implementation, then verify auth,
Storage, analytics retention, and HTTP 404/410 behavior against a local or hosted Supabase stack.

# Test Matrix — Phase 9

Traceability from requirements (`docs/architecture/requirements.md`) to the tests that verify them,
and the honest status of each. **A requirement is only marked `Pass` when a test in this repository
actually exercises it and the suite is green.** Requirements that cannot be verified in this
environment are marked `Unverified` with the reason, or `Not implemented` when the feature is absent.

- **Current source checks (2026-11-08):** `npm run lint` and `npm run typecheck` pass. The QR
  status assertions were enabled after the 2026-10-20 E2E run and have not yet been rerun against a
  browser/Supabase instance, so those behaviors remain unverified at runtime.
- **Historical baseline (2026-10-20):** `npm run format:check` clean; `npm test` = **161 passed / 16
  files**; `npm run build` succeeded. Browser E2E was skipped by default without live Supabase.
- **Status legend**
  - `Pass` — covered by an automated test that is currently green.
  - `Manual` — verified by inspection/review rather than an automated assertion (e.g. header values).
  - `Unverified` — a test exists in principle but cannot run here (needs Docker/hosted Supabase).
  - `Not implemented` — the feature does not exist yet; no test can pass. See "Phase 8 gaps".
  - `N/A` — not applicable to this phase.

## Test layers

| Layer                | Location                                 | Runtime                                  | Requires                            |
| -------------------- | ---------------------------------------- | ---------------------------------------- | ----------------------------------- |
| Unit                 | `tests/unit/**`                          | Vitest (`node`)                          | nothing                             |
| Integration (DB)     | `tests/integration/db/**`                | Vitest + PGlite                          | nothing (in-process Postgres)       |
| Integration (DAL)    | `tests/integration/db/journey-*.test.ts` | Vitest + PGlite + fake PostgREST adapter | nothing                             |
| End-to-end (browser) | `tests/e2e/**`                           | Playwright                               | `E2E_BASE_URL` + live test Supabase |
| Manual / review      | see `docs/accessibility-qa.md`           | human                                    | running instance                    |

The DAL integration layer executes the **real** data-access functions
(`lib/db/objects.ts`) against the **real** migrations through a minimal PostgREST-shaped adapter
(`tests/integration/db/fake-supabase-client.ts`), with RLS applied via the `anon`/`authenticated`
roles. It is the strongest end-to-end verification possible without Docker or a hosted project.

---

## FR-CH — Churches

| Req     | Description                                                            | Verification                                                         | Status                                                  |
| ------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| FR-CH-1 | Church registered with unique slug, localized names, location metadata | schema.test.ts (tables/constraints); seed.sql                        | Pass (schema)                                           |
| FR-CH-2 | City/area granularity, optional coordinates                            | schema.test.ts                                                       | Pass                                                    |
| FR-CH-3 | Every object belongs to exactly one church (non-null FK)               | schema.test.ts; journey-visitor.test.ts                              | Pass                                                    |
| FR-CH-4 | Archiving a church cascades unpublish but preserves records            | `security.test.ts` (church cascade)                                  | Pass                                                    |
| FR-CH-5 | Denomination/rite, approximate founded date, district                  | schema.test.ts                                                       | Pass                                                    |
| FR-CH-6 | Cover image + external links                                           | Church manager, update action validation, public church DAL and page | Implemented / unverified (no media-backed Supabase run) |

## FR-OB — Objects

| Req     | Description                                         | Verification                                                                            | Status                 |
| ------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------- |
| FR-OB-1 | Stable public ID, generated once, never reused      | public-id.test.ts; generate-public-id.test.ts; schema.test.ts (immutability trigger)    | Pass                   |
| FR-OB-2 | Title, type, date, location, description, status    | schema.test.ts; journey-visitor.test.ts                                                 | Pass                   |
| FR-OB-3 | Optional fields empty → "unknown", never fabricated | journey-visitor.test.ts (null `approximateDate`/`locationInChurch` preserved)           | Pass                   |
| FR-OB-4 | Multiple images/audio/sources/translations          | journey-visitor.test.ts; schema.test.ts                                                 | Pass                   |
| FR-OB-5 | Verified vs uncertain/disputed at claim granularity | journey-visitor.test.ts (claim verification enum); validation/object-schemas.test.ts    | Pass                   |
| FR-OB-6 | Controlled object-type vocabulary                   | schema.test.ts (`objects_object_type_check`)                                            | Pass                   |
| FR-OB-7 | Dimensions, materials, condition notes              | schema.test.ts                                                                          | Pass                   |
| FR-OB-8 | Keyword search across object content internally     | `/admin/objects?q=…`; DAL searches translations, claims, identifiers, type and metadata | Manual (not automated) |
| FR-OB-9 | Archive (not delete) with reason                    | journey-lifecycle.test.ts (archive + reason); schema.test.ts                            | Pass                   |

## FR-ML — Multilingual & RTL

| Req     | Description                                                   | Verification                                                                            | Status                        |
| ------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------- |
| FR-ML-1 | Arabic + English                                              | i18n/languages.test.ts; schema.test.ts (languages seed); e2e public-navigation          | Pass                          |
| FR-ML-2 | Languages are data (table), no schema change to add one       | schema.test.ts; languages.test.ts                                                       | Pass                          |
| FR-ML-3 | Arabic RTL; layout adapts to `dir`                            | e2e public-navigation (skipped w/o live app); `app/[lang]/layout.tsx` sets `dir`        | Unverified (browser) / Manual |
| FR-ML-4 | Translations keyed by (entity, field, language); no overwrite | schema.test.ts (unique constraints); localization.test.ts                               | Pass                          |
| FR-ML-5 | Default-language fallback + visible notice + switch           | localization.test.ts; journey-visitor.test.ts (fallback flagged)                        | Pass                          |
| FR-ML-6 | Translation completeness tracked per object                   | schema.test.ts (`object_translation_status` view)                                       | Pass                          |
| FR-ML-7 | Dashboard highlights missing translations                     | `/admin/translations` groups gaps from `object_translation_status` for active languages | Manual                        |
| FR-ML-8 | Locale-prefixed URLs; QR token language-independent           | negotiate.test.ts; paths tests; journey-visitor.test.ts (locale-independent id)         | Pass                          |

## FR-QR — Public IDs & QR

| Req     | Description                                        | Verification                                                           | Status                        |
| ------- | -------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------- |
| FR-QR-1 | Permanent URL `/{lang}/o/{publicId}`               | e2e public-navigation; `app/[lang]/o/[publicId]/page.tsx`              | Unverified (browser) / Manual |
| FR-QR-2 | Opaque uppercase Crockford Base32, 10 chars, once  | public-id.test.ts; generate-public-id.test.ts; schema.test.ts          | Pass                          |
| FR-QR-3 | Editing never changes publicId                     | schema.test.ts (immutability trigger)                                  | Pass                          |
| FR-QR-4 | Rename/move keeps publicId; slugs redirect         | schema.test.ts (alias table); journey-visitor.test.ts (alias resolves) | Pass (alias)                  |
| FR-QR-5 | Archived → 410 Gone neutral page                   | Proxy public resolver; runtime status requires Supabase-backed probe   | Implemented / unverified      |
| FR-QR-6 | Retired IDs recorded in alias table, never reused  | schema.test.ts; journey-visitor.test.ts (alias resolution)             | Pass                          |
| FR-QR-7 | QR target language-agnostic; middleware negotiates | negotiate.test.ts                                                      | Pass                          |
| FR-QR-8 | QR generation/export (PNG/SVG, print-ready)        | qr/qr.test.ts; `app/api/qr/[publicId]/route.ts`                        | Pass                          |
| FR-QR-9 | Offline-tolerant, server-rendered, cache-friendly  | `cacheComponents`; Manual                                              | Manual                        |

## FR-PB — Publication workflow

| Req      | Description                                        | Verification                                                  | Status |
| -------- | -------------------------------------------------- | ------------------------------------------------------------- | ------ |
| FR-PB-1  | Five statuses                                      | schema.test.ts (enum labels)                                  | Pass   |
| FR-PB-2  | Editor draft → historical_review                   | journey-lifecycle.test.ts                                     | Pass   |
| FR-PB-3  | Reviewer historical_review → church_review / draft | journey-lifecycle.test.ts                                     | Pass   |
| FR-PB-4  | Approver church_review → published / draft         | journey-lifecycle.test.ts                                     | Pass   |
| FR-PB-5  | Approver/admin published → draft / archived        | journey-lifecycle.test.ts                                     | Pass   |
| FR-PB-6  | Immutable publication_history per transition       | journey-lifecycle.test.ts                                     | Pass   |
| FR-PB-7  | Immutable review_records per decision              | journey-lifecycle.test.ts                                     | Pass   |
| FR-PB-8  | Content editable only in draft                     | `can_write_object_content`; security.test.ts                  | Pass   |
| FR-PB-9  | DB cannot publish without historical review        | journey-lifecycle.test.ts (illegal transition refused)        | Pass   |
| FR-PB-10 | "Changes requested" notes before re-submission     | journey-lifecycle.test.ts (notes required when not approving) | Pass   |

## FR-MD — Media

| Req              | Description                                                  | Verification                                                                                     | Status                   |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------ |
| FR-MD-1          | Images + optional audio                                      | mime.test.ts; schema.test.ts (enums)                                                             | Pass (validation)        |
| FR-MD-2          | Media metadata separate from object                          | schema.test.ts                                                                                   | Pass                     |
| FR-MD-3          | Localized caption/alt, copyright, attribution, permission    | ObjectEditor rights and per-language media forms; journey-visitor.test.ts                        | Manual / schema          |
| FR-MD-4          | Explicit permission status; only publishable media public    | journey-visitor.test.ts (filter); schema.test.ts (`media_publish_gate_check`)                    | Pass                     |
| FR-MD-5          | Server-side MIME/extension/size validation                   | mime.test.ts                                                                                     | Pass (validation)        |
| FR-MD-6          | Responsive variants/thumbnails server-side                   | Supabase transform `srcset` widths + 320px thumbnail helper; hosted transform needs verification | Implemented / unverified |
| FR-MD-7          | Stable, editable media ordering                              | journey-visitor.test.ts (sort_order); schema.test.ts                                             | Pass                     |
| FR-MD-8          | Flag media lacking permission before publication             | schema.test.ts (gate check)                                                                      | Pass                     |
| FR-MD-9 (upload) | Authenticated upload, private staging, validation, promotion | `/api/media/upload`, ObjectEditor; live Storage verification required                            | Manual / unverified      |

## FR-AN — Analytics (Phase 8 — see gaps)

| Req     | Description                                       | Verification                                                | Status                   |
| ------- | ------------------------------------------------- | ----------------------------------------------------------- | ------------------------ |
| FR-AN-1 | Record page views / language / audio engagement   | Client events + `/api/analytics`; live DB ingest unverified | Implemented / unverified |
| FR-AN-2 | No visitor accounts; no cookies for core function | Manual (magic-link admin only; RLS)                         | Manual                   |
| FR-AN-3 | No precise location/IP/name/email/fingerprint     | Manual (design)                                             | Manual                   |
| FR-AN-4 | Rotating salted non-reversible session hash       | Monthly HMAC session hash; operation unverified             | Implemented / unverified |
| FR-AN-5 | Aggregate by object/church/language/day           | Admin report + daily aggregation migration                  | Implemented / unverified |
| FR-AN-6 | Raw 90-day retention; aggregates indefinite       | Retention RPC + scheduled route; deployment cron unverified | Implemented / unverified |
| FR-AN-7 | Respect DNT/GPC                                   | Client and ingestion endpoint opt-out checks                | Manual                   |
| FR-AN-8 | Ingestion resilient; never blocks rendering       | Fire-and-forget client submission                           | Manual                   |

---

## Cross-cutting security & authorization

| Area                                       | Verification                                                          | Status           |
| ------------------------------------------ | --------------------------------------------------------------------- | ---------------- |
| RLS hides drafts/sensitive rows from anon  | security.test.ts; security-hardening.test.ts; journey-visitor.test.ts | Pass             |
| Role/scope guards on every mutation        | phase6-authorization.test.ts; security-hardening.test.ts              | Pass             |
| RLS silent no-op treated as failure        | security-hardening.test.ts; `lib/actions/{media,sources,objects}.ts`  | Pass             |
| Status only via `transition_object_status` | journey-lifecycle.test.ts (guard trigger); schema.test.ts             | Pass             |
| Security headers                           | Four baseline headers by config inspection; no CSP (ADR-032)          | Manual / Partial |
| QR route does not echo internal errors     | qr/qr.test.ts; Manual                                                 | Pass / Manual    |
| `sanitizeNextPath` (open-redirect guard)   | auth/sanitize-next-path.test.ts                                       | Pass             |
| Mass-assignment protection in validation   | validation/object-schemas.test.ts                                     | Pass             |

---

## Known gaps and defects

- **D-1 / D-3 (implemented; runtime verification pending):** Proxy resolves QR IDs before the PPR
  shell streams; archived IDs return HTTP 410 and unknown/unpublished IDs return HTTP 404. Verify
  both statuses against a configured Supabase project.
- **D-2 (defect, fixed this phase):** `transition_object_status` failed to clear `published_at` when
  moving `published → draft`, violating `objects_published_at_status_check`. Fixed in
  `supabase/migrations/20261019000005_functions_and_triggers.sql`; covered by
  `journey-lifecycle.test.ts`.
- **G-1 (Phase 8 follow-up):** Analytics, public caching, metadata, church pages, readiness and
  structured request-error logging are implemented. Deployment alerts and production performance
  measurement remain; hosted analytics/cron behavior is unverified.
- **G-2 (media upload):** Authenticated multipart upload, private staging, publication-time
  promotion, and byte-level image dimension/audio duration extraction are implemented. Live Storage
  behavior and malformed/edge-case metadata fixtures remain unverified.
- **G-3 (browser E2E not executable here):** No Docker/WSL/hosted Supabase, no Playwright browsers
  installed. The Playwright suite is present and gated; it runs where a live test project is provided.

## How to run

```bash
npm test                 # unit + DB + DAL integration (needs nothing)
npm run test:e2e:install # one-time: download the Chromium browser
npm run test:e2e         # skipped unless E2E_BASE_URL is set
E2E_BASE_URL=http://localhost:3000 E2E_PUBLISHED_PUBLIC_ID=<id> npm run test:e2e
```

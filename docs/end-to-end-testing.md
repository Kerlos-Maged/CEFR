# End-to-End Testing — Phase 9

How the platform's most important journeys are verified, what was found, what was fixed, and what
remains open. Companion to [`test-matrix.md`](test-matrix.md) (requirement traceability).

## 1. Strategy

There is no Docker, WSL, or hosted Supabase project available in this environment, so a full
browser journey backed by real Auth + Storage cannot run here. Rather than skip verification
entirely, the journeys are verified at **two layers**, with the strong layer running everywhere:

| Layer                                                             | What it proves                                                                                                                                                          | Runs when             |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **DAL/DB integration** (`tests/integration/db/journey-*.test.ts`) | The real public data-access functions (`lib/db/objects.ts`), the real transition functions, the real RLS policies, and the real migrations behave correctly end-to-end. | Always (`npm test`)   |
| **Browser E2E** (`tests/e2e/*.spec.ts`)                           | The rendered pages, routing, locale direction, status codes, and access redirects.                                                                                      | `E2E_BASE_URL` is set |

The integration layer executes the **real** DAL against the **real** schema by wrapping PGlite
(PostgreSQL compiled to WASM) in a minimal PostgREST-shaped client
(`tests/integration/db/fake-supabase-client.ts`). Queries run under the `anon`/`authenticated`
roles via `harness.asRole`, so Row Level Security applies exactly as in production. This is the
strongest fidelity available without a container runtime.

## 2. Journeys covered

### Journey A — Visitor scans a QR code

`tests/integration/db/journey-visitor.test.ts` (12 tests) + `tests/e2e/public-navigation.spec.ts`,
`accessibility.spec.ts`.

- A published id resolves to `available` with its canonical id; an alias resolves to the canonical
  id (FR-QR-4/6).
- Archived ids resolve to `gone`; draft/review states resolve to nothing (indistinguishable from
  unknown, so in-progress work is never confirmed to the public) (FR-QR-5, §security-and-permissions).
- The published object loads with its **locale** translation, correct fallback flag, only
  permission-cleared media, and only public claims.
- The public page renders the site shell, honours `dir=rtl` for Arabic, localises strings, and the
  language switch works.

### Journey C — Editorial lifecycle

`tests/integration/db/journey-lifecycle.test.ts` (13 tests).

Walks a real object from `draft → historical_review → church_review → published`, cross-checking at
each step that the **visitor** sees (or does not see) the object through the real public DAL, then
`published → draft → published → archived`. Asserts:

- Every transition is owned by the correct role; an outsider and a wrong-role actor are refused.
- Publishing is **exclusively** the church approver's decision — a platform admin is refused
  (FR-PB-4, Q6).
- Direct `UPDATE` of `objects.status` is rejected by the guard trigger (status only via the function).
- `publication_history` records the full trail; `review_records` records each decision; notes are
  required when a decision is not an approval.
- An illegal transition (`historical_review → published`) is refused.

### Journey D — Admin boundary

`tests/e2e/admin-guard.spec.ts`.

- An unauthenticated visitor to `/admin` is redirected to the sign-in page (with `?next=/admin`, or
  `?error=config` when Supabase is unconfigured).
- The sign-in form renders a labelled email input and submit button.
- Unknown admin sub-paths 404.

### Journey E — Analytics & monitoring

**Not executable.** Phase 8 was never implemented (see `test-matrix.md` G-1); there is no ingestion
endpoint, dashboard, or monitoring integration to test. Documented, not fabricated.

## 3. Running the suites

```bash
# Always available — unit + DB + DAL integration:
npm test

# Browser E2E — one-time browser install:
npm run test:e2e:install

# Browser E2E against a running app. Without E2E_BASE_URL the suite is skipped:
E2E_BASE_URL=http://localhost:3000 E2E_WEB_SERVER=1 npm run test:e2e

# Full fidelity: point E2E_BASE_URL at an instance backed by a *test* Supabase project, and
# provide seeded ids so the deep-link checks run:
E2E_BASE_URL=https://pilot.example E2E_PUBLISHED_PUBLIC_ID=AB12CD34EF E2E_ARCHIVED_PUBLIC_ID=CD78EF90GH npm run test:e2e
```

`E2E_WEB_SERVER=1` lets Playwright build-and-start the app itself; omit it to test an instance you
started yourself.

## 4. Defects found

### D-2 — `published → draft` violated a check constraint (FIXED)

**Symptom:** Unpublishing a live object raised
`new row for relation "objects" violates check constraint "objects_published_at_status_check"`.

**Root cause:** `public.transition_object_status()` set `published_at` on publish but never cleared
it, while `objects_published_at_status_check` requires `published_at IS NULL` whenever the status is
not `published`/`archived`.

**Fix:** The transition now clears `published_at` for any target other than `published`/`archived`
(keeping it for `archived` so the historical publish date is preserved). See
`supabase/migrations/20261019000005_functions_and_triggers.sql`.

**Regression coverage:** `tests/integration/db/journey-lifecycle.test.ts` ("hides the object again
as soon as it is unpublished to draft").

### D-3 — `notFound()` inside a Suspense boundary cannot set HTTP 404 (implemented; runtime check pending)

**Symptom:** PPR can commit an object page's shell before the asynchronous object lookup finishes,
which previously caused unknown object ids to return HTTP 200.

**Root cause:** `app/[lang]/o/[publicId]/page.tsx` calls `notFound()` from inside `ObjectContent`,
which is wrapped in `<Suspense>`. With Partial Prerendering (`cacheComponents: true`) the response
status is committed as soon as the static shell is flushed, before the streamed content resolves,
so a later `notFound()` cannot change the status.

**Implementation:** `proxy.ts` now resolves each QR id before the page shell streams. A successful
resolver lookup with no published or archived row returns a neutral HTTP 404. Resolver failures
continue to the page path to avoid replacing an available published page during a transient outage.
Supabase-backed runtime verification is still pending.

**Options considered before the fix:**

1. Resolve the id **before** the Suspense boundary (e.g. in a `proxy.ts`/route handler that returns
   `notFound()`/410, or by awaiting resolution in the page component outside `<Suspense>`).
2. Return an explicit `Response` with the desired status from a route segment rather than relying on
   `notFound()`.
3. Accept PPR's 200-with-notice behaviour as a documented, deliberate trade-off.

The chosen implementation is recorded in ADR-031.

### D-1 — Archived objects return 200, not 410 (implemented; runtime check pending)

`proxy.ts` returns a neutral localized HTTP 410 before the page boundary. The gated browser suite
contains the status check; a live Supabase-backed run remains pending.

## 5. Fidelity limits (unverifiable here)

These require Docker or a hosted project and are recorded as production-checklist items, not test
results:

- Real magic-link sign-in and the `/auth/callback` exchange.
- Session cookie rotation via `proxy.ts`.
- Storage bucket policies, signed uploads, and the `incoming → object-media` promotion.
- `supabase db reset` / `supabase test db` / `supabase gen types --local`.

MIME/size **validation** and URL construction are covered by unit tests; only the transport is
unverified.

## 6. CI

`.github/workflows/ci.yml` runs `lint → typecheck → test → build` and stays green without secrets
because the browser E2E suite self-skips when `E2E_BASE_URL` is absent. To enable it in CI, add a
job that provisions a Supabase test project, seeds it, exports `E2E_BASE_URL` and the seeded ids,
installs the browser (`npx playwright install --with-deps chromium`), and runs `npm run test:e2e`.

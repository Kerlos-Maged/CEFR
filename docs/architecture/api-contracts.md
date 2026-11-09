# API Contracts

> Document: `api-contracts.md`
> Status: Phase 1 — approved for implementation planning
> Related: [`requirements.md`](./requirements.md), [`architecture.md`](./architecture.md), [`database-schema.md`](./database-schema.md), [`security-and-permissions.md`](./security-and-permissions.md)

---

## 1. Overview

The platform exposes two interaction surfaces:

1. **Server Actions** — the primary mutation/query mechanism for the Next.js app
   (`lib/actions/*`). Typed, validated, authorize-then-execute. Preferred over REST for
   app-internal operations.
2. **Route Handlers** — for cases that must be HTTP endpoints: analytics ingest (beacon),
   QR export (binary), and media upload signing/orchestration.

Public **read** access uses Server Components querying the DAL directly (no HTTP API needed).
There is intentionally **no public write API** and **no public REST for drafts**.

All inputs validated with zod. All mutations authorize server-side and are re-checked by RLS.

---

## 2. Common Conventions

- **Result type** for server actions:
  ```ts
  type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: ErrorCode; message: string; fieldErrors?: Record<string,string[]> } };
  ```
- **Error codes:** `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`,
  `ILLEGAL_TRANSITION`, `RATE_LIMITED`, `INTERNAL`.
- **Route handler error envelope:**
  ```json
  { "error": { "code": "FORBIDDEN", "message": "Not permitted" } }
  ```
- **IDs:** `object_id`/`church_id` are UUIDs; `public_id` is 10-char Crockford Base32.
- **Idempotency:** create actions accept an optional `Idempotency-Key` where risk of double-submit
  exists (e.g. object creation); the client form disables on submit.
- **Language:** all user-facing strings validated against `languages.code`.

---

## 3. Public Read (Server Components / DAL)

No HTTP contract; DAL functions and their guarantees:

| DAL function | Input | Returns | Guarantee |
| --- | --- | --- | --- |
| `getPublishedObjectByPublicId(publicId, locale)` | `public_id`, locale | object + translations + public media + public claims + sources, or `null` | Only `status='published'`, church active; locale falls back to `default_language` |
| `resolvePublicId(publicId)` | any public id or alias | `{ objectId, canonicalPublicId } \| null` | Follows `object_aliases`; distinguishes 404 vs 410 (`archived`) |
| `getChurchBySlug(slug, locale)` | slug, locale | church + published objects | published only |
| `getTranslationStatus(objectId)` | uuid | per-language availability/completeness | admin only |

Public pages must import only these gated functions; the caching layer applies tags
`object:{publicId}` / `church:{slug}`.

---

## 4. Server Actions — Churches

### 4.1 `createChurch(input)`
- **Auth:** platform admin.
- **Input:** `{ slug, name, default_language, city?, district?, latitude?, longitude?, rite? }`
- **Output:** `{ church_id }`
- **Errors:** `VALIDATION` (slug format/duplicate), `FORBIDDEN`.
- **Side effects:** insert `churches`; insert `church_translations` for the default language.

### 4.2 `updateChurch(churchId, input)`
- **Auth:** platform admin.
- **Input:** partial church metadata.
- **Errors:** `NOT_FOUND`, `VALIDATION`, `FORBIDDEN`.

### 4.3 `archiveChurch(churchId, notes)`
- **Auth:** platform admin.
- **Behavior:** set church `archived`; archive its objects **and** unpublish them in one
  transaction; write history.
- **Errors:** `NOT_FOUND`, `CONFLICT` (already archived).

### 4.4 `upsertChurchTranslation(churchId, languageCode, input)`
- **Auth:** platform admin.
- **Input:** `{ name, description? }`
- **Errors:** `VALIDATION` (inactive language), `FORBIDDEN`.

---

## 5. Server Actions — Objects and Content

### 5.1 `createObject(input)`
- **Auth:** editor (church-scoped) or admin.
- **Input:**
  ```ts
  {
    church_id: string;            // must be one of my memberships
    object_type: ObjectType;
    default_language: string;     // active language
    approximate_date?: string;
    location_in_church?: string;
    materials?: string;
    dimensions?: string;
    title: string;                // default-language title
    description?: string;
  }
  ```
- **Output:** `{ object_id, public_id }`
- **Behavior:** generate unique `public_id`; insert object (`status='draft'`) + default-language
  translation; insert `publication_history` (to `draft`).
- **Errors:** `FORBIDDEN` (not editor for church), `VALIDATION`.

### 5.2 `updateObject(objectId, input)`
- **Auth:** editor of the object's church; object must be `draft`.
- **Input:** partial editable fields (not `status`, not `church_id`, not `public_id`).
- **Errors:** `FORBIDDEN`, `CONFLICT` (not draft), `VALIDATION`.

### 5.3 `upsertObjectTranslation(objectId, languageCode, input)`
- **Auth:** editor of the object's church; object `draft`.
- **Input:** `{ title, description?, is_complete? }`
- **Errors:** `FORBIDDEN`, `VALIDATION` (inactive language), `CONFLICT`.

### 5.4 `deleteObjectTranslation(objectId, languageCode)`
- **Auth:** editor; `draft`; cannot delete the `default_language` translation if it is the only one.
- **Errors:** `CONFLICT`, `FORBIDDEN`.

### 5.5 Claims and sources
- `createClaim(objectId, { claim_text, claimed_value?, verification?, is_public? })` — editor
  (`draft`); default `verification='uncertain'`.
- `setClaimVerification(claimId, { verification, notes? })` — historical reviewer of the object's
  church (allowed regardless of draft, but changes affect publication review).
- `deleteClaim(claimId)` — editor (`draft`) or admin.
- `createSource({ title, author?, year?, citation?, url?, source_type? })` — editor/reviewer of a
  church that references it.
- `linkClaimSource(claimId, sourceId, note?)` / `unlinkClaimSource(...)`,
  `linkObjectSource(objectId, sourceId, note?)` / `unlinkObjectSource(...)`.
- All: `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`.

---

## 6. Server Actions — Workflow

### 6.1 `submitForReview(objectId, notes?)`
- **Auth:** editor of the object's church.
- **Preconditions:** `status='draft'`; ≥1 translation (default language present with `title`).
- **Behavior:** `transition_object_status(objectId, 'historical_review')`.
- **Errors:** `CONFLICT` (not draft), `VALIDATION` (missing required translation),
  `ILLEGAL_TRANSITION`, `FORBIDDEN`.

### 6.2 `reviewHistorical(objectId, decision, notes?)`
- **Auth:** historical reviewer of the object's church.
- **Input:** `decision ∈ { approved, rejected, changes_requested }`; `notes` required if not
  approved.
- **Behavior:** insert `review_records(type='historical_review')`; on `approved` →
  `church_review`; on reject/changes → `draft`.
- **Errors:** `CONFLICT` (not in `historical_review`), `VALIDATION`, `FORBIDDEN`,
  `ILLEGAL_TRANSITION`.

### 6.3 `decideChurchApproval(objectId, decision, notes?)`
- **Auth:** church approver of the object's church.
- **Input:** `decision ∈ { approved, rejected, changes_requested }`.
- **Behavior:** insert `review_records(type='church_approval')`; on `approved` →
  `transition_object_status(objectId,'published')`; otherwise → `draft`.
- **Postcondition:** `revalidateTag('object:{publicId}')`.
- **Errors:** `CONFLICT`, `VALIDATION`, `FORBIDDEN`, `ILLEGAL_TRANSITION`.

### 6.4 `unpublishObject(objectId, notes)` / `archiveObject(objectId, reason)`
- **Auth:** church approver or platform admin.
- **Behavior:** `transition_object_status` to `draft` / `archived`; revalidate cache.
- **Errors:** `CONFLICT`, `FORBIDDEN`.

---

## 7. Server Actions / Handlers — Media

### 7.1 `requestMediaUpload(input)` (server action)
- **Auth:** editor of the target object's church; object `draft`.
- **Input:** `{ object_id, media_type, filename, content_type, size_bytes }`
- **Behavior:** validate declared type/size; issue a **signed upload URL** to `incoming` bucket
  with a server-generated UUID path; return `{ upload_url, path, token }`.
- **Errors:** `VALIDATION` (type/size not allowed), `FORBIDDEN`.

### 7.2 `POST /api/media/upload` (route handler — finalize)
- **Auth:** session + editor role (verified from the referenced pending upload).
- **Input (JSON):** `{ object_id, path, media_type, copyright_holder?, attribution?,
  permission_status? }`
- **Behavior:** server fetches the staged object, validates MIME magic bytes + size + dimensions;
  generates variants/thumbnails; moves to `object-media`; inserts `media` row
  (`is_public=false`, `sort_order` appended).
- **Output:** `{ media_id }`.
- **Errors:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`.

### 7.3 `upsertMediaTranslation(mediaId, languageCode, { caption, alt_text })`
- **Auth:** editor of the object's church; `draft`.
- **Errors:** `VALIDATION`, `FORBIDDEN`.

### 7.4 `setMediaPublication(mediaId, { is_public })`
- **Auth:** editor (draft) or approver (pre-publish validation).
- **Rule:** `is_public=true` requires `permission_status ∈ {granted, public_domain}` and, for
  images, alt text present for the default language.
- **Errors:** `VALIDATION`, `CONFLICT`, `FORBIDDEN`.

### 7.5 `reorderMedia(objectId, orderedMediaIds)`
- **Auth:** editor (`draft`).
- **Errors:** `VALIDATION`, `FORBIDDEN`.

---

## 8. Route Handlers

### 8.1 `POST /api/analytics`
- **Auth:** none (anonymous).
- **Input (JSON, max ~2 KB):**
  ```ts
  {
    event_type: 'page_view' | 'language_select' | 'audio_play' | 'audio_complete';
    public_id?: string;         // resolved server-side to object_id
    language_code?: string;
    referrer_type?: 'qr' | 'direct' | 'internal' | 'external';
  }
  ```
- **Behavior:** validate; derive `object_id`/`church_id` from `public_id` server-side; compute
  `session_hash` from salted, rotating source, **discarding** raw IP after hashing; insert with
  service-role client. Always returns `204`, even on internal failure (never blocks the visitor).
- **Errors:** `VALIDATION` → `400` with envelope; `RATE_LIMITED` → `429`.
- **Privacy:** no IP, UA string, or precise location persisted.

### 8.2 `GET /api/qr/[objectId]?format=png|svg&lang=ar|en`
- **Auth:** editor or approver of the object's church, or admin.
- **Output:** QR image encoding `https://{NEXT_PUBLIC_SITE_URL}/o/{public_id}`
  (language-independent; optional `download=1` sets `Content-Disposition`).
- **Errors:** `FORBIDDEN`, `NOT_FOUND`.

### 8.3 `GET /auth/callback`
- **Auth:** none.
- **Behavior:** exchanges the Supabase auth code for a session, sets cookies, redirects to the
  `redirect_to` target (validated to same-origin paths only).
- **Errors:** invalid code → redirect to sign-in with a generic message.

### 8.4 `POST /auth/signout`
- **Auth:** session.
- **Behavior:** clears session; redirects to `/`.

---

## 9. Admin Management Actions (platform admin)

| Action | Input | Output |
| --- | --- | --- |
| `inviteUser({ email, display_name })` | email/name | `{ user_id }` (magic link sent) |
| `grantMembership({ user_id, church_id, role })` | ids | `{ membership_id }` |
| `revokeMembership({ membership_id })` | id | `void` |
| `setPlatformAdmin({ user_id, value })` | id/bool | `void` |
| `upsertLanguage({ code, name, native_name, direction, is_active })` | fields | `void` |
| `setDefaultLanguage({ code })` | code | `void` (platform default) |

All require `is_platform_admin`; all errors include `FORBIDDEN`.

---

## 10. HTTP Status / Error Mapping

| Code | HTTP | When |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | no/expired session on protected action |
| `FORBIDDEN` | 403 | authenticated but lacks role/scope |
| `NOT_FOUND` | 404 | object/church/id missing or not visible |
| `VALIDATION` | 422 | schema/constraint failure |
| `CONFLICT` | 409 | state precondition failed (e.g. not draft) |
| `ILLEGAL_TRANSITION` | 409 | disallowed workflow transition |
| `RATE_LIMITED` | 429 | quota exceeded |
| `INTERNAL` | 500 | unexpected server error (generic message) |

Server actions surface the same codes in `ActionResult.error.code`; the UI maps them to messages.

---

## 11. Versioning and Stability

- Server actions are internal and evolve with the app; no public versioning.
- Route handlers under `/api/*` are versioned by contract stability; breaking changes require a
  new path (e.g. `/api/v2/analytics`) and a deprecation window.
- The QR URL contract (`/o/{publicId}`) is **permanent** and never versioned or changed.

---

## 12. Open Questions

- **Q6** if admin publish override is approved, add `adminOverridePublish(objectId, reason)` with
  mandatory audit notes.
- **Q2** if non-public media is required, replace public CDN delivery with
  `GET /api/media/[id]` issuing short-lived signed redirects.

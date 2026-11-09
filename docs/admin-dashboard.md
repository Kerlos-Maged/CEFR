# Admin Dashboard and CMS

> Document: `admin-dashboard.md`
> Status: Phase 6 — implemented
> Related: [`editorial-workflow.md`](editorial-workflow.md), [`permissions-and-roles.md`](permissions-and-roles.md),
> [`architecture/api-contracts.md`](architecture/api-contracts.md)

The administrative CMS lets authorized church staff author heritage objects, manage translations,
media, claims and sources, run the editorial workflow, and export QR codes. It is a Next.js App
Router area protected by Supabase Auth and Row Level Security.

---

## 1. Access model

- **Sign-in:** email magic link (no passwords). A user enters their email at `/en/login` or
  `/ar/login`; the callback at `/auth/callback` exchanges the code for a session cookie.
- **Session:** HTTP-only cookies managed by `@supabase/ssr`; refreshed on every request in
  `proxy.ts`. Identity is always taken from the **server-verified** `auth.getUser()` result.
- **Guarding:** `app/[lang]/admin/layout.tsx` redirects unauthenticated users to the localized login
  and shows a neutral "no access" page to signed-in users without a role.
- **Scope:** the UI shows only the churches the user is a member of; administrators see everything.

### Local demo accounts

`supabase/seed.sql` creates fictional, local-only identities for exercising the role-based admin UI.
There are no passwords: request a magic link from the local Supabase mail catcher.

| Email                  | Access                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `editor@example.com`   | Editor for the seeded Demo Church; create and edit drafts.                                           |
| `reviewer@example.com` | Historical reviewer for the Demo Church.                                                             |
| `approver@example.com` | Church approver for the Demo Church.                                                                 |
| `admin@example.com`    | Platform administrator; all admin sections, including users, churches, languages, and audit history. |

Start local Supabase, reset its database to apply the fictional seed, run the Next.js app with the
local API URL and anonymous key, then visit `/en/login`. Open Supabase Inbucket at
`http://127.0.0.1:54324` and follow the newest sign-in email. These identities must only be used
with the local Supabase stack; do not apply the local seed to a hosted project.

Routes:

| Path                         | Purpose                                     |
| ---------------------------- | ------------------------------------------- |
| `/{lang}/admin`              | Dashboard (status counts, shortcuts)        |
| `/{lang}/admin/objects`      | Object list                                 |
| `/{lang}/admin/objects/new`  | Create a draft                              |
| `/{lang}/admin/objects/{id}` | Object editor                               |
| `/{lang}/admin/review`       | Review queue (historical + church approval) |
| `/{lang}/admin/sources`      | Scholarly sources                           |
| `/{lang}/admin/churches`     | Churches (read-only; platform admin)        |
| `/{lang}/admin/users`        | Users & memberships (platform admin)        |

---

## 2. Authentication flow

```
browser                     app                          supabase
   │  POST magic link  ─────▶ (anon key, signInWithOtp) ──▶ email
   │                          /auth/callback?code=...&next=/admin&lang=en
   │  click link  ──────────▶ exchangeCodeForSession ────▶ session cookie
   │                          redirect to localized next  (validated same-origin)
```

- `next` is sanitized to a same-origin, root-relative path (`sanitizeNextPath`), preventing open
  redirects.
- Sign-out (`signOut` server action) revokes the session and clears cookies.

---

## 3. Object editor

The editor (`components/admin/object-editor.tsx`) renders role-appropriate controls:

- **Details** — editable only while the object is a `draft` in the user's church; otherwise read-only.
- **Translations** — per-language title/description and a completeness flag.
- **Media** — inventory with licence status and a publish/unpublish toggle (publish requires granted
  rights + alt text for images).
- **Historical claims** — with reviewer-only verification controls.
- **Sources** — linked scholarly references.
- **Publication history & review records** — the append-only audit trail.
- **QR links** — for published objects only.

Status is **never** a form field: it changes only through workflow buttons wired to the transition
RPCs (see [`editorial-workflow.md`](editorial-workflow.md)).

---

## 4. Server actions

All mutations are server actions in `lib/actions/`:

| File            | Actions                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `objects.ts`    | `createObject`, `updateObject`, `upsertObjectTranslation`, `deleteObjectTranslation`, `deleteObject` |
| `workflow.ts`   | `submitForReview`, `recordReviewDecision`, `unpublishObject`, `archiveObject`, `returnToDraft`       |
| `sources.ts`    | `createClaim`, `setClaimVerification`, `deleteClaim`, `createSource`, `linkSource`                   |
| `media.ts`      | `registerMedia`, `upsertMediaTranslation`, `setMediaPublication`, `deleteMedia`                      |
| `membership.ts` | `grantMembership`, `revokeMembership`, `setPlatformAdmin`                                            |
| `auth.ts`       | `signOut`, `assertSignedIn`                                                                          |

Conventions:

- Each action validates with a **strict** zod schema (protected fields are absent and therefore
  rejected), re-checks the session/role, executes with the user-scoped client, and returns the shared
  `ActionResult` envelope.
- Database errors are mapped to `DalError` codes (`FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
  `ILLEGAL_TRANSITION`, …); unexpected errors collapse to a generic `INTERNAL` message so no stack
  trace or SQL detail reaches the client.

---

## 5. QR export

`GET /api/qr/[publicId]?format=svg|png&download=1` renders the permanent `/o/{publicId}` URL as a QR
code. Authorization: platform admin, or editor/approver of the object's church. Only **published**
objects are eligible (`404` otherwise). Built on `lib/qr/index.ts` (pure URL builder + `qrcode`).

---

## 6. Data access

`lib/admin/data.ts` provides RLS-scoped reads (object lists/details, dashboard counts, review queues,
churches, users). Queries run with the caller's session, so RLS decides visibility — there is no
ad-hoc filter that could be bypassed by reusing the same code with a different client.

---

## 7. Known gaps

- **Media upload** now uses authenticated multipart submission, private staging, server byte
  verification, checksum registration, and a publication-time copy to the public bucket. It needs
  verification against Supabase Storage.
- **Supabase-native verification** (real auth, storage policies, cookie refresh) could not run locally; the
  authorization boundary is proven at the RLS/RPC layer via the PGlite suite.
- **Platform audit history** (`/[lang]/admin/audit`) combines the latest administrative, review,
  and publication events across churches. Access is platform-admin-only; deployment data is needed
  to verify the live queries and recorded event coverage.
- Arabic admin copy needs native-speaker review.

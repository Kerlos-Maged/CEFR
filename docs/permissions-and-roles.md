# Permissions and Roles

> Document: `permissions-and-roles.md`
> Status: Phase 6 — implemented
> Related: [`architecture/security-and-permissions.md`](architecture/security-and-permissions.md),
> [`architecture/api-contracts.md`](architecture/api-contracts.md), [`editorial-workflow.md`](editorial-workflow.md)

This document describes **who can do what** in the Coptic Heritage Digital Platform, how the
application enforces it, and how the database independently guarantees it.

---

## 1. Roles

| Role                    | Scope                   | Stored as                                         |
| ----------------------- | ----------------------- | ------------------------------------------------- |
| Public visitor (`anon`) | global, unauthenticated | no account                                        |
| Content editor          | per church              | `church_memberships.role = 'editor'`              |
| Historical reviewer     | per church              | `church_memberships.role = 'historical_reviewer'` |
| Church approver         | per church              | `church_memberships.role = 'church_approver'`     |
| Platform administrator  | global                  | `profiles.is_platform_admin = true`               |

A user may hold multiple memberships across churches. Platform admin is independent of church roles.
There is **no public registration of privileged access**: new users are invited and authorized by a
platform admin; self sign-up grants no roles.

---

## 2. Permission matrix

Legend: ✅ allowed · ❌ denied · 🔶 allowed with restrictions.

| Resource / action                     | Public | Editor                 | Hist. reviewer | Church approver | Platform admin       |
| ------------------------------------- | ------ | ---------------------- | -------------- | --------------- | -------------------- |
| Read published object content         | ✅     | ✅                     | ✅             | ✅              | ✅                   |
| Read draft / in-review object         | ❌     | 🔶 own church          | 🔶 own church  | 🔶 own church   | ✅ all               |
| Create object (draft only)            | ❌     | 🔶 own church          | ❌             | ❌              | ✅                   |
| Update object fields                  | ❌     | 🔶 own church, `draft` | ❌             | ❌              | ✅                   |
| Add/edit translations                 | ❌     | 🔶 own church, `draft` | ❌             | ❌              | ✅                   |
| Add/edit claims & sources             | ❌     | 🔶 own church, `draft` | 🔶 own church  | ❌              | ✅                   |
| Set claim verification                | ❌     | ❌                     | 🔶 own church  | ❌              | ✅                   |
| Register/manage media                 | ❌     | 🔶 own church, `draft` | ❌             | ❌              | ✅                   |
| Submit `draft → historical_review`    | ❌     | 🔶 own church          | ❌             | ❌              | ✅                   |
| Historical decision                   | ❌     | ❌                     | 🔶 own church  | ❌              | ✅                   |
| Publish (`church_review → published`) | ❌     | ❌                     | ❌             | 🔶 own church   | ❌ (no override, Q6) |
| Unpublish / archive                   | ❌     | ❌                     | ❌             | 🔶 own church   | ✅                   |
| Manage church memberships             | ❌     | ❌                     | ❌             | ❌              | ✅                   |
| Grant platform admin                  | ❌     | ❌                     | ❌             | ❌              | ✅                   |
| Export QR (`/api/qr/[publicId]`)      | ❌     | 🔶 own church          | ❌             | 🔶 own church   | ✅                   |
| Read review / publication history     | ❌     | 🔶 own church          | 🔶 own church  | 🔶 own church   | ✅                   |

"Own church" means a `church_memberships` row exists for the object's `church_id`.

---

## 3. How it is enforced

Authorization is enforced at **two independent layers**:

### 3.1 Application layer (UX + fail-fast)

- `lib/auth/session.ts` — `getSession()` uses the server-verified `auth.getUser()` result and loads
  the caller's memberships. It never trusts a client-supplied role or church.
- `lib/auth/authorization.ts` — guards (`requireSession`, `requirePlatformAdmin`,
  `requireRoleInChurch`, …) mirror the RLS rules for clear errors and UI affordances.
- Server actions (`lib/actions/*`) validate with strict zod schemas and re-check the guard inside the
  action, so a direct call to an action (bypassing the UI) is still rejected.

### 3.2 Database layer (the security guarantee)

- Every table has RLS enabled. Roles are restricted to the anon key + user JWT; the service-role key
  is server-only.
- Membership-scoped writes are gated by `SECURITY DEFINER` helpers
  (`has_church_role`, `is_church_member`, `can_write_object_content`, `is_platform_admin`, …).
- `objects_church_id`, `objects_public_id`, and `objects.status` are immutable except through
  `transition_object_status()` (guarded by the `enforce_object_immutables` trigger).
- `church_memberships` and `profiles.is_platform_admin` are writable **only** by platform admins, so
  a user cannot escalate their own privileges.

The application layer may be bypassed by a crafted request; the database layer cannot.

---

## 4. Server action → policy map

| Action (`lib/actions/*`)                                                        | Required role                           | Backing RLS / RPC                                          |
| ------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `createObject`                                                                  | editor of church                        | `objects_editor_insert` (+ `status='draft'`)               |
| `updateObject`                                                                  | editor of church                        | `objects_editor_update` (+ `status='draft'`)               |
| `upsertObjectTranslation`, `deleteObjectTranslation`                            | editor of church                        | `object_translations_write` via `can_write_object_content` |
| `createClaim`, `deleteClaim`, `linkSource`                                      | editor of church                        | `claims_*`, `object_sources_write`, `claim_sources_write`  |
| `setClaimVerification`                                                          | historical reviewer                     | `claims_update` (reviewer branch)                          |
| `registerMedia`, `upsertMediaTranslation`, `setMediaPublication`, `deleteMedia` | editor of church                        | `media_*` via `can_write_object_content`                   |
| `submitForReview`                                                               | editor of church                        | `transition_object_status`                                 |
| `recordReviewDecision`                                                          | reviewer / approver (stage-appropriate) | `record_review`                                            |
| `unpublishObject`, `archiveObject`, `returnToDraft`                             | approver / reviewer                     | `transition_object_status`                                 |
| `grantMembership`, `revokeMembership`, `setPlatformAdmin`                       | platform admin                          | `church_memberships_admin_write`, `profiles_admin_write`   |
| `GET /api/qr/[publicId]`                                                        | editor/approver of church or admin      | checked in the route handler + published-only              |

---

## 5. Auditability

- `publication_history` records every status transition (who, from, to, notes, when).
- `review_records` records every review decision (who, stage, decision, notes, when).
- Both tables are append-only: no insert/update/delete policy exists for any browser role; writes
  occur only inside `SECURITY DEFINER` functions.
- Membership and platform-admin changes are performed by platform admins through RLS and are
  reflected in `church_memberships` / `profiles`.

---

## 6. Notes and limitations

- Claim verification granularity is row-level: a reviewer may update any column of a claim in their
  church; the application narrows this to `verification`.
- `sources` is global (no church column); its write policy uses `is_any_church_member()`.
- Local verification uses the PGlite harness; real Supabase Auth/Storage behaviour must be confirmed
  against a hosted project.

# Content Integrity

> Document: `content-integrity.md`
> Status: Phase 7 — implemented
> Related: [`editorial-workflow.md`](editorial-workflow.md), [`security-audit.md`](security-audit.md),
> [`architecture/database-schema.md`](architecture/database-schema.md)

Content integrity answers two questions: _is what the public sees the content the church actually
approved?_ and _can that be proven after the fact?_ This document describes the invariants the
database enforces, how the application cooperates, and what remains open.

---

## 1. Integrity invariants

| #   | Invariant                                                                              | Enforced by                                                       |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| I1  | An object is publicly visible **only** in status `published` within an `active` church | RLS `objects_public_read`; `is_object_published()`                |
| I2  | Status changes only through sanctioned transitions                                     | `enforce_object_immutables` trigger; `transition_object_status()` |
| I3  | Publishing requires the `church_approver` role                                         | `transition_object_status()` role check (no admin override)       |
| I4  | A review decision and its resulting transition are atomic                              | `record_review()` (single transaction)                            |
| I5  | Non-approval decisions require notes                                                   | `record_review()` (`22023`)                                       |
| I6  | `public_id` and `church_id` are immutable                                              | `enforce_object_immutables` trigger                               |
| I7  | Public ids are unique and correctly formatted                                          | 10-char Crockford generator + format check constraint             |
| I8  | Retired ids keep resolving via aliases                                                 | `object_aliases` + `resolve_public_id()`                          |
| I9  | Media is publicly served only with a permissive licence                                | `media_publish_gate_check` + RLS + `canPublishMedia()`            |
| I10 | The public never sees claims/media of unpublished objects                              | RLS gated by `is_object_published()`                              |
| I11 | The audit trail is append-only                                                         | No write policies on `review_records` / `publication_history`     |

---

## 2. The audit trail

Two append-only tables capture the full editorial history:

- **`publication_history`** — one row per transition: `actor_id`, `from_status`, `to_status`,
  `notes`, `created_at`. Written exclusively inside `transition_object_status()`.
- **`review_records`** — one row per review decision: `actor_id`, `review_type`, `decision`,
  `notes`, `created_at`. Written exclusively inside `record_review()`.

Writes are not possible through the API: neither table has an `INSERT`/`UPDATE`/`DELETE` policy for
`anon` or `authenticated` (verified by `tests/integration/db/security-hardening.test.ts`
§"audit trail immutability"). The server does not expose any endpoint that writes them directly.

**Atomicity:** `record_review()` inserts the review row and performs the transition in the same
transaction, so a decision can never exist without its consequence, or vice versa (I4).

---

## 3. Publication gate

The public `/o/{publicId}` page and the QR export both require `status='published'`:

- Public reads are filtered by RLS `objects_public_read` (`is_object_published()`), which also
  requires the owning church to be `active`.
- `resolve_public_id()` returns nothing for in-progress ids (`404`) and reports `archived` for
  retired content (`410`).
- The QR route returns `404` for any non-published object, so drafts are never confirmed.
- Translations, claims, and media have their own RLS `*_public_read` policies gated by the parent
  object's published state, so an editor cannot leak a draft by marking a child row public.

---

## 4. Publication-state columns

Derived timestamps stay consistent with status:

- `published_at` is set to `now()` only when transitioning **to** `published` (kept on later
  transitions).
- `archived_at` is set when transitioning to `archived` and cleared otherwise.
- A check constraint guarantees `published_at` is only present for `published`/`archived` states.

---

## 5. Media integrity

The media publish gate combines three layers:

1. **Application** — `canPublishMedia()` requires a permissive `permission_status`
   (`granted`/`public_domain`) and alt text for images.
2. **Constraint** — `media_publish_gate_check` (`not is_public or permission_status in
('granted','public_domain')`) rejects an inconsistent row at the database level (verified in
   `security-hardening.test.ts`).
3. **RLS** — the public read policy additionally requires the parent object to be published.

New media always start non-public (`is_public=false`) and `permission_status='pending'`, so nothing
leaks before an explicit, gated publication action.

---

## 6. Identity integrity for QR permanence

QR codes encode a permanent `/o/{publicId}` URL. Integrity of that identifier is guaranteed by:

- a **server-generated** 10-character Crockford Base32 id (excludes ambiguous `I`, `L`, `O`, `U`),
  from a 32¹⁰ ≈ 1.1×10¹⁵ space;
- a format check constraint (exactly 10 valid chars);
- immutability (I6), so a printed QR never silently changes target;
- `object_aliases`, so if an object is ever superseded its old id still resolves.

---

## 7. Open items

- **No content revision snapshots.** The audit trail records decisions and transitions, not the
  exact text that was approved. If dispute resolution later requires "show me the approved wording",
  add versioned translation snapshots.
- **Publish-time completeness.** Only a default-language title is checked (at submission). A
  configurable required-field gate could be added to `transition_object_status`.
- **Storage object integrity.** Uploads are magic-byte checked before and after private staging and
  receive a SHA-256 checksum. Image dimensions and audio duration are not extracted yet; the live
  Storage lifecycle needs verification (`security-audit.md` F1).

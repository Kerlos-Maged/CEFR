# Editorial Workflow

> Document: `editorial-workflow.md`
> Status: Phase 6 — implemented
> Related: [`architecture/security-and-permissions.md`](architecture/security-and-permissions.md) §4.3,
> [`architecture/api-contracts.md`](architecture/api-contracts.md) §6, [`permissions-and-roles.md`](permissions-and-roles.md)

Content moves through a fixed, auditable lifecycle:

```
Draft ──editor──▶ Historical review ──reviewer──▶ Church approval ──approver──▶ Published
  ▲                    │                              │                          │
  └──── reviewer/approver (reject / request changes) ─┘                          │
  ▲                                                                             │
  └──────────────────────── approver (unpublish) ───────────────────────────────┘

Draft | Published ──approver──▶ Archived
```

The only sanctioned way to change an object's status is
`public.transition_object_status(object_id, to_status, notes)`. Direct `UPDATE objects SET status`
is blocked by the `enforce_object_immutables` trigger, even for platform admins.

---

## 1. States

| State               | Meaning                                                | Visible publicly? |
| ------------------- | ------------------------------------------------------ | ----------------- |
| `draft`             | Being authored/edited                                  | No                |
| `historical_review` | Awaiting a historical reviewer's decision              | No                |
| `church_review`     | Approved historically; awaiting church approver        | No                |
| `published`         | Live on the public site + QR page                      | Yes               |
| `archived`          | Retired; QR resolves to a "no longer available" notice | No (410-style)    |

## 2. Allowed transitions and required roles

| From                | To                  | Required role            | Notes                                     |
| ------------------- | ------------------- | ------------------------ | ----------------------------------------- |
| `draft`             | `historical_review` | editor (or admin)        | Requires a default-language title         |
| `historical_review` | `church_review`     | reviewer (or admin)      | Via `record_review(..., 'approved')`      |
| `historical_review` | `draft`             | reviewer (or admin)      | Reject / request changes (notes required) |
| `church_review`     | `published`         | **church approver only** | No admin override (Q6)                    |
| `church_review`     | `draft`             | approver (or admin)      | Reject / request changes                  |
| `published`         | `draft`             | approver (or admin)      | Unpublish                                 |
| `published`         | `archived`          | approver (or admin)      | Archive                                   |
| `draft`             | `archived`          | approver (or admin)      | Discard                                   |

Any other pair raises an `ILLEGAL_TRANSITION` error.

## 3. Review decisions

`public.record_review(object_id, review_type, decision, notes)`:

1. Locks the object and verifies its current status matches the review stage
   (`historical_review` for `historical_review`, `church_review` for `church_approval`).
2. Requires non-empty `notes` when the decision is not `approved`.
3. Inserts a `review_records` row (append-only).
4. Transitions the object **in the same transaction**: `approved` → next stage (or `published` for
   church approval); `rejected` / `changes_requested` → `draft`.

Because steps 3 and 4 are atomic, a decision can never be recorded without its resulting transition,
or vice versa.

## 4. Server actions

| Action                 | Stage                                  | Effect                                                                        |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| `submitForReview`      | `draft`                                | Pre-checks a default-language title, then transitions to `historical_review`. |
| `recordReviewDecision` | `historical_review` or `church_review` | Derives the review type from the object's status; calls `record_review`.      |
| `returnToDraft`        | review stages                          | Transitions to `draft`.                                                       |
| `unpublishObject`      | `published`                            | Transitions to `draft`.                                                       |
| `archiveObject`        | `draft` / `published`                  | Transitions to `archived` with a reason.                                      |

Every action re-validates input and re-checks the caller's session; the RPC enforces the rest.
After a successful transition, affected routes (admin object, review queue, and the public object
page when published) are revalidated.

## 5. Public exposure rules

- Public reads (`objects_public_read`) only return `status = 'published'` objects in **active**
  churches.
- Unpublished translations, media, and claims are filtered out for `anon`.
- `resolve_public_id()` maps unknown/in-progress ids to `404` and archived ids to `410`.
- The QR route handler returns `404` for any object that is not published, so it does not confirm the
  existence of drafts.

## 6. Auditing

- `publication_history` — one row per transition (`actor_id`, `from_status`, `to_status`, `notes`,
  `created_at`).
- `review_records` — one row per decision (`actor_id`, `review_type`, `decision`, `notes`,
  `created_at`).
- Both are append-only and readable only by members of the object's church and platform admins.
- The admin object editor renders both histories.

## 7. Integrity guarantees

- **No self-approval bypass:** publishing requires the `church_approver` role; an editor/reviewer
  cannot publish, and an admin cannot override (deliberate, ADR-018).
- **No partial publish:** review + transition are one transaction.
- **No status tampering:** the trigger rejects direct writes.
- **Stable identifiers:** `public_id` and `church_id` are immutable; `object_aliases` preserve retired
  ids.

## 8. Not yet implemented

- Per-version content snapshots ("which exact text was approved") are not stored; the audit trail
  records decisions and transitions but not full revision diffs.
- Publishing does not yet enforce a configurable set of "required fields" beyond the default-language
  title checked at submission time.

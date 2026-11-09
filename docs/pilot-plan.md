# Controlled Pilot Plan — Phase 9

A plan for a **small, controlled, reversible** first deployment of the platform at one or two
participating churches, and the human approvals that must precede it. Everything institutional is a
**placeholder**: this document deliberately invents no church names, clergy, approvals, dates, or
consents. Numbers labelled **[recommendation]** are suggested, not decided.

> Scope note: this plan describes a **technical and editorial** pilot. It does **not** grant, imply,
> or substitute for any ecclesiastical, historical, or legal approval. Those are prerequisites owned
> by people, not by this software.

## 1. Objective

Prove, at the smallest possible scale, that a real visitor can scan a real QR code inside a real
church and read accurate, properly-approved, multilingual heritage content — with a clear rollback
path and no irreversible public commitment.

## 2. Preconditions (must be true before the pilot starts)

### 2.1 Technical

- [ ] A **staging Supabase project** exists (separate from production); migrations applied via
      `supabase db reset`; `supabase test db` green; generated types refreshed.
- [ ] The [Phase 9 QA report](../README.md) findings are triaged: **D-2 fixed** (done); **D-1/D-3**
      (404/410 status) either fixed or **explicitly accepted in writing** by the technical owner.
- [ ] A **production** Supabase project exists with backups and a documented recovery procedure.
- [ ] Secrets are provisioned via the hosting platform's secret store — never committed. `.env.example`
      lists the required keys.
- [ ] Security headers verified live; `npm audit --omit=dev` reports 0 production advisories.
- [ ] The QR base URL / production domain is **decided** (architecture open-question **Q1**).
- [ ] The full quality gate passes on the release commit: `lint`, `typecheck`, `test` (161+), `build`,
      and the browser E2E suite against a Supabase-backed instance.
- [ ] Monitoring/error reporting: application health and structured server logs exist; deployment
      alerting and production performance monitoring still require provider configuration. For a
      pilot, assign a **manual** check — see §6. Do not assume automated alerting.

### 2.2 Editorial

- [ ] Every pilot object is in status **`published`**, having passed **historical review** and
      **church approval** through the workflow (FR-PB-9).
- [ ] Every media item has explicit permission (`granted`/`public_domain`) and a recorded attribution.
- [ ] Translations present for at least the pilot languages, with completeness confirmed; fallback
      behaviour understood and acceptable.
- [ ] Objects without a required translation, or with uncertain rights, are **excluded**.

### 2.3 Institutional (human — placeholders)

- [ ] **Church authority consent:** the responsible authority for the participating church
      (`[CHURCH_AUTHORITY_PLACEHOLDER]`) has given **written** consent to publish the selected objects
      and to install QR labels on-site.
- [ ] **Historical/artistic approval:** the designated reviewer(s) for the participating church have
      signed off on the factual content of each object.
- [ ] **Religious/doctrinal review:** where an object carries religious or liturgical significance, the
      responsible religious authority has reviewed the wording.
- [ ] **Data protection:** the pilot stores no visitor accounts, names, or emails, and no raw IP
      addresses (FR-AN-2/FR-AN-3, also a design guarantee). Confirm with the data-protection owner
      (`[DPO_PLACEHOLDER]`) that this remains acceptable for the pilot.
- [ ] **Site access:** permission and a contact to install and later remove physical QR labels.

> Withdraw any of the above and the pilot is paused.

## 3. Scope

### In scope

- **[recommendation] 1–2 churches**, **[recommendation] 5–15 objects** total, chosen for
  unambiguous provenance and clear, uncontested descriptions.
- Public visitor flow: scan QR → localized object page → read text/media/sources → language switch.
- Admin flow: sign-in (magic link), view published objects, (optionally) exercise a full
  draft→published cycle on a **test** object that is never publicly labelled.

### Out of scope

- Public object browsing/search beyond the active church directory and its published church profiles.
- Operational analytics dashboard; the product analytics dashboard is implemented but needs hosted
  ingestion and retention verification.
- Automated QR printing/ordering — **the platform never orders prints**. Any physical labels are
  produced and installed under a separate, manually-controlled process (§4).
- Any object with unresolved rights, missing approval, or disputed provenance.

## 4. QR labels (manual, deliberate)

- The platform's only QR responsibility is the **stable target URL** and the ability to **export**
  image files (FR-QR-8). It does **not** print, order, or dispatch anything.
- **[recommendation] Staging-first:** export QR images, print on plain paper, install temporarily
  (e.g. removable labels), and validate by scanning with several phones before any permanent label.
- Permanent installation is a **separate, institutionally-approved** action, performed by the
  church's own process. Before it, confirm the target URL will not change (it must not — FR-QR-1/3).
- Keep a **mapping sheet** of `public_id ↔ physical location ↔ install date`, stored by the pilot
  owner, so a label can be located and removed during rollback.

## 5. Rollback

- **Unpublish** (to `draft`) or **archive** any object from the admin dashboard. Archiving preserves
  records and (per FR-QR-5) returns a neutral HTTP 410 notice; verify that response against the
  staging Supabase project before removing a label.
- **Remove** any physical labels; do not reuse their ids (FR-QR-6 — retired ids are recorded as
  aliases and never reassigned).
- **Disable** the deployment (e.g. take the app offline) without deleting data; the database is the
  source of truth and can be restored from backup.
- Full rollback must be achievable within **[recommendation] one working day** of a decision.

## 6. Operating the pilot (given no monitoring)

Because there is no automated monitoring, the pilot owner must:

- Perform a **daily manual spot-check**: open the pilot object pages, confirm they render, confirm the
  language switch and media load.
- Keep a lightweight **log** of reported issues and visitor feedback.
- Watch the hosting platform's built-in metrics (request counts / error rate) if available.
- Have a named go/no-go contact for pausing the pilot.

## 7. Success criteria

Purely descriptive for a first pilot; **[recommendation]** thresholds are illustrative:

- All pilot QR codes resolve to the correct object from at least **[recommendation] three** different
  phones/browsers (iOS Safari, Android Chrome, desktop).
- Both Arabic and English render correctly, Arabic RTL, with the fallback notice where applicable.
- No incorrect historical claim is found and reported during the pilot window.
- No 5xx errors observed during the daily checks.
- Every pilot object has a complete approval trail in `review_records`.

## 8. Exit criteria

Return to "closed" (unpublish/pause) if any of:

- A content accuracy error requires review and cannot be corrected quickly.
- Approval for an object is withdrawn.
- A privacy or security concern arises.
- The 404/410 defect materially confuses visitors or link integrity in a way the owners deem
  unacceptable.

## 9. Roles (placeholders)

| Role                  | Responsibility                                     | Placeholder          |
| --------------------- | -------------------------------------------------- | -------------------- |
| Technical owner       | Deploy, verify, rollback, fix defects              | `[TECH_OWNER]`       |
| Editorial lead        | Ensure objects are published, approved, translated | `[EDITORIAL_LEAD]`   |
| Church authority      | Consent to publish/install                         | `[CHURCH_AUTHORITY]` |
| Historical reviewer   | Sign off factual content                           | `[REVIEWER]`         |
| Data-protection owner | Confirm privacy posture                            | `[DPO]`              |

## 10. Open questions blocking the pilot

These must be resolved (see `architecture/architecture-decisions.md`):

- **Q1** production domain / QR base URL — _blocks QR export and labels_.
- **Q2** non-public media handling — _affects what may be labelled_.
- **Q3** data residency — _affects Supabase region choice_.
- **Q5** verification wording (e.g. how "verified"/"uncertain" are phrased to visitors).

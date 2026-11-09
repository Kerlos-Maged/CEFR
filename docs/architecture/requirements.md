# Requirements Specification

> Project: Coptic Heritage Digital Platform
> Document: `requirements.md`
> Status: Phase 1 (Requirements & Architecture) — approved for implementation planning
> Related: [`architecture.md`](./architecture.md), [`database-schema.md`](./database-schema.md), [`security-and-permissions.md`](./security-and-permissions.md), [`api-contracts.md`](./api-contracts.md), [`implementation-roadmap.md`](./implementation-roadmap.md), [`architecture-decisions.md`](./architecture-decisions.md)

---

## 1. Purpose and Scope

The platform documents and presents the historical, artistic, architectural, and religious
heritage of Coptic Orthodox churches in Egypt. Visitors scan QR codes placed, with church
approval, near heritage objects inside churches. Each QR code opens a permanent public URL for
one object, viewable on a mobile-friendly website with no app install and no visitor account.

In scope:

- Multiple churches and thousands of heritage objects.
- Bilingual (Arabic / English) content with an extensible language model.
- A review and approval workflow ensuring only church-approved content is published.
- Media (images, optional audio narration) with attribution and permission tracking.
- Privacy-conscious analytics.
- Administrative tooling for editors, reviewers, approvers, and platform administrators.

Out of scope for the product (this phase):

- Native mobile applications.
- Visitor accounts, comments, or user-generated content.
- Online donations, ticketing, or commerce.
- Real-time collaboration, chat, or 3D/AR experiences (candidate future work only).

Out of scope for *this* document/phase: any code, dependency installation, Supabase project
creation, deployment, or paid resource usage.

---

## 2. Terminology

| Term | Definition |
| --- | --- |
| **Heritage object** (or *object*) | A single documented item: icon, wall painting, architectural feature, wood carving/iconostasis, inscription, manuscript, or other church-approved item. |
| **Public ID** | A stable, opaque, URL-safe identifier assigned once to an object. It is embedded in the QR code and never changes. |
| **Church** | A Coptic Orthodox church registered on the platform. Every object belongs to exactly one church. |
| **Claim** | A single historical/descriptive assertion attached to an object (e.g. date, attribution, provenance) that carries its own verification status and citations. |
| **Source** | A bibliographic reference (book, article, archive record, inscription transcription). |
| **Translation** | Language-specific content (title, description, caption) for a language-independent underlying record. |
| **Editor** | Church-scoped content author. |
| **Historical reviewer** | Church-scoped role validating historical claims and citations. |
| **Church approver** | Church-scoped role granting final publication approval. |
| **Platform administrator** | Global role managing configuration, users, roles, and church onboarding. |
| **Publication** | The act of making approved content publicly visible. |

---

## 3. Actors and User Stories

### 3.1 Public visitor

| ID | User story | Acceptance criteria |
| --- | --- | --- |
| PV-1 | As a visitor, I scan a QR code and see the object page in under 3 seconds on 3G. | QR resolves to `/o/{publicId}`; page renders server-side; LCP ≤ 2.5s on 4G, ≤ 4s on Slow-3G simulation. |
| PV-2 | As a visitor, I read the object's title, description, type, date, and location in my language. | Content shown in the negotiated language; missing translations fall back to the object's default language with a visible notice. |
| PV-3 | As a visitor, I view images and optionally play audio narration. | Images lazy-load with alt text; audio (if present) has an accessible player. |
| PV-4 | As a visitor, I switch between Arabic and English. | Language toggle re-renders the page; Arabic renders RTL; choice is remembered client-side (no account). |
| PV-5 | As a visitor, I see only published content. | No draft/review/archived content is reachable via any public route or API. |
| PV-6 | As a visitor, I can see which information is verified vs uncertain. | Claims expose a verification indicator (verified / uncertain / disputed) with citations where available. |

### 3.2 Content editor

| ID | User story | Acceptance criteria |
| --- | --- | --- |
| ED-1 | As an editor, I create draft objects for my church. | New object created with `status = draft`; `church_id` forced to one of my memberships. |
| ED-2 | As an editor, I add translations, media, claims, and sources to drafts. | All edits allowed while status ∈ {draft}; blocked while in review unless changes are requested. |
| ED-3 | As an editor, I submit a draft for historical review. | Transition `draft → historical_review`, recorded in `publication_history`, requires ≥1 title translation and a default language. |
| ED-4 | As an editor, I cannot publish. | Publication endpoints reject editor role; enforced in database (RLS) and application. |
| ED-5 | As an editor, I see review feedback and revise. | Rejection sets status to `draft` and surfaces reviewer notes in the dashboard. |
| ED-6 | As an editor, I can only edit content of churches I am a member of. | Cross-church edit attempts are denied by RLS. |

### 3.3 Historical reviewer

| ID | User story | Acceptance criteria |
| --- | --- | --- |
| HR-1 | As a reviewer, I see objects awaiting historical review for my church. | Queue filtered by `status = historical_review` and my memberships. |
| HR-2 | As a reviewer, I approve, reject, or request changes with notes. | Decision written to `review_records` (type `historical_review`); approval → `church_review`; rejection → `draft`. |
| HR-3 | As a reviewer, I verify citations per claim. | Reviewer can mark a claim `verified`, `uncertain`, or `disputed` and attach/adjust sources. |
| HR-4 | As a reviewer, I cannot publish or approve for the church. | Only `church_review → published` is reserved for church approvers. |

### 3.4 Church approver

| ID | User story | Acceptance criteria |
| --- | --- | --- |
| CA-1 | As an approver, I see objects awaiting church approval for my church. | Queue filtered by `status = church_review` and my memberships. |
| CA-2 | As an approver, I approve for publication or reject. | Approval → `published` with `published_at`; rejection → `draft` with notes. |
| CA-3 | As an approver, I can unpublish/archive with justification. | `published → draft` (unpublish) or `published → archived`; both recorded in history. |
| CA-4 | As an approver, I see exactly what will be public before approving. | Pre-publish preview renders the public page from approved revisions only. |

### 3.5 Platform administrator

| ID | User story | Acceptance criteria |
| --- | --- | --- |
| PA-1 | As an admin, I onboard churches. | Create/archive church; assign church slugs; manage metadata. |
| PA-2 | As an admin, I manage users and roles. | Invite/create users; grant/revoke church memberships. |
| PA-3 | As an admin, I manage languages. | Enable/disable languages; set default language and text direction. |
| PA-4 | As an admin, I audit activity. | Read `review_records` and `publication_history` across churches. |
| PA-5 | As an admin, I can act on any church when required. | Admin override is explicit and audit-logged. |

### 3.6 Role model rules

- A person **may hold multiple roles**, including across different churches (e.g. editor for
  Church A, historical reviewer for Church B). Enforced via `church_memberships`.
- The three church roles (editor, historical reviewer, church approver) are **church-scoped**.
- Platform administrator is **global** (not church-scoped) and is stored on the user profile,
  not as a membership.
- Public visitors are unauthenticated and hold no role.

---

## 4. Functional Requirements

Requirement IDs use `FR-<area>-<n>`. Priority: **M** (must, MVP), **S** (should), **C** (could).

### 4.1 Church management (`CH`)

| ID | Pri | Requirement |
| --- | --- | --- |
| FR-CH-1 | M | Register churches with a unique slug, names/descriptions in supported languages, and location metadata. |
| FR-CH-2 | M | Store church location at city/area granularity (not exact GPS) with optional coordinates. |
| FR-CH-3 | M | Every object belongs to exactly one church (non-null FK). |
| FR-CH-4 | M | Churches can be archived; archiving cascades to unpublish their objects but preserves records. |
| FR-CH-5 | S | Church metadata includes denomination/rite, founded date (approximate, free text), and district. |
| FR-CH-6 | C | Support church cover image and external reference links. |

### 4.2 Heritage object management (`OB`)

| ID | Pri | Requirement |
| --- | --- | --- |
| FR-OB-1 | M | Assign each object a **stable public ID** generated once, never reused, never changed. |
| FR-OB-2 | M | Store title, object type, approximate date, location within church, description, status. |
| FR-OB-3 | M | Optional fields may be empty; UI shows "unknown/not recorded" rather than fabricating values. |
| FR-OB-4 | M | Support multiple images, optional audio, multiple sources, and multiple translations per object. |
| FR-OB-5 | M | Distinguish verified information from uncertain or disputed claims at claim granularity. |
| FR-OB-6 | M | Object type is a controlled vocabulary (extensible). |
| FR-OB-7 | S | Objects may store dimensions, materials, and condition notes. |
| FR-OB-8 | S | Objects support tag/keyword search internally. |
| FR-OB-9 | M | Objects can be archived (not hard-deleted) with a reason. |

### 4.3 Multilingual content (`ML`)

| ID | Pri | Requirement |
| --- | --- | --- |
| FR-ML-1 | M | Support Arabic (`ar`) and English (`en`) initially. |
| FR-ML-2 | M | Languages are data (a table), so additional languages need no schema change. |
| FR-ML-3 | M | Arabic renders right-to-left; layout adapts to `dir`. |
| FR-ML-4 | M | Translations stored independently, keyed by `(entity, field, language)`; one language never overwrites another. |
| FR-ML-5 | M | Each object has a **default language**; if the requested language lacks a translation, show default-language content with a visible fallback notice and a language switch. |
| FR-ML-6 | M | Translation completeness is tracked per object (which languages are present/complete). |
| FR-ML-7 | S | Editorial dashboard highlights objects missing required translations. |
| FR-ML-8 | M | URL language handling is locale-prefixed (`/en/...`, `/ar/...`); the QR token itself is language-independent. |

### 4.4 QR codes and permanent URLs (`QR`)

| ID | Pri | Requirement |
| --- | --- | --- |
| FR-QR-1 | M | Each object has a permanent public URL: `https://{host}/o/{publicId}`. |
| FR-QR-2 | M | `publicId` is opaque, URL-safe, uppercase Crockford Base32, 10 characters, generated once. |
| FR-QR-3 | M | Editing content, translations, media, or review state **never** changes `publicId`. |
| FR-QR-4 | M | Renaming/moving an object keeps the same `publicId`; optional human-readable slugs may redirect to it. |
| FR-QR-5 | M | Archived objects return HTTP 410 Gone with a neutral page (not a re-used ID). |
| FR-QR-6 | M | Relocated/renamed objects preserve the original URL; retired IDs are recorded in an alias/redirect table and never reused. |
| FR-QR-7 | M | The QR target URL is language-agnostic; middleware negotiates locale without changing the token. |
| FR-QR-8 | S | Support QR generation and export (PNG/SVG, print-ready) in the admin dashboard. |
| FR-QR-9 | M | QR scanning must work offline-tolerant: the public page is server-rendered and cache-friendly. |

### 4.5 Content management and publication (`PB`)

Workflow: **Draft → Historical Review → Church Approval → Published**.

| ID | Pri | Requirement |
| --- | --- | --- |
| FR-PB-1 | M | Statuses: `draft`, `historical_review`, `church_review`, `published`, `archived`. |
| FR-PB-2 | M | Editor submits `draft → historical_review`. |
| FR-PB-3 | M | Historical reviewer: `historical_review → church_review` (approve) or `→ draft` (reject / request changes). |
| FR-PB-4 | M | Church approver: `church_review → published` (approve) or `→ draft` (reject). |
| FR-PB-5 | M | Approver/admin can `published → draft` (unpublish) or `published → archived`. |
| FR-PB-6 | M | Every transition writes an immutable `publication_history` row (actor, from, to, notes, timestamp). |
| FR-PB-7 | M | Every review decision writes an immutable `review_records` row (stage, decision, notes). |
| FR-PB-8 | M | Content is editable only in `draft` (or after changes requested, which returns to `draft`). |
| FR-PB-9 | M | The system **cannot** publish content that has not passed historical review, enforced in the database. |
| FR-PB-10 | S | Objects may require "changes requested" notes before re-submission. |

### 4.6 Media management (`MD`)

| ID | Pri | Requirement |
| --- | --- | --- |
| FR-MD-1 | M | Support images (JPEG, PNG, WebP) and optional audio narration (MP3, M4A/AAC). |
| FR-MD-2 | M | Media metadata stored separately from the object record. |
| FR-MD-3 | M | Each media item supports localized caption and alt text, copyright, attribution, and permission status. |
| FR-MD-4 | M | Permission status is explicit: `granted`, `public_domain`, `pending`, `restricted`. Only publishable media may appear publicly. |
| FR-MD-5 | M | Validate MIME type, extension, and size server-side on upload. Images ≤ 15 MB each; audio ≤ 25 MB each. |
| FR-MD-6 | M | Generate responsive image variants and thumbnails server-side. |
| FR-MD-7 | M | Object ordering of media is stable and editable. |
| FR-MD-8 | S | Reject/store-but-flag media lacking permission metadata before publication. |

### 4.7 Analytics (`AN`)

| ID | Pri | Requirement |
| --- | --- | --- |
| FR-AN-1 | M | Record page views, language selection, and audio engagement (play/complete). |
| FR-AN-2 | M | No visitor accounts; no cookies required for core functionality. |
| FR-AN-3 | M | Do **not** collect precise location, IP in raw form, names, emails, or device fingerprints. |
| FR-AN-4 | M | Use a rotating, salted, non-reversible session hash for coarse unique-visitor counting within a bounded window. |
| FR-AN-5 | M | Aggregate metrics by object, church, language, and day. |
| FR-AN-6 | M | Raw analytics events retained ≤ 90 days; aggregates retained indefinitely. |
| FR-AN-7 | S | Respect Do-Not-Track / Global Privacy Control by not emitting analytics. |
| FR-AN-8 | M | Analytics ingestion is resilient: failures never block page rendering. |

---

## 5. Non-Functional Requirements

Measurable targets; where provisional, assumptions and validation points are stated. See
`architecture.md §10` and `implementation-roadmap.md` for how each is validated.

| Area | Requirement | Target / Provisional target |
| --- | --- | --- |
| Mobile responsiveness | First-class mobile UX (QR scan context) | Usable at 320px width; touch targets ≥ 44px; no horizontal scroll. |
| Performance | Fast on poor connections | LCP ≤ 2.5s (4G), ≤ 4s (Slow-3G) on object page; JS budget ≤ 120 KB gzip initial. |
| Accessibility | WCAG 2.1 AA | Automated+manual audit; keyboard navigable; contrast ≥ 4.5:1; screen-reader labels. |
| Arabic/English | Correct bidirectional rendering | Arabic RTL, correct numerals/fonts; logical CSS properties; no layout mirroring bugs. |
| Reliability | High availability for public pages | 99.9% monthly for public pages (Vercel/Supabase dependent). |
| Recoverability | Data safety | Daily automated backups; PITR if plan permits; documented restore drill; RPO ≤ 24h, RTO ≤ 4h. |
| Maintainability | Clear boundaries | Typed end-to-end; ≥ 70% unit coverage on domain/validation logic; lint/typecheck in CI. |
| Scalability | Thousands of objects, multiple churches | Object page served from cache/CDN; DB indexed for public lookups; horizontal app scaling. |
| Privacy | Data minimization | No PII; analytics retention ≤ 90 days raw; documented in a privacy note. |
| Security | Robust access control | RLS enforced in DB; least privilege; no privileged secrets in the browser; audited publication. |
| Cost | Predictable, low | Free/low tiers sufficient for pilot; document cost triggers before scaling. |

---

## 6. Assumptions and Unresolved Questions

### 6.1 Confirmed (given by the project brief)

- Next.js + TypeScript + Tailwind; Supabase (Postgres/Auth/Storage); Vercel or compatible;
  Git/GitHub; QR library; TypeScript-compatible testing tools.
- Modular monolith; no microservices.
- Public access is anonymous; Arabic and English initially.
- Workflow is Draft → Historical Review → Church Approval → Published.

### 6.2 Assumptions (to validate during pilot)

- **A1** Object pages are public and media can be served via public CDN (no per-object
  authentication). If churches require restricted media, signed URLs will be needed.
- **A2** One default language per object; Arabic-first churches will set `ar` as default.
- **A3** Church approvers are trusted to judge religious accuracy; the platform records, not
  adjudicates.
- **A4** Approximate dates are free text / partial precision (e.g. "18th century").
- **A5** No legal requirement for a formal copyright registration workflow; metadata is
  sufficient at MVP.
- **A6** A single deployment/region (EU or nearest Supabase region) is acceptable for the pilot.

### 6.3 Decisions and unresolved questions requiring human input

- **Q1** Primary production domain and whether each church gets a branded subdomain.
- **Q2** Whether any media must be non-public (requires signed URLs and RLS on storage).
- **Q3** Data residency/legal requirements for Egyptian cultural data.
- **Q4 — resolved (ADR-030):** provide a public directory of active churches and their profiles;
  archived churches remain hidden. There is no standalone browse-all-objects index.
- **Q5** Exact wording/branding for the "uncertain/disputed" claim indicators.
- **Q6 — resolved for this phase (ADR-018):** platform administrators do not bypass church approval;
  only a church approver can publish.
- **Q7** Offline access expectations (service-worker caching) beyond standard HTTP caching.

---

## 7. Traceability

Each functional requirement in §4 maps to database objects (`database-schema.md`), endpoints
or server actions (`api-contracts.md`), permissions (`security-and-permissions.md`), and roadmap
tasks (`implementation-roadmap.md`). The `FR-*` IDs above are the canonical requirement keys used
throughout the other documents.

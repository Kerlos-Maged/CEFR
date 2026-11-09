# Coptic Heritage Digital Platform

A production-oriented web platform that documents and presents the historical, artistic,
architectural, and religious heritage of Coptic Orthodox churches in Egypt. Visitors scan QR
codes placed (with church approval) near heritage objects; each QR code opens a permanent,
mobile-friendly page — no app install and no account required.

> **Current status:** Phases 1–7 and 9 are implemented, with follow-up work on the original Phase
> 4/6/8 gaps: public church directory and profiles, analytics ingestion/reporting, tagged public
> content, per-object metadata, authenticated media upload, archived QR HTTP 410, readiness probe,
> and structured request-error logs. Hosted Supabase/Storage verification, deployment alert setup,
> and measured production performance remain pending. The Phase 9 matrix predates these additions;
> see [`docs/phase-status.md`](docs/phase-status.md).
> [`docs/phase-status.md`](docs/phase-status.md).

## Technology stack

- **Framework:** Next.js (App Router) with React and TypeScript (strict)
- **Styling:** Tailwind CSS v4
- **Backend:** Supabase — PostgreSQL, Auth, Storage, Row Level Security
- **Hosting (planned):** Vercel or a compatible Node.js platform
- **Testing:** Vitest (unit + in-process PGlite integration), Playwright (gated browser E2E)
- **Tooling:** ESLint, Prettier

## Prerequisites

- **Node.js** 20.9 or newer (developed and pinned on Node 22 — see `.nvmrc`)
- **npm** 10 or newer (this repository uses npm; `package-lock.json` is committed)

## Installation

```bash
npm install
```

## Development commands

| Command                    | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| `npm run dev`              | Start the development server at localhost:3000         |
| `npm run build`            | Create a production build                              |
| `npm run start`            | Run the production build locally                       |
| `npm run lint`             | Run ESLint                                             |
| `npm run typecheck`        | Run TypeScript with no emit                            |
| `npm run format`           | Format the repository with Prettier                    |
| `npm run format:check`     | Check formatting without writing changes               |
| `npm test`                 | Run unit tests once (Vitest)                           |
| `npm run test:watch`       | Run unit tests in watch mode                           |
| `npm run test:e2e:install` | One-time: download the Chromium browser for E2E        |
| `npm run test:e2e`         | Run browser E2E (skipped unless `E2E_BASE_URL` is set) |
| `npm run check`            | Lint + typecheck + tests                               |

## Environment configuration

Copy `.env.example` to `.env.local` and fill in values. `.env.local` is git-ignored; never commit
real values. Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser and must never
hold secrets. The Supabase variables are optional for local development of the public pages; the
admin CMS and database-backed features require them.

See [`docs/development-setup.md`](docs/development-setup.md) for details.

## Documentation

- [Architecture and requirements](docs/architecture/) — approved Phase 1 design
  (`requirements.md`, `architecture.md`, `database-schema.md`, `security-and-permissions.md`,
  `api-contracts.md`, `implementation-roadmap.md`, `architecture-decisions.md`)
- [Development setup](docs/development-setup.md) — repository structure and workflow
- [Admin dashboard and CMS](docs/admin-dashboard.md) — authenticated management area
- [Editorial workflow](docs/editorial-workflow.md) — draft → review → publish lifecycle
- [Permissions and roles](docs/permissions-and-roles.md) — who can do what, and how it is enforced
- [Security audit](docs/security-audit.md) — threat model and prioritized findings
- [Security implementation](docs/security-implementation.md) — controls, remediations, verification
- [Content integrity](docs/content-integrity.md) — publication, immutability, and audit guarantees
- [Test matrix](docs/test-matrix.md) — requirements traced to tests, with honest status
- [End-to-end testing](docs/end-to-end-testing.md) — journey coverage, defects, fidelity limits
- [Accessibility and multilingual QA](docs/accessibility-qa.md) — structural checks and open items
- [Pilot plan](docs/pilot-plan.md) — a small, reversible controlled pilot
- [Phase status](docs/phase-status.md) — progress, tested commands, and known issues

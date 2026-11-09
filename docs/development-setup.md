# Development Setup

Developer and AI-agent guide to the Coptic Heritage platform repository. For the approved design,
see [`architecture/`](architecture/).

## Toolchain

| Tool         | Version                                         |
| ------------ | ----------------------------------------------- |
| Node.js      | 22 (`.nvmrc`); minimum 20.9                     |
| npm          | 10+ (lockfile committed as `package-lock.json`) |
| Next.js      | 16 (App Router)                                 |
| React        | 19                                              |
| TypeScript   | 5 (strict)                                      |
| Tailwind CSS | 4                                               |
| Vitest       | 5                                               |

This project uses **npm**. Do not introduce a second package manager; keep `package-lock.json`
tracked and use `npm ci` in CI.

## Repository structure

```text
.
├── app/                     # Next.js App Router routes and layouts
│   ├── layout.tsx           # Root layout (metadata, global styles)
│   ├── page.tsx             # Placeholder landing page
│   └── globals.css          # Tailwind entry point
├── components/              # Shared UI components (empty; Phase 4+)
├── lib/
│   ├── env.ts               # Browser-safe (NEXT_PUBLIC_) env, validated with zod
│   ├── env.server.ts        # Server-only secrets; never import in client code
│   ├── validation/          # zod schemas and pure validators
│   │   └── public-id.ts     # Canonical object public-ID format (FR-QR-2)
│   ├── db/                  # Data-access layer (types, clients, object/church reads)
│   ├── authz/               # Authorization helpers (empty; Phase 3/6)
│   └── actions/             # Server actions (empty; Phase 6)
├── types/                   # Shared TypeScript types (empty; Phase 3+)
├── supabase/                # Schema, seed, and local-stack configuration
│   ├── config.toml          # Supabase CLI local-stack configuration
│   ├── migrations/          # Versioned SQL migrations (applied in lexical order)
│   └── seed.sql             # Fictional local development fixtures
├── scripts/                 # Tooling
│   └── generate-db-types.mts # Generates lib/db/database.types.ts from the migrations
├── tests/
│   ├── unit/                # Vitest unit tests
│   └── integration/db/      # PGlite RLS/workflow integration tests
├── docs/
│   ├── architecture/        # Phase 1 design documents (preserved as-authored)
│   ├── development-setup.md # This file
│   └── phase-status.md      # Phase progress and known issues
├── .env.example             # Placeholder environment variables
├── eslint.config.mjs        # ESLint flat config (Next.js + Prettier)
├── .prettierrc.json         # Prettier config (with Tailwind class sorting)
├── vitest.config.mts        # Vitest config (node environment, @/ alias)
└── next.config.ts           # Next.js configuration
```

Folders are created only where the Phase 1 architecture assigns them a concrete role. Their
contents arrive in later phases, as noted above.

## Local development workflow

1. `npm install`
2. `npm run dev` and open http://localhost:3000
3. Before committing: `npm run check` (lint + typecheck + tests)

## Database and migrations

The schema lives in `supabase/migrations/*.sql` and is the single source of truth. Two ways to
apply it:

- **Supabase CLI (requires Docker):** `npm run db:start` to boot the local stack,
  `npm run db:reset` to reapply migrations + `supabase/seed.sql`, `npm run db:test` for
  `supabase test db`, and `npm run db:types` to regenerate types via
  `supabase gen types typescript --local`.
- **Local admin sign-in:** after the database reset, `supabase/seed.sql` creates the editor,
  historical reviewer, church approver, and platform administrator accounts documented in
  [`admin-dashboard.md`](admin-dashboard.md). Run the app with the local Supabase URL and anon key,
  request a magic link at `/en/login`, and retrieve it from Inbucket at `http://127.0.0.1:54324`.
  The accounts are fictional local fixtures; they are not production credentials.
- **Without Docker (this environment):** the Vitest integration suite applies the same migrations
  to an in-process PostgreSQL (PGlite) — run `npm test`. Generate types with
  `npm run db:types:pglite`, which introspects that database and writes
  `lib/db/database.types.ts`. **Never edit that file by hand.**

After changing a migration, regenerate types (`npm run db:types:pglite`) and run `npm test` so the
RLS/workflow suite covers the change. See `architecture/architecture-decisions.md` (ADR-015,
ADR-019) for why the schema is extension-free and why PGlite is used for tests.

## Dependency management

- Add runtime dependencies with `npm install <pkg>` and dev dependencies with
  `npm install -D <pkg>`.
- Keep dependencies minimal. The stack is fixed by the Phase 1 architecture; adding a framework
  or service requires an architecture-decision record (see
  [`architecture/architecture-decisions.md`](architecture/architecture-decisions.md)).
- Current runtime dependencies: `next`, `react`, `react-dom`, `zod`, `@supabase/supabase-js`.
- Test-only dependency: `@electric-sql/pglite` (in-process PostgreSQL for integration tests).

## Linting, formatting, and type checking

- **ESLint** (`eslint.config.mjs`) extends `eslint-config-next` (`core-web-vitals` and
  `typescript`) and disables formatting rules that would conflict with Prettier via
  `eslint-config-prettier`.
- **Prettier** (`.prettierrc.json`) handles formatting and sorts Tailwind classes with
  `prettier-plugin-tailwindcss`. The Phase 1 architecture documents under `docs/architecture/`
  are excluded from formatting to preserve them exactly.
- **TypeScript** runs in strict mode. `npm run typecheck` must pass.

## Testing and production builds

- Unit tests live in `tests/unit/**/*.test.ts` and run with Vitest in a Node environment. The
  `@/` path alias is configured in `vitest.config.mts`.
- Database integration tests live in `tests/integration/db/**/*.test.ts`. `harness.ts` bootstraps
  an in-process PostgreSQL (PGlite) with Supabase-like `anon`/`authenticated`/`service_role`
  roles, an `auth.users` shim, and an `auth.uid()` shim, then applies every migration and exercises
  RLS and the workflow functions. Test files run sequentially with generous timeouts because
  booting PGlite is CPU-heavy.
- End-to-end tests (Playwright) are specified in the architecture (ADR-013) but are intentionally
  deferred until there are public routes to exercise (Phase 4). Only the minimal test stack is
  installed at this stage.
- Run `npm run build` to verify the production build. The app builds with no environment
  variables set because Supabase access is lazy (see `lib/db/client.ts`).

## Environment-variable handling

- `.env.example` documents every expected variable with safe placeholders; copy it to
  `.env.local`.
- `lib/env.ts` validates browser-safe (`NEXT_PUBLIC_*`) variables with zod.
- `lib/env.server.ts` validates server-only secrets and throws if evaluated in the browser.
- **Never** prefix a secret with `NEXT_PUBLIC_`. The service-role key bypasses Row Level Security
  and must only be used server-side.
- All Supabase variables remain optional at build time; the DAL throws a clear `DalError`
  (`INTERNAL`) only if a function is actually invoked without them configured.

## Common setup problems

| Problem                                                      | Cause / fix                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `npm install` `EBUSY`/`EPERM` on Windows or OneDrive folders | File locks from sync/antivirus; close editors, retry, or exclude `node_modules` from sync. |
| `npm ci` fails                                               | `package-lock.json` out of date; run `npm install` and commit the lockfile.                |
| Build or dev fails after dependency changes                  | Delete `.next/` and rerun.                                                                 |
| Vitest cannot resolve `@/…`                                  | Ensure `vitest.config.ts` alias matches `tsconfig.json` `paths`.                           |
| ESLint reports formatting issues                             | Run `npm run format`, then re-lint.                                                        |

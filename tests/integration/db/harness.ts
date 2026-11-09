import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../supabase/migrations", import.meta.url));

export type AppRole = "anon" | "authenticated" | "service_role";
export type MembershipRole = "editor" | "historical_reviewer" | "church_approver";

export interface CreateUserInput {
  email?: string;
  displayName?: string;
  admin?: boolean;
}

export interface TestDb {
  db: PGlite;
  /** Create an auth user (trigger provisions a profile); optionally make them a platform admin. */
  createUser(input?: CreateUserInput): Promise<string>;
  addMembership(userId: string, churchId: string, role: MembershipRole): Promise<void>;
  createChurch(id?: string, slug?: string): Promise<string>;
  /** Run `fn` with the session switched to `role` and `auth.uid()` set to `userId`. */
  asRole<T>(role: AppRole, userId: string | null, fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Creates an in-process PostgreSQL (PGlite) instance that emulates the Supabase
 * environment closely enough to run the real migrations and exercise RLS/RLS-gated
 * functions without Docker:
 *
 *   - creates the `anon`, `authenticated`, and `service_role` (BYPASSRLS) roles;
 *   - creates the `auth` schema with a minimal `auth.users` table and an `auth.uid()`
 *     shim backed by the `request.jwt.claim.sub` GUC (Supabase-compatible);
 *   - applies every file in `supabase/migrations/` in lexical order.
 *
 * This is the CI path when the Supabase CLI/Docker stack is unavailable. On a machine
 * with Docker, `supabase db reset` + `supabase test db` run the same migrations natively.
 */
export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();

  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create schema auth;

    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Failed applying migration ${file}: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  const api: TestDb = {
    db,

    async createUser(input = {}) {
      const email = input.email ?? `user-${crypto.randomUUID()}@example.test`;
      const displayName = input.displayName ?? "Test User";
      const result = await db.query<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data)
         values ($1, jsonb_build_object('display_name', $2::text))
         returning id`,
        [email, displayName],
      );
      const userId = result.rows[0].id;
      if (input.admin) {
        await db.query(`update public.profiles set is_platform_admin = true where id = $1`, [
          userId,
        ]);
      }
      return userId;
    },

    async addMembership(userId, churchId, role) {
      await db.query(
        `insert into public.church_memberships (user_id, church_id, role)
         values ($1, $2, $3)`,
        [userId, churchId, role],
      );
    },

    async createChurch(id, slug) {
      const churchId = id ?? crypto.randomUUID();
      const churchSlug = slug ?? `church-${churchId.slice(0, 8)}`;
      await db.query(`insert into public.churches (id, slug) values ($1, $2)`, [
        churchId,
        churchSlug,
      ]);
      return churchId;
    },

    async asRole<T>(role: AppRole, userId: string | null, fn: () => Promise<T>): Promise<T> {
      await db.exec(`set role ${role}`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
      try {
        return await fn();
      } finally {
        await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
        await db.exec(`reset role`);
      }
    },

    async close() {
      await db.close();
    },
  };

  return api;
}

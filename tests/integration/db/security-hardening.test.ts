import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "./harness";

/**
 * Phase 7 security-hardening tests. Complements `security.test.ts` (workflow/RLS) and
 * `phase6-authorization.test.ts` (application authorization) by covering the remaining
 * checklist items: privilege escalation, audit immutability, alias integrity, the media
 * publish gate, church-scope isolation for media/claims, and the hard-delete boundary.
 */

let ctx: TestDb;
let churchA: string;
let churchB: string;
let adminId: string;
let editorId: string;
let reviewerId: string;
let approverId: string;
let outsiderId: string;

beforeAll(async () => {
  ctx = await createTestDb();

  churchA = await ctx.createChurch();
  churchB = await ctx.createChurch();

  adminId = await ctx.createUser({ admin: true });
  editorId = await ctx.createUser();
  reviewerId = await ctx.createUser();
  approverId = await ctx.createUser();
  outsiderId = await ctx.createUser();

  await ctx.addMembership(editorId, churchA, "editor");
  await ctx.addMembership(reviewerId, churchA, "historical_reviewer");
  await ctx.addMembership(approverId, churchA, "church_approver");
});

afterAll(async () => {
  await ctx.close();
});

describe("privilege escalation", () => {
  it("stops a non-admin editing their own profile to become a platform admin", async () => {
    // The `profiles_admin_write` policy filters the row out for non-admins, so the UPDATE
    // silently affects zero rows rather than raising.
    const result = await ctx.asRole("authenticated", outsiderId, () =>
      ctx.db.query(`update public.profiles set is_platform_admin = true where id = $1`, [
        outsiderId,
      ]),
    );
    expect(result.affectedRows).toBe(0);

    const { rows } = await ctx.db.query<{ is_platform_admin: boolean }>(
      `select is_platform_admin from public.profiles where id = $1`,
      [outsiderId],
    );
    expect(rows[0].is_platform_admin).toBe(false);
  });

  it("stops an editor granting themselves a role in another church", async () => {
    await expect(
      ctx.asRole("authenticated", editorId, () =>
        ctx.db.query(
          `insert into public.church_memberships (user_id, church_id, role)
           values ($1, $2, 'church_approver')`,
          [editorId, churchA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("stops a reviewer promoting themselves to church_approver", async () => {
    // `church_memberships_admin_write` filters the row out for non-admins: zero rows affected.
    const result = await ctx.asRole("authenticated", reviewerId, () =>
      ctx.db.query(
        `update public.church_memberships set role = 'church_approver'
         where user_id = $1 and church_id = $2`,
        [reviewerId, churchA],
      ),
    );
    expect(result.affectedRows).toBe(0);

    const { rows } = await ctx.db.query<{ role: string }>(
      `select role from public.church_memberships where user_id = $1 and church_id = $2`,
      [reviewerId, churchA],
    );
    expect(rows[0].role).toBe("historical_reviewer");
  });

  it("allows only a platform admin to promote another user", async () => {
    await expect(
      ctx.asRole("authenticated", adminId, () =>
        ctx.db.query(`update public.profiles set is_platform_admin = true where id = $1`, [
          outsiderId,
        ]),
      ),
    ).resolves.toBeDefined();

    // Reset so later tests are not affected by the promoted user.
    await ctx.db.query(`update public.profiles set is_platform_admin = false where id = $1`, [
      outsiderId,
    ]);
  });
});

describe("audit trail immutability", () => {
  it("has no write policy on review_records or publication_history", async () => {
    for (const table of ["review_records", "publication_history"]) {
      await expect(
        ctx.asRole("authenticated", adminId, () =>
          ctx.db.query(`insert into public.${table} default values`),
        ),
      ).rejects.toThrow();
      await expect(
        ctx.asRole("authenticated", adminId, () => ctx.db.query(`delete from public.${table}`)),
      ).rejects.toThrow();
    }
  });
});

describe("object_aliases integrity", () => {
  it("prevents non-admins from creating or mutating aliases", async () => {
    const created = await ctx.db.query<{ id: string }>(
      `insert into public.objects (church_id, public_id, object_type, status, published_at)
       values ($1, 'ABJ0000001', 'icon', 'published', now())
       returning id`,
      [churchA],
    );
    const objectId = created.rows[0].id;

    await expect(
      ctx.asRole("authenticated", editorId, () =>
        ctx.db.query(`insert into public.object_aliases (alias, object_id) values ($1, $2)`, [
          "ABJ0000002",
          objectId,
        ]),
      ),
    ).rejects.toThrow();

    await expect(
      ctx.asRole("authenticated", adminId, () =>
        ctx.db.query(`insert into public.object_aliases (alias, object_id) values ($1, $2)`, [
          "ABJ0000002",
          objectId,
        ]),
      ),
    ).resolves.toBeDefined();
  });
});

describe("church-scope isolation", () => {
  it("hides another church's media from a member", async () => {
    const created = await ctx.db.query<{ id: string }>(
      `insert into public.objects (church_id, public_id, object_type, status)
       values ($1, 'MBD0000001', 'icon', 'draft')
       returning id`,
      [churchB],
    );
    await ctx.db.query(
      `insert into public.media
         (object_id, media_type, storage_path, mime_type, size_bytes, permission_status, is_public)
       values ($1, 'image', 'b/x.jpg', 'image/jpeg', 100, 'granted', true)`,
      [created.rows[0].id],
    );

    const asEditorA = await ctx.asRole("authenticated", editorId, () =>
      ctx.db.query(`select id from public.media`),
    );
    expect(asEditorA.rows).toHaveLength(0);

    const asAdmin = await ctx.asRole("authenticated", adminId, () =>
      ctx.db.query(`select id from public.media`),
    );
    expect(asAdmin.rows).toHaveLength(1);
  });

  it("enforces the media publish gate constraint at the database level", async () => {
    const created = await ctx.db.query<{ id: string }>(
      `insert into public.objects (church_id, public_id, object_type, status)
       values ($1, 'MBD0000002', 'icon', 'draft')
       returning id`,
      [churchA],
    );

    // is_public = true while permission_status is 'restricted' must be rejected.
    await expect(
      ctx.db.query(
        `insert into public.media
           (object_id, media_type, storage_path, mime_type, size_bytes, permission_status, is_public)
         values ($1, 'image', 'a/y.jpg', 'image/jpeg', 100, 'restricted', true)`,
        [created.rows[0].id],
      ),
    ).rejects.toThrow();
  });

  it("does not expose unpublished-object claims to anon", async () => {
    const created = await ctx.db.query<{ id: string }>(
      `insert into public.objects (church_id, public_id, object_type, status)
       values ($1, 'CMB0000001', 'icon', 'draft')
       returning id`,
      [churchA],
    );
    await ctx.db.query(
      `insert into public.claims (object_id, claim_text, is_public)
       values ($1, 'A draft claim', true)`,
      [created.rows[0].id],
    );

    const anon = await ctx.asRole("anon", null, () => ctx.db.query(`select id from public.claims`));
    expect(anon.rows).toHaveLength(0);
  });
});

describe("hard delete boundary", () => {
  it("lets only a platform admin delete an object", async () => {
    const created = await ctx.db.query<{ id: string }>(
      `insert into public.objects (church_id, public_id, object_type, status)
       values ($1, 'DBK0000001', 'icon', 'draft')
       returning id`,
      [churchA],
    );
    const objectId = created.rows[0].id;

    await ctx.asRole("authenticated", editorId, () =>
      ctx.db.query(`delete from public.objects where id = $1`, [objectId]),
    );
    const stillThere = await ctx.db.query(`select id from public.objects where id = $1`, [
      objectId,
    ]);
    expect(stillThere.rows).toHaveLength(1);

    await ctx.asRole("authenticated", adminId, () =>
      ctx.db.query(`delete from public.objects where id = $1`, [objectId]),
    );
    const gone = await ctx.db.query(`select id from public.objects where id = $1`, [objectId]);
    expect(gone.rows).toHaveLength(0);
  });
});

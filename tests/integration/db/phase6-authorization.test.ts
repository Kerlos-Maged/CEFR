import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "./harness";

/**
 * Phase 6 authorization and content-integrity tests against the real migrations and RLS policies
 * (PGlite). These exercise the database-enforced boundary that the admin server actions rely on:
 * the server actions add UX guards, but the security guarantee is RLS + the workflow functions.
 *
 * Covers Phase 7 checklist items 1-6, 8, 9, 13 (the parts expressible at the SQL layer). Item 10
 * (public field exposure) and 12 (input validation) are covered by the DAL/validation unit tests.
 */

let ctx: TestDb;
let churchA: string;
let churchB: string;
let adminId: string;
let editorA: string;
let reviewerA: string;
let approverA: string;
let editorB: string;
let outsider: string;

const transition = (objectId: string, to: string, notes: string | null = null) =>
  ctx.db.query(`select public.transition_object_status($1, $2::public.object_status, $3)`, [
    objectId,
    to,
    notes,
  ]);

let counter = 0;
function uniquePublicId(prefix = "P6") {
  counter += 1;
  // 2-char prefix + 8 zero-padded digits = exactly 10 chars, all in the Crockford alphabet
  // (digits 0-9 and letters excluding I, L, O, U).
  return prefix + String(counter).padStart(8, "0");
}

async function seedObject(
  churchId: string,
  status: string,
  extra = "",
): Promise<{ id: string; publicId: string }> {
  const publicId = uniquePublicId();
  const { rows } = await ctx.db.query<{ id: string }>(
    `insert into public.objects (church_id, public_id, object_type, status ${extra.includes("published_at") ? ", published_at" : ""})
     values ($1, $2, 'icon', $3::public.object_status ${extra.includes("published_at") ? ", now()" : ""})
     returning id`,
    [churchId, publicId, status],
  );
  return { id: rows[0].id, publicId };
}

beforeAll(async () => {
  ctx = await createTestDb();

  churchA = await ctx.createChurch();
  churchB = await ctx.createChurch();

  adminId = await ctx.createUser({ admin: true });
  editorA = await ctx.createUser();
  reviewerA = await ctx.createUser();
  approverA = await ctx.createUser();
  editorB = await ctx.createUser();
  outsider = await ctx.createUser();

  await ctx.addMembership(editorA, churchA, "editor");
  await ctx.addMembership(reviewerA, churchA, "historical_reviewer");
  await ctx.addMembership(approverA, churchA, "church_approver");
  await ctx.addMembership(editorB, churchB, "editor");
});

afterAll(async () => {
  await ctx.close();
});

describe("draft confidentiality (Phase 7 item 1, 8)", () => {
  it("never exposes drafts to anon, even with a direct query", async () => {
    await seedObject(churchA, "draft");
    const rows = await ctx.asRole("anon", null, () =>
      ctx.db.query(`select public_id from public.objects where status = 'draft'`),
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("keeps archived objects out of anon reads", async () => {
    await seedObject(churchA, "archived", "published_at");
    const rows = await ctx.asRole("anon", null, () =>
      ctx.db.query(`select public_id from public.objects where status = 'archived'`),
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("keeps unpublished translations private", async () => {
    const { id } = await seedObject(churchA, "draft");
    await ctx.db.query(
      `insert into public.object_translations (object_id, language_code, title) values ($1, 'en', 'Secret')`,
      [id],
    );
    const rows = await ctx.asRole("anon", null, () =>
      ctx.db.query(`select title from public.object_translations where object_id = $1`, [id]),
    );
    expect(rows.rows).toHaveLength(0);
  });
});

describe("cross-church isolation (Phase 7 item 2)", () => {
  it("hides another church's private object from an editor", async () => {
    const { id } = await seedObject(churchB, "draft");
    const rows = await ctx.asRole("authenticated", editorA, () =>
      ctx.db.query(`select id from public.objects where id = $1`, [id]),
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("prevents an editor updating another church's object", async () => {
    const { id } = await seedObject(churchB, "draft");
    const result = await ctx.asRole("authenticated", editorA, () =>
      ctx.db.query(`update public.objects set materials = 'x' where id = $1 returning id`, [id]),
    );
    // RLS filters the row so nothing is updated.
    expect(result.rows).toHaveLength(0);
  });
});

describe("role separation (Phase 7 item 3)", () => {
  it("stops an editor approving their own object", async () => {
    const { id } = await seedObject(churchA, "church_review");
    await expect(
      ctx.asRole("authenticated", editorA, () => transition(id, "published")),
    ).rejects.toThrow();
  });

  it("stops an editor recording a historical review", async () => {
    const { id } = await seedObject(churchA, "historical_review");
    await expect(
      ctx.asRole("authenticated", editorA, () =>
        ctx.db.query(`select public.record_review($1,'historical_review','approved',null)`, [id]),
      ),
    ).rejects.toThrow();
  });

  it("stops a reviewer publishing", async () => {
    const { id } = await seedObject(churchA, "church_review");
    await expect(
      ctx.asRole("authenticated", reviewerA, () => transition(id, "published")),
    ).rejects.toThrow();
  });

  it("only the church approver may publish", async () => {
    const { id } = await seedObject(churchA, "church_review");
    await ctx.asRole("authenticated", approverA, () => transition(id, "published"));
    const status = await ctx.db.query<{ status: string }>(
      `select status from public.objects where id = $1`,
      [id],
    );
    expect(status.rows[0].status).toBe("published");
  });

  it("does not permit an admin to bypass church approval (Q6)", async () => {
    const { id } = await seedObject(churchA, "church_review");
    await expect(
      ctx.asRole("authenticated", adminId, () => transition(id, "published")),
    ).rejects.toThrow();
  });
});

describe("privilege escalation (Phase 7 item 4)", () => {
  it("stops a non-admin inserting memberships", async () => {
    await expect(
      ctx.asRole("authenticated", editorA, () =>
        ctx.db.query(
          `insert into public.church_memberships (user_id, church_id, role)
           values ($1, $2, 'church_approver')`,
          [editorA, churchA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("stops a non-admin promoting themselves to platform admin", async () => {
    const result = await ctx.asRole("authenticated", outsider, () =>
      ctx.db.query(
        `update public.profiles set is_platform_admin = true where id = $1 returning id`,
        [outsider],
      ),
    );
    expect(result.rows).toHaveLength(0);
  });

  it("lets a platform admin grant a membership", async () => {
    await expect(
      ctx.asRole("authenticated", adminId, () =>
        ctx.db.query(
          `insert into public.church_memberships (user_id, church_id, role)
           values ($1, $2, 'editor')`,
          [outsider, churchA],
        ),
      ),
    ).resolves.toBeDefined();
  });
});

describe("protected fields (Phase 7 item 5)", () => {
  it("blocks changing church_id through an update", async () => {
    const { id } = await seedObject(churchA, "draft");
    await expect(
      ctx.db.query(`update public.objects set church_id = $1 where id = $2`, [churchB, id]),
    ).rejects.toThrow();
  });

  it("blocks changing public_id through an update", async () => {
    const { id } = await seedObject(churchA, "draft");
    await expect(
      ctx.db.query(`update public.objects set public_id = 'ZZZZZZZZZZ' where id = $1`, [id]),
    ).rejects.toThrow();
  });

  it("blocks a direct status write even for a platform admin", async () => {
    const { id } = await seedObject(churchA, "draft");
    await expect(
      ctx.asRole("authenticated", adminId, () =>
        ctx.db.query(`update public.objects set status = 'published' where id = $1`, [id]),
      ),
    ).rejects.toThrow();
  });
});

describe("illegal transitions (Phase 7 item 6)", () => {
  it("rejects draft -> published directly", async () => {
    const { id } = await seedObject(churchA, "draft");
    await expect(
      ctx.asRole("authenticated", approverA, () => transition(id, "published")),
    ).rejects.toThrow();
  });

  it("rejects published -> church_review", async () => {
    const { id } = await seedObject(churchA, "published", "published_at");
    await expect(
      ctx.asRole("authenticated", approverA, () => transition(id, "church_review")),
    ).rejects.toThrow();
  });
});

describe("storage and audit integrity (Phase 7 items 9, 13)", () => {
  it("excludes restricted media from anon reads", async () => {
    const { id } = await seedObject(churchA, "published", "published_at");
    // Restricted rights => the row may not be public (media_publish_gate_check), and even a
    // public row with restricted rights is filtered by the anon media policy.
    await ctx.db.query(
      `insert into public.media
         (object_id, media_type, storage_path, mime_type, size_bytes, permission_status, is_public)
       values ($1, 'image', 'a/b/c.jpg', 'image/jpeg', 10, 'restricted', false)`,
      [id],
    );
    const rows = await ctx.asRole("anon", null, () =>
      ctx.db.query(`select id from public.media where object_id = $1`, [id]),
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("refuses to publish media without granted rights (check constraint)", async () => {
    const { id } = await seedObject(churchA, "draft");
    await expect(
      ctx.db.query(
        `insert into public.media
           (object_id, media_type, storage_path, mime_type, size_bytes, permission_status, is_public)
         values ($1, 'image', 'a/b/d.jpg', 'image/jpeg', 10, 'pending', true)`,
        [id],
      ),
    ).rejects.toThrow();
  });

  it("protects audit records from modification and deletion", async () => {
    const { id } = await seedObject(churchA, "draft");
    await ctx.asRole("authenticated", editorA, () => transition(id, "historical_review"));
    const before = await ctx.db.query<{ count: number }>(
      `select count(*)::int as count from public.publication_history where object_id = $1`,
      [id],
    );
    expect(before.rows[0].count).toBe(1);

    // No write policy exists on publication_history for authenticated users.
    await expect(
      ctx.asRole("authenticated", adminId, () =>
        ctx.db.query(`delete from public.publication_history where object_id = $1`, [id]),
      ),
    ).rejects.toThrow();
    await expect(
      ctx.asRole("authenticated", adminId, () =>
        ctx.db.query(
          `update public.publication_history set notes = 'tampered' where object_id = $1`,
          [id],
        ),
      ),
    ).rejects.toThrow();

    const after = await ctx.db.query<{ count: number }>(
      `select count(*)::int as count from public.publication_history where object_id = $1`,
      [id],
    );
    expect(after.rows[0].count).toBe(1);
  });

  it("scopes review-record reads to the object's church members", async () => {
    const { id } = await seedObject(churchA, "historical_review");
    await ctx.asRole("authenticated", reviewerA, () =>
      ctx.db.query(
        `select public.record_review($1,'historical_review','changes_requested','redo')`,
        [id],
      ),
    );
    const mine = await ctx.asRole("authenticated", editorA, () =>
      ctx.db.query(`select id from public.review_records where object_id = $1`, [id]),
    );
    expect(mine.rows).toHaveLength(1);

    const other = await ctx.asRole("authenticated", editorB, () =>
      ctx.db.query(`select id from public.review_records where object_id = $1`, [id]),
    );
    expect(other.rows).toHaveLength(0);
  });
});

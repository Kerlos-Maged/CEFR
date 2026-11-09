import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "./harness";

let ctx: TestDb;
let churchA: string;
let churchB: string;
let adminId: string;
let editorId: string;
let reviewerId: string;
let approverId: string;
let outsiderId: string;

const transition = (objectId: string, to: string) =>
  ctx.db.query(`select public.transition_object_status($1, $2::public.object_status, $3)`, [
    objectId,
    to,
    null,
  ]);

const review = (objectId: string, type: string, decision: string, notes: string | null) =>
  ctx.db.query(
    `select public.record_review($1, $2::public.review_type, $3::public.review_decision, $4)`,
    [objectId, type, decision, notes],
  );

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

  // Fixtures inserted as the (superuser) owner, bypassing RLS.
  await ctx.db.query(
    `insert into public.objects (church_id, public_id, object_type, status, published_at)
     values ($1, 'PBC0000001', 'icon', 'published', now())`,
    [churchA],
  );
  await ctx.db.query(
    `insert into public.objects (church_id, public_id, object_type, status)
     values ($1, 'DRF0000001', 'icon', 'draft')`,
    [churchA],
  );
  await ctx.db.query(
    `insert into public.objects (church_id, public_id, object_type, status)
     values ($1, 'DRF0000002', 'icon', 'draft')`,
    [churchB],
  );
  await ctx.db.query(
    `insert into public.object_translations (object_id, language_code, title)
     select id, 'en', 'Published title' from public.objects where public_id = 'PBC0000001'`,
  );
  await ctx.db.query(
    `insert into public.object_translations (object_id, language_code, title)
     select id, 'en', 'Draft title' from public.objects where public_id = 'DRF0000001'`,
  );
  await ctx.db.query(
    `insert into public.objects (church_id, public_id, object_type, status, archived_at)
     values ($1, 'ARC0000001', 'icon', 'archived', now())`,
    [churchA],
  );
  await ctx.db.query(
    `insert into public.object_aliases (alias, object_id)
     select 'AXAB000001', id from public.objects where public_id = 'PBC0000001'`,
  );
});

afterAll(async () => {
  await ctx.close();
});

describe("row level security: public reads", () => {
  it("lets anon read only published objects", async () => {
    const { rows } = await ctx.asRole("anon", null, () =>
      ctx.db.query<{ public_id: string }>(
        `select public_id from public.objects order by public_id`,
      ),
    );
    expect(rows.map((r) => r.public_id)).toEqual(["PBC0000001"]);
  });

  it("lets anon read only translations of published objects", async () => {
    const { rows } = await ctx.asRole("anon", null, () =>
      ctx.db.query<{ title: string }>(`select title from public.object_translations`),
    );
    expect(rows.map((r) => r.title)).toEqual(["Published title"]);
  });

  it("prevents anon from writing", async () => {
    await expect(
      ctx.asRole("anon", null, () =>
        ctx.db.query(
          `insert into public.objects (church_id, public_id, object_type)
           values ($1, 'ANN0000001', 'icon')`,
          [churchA],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("public id resolution", () => {
  it("resolves a published id and its alias, but hides in-progress objects", async () => {
    const published = await ctx.asRole("anon", null, () =>
      ctx.db.query<{ status: string }>(`select status from public.resolve_public_id('PBC0000001')`),
    );
    expect(published.rows[0].status).toBe("published");

    const alias = await ctx.asRole("anon", null, () =>
      ctx.db.query<{ canonical_public_id: string; status: string }>(
        `select canonical_public_id, status from public.resolve_public_id('AXAB000001')`,
      ),
    );
    expect(alias.rows[0]).toEqual({ canonical_public_id: "PBC0000001", status: "published" });

    const archived = await ctx.asRole("anon", null, () =>
      ctx.db.query<{ status: string }>(`select status from public.resolve_public_id('ARC0000001')`),
    );
    expect(archived.rows[0].status).toBe("archived");

    const draft = await ctx.asRole("anon", null, () =>
      ctx.db.query(`select * from public.resolve_public_id('DRF0000001')`),
    );
    expect(draft.rows).toHaveLength(0);

    const missing = await ctx.asRole("anon", null, () =>
      ctx.db.query(`select * from public.resolve_public_id('ZZZZZZZZZZ')`),
    );
    expect(missing.rows).toHaveLength(0);
  });
});

describe("row level security: church scope", () => {
  it("lets an editor create a draft in their own church", async () => {
    const { rows } = await ctx.asRole("authenticated", editorId, () =>
      ctx.db.query<{ status: string }>(
        `insert into public.objects (church_id, public_id, object_type)
         values ($1, 'EDT0000001', 'icon')
         returning status`,
        [churchA],
      ),
    );
    expect(rows[0].status).toBe("draft");
  });

  it("stops an editor creating content in another church", async () => {
    await expect(
      ctx.asRole("authenticated", editorId, () =>
        ctx.db.query(
          `insert into public.objects (church_id, public_id, object_type)
           values ($1, 'EDT0000002', 'icon')`,
          [churchB],
        ),
      ),
    ).rejects.toThrow();
  });

  it("hides other churches' drafts from an editor", async () => {
    const { rows } = await ctx.asRole("authenticated", editorId, () =>
      ctx.db.query(`select public_id from public.objects where church_id = $1`, [churchB]),
    );
    expect(rows).toHaveLength(0);
  });

  it("blocks a direct status write by an editor", async () => {
    const { rows } = await ctx.db.query<{ id: string }>(
      `select id from public.objects where public_id = 'EDT0000001'`,
    );
    const objectId = rows[0].id;
    await expect(
      ctx.asRole("authenticated", editorId, () =>
        ctx.db.query(`update public.objects set status = 'published' where id = $1`, [objectId]),
      ),
    ).rejects.toThrow();
  });

  it("lets only platform admins write memberships", async () => {
    await expect(
      ctx.asRole("authenticated", editorId, () =>
        ctx.db.query(
          `insert into public.church_memberships (user_id, church_id, role)
           values ($1, $2, 'church_approver')`,
          [editorId, churchB],
        ),
      ),
    ).rejects.toThrow();

    await expect(
      ctx.asRole("authenticated", adminId, () =>
        ctx.db.query(
          `insert into public.church_memberships (user_id, church_id, role)
           values ($1, $2, 'church_approver')`,
          [editorId, churchB],
        ),
      ),
    ).resolves.toBeDefined();
  });

  it("scopes profile reads to self unless platform admin", async () => {
    const self = await ctx.asRole("authenticated", outsiderId, () =>
      ctx.db.query<{ id: string }>(`select id from public.profiles`),
    );
    expect(self.rows.map((r) => r.id)).toEqual([outsiderId]);

    const all = await ctx.asRole("authenticated", adminId, () =>
      ctx.db.query<{ id: string }>(`select id from public.profiles`),
    );
    expect(all.rows.length).toBeGreaterThan(1);
  });
});

describe("workflow: transitions and reviews", () => {
  let objectId: string;

  it("runs the full draft -> historical_review -> church_review -> published path", async () => {
    const created = await ctx.asRole("authenticated", editorId, () =>
      ctx.db.query<{ id: string }>(
        `insert into public.objects (church_id, public_id, object_type)
         values ($1, 'WF00000001', 'icon')
         returning id`,
        [churchA],
      ),
    );
    objectId = created.rows[0].id;

    await ctx.asRole("authenticated", editorId, () => transition(objectId, "historical_review"));
    await ctx.asRole("authenticated", reviewerId, () =>
      review(objectId, "historical_review", "approved", null),
    );
    const mid = await ctx.db.query<{ status: string }>(
      `select status from public.objects where id = $1`,
      [objectId],
    );
    expect(mid.rows[0].status).toBe("church_review");

    await ctx.asRole("authenticated", approverId, () =>
      review(objectId, "church_approval", "approved", null),
    );
    const final = await ctx.db.query<{ status: string; published_at: string | null }>(
      `select status, published_at from public.objects where id = $1`,
      [objectId],
    );
    expect(final.rows[0].status).toBe("published");
    expect(final.rows[0].published_at).not.toBeNull();

    const history = await ctx.db.query<{ count: number }>(
      `select count(*)::int as count from public.publication_history where object_id = $1`,
      [objectId],
    );
    expect(history.rows[0].count).toBe(3);
  });

  it("refuses a review from the wrong role without side effects", async () => {
    const created = await ctx.db.query<{ id: string }>(
      `insert into public.objects (church_id, public_id, object_type, status)
       values ($1, 'WF00000002', 'icon', 'historical_review')
       returning id`,
      [churchA],
    );
    const id = created.rows[0].id;

    await expect(
      ctx.asRole("authenticated", editorId, () =>
        review(id, "historical_review", "approved", null),
      ),
    ).rejects.toThrow();

    const reviews = await ctx.db.query<{ count: number }>(
      `select count(*)::int as count from public.review_records where object_id = $1`,
      [id],
    );
    expect(reviews.rows[0].count).toBe(0);
    const status = await ctx.db.query<{ status: string }>(
      `select status from public.objects where id = $1`,
      [id],
    );
    expect(status.rows[0].status).toBe("historical_review");
  });

  it("requires notes when a review is not approved", async () => {
    const created = await ctx.db.query<{ id: string }>(
      `insert into public.objects (church_id, public_id, object_type, status)
       values ($1, 'WF00000003', 'icon', 'historical_review')
       returning id`,
      [churchA],
    );
    const id = created.rows[0].id;

    await expect(
      ctx.asRole("authenticated", reviewerId, () =>
        review(id, "historical_review", "changes_requested", null),
      ),
    ).rejects.toThrow();

    await ctx.asRole("authenticated", reviewerId, () =>
      review(id, "historical_review", "changes_requested", "Please add sources."),
    );
    const status = await ctx.db.query<{ status: string }>(
      `select status from public.objects where id = $1`,
      [id],
    );
    expect(status.rows[0].status).toBe("draft");
  });

  it("does not let an editor publish without church approval", async () => {
    const created = await ctx.db.query<{ id: string }>(
      `insert into public.objects (church_id, public_id, object_type, status)
       values ($1, 'WF00000004', 'icon', 'church_review')
       returning id`,
      [churchA],
    );
    const id = created.rows[0].id;
    await expect(
      ctx.asRole("authenticated", editorId, () => transition(id, "published")),
    ).rejects.toThrow();
  });

  it("rejects illegal transitions", async () => {
    const created = await ctx.db.query<{ id: string }>(
      `insert into public.objects (church_id, public_id, object_type, status, published_at)
       values ($1, 'WF00000005', 'icon', 'published', now())
       returning id`,
      [churchA],
    );
    const id = created.rows[0].id;
    await expect(
      ctx.asRole("authenticated", approverId, () => transition(id, "church_review")),
    ).rejects.toThrow();
  });

  it("only exposes published objects' media to anon", async () => {
    const object = await ctx.db.query<{ id: string }>(
      `select id from public.objects where public_id = 'PBC0000001'`,
    );
    await ctx.db.query(
      `insert into public.media
         (object_id, media_type, storage_path, mime_type, size_bytes, permission_status, is_public)
       values ($1, 'image', 'demo/x.jpg', 'image/jpeg', 100, 'granted', true)`,
      [object.rows[0].id],
    );
    const anon = await ctx.asRole("anon", null, () => ctx.db.query(`select id from public.media`));
    expect(anon.rows).toHaveLength(1);
  });
});

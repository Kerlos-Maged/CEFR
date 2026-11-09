import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "./harness";

let ctx: TestDb;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.close();
});

describe("schema migrations", () => {
  it("seeds the language registry", async () => {
    const { rows } = await ctx.db.query<{ code: string; direction: string; is_active: boolean }>(
      `select code, direction, is_active from public.languages order by code`,
    );
    expect(rows).toEqual([
      { code: "ar", direction: "rtl", is_active: true },
      { code: "en", direction: "ltr", is_active: true },
    ]);
  });

  it("creates every enum with the expected labels", async () => {
    const { rows } = await ctx.db.query<{ typname: string; labels: string[] }>(
      `select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as labels
         from pg_type t
         join pg_enum e on e.enumtypid = t.oid
        group by t.typname
        order by t.typname`,
    );
    const byName = Object.fromEntries(rows.map((r) => [r.typname, r.labels]));
    expect(byName.object_status).toEqual([
      "draft",
      "historical_review",
      "church_review",
      "published",
      "archived",
    ]);
    expect(byName.entity_status).toEqual(["active", "archived"]);
    expect(byName.membership_role).toEqual(["editor", "historical_reviewer", "church_approver"]);
    expect(byName.review_decision).toEqual(["approved", "rejected", "changes_requested"]);
    expect(byName.analytics_event_type).toEqual([
      "page_view",
      "language_select",
      "audio_play",
      "audio_complete",
    ]);
  });

  it("enforces the public_id Crockford Base32 format and uniqueness", async () => {
    await ctx.createChurch("11111111-1111-4111-8111-111111111111", "format-church");

    await expect(
      ctx.db.query(
        `insert into public.objects (church_id, public_id, object_type)
         values ('11111111-1111-4111-8111-111111111111', 'BAD-ID!!', 'icon')`,
      ),
    ).rejects.toThrow();

    await ctx.db.query(
      `insert into public.objects (church_id, public_id, object_type)
       values ('11111111-1111-4111-8111-111111111111', 'AAAA000001', 'icon')`,
    );

    await expect(
      ctx.db.query(
        `insert into public.objects (church_id, public_id, object_type)
         values ('11111111-1111-4111-8111-111111111111', 'AAAA000001', 'icon')`,
      ),
    ).rejects.toThrow();
  });

  it("enforces the lowercase slug format", async () => {
    await expect(
      ctx.db.query(`insert into public.churches (slug) values ('Not A Slug')`),
    ).rejects.toThrow();
  });

  it("enforces the media publication gate", async () => {
    await expect(
      ctx.db.query(
        `insert into public.media
           (object_id, media_type, storage_path, mime_type, size_bytes, permission_status, is_public)
         values (
           (select id from public.objects where public_id = 'AAAA000001'),
           'image', 'x/y.jpg', 'image/jpeg', 10, 'pending', true
         )`,
      ),
    ).rejects.toThrow();
  });

  it("exposes the translation-status view", async () => {
    const { rows } = await ctx.db.query<{ count: number }>(
      `select count(*)::int as count from public.object_translation_status`,
    );
    expect(rows[0].count).toBeGreaterThan(0);
  });
});

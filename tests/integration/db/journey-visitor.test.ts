import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabaseClient } from "@/lib/db/client";
import { getPublishedObjectByPublicId, resolvePublicId } from "@/lib/db/objects";

import { createFakeClient, type FakeSupabaseClient } from "./fake-supabase-client";
import { createTestDb, type TestDb } from "./harness";

/**
 * Journey A (visitor scans a QR code) exercised through the **real** public data-access layer
 * (`lib/db/objects.ts`) against the real migrations, using a PostgREST-shaped adapter over PGlite
 * and the `anon` role so RLS applies exactly as in production.
 *
 * This is the strongest end-to-end verification available without Docker/hosted Supabase: it
 * proves the SQL the DAL emits, the RLS the page relies on, the 404-vs-410 resolution, the locale
 * fallback, and the media/permission filtering all behave correctly and return only public data.
 */

let ctx: TestDb;
let client: FakeSupabaseClient;
let dbClient: DatabaseClient;

const CHURCH = "11111111-1111-4111-8111-111111111111";

async function seed() {
  await ctx.db.query(
    `insert into public.churches (id, slug, status) values ($1, 'journey-church', 'active')`,
    [CHURCH],
  );
  await ctx.db.query(
    `insert into public.church_translations (church_id, language_code, name) values ($1, 'en', 'Journey Church')`,
    [CHURCH],
  );

  const objects: [string, string, string, string | null][] = [
    ["aaaaaaaa-0000-4000-8000-00000000000a", "PBB000000A", "published", "18th century"],
    ["aaaaaaaa-0000-4000-8000-00000000000f", "FAA000000F", "published", "unknown"],
    ["aaaaaaaa-0000-4000-8000-00000000000b", "DFT000000B", "draft", null],
    ["aaaaaaaa-0000-4000-8000-00000000000c", "REV000000C", "historical_review", null],
    ["aaaaaaaa-0000-4000-8000-00000000000d", "APR000000D", "church_review", null],
    ["aaaaaaaa-0000-4000-8000-00000000000e", "ARC000000E", "archived", "c. 1700"],
  ];
  for (const [id, publicId, status, date] of objects) {
    await ctx.db.query(
      `insert into public.objects (id, church_id, public_id, object_type, approximate_date, default_language, status, published_at, archived_at)
       values ($1, $2, $3, 'icon', $4, 'en', $5::public.object_status,
               case when $5 = 'published' then now() else null end,
               case when $5 = 'archived' then now() else null end)`,
      [id, CHURCH, publicId, date, status],
    );
  }

  // Translations: published object has en + ar; the ar row is used to test fallback.
  await ctx.db.query(
    `insert into public.object_translations (object_id, language_code, title, description)
     values
       ('aaaaaaaa-0000-4000-8000-00000000000a', 'en', 'Published Icon', 'An English description.'),
       ('aaaaaaaa-0000-4000-8000-00000000000a', 'ar', 'أيقونة منشورة', 'وصف بالعربية.'),
       ('aaaaaaaa-0000-4000-8000-00000000000f', 'en', 'English Only Icon', 'Only English exists.'),
       ('aaaaaaaa-0000-4000-8000-00000000000b', 'en', 'Draft Icon', 'Must never be public.')`,
  );

  // Alias for the published object (retired-id resolution).
  await ctx.db.query(
    `insert into public.object_aliases (alias, object_id) values ('ABB000000A', 'aaaaaaaa-0000-4000-8000-00000000000a')`,
  );

  // Media: one licensed public image and one public-domain image (both included), plus a
  // not-public image (excluded). The DB publish-gate forbids a restricted+public row, so the
  // permission branch of the DAL filter is defence-in-depth beyond what the schema can hold.
  await ctx.db.query(
    `insert into public.media (id, object_id, media_type, storage_path, bucket, mime_type, size_bytes, permission_status, is_public, sort_order)
     values
       ('bbbbbbbb-0000-4000-8000-0000000000b1', 'aaaaaaaa-0000-4000-8000-00000000000a', 'image', 'c/p/1.jpg', 'object-media', 'image/jpeg', 100, 'granted', true, 0),
       ('bbbbbbbb-0000-4000-8000-0000000000b2', 'aaaaaaaa-0000-4000-8000-00000000000a', 'image', 'c/p/2.jpg', 'object-media', 'image/jpeg', 100, 'public_domain', true, 1),
       ('bbbbbbbb-0000-4000-8000-0000000000b3', 'aaaaaaaa-0000-4000-8000-00000000000a', 'image', 'c/p/3.jpg', 'object-media', 'image/jpeg', 100, 'granted', false, 2)`,
  );
  await ctx.db.query(
    `insert into public.media_translations (media_id, language_code, caption, alt_text)
     values ('bbbbbbbb-0000-4000-8000-0000000000b1', 'en', 'The icon', 'A fictional icon.')`,
  );

  // A public claim on the published object; a private claim that must be hidden.
  await ctx.db.query(
    `insert into public.claims (id, object_id, claim_text, is_public, verification)
     values
       ('cccccccc-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-00000000000a', 'Public claim.', true, 'verified'),
       ('cccccccc-0000-4000-8000-0000000000c2', 'aaaaaaaa-0000-4000-8000-00000000000a', 'Private claim.', false, 'uncertain')`,
  );
}

beforeAll(async () => {
  ctx = await createTestDb();
  client = createFakeClient(ctx.db);
  dbClient = client as unknown as DatabaseClient;
  await seed();
});

afterAll(async () => {
  await ctx.close();
});

describe("Journey A — visitor scans a QR code (real DAL over RLS)", () => {
  it("resolves a published id as available with its canonical id", async () => {
    const resolution = await ctx.asRole("anon", null, () =>
      resolvePublicId("PBB000000A", dbClient),
    );
    expect(resolution).toEqual({
      kind: "available",
      objectId: "aaaaaaaa-0000-4000-8000-00000000000a",
      canonicalPublicId: "PBB000000A",
    });
  });

  it("resolves an alias to the canonical public id", async () => {
    const resolution = await ctx.asRole("anon", null, () =>
      resolvePublicId("ABB000000A", dbClient),
    );
    expect(resolution).toEqual({
      kind: "available",
      objectId: "aaaaaaaa-0000-4000-8000-00000000000a",
      canonicalPublicId: "PBB000000A",
    });
  });

  it("reports an archived id as gone (HTTP 410 semantics)", async () => {
    const resolution = await ctx.asRole("anon", null, () =>
      resolvePublicId("ARC000000E", dbClient),
    );
    expect(resolution).toEqual({ kind: "gone" });
  });

  it.each(["DFT000000B", "REV000000C", "APR000000D"])(
    "hides in-progress object %s (404, not confirmable)",
    async (publicId) => {
      const resolution = await ctx.asRole("anon", null, () => resolvePublicId(publicId, dbClient));
      expect(resolution).toBeNull();
    },
  );

  it("returns null for an unknown id and for a malformed id", async () => {
    const unknown = await ctx.asRole("anon", null, () => resolvePublicId("ZZZZZZZZZZ", dbClient));
    expect(unknown).toBeNull();
    const malformed = await ctx.asRole("anon", null, () => resolvePublicId("not-valid", dbClient));
    expect(malformed).toBeNull();
  });

  it("loads a published object with locale content, media and claims", async () => {
    const object = await ctx.asRole("anon", null, () =>
      getPublishedObjectByPublicId("PBB000000A", "en", dbClient),
    );
    expect(object).not.toBeNull();
    expect(object?.publicId).toBe("PBB000000A");
    expect(object?.content?.title).toBe("Published Icon");
    expect(object?.usedFallback).toBe(false);
    // Only the two releasable images are included; the not-public image is excluded.
    expect(object?.media.map((m) => m.storagePath)).toEqual(["c/p/1.jpg", "c/p/2.jpg"]);
    // Only the public claim is included.
    expect(object?.claims.map((c) => c.text)).toEqual(["Public claim."]);
  });

  it("serves the Arabic translation without a fallback notice", async () => {
    const object = await ctx.asRole("anon", null, () =>
      getPublishedObjectByPublicId("PBB000000A", "ar", dbClient),
    );
    expect(object?.content?.title).toBe("أيقونة منشورة");
    expect(object?.usedFallback).toBe(false);
  });

  it("falls back to the default language for a missing translation", async () => {
    // FAA000000F is published but has only an English translation; requesting Arabic must fall
    // back to English and flag it, so the UI can show a "not yet translated" notice (FR-ML-4).
    const object = await ctx.asRole("anon", null, () =>
      getPublishedObjectByPublicId("FAA000000F", "ar", dbClient),
    );
    expect(object?.content?.title).toBe("English Only Icon");
    expect(object?.usedFallback).toBe(true);
    expect(object?.requestedLocale).toBe("ar");
    expect(object?.defaultLanguage).toBe("en");
  });

  it("never exposes an in-progress object through the published getter, even to anon", async () => {
    for (const publicId of ["DFT000000B", "REV000000C", "APR000000D", "ARC000000E"]) {
      const object = await ctx.asRole("anon", null, () =>
        getPublishedObjectByPublicId(publicId, "en", dbClient),
      );
      expect(object).toBeNull();
    }
  });

  it("builds a non-null public storage URL only for public media", async () => {
    const object = await ctx.asRole("anon", null, () =>
      getPublishedObjectByPublicId("PBB000000A", "en", dbClient),
    );
    expect(object?.media[0].url).toContain("/storage/v1/object/public/object-media/c/p/1.jpg");
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabaseClient } from "@/lib/db/client";
import { getPublishedObjectByPublicId, resolvePublicId } from "@/lib/db/objects";

import { createFakeClient, type FakeSupabaseClient } from "./fake-supabase-client";
import { createTestDb, type TestDb } from "./harness";

/**
 * Journey C — the editorial lifecycle, verified end-to-end against the real transition functions,
 * review records, and RLS, and cross-checked against what the *visitor* sees at each step through
 * the real public DAL. This is the contract that matters most: an object must become publicly
 * visible at exactly the moment it is published and disappear again when unpublished or archived.
 *
 * It also asserts the authorization boundary: each transition is only permitted for the role that
 * owns it, publishing is exclusively the church approver's (no admin override; Q6), and status can
 * never be changed by a direct UPDATE (the guard trigger rejects it).
 */

let ctx: TestDb;
let client: FakeSupabaseClient;
let dbClient: DatabaseClient;

const CHURCH = "11111111-1111-4111-8111-111111111111";
const OBJECT_ID = "aaaaaaaa-0000-4000-8000-000000000401";
const PUBLIC_ID = "HBB0000001";

let editorId: string;
let reviewerId: string;
let approverId: string;
let outsiderId: string;
let adminId: string;

async function currentStatus(): Promise<string> {
  const { rows } = await ctx.db.query<{ status: string }>(
    `select status from public.objects where id = $1`,
    [OBJECT_ID],
  );
  return rows[0].status;
}

async function visitorObject() {
  return ctx.asRole("anon", null, () => getPublishedObjectByPublicId(PUBLIC_ID, "en", dbClient));
}

beforeAll(async () => {
  ctx = await createTestDb();
  client = createFakeClient(ctx.db);
  dbClient = client as unknown as DatabaseClient;

  await ctx.db.query(
    `insert into public.churches (id, slug, status) values ($1, 'life-church', 'active')`,
    [CHURCH],
  );
  editorId = await ctx.createUser({ displayName: "Editor" });
  reviewerId = await ctx.createUser({ displayName: "Reviewer" });
  approverId = await ctx.createUser({ displayName: "Approver" });
  outsiderId = await ctx.createUser({ displayName: "Outsider" });
  adminId = await ctx.createUser({ displayName: "Admin", admin: true });
  await ctx.addMembership(editorId, CHURCH, "editor");
  await ctx.addMembership(reviewerId, CHURCH, "historical_reviewer");
  await ctx.addMembership(approverId, CHURCH, "church_approver");

  await ctx.db.query(
    `insert into public.objects (id, church_id, public_id, object_type, default_language, status)
     values ($1, $2, $3, 'icon', 'en', 'draft')`,
    [OBJECT_ID, CHURCH, PUBLIC_ID],
  );
  await ctx.db.query(
    `insert into public.object_translations (object_id, language_code, title, description)
     values ($1, 'en', 'Lifecycle Icon', 'A lifecycle fixture.')`,
    [OBJECT_ID],
  );
});

afterAll(async () => {
  await ctx.close();
});

describe("Journey C — editorial lifecycle to publication and retirement", () => {
  it("starts as a draft that is invisible to visitors", async () => {
    expect(await currentStatus()).toBe("draft");
    expect(await visitorObject()).toBeNull();
    const resolution = await ctx.asRole("anon", null, () => resolvePublicId(PUBLIC_ID, dbClient));
    expect(resolution).toBeNull();
  });

  it("an outsider cannot start review; the editor can", async () => {
    const asOutsider = await ctx.asRole("authenticated", outsiderId, () =>
      client.rpc("transition_object_status", {
        p_object_id: OBJECT_ID,
        p_to: "historical_review",
      }),
    );
    expect(asOutsider.error?.message).toMatch(/editor role required/);
    expect(await currentStatus()).toBe("draft");

    const asEditor = await ctx.asRole("authenticated", editorId, () =>
      client.rpc("transition_object_status", {
        p_object_id: OBJECT_ID,
        p_to: "historical_review",
      }),
    );
    expect(asEditor.error).toBeNull();
    expect(await currentStatus()).toBe("historical_review");
  });

  it("still hides the object from visitors while under historical review", async () => {
    expect(await visitorObject()).toBeNull();
  });

  it("only the historical reviewer can approve into church review", async () => {
    const asEditor = await ctx.asRole("authenticated", editorId, () =>
      client.rpc("record_review", {
        p_object_id: OBJECT_ID,
        p_review_type: "historical_review",
        p_decision: "approved",
      }),
    );
    expect(asEditor.error?.message).toMatch(/historical reviewer role required/);
    expect(await currentStatus()).toBe("historical_review");

    const asReviewer = await ctx.asRole("authenticated", reviewerId, () =>
      client.rpc("record_review", {
        p_object_id: OBJECT_ID,
        p_review_type: "historical_review",
        p_decision: "approved",
      }),
    );
    expect(asReviewer.error).toBeNull();
    expect(await currentStatus()).toBe("church_review");
  });

  it("records the historical approval in review_records", async () => {
    const { rows } = await ctx.db.query<{ review_type: string; decision: string }>(
      `select review_type, decision from public.review_records where object_id = $1 order by created_at`,
      [OBJECT_ID],
    );
    expect(rows).toEqual([{ review_type: "historical_review", decision: "approved" }]);
  });

  it("publishing is exclusively the church approver's decision (admin override refused)", async () => {
    // Even a platform admin may not publish without the church_approver role (Q6).
    const asAdmin = await ctx.asRole("authenticated", adminId, () =>
      client.rpc("record_review", {
        p_object_id: OBJECT_ID,
        p_review_type: "church_approval",
        p_decision: "approved",
      }),
    );
    expect(asAdmin.error?.message).toMatch(/church approver role required/);
    expect(await currentStatus()).toBe("church_review");

    const asApprover = await ctx.asRole("authenticated", approverId, () =>
      client.rpc("record_review", {
        p_object_id: OBJECT_ID,
        p_review_type: "church_approval",
        p_decision: "approved",
      }),
    );
    expect(asApprover.error).toBeNull();
    expect(await currentStatus()).toBe("published");
  });

  it("makes the object publicly resolvable and loadable the moment it is published", async () => {
    const resolution = await ctx.asRole("anon", null, () => resolvePublicId(PUBLIC_ID, dbClient));
    expect(resolution).toEqual({
      kind: "available",
      objectId: OBJECT_ID,
      canonicalPublicId: PUBLIC_ID,
    });

    const object = await visitorObject();
    expect(object?.content?.title).toBe("Lifecycle Icon");
    expect(object?.publishedAt).not.toBeNull();
  });

  it("rejects a direct UPDATE of status (guard trigger)", async () => {
    // Bypass the transition function by updating status directly as the owner connection.
    await expect(
      ctx.db.query(`update public.objects set status = 'draft' where id = $1`, [OBJECT_ID]),
    ).rejects.toThrow(/must be changed through transition_object_status/);
    expect(await currentStatus()).toBe("published");
  });

  it("records a full publication history trail", async () => {
    const { rows } = await ctx.db.query<{ from_status: string | null; to_status: string }>(
      `select from_status, to_status from public.publication_history where object_id = $1 order by created_at`,
      [OBJECT_ID],
    );
    expect(rows).toEqual([
      { from_status: "draft", to_status: "historical_review" },
      { from_status: "historical_review", to_status: "church_review" },
      { from_status: "church_review", to_status: "published" },
    ]);
  });

  it("hides the object again as soon as it is unpublished to draft", async () => {
    const asApprover = await ctx.asRole("authenticated", approverId, () =>
      client.rpc("transition_object_status", { p_object_id: OBJECT_ID, p_to: "draft" }),
    );
    expect(asApprover.error).toBeNull();
    expect(await currentStatus()).toBe("draft");
    expect(await visitorObject()).toBeNull();
    // Unpublished (draft) ids are indistinguishable from unknown ids to visitors: a plain 404.
    const resolution = await ctx.asRole("anon", null, () => resolvePublicId(PUBLIC_ID, dbClient));
    expect(resolution).toBeNull();
  });

  it("archives a published object and reports it as gone (410) to visitors", async () => {
    // Publish again, then archive.
    await ctx.asRole("authenticated", editorId, () =>
      client.rpc("transition_object_status", { p_object_id: OBJECT_ID, p_to: "historical_review" }),
    );
    await ctx.asRole("authenticated", reviewerId, () =>
      client.rpc("record_review", {
        p_object_id: OBJECT_ID,
        p_review_type: "historical_review",
        p_decision: "approved",
      }),
    );
    await ctx.asRole("authenticated", approverId, () =>
      client.rpc("record_review", {
        p_object_id: OBJECT_ID,
        p_review_type: "church_approval",
        p_decision: "approved",
      }),
    );
    expect(await currentStatus()).toBe("published");

    const archived = await ctx.asRole("authenticated", approverId, () =>
      client.rpc("transition_object_status", {
        p_object_id: OBJECT_ID,
        p_to: "archived",
        p_notes: "Superseded by a newer record.",
      }),
    );
    expect(archived.error).toBeNull();
    expect(await currentStatus()).toBe("archived");

    const resolution = await ctx.asRole("anon", null, () => resolvePublicId(PUBLIC_ID, dbClient));
    expect(resolution).toEqual({ kind: "gone" });

    const { rows } = await ctx.db.query<{
      archived_at: string | null;
      archive_reason: string | null;
    }>(`select archived_at, archive_reason from public.objects where id = $1`, [OBJECT_ID]);
    expect(rows[0].archived_at).not.toBeNull();
    expect(rows[0].archive_reason).toBe("Superseded by a newer record.");
  });

  it("requires notes when a review is not an approval", async () => {
    // Put an object back into historical review and attempt a rejection without notes.
    const freshId = "aaaaaaaa-0000-4000-8000-000000000402";
    await ctx.db.query(
      `insert into public.objects (id, church_id, public_id, object_type, default_language, status)
       values ($1, $2, 'HBB0000002', 'icon', 'en', 'draft')`,
      [freshId, CHURCH],
    );
    await ctx.asRole("authenticated", editorId, () =>
      client.rpc("transition_object_status", { p_object_id: freshId, p_to: "historical_review" }),
    );
    const noNotes = await ctx.asRole("authenticated", reviewerId, () =>
      client.rpc("record_review", {
        p_object_id: freshId,
        p_review_type: "historical_review",
        p_decision: "rejected",
      }),
    );
    expect(noNotes.error?.message).toMatch(/notes are required/);

    const withNotes = await ctx.asRole("authenticated", reviewerId, () =>
      client.rpc("record_review", {
        p_object_id: freshId,
        p_review_type: "historical_review",
        p_decision: "rejected",
        p_notes: "Insufficient provenance.",
      }),
    );
    expect(withNotes.error).toBeNull();
  });

  it("refuses an illegal transition (historical_review -> published)", async () => {
    const freshId = "aaaaaaaa-0000-4000-8000-000000000403";
    await ctx.db.query(
      `insert into public.objects (id, church_id, public_id, object_type, default_language, status)
       values ($1, $2, 'HBB0000003', 'icon', 'en', 'draft')`,
      [freshId, CHURCH],
    );
    await ctx.asRole("authenticated", editorId, () =>
      client.rpc("transition_object_status", { p_object_id: freshId, p_to: "historical_review" }),
    );
    const illegal = await ctx.asRole("authenticated", approverId, () =>
      client.rpc("transition_object_status", { p_object_id: freshId, p_to: "published" }),
    );
    expect(illegal.error?.message).toMatch(/illegal transition/);
  });
});

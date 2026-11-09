"use server";

import { revalidatePath } from "next/cache";

import { mapDatabaseError, runAction } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import { invalidatePublicContent } from "@/lib/cache/tags";
import { DalError } from "@/lib/db/errors";
import {
  reviewDecisionSchema,
  transitionSchema,
  type ReviewDecisionInput,
  type TransitionInput,
} from "@/lib/validation/object";

import type { ActionResult } from "@/lib/actions/result";

async function revalidateObject(client: Awaited<ReturnType<typeof getSession>>, objectId: string) {
  if (!client) return;
  const { data } = await client.client
    .from("objects")
    .select("public_id, default_language, status, church_id")
    .eq("id", objectId)
    .maybeSingle();
  if (!data) return;
  invalidatePublicContent({ publicId: data.public_id, churchId: data.church_id });
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  revalidatePath("/admin/objects");
  revalidatePath(`/admin/objects/${objectId}`);
  revalidatePath(`/${data.default_language}/admin/objects/${objectId}`);
  if (data.status === "published") {
    revalidatePath(`/${data.default_language}/o/${data.public_id}`);
    revalidatePath(`/o/${data.public_id}`);
  }
}

/**
 * Submits a draft for historical review. Requires the object to have at least one translation
 * with a title for its default language. Authorization and the transition itself are enforced by
 * `transition_object_status()` (editor role, draft -> historical_review).
 */
export async function submitForReview(
  input: TransitionInput,
): Promise<ActionResult<{ objectId: string }>> {
  return runAction(async () => {
    const parsed = transitionSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Invalid request.");

    const session = requireSession(await getSession());
    const objectId = parsed.data.object_id;

    const { data: object, error: readError } = await session.client
      .from("objects")
      .select("default_language, object_translations ( language_code, title )")
      .eq("id", objectId)
      .maybeSingle();
    if (readError) throw mapDatabaseError(readError, "Failed to load the object.");
    if (!object) throw new DalError("NOT_FOUND", "Object not found.");

    const complete = (object.object_translations ?? []).some(
      (translation) =>
        translation.language_code === object.default_language &&
        translation.title.trim().length > 0,
    );
    if (!complete) {
      throw new DalError(
        "VALIDATION",
        "Add a default-language title before submitting for review.",
      );
    }

    const { error } = await session.client.rpc("transition_object_status", {
      p_object_id: objectId,
      p_to: "historical_review",
      p_notes: parsed.data.notes ?? undefined,
    });
    if (error) throw mapDatabaseError(error, "Failed to submit for review.");

    await revalidateObject(session, objectId);
    return { objectId };
  }, "submitForReview");
}

/**
 * Records a decision at the current review stage. Which stages are valid is derived from the
 * object's status server-side by `record_review()`; the caller supplies only a decision and notes.
 */
export async function recordReviewDecision(
  input: ReviewDecisionInput,
): Promise<ActionResult<{ objectId: string }>> {
  return runAction(async () => {
    const parsed = reviewDecisionSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Invalid request.");
    const data = parsed.data;

    const session = requireSession(await getSession());

    const { data: object, error: readError } = await session.client
      .from("objects")
      .select("status")
      .eq("id", data.object_id)
      .maybeSingle();
    if (readError) throw mapDatabaseError(readError, "Failed to load the object.");
    if (!object) throw new DalError("NOT_FOUND", "Object not found.");

    if (object.status !== "historical_review" && object.status !== "church_review") {
      throw new DalError("CONFLICT", "This object is not awaiting a review decision.");
    }

    const reviewType =
      object.status === "historical_review" ? "historical_review" : "church_approval";

    const { error } = await session.client.rpc("record_review", {
      p_object_id: data.object_id,
      p_review_type: reviewType,
      p_decision: data.decision,
      p_notes: data.notes ?? undefined,
    });
    if (error) throw mapDatabaseError(error, "Failed to record the review decision.");

    await revalidateObject(session, data.object_id);
    return { objectId: data.object_id };
  }, "recordReviewDecision");
}

/** published -> draft (approver or admin). */
export async function unpublishObject(
  input: TransitionInput,
): Promise<ActionResult<{ objectId: string }>> {
  return transitionTo(input, "draft", "unpublishObject");
}

/** -> archived (approver or admin). */
export async function archiveObject(
  input: TransitionInput,
): Promise<ActionResult<{ objectId: string }>> {
  return transitionTo(input, "archived", "archiveObject");
}

/** historical_review -> draft (reviewer) / church_review -> draft (approver). */
export async function returnToDraft(
  input: TransitionInput,
): Promise<ActionResult<{ objectId: string }>> {
  return transitionTo(input, "draft", "returnToDraft");
}

async function transitionTo(
  input: TransitionInput,
  to: "draft" | "archived",
  context: string,
): Promise<ActionResult<{ objectId: string }>> {
  return runAction(async () => {
    const parsed = transitionSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Invalid request.");

    const session = requireSession(await getSession());
    const { error } = await session.client.rpc("transition_object_status", {
      p_object_id: parsed.data.object_id,
      p_to: to,
      p_notes: parsed.data.notes ?? undefined,
    });
    if (error) throw mapDatabaseError(error, `Failed to ${context}.`);

    await revalidateObject(session, parsed.data.object_id);
    return { objectId: parsed.data.object_id };
  }, context);
}

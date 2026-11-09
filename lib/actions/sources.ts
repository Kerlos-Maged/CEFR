"use server";

import { revalidatePath } from "next/cache";

import { mapDatabaseError, runAction } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import { invalidatePublicContent } from "@/lib/cache/tags";
import { DalError } from "@/lib/db/errors";
import {
  createClaimSchema,
  createSourceSchema,
  linkSourceSchema,
  setClaimVerificationSchema,
  type CreateClaimInput,
  type CreateSourceInput,
  type LinkSourceInput,
  type SetClaimVerificationInput,
} from "@/lib/validation/object";

import type { ActionResult } from "@/lib/actions/result";

/** Creates a claim on a draft object (editor). Defaults to uncertain/private. */
export async function createClaim(
  input: CreateClaimInput,
): Promise<ActionResult<{ claimId: string }>> {
  return runAction(async () => {
    const parsed = createClaimSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Please correct the highlighted fields.");
    const data = parsed.data;

    const session = requireSession(await getSession());
    const { data: created, error } = await session.client
      .from("claims")
      .insert({
        object_id: data.object_id,
        claim_text: data.claim_text,
        claimed_value: data.claimed_value ?? null,
        is_public: data.is_public ?? false,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error) throw mapDatabaseError(error, "Failed to create the claim.");

    revalidatePath(`/admin/objects/${data.object_id}`);
    invalidatePublicContent({});
    return { claimId: created.id };
  }, "createClaim");
}

/**
 * Sets a claim's verification status. Allowed for the object's historical reviewer (or admin) via
 * the `claims_update` RLS policy, regardless of draft status.
 */
export async function setClaimVerification(
  input: SetClaimVerificationInput,
): Promise<ActionResult<{ claimId: string }>> {
  return runAction(async () => {
    const parsed = setClaimVerificationSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Invalid request.");
    const data = parsed.data;

    const session = requireSession(await getSession());
    const { data: updated, error } = await session.client
      .from("claims")
      .update({ verification: data.verification })
      .eq("id", data.claim_id)
      .select("id, object_id")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "Failed to update the claim.");
    if (!updated) throw new DalError("FORBIDDEN", "You cannot verify this claim.");

    revalidatePath(`/admin/objects/${updated.object_id}`);
    invalidatePublicContent({});
    return { claimId: updated.id };
  }, "setClaimVerification");
}

export async function deleteClaim(claimId: string): Promise<ActionResult<{ claimId: string }>> {
  return runAction(async () => {
    const session = requireSession(await getSession());
    const { data: deleted, error } = await session.client
      .from("claims")
      .delete()
      .eq("id", claimId)
      .select("id, object_id")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "Failed to delete the claim.");
    if (!deleted) throw new DalError("NOT_FOUND", "Claim not found.");
    revalidatePath(`/admin/objects/${deleted.object_id}`);
    invalidatePublicContent({});
    return { claimId };
  }, "deleteClaim");
}

/** Creates a scholarly source record (any church member or admin — `sources_member_write`). */
export async function createSource(
  input: CreateSourceInput,
): Promise<ActionResult<{ sourceId: string }>> {
  return runAction(async () => {
    const parsed = createSourceSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Please correct the highlighted fields.");
    const data = parsed.data;

    const session = requireSession(await getSession());
    const { data: created, error } = await session.client
      .from("sources")
      .insert({
        title: data.title,
        author: data.author ?? null,
        year: data.year ?? null,
        citation: data.citation ?? null,
        url: data.url ?? null,
        source_type: data.source_type ?? null,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error) throw mapDatabaseError(error, "Failed to create the source.");

    revalidatePath("/admin/sources");
    return { sourceId: created.id };
  }, "createSource");
}

/** Links a source to an object or a claim. */
export async function linkSource(
  input: LinkSourceInput,
): Promise<ActionResult<{ sourceId: string }>> {
  return runAction(async () => {
    const parsed = linkSourceSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Invalid request.");
    const data = parsed.data;

    if (!data.object_id && !data.claim_id) {
      throw new DalError("VALIDATION", "Specify an object or a claim to link the source to.");
    }
    if (data.object_id && data.claim_id) {
      throw new DalError("VALIDATION", "Link a source to an object or a claim, not both.");
    }

    const session = requireSession(await getSession());

    if (data.claim_id) {
      const { error } = await session.client
        .from("claim_sources")
        .upsert({ claim_id: data.claim_id, source_id: data.source_id, note: data.note ?? null });
      if (error) throw mapDatabaseError(error, "Failed to link the source.");
      invalidatePublicContent({});
    } else if (data.object_id) {
      const { error } = await session.client
        .from("object_sources")
        .upsert({ object_id: data.object_id, source_id: data.source_id, note: data.note ?? null });
      if (error) throw mapDatabaseError(error, "Failed to link the source.");
      revalidatePath(`/admin/objects/${data.object_id}`);
      invalidatePublicContent({});
    }

    revalidatePath("/admin/sources");
    return { sourceId: data.source_id };
  }, "linkSource");
}

"use server";

import { revalidatePath } from "next/cache";

import { mapDatabaseError, runAction } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import { invalidatePublicContent } from "@/lib/cache/tags";
import { DalError } from "@/lib/db/errors";
import {
  createObjectRelationSchema,
  type CreateObjectRelationInput,
} from "@/lib/validation/object";

import type { ActionResult } from "@/lib/actions/result";

/** Adds a typed relationship between two heritage records in the same church. */
export async function createObjectRelation(
  input: CreateObjectRelationInput,
): Promise<ActionResult<{ relationId: string }>> {
  return runAction(async () => {
    const parsed = createObjectRelationSchema.safeParse(input);
    if (!parsed.success)
      throw new DalError("VALIDATION", "Please correct the relationship details.");
    const data = parsed.data;
    if (data.object_id === data.related_object_id) {
      throw new DalError("VALIDATION", "An object cannot be related to itself.");
    }

    const session = requireSession(await getSession());
    const { data: object, error: objectError } = await session.client
      .from("objects")
      .select("church_id")
      .eq("id", data.object_id)
      .maybeSingle();
    if (objectError) throw mapDatabaseError(objectError, "Could not load the source record.");
    if (!object) throw new DalError("NOT_FOUND", "The source record was not found.");

    const { data: relation, error } = await session.client
      .from("object_relations")
      .insert({
        church_id: object.church_id,
        object_id: data.object_id,
        related_object_id: data.related_object_id,
        relationship_type: data.relationship_type,
        description: data.description ?? null,
        is_public: data.is_public ?? false,
      })
      .select("id")
      .single();
    if (error) throw mapDatabaseError(error, "Could not link these records.");

    revalidatePath(`/admin/objects/${data.object_id}`);
    invalidatePublicContent({});
    return { relationId: relation.id };
  }, "createObjectRelation");
}

export async function deleteObjectRelation(
  relationId: string,
): Promise<ActionResult<{ relationId: string }>> {
  return runAction(async () => {
    const session = requireSession(await getSession());
    const { data: removed, error } = await session.client
      .from("object_relations")
      .delete()
      .eq("id", relationId)
      .select("id, object_id")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "Could not remove this relationship.");
    if (!removed) throw new DalError("NOT_FOUND", "Relationship not found.");

    revalidatePath(`/admin/objects/${removed.object_id}`);
    invalidatePublicContent({});
    return { relationId: removed.id };
  }, "deleteObjectRelation");
}

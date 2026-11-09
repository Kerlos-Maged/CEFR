"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, mapDatabaseError, runAction, zodToFieldErrors } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import { invalidatePublicContent } from "@/lib/cache/tags";
import { DalError } from "@/lib/db/errors";
import { generatePublicId } from "@/lib/validation/generate-public-id";
import {
  createObjectSchema,
  updateObjectSchema,
  upsertTranslationSchema,
  type CreateObjectInput,
  type UpdateObjectInput,
  type UpsertTranslationInput,
} from "@/lib/validation/object";

import type { ActionResult } from "@/lib/actions/result";

interface CreateObjectResult {
  objectId: string;
  publicId: string;
}

const MAX_PUBLIC_ID_ATTEMPTS = 5;

/**
 * Creates a heritage object as a draft in one of the caller's churches.
 *
 * Authorization: `requireSession` proves identity; the insert is executed with the user-scoped
 * client so `objects_editor_insert` RLS requires `has_church_role(church_id,'editor')` and
 * `status='draft'`. `church_id` comes from validated input but is only honoured if RLS allows it,
 * so a caller cannot create objects in a church they do not edit. `public_id` is server-generated
 * and never accepted from the client.
 */
export async function createObject(
  input: CreateObjectInput,
): Promise<ActionResult<CreateObjectResult>> {
  return runAction(async () => {
    const parsed = createObjectSchema.safeParse(input);
    if (!parsed.success) {
      throw new DalError("VALIDATION", "Please correct the highlighted fields.");
    }
    const data = parsed.data;

    const session = requireSession(await getSession());

    for (let attempt = 0; attempt < MAX_PUBLIC_ID_ATTEMPTS; attempt += 1) {
      const publicId = generatePublicId();
      const { data: created, error } = await session.client
        .from("objects")
        .insert({
          church_id: data.church_id,
          public_id: publicId,
          object_type: data.object_type,
          default_language: data.default_language,
          approximate_date: data.approximate_date ?? null,
          location_in_church: data.location_in_church ?? null,
          materials: data.materials ?? null,
          dimensions: data.dimensions ?? null,
          condition_notes: data.condition_notes ?? null,
          status: "draft",
          created_by: session.user.id,
        })
        .select("id, public_id")
        .single();

      if (!error && created) {
        const { error: translationError } = await session.client
          .from("object_translations")
          .insert({
            object_id: created.id,
            language_code: data.default_language,
            title: data.title,
            description: data.description ?? null,
            is_complete: false,
          });
        if (translationError) {
          throw mapDatabaseError(translationError, "Failed to save the object translation.");
        }

        revalidatePath(`/${data.default_language}/admin/objects`);
        invalidatePublicContent({ churchId: data.church_id });
        return { objectId: created.id, publicId: created.public_id };
      }

      if (error?.code === "23505") continue;
      throw mapDatabaseError(error ?? {}, "Failed to create the object.");
    }

    throw new DalError("INTERNAL", "Could not allocate a unique public identifier. Please retry.");
  }, "createObject");
}

/**
 * Updates editable object fields. Status is intentionally not settable here (only the workflow
 * functions may change it); RLS additionally requires the object to be a draft in the caller's
 * church.
 */
export async function updateObject(
  objectId: string,
  input: UpdateObjectInput,
): Promise<ActionResult<{ objectId: string }>> {
  return runAction(async () => {
    const parsed = updateObjectSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Please correct the highlighted fields.");

    const session = requireSession(await getSession());
    const data = parsed.data;

    const { data: updated, error } = await session.client
      .from("objects")
      .update({
        object_type: data.object_type,
        approximate_date: data.approximate_date ?? null,
        location_in_church: data.location_in_church ?? null,
        materials: data.materials ?? null,
        dimensions: data.dimensions ?? null,
        condition_notes: data.condition_notes ?? null,
      })
      .eq("id", objectId)
      .select("id, default_language, public_id, church_id")
      .maybeSingle();

    if (error) throw mapDatabaseError(error, "Failed to update the object.");
    if (!updated) throw new DalError("FORBIDDEN", "You cannot edit this object.");

    revalidatePath(`/${updated.default_language}/admin/objects/${objectId}`);
    invalidatePublicContent({ publicId: updated.public_id, churchId: updated.church_id });
    return { objectId };
  }, "updateObject");
}

/** Creates or updates a translation for a draft object. */
export async function upsertObjectTranslation(
  objectId: string,
  input: UpsertTranslationInput,
): Promise<ActionResult<{ objectId: string }>> {
  return runAction(async () => {
    const parsed = upsertTranslationSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Please correct the highlighted fields.");
    const data = parsed.data;

    const session = requireSession(await getSession());

    const { error } = await session.client.from("object_translations").upsert(
      {
        object_id: objectId,
        language_code: data.language_code,
        title: data.title,
        description: data.description ?? null,
        is_complete: data.is_complete ?? false,
      },
      { onConflict: "object_id,language_code" },
    );

    if (error) throw mapDatabaseError(error, "Failed to save the translation.");

    const { data: object } = await session.client
      .from("objects")
      .select("default_language, public_id, church_id")
      .eq("id", objectId)
      .maybeSingle();
    if (object) {
      revalidatePath(`/${object.default_language}/admin/objects/${objectId}`);
      invalidatePublicContent({ publicId: object.public_id, churchId: object.church_id });
    }

    return { objectId };
  }, "upsertObjectTranslation");
}

export async function deleteObjectTranslation(
  objectId: string,
  languageCode: string,
): Promise<ActionResult<{ objectId: string }>> {
  return runAction(async () => {
    const session = requireSession(await getSession());

    const { data: object, error: readError } = await session.client
      .from("objects")
      .select("default_language, public_id, church_id")
      .eq("id", objectId)
      .maybeSingle();
    if (readError) throw mapDatabaseError(readError, "Failed to load the object.");
    if (!object) throw new DalError("NOT_FOUND", "Object not found.");

    if (languageCode === object.default_language) {
      const { count } = await session.client
        .from("object_translations")
        .select("id", { count: "exact", head: true })
        .eq("object_id", objectId);
      if ((count ?? 0) <= 1) {
        throw new DalError(
          "CONFLICT",
          "The default-language translation cannot be removed while it is the only one.",
        );
      }
    }

    const { data: deleted, error } = await session.client
      .from("object_translations")
      .delete()
      .eq("object_id", objectId)
      .eq("language_code", languageCode)
      .select("id")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "Failed to delete the translation.");
    if (!deleted) throw new DalError("NOT_FOUND", "Translation not found.");

    revalidatePath(`/${object.default_language}/admin/objects/${objectId}`);
    invalidatePublicContent({ publicId: object.public_id, churchId: object.church_id });
    return { objectId };
  }, "deleteObjectTranslation");
}

/** Hard delete — platform admins only (RLS `objects_admin_delete`). Audited by the DB. */
export async function deleteObject(objectId: string): Promise<ActionResult<{ objectId: string }>> {
  return runAction(async () => {
    const session = requireSession(await getSession());
    const { data: deleted, error } = await session.client
      .from("objects")
      .delete()
      .eq("id", objectId)
      .select("id, public_id, church_id")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "Failed to delete the object.");
    if (!deleted) throw new DalError("NOT_FOUND", "Object not found or not deletable.");
    revalidatePath("/admin/objects");
    invalidatePublicContent({ publicId: deleted.public_id, churchId: deleted.church_id });
    return { objectId };
  }, "deleteObject");
}

export { actionFailure, zodToFieldErrors };

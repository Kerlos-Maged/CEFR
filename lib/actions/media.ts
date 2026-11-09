"use server";

import { revalidatePath } from "next/cache";

import { mapDatabaseError, runAction } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import { invalidatePublicContent } from "@/lib/cache/tags";
import { DalError } from "@/lib/db/errors";
import { canPublishMedia } from "@/lib/media/mime";
import {
  createMediaSchema,
  reorderMediaSchema,
  setMediaPublicationSchema,
  updateMediaDetailsSchema,
  upsertMediaTranslationSchema,
  type CreateMediaInput,
  type ReorderMediaInput,
  type SetMediaPublicationInput,
  type UpsertMediaTranslationInput,
  type UpdateMediaDetailsInput,
} from "@/lib/validation/object";

import type { ActionResult } from "@/lib/actions/result";

/**
 * Registers media metadata for a draft object after a file has been staged in Supabase Storage.
 *
 * NOTE (documented Phase 6 gap): the signed-upload orchestration (`requestMediaUpload` /
 * `/api/media/upload`) requires a live Supabase Storage service to validate magic bytes and
 * promote from `incoming` to `object-media`; it cannot be exercised in the local PGlite-only
 * environment. This action validates the metadata write and leaves the object draft-scoped; new
 * rows always start non-public (`is_public=false`) so nothing leaks before approval.
 */
export async function registerMedia(
  input: CreateMediaInput,
): Promise<ActionResult<{ mediaId: string }>> {
  return runAction(async () => {
    const parsed = createMediaSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Please correct the highlighted fields.");
    const data = parsed.data;

    const session = requireSession(await getSession());
    const { data: created, error } = await session.client
      .from("media")
      .insert({
        object_id: data.object_id,
        media_type: data.media_type,
        storage_path: data.storage_path,
        bucket: data.bucket ?? "object-media",
        mime_type: data.mime_type,
        size_bytes: data.size_bytes,
        width: data.width ?? null,
        height: data.height ?? null,
        duration_seconds: data.duration_seconds ?? null,
        checksum: data.checksum ?? null,
        copyright_holder: data.copyright_holder ?? null,
        attribution: data.attribution ?? null,
        permission_status: data.permission_status ?? "pending",
        is_public: false,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error) throw mapDatabaseError(error, "Failed to register the media.");

    revalidatePath(`/admin/objects/${data.object_id}`);
    invalidatePublicContent({});
    return { mediaId: created.id };
  }, "registerMedia");
}

/** Adds/updates a caption/alt-text translation for media. */
export async function upsertMediaTranslation(
  input: UpsertMediaTranslationInput,
): Promise<ActionResult<{ mediaId: string }>> {
  return runAction(async () => {
    const parsed = upsertMediaTranslationSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Invalid request.");
    const data = parsed.data;

    const session = requireSession(await getSession());
    const { error } = await session.client.from("media_translations").upsert(
      {
        media_id: data.media_id,
        language_code: data.language_code,
        caption: data.caption ?? null,
        alt_text: data.alt_text ?? null,
      },
      { onConflict: "media_id,language_code" },
    );
    if (error) throw mapDatabaseError(error, "Failed to save the media translation.");
    invalidatePublicContent({});
    return { mediaId: data.media_id };
  }, "upsertMediaTranslation");
}

/** Saves rights, copyright, and attribution metadata for draft media. */
export async function updateMediaDetails(
  input: UpdateMediaDetailsInput,
): Promise<ActionResult<{ mediaId: string }>> {
  return runAction(async () => {
    const parsed = updateMediaDetailsSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Invalid media rights information.");
    const { media_id: mediaId, ...details } = parsed.data;
    const session = requireSession(await getSession());
    const { data: current, error: readError } = await session.client
      .from("media")
      .select("id, is_public")
      .eq("id", mediaId)
      .maybeSingle();
    if (readError) throw mapDatabaseError(readError, "Failed to load media rights information.");
    if (!current) throw new DalError("NOT_FOUND", "Media not found.");
    if (current.is_public && !["granted", "public_domain"].includes(details.permission_status)) {
      throw new DalError(
        "VALIDATION",
        "Make media private before changing its permission to pending or restricted.",
      );
    }
    const { data, error } = await session.client
      .from("media")
      .update({
        permission_status: details.permission_status,
        copyright_holder: details.copyright_holder ?? null,
        attribution: details.attribution ?? null,
      })
      .eq("id", mediaId)
      .select("id, object_id")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "Failed to save media rights information.");
    if (!data) throw new DalError("FORBIDDEN", "You cannot edit this media.");
    revalidatePath(`/admin/objects/${data.object_id}`);
    invalidatePublicContent({});
    return { mediaId };
  }, "updateMediaDetails");
}

/**
 * Publishes or unpublishes media. Publishing requires a permissive licence and (for images) alt
 * text for the object's default language — enforced here for UX and again by the
 * `media_publish_gate_check` constraint plus RLS.
 */
export async function setMediaPublication(
  input: SetMediaPublicationInput,
): Promise<ActionResult<{ mediaId: string }>> {
  return runAction(async () => {
    const parsed = setMediaPublicationSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Invalid request.");
    const data = parsed.data;

    const session = requireSession(await getSession());

    const { data: media, error: readError } = await session.client
      .from("media")
      .select(
        "id, media_type, mime_type, permission_status, object_id, bucket, storage_path, objects ( default_language ), media_translations ( language_code, alt_text )",
      )
      .eq("id", data.media_id)
      .maybeSingle();
    if (readError) throw mapDatabaseError(readError, "Failed to load the media.");
    if (!media) throw new DalError("NOT_FOUND", "Media not found.");

    if (data.is_public) {
      const objectRow = Array.isArray(media.objects) ? media.objects[0] : media.objects;
      const defaultLanguage = objectRow?.default_language ?? "en";
      const altText =
        (media.media_translations ?? []).find((t) => t.language_code === defaultLanguage)
          ?.alt_text ?? null;

      const gate = canPublishMedia({
        kind: media.media_type,
        permissionStatus: media.permission_status,
        altText,
      });
      if (!gate.ok) {
        throw new DalError("VALIDATION", `Cannot publish this media: ${gate.reason}.`);
      }
    }

    let nextBucket = media.bucket;
    const storage = session.client.storage;
    if (data.is_public && media.bucket === "incoming") {
      const staged = await storage.from("incoming").download(media.storage_path);
      if (staged.error) throw mapDatabaseError(staged.error, "Could not read staged media.");
      const promoted = await storage.from("object-media").upload(media.storage_path, staged.data, {
        contentType: media.mime_type,
        upsert: false,
      });
      if (promoted.error)
        throw mapDatabaseError(promoted.error, "Could not publish the media file.");
      nextBucket = "object-media";
    } else if (!data.is_public && media.bucket === "object-media") {
      const publicFile = await storage.from("object-media").download(media.storage_path);
      if (publicFile.error)
        throw mapDatabaseError(publicFile.error, "Could not read published media.");
      const staged = await storage.from("incoming").upload(media.storage_path, publicFile.data, {
        upsert: true,
      });
      if (staged.error) throw mapDatabaseError(staged.error, "Could not secure the media file.");
      const removed = await storage.from("object-media").remove([media.storage_path]);
      if (removed.error) {
        await storage.from("incoming").remove([media.storage_path]);
        throw mapDatabaseError(removed.error, "Could not remove the public media file.");
      }
      nextBucket = "incoming";
    }

    const { data: updated, error } = await session.client
      .from("media")
      .update({ is_public: data.is_public, bucket: nextBucket })
      .eq("id", data.media_id)
      .select("id")
      .maybeSingle();
    if (error) {
      if (data.is_public && nextBucket === "object-media") {
        await storage.from("object-media").remove([media.storage_path]);
      }
      throw mapDatabaseError(error, "Failed to update media publication.");
    }
    // RLS filters out rows the caller may not write, yielding zero affected rows rather than an
    // error; surface that as a permission failure instead of a silent success.
    if (!updated) {
      if (data.is_public && nextBucket === "object-media") {
        await storage.from("object-media").remove([media.storage_path]);
      }
      throw new DalError("FORBIDDEN", "You cannot edit this media.");
    }
    if (data.is_public && media.bucket === "incoming") {
      await storage.from("incoming").remove([media.storage_path]);
    }

    revalidatePath(`/admin/objects/${media.object_id}`);
    invalidatePublicContent({});
    return { mediaId: data.media_id };
  }, "setMediaPublication");
}

export async function deleteMedia(mediaId: string): Promise<ActionResult<{ mediaId: string }>> {
  return runAction(async () => {
    const session = requireSession(await getSession());
    const { data: media, error: readError } = await session.client
      .from("media")
      .select("id, object_id, bucket, storage_path")
      .eq("id", mediaId)
      .maybeSingle();
    if (readError) throw mapDatabaseError(readError, "Failed to load media for deletion.");
    if (!media) throw new DalError("NOT_FOUND", "Media not found.");
    const { error: storageError } = await session.client.storage
      .from(media.bucket)
      .remove([media.storage_path]);
    if (storageError)
      throw mapDatabaseError(storageError, "Failed to remove the stored media file.");
    const { data: deleted, error } = await session.client
      .from("media")
      .delete()
      .eq("id", mediaId)
      .select("id, object_id")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "Failed to delete the media.");
    if (!deleted) throw new DalError("NOT_FOUND", "Media not found.");
    revalidatePath(`/admin/objects/${deleted.object_id}`);
    invalidatePublicContent({});
    return { mediaId };
  }, "deleteMedia");
}

/** Replace an object's complete media ordering; the submitted IDs must match its current set. */
export async function reorderMedia(
  input: ReorderMediaInput,
): Promise<ActionResult<{ objectId: string }>> {
  return runAction(async () => {
    const parsed = reorderMediaSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Invalid media order.");
    const { object_id: objectId, media_ids: mediaIds } = parsed.data;
    if (new Set(mediaIds).size !== mediaIds.length)
      throw new DalError("VALIDATION", "Media IDs must be unique.");
    const session = requireSession(await getSession());
    const { data: rows, error } = await session.client
      .from("media")
      .select("id")
      .eq("object_id", objectId);
    if (error) throw mapDatabaseError(error, "Failed to load object media.");
    const existing = new Set((rows ?? []).map((row) => row.id));
    if (existing.size !== mediaIds.length || mediaIds.some((id) => !existing.has(id))) {
      throw new DalError("VALIDATION", "The submitted media order is out of date.");
    }
    for (const [sortOrder, id] of mediaIds.entries()) {
      const { data, error: updateError } = await session.client
        .from("media")
        .update({ sort_order: sortOrder })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (updateError) throw mapDatabaseError(updateError, "Failed to save the media order.");
      if (!data) throw new DalError("FORBIDDEN", "You cannot reorder this media.");
    }
    revalidatePath(`/admin/objects/${objectId}`);
    invalidatePublicContent({});
    return { objectId };
  }, "reorderMedia");
}

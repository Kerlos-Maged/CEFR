"use server";

import { revalidatePath } from "next/cache";

import { mapDatabaseError, runAction } from "@/lib/actions/result";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import { invalidatePublicContent } from "@/lib/cache/tags";
import { DalError } from "@/lib/db/errors";
import { localizedPath } from "@/lib/i18n/paths";
import {
  archiveChurchSchema,
  churchTranslationSchema,
  createChurchSchema,
  updateChurchSchema,
  type ArchiveChurchInput,
  type ChurchTranslationInput,
  type CreateChurchInput,
  type UpdateChurchInput,
} from "@/lib/validation/object";

import type { ActionResult } from "@/lib/actions/result";

function revalidateChurches(lang: string, slug?: string) {
  revalidatePath(localizedPath(lang, "/admin/churches"));
  revalidatePath(localizedPath(lang, "/churches"));
  if (slug) revalidatePath(localizedPath(lang, `/churches/${slug}`));
}

export async function createChurch(
  input: CreateChurchInput,
): Promise<ActionResult<{ churchId: string }>> {
  return runAction(async () => {
    const parsed = createChurchSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Please correct the church fields.");
    const data = parsed.data;
    const session = requirePlatformAdmin(await getSession());
    const { data: church, error } = await session.client
      .from("churches")
      .insert({
        slug: data.slug,
        city: data.city ?? null,
        district: data.district ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        dedication_date: data.dedication_date ?? null,
        rite: data.rite ?? "coptic_orthodox",
        metadata: { external_links: data.external_links ?? [] },
      })
      .select("id, slug")
      .single();
    if (error) throw mapDatabaseError(error, "Failed to create the church.");

    const translations = [
      {
        church_id: church.id,
        language_code: "en",
        name: data.name_en,
        description: data.description_en ?? null,
      },
      ...(data.name_ar
        ? [
            {
              church_id: church.id,
              language_code: "ar",
              name: data.name_ar,
              description: data.description_ar ?? null,
            },
          ]
        : []),
    ];
    const { error: translationError } = await session.client
      .from("church_translations")
      .insert(translations);
    if (translationError)
      throw mapDatabaseError(
        translationError,
        "Church created, but its translations could not be saved.",
      );

    invalidatePublicContent({ churchId: church.id });
    revalidateChurches("en", church.slug);
    revalidateChurches("ar", church.slug);
    return { churchId: church.id };
  }, "createChurch");
}

export async function updateChurch(
  input: UpdateChurchInput,
): Promise<ActionResult<{ churchId: string }>> {
  return runAction(async () => {
    const parsed = updateChurchSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Please correct the church fields.");
    const data = parsed.data;
    const session = requirePlatformAdmin(await getSession());
    const { data: current, error: readError } = await session.client
      .from("churches")
      .select("metadata")
      .eq("id", data.church_id)
      .maybeSingle();
    if (readError) throw mapDatabaseError(readError, "Failed to load the church metadata.");
    if (!current) throw new DalError("NOT_FOUND", "Church not found.");
    if (data.cover_media_id) {
      const { data: cover, error: coverError } = await session.client
        .from("media")
        .select("id, media_type, is_public, permission_status, objects!inner(church_id, status)")
        .eq("id", data.cover_media_id)
        .eq("bucket", "object-media")
        .eq("media_type", "image")
        .eq("is_public", true)
        .in("permission_status", ["granted", "public_domain"])
        .eq("objects.church_id", data.church_id)
        .eq("objects.status", "published")
        .maybeSingle();
      if (coverError) throw mapDatabaseError(coverError, "Failed to validate the church cover.");
      if (!cover) {
        throw new DalError(
          "VALIDATION",
          "Choose a public, rights-cleared image from one of this church’s published records.",
        );
      }
    }
    const currentMetadata =
      current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
        ? (current.metadata as Record<string, unknown>)
        : {};
    const { data: updated, error } = await session.client
      .from("churches")
      .update({
        slug: data.slug,
        city: data.city ?? null,
        district: data.district ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        dedication_date: data.dedication_date ?? null,
        rite: data.rite ?? null,
        cover_media_id: data.cover_media_id ?? null,
        ...(data.external_links === undefined
          ? {}
          : { metadata: { ...currentMetadata, external_links: data.external_links } }),
      })
      .eq("id", data.church_id)
      .select("id, slug")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "Failed to update the church.");
    if (!updated) throw new DalError("NOT_FOUND", "Church not found.");

    invalidatePublicContent({ churchId: updated.id });
    revalidateChurches("en", updated.slug);
    revalidateChurches("ar", updated.slug);
    return { churchId: updated.id };
  }, "updateChurch");
}

export async function upsertChurchTranslation(
  input: ChurchTranslationInput,
): Promise<ActionResult<{ churchId: string }>> {
  return runAction(async () => {
    const parsed = churchTranslationSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Please correct the translation fields.");
    const data = parsed.data;
    const session = requirePlatformAdmin(await getSession());
    const { error } = await session.client.from("church_translations").upsert(
      {
        church_id: data.church_id,
        language_code: data.language_code,
        name: data.name,
        description: data.description ?? null,
      },
      { onConflict: "church_id,language_code" },
    );
    if (error) throw mapDatabaseError(error, "Failed to save the church translation.");

    const { data: church } = await session.client
      .from("churches")
      .select("slug")
      .eq("id", data.church_id)
      .maybeSingle();
    invalidatePublicContent({ churchId: data.church_id });
    revalidateChurches("en", church?.slug);
    revalidateChurches("ar", church?.slug);
    return { churchId: data.church_id };
  }, "upsertChurchTranslation");
}

export async function archiveChurch(
  input: ArchiveChurchInput,
): Promise<ActionResult<{ churchId: string }>> {
  return runAction(async () => {
    const parsed = archiveChurchSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "An archive reason is required.");
    const data = parsed.data;
    const session = requirePlatformAdmin(await getSession());
    const { data: church, error: readError } = await session.client
      .from("churches")
      .select("id, slug")
      .eq("id", data.church_id)
      .maybeSingle();
    if (readError) throw mapDatabaseError(readError, "Failed to load the church.");
    if (!church) throw new DalError("NOT_FOUND", "Church not found.");

    const { error } = await session.client.rpc("archive_church", {
      p_church_id: data.church_id,
      p_notes: data.notes,
    });
    if (error) throw mapDatabaseError(error, "Failed to archive the church.");

    invalidatePublicContent({ churchId: church.id });
    revalidateChurches("en", church.slug);
    revalidateChurches("ar", church.slug);
    return { churchId: church.id };
  }, "archiveChurch");
}

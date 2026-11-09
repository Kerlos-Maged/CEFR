"use server";

import { revalidatePath, updateTag } from "next/cache";

import { mapDatabaseError, runAction } from "@/lib/actions/result";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import { DalError } from "@/lib/db/errors";
import { localizedPath } from "@/lib/i18n/paths";
import {
  setDefaultLanguageSchema,
  upsertLanguageSchema,
  type SetDefaultLanguageInput,
  type UpsertLanguageInput,
} from "@/lib/validation/object";

export async function saveLanguage(input: UpsertLanguageInput) {
  return runAction(async () => {
    const parsed = upsertLanguageSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Invalid language settings.");
    const session = requirePlatformAdmin(await getSession());
    const { data: current, error: readError } = await session.client
      .from("languages")
      .select("is_default")
      .eq("code", parsed.data.code)
      .maybeSingle();
    if (readError) throw mapDatabaseError(readError, "Failed to load language settings.");
    if (current?.is_default && !parsed.data.is_active) {
      throw new DalError(
        "VALIDATION",
        "Set another active language as the default before disabling this one.",
      );
    }
    const { error } = await session.client
      .from("languages")
      .upsert(parsed.data, { onConflict: "code" });
    if (error) throw mapDatabaseError(error, "Failed to save language settings.");
    updateTag("languages");
    revalidatePath(localizedPath("en", "/admin/languages"));
    return { code: parsed.data.code };
  }, "saveLanguage");
}

export async function setDefaultLanguage(input: SetDefaultLanguageInput) {
  return runAction(async () => {
    const parsed = setDefaultLanguageSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Choose a supported language.");
    const session = requirePlatformAdmin(await getSession());
    const { error } = await session.client.rpc("set_platform_default_language", {
      p_code: parsed.data.code,
    });
    if (error) throw mapDatabaseError(error, "Failed to change the default language.");
    updateTag("languages");
    revalidatePath(localizedPath("en", "/admin/languages"));
    return { code: parsed.data.code };
  }, "setDefaultLanguage");
}

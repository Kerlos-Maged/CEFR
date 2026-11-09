import { cacheLife, cacheTag } from "next/cache";

import { createAnonClient, isSupabaseConfigured } from "@/lib/db/client";

import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from "./languages";

/** Active languages come from the database; English/Arabic are the offline fallback registry. */
export async function getActiveLanguages(): Promise<Language[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("languages");

  if (!isSupabaseConfigured()) return [...LANGUAGES];
  const { data, error } = await createAnonClient()
    .from("languages")
    .select("code, name, native_name, direction, is_active")
    .eq("is_active", true)
    .order("code");
  if (error) return [...LANGUAGES];

  const active = (data ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    nativeName: row.native_name,
    direction: row.direction as Language["direction"],
  }));
  return active.length > 0 ? active : [...LANGUAGES];
}

export async function isActiveLanguage(code: string): Promise<boolean> {
  const languages = await getActiveLanguages();
  return languages.some((language) => language.code === code);
}

export async function getPlatformDefaultLanguage(): Promise<string> {
  "use cache";
  cacheLife("hours");
  cacheTag("languages");

  if (!isSupabaseConfigured()) return DEFAULT_LANGUAGE;
  const { data, error } = await createAnonClient()
    .from("languages")
    .select("code")
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle();
  if (error || !data) return DEFAULT_LANGUAGE;
  return data.code;
}

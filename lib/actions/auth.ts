"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import { DEFAULT_LANGUAGE, isValidLanguageCode } from "@/lib/i18n/languages";
import { localizedPath } from "@/lib/i18n/paths";

/**
 * Clears the Supabase session cookie and returns to the public site. Uses the user-scoped client
 * so `signOut` revokes server-side and clears the auth cookies via the SSR adapter.
 */
export async function signOut(formData: FormData): Promise<void> {
  const rawLang = formData.get("lang");
  const lang = isValidLanguageCode(typeof rawLang === "string" ? rawLang : null)
    ? (rawLang as string)
    : DEFAULT_LANGUAGE;

  const session = await getSession();
  if (session) {
    await session.client.auth.signOut();
  }

  redirect(localizedPath(lang, "/"));
}

/**
 * Explicitly rejects unauthenticated admin mutations. Server actions are individually guarded,
 * but this helper exists so call sites read consistently and cannot forget the check.
 */
export async function assertSignedIn(): Promise<void> {
  requireSession(await getSession());
}

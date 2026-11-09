import { NextResponse, type NextRequest } from "next/server";

import { createServerSessionClient } from "@/lib/db/client";
import { sanitizeNextPath } from "@/lib/auth/sanitize-next-path";
import { DEFAULT_LANGUAGE, isValidLanguageCode } from "@/lib/i18n/languages";
import { localizedPath } from "@/lib/i18n/paths";

/**
 * Exchanges the Supabase magic-link `code` for a session cookie, then redirects.
 *
 * Two strictly-validated inputs:
 * - `next`: the post-login landing path. It must be a **root-relative path** (single leading
 *   slash, no scheme, no `//`), which rejects protocol-relative and absolute open redirects.
 * - `lang`: matched against the supported languages, defaulting to English.
 *
 * Errors redirect to a generic sign-in failure state and never echo the raw error.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const rawLang = searchParams.get("lang");
  const lang = isValidLanguageCode(rawLang) ? rawLang : DEFAULT_LANGUAGE;

  const safeNext = sanitizeNextPath(rawNext);

  if (!code) {
    return NextResponse.redirect(`${origin}${localizedPath(lang, "/login?error=invalid")}`);
  }

  const client = await createServerSessionClient();
  const { error } = await client.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}${localizedPath(lang, "/login?error=expired")}`);
  }

  return NextResponse.redirect(`${origin}${localizedPath(lang, safeNext)}`);
}

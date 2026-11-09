import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getFeaturedByPublicId } from "@/lib/content/featured-heritage";
import { getDemoObjectByPublicId } from "@/lib/db/demo-data";
import { publicEnv } from "@/lib/env";
import { DEFAULT_LANGUAGE, LOCALE_COOKIE } from "@/lib/i18n/languages";
import { negotiateLanguage } from "@/lib/i18n/negotiate";
import { localizedPath, matchLanguage } from "@/lib/i18n/paths";
import { isValidPublicId } from "@/lib/validation/public-id";

/**
 * Responsibilities, in order:
 *
 * 1. Refresh the Supabase auth session so server components see a valid `auth.uid()`. Cookies
 *    are written back onto the response (the one place Next.js allows us to mutate them).
 * 2. Locale routing: public URLs are locale-prefixed (`/{lang}/...`); the QR URL (`/o/{publicId}`)
 *    and the site root are language-independent and redirected here to the best-guess locale.
 * 3. Resolve QR paths early enough to return real 404/410 statuses before a PPR shell is streamed.
 *
 * Runs on the Node.js runtime (Next.js 16 `proxy` replaces `middleware`). Public resolution never
 * returns unpublished content; the resolver exposes only whether a public identifier is available.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const candidateQrPath = /^\/([a-z]{2,8}(?:-[a-z0-9]{2,8})*)\/o\/([^/]+)$/i.exec(pathname);
  if (candidateQrPath && !isValidPublicId(candidateQrPath[2])) {
    return qrStatusResponse(candidateQrPath[1], 404);
  }

  // App Router pages cannot set an arbitrary status code after a PPR shell has streamed. Resolve
  // QR ids here so unknown/unpublished ids receive a real 404 and archived ids receive a 410.
  const objectPath = /^\/([a-z]{2,8}(?:-[a-z0-9]{2,8})*)\/o\/([0-9A-HJKMNP-TV-Z]{10})$/i.exec(
    pathname,
  );
  if (objectPath && url && anonKey) {
    const resolver = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await resolver.rpc("resolve_public_id", {
      p_public_id: objectPath[2],
    });
    const resolution = Array.isArray(data) ? data[0] : data;
    if (resolution?.status === "archived") {
      const language = objectPath[1];
      return qrStatusResponse(language, 410);
    }
    if (!error && !resolution && !getFeaturedByPublicId(objectPath[2], objectPath[1])) {
      return qrStatusResponse(objectPath[1], 404);
    }
  } else if (
    objectPath &&
    !getFeaturedByPublicId(objectPath[2], objectPath[1]) &&
    !getDemoObjectByPublicId(objectPath[2], objectPath[1])
  ) {
    return qrStatusResponse(objectPath[1], 404);
  }

  if (url && anonKey && /^\/[a-z]{2,8}(?:-[a-z0-9]{2,8})*\/admin(?:\/|$)/.test(pathname)) {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // Touching getUser() triggers the refresh token rotation when the access token is stale.
    await supabase.auth.getUser();
  }

  const firstSegment = pathname.split("/")[1] ?? "";
  const builtInLanguage = matchLanguage(pathname);
  if (builtInLanguage) return response;
  if (/^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/.test(firstSegment) && url && anonKey) {
    const localeClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: activeLocale } = await localeClient
      .from("languages")
      .select("code")
      .eq("code", firstSegment)
      .eq("is_active", true)
      .maybeSingle();
    if (activeLocale) return response;
  }

  let activeLanguages: string[] | undefined;
  let defaultLanguage = DEFAULT_LANGUAGE;
  if (url && anonKey) {
    const registryClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await registryClient
      .from("languages")
      .select("code, is_default")
      .eq("is_active", true);
    if (data?.length) {
      activeLanguages = data
        .map((language) => language.code)
        .filter((code) => /^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/.test(code));
      const preferred = data.find(
        (language) => language.is_default && activeLanguages?.includes(language.code),
      );
      if (preferred) defaultLanguage = preferred.code;
    }
  }

  const language = negotiateLanguage({
    cookie: request.cookies.get(LOCALE_COOKIE)?.value ?? null,
    acceptLanguage: request.headers.get("accept-language"),
    fallback: defaultLanguage,
    supportedLanguages: activeLanguages,
  });

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = localizedPath(language, pathname);

  const redirect = NextResponse.redirect(redirectUrl);
  redirect.cookies.set(LOCALE_COOKIE, language, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return redirect;
}

function qrStatusResponse(language: string, status: 404 | 410) {
  const isArabic = language.toLowerCase() === "ar" || language.toLowerCase().startsWith("ar-");
  const title =
    status === 410
      ? isArabic
        ? "لم تعد هذه القطعة متاحة"
        : "This object is no longer available"
      : isArabic
        ? "لم يتم العثور على القطعة"
        : "Object not found";
  const body =
    status === 410
      ? isArabic
        ? "هذا الرمز يشير إلى قطعة أرشيفية. يرجى التواصل مع الكنيسة لمزيد من المعلومات."
        : "This QR code refers to an archived object. Please contact the church for more information."
      : isArabic
        ? "هذا الرمز لا يشير إلى قطعة منشورة. تحقق من الرابط أو تواصل مع الكنيسة."
        : "This QR code does not point to a published object. Check the link or contact the church.";
  const document = `<!doctype html><html lang="${language}" dir="${isArabic ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
  return new NextResponse(document, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": status === 410 ? "public, max-age=300, s-maxage=3600" : "no-store",
    },
  });
}

export const config = {
  // Excludes the auth callback + API routes (and static assets) from locale handling.
  matcher: [
    "/((?!api|auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};

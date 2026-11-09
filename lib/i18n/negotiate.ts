import { DEFAULT_LANGUAGE, isSupportedLanguage } from "./languages";

interface PreferredTag {
  tag: string;
  quality: number;
}

/** Parses an `Accept-Language` header into tags ordered by descending q-value (RFC 9110 §12.5.4). */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];

  return header
    .split(",")
    .map((part): PreferredTag | null => {
      const [rawTag, ...params] = part.trim().split(";");
      const tag = rawTag.trim().toLowerCase();
      if (!tag) return null;

      let quality = 1;
      for (const param of params) {
        const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param);
        if (match) {
          const parsed = Number.parseFloat(match[1]);
          quality = Number.isNaN(parsed) ? 0 : parsed;
        }
      }
      return { tag, quality };
    })
    .filter((entry): entry is PreferredTag => entry !== null && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.tag);
}

export interface NegotiateLanguageInput {
  cookie?: string | null;
  acceptLanguage?: string | null;
  fallback?: string;
  supportedLanguages?: readonly string[];
}

/**
 * Chooses the best supported language: an explicit remembered choice (cookie) wins, then the
 * highest-weighted supported `Accept-Language` tag (matching `ar` or `ar-EG`), then the fallback.
 */
export function negotiateLanguage({
  cookie,
  acceptLanguage,
  fallback = DEFAULT_LANGUAGE,
  supportedLanguages = [],
}: NegotiateLanguageInput): string {
  const supported = (code: string | null | undefined): code is string =>
    Boolean(
      code &&
      (supportedLanguages.length > 0
        ? supportedLanguages.includes(code)
        : isSupportedLanguage(code)),
    );

  if (supported(cookie)) return cookie;

  for (const tag of parseAcceptLanguage(acceptLanguage)) {
    if (tag === "*") break;
    const base = tag.split("-")[0];
    if (supported(base)) return base;
  }

  return supported(fallback)
    ? fallback
    : supported(DEFAULT_LANGUAGE)
      ? DEFAULT_LANGUAGE
      : (supportedLanguages[0] ?? DEFAULT_LANGUAGE);
}

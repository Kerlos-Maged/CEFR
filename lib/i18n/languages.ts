/**
 * Centralized language registry (FR-ML-2). Routing, directionality, and locale
 * negotiation all read from this single source. The `public.languages` table seeded by
 * `supabase/migrations/20261019000007_seed_languages.sql` is the database-side mirror of
 * this list; keep the two in sync when a language is added.
 */
export type TextDirection = "ltr" | "rtl";

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  direction: TextDirection;
}

export const DEFAULT_LANGUAGE = "en";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LANGUAGES: readonly Language[] = [
  { code: "en", name: "English", nativeName: "English", direction: "ltr" },
  { code: "ar", name: "Arabic", nativeName: "العربية", direction: "rtl" },
];

export const SUPPORTED_LANGUAGE_CODES: readonly string[] = LANGUAGES.map(
  (language) => language.code,
);

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

const LANGUAGES_BY_CODE = new Map(LANGUAGES.map((language) => [language.code, language]));

export function isSupportedLanguage(value: string | null | undefined): boolean {
  return typeof value === "string" && LANGUAGES_BY_CODE.has(value);
}

/** Syntactic validator for language codes configured in the database registry. */
export function isValidLanguageCode(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/.test(value);
}

export function getLanguage(code: string): Language | null {
  return LANGUAGES_BY_CODE.get(code) ?? null;
}

export function getDirection(code: string): TextDirection {
  return LANGUAGES_BY_CODE.get(code)?.direction ?? "ltr";
}

export function isRtl(code: string): boolean {
  return getDirection(code) === "rtl";
}

/** Resolves any unknown tag to a supported code, defaulting to English. */
export function normalizeLanguage(code: string | null | undefined): string {
  return isSupportedLanguage(code) ? (code as string) : DEFAULT_LANGUAGE;
}

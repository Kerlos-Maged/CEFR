import { isSupportedLanguage } from "./languages";

/**
 * Returns the locale segment when `pathname` already starts with a supported language code
 * (e.g. `/ar/o/ABC` -> `ar`), otherwise `null`.
 */
export function matchLanguage(pathname: string): string | null {
  const first = pathname.split("/")[1] ?? "";
  return isSupportedLanguage(first) ? first : null;
}

/**
 * Builds a locale-prefixed path. Public URLs are locale-prefixed (`/en/o/{publicId}`) while
 * the QR URL (`/o/{publicId}`) stays language-independent and is redirected by `proxy.ts`.
 */
export function localizedPath(lang: string, path: string): string {
  if (!path || path === "/") return `/${lang}`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${lang}${normalized}`;
}

/** Localized content shape shared across object/church/media read models. */
export interface LocalizedContent {
  title: string;
  description: string | null;
}

interface Localizable {
  language_code: string;
}

/**
 * Resolves a localized row using the requested locale, falling back to the object's
 * default language and finally to any available row. `isFallback` is true whenever the
 * returned row is not in the requested locale.
 */
export function pickTranslation<T extends Localizable>(
  rows: T[],
  locale: string,
  fallback: string,
): { translated: T | null; isFallback: boolean } {
  const exact = rows.find((row) => row.language_code === locale);
  if (exact) return { translated: exact, isFallback: false };

  const fallbackRow = rows.find((row) => row.language_code === fallback) ?? rows[0] ?? null;
  return { translated: fallbackRow, isFallback: fallbackRow !== null };
}

/** Normalizes a PostgREST embedded to-one relation (object | array | null) to a single value. */
export function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Per-language media caption/alt text, keyed by language code. */
export interface MediaCaption {
  caption: string | null;
  altText: string | null;
}

export interface ResolvedMediaCaption extends MediaCaption {
  isFallback: boolean;
  language: string | null;
}

/**
 * Resolves a media caption for the requested locale using the same fallback order as object
 * content (requested -> object default -> any). `isFallback` is true when the returned caption
 * is not in the requested language.
 */
export function pickMediaCaption(
  captions: Record<string, MediaCaption>,
  locale: string,
  fallback: string,
): ResolvedMediaCaption {
  const exact = captions[locale];
  if (exact) return { ...exact, isFallback: false, language: locale };

  const fallbackCaption = captions[fallback];
  if (fallbackCaption) return { ...fallbackCaption, isFallback: true, language: fallback };

  const firstKey = Object.keys(captions)[0];
  if (firstKey) return { ...captions[firstKey], isFallback: true, language: firstKey };

  return { caption: null, altText: null, isFallback: false, language: null };
}

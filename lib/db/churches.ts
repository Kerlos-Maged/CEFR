import { cacheLife, cacheTag } from "next/cache";

import { createAnonClient, publicStorageUrl, type DatabaseClient } from "./client";
import { DalError } from "./errors";
import { pickTranslation, type LocalizedContent } from "./localization";

const SLUG_PATTERN = /^[a-z0-9-]{3,60}$/;

export interface ChurchSummary {
  id: string;
  slug: string;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  rite: string | null;
  metadata: Record<string, unknown>;
  externalLinks: string[];
  coverImageUrl: string | null;
  requestedLocale: string;
  usedFallback: boolean;
  content: LocalizedContent | null;
}

export interface ChurchObjectSummary {
  id: string;
  publicId: string;
  objectType: string;
  approximateDate: string | null;
  publishedAt: string | null;
  requestedLocale: string;
  usedFallback: boolean;
  content: LocalizedContent | null;
}

export interface ChurchPage {
  church: ChurchSummary;
  objects: ChurchObjectSummary[];
}

export interface PublicChurchListItem {
  id: string;
  slug: string;
  city: string | null;
  district: string | null;
  rite: string | null;
  requestedLocale: string;
  usedFallback: boolean;
  content: LocalizedContent | null;
}

export interface PublicChurchDirectory {
  items: PublicChurchListItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface ChurchTranslationRow {
  language_code: string;
  name: string;
  description: string | null;
}

interface ChurchRow {
  id: string;
  slug: string;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  rite: string | null;
  metadata: unknown;
  church_translations: ChurchTranslationRow[] | null;
}

interface ObjectSummaryRow {
  id: string;
  public_id: string;
  object_type: string;
  approximate_date: string | null;
  published_at: string | null;
  default_language: string;
  object_translations:
    { language_code: string; title: string; description: string | null }[] | null;
}

function publicExternalLinks(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const links = (metadata as { external_links?: unknown }).external_links;
  if (!Array.isArray(links)) return [];
  return links.filter((value): value is string => {
    if (typeof value !== "string") return false;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  });
}

/**
 * Loads an active church with its published objects for the public church page.
 * Returns `null` for unknown, malformed, or archived slugs. All returned objects are
 * `status='published'` in an active church (enforced by RLS for the anon client).
 */
export async function getChurchBySlug(
  slug: string,
  locale: string,
  client: DatabaseClient = createAnonClient(),
): Promise<ChurchPage | null> {
  const normalizedSlug = slug.toLowerCase();
  if (!SLUG_PATTERN.test(normalizedSlug)) return null;

  const { data: church, error: churchError } = await client
    .from("churches")
    .select(
      `id, slug, city, district, latitude, longitude, rite, metadata, cover_media_id,
       church_translations ( language_code, name, description )`,
    )
    .eq("slug", normalizedSlug)
    .eq("status", "active")
    .maybeSingle();

  if (churchError) {
    throw new DalError("INTERNAL", `Failed to load church "${slug}": ${churchError.message}`);
  }
  if (!church) return null;

  const churchRow = church as unknown as ChurchRow;
  const churchTranslation = pickTranslation(churchRow.church_translations ?? [], locale, "en");

  let coverImageUrl: string | null = null;
  const coverMediaId = (church as unknown as { cover_media_id?: string | null }).cover_media_id;
  if (coverMediaId) {
    const { data: cover, error: coverError } = await client
      .from("media")
      .select("bucket, storage_path, objects!inner(church_id, status)")
      .eq("id", coverMediaId)
      .eq("bucket", "object-media")
      .eq("media_type", "image")
      .eq("is_public", true)
      .in("permission_status", ["granted", "public_domain"])
      .eq("objects.church_id", churchRow.id)
      .eq("objects.status", "published")
      .maybeSingle();
    if (coverError) {
      throw new DalError("INTERNAL", `Failed to load church cover image: ${coverError.message}`);
    }
    if (cover) coverImageUrl = publicStorageUrl(cover.bucket, cover.storage_path);
  }

  const { data: objects, error: objectsError } = await client
    .from("objects")
    .select(
      `id, public_id, object_type, approximate_date, published_at, default_language,
       object_translations ( language_code, title, description )`,
    )
    .eq("church_id", churchRow.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (objectsError) {
    throw new DalError(
      "INTERNAL",
      `Failed to load objects for church "${slug}": ${objectsError.message}`,
    );
  }

  return {
    church: {
      id: churchRow.id,
      slug: churchRow.slug,
      city: churchRow.city,
      district: churchRow.district,
      latitude: churchRow.latitude,
      longitude: churchRow.longitude,
      rite: churchRow.rite,
      metadata: (churchRow.metadata ?? {}) as Record<string, unknown>,
      externalLinks: publicExternalLinks(churchRow.metadata),
      coverImageUrl,
      requestedLocale: locale,
      usedFallback: churchTranslation.isFallback,
      content: churchTranslation.translated
        ? {
            title: churchTranslation.translated.name,
            description: churchTranslation.translated.description,
          }
        : null,
    },
    objects: ((objects ?? []) as unknown as ObjectSummaryRow[]).map((row) => {
      const translation = pickTranslation(
        row.object_translations ?? [],
        locale,
        row.default_language,
      );
      return {
        id: row.id,
        publicId: row.public_id,
        objectType: row.object_type,
        approximateDate: row.approximate_date,
        publishedAt: row.published_at,
        requestedLocale: locale,
        usedFallback: translation.isFallback,
        content: translation.translated
          ? { title: translation.translated.title, description: translation.translated.description }
          : null,
      };
    }),
  };
}

/** Cached wrapper used by public routes. The uncached DAL remains available to integrations. */
export async function getCachedChurchBySlug(
  slug: string,
  locale: string,
): Promise<ChurchPage | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("churches", `church:${slug.toLowerCase()}`);
  const page = await getChurchBySlug(slug, locale);
  if (page) cacheTag(`church:${page.church.id}`);
  return page;
}

/** Paginated active-church directory. RLS hides archived churches and unpublished objects. */
export async function listActiveChurches(
  locale: string,
  page = 1,
  pageSize = 24,
  search = "",
): Promise<PublicChurchDirectory> {
  "use cache";
  cacheLife("hours");
  cacheTag("churches");

  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) ? Math.min(Math.max(pageSize, 1), 100) : 24;
  const start = (safePage - 1) * safePageSize;
  const end = start + safePageSize - 1;
  const client = createAnonClient();
  let query = client
    .from("churches")
    .select(
      "id, slug, city, district, rite, church_translations ( language_code, name, description )",
      { count: "exact" },
    )
    .eq("status", "active");
  const safeSearch = search
    .trim()
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 60);
  if (safeSearch)
    query = query.or(
      `slug.ilike.%${safeSearch}%,city.ilike.%${safeSearch}%,district.ilike.%${safeSearch}%`,
    );
  const { data, error, count } = await query.order("slug", { ascending: true }).range(start, end);

  if (error) throw new DalError("INTERNAL", `Failed to list churches: ${error.message}`);

  const rows = (data ?? []) as unknown as ChurchRow[];
  return {
    items: rows.map((row) => {
      const translation = pickTranslation(row.church_translations ?? [], locale, "en");
      return {
        id: row.id,
        slug: row.slug,
        city: row.city,
        district: row.district,
        rite: row.rite,
        requestedLocale: locale,
        usedFallback: translation.isFallback,
        content: translation.translated
          ? { title: translation.translated.name, description: translation.translated.description }
          : null,
      };
    }),
    total: count ?? 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

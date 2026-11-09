import { isValidPublicId } from "@/lib/validation/public-id";
import { cacheLife, cacheTag } from "next/cache";

import { createAnonClient, publicStorageUrl, type DatabaseClient } from "./client";
import type { Database } from "./database.types";
import { DalError } from "./errors";
import { firstOrNull, pickTranslation, type LocalizedContent } from "./localization";

type PermissionStatus = Database["public"]["Enums"]["permission_status"];
type MediaType = Database["public"]["Enums"]["media_type"];
type VerificationStatus = Database["public"]["Enums"]["verification_status"];

export interface PublishedMedia {
  id: string;
  type: MediaType;
  storagePath: string;
  bucket: string;
  url: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  attribution: string | null;
  captions: Record<string, { caption: string | null; altText: string | null }>;
}

export interface PublishedSource {
  id: string;
  title: string;
  author: string | null;
  year: string | null;
  citation: string | null;
  url: string | null;
  sourceType: string | null;
}

export interface PublishedClaim {
  id: string;
  text: string;
  value: string | null;
  verification: VerificationStatus;
  sources: PublishedSource[];
}

export interface PublishedRelatedObject {
  id: string;
  publicId: string;
  objectType: string;
  approximateDate: string | null;
  title: string | null;
  relationshipType: string;
  description: string | null;
}

export interface PublishedObject {
  id: string;
  publicId: string;
  objectType: string;
  approximateDate: string | null;
  locationInChurch: string | null;
  defaultLanguage: string;
  publishedAt: string | null;
  requestedLocale: string;
  usedFallback: boolean;
  content: LocalizedContent | null;
  church?: { slug: string; name: string | null } | null;
  media: PublishedMedia[];
  claims: PublishedClaim[];
  sources: PublishedSource[];
  relatedObjects?: PublishedRelatedObject[];
}

export type PublicIdResolution =
  { kind: "available"; objectId: string; canonicalPublicId: string } | { kind: "gone" } | null;

interface TranslationRow {
  language_code: string;
  title: string;
  description: string | null;
}

interface MediaTranslationRow {
  language_code: string;
  caption: string | null;
  alt_text: string | null;
}

interface MediaRow {
  id: string;
  media_type: MediaType;
  storage_path: string;
  bucket: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  attribution: string | null;
  permission_status: PermissionStatus;
  is_public: boolean;
  sort_order: number;
  media_translations: MediaTranslationRow[] | null;
}

interface SourceRow {
  id: string;
  title: string;
  author: string | null;
  year: string | null;
  citation: string | null;
  url: string | null;
  source_type: string | null;
}

interface ClaimRow {
  id: string;
  claim_text: string;
  claimed_value: string | null;
  verification: VerificationStatus;
  is_public: boolean;
  sort_order: number;
  claim_sources: { sources: SourceRow | SourceRow[] | null }[] | null;
}

interface ObjectSourceRow {
  sources: SourceRow | SourceRow[] | null;
}

interface ObjectRow {
  id: string;
  public_id: string;
  object_type: string;
  approximate_date: string | null;
  location_in_church: string | null;
  default_language: string;
  published_at: string | null;
  object_translations: TranslationRow[] | null;
  media: MediaRow[] | null;
  claims: ClaimRow[] | null;
  object_sources: ObjectSourceRow[] | null;
  churches: {
    slug: string;
    church_translations:
      { language_code: string; name: string; description: string | null }[] | null;
  } | null;
}

const PUBLIC_OBJECT_SELECT = `
  id,
  public_id,
  object_type,
  approximate_date,
  location_in_church,
  default_language,
  published_at,
  object_translations ( language_code, title, description ),
  media (
    id, media_type, storage_path, bucket, mime_type, width, height, duration_seconds,
    attribution, permission_status, is_public, sort_order,
    media_translations ( language_code, caption, alt_text )
  ),
  claims (
    id, claim_text, claimed_value, verification, is_public, sort_order,
    claim_sources ( sources ( id, title, author, year, citation, url, source_type ) )
  ),
  object_sources ( sources ( id, title, author, year, citation, url, source_type ) ),
  churches ( slug, church_translations ( language_code, name, description ) )
`;

function toSource(row: SourceRow): PublishedSource {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    year: row.year,
    citation: row.citation,
    url: row.url,
    sourceType: row.source_type,
  };
}

function isPubliclyReleasable(media: MediaRow): boolean {
  return (
    media.is_public &&
    (media.permission_status === "granted" || media.permission_status === "public_domain")
  );
}

function mapMedia(rows: MediaRow[] | null): PublishedMedia[] {
  return (rows ?? [])
    .filter(isPubliclyReleasable)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((media) => {
      const captions: PublishedMedia["captions"] = {};
      for (const translation of media.media_translations ?? []) {
        captions[translation.language_code] = {
          caption: translation.caption,
          altText: translation.alt_text,
        };
      }
      return {
        id: media.id,
        type: media.media_type,
        storagePath: media.storage_path,
        bucket: media.bucket,
        url: publicStorageUrl(media.bucket, media.storage_path),
        mimeType: media.mime_type,
        width: media.width,
        height: media.height,
        durationSeconds: media.duration_seconds,
        attribution: media.attribution,
        captions,
      };
    });
}

function mapClaims(rows: ClaimRow[] | null): PublishedClaim[] {
  return (rows ?? [])
    .filter((claim) => claim.is_public)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((claim) => {
      const sources: PublishedSource[] = [];
      const seen = new Set<string>();
      for (const link of claim.claim_sources ?? []) {
        const source = firstOrNull(link.sources);
        if (source && !seen.has(source.id)) {
          seen.add(source.id);
          sources.push(toSource(source));
        }
      }
      return {
        id: claim.id,
        text: claim.claim_text,
        value: claim.claimed_value,
        verification: claim.verification,
        sources,
      };
    });
}

function mapObjectSources(rows: ObjectSourceRow[] | null): PublishedSource[] {
  const sources: PublishedSource[] = [];
  const seen = new Set<string>();
  for (const link of rows ?? []) {
    const source = firstOrNull(link.sources);
    if (source && !seen.has(source.id)) {
      seen.add(source.id);
      sources.push(toSource(source));
    }
  }
  return sources;
}

function mapObject(row: ObjectRow, locale: string): PublishedObject {
  const translations = row.object_translations ?? [];
  const { translated, isFallback } = pickTranslation(translations, locale, row.default_language);
  const churchTranslation = row.churches
    ? pickTranslation(row.churches.church_translations ?? [], locale, "en")
    : null;

  return {
    id: row.id,
    publicId: row.public_id,
    objectType: row.object_type,
    approximateDate: row.approximate_date,
    locationInChurch: row.location_in_church,
    defaultLanguage: row.default_language,
    publishedAt: row.published_at,
    requestedLocale: locale,
    usedFallback: isFallback,
    content: translated ? { title: translated.title, description: translated.description } : null,
    church: row.churches
      ? { slug: row.churches.slug, name: churchTranslation?.translated?.name ?? null }
      : null,
    media: mapMedia(row.media),
    claims: mapClaims(row.claims),
    sources: mapObjectSources(row.object_sources),
  };
}

/**
 * Loads a published object with its public translations, media, claims, and sources.
 * Returns `null` for ids that are invalid, unpublished, archived, or belong to an inactive
 * church. Locale falls back to the object's `default_language`.
 */
export async function getPublishedObjectByPublicId(
  publicId: string,
  locale: string,
  client: DatabaseClient = createAnonClient(),
): Promise<PublishedObject | null> {
  if (!isValidPublicId(publicId)) return null;

  const { data, error } = await client
    .from("objects")
    .select(PUBLIC_OBJECT_SELECT)
    .eq("public_id", publicId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new DalError("INTERNAL", `Failed to load object "${publicId}": ${error.message}`);
  }
  if (!data) return null;
  const object = mapObject(data as unknown as ObjectRow, locale);
  const { data: relationRows, error: relationError } = await client
    .from("object_relations")
    .select(
      "id, object_id, related_object_id, relationship_type, description, source:objects!object_relations_object_church_fkey(id, public_id, object_type, approximate_date, default_language, object_translations(language_code, title)), target:objects!object_relations_related_church_fkey(id, public_id, object_type, approximate_date, default_language, object_translations(language_code, title))",
    )
    .or(`object_id.eq.${data.id},related_object_id.eq.${data.id}`)
    .eq("is_public", true)
    .order("sort_order", { ascending: true });
  if (relationError) {
    throw new DalError("INTERNAL", `Failed to load related objects for "${publicId}".`);
  }
  type RelatedRow = {
    id: string;
    object_id: string;
    relationship_type: string;
    description: string | null;
    related_object_id: string;
    source: {
      id: string;
      public_id: string;
      object_type: string;
      approximate_date: string | null;
      default_language: string;
      object_translations: { language_code: string; title: string }[] | null;
    } | null;
    target: {
      id: string;
      public_id: string;
      object_type: string;
      approximate_date: string | null;
      default_language: string;
      object_translations: { language_code: string; title: string }[] | null;
    } | null;
  };
  object.relatedObjects = ((relationRows ?? []) as unknown as RelatedRow[])
    .map((row) => ({ row, counterpart: row.object_id === data.id ? row.target : row.source }))
    .filter((entry) => entry.counterpart)
    .map(({ row, counterpart }) => {
      const related = counterpart!;
      const translation = pickTranslation(related.object_translations ?? [], locale, related.default_language);
      return {
        id: related.id,
        publicId: related.public_id,
        objectType: related.object_type,
        approximateDate: related.approximate_date,
        title: translation.translated?.title ?? null,
        relationshipType: row.relationship_type,
        description: row.description,
      };
    });
  return object;
}

/**
 * Public object content is shared across visitors and can be cached. Publishing, unpublishing,
 * or editing an object invalidates its stable public-id tag from the corresponding server action.
 */
export async function getCachedPublishedObjectByPublicId(
  publicId: string,
  locale: string,
): Promise<PublishedObject | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("objects");
  cacheTag(`object:${publicId}`);
  return getPublishedObjectByPublicId(publicId, locale);
}

/**
 * Resolves any public id (current or retired alias) for routing:
 *   - `{ kind: "available" }` for a published object,
 *   - `{ kind: "gone" }` for an archived/retired object (HTTP 410),
 *   - `null` when unknown or still in progress (HTTP 404).
 */
export async function resolvePublicId(
  publicId: string,
  client: DatabaseClient = createAnonClient(),
): Promise<PublicIdResolution> {
  if (!isValidPublicId(publicId)) return null;

  const { data, error } = await client.rpc("resolve_public_id", { p_public_id: publicId });
  if (error) {
    throw new DalError("INTERNAL", `Failed to resolve public id "${publicId}": ${error.message}`);
  }

  const row = data?.[0];
  if (!row) return null;
  if (row.status === "archived") return { kind: "gone" };

  return { kind: "available", objectId: row.object_id, canonicalPublicId: row.canonical_public_id };
}

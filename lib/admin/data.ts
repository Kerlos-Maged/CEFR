import type { DatabaseClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";
import { DalError } from "@/lib/db/errors";

/**
 * Read-side data access for the admin CMS. Every function takes the request-scoped, user-bound
 * Supabase client so Row Level Security decides what is visible — the queries below apply no
 * ad-hoc church filter that could be bypassed by calling the same code with a different client.
 * Lists are best-effort scoped by RLS; the caller's memberships drive the UI, not trust in input.
 */

export type ObjectStatus = Database["public"]["Enums"]["object_status"];

export interface AdminObjectSummary {
  id: string;
  publicId: string;
  objectType: string;
  status: ObjectStatus;
  churchId: string;
  defaultLanguage: string;
  updatedAt: string;
  title: string | null;
}

export interface AdminObjectDetail extends AdminObjectSummary {
  approximateDate: string | null;
  locationInChurch: string | null;
  materials: string | null;
  dimensions: string | null;
  conditionNotes: string | null;
  publishedAt: string | null;
  translations: {
    languageCode: string;
    title: string;
    description: string | null;
    isComplete: boolean;
  }[];
  media: {
    id: string;
    sortOrder: number;
    mediaType: string;
    bucket: string;
    storagePath: string;
    mimeType: string;
    permissionStatus: string;
    copyrightHolder: string | null;
    isPublic: boolean;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    attribution: string | null;
    altTexts: Record<string, string | null>;
    captions: Record<string, string | null>;
  }[];
  claims: {
    id: string;
    text: string;
    value: string | null;
    verification: string;
    isPublic: boolean;
  }[];
  relations: {
    id: string;
    relatedObjectId: string;
    relatedPublicId: string;
    relatedTitle: string | null;
    relationshipType: string;
    description: string | null;
    isPublic: boolean;
  }[];
  relationCandidates: {
    id: string;
    publicId: string;
    title: string | null;
    objectType: string;
  }[];
  sources: { id: string; title: string; author: string | null; year: string | null }[];
  history: {
    fromStatus: string;
    toStatus: string;
    notes: string | null;
    createdAt: string;
    actorId: string | null;
  }[];
  reviews: {
    reviewType: string;
    decision: string;
    notes: string | null;
    createdAt: string;
    actorId: string | null;
  }[];
}

export interface AdminChurchSummary {
  id: string;
  slug: string;
  name: string | null;
  status: string;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  dedicationDate: string | null;
  rite: string | null;
  externalLinks: string[];
  coverMediaId: string | null;
  coverMediaChoices: { id: string; label: string }[];
  translations: { languageCode: string; name: string; description: string | null }[];
}

export interface AdminUserSummary {
  id: string;
  displayName: string | null;
  isPlatformAdmin: boolean;
  memberships: { id: string; churchId: string; role: string }[];
}

const OBJECT_SUMMARY_SELECT = `
  id, public_id, object_type, status, church_id, default_language, updated_at,
  approximate_date, location_in_church, materials, dimensions, condition_notes,
  object_translations ( language_code, title, description ), claims ( claim_text )
`;

interface RawSummary {
  id: string;
  public_id: string;
  object_type: string;
  status: ObjectStatus;
  church_id: string;
  default_language: string;
  updated_at: string;
  approximate_date: string | null;
  location_in_church: string | null;
  materials: string | null;
  dimensions: string | null;
  condition_notes: string | null;
  object_translations:
    { language_code: string; title: string; description: string | null }[] | null;
  claims: { claim_text: string }[] | null;
}

function toSummary(row: RawSummary): AdminObjectSummary {
  const translations = row.object_translations ?? [];
  const preferred =
    translations.find((t) => t.language_code === row.default_language) ?? translations[0] ?? null;
  return {
    id: row.id,
    publicId: row.public_id,
    objectType: row.object_type,
    status: row.status,
    churchId: row.church_id,
    defaultLanguage: row.default_language,
    updatedAt: row.updated_at,
    title: preferred?.title ?? null,
  };
}

export async function listObjects(
  client: DatabaseClient,
  options: { churchId?: string; status?: ObjectStatus; search?: string } = {},
): Promise<AdminObjectSummary[]> {
  let query = client.from("objects").select(OBJECT_SUMMARY_SELECT).order("updated_at", {
    ascending: false,
  });
  if (options.churchId) query = query.eq("church_id", options.churchId);
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw new DalError("INTERNAL", `Failed to list objects: ${error.message}`);
  const rows = data as unknown as RawSummary[];
  const search = options.search?.trim().toLocaleLowerCase();
  const matchingRows = search
    ? rows.filter((row) => {
        const searchable = [
          row.public_id,
          row.object_type,
          row.status,
          row.approximate_date,
          row.location_in_church,
          row.materials,
          row.dimensions,
          row.condition_notes,
          ...(row.object_translations ?? []).flatMap((translation) => [
            translation.title,
            translation.description,
          ]),
          ...(row.claims ?? []).map((claim) => claim.claim_text),
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();
        return searchable.includes(search);
      })
    : rows;
  return matchingRows.map(toSummary);
}

export async function getObjectForAdmin(
  client: DatabaseClient,
  objectId: string,
): Promise<AdminObjectDetail | null> {
  const { data, error } = await client
    .from("objects")
    .select(
      `
      id, public_id, object_type, status, church_id, default_language, updated_at,
      approximate_date, location_in_church, materials, dimensions, condition_notes, published_at,
      object_translations ( language_code, title, description, is_complete ),
      media (
        id, media_type, bucket, storage_path, mime_type, permission_status, copyright_holder, is_public,
        width, height, duration_seconds, attribution, sort_order,
        media_translations ( language_code, caption, alt_text )
      ),
      claims ( id, claim_text, claimed_value, verification, is_public, sort_order ),
      object_sources ( sources ( id, title, author, year ) ),
      publication_history ( from_status, to_status, notes, created_at, actor_id ),
      review_records ( review_type, decision, notes, created_at, actor_id )
    `,
    )
    .eq("id", objectId)
    .maybeSingle();

  if (error) throw new DalError("INTERNAL", `Failed to load object: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as {
    id: string;
    public_id: string;
    object_type: string;
    status: ObjectStatus;
    church_id: string;
    default_language: string;
    updated_at: string;
    approximate_date: string | null;
    location_in_church: string | null;
    materials: string | null;
    dimensions: string | null;
    condition_notes: string | null;
    published_at: string | null;
    object_translations:
      | { language_code: string; title: string; description: string | null; is_complete: boolean }[]
      | null;
    media:
      | {
          id: string;
          media_type: string;
          bucket: string;
          storage_path: string;
          mime_type: string;
          permission_status: string;
          copyright_holder: string | null;
          is_public: boolean;
          width: number | null;
          height: number | null;
          duration_seconds: number | null;
          attribution: string | null;
          sort_order: number;
          media_translations:
            { language_code: string; caption: string | null; alt_text: string | null }[] | null;
        }[]
      | null;
    claims:
      | {
          id: string;
          claim_text: string;
          claimed_value: string | null;
          verification: string;
          is_public: boolean;
          sort_order: number;
        }[]
      | null;
    object_sources:
      | {
          sources: { id: string; title: string; author: string | null; year: string | null } | null;
        }[]
      | null;
    publication_history:
      | {
          from_status: string;
          to_status: string;
          notes: string | null;
          created_at: string;
          actor_id: string | null;
        }[]
      | null;
    review_records:
      | {
          review_type: string;
          decision: string;
          notes: string | null;
          created_at: string;
          actor_id: string | null;
        }[]
      | null;
  };

  const translations = row.object_translations ?? [];
  const preferred =
    translations.find((t) => t.language_code === row.default_language) ?? translations[0] ?? null;

  const [relationsResult, candidates] = await Promise.all([
    client
      .from("object_relations")
      .select(
        "id, related_object_id, relationship_type, description, is_public, objects!object_relations_related_church_fkey(id, public_id, default_language, object_translations(language_code, title))",
      )
      .eq("object_id", objectId)
      .order("sort_order", { ascending: true }),
    listObjects(client, { churchId: row.church_id }),
  ]);
  if (relationsResult.error) {
    throw new DalError(
      "INTERNAL",
      `Failed to load object relationships: ${relationsResult.error.message}`,
    );
  }
  const relations = (relationsResult.data ?? []) as unknown as {
    id: string;
    related_object_id: string;
    relationship_type: string;
    description: string | null;
    is_public: boolean;
    objects: {
      id: string;
      public_id: string;
      default_language: string;
      object_translations: { language_code: string; title: string }[] | null;
    } | null;
  }[];

  return {
    id: row.id,
    publicId: row.public_id,
    objectType: row.object_type,
    status: row.status,
    churchId: row.church_id,
    defaultLanguage: row.default_language,
    updatedAt: row.updated_at,
    title: preferred?.title ?? null,
    approximateDate: row.approximate_date,
    locationInChurch: row.location_in_church,
    materials: row.materials,
    dimensions: row.dimensions,
    conditionNotes: row.condition_notes,
    publishedAt: row.published_at,
    translations: translations.map((t) => ({
      languageCode: t.language_code,
      title: t.title,
      description: t.description,
      isComplete: t.is_complete,
    })),
    media: (row.media ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => {
        const altTexts: Record<string, string | null> = {};
        const captions: Record<string, string | null> = {};
        for (const t of m.media_translations ?? []) {
          altTexts[t.language_code] = t.alt_text;
          captions[t.language_code] = t.caption;
        }
        return {
          id: m.id,
          sortOrder: m.sort_order,
          mediaType: m.media_type,
          bucket: m.bucket,
          storagePath: m.storage_path,
          mimeType: m.mime_type,
          permissionStatus: m.permission_status,
          copyrightHolder: m.copyright_holder,
          isPublic: m.is_public,
          width: m.width,
          height: m.height,
          durationSeconds: m.duration_seconds,
          attribution: m.attribution,
          altTexts,
          captions,
        };
      }),
    claims: (row.claims ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        id: c.id,
        text: c.claim_text,
        value: c.claimed_value,
        verification: c.verification,
        isPublic: c.is_public,
      })),
    relations: relations.flatMap((relation) => {
      if (!relation.objects) return [];
      const relatedTranslations = relation.objects.object_translations ?? [];
      const relatedPreferred =
        relatedTranslations.find((t) => t.language_code === relation.objects!.default_language) ??
        relatedTranslations[0] ??
        null;
      return [
        {
          id: relation.id,
          relatedObjectId: relation.objects.id,
          relatedPublicId: relation.objects.public_id,
          relatedTitle: relatedPreferred?.title ?? null,
          relationshipType: relation.relationship_type,
          description: relation.description,
          isPublic: relation.is_public,
        },
      ];
    }),
    relationCandidates: candidates
      .filter((candidate) => candidate.id !== objectId)
      .map((candidate) => ({
        id: candidate.id,
        publicId: candidate.publicId,
        title: candidate.title,
        objectType: candidate.objectType,
      })),
    sources: (row.object_sources ?? [])
      .map((link) => link.sources)
      .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    history: (row.publication_history ?? []).map((entry) => ({
      fromStatus: entry.from_status,
      toStatus: entry.to_status,
      notes: entry.notes,
      createdAt: entry.created_at,
      actorId: entry.actor_id,
    })),
    reviews: (row.review_records ?? []).map((review) => ({
      reviewType: review.review_type,
      decision: review.decision,
      notes: review.notes,
      createdAt: review.created_at,
      actorId: review.actor_id,
    })),
  };
}

export async function listChurches(client: DatabaseClient): Promise<AdminChurchSummary[]> {
  const { data, error } = await client
    .from("churches")
    .select(
      "id, slug, status, city, district, latitude, longitude, dedication_date, rite, metadata, cover_media_id, church_translations ( language_code, name, description )",
    )
    .order("slug");

  if (error) throw new DalError("INTERNAL", `Failed to list churches: ${error.message}`);

  const churchRows = data as unknown as {
    id: string;
    slug: string;
    status: string;
    city: string | null;
    district: string | null;
    latitude: number | null;
    longitude: number | null;
    dedication_date: string | null;
    rite: string | null;
    cover_media_id: string | null;
    metadata?: unknown;
    church_translations:
      { language_code: string; name: string; description: string | null }[] | null;
  }[];
  const { data: mediaRows, error: mediaError } = await client
    .from("media")
    .select(
      "id, object_id, objects!inner(church_id, status, object_translations(language_code, title))",
    )
    .eq("media_type", "image")
    .eq("bucket", "object-media")
    .eq("is_public", true)
    .in("permission_status", ["granted", "public_domain"])
    .eq("objects.status", "published");
  if (mediaError)
    throw new DalError("INTERNAL", `Failed to load church cover choices: ${mediaError.message}`);
  const coverChoices = new Map<string, { id: string; label: string }[]>();
  for (const row of (mediaRows ?? []) as unknown as {
    id: string;
    objects: {
      church_id: string;
      object_translations: { language_code: string; title: string }[] | null;
    };
  }[]) {
    const churchId = row.objects.church_id;
    const translations = row.objects.object_translations ?? [];
    const title =
      translations.find((translation) => translation.language_code === "en")?.title ??
      translations[0]?.title ??
      "Published record";
    const choices = coverChoices.get(churchId) ?? [];
    choices.push({ id: row.id, label: title });
    coverChoices.set(churchId, choices);
  }

  return churchRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    status: row.status,
    name: row.church_translations?.[0]?.name ?? null,
    city: row.city,
    district: row.district,
    latitude: row.latitude,
    longitude: row.longitude,
    dedicationDate: row.dedication_date,
    rite: row.rite,
    coverMediaId: row.cover_media_id,
    coverMediaChoices: coverChoices.get(row.id) ?? [],
    externalLinks: (() => {
      const metadata =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as { external_links?: unknown })
          : {};
      return Array.isArray(metadata.external_links)
        ? metadata.external_links.filter((link): link is string => typeof link === "string")
        : [];
    })(),
    translations: (row.church_translations ?? []).map((translation) => ({
      languageCode: translation.language_code,
      name: translation.name,
      description: translation.description,
    })),
  }));
}

export async function listMembershipWorkspace(client: DatabaseClient): Promise<AdminUserSummary[]> {
  // Admin-only read: profiles_self_read + church_memberships_self_read restrict this to the
  // current user unless they are a platform admin.
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, is_platform_admin, church_memberships ( id, church_id, role )")
    .order("display_name");

  if (error) throw new DalError("INTERNAL", `Failed to list users: ${error.message}`);

  return (
    data as unknown as {
      id: string;
      display_name: string | null;
      is_platform_admin: boolean;
      church_memberships: { id: string; church_id: string; role: string }[] | null;
    }[]
  ).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    isPlatformAdmin: row.is_platform_admin,
    memberships: (row.church_memberships ?? []).map((m) => ({
      id: m.id,
      churchId: m.church_id,
      role: m.role,
    })),
  }));
}

export interface ReviewQueueItem extends AdminObjectSummary {
  submittedAt: string;
}

/** Objects awaiting a decision at the given stage. */
export async function listReviewQueue(
  client: DatabaseClient,
  status: "historical_review" | "church_review",
): Promise<ReviewQueueItem[]> {
  const items = await listObjects(client, { status });
  return items.map((item) => ({ ...item, submittedAt: item.updatedAt }));
}

export interface AdminDashboardCounts {
  byStatus: Record<string, number>;
  churches: number;
}

export interface AnalyticsReport {
  totals: Record<string, number>;
  byDay: { day: string; pageViews: number; audioPlays: number }[];
  byLanguage: { language: string; count: number }[];
  byChurch: { churchId: string; churchName: string; count: number }[];
  topObjects: { publicId: string; title: string; count: number }[];
}

/** Reads only daily aggregates. RLS limits church staff to their own churches. */
export async function getAnalyticsReport(
  client: DatabaseClient,
  options: { from: string; to: string; churchId?: string },
): Promise<AnalyticsReport> {
  let query = client
    .from("analytics_daily")
    .select("day, object_id, church_id, language_code, event_type, count")
    .gte("day", options.from)
    .lte("day", options.to)
    .order("day", { ascending: true })
    .range(0, 4999);
  if (options.churchId) query = query.eq("church_id", options.churchId);

  const { data, error } = await query;
  if (error) throw new DalError("INTERNAL", `Failed to load analytics: ${error.message}`);
  const rows = data ?? [];

  const totals: Record<string, number> = {};
  const dayTotals = new Map<string, { pageViews: number; audioPlays: number }>();
  const languageTotals = new Map<string, number>();
  const churchTotals = new Map<string, number>();
  const objectTotals = new Map<string, number>();
  const objectIds = new Set<string>();

  for (const row of rows) {
    totals[row.event_type] = (totals[row.event_type] ?? 0) + row.count;
    if (row.language_code) {
      languageTotals.set(
        row.language_code,
        (languageTotals.get(row.language_code) ?? 0) + row.count,
      );
    }
    if (row.church_id) {
      churchTotals.set(row.church_id, (churchTotals.get(row.church_id) ?? 0) + row.count);
    }
    if (row.object_id) {
      objectIds.add(row.object_id);
      objectTotals.set(row.object_id, (objectTotals.get(row.object_id) ?? 0) + row.count);
    }
    const daily = dayTotals.get(row.day) ?? { pageViews: 0, audioPlays: 0 };
    if (row.event_type === "page_view") daily.pageViews += row.count;
    if (row.event_type === "audio_play") daily.audioPlays += row.count;
    dayTotals.set(row.day, daily);
  }

  const [churches, objectsResult] = await Promise.all([
    listChurches(client),
    objectIds.size > 0
      ? client
          .from("objects")
          .select("id, public_id, default_language, object_translations ( language_code, title )")
          .in("id", [...objectIds])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (objectsResult.error) {
    throw new DalError(
      "INTERNAL",
      `Failed to load analytics object labels: ${objectsResult.error.message}`,
    );
  }

  const churchNames = new Map(churches.map((church) => [church.id, church.name ?? church.slug]));
  const objectLabels = new Map(
    (objectsResult.data ?? []).map((object) => {
      const translations = object.object_translations ?? [];
      const preferred =
        translations.find((translation) => translation.language_code === object.default_language) ??
        translations[0];
      return [
        object.id,
        { publicId: object.public_id, title: preferred?.title ?? object.public_id },
      ];
    }),
  );

  return {
    totals,
    byDay: [...dayTotals.entries()].map(([day, values]) => ({ day, ...values })),
    byLanguage: [...languageTotals.entries()]
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count),
    byChurch: [...churchTotals.entries()]
      .map(([churchId, count]) => ({
        churchId,
        churchName: churchNames.get(churchId) ?? churchId,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    topObjects: [...objectTotals.entries()]
      .map(([objectId, count]) => {
        const label = objectLabels.get(objectId);
        return {
          publicId: label?.publicId ?? objectId,
          title: label?.title ?? objectId,
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
  };
}

export async function getDashboardCounts(client: DatabaseClient): Promise<AdminDashboardCounts> {
  const [objectsResult, churchesResult] = await Promise.all([
    client.from("objects").select("status"),
    client.from("churches").select("id", { count: "exact", head: true }),
  ]);

  if (objectsResult.error) {
    throw new DalError("INTERNAL", `Failed to count objects: ${objectsResult.error.message}`);
  }

  const byStatus: Record<string, number> = {};
  for (const row of objectsResult.data ?? []) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  }

  return { byStatus, churches: churchesResult.count ?? 0 };
}

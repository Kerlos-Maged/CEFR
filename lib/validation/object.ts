import { z } from "zod";

/**
 * Validation schemas for admin content mutations (docs/architecture/api-contracts.md §5).
 *
 * Every schema is **strict** and enumerates exactly the fields a caller may set. Protected
 * columns (`status`, `church_id`, `public_id`, `created_by`, timestamps) are deliberately absent
 * so they can never be mass-assigned — client-submitted values for them are rejected, not
 * silently ignored.
 */

export const OBJECT_TYPES = [
  "icon",
  "wall_painting",
  "fresco",
  "architectural_feature",
  "wood_carving",
  "iconostasis",
  "inscription",
  "manuscript",
  "liturgical_object",
  "other",
] as const;

export type ObjectType = (typeof OBJECT_TYPES)[number];

export const SOURCE_TYPES = ["book", "article", "archive", "oral", "web", "other"] as const;

export const MEDIA_TYPES = ["image", "audio"] as const;

export const PERMISSION_STATUSES = ["granted", "public_domain", "pending", "restricted"] as const;

export const VERIFICATION_STATUSES = ["verified", "uncertain", "disputed"] as const;

export const OBJECT_RELATIONSHIP_TYPES = [
  "same_subject",
  "same_artist",
  "same_workshop",
  "part_of_set",
  "same_location",
  "historical_context",
  "inspired_by",
  "related",
] as const;

const uuid = z.uuid("A valid identifier is required.");
const optionalUuid = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : value),
  uuid.optional(),
);
const languageCode = z.string().regex(/^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? undefined : value),
    z.string().trim().max(max).optional(),
  );

/** Optional HTTP(S) URL: rejects `javascript:` and other non-http schemes. */
const optionalHttpUrl = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : value),
  z
    .string()
    .trim()
    .max(2048)
    .refine(
      (value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "Enter a valid http(s) URL." },
    )
    .optional(),
);

const externalHttpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "External links must use http or https.");
const externalLinks = z.array(externalHttpUrl).max(12).optional();

const optionalLatitude = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : Number(value)),
  z.number().min(-90).max(90).optional(),
);
const optionalLongitude = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : Number(value)),
  z.number().min(-180).max(180).optional(),
);

export const createChurchSchema = z.strictObject({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,60}$/, "Use 3–60 lowercase letters, numbers, or hyphens."),
  name_en: z.string().trim().min(1).max(300),
  name_ar: optionalText(300),
  description_en: optionalText(10000),
  description_ar: optionalText(10000),
  city: optionalText(150),
  district: optionalText(150),
  latitude: optionalLatitude,
  longitude: optionalLongitude,
  dedication_date: optionalText(120),
  rite: optionalText(120),
  external_links: externalLinks,
});

export type CreateChurchInput = z.infer<typeof createChurchSchema>;

export const updateChurchSchema = z.strictObject({
  church_id: uuid,
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,60}$/),
  city: optionalText(150),
  district: optionalText(150),
  latitude: optionalLatitude,
  longitude: optionalLongitude,
  dedication_date: optionalText(120),
  rite: optionalText(120),
  external_links: externalLinks,
  cover_media_id: optionalUuid,
});

export type UpdateChurchInput = z.infer<typeof updateChurchSchema>;

export const churchTranslationSchema = z.strictObject({
  church_id: uuid,
  language_code: languageCode,
  name: z.string().trim().min(1).max(300),
  description: optionalText(10000),
});

export type ChurchTranslationInput = z.infer<typeof churchTranslationSchema>;

export const archiveChurchSchema = z.strictObject({
  church_id: uuid,
  notes: z.string().trim().min(1).max(4000),
});

export type ArchiveChurchInput = z.infer<typeof archiveChurchSchema>;

export const inviteUserSchema = z.strictObject({
  email: z.email().trim().max(320),
  display_name: z.string().trim().min(1).max(200),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const upsertLanguageSchema = z.strictObject({
  code: languageCode,
  name: z.string().trim().min(1).max(100),
  native_name: z.string().trim().min(1).max(100),
  direction: z.enum(["ltr", "rtl"]),
  is_active: z.boolean(),
});

export type UpsertLanguageInput = z.infer<typeof upsertLanguageSchema>;

export const setDefaultLanguageSchema = z.strictObject({ code: languageCode });

export type SetDefaultLanguageInput = z.infer<typeof setDefaultLanguageSchema>;

export const createObjectSchema = z.strictObject({
  church_id: uuid,
  object_type: z.enum(OBJECT_TYPES),
  default_language: languageCode,
  title: z.string().trim().min(1, "A title is required.").max(500),
  description: optionalText(20000),
  approximate_date: optionalText(200),
  location_in_church: optionalText(500),
  materials: optionalText(1000),
  dimensions: optionalText(500),
  condition_notes: optionalText(4000),
});

export type CreateObjectInput = z.infer<typeof createObjectSchema>;

export const updateObjectSchema = z.strictObject({
  object_type: z.enum(OBJECT_TYPES).optional(),
  approximate_date: optionalText(200),
  location_in_church: optionalText(500),
  materials: optionalText(1000),
  dimensions: optionalText(500),
  condition_notes: optionalText(4000),
});

export type UpdateObjectInput = z.infer<typeof updateObjectSchema>;

export const createObjectRelationSchema = z.strictObject({
  object_id: uuid,
  related_object_id: uuid,
  relationship_type: z.enum(OBJECT_RELATIONSHIP_TYPES),
  description: optionalText(1000),
  is_public: z.boolean().optional(),
});

export type CreateObjectRelationInput = z.infer<typeof createObjectRelationSchema>;

export const upsertTranslationSchema = z.strictObject({
  language_code: languageCode,
  title: z.string().trim().min(1, "A title is required.").max(500),
  description: optionalText(20000),
  is_complete: z.boolean().optional(),
});

export type UpsertTranslationInput = z.infer<typeof upsertTranslationSchema>;

export const createClaimSchema = z.strictObject({
  object_id: uuid,
  claim_text: z.string().trim().min(1, "Claim text is required.").max(5000),
  claimed_value: optionalText(1000),
  is_public: z.boolean().optional(),
});

export type CreateClaimInput = z.infer<typeof createClaimSchema>;

export const setClaimVerificationSchema = z.strictObject({
  claim_id: uuid,
  verification: z.enum(VERIFICATION_STATUSES),
  notes: optionalText(2000),
});

export type SetClaimVerificationInput = z.infer<typeof setClaimVerificationSchema>;

export const createSourceSchema = z.strictObject({
  title: z.string().trim().min(1, "A source title is required.").max(500),
  author: optionalText(300),
  year: optionalText(20),
  citation: optionalText(4000),
  url: optionalHttpUrl,
  source_type: z.enum(SOURCE_TYPES).optional(),
});

export type CreateSourceInput = z.infer<typeof createSourceSchema>;

export const linkSourceSchema = z.strictObject({
  object_id: uuid.optional(),
  claim_id: uuid.optional(),
  source_id: uuid,
  note: optionalText(1000),
});

export type LinkSourceInput = z.infer<typeof linkSourceSchema>;

export const upsertMediaTranslationSchema = z.strictObject({
  media_id: uuid,
  language_code: languageCode,
  caption: optionalText(1000),
  alt_text: optionalText(1000),
});

export type UpsertMediaTranslationInput = z.infer<typeof upsertMediaTranslationSchema>;

export const updateMediaDetailsSchema = z.strictObject({
  media_id: uuid,
  permission_status: z.enum(PERMISSION_STATUSES),
  copyright_holder: optionalText(300),
  attribution: optionalText(500),
});

export type UpdateMediaDetailsInput = z.infer<typeof updateMediaDetailsSchema>;

/**
 * Registers an already-stored media file (upload orchestration into Supabase Storage is a
 * documented Phase 6 gap; this validates the metadata write). `storage_path` must be a
 * server-generated object path, never a browser-supplied location: the pattern forbids
 * traversal and requires the `<church_id>/<object_id>/<uuid>.<ext>` convention.
 */
const storagePath = z
  .string()
  .trim()
  .max(1024)
  .regex(
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,10}$/i,
    "Storage path must follow <church_id>/<object_id>/<uuid>.<ext>.",
  );

export const createMediaSchema = z.strictObject({
  object_id: uuid,
  media_type: z.enum(MEDIA_TYPES),
  storage_path: storagePath,
  bucket: z.enum(["object-media", "incoming"]).optional(),
  mime_type: z.string().trim().min(1).max(255),
  size_bytes: z
    .number()
    .int()
    .nonnegative()
    .max(25 * 1024 * 1024),
  width: z.number().int().positive().max(50000).optional(),
  height: z.number().int().positive().max(50000).optional(),
  duration_seconds: z.number().nonnegative().max(86400).optional(),
  checksum: optionalText(200),
  copyright_holder: optionalText(300),
  attribution: optionalText(500),
  permission_status: z.enum(PERMISSION_STATUSES).optional(),
});

export type CreateMediaInput = z.infer<typeof createMediaSchema>;

export const setMediaPublicationSchema = z.strictObject({
  media_id: uuid,
  is_public: z.boolean(),
});

export type SetMediaPublicationInput = z.infer<typeof setMediaPublicationSchema>;

export const reorderMediaSchema = z.strictObject({
  object_id: uuid,
  media_ids: z.array(uuid).min(1).max(100),
});

export type ReorderMediaInput = z.infer<typeof reorderMediaSchema>;

export const recordDecisionSchema = z.enum(["approved", "rejected", "changes_requested"]);

export const reviewDecisionSchema = z.strictObject({
  object_id: uuid,
  decision: recordDecisionSchema,
  notes: optionalText(4000),
});

export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;

export const transitionSchema = z.strictObject({
  object_id: uuid,
  notes: optionalText(4000),
});

export type TransitionInput = z.infer<typeof transitionSchema>;

export const grantMembershipSchema = z.strictObject({
  user_id: uuid,
  church_id: uuid,
  role: z.enum(["editor", "historical_reviewer", "church_approver"]),
});

export type GrantMembershipInput = z.infer<typeof grantMembershipSchema>;

export const setPlatformAdminSchema = z.strictObject({
  user_id: uuid,
  value: z.boolean(),
});

export type SetPlatformAdminInput = z.infer<typeof setPlatformAdminSchema>;

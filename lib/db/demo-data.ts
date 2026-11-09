import type { PublishedObject } from "./objects";

/**
 * Local demo dataset used ONLY when Supabase is not configured, so the public pages can be browsed
 * during development without credentials. Every record below is fictional and mirrors the
 * fixtures in `supabase/seed.sql`; no real church, person, or source is represented.
 *
 * This module is never imported on a path where Supabase is configured — see
 * `app/[lang]/o/[publicId]/page.tsx`. It is intentionally small and hand-authored.
 */

interface DemoObject extends PublishedObject {
  /** Maps each QR alias to this object's canonical `publicId`. */
  aliases: string[];
}

function image(publicId: string, fileName: string): string {
  // A self-contained data URI preview so demo images render with no storage backend.
  return `/demo/${publicId}-${fileName}.svg`;
}

const DEMO_CHURCH_ID = "11111111-1111-1111-1111-111111111111";

export const DEMO_OBJECTS: DemoObject[] = [
  {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    publicId: "AB12CD34EF",
    aliases: ["ZZ99YY88XX"],
    objectType: "icon",
    approximateDate: "18th century",
    locationInChurch: "north wall, nave",
    defaultLanguage: "en",
    publishedAt: "2026-09-20T00:00:00.000Z",
    requestedLocale: "en",
    usedFallback: false,
    content: {
      title: "Demo Icon of the Theotokos",
      description:
        "A fictional icon used to exercise the public read paths. It depicts the Virgin and Child in a traditional posture and is described here only for demonstration.",
    },
    media: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        type: "image",
        storagePath: "demo/icon-theotokos.jpg",
        bucket: "object-media",
        url: image("AB12CD34EF", "icon"),
        mimeType: "image/svg+xml",
        width: 1200,
        height: 1600,
        durationSeconds: null,
        attribution: "Demo fixture image",
        captions: {
          en: { caption: "Demo icon", altText: "Fictional icon of the Theotokos." },
          ar: { caption: "أيقونة تجريبية", altText: "أيقونة وهمية للوالدة الإله." },
        },
      },
    ],
    claims: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        text: "The demo icon is dated to the 18th century.",
        value: "18th century",
        verification: "verified",
        sources: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            title: "Fictional Catalogue of Coptic Art",
            author: "A. Placeholder",
            year: "1999",
            citation: "Placeholder, Fictional Catalogue of Coptic Art (1999), p. 1.",
            url: null,
            sourceType: "book",
          },
        ],
      },
    ],
    sources: [],
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000006",
    publicId: "MN12PQ34RS",
    aliases: [],
    objectType: "wall_painting",
    approximateDate: "c. 14th century",
    locationInChurch: "south aisle",
    defaultLanguage: "ar",
    publishedAt: "2026-09-25T00:00:00.000Z",
    requestedLocale: "ar",
    usedFallback: false,
    content: {
      title: "لوحة جدارية تجريبية",
      description: "لوحة جدارية وهمية تُستخدم لعرض المسارات العامة. النص هنا لأغراض التوضيح فقط.",
    },
    media: [],
    claims: [
      {
        id: "33333333-3333-4333-8333-333333333334",
        text: "يُرجَّح أن اللوحة تعود إلى القرن الرابع عشر.",
        value: "14th century",
        verification: "uncertain",
        sources: [],
      },
    ],
    sources: [],
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000007",
    publicId: "WX56YZ78AB",
    aliases: [],
    objectType: "manuscript",
    approximateDate: "unknown",
    locationInChurch: null,
    defaultLanguage: "en",
    publishedAt: "2026-10-01T00:00:00.000Z",
    requestedLocale: "en",
    usedFallback: true,
    content: {
      title: "Demo Manuscript (English only)",
      description:
        "A fictional manuscript with only an English description, used to demonstrate the fallback notice when a translation is missing.",
    },
    media: [],
    claims: [],
    sources: [],
  },
];

const BY_PUBLIC_ID = new Map(DEMO_OBJECTS.map((object) => [object.publicId, object]));

const ALIAS_TO_PUBLIC_ID = new Map(
  DEMO_OBJECTS.flatMap((object) => object.aliases.map((alias) => [alias, object.publicId])),
);

export const DEMO_CHURCH = {
  id: DEMO_CHURCH_ID,
  slug: "demo-church",
  name: { en: "Demo Church", ar: "كنيسة تجريبية" },
};

/** Resolves a demo public id or alias to its canonical id, or `null` when unknown. */
export function resolveDemoPublicId(publicId: string): string | null {
  if (BY_PUBLIC_ID.has(publicId)) return publicId;
  return ALIAS_TO_PUBLIC_ID.get(publicId) ?? null;
}

/**
 * Returns a demo object localized for the requested locale, applying the same fallback rule as the
 * real DAL: requested language → object default language, with `usedFallback` set when the
 * requested translation is absent.
 */
export function getDemoObjectByPublicId(publicId: string, locale: string): PublishedObject | null {
  const canonical = resolveDemoPublicId(publicId);
  if (!canonical) return null;
  const object = BY_PUBLIC_ID.get(canonical);
  if (!object) return null;

  // Each demo object is authored in a single language, so a request in any other language falls
  // back to the object's default language and is flagged, matching the real DAL's behaviour.
  return {
    ...object,
    requestedLocale: locale,
    usedFallback: locale !== object.defaultLanguage,
  };
}

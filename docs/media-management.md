# Media Management

Implements the Phase 5 media pipeline for the public site: storage buckets, upload
validation, the publication gate, responsive image delivery, and audio narration.
Design references: [`architecture/security-and-permissions.md`](architecture/security-and-permissions.md)
§6, [`architecture/database-schema.md`](architecture/database-schema.md) (media),
[`architecture/api-contracts.md`](architecture/api-contracts.md) §7, and
[`architecture/requirements.md`](architecture/requirements.md) (FR-MD-*).

The upload UI and multipart server route were added in a follow-up implementation. Uploads remain in
the private `incoming` bucket while rights are pending; authorized publication copies the file to
`object-media`, and unpublishing removes the public copy and returns the file to private staging.

## 1. Storage buckets

| Bucket         | Visibility | Purpose                                        |
| -------------- | ---------- | ---------------------------------------------- |
| `object-media` | Public     | Promoted, published media served over the CDN. |
| `incoming`     | Private    | Staging area for signed editor uploads.        |

Both buckets are created by `supabase/migrations/20261019000009_storage_buckets.sql` with a
25 MiB limit and an allow-list of image/audio MIME types. The migration is idempotent and a
**no-op when the `storage` schema is absent** (the Docker-free PGlite test harness), so the
remaining schema still applies locally.

Path convention (non-guessable, per security doc §6):

```
<church_id>/<object_id>/<uuid>.<ext>
```

The `incoming` bucket is private: `storage.objects` policies only permit members who pass
`public.can_write_object_content(<object_id>)`. `object-media` is publicly readable, but writes are
restricted to those same members. A bucket being public means the **object URL** is readable; it
does not relax the `public.media` row-level publication gate.

## 2. Upload pipeline

The implemented upload flow is:

1. The authenticated CMS sends a multipart file and object ID to `POST /api/media/upload`.
2. The server checks draft edit access and validates the descriptor and magic bytes.
3. The server uploads to `incoming`, downloads the staged bytes, validates the signature again,
   calculates SHA-256, extracts image dimensions or audio duration from the staged bytes, and inserts
   a private `public.media` row.
4. Authorized publication validates rights and image alt text, copies the file to `object-media`,
   then updates the media row. Unpublishing removes the public object before returning metadata to
   the private bucket. New uploads never enter the public bucket before approval.

The object editor exposes permission status, copyright holder, attribution, and localized caption
and alt-text forms for each active language. Image publication requires rights approval and alt text
in the object's default language.

Deletion removes the Storage object before deleting its metadata row, so a public-bucket object is
not left addressable after an editor removes it. Upload requests also require a bounded
`Content-Length` before multipart parsing, then enforce the per-kind file size limit after parsing.

### Validation rules (`lib/media/mime.ts`)

| Rule            | Details                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| Allowed images  | `image/jpeg`, `image/png`, `image/webp`                                     |
| Allowed audio   | `audio/mpeg`, `audio/mp4`, `audio/x-m4a`, `audio/aac`                       |
| Size limits     | Images ≤ 15 MiB, audio ≤ 25 MiB (bucket limit is 25 MiB)                    |
| Extension check | The filename extension must agree with the declared MIME type               |
| Content check   | When bytes are supplied, the sniffed signature must match the declared type |
| Empty uploads   | Rejected                                                                    |

Rejection reasons: `empty`, `too_large`, `unsupported_type`, `extension_mismatch`,
`content_mismatch`. These map to the `VALIDATION` error code in
[`architecture/api-contracts.md`](architecture/api-contracts.md) §10.

## 3. Publication gate and alt text

`canPublishMedia()` mirrors the database constraint:

- `permission_status` must be `granted` or `public_domain` (the `media` table has a matching
  `CHECK`); and
- public **images** must have alt text (FR-MD-6). The check is applied at publication time; the
  rendered component still degrades gracefully if a translation is missing.

Attribution (`media.attribution`) and rights (`permission_status`) travel with the media row; the
public component displays attribution under the image. Only media that is `is_public` **and**
permitted, on a published object owned by an active church, is readable anonymously (Phase 3 RLS).

## 4. Responsive images

`lib/media/urls.ts` builds Supabase Storage transformation URLs
(`/storage/v1/render/image/public/...`) for a width ladder of **320, 640, 960, 1280, 1920** px at
quality 80. `HeritageImage` emits a plain `<img>` with `srcset`, `sizes`, intrinsic
`width`/`height` (when known), `loading="lazy"`, and `decoding="async"`. We intentionally do not use
`next/image`: the optimizer is redundant with Supabase transforms and would require remote-pattern
configuration for every deployment (ADR-022).

The source fallback is also a 960px server-transformed rendition, and
`buildImageThumbnailUrl()` creates the 320px square crops used by the public selectable image
gallery. These are generated on demand by Supabase Storage and are not persisted as duplicate
files. The URL builder is pure and unit-tested; verify image transformation support on the target
Supabase project before production.

## 5. Audio narration

`NarrationPlayer` (a small client component) renders an accessible `<audio controls>` with
`preload="metadata"`, a localized caption from `media_translations`, a download fallback, and
attribution. Duration is stored on `media.duration_seconds`; playback analytics (`audio_play`,
`audio_complete`) are deferred to the analytics phase.

## 6. Captions and fallback

`pickMediaCaption()` (`lib/db/localization.ts`) uses the same fallback order as object content:
requested language → object default language → any available language. When a fallback is used,
the resolved `language` and `isFallback` flag are available to the UI.

## 7. Tests and limitations

Covered by unit tests:

- `tests/unit/media/mime.test.ts` — signature sniffing, extension/size/type rejection, publication
  gate.
- `tests/unit/media/urls.test.ts` — render URL, query preservation, `srcset` ladder.
- `tests/unit/db/localization.test.ts` — caption fallback order.

Not exercised locally:

- **Supabase Storage itself.** There is no Docker/WSL on the development machine, so
  `supabase start`/`supabase test db` and real bucket/policy creation could not run. The migration
  is written defensively and is skipped by PGlite; it must be validated on a Docker-capable
  machine or a hosted project.
- **End-to-end upload + render.** Requires a live Supabase Storage service and valid membership.
- **Image dimension/audio duration extraction.** `lib/media/metadata.ts` extracts JPEG/PNG/WebP
  dimensions and MP3, AAC, and MP4/M4A durations from the verified staged bytes. Container/codec
  edge cases and malformed-file handling still need fixture coverage.
- **`next/image` optimization / Core Web Vitals budget.** Measured in Phase 8.

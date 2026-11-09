# Multilingual Content

Implements Phase 5's multilingual infrastructure: a centralized language registry, locale routing,
translation fallback, and RTL support. Design references:
[`architecture/architecture.md`](architecture/architecture.md) §2–3,
[`architecture/requirements.md`](architecture/requirements.md) (FR-ML-*), and
[`architecture/database-schema.md`](architecture/database-schema.md) (translations).

## 1. Language registry

`public.languages` is the active registry for language codes, names, native names, and text
direction. English/Arabic in `lib/i18n/languages.ts` are the offline fallback registry:

| Code | Name    | Native name | Direction |
| ---- | ------- | ----------- | --------- |
| `en` | English | English     | `ltr`     |
| `ar` | Arabic  | العربية     | `rtl`     |

Platform administrators manage registry rows at `/admin/languages`; codes use the database's BCP 47
format constraint. Active rows drive locale routing, negotiation, the language switch, translation
validation, analytics validation, and `<html lang dir>`. New locale shells and translated content
use English UI labels until a UI dictionary is supplied; Arabic has its own current dictionary.

`DEFAULT_LANGUAGE` is the offline fallback (`en`); live negotiation uses the database's active
default language. `LOCALE_COOKIE` is `NEXT_LOCALE`.

## 2. Routing and locale negotiation

Public URLs are locale-prefixed: `/{lang}/`, `/{lang}/o/{publicId}`. The QR URL
`/o/{publicId}` stays language-independent so a single printed code works for every visitor.

`proxy.ts` (Next.js 16's replacement for `middleware.ts`) runs on the Node.js runtime and:

1. passes through a path whose first segment is an active language (built-in codes avoid a registry
   lookup; newly configured codes are verified against `public.languages`);
2. otherwise negotiates a language and redirects to the prefixed path.

Negotiation order (`lib/i18n/negotiate.ts`):

1. the remembered `NEXT_LOCALE` cookie;
2. the highest-weighted supported `Accept-Language` tag (regional tags match by base language,
   e.g. `ar-EG` → `ar`);
3. the default language (`en`).

The redirect also sets `NEXT_LOCALE` for one year so a visitor's choice survives later bare QR
scans. The switcher additionally writes the cookie **client-side** on click (FR-ML-4), which also
covers direct visits to an already-prefixed URL.

### Route tree

```
app/
  [lang]/
    layout.tsx              # root <html lang dir>, static params for en/ar
    page.tsx                # landing
    not-found.tsx           # bilingual 404
    o/[publicId]/page.tsx   # public object page (Phase 4 surface)
proxy.ts                    # locale redirects
```

`app/[lang]/layout.tsx` is the root layout (it renders `<html>`). `generateStaticParams()` returns
active registry languages, so each shell is prerendered with the configured `lang` and `dir`. The object page is
dynamically streamed and wraps its data access in `<Suspense>` to satisfy the project's
`cacheComponents` configuration.

## 3. Translation fallback

Content is stored per language in `object_translations`, `media_translations`, and
`church_translations`. Reads never overwrite or merge translations; they select one row.

`pickTranslation()` (`lib/db/localization.ts`) resolves object content:

1. the requested language;
2. the object's `default_language`;
3. any available translation.

`pickMediaCaption()` applies the same order for media captions/alt text. In both cases `isFallback`
is `true` when the returned row is not in the requested language; the public page shows a localized
notice (`fallbackNotice`) instead of silently presenting content as translated. This matches FR-ML-5
and the requirement that translations never overwrite each other.

## 4. RTL support

Direction is derived from the active database registry. `<html dir>` is set once in the root
layout, so native text direction and Tailwind logical utilities apply to the whole document. The
`not-found` page renders both languages with an explicit `dir="rtl"`/`lang="ar"` block for the
Arabic copy. There is no direction-specific layout code to duplicate.

## 5. UI strings

Content is localized in the database; surrounding chrome and status messages live in
`lib/i18n/messages.ts` (`en`/`ar`) with `getMessages()` and a tiny `formatMessage()` for
placeholders such as `{language}`. Keys cover the fallback notice, verification labels, section
headings, and archived/not-found/unavailable states. This is deliberately minimal — a full UI
dictionary/i18n framework is not needed for two languages and is not a Phase 5 deliverable.

## 6. Translation completeness

`public.object_translation_status` reports per-object translation coverage. The admin
`/admin/translations` view filters to active registry languages, groups missing or incomplete
translations by object, and links editors to the object editor.

## 7. Tests and limitations

Covered by unit tests:

- `tests/unit/i18n/languages.test.ts` — registry, direction, normalization, locale paths.
- `tests/unit/i18n/negotiate.test.ts` — cookie preference, q-value ordering, regional matching,
  fallbacks.
- `tests/unit/db/localization.test.ts` — object and media fallback order.

Limitations:

- **Arabic copy should be reviewed by a native speaker.** The UI strings are functional
  translations; FR-ML/RTL acceptance requires a human linguistic review.
- **UI dictionaries** currently exist for English and Arabic only; additional language routes fall
  back to English interface labels until translated strings are added. Machine translation is not
  included.
- **Bare QR URLs issue a redirect** (`/o/{id}` → `/{lang}/o/{id}`) rather than rendering in place;
  this is intentional so the URL always reflects the active locale.
- **HTTP 410 for archived objects** is emitted by the Proxy resolver path; verify against the
  configured Supabase project before production use.

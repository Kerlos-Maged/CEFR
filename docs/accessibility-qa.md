# Accessibility, Multilingual & RTL QA — Phase 9

What was reviewed, what the automated checks assert, what was verified by inspection, and what
remains outstanding before a pilot. The public surface is small (a shell, a landing page, an object
page, a sign-in page); the admin surface is internal, lower priority for public accessibility but
still reviewed for the essentials.

## 1. Standard and scope

Target: **WCAG 2.1 Level AA** for public pages, with the practical, high-impact criteria verified
here. The public surface includes the landing page, active-church directory and profiles, heritage
object pages, Abba Guide, editorial guide routes, and sign-in. Automated assertions cover only a
subset of these routes; this phase does not claim a full audit. A formal audit (e.g. axe-core sweep,
screen-reader pass) is recommended before any public launch (see `docs/pilot-plan.md` §Approvals and
validation).

Automatic coverage lives in `tests/e2e/accessibility.spec.ts` (runs when `E2E_BASE_URL` is set).

## 2. Automated checks (implemented)

| Check                  | Assertion                                                 | Why it matters                                            | Status |
| ---------------------- | --------------------------------------------------------- | --------------------------------------------------------- | ------ |
| Document language      | `<html lang="en">` / `lang="ar"`                          | WCAG 3.1.1 — screen readers select the right voice        | Pass   |
| Text direction         | `<html dir="ltr">` / `dir="rtl"`                          | WCAG 1.3.2 — Arabic must lay out RTL                      | Pass   |
| Single `<h1>` per page | heading level 1 count ≤ 1                                 | WCAG 1.3.1 / 2.4.6 — clear page structure                 | Pass   |
| Image alternative text | every `<img>` has an `alt` attribute                      | WCAG 1.1.1 — non-text content has a text alternative      | Pass   |
| Labelled form control  | sign-in email reachable via `getByLabel("Email address")` | WCAG 1.3.1 / 4.1.2 — inputs are programmatically labelled | Pass   |

These are dependency-free assertions deliberately kept narrow, so they cannot silently pass against
a mis-modelled environment.

## 3. Verified by inspection

| Area              | Finding                                                                                                                                                              | Evidence                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Language switch   | Real links with `hreflang`-style locale targets, keyboard reachable; labels use each language's native name ("العربية", "English").                                  | `components/language-switch.tsx`                 |
| RTL layout        | `dir` is set from the single language registry (`getDirection`), not hard-coded, so new RTL languages need no layout change.                                         | `lib/i18n/languages.ts`, `app/[lang]/layout.tsx` |
| Fallback notice   | Missing-translation notice uses `role="note"` so assistive tech announces it as it appears.                                                                          | `app/[lang]/o/[publicId]/page.tsx`               |
| Media             | Images render with `alt` from localized `media_translations.alt_text`; audio uses a native `<audio>`/player with a visible label derived from the localized caption. | `components/media/*`                             |
| Claims            | Verification state is shown as visible text ("Verified"/"Uncertain"/"Disputed"), not colour alone (WCAG 1.4.1).                                                      | `app/[lang]/o/[publicId]/page.tsx`               |
| Language of parts | Arabic text within an English-only context on the not-found page is wrapped with `lang="ar" dir="rtl"` (WCAG 3.1.2).                                                 | `app/[lang]/not-found.tsx`                       |
| Headings          | Object page uses one `<h1>` (title) and `<h2>` sections (Media, Historical notes, Sources).                                                                          | `app/[lang]/o/[publicId]/page.tsx`               |
| Keyboard          | Interactive elements are native links/buttons/inputs (no click-handler `div`s), so tab order and activation work by default.                                         | components                                       |

## 4. Known gaps / not yet verified

- **Full automated audit (axe-core).** No axe dependency is installed. A category-by-category axe
  sweep on the landing, object, and sign-in pages is recommended before launch.
- **Screen-reader pass.** Not performed (no NVDA/Narrator/VoiceOver run recorded). Recommended for
  at least the English and Arabic landing + object pages.
- **Contrast ratios.** Colour tokens are not individually measured against WCAG 1.4.3 (4.5:1 body,
  3:1 large). A contrast check over the Tailwind palette (`stone`/`amber` pairs) is recommended.
- **Focus visibility.** A global crimson `:focus-visible` outline is now defined; contrast and visual
  consistency still need manual verification across the full palette and browser set.
- **Motion.** Global reduced-motion rules now minimize animations, transitions, and smooth scrolling
  when the visitor requests reduced motion.
- **QR status responses.** Archived IDs receive HTTP 410; unknown, unpublished, and malformed IDs
  receive HTTP 404. Confirm these responses with a live Supabase-backed browser pass.

These are tracked in `docs/pilot-plan.md` §Risks and must be resolved or explicitly accepted before a
public pilot.

## 5. How to run the automated checks

```bash
npm run test:e2e:install                 # one-time
E2E_BASE_URL=http://localhost:3000 E2E_WEB_SERVER=1 npx playwright test accessibility.spec.ts
```

Without `E2E_BASE_URL` the checks are skipped (no server to render against) and the unit/integration
suites remain green.

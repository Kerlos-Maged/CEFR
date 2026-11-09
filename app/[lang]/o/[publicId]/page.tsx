import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { VisitorAnalytics } from "@/components/analytics/visitor-analytics";
import { LanguageSwitch } from "@/components/language-switch";
import { ImageGallery } from "@/components/media/image-gallery";
import { NarrationPlayer } from "@/components/media/narration-player";
import { FeaturedImage } from "@/components/heritage/featured-image";
import {
  getFeaturedByPublicId,
  type FeaturedHeritageRecord,
} from "@/lib/content/featured-heritage";
import { isSupabaseConfigured } from "@/lib/db/client";
import { getDemoObjectByPublicId, resolveDemoPublicId } from "@/lib/db/demo-data";
import { pickMediaCaption, type ResolvedMediaCaption } from "@/lib/db/localization";
import {
  getCachedPublishedObjectByPublicId,
  resolvePublicId,
  type PublishedObject,
} from "@/lib/db/objects";
import { publicEnv } from "@/lib/env";
import { renderQrSvg } from "@/lib/qr";
import { formatMessage, getMessages, type Messages } from "@/lib/i18n/messages";
import { localizedPath } from "@/lib/i18n/paths";
import { getActiveLanguages } from "@/lib/i18n/registry";
import { isValidPublicId } from "@/lib/validation/public-id";

interface ObjectPageParams {
  lang: string;
  publicId: string;
}

interface ObjectPageProps {
  params: Promise<ObjectPageParams>;
}

export async function generateMetadata({ params }: ObjectPageProps): Promise<Metadata> {
  const { lang, publicId } = await params;
  const language = (await getActiveLanguages()).find((entry) => entry.code === lang);
  if (!language || !isValidPublicId(publicId)) {
    return { title: getMessages(lang).notFoundTitle, robots: { index: false, follow: false } };
  }

  const featured = getFeaturedByPublicId(publicId, lang);
  const object =
    featured?.object ??
    (isSupabaseConfigured()
      ? await getCachedPublishedObjectByPublicId(publicId, lang)
      : getDemoObjectByPublicId(publicId, lang));
  if (!object) {
    return { title: getMessages(lang).notFoundTitle, robots: { index: false, follow: false } };
  }

  const title = object.content?.title ?? object.publicId;
  const description = object.content?.description ?? getMessages(lang).noDescription;
  const url = localizedPath(lang, `/o/${object.publicId}`);
  const metadata: Metadata = {
    title: `${title} | ${getMessages(lang).siteName}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: getMessages(lang).siteName,
      type: "article",
      locale: language.code,
    },
    twitter: { card: "summary_large_image", title, description },
  };
  if (publicEnv.NEXT_PUBLIC_SITE_URL) {
    metadata.metadataBase = new URL(publicEnv.NEXT_PUBLIC_SITE_URL);
  }
  return metadata;
}

export default async function ObjectPage({ params }: ObjectPageProps) {
  const { lang, publicId } = await params;
  const messages = getMessages(lang);

  if (!(await getActiveLanguages()).some((entry) => entry.code === lang)) notFound();
  if (!isValidPublicId(publicId)) notFound();

  const featured = getFeaturedByPublicId(publicId, lang);
  if (featured) return <ObjectView object={featured.object} lang={lang} featured={featured} />;

  if (!isSupabaseConfigured()) {
    return <DemoObject publicId={publicId} lang={lang} />;
  }

  const resolution = await resolvePublicId(publicId);
  if (!resolution) notFound();
  if (resolution.kind === "gone") {
    return <Notice title={messages.archivedTitle} body={messages.archivedBody} />;
  }

  if (resolution.canonicalPublicId !== publicId) {
    redirect(localizedPath(lang, `/o/${resolution.canonicalPublicId}`));
  }

  const object = await getCachedPublishedObjectByPublicId(publicId, lang);
  if (!object) notFound();

  return <ObjectView object={object} lang={lang} />;
}

function verificationLabels(messages: Messages): Record<string, string> {
  return {
    verified: messages.verificationVerified,
    uncertain: messages.verificationUncertain,
    disputed: messages.verificationDisputed,
  };
}

async function ObjectView({
  object,
  lang,
  featured,
}: {
  object: PublishedObject;
  lang: string;
  featured?: FeaturedHeritageRecord;
}) {
  const messages = getMessages(lang);
  const title = object.content?.title ?? object.publicId;
  const description = object.content?.description ?? null;
  const images = object.media.filter((media) => media.type === "image");
  const audio = object.media.filter((media) => media.type === "audio");
  const verificationLabelsMap = verificationLabels(messages);

  const activeLanguages = await getActiveLanguages();
  const options = activeLanguages.map((available) => ({
    code: available.code,
    label: available.nativeName,
    href: localizedPath(available.code, `/o/${object.publicId}`),
  }));
  const qrSvg = await renderQrSvg(object.publicId);
  const qrDataUrl = qrSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}` : null;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-crimson text-2xl font-semibold sm:text-3xl">{title}</h1>
          <LanguageSwitch
            current={lang}
            label={messages.languageLabel}
            options={options}
            publicId={object.publicId}
          />
        </div>
        <p className="text-gold font-mono text-xs tracking-widest">{object.publicId}</p>
        <div className="archive-rule" aria-hidden="true" />

        {object.usedFallback && (
          <p
            role="note"
            className="border-gold-soft bg-gold-tint text-crimson-dark rounded border px-3 py-2 text-sm"
          >
            {formatMessage(messages.fallbackNotice, {
              language:
                (await getActiveLanguages()).find((entry) => entry.code === object.defaultLanguage)
                  ?.nativeName ?? object.defaultLanguage,
              requested:
                (await getActiveLanguages()).find((entry) => entry.code === lang)?.nativeName ??
                lang,
            })}
          </p>
        )}

        <dl className="text-ink-soft flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <MetadataItem
            label={lang === "ar" ? "النوع" : "Type"}
            value={objectTypeLabel(object.objectType, lang)}
          />
          {object.approximateDate ? (
            <MetadataItem
              label={lang === "ar" ? "التاريخ التقريبي" : "Approximate date"}
              value={object.approximateDate}
            />
          ) : null}
          {object.locationInChurch ? (
            <MetadataItem
              label={lang === "ar" ? "الموقع داخل الكنيسة" : "Location in church"}
              value={object.locationInChurch}
            />
          ) : null}
          {object.church ? (
            <div>
              <dt className="sr-only">{lang === "ar" ? "الكنيسة" : "Church"}</dt>
              <dd>
                <a
                  className="text-crimson underline"
                  href={localizedPath(lang, `/churches/${object.church.slug}`)}
                >
                  {object.church.name ?? object.church.slug}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </header>

      <VisitorAnalytics publicId={object.publicId} language={lang} />

      <p className="text-ink-soft text-lg leading-relaxed">
        {description ?? <span className="text-ink-muted">{messages.noDescription}</span>}
      </p>

      {featured ? (
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <FeaturedImage
            record={featured}
            locale={lang}
            className="rounded-2xl bg-[#132a3a] shadow-[var(--shadow-soft)]"
          />
          <div className="border-sand bg-card flex flex-col justify-center rounded-2xl border p-6 sm:p-8">
            <p className="text-crimson text-xs font-bold tracking-[0.18em] uppercase">
              {lang === "ar" ? "السياق التاريخي" : "Historical context"}
            </p>
            <h2 className="mt-2 font-serif text-2xl">
              {lang === "ar"
                ? "ما نعرفه، وما نميّزه كتقليد"
                : "What is known, and what is tradition"}
            </h2>
            <p className="text-ink-soft mt-4 leading-relaxed">
              {lang === "ar" ? featured.context.ar : featured.context.en}
            </p>
            <a
              className="text-crimson decoration-gold mt-5 w-fit text-sm font-semibold underline underline-offset-4"
              href={featured.image.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {lang === "ar" ? "تفاصيل ترخيص الصورة ومصدرها" : "Image source & licence details"}
            </a>
          </div>
        </section>
      ) : null}

      {featured ? (
        <section
          className="border-sand bg-card rounded-2xl border p-6 sm:p-8"
          aria-labelledby="object-timeline-heading"
        >
          <p className="text-crimson text-xs font-bold tracking-[0.18em] uppercase">
            {lang === "ar" ? "على خط الزمن" : "Through the centuries"}
          </p>
          <h2 id="object-timeline-heading" className="mt-2 font-serif text-3xl">
            {lang === "ar" ? "التسلسل التاريخي" : "Historical timeline"}
          </h2>
          <ol className="mt-7 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {featured.timeline.map((event, index) => (
              <li key={`${event.date}-${index}`} className="border-sand border-s-2 pb-7 ps-4">
                <div className="pe-4">
                  <p className="text-crimson text-xs font-semibold tracking-wide uppercase">
                    {event.date}
                  </p>
                  <h3 className="text-ink mt-1 font-semibold">
                    {lang === "ar" ? event.title.ar : event.title.en}
                  </h3>
                  <p className="text-ink-muted mt-1 text-sm leading-relaxed">
                    {lang === "ar" ? event.detail.ar : event.detail.en}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section
        className="grid gap-5 rounded-2xl bg-[#e2edf1] p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"
        aria-labelledby="qr-access-heading"
      >
        <div>
          <p className="text-crimson text-xs font-bold tracking-[0.18em] uppercase">
            {lang === "ar" ? "دخول دائم إلى هذه القطعة" : "Permanent object access"}
          </p>
          <h2 id="qr-access-heading" className="mt-2 font-serif text-2xl">
            {lang === "ar"
              ? "امسح رمز QR للعودة إلى هذا السجل"
              : "Scan this QR code to return to this record"}
          </h2>
          <p className="text-ink-muted mt-2 text-sm">
            {lang === "ar"
              ? "معرّف ثابت لا يتغير عند تحديث المعلومات."
              : "A stable identifier that stays with the object as its record is updated."}
          </p>
          <p className="text-ink mt-3 font-mono text-xs">
            {publicEnv.NEXT_PUBLIC_SITE_URL
              ? `${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/o/${object.publicId}`
              : `/o/${object.publicId}`}
          </p>
          {qrDataUrl ? (
            <a
              href={qrDataUrl}
              download={`qr-${object.publicId}.svg`}
              className="text-crimson decoration-gold mt-4 inline-flex text-sm font-semibold underline underline-offset-4"
            >
              {lang === "ar" ? "تنزيل الرمز بصيغة SVG" : "Download QR as SVG"}
            </a>
          ) : (
            <p className="text-ink-muted mt-3 text-xs">
              {lang === "ar"
                ? "تظهر صورة الرمز بعد إعداد عنوان الموقع العام."
                : "The QR image appears when the public site URL is configured."}
            </p>
          )}
        </div>
        {qrDataUrl ? (
          <Image
            src={qrDataUrl}
            width={176}
            height={176}
            unoptimized
            alt={lang === "ar" ? `رمز QR لصفحة ${title}` : `QR code for ${title}`}
            className="border-sand mx-auto rounded-lg border bg-white p-2 sm:mx-0"
          />
        ) : (
          <div className="loading-rule mx-auto sm:mx-0" aria-hidden="true" />
        )}
      </section>

      {images.length > 0 && (
        <section className="flex flex-col gap-6" aria-label={messages.mediaHeading}>
          <ImageGallery
            images={images}
            locale={lang}
            fallbackLanguage={object.defaultLanguage}
            label={messages.mediaHeading}
          />
        </section>
      )}

      {audio.length > 0 && (
        <section className="flex flex-col gap-6" aria-label={messages.mediaHeading}>
          {audio.map((media) => {
            if (!media.url) return null;
            const caption = pickMediaCaption(media.captions, lang, object.defaultLanguage);
            return (
              <NarrationPlayer
                key={media.id}
                src={media.url}
                mimeType={media.mimeType}
                label={narrationLabel(caption, title)}
                attribution={media.attribution}
                publicId={object.publicId}
                language={lang}
              />
            );
          })}
        </section>
      )}

      {object.claims.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-crimson text-lg font-semibold">{messages.claimsHeading}</h2>
          <ul className="flex flex-col gap-4">
            {object.claims.map((claim) => (
              <li
                key={claim.id}
                className="border-sand border-s-gold bg-card flex flex-col gap-1 rounded-lg border border-s-4 p-4 shadow-sm"
              >
                <span className="text-gold text-xs font-medium tracking-wide uppercase">
                  {verificationLabelsMap[claim.verification] ?? claim.verification}
                </span>
                <p className="text-ink">{claim.text}</p>
                {claim.sources.length > 0 && (
                  <p className="text-ink-muted text-sm">
                    {claim.sources.map((source, index) => (
                      <span key={source.id}>
                        {index > 0 ? ", " : null}
                        {source.url ? (
                          <a className="underline" href={source.url} rel="noopener noreferrer">
                            {source.title}
                          </a>
                        ) : (
                          source.title
                        )}
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {object.relatedObjects && object.relatedObjects.length > 0 ? (
        <section
          className="border-sand bg-card rounded-2xl border p-6 sm:p-8"
          aria-labelledby="related-records-heading"
        >
          <p className="text-crimson text-xs font-bold tracking-[0.18em] uppercase">
            {lang === "ar" ? "سجلات متصلة" : "Connected records"}
          </p>
          <h2 id="related-records-heading" className="mt-2 font-serif text-2xl">
            {lang === "ar" ? "انظر أيضاً" : "Follow the connections"}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {object.relatedObjects.map((related) => (
              <li key={related.id}>
                <a
                  href={localizedPath(lang, `/o/${related.publicId}`)}
                  className="border-sand hover:border-gold block h-full rounded-xl border p-4 transition-colors"
                >
                  <span className="text-crimson text-xs font-semibold tracking-wide uppercase">
                    {relationshipLabel(related.relationshipType, lang)}
                  </span>
                  <span className="text-ink mt-1 block font-semibold">
                    {related.title ?? related.publicId}
                  </span>
                  <span className="text-ink-muted mt-1 block text-xs">
                    {[
                      objectTypeLabel(related.objectType, lang),
                      related.approximateDate,
                      related.publicId,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {related.description ? (
                    <span className="text-ink-soft mt-2 block text-sm">{related.description}</span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {object.sources.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-crimson text-lg font-semibold">{messages.sourcesHeading}</h2>
          <ul className="text-ink-soft flex flex-col gap-2 text-sm">
            {object.sources.map((source) => (
              <li key={source.id}>
                {source.url ? (
                  <a className="underline" href={source.url} rel="noopener noreferrer">
                    {source.title}
                  </a>
                ) : (
                  source.title
                )}
                {source.author ? ` — ${source.author}` : null}
                {source.year ? ` (${source.year})` : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function narrationLabel(caption: ResolvedMediaCaption, fallback: string): string {
  return caption.caption ?? fallback;
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt className="font-medium">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

function objectTypeLabel(objectType: string, lang: string): string {
  const labels: Record<string, { en: string; ar: string }> = {
    icon: { en: "Icon", ar: "أيقونة" },
    wall_painting: { en: "Wall painting", ar: "رسم جداري" },
    fresco: { en: "Fresco", ar: "فريسكو" },
    architectural_feature: { en: "Architectural feature", ar: "عنصر معماري" },
    wood_carving: { en: "Wood carving", ar: "نقش خشبي" },
    iconostasis: { en: "Iconostasis", ar: "حامل الأيقونات" },
    inscription: { en: "Inscription", ar: "نقش كتابي" },
    manuscript: { en: "Manuscript", ar: "مخطوط" },
    liturgical_object: { en: "Liturgical object", ar: "أداة طقسية" },
    other: { en: "Other", ar: "أخرى" },
  };
  return labels[objectType]?.[lang === "ar" ? "ar" : "en"] ?? objectType.replaceAll("_", " ");
}

function relationshipLabel(type: string, lang: string): string {
  const labels: Record<string, { en: string; ar: string }> = {
    same_subject: { en: "Same depicted subject", ar: "الموضوع المصوّر نفسه" },
    same_artist: { en: "Same attributed artist", ar: "الفنان المنسوب إليه العمل نفسه" },
    same_workshop: { en: "Same workshop", ar: "الورشة الفنية نفسها" },
    part_of_set: { en: "Part of the same set", ar: "جزء من المجموعة نفسها" },
    same_location: { en: "Same church location", ar: "الموضع نفسه في الكنيسة" },
    historical_context: { en: "Shared historical context", ar: "السياق التاريخي المشترك" },
    inspired_by: { en: "Related model or influence", ar: "نموذج أو تأثير مرتبط" },
    related: { en: "Related record", ar: "سجل مرتبط" },
  };
  return labels[type]?.[lang === "ar" ? "ar" : "en"] ?? type.replaceAll("_", " ");
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-sand border-s-crimson bg-card rounded-lg border border-s-4 p-6 shadow-sm">
      <h1 className="text-crimson text-xl font-semibold">{title}</h1>
      <p className="text-ink-soft mt-2">{body}</p>
    </div>
  );
}

/**
 * Renders local demo content when Supabase is not configured, so the public pages can be browsed
 * in development without credentials. Unknown ids show the standard not-found notice, and archived
 * ids are treated as gone. See `lib/db/demo-data.ts`.
 */
function DemoObject({ publicId, lang }: { publicId: string; lang: string }) {
  const canonical = resolveDemoPublicId(publicId);
  if (!canonical) notFound();
  if (canonical !== publicId) redirect(localizedPath(lang, `/o/${canonical}`));

  const object = getDemoObjectByPublicId(publicId, lang);
  if (!object) notFound();
  return <ObjectView object={object} lang={lang} />;
}

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { DEMO_CHURCH, DEMO_OBJECTS } from "@/lib/db/demo-data";
import {
  FEATURED_HERITAGE,
  getFeaturedByPublicId,
  getFeaturedBySlug,
} from "@/lib/content/featured-heritage";
import { isSupabaseConfigured } from "@/lib/db/client";
import { getCachedChurchBySlug } from "@/lib/db/churches";
import { isActiveLanguage } from "@/lib/i18n/registry";
import { localizedPath } from "@/lib/i18n/paths";
import { FeaturedImage } from "@/components/heritage/featured-image";
import { ChurchQr } from "@/components/heritage/church-qr";

interface ChurchPageProps {
  params: Promise<{ lang: string; slug: string }>;
}

export async function generateMetadata({ params }: ChurchPageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!(await isActiveLanguage(lang)))
    return { title: "Church not found", robots: { index: false } };

  if (!isSupabaseConfigured()) {
    const featured = getFeaturedBySlug(slug);
    if (featured) {
      const name = lang === "ar" ? featured.church.name.ar : featured.church.name.en;
      return { title: `${name} | Coptic Heritage Digital Platform`, description: name };
    }
    if (slug !== DEMO_CHURCH.slug) return { title: "Church not found", robots: { index: false } };
    const name = lang === "ar" ? DEMO_CHURCH.name.ar : DEMO_CHURCH.name.en;
    return { title: `${name} | Coptic Heritage Digital Platform`, description: name };
  }

  const page = await getCachedChurchBySlug(slug, lang);
  if (!page) {
    const featured = getFeaturedBySlug(slug);
    if (!featured) return { title: "Church not found", robots: { index: false } };
    const name = lang === "ar" ? featured.church.name.ar : featured.church.name.en;
    return { title: `${name} | Coptic Heritage Digital Platform`, description: name };
  }
  const name = page.church.content?.title ?? page.church.slug;
  const description = page.church.content?.description ?? name;
  const canonical = localizedPath(lang, `/churches/${page.church.slug}`);
  return {
    title: `${name} | Coptic Heritage Digital Platform`,
    description,
    alternates: { canonical },
    openGraph: { title: name, description, url: canonical, type: "website" },
  };
}

export default async function PublicChurchPage({ params }: ChurchPageProps) {
  const { lang, slug } = await params;
  if (!(await isActiveLanguage(lang))) notFound();
  const isArabic = lang === "ar";

  if (!isSupabaseConfigured()) {
    const featured = getFeaturedBySlug(slug);
    if (featured) return <FeaturedChurchView record={featured} lang={lang} />;
    if (slug !== DEMO_CHURCH.slug) notFound();
    return (
      <ChurchView
        lang={lang}
        slug={DEMO_CHURCH.slug}
        name={isArabic ? DEMO_CHURCH.name.ar : DEMO_CHURCH.name.en}
        description={isArabic ? "بيانات وهمية للعرض فقط." : "Fictional demonstration content only."}
        city={isArabic ? "مصر" : "Egypt"}
        objects={DEMO_OBJECTS.map((object) => ({
          publicId: object.publicId,
          title: object.content?.title ?? object.publicId,
          objectType: object.objectType,
          approximateDate: object.approximateDate,
        }))}
      />
    );
  }

  const page = await getCachedChurchBySlug(slug, lang);
  if (!page) {
    const featured = getFeaturedBySlug(slug);
    if (featured) return <FeaturedChurchView record={featured} lang={lang} />;
    notFound();
  }
  const { church } = page;
  return (
    <ChurchView
      lang={lang}
      slug={church.slug}
      name={church.content?.title ?? church.slug}
      description={church.content?.description ?? null}
      city={
        [church.city, church.district].filter(Boolean).join(" · ") || (isArabic ? "مصر" : "Egypt")
      }
      externalLinks={church.externalLinks}
      coverImageUrl={church.coverImageUrl}
      objects={page.objects.map((object) => ({
        publicId: object.publicId,
        title: object.content?.title ?? object.publicId,
        objectType: object.objectType,
        approximateDate: object.approximateDate,
      }))}
      fallback={church.usedFallback}
    />
  );
}

function FeaturedChurchView({
  record,
  lang,
}: {
  record: NonNullable<ReturnType<typeof getFeaturedBySlug>>;
  lang: string;
}) {
  const isArabic = lang === "ar";
  const localized = getFeaturedByPublicId(record.object.publicId, lang) ?? record;
  const relatedRecords = FEATURED_HERITAGE.filter((entry) => entry.slug === record.slug).map(
    (entry) => getFeaturedByPublicId(entry.object.publicId, lang) ?? entry,
  );
  return (
    <article className="flex flex-col gap-8">
      <header className="grid gap-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <p className="text-ink-muted text-sm">
            <Link className="text-crimson underline" href={localizedPath(lang, "/churches")}>
              {isArabic ? "الكنائس" : "Church directory"}
            </Link>{" "}
            <span aria-hidden="true">/</span> {record.church.city} · {record.church.district}
          </p>
          <p className="text-crimson mt-8 text-xs font-bold tracking-[0.2em] uppercase">
            {isArabic ? "صفحة مرجعية موثقة" : "Sourced heritage profile"}
          </p>
          <h1 className="mt-2 max-w-3xl font-serif text-4xl leading-tight font-medium sm:text-5xl">
            {isArabic ? record.church.name.ar : record.church.name.en}
          </h1>
          <p className="text-ink-soft mt-5 max-w-2xl text-lg leading-relaxed">
            {localized.object.content?.description}
          </p>
        </div>
        <FeaturedImage
          record={record}
          locale={lang}
          className="rounded-2xl bg-[#132a3a] shadow-[var(--shadow-soft)]"
        />
      </header>

      <section className="grid gap-5 md:grid-cols-[1fr_0.8fr]">
        <div className="border-sand bg-card rounded-2xl border p-6 sm:p-8">
          <p className="text-crimson text-xs font-bold tracking-[0.18em] uppercase">
            {isArabic ? "السياق" : "Historical context"}
          </p>
          <h2 className="mt-2 font-serif text-2xl">
            {isArabic ? "المكان داخل الذاكرة الأوسع" : "A place within a larger story"}
          </h2>
          <p className="text-ink-soft mt-4 leading-relaxed">
            {isArabic ? record.context.ar : record.context.en}
          </p>
          <p className="text-ink-muted mt-5 text-xs">
            {isArabic
              ? "هذه صفحة مرجعية وليست إعلاناً عن شراكة أو اعتماد من الكنيسة."
              : "This reference profile does not imply church partnership or approval."}
          </p>
        </div>
        <div className="rounded-2xl bg-[#e2edf1] p-6 sm:p-8">
          <p className="text-crimson text-xs font-bold tracking-[0.18em] uppercase">
            {isArabic ? "سجلات مرتبطة بالمكان" : "Records connected to this church"}
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {relatedRecords.map((related) => (
              <li key={related.object.publicId}>
                <Link
                  href={localizedPath(lang, `/o/${related.object.publicId}`)}
                  className="hover:border-crimson block rounded-xl border border-[#acc3cb] bg-white/75 p-4 transition"
                >
                  <span className="font-semibold">{related.object.content?.title}</span>
                  <span className="text-ink-muted mt-1 block text-sm">
                    {related.object.approximateDate}
                  </span>
                  <span className="text-crimson mt-2 block text-xs font-semibold">
                    {isArabic ? "افتح السجل والمصادر" : "Open record and sources"} ·{" "}
                    {related.object.publicId}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ChurchQr
        slug={record.slug}
        lang={lang}
        name={isArabic ? record.church.name.ar : record.church.name.en}
      />

      <section className="border-sand bg-card rounded-2xl border p-6 sm:p-8">
        <h2 className="font-serif text-2xl">
          {isArabic ? "مصادر السجل" : "Sources for this profile"}
        </h2>
        <ul className="text-ink-soft mt-4 flex flex-col gap-3 text-sm">
          {record.object.sources.map((source) => (
            <li key={source.id}>
              <a
                className="text-crimson underline underline-offset-4"
                href={source.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.title}
              </a>{" "}
              —{" "}
              {isArabic
                ? "وزارة السياحة والآثار المصرية"
                : "Egyptian Ministry of Tourism and Antiquities"}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function ChurchView({
  lang,
  slug,
  name,
  description,
  city,
  objects,
  externalLinks = [],
  coverImageUrl = null,
  fallback = false,
}: {
  lang: string;
  slug: string;
  name: string;
  description: string | null;
  city: string;
  objects: {
    publicId: string;
    title: string;
    objectType: string;
    approximateDate: string | null;
  }[];
  externalLinks?: string[];
  coverImageUrl?: string | null;
  fallback?: boolean;
}) {
  const isArabic = lang === "ar";
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="text-ink-muted text-sm">
          <Link className="text-crimson underline" href={localizedPath(lang, "/churches")}>
            {isArabic ? "الكنائس" : "Churches"}
          </Link>
          <span aria-hidden="true"> / </span>
          {city}
        </p>
        <h1 className="text-crimson text-3xl font-semibold">{name}</h1>
        <p className="text-ink-muted">{city}</p>
        {coverImageUrl ? (
          <figure className="bg-parchment-deep relative mt-3 aspect-[16/7] w-full overflow-hidden rounded-2xl">
            <Image
              src={coverImageUrl}
              alt={name}
              fill
              sizes="(max-width: 768px) 100vw, 1200px"
              unoptimized
              className="heritage-photo"
            />
          </figure>
        ) : null}
        {fallback ? (
          <p
            role="note"
            className="border-gold-soft bg-gold-tint text-crimson-dark rounded border px-3 py-2 text-sm"
          >
            {isArabic
              ? "الترجمة المطلوبة غير متاحة؛ يُعرض الاسم بلغة أخرى."
              : "The requested translation is unavailable; the name is shown in another language."}
          </p>
        ) : null}
        {description ? (
          <p className="text-ink-soft text-lg leading-relaxed">{description}</p>
        ) : null}
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-crimson text-xl font-semibold">
          {isArabic ? "العناصر المنشورة" : "Published heritage objects"} ({objects.length})
        </h2>
        {objects.length === 0 ? (
          <p className="text-ink-muted text-sm">
            {isArabic
              ? "لا توجد سجلات منشورة لهذه الكنيسة بعد."
              : "No heritage records are published for this church yet."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {objects.map((object) => (
              <li key={object.publicId}>
                <Link
                  className="border-sand bg-card hover:border-gold flex flex-col gap-1 rounded-lg border p-4 transition-colors"
                  href={localizedPath(lang, `/o/${object.publicId}`)}
                >
                  <span className="text-crimson font-semibold">{object.title}</span>
                  <span className="text-ink-muted text-sm">
                    {[object.objectType.replaceAll("_", " "), object.approximateDate]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ChurchQr slug={slug} lang={lang} name={name} />

      {externalLinks.length > 0 ? (
        <section className="border-sand bg-card rounded-xl border p-5">
          <h2 className="text-crimson font-semibold">
            {isArabic ? "مراجع وروابط خارجية" : "External references"}
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {externalLinks.map((url) => (
              <li key={url}>
                <a
                  className="text-crimson underline underline-offset-4"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {new URL(url).hostname}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

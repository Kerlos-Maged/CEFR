import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/db/client";
import { FEATURED_HERITAGE } from "@/lib/content/featured-heritage";
import { listActiveChurches } from "@/lib/db/churches";
import { isActiveLanguage } from "@/lib/i18n/registry";
import { localizedPath } from "@/lib/i18n/paths";
import { FeaturedCard } from "@/components/heritage/featured-image";

export const metadata: Metadata = {
  title: "Churches | Coptic Heritage Digital Platform",
  description:
    "Browse participating Coptic Orthodox churches and their published heritage records.",
};

interface DirectoryPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function ChurchesDirectoryPage({ params, searchParams }: DirectoryPageProps) {
  const [{ lang }, query] = await Promise.all([params, searchParams]);
  if (!(await isActiveLanguage(lang))) notFound();

  if (!isSupabaseConfigured()) {
    const search = (query.q ?? "").trim().slice(0, 60).toLowerCase();
    const featured = FEATURED_HERITAGE.filter(
      (record) =>
        record.kind === "church" &&
        (!search ||
          `${record.church.name.en} ${record.church.name.ar} ${record.church.city} ${record.church.district}`
            .toLowerCase()
            .includes(search)),
    );
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-crimson text-2xl font-semibold">
          {lang === "ar" ? "الكنائس" : "Churches"}
        </h1>
        <p className="text-ink-soft max-w-2xl text-sm leading-relaxed">
          {lang === "ar"
            ? "دليل للمواقع والكنائس القبطية ذات الأهمية التاريخية، مع روابط إلى سجلات تراثية مصحوبة بمصادرها. الصفحات المرجعية لا تعني وجود شراكة مع الكنيسة."
            : "Explore historic Coptic sites and churches through sourced heritage records. Reference profiles do not imply a church partnership."}
        </p>
        <DirectorySearch lang={lang} value={query.q ?? ""} />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featured.map((record) => (
            <FeaturedCard key={record.slug} record={record} locale={lang} />
          ))}
        </div>
        {featured.length === 0 ? (
          <p className="border-sand bg-card rounded-xl border p-5 text-sm">
            {lang === "ar" ? "لا توجد نتائج مطابقة." : "No matching churches found."}
          </p>
        ) : null}
        <Link className="text-crimson underline" href={localizedPath(lang, "/")}>
          {lang === "ar" ? "العودة إلى الرئيسية" : "Return to the home page"}
        </Link>
      </section>
    );
  }

  const parsedPage = Number(query.page ?? "1");
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const search = (query.q ?? "").trim().slice(0, 60);
  const directory = await listActiveChurches(lang, page, 24, search);
  const pageCount = Math.max(1, Math.ceil(directory.total / directory.pageSize));
  const isArabic = lang === "ar";
  const normalizedSearch = search.toLocaleLowerCase();
  const referenceSites = FEATURED_HERITAGE.filter(
    ({ church, slug, kind }) =>
      kind === "church" &&
      (!normalizedSearch ||
        `${church.name.en} ${church.name.ar} ${church.city} ${church.district} ${slug}`
          .toLocaleLowerCase()
          .includes(normalizedSearch)),
  );

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-crimson text-2xl font-semibold">
          {isArabic ? "الكنائس المشاركة" : "Participating churches"}
        </h1>
        <p className="text-ink-soft text-sm">
          {isArabic
            ? "تصفح الكنائس التي لديها سجلات تراثية منشورة."
            : "Browse churches with published heritage records."}
        </p>
      </header>

      <DirectorySearch lang={lang} value={search} />

      <section className="flex flex-col gap-4" aria-labelledby="historic-sites-heading">
        <div>
          <p className="text-crimson text-xs font-bold tracking-[0.18em] uppercase">
            {isArabic ? "مسارات تاريخية موثقة" : "Curated historical references"}
          </p>
          <h2 id="historic-sites-heading" className="mt-1 font-serif text-2xl">
            {isArabic ? "مواقع من ذاكرة مصر" : "Historic sites across Egypt"}
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {referenceSites.map((record) => (
            <FeaturedCard key={record.slug} record={record} locale={lang} />
          ))}
        </div>
        {referenceSites.length === 0 ? (
          <p className="border-sand bg-card rounded-xl border p-5 text-sm">
            {isArabic ? "لا توجد نتائج تاريخية مطابقة." : "No matching historic references."}
          </p>
        ) : null}
      </section>

      {directory.items.length === 0 ? (
        <p className="border-sand bg-card rounded-lg border p-6 text-sm">
          {isArabic ? "لا توجد كنائس منشورة حالياً." : "There are no published churches yet."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {directory.items.map((church) => (
            <li key={church.id}>
              <Link
                className="border-sand bg-card hover:border-gold flex h-full flex-col gap-2 rounded-lg border p-4 transition-colors"
                href={localizedPath(lang, `/churches/${church.slug}`)}
              >
                <span className="text-crimson font-semibold">
                  {church.content?.title ?? church.slug}
                </span>
                <span className="text-ink-muted text-sm">
                  {[church.city, church.district].filter(Boolean).join(" · ") ||
                    (isArabic ? "مصر" : "Egypt")}
                </span>
                {church.usedFallback ? (
                  <span className="text-gold text-xs">
                    {isArabic ? "الاسم بلغة أخرى" : "Name shown in another language"}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav
          className="flex items-center justify-between"
          aria-label={isArabic ? "صفحات الدليل" : "Directory pages"}
        >
          {page > 1 ? (
            <Link
              className="text-crimson underline"
              href={`${localizedPath(lang, "/churches")}?page=${page - 1}`}
            >
              {isArabic ? "السابق" : "Previous"}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-muted text-sm">
            {page} / {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              className="text-crimson underline"
              href={`${localizedPath(lang, "/churches")}?page=${page + 1}`}
            >
              {isArabic ? "التالي" : "Next"}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}

function DirectorySearch({ lang, value }: { lang: string; value: string }) {
  const isArabic = lang === "ar";
  return (
    <form
      action={localizedPath(lang, "/churches")}
      method="get"
      className="border-sand bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-end"
    >
      <label htmlFor="church-search" className="text-ink-soft flex-1 text-sm font-medium">
        {isArabic ? "ابحث بالاسم أو المدينة" : "Search by church or city"}
        <input
          id="church-search"
          name="q"
          type="search"
          defaultValue={value}
          placeholder={isArabic ? "مثال: مصر القديمة" : "e.g. Old Cairo"}
          className="border-sand-deep bg-parchment mt-1 block min-h-11 w-full rounded-lg border px-3 text-base font-normal outline-offset-2"
        />
      </label>
      <button
        type="submit"
        className="bg-crimson hover:bg-crimson-dark min-h-11 rounded-lg px-5 font-semibold text-white transition-colors"
      >
        {isArabic ? "بحث" : "Search"}
      </button>
    </form>
  );
}

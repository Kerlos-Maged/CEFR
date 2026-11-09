import Link from "next/link";
import { notFound } from "next/navigation";

import { FeaturedCard, FeaturedImage } from "@/components/heritage/featured-image";
import { FEATURED_HERITAGE } from "@/lib/content/featured-heritage";
import { localizedPath } from "@/lib/i18n/paths";
import { getActiveLanguages } from "@/lib/i18n/registry";

interface HomePageProps {
  params: Promise<{ lang: string }>;
}

const PATHS = [
  { href: "/churches", en: "Churches", ar: "الكنائس", number: "01" },
  { href: "/collections", en: "Collections", ar: "المجموعات", number: "02" },
  { href: "/timeline", en: "Timeline", ar: "الخط الزمني", number: "03" },
  { href: "/research", en: "Research guide", ar: "دليل البحث", number: "04" },
];

export default async function HomePage({ params }: HomePageProps) {
  const { lang } = await params;
  const available = await getActiveLanguages();
  if (!available.some((entry) => entry.code === lang)) notFound();
  const ar = lang === "ar";
  const lead = FEATURED_HERITAGE[0];

  return (
    <div className="flex flex-col gap-14 sm:gap-20">
      <section className="grid items-center gap-8 lg:grid-cols-[1fr_0.95fr] lg:gap-14">
        <div className="py-3">
          <p className="text-crimson mb-5 flex items-center gap-3 text-xs font-bold tracking-[0.2em] uppercase">
            <span className="archive-rule inline-block w-10" />
            {ar ? "أرشيف التراث القبطي" : "The Coptic heritage archive"}
          </p>
          <h1 className="max-w-3xl font-serif text-5xl leading-[1.06] font-medium sm:text-6xl xl:text-7xl">
            {ar ? "اكتشف حكايات المكان والذاكرة" : "Discover the stories held in place"}
          </h1>
          <p className="text-ink-soft mt-6 max-w-2xl text-lg leading-relaxed">
            {ar
              ? "مسارات جديدة لاكتشاف كنائس مصر القبطية وأيقوناتها وعمارتها وتاريخها، مع مصادر واضحة وسجلات يمكن الوصول إليها عبر QR."
              : "New paths into Egypt’s Coptic churches, icons, architecture, and history, with visible sources and records reached through QR."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={localizedPath(lang, "/explore")}
              className="bg-crimson hover:bg-crimson-dark rounded-full px-6 py-3 text-sm font-semibold text-white transition"
            >
              {ar ? "ابدأ الاستكشاف" : "Start exploring"}
            </Link>
            <Link
              href={localizedPath(lang, "/churches")}
              className="border-sand-deep text-ink hover:border-crimson rounded-full border px-6 py-3 text-sm font-semibold transition"
            >
              {ar ? "افتح دليل الكنائس" : "Browse churches"}
            </Link>
            <Link
              href={localizedPath(lang, "/guide")}
              className="text-crimson self-center text-sm font-semibold underline underline-offset-4"
            >
              {ar ? "جرّب أبا جايد" : "Try Abba Guide"}
            </Link>
          </div>
          <div className="text-ink-muted mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <span>{ar ? "عربي وإنجليزي" : "Arabic & English"}</span>
            <span aria-hidden="true">·</span>
            <span>{ar ? "سجلات تاريخية موثقة" : "Sourced heritage records"}</span>
            <span aria-hidden="true">·</span>
            <span>{ar ? "روابط QR دائمة" : "Permanent QR links"}</span>
          </div>
        </div>
        <div className="relative rounded-[1.5rem] bg-[#132a3a] p-3 shadow-[var(--shadow-soft)] sm:p-4">
          <FeaturedImage record={lead} locale={lang} className="rounded-xl bg-[#132a3a]" />
          <div className="flex items-end justify-between gap-4 px-2 pt-4 pb-2 text-white sm:px-3">
            <div>
              <p className="text-[0.65rem] font-bold tracking-[0.18em] text-[#f2b8a8] uppercase">
                {ar ? "من صفحاتنا المرجعية" : "From the archive"}
              </p>
              <h2 className="mt-1 font-serif text-xl sm:text-2xl">
                {ar ? lead.church.name.ar : lead.church.name.en}
              </h2>
            </div>
            <Link
              href={localizedPath(lang, `/churches/${lead.slug}`)}
              className="shrink-0 rounded-full border border-white/40 px-4 py-2 text-xs font-semibold hover:bg-white/10"
            >
              {ar ? "اقرأ" : "Read profile"}
            </Link>
          </div>
        </div>
      </section>

      <section
        aria-label={ar ? "طرق الاستكشاف" : "Explore the archive"}
        className="border-sand border-y py-6"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PATHS.map((item) => (
            <Link
              key={item.href}
              href={localizedPath(lang, item.href)}
              className="group hover:bg-gold-tint/50 flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition"
            >
              <span className="flex items-center gap-3">
                <span className="text-gold font-serif text-lg">{item.number}</span>
                <span className="text-ink font-semibold">{ar ? item.ar : item.en}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-crimson text-xs font-bold tracking-[0.18em] uppercase">
              {ar ? "مختارات موثقة" : "Sourced profiles"}
            </p>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl">
              {ar ? "أماكن تحمل طبقات من التاريخ" : "Places with layered histories"}
            </h2>
          </div>
          <Link
            href={localizedPath(lang, "/stories")}
            className="text-crimson text-sm font-semibold underline underline-offset-4"
          >
            {ar ? "كل القصص" : "All stories"}
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {FEATURED_HERITAGE.map((record) => (
            <FeaturedCard key={record.object.publicId} record={record} locale={lang} />
          ))}
        </div>
        <p className="text-ink-muted text-xs leading-relaxed">
          {ar
            ? "هذه صفحات مرجعية موثقة ولا تعني وجود شراكة أو اعتماد من الكنائس المذكورة. تُعرض التقاليد الدينية منفصلة عن التأريخ الأثري."
            : "These sourced reference profiles do not imply partnership or endorsement by the listed churches. Religious traditions are distinguished from archaeological dating."}
        </p>
      </section>

      <section className="grid gap-7 rounded-2xl bg-[#e2edf1] p-6 sm:p-9 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <p className="text-crimson text-xs font-bold tracking-[0.18em] uppercase">
            {ar ? "دليل قابل للتتبع" : "A traceable guide"}
          </p>
          <h2 className="mt-2 font-serif text-3xl">
            {ar ? "من رمز QR إلى قصة مدعومة بالمصادر" : "From a QR code to a sourced story"}
          </h2>
          <p className="text-ink-soft mt-3 leading-relaxed">
            {ar
              ? "تصل إلى سجل القطعة مباشرة، ثم تتبع صورها ومعلوماتها التاريخية ومصادرها والعناصر المرتبطة بها."
              : "Open an object record directly, then follow its images, historical information, sources, and related objects."}
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {(ar
            ? [
                ["امسح", "افتح السجل دون تطبيق إضافي."],
                ["اكتشف", "اقرأ القصة والسياق الزمني."],
                ["تحقق", "تابع المصدر وما لا يزال محل نقاش."],
              ]
            : [
                ["Scan", "Open a record without another app."],
                ["Explore", "Read its story and chronology."],
                ["Verify", "Follow sources and open questions."],
              ]
          ).map(([title, copy], index) => (
            <li key={title} className="rounded-xl bg-white/70 p-4">
              <span className="text-gold font-serif text-2xl">0{index + 1}</span>
              <h3 className="mt-2 font-semibold">{title}</h3>
              <p className="text-ink-muted mt-1 text-sm leading-relaxed">{copy}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

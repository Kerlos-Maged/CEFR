import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LanguageSwitch } from "@/components/language-switch";
import { getActiveLanguages, isActiveLanguage } from "@/lib/i18n/registry";
import { localizedPath } from "@/lib/i18n/paths";

import "../globals.css";

export const metadata: Metadata = {
  title: "Coptic Heritage Digital Platform",
  description:
    "Documenting the history, art, architecture, and religious heritage of Coptic Orthodox churches in Egypt.",
};

export async function generateStaticParams() {
  return (await getActiveLanguages()).map(({ code }) => ({ lang: code }));
}

interface LanguageLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function LanguageLayout({ children, params }: LanguageLayoutProps) {
  const { lang } = await params;
  if (!(await isActiveLanguage(lang))) notFound();
  const language = (await getActiveLanguages()).find((entry) => entry.code === lang);
  if (!language) notFound();

  return (
    <html lang={language.code} dir={language.direction}>
      <body className="bg-parchment text-ink antialiased">
        <div className="heritage-border" aria-hidden="true" />
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 sm:px-6 lg:px-10">
          <header className="border-sand bg-parchment/95 sticky top-0 z-30 -mx-4 border-b px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
            <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-4">
              <Link
                href={localizedPath(language.code, "/")}
                className="brand-wordmark text-crimson flex min-w-0 items-center gap-3 text-xs font-semibold tracking-wide uppercase sm:text-sm"
              >
                <span className="max-w-48 leading-tight sm:max-w-none">
                  {language.code === "ar" ? (
                    <>
                      أرشيف التراث القبطي
                      <span
                        className="text-ink-muted block text-[0.62rem] tracking-[0.2em]"
                        dir="ltr"
                      >
                        EGYPT · HERITAGE
                      </span>
                    </>
                  ) : (
                    <>
                      Coptic Heritage
                      <span className="text-ink-muted block text-[0.62rem] tracking-[0.2em]">
                        DIGITAL ARCHIVE
                      </span>
                    </>
                  )}
                </span>
              </Link>
              <div className="flex items-center gap-3 sm:gap-5">
                <Link
                  className="text-ink-soft hover:text-crimson hidden text-sm transition-colors sm:inline"
                  href={localizedPath(language.code, "/contribute")}
                >
                  {language.code === "ar" ? "ساهم" : "Contribute"}
                </Link>
                <Link
                  className="text-ink-soft hover:text-crimson hidden text-sm transition-colors sm:inline"
                  href={localizedPath(language.code, "/login")}
                >
                  {language.code === "ar" ? "دخول المحررين" : "Editor access"}
                </Link>
                <LanguageSwitch
                  current={language.code}
                  label={language.code === "ar" ? "اللغة" : "Language"}
                  options={(await getActiveLanguages()).map((entry) => ({
                    code: entry.code,
                    label: entry.nativeName,
                    href: localizedPath(entry.code, "/"),
                  }))}
                />
              </div>
            </div>
            <nav
              className="border-sand/70 mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto border-t py-1 text-sm"
              aria-label={language.code === "ar" ? "التنقل الرئيسي" : "Main navigation"}
            >
              {[
                ["/explore", language.code === "ar" ? "استكشف" : "Explore"],
                ["/guide", language.code === "ar" ? "أبا جايد" : "Abba Guide"],
                ["/churches", language.code === "ar" ? "الكنائس" : "Churches"],
                ["/collections", language.code === "ar" ? "المجموعات" : "Collections"],
                ["/timeline", language.code === "ar" ? "الخط الزمني" : "Timeline"],
                ["/stories", language.code === "ar" ? "القصص" : "Stories"],
                ["/research", language.code === "ar" ? "دليل البحث" : "Research guide"],
                ["/about", language.code === "ar" ? "عن الأرشيف" : "About"],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  className="text-ink-soft hover:bg-gold-tint hover:text-crimson shrink-0 rounded-full px-3 py-2 transition-colors"
                  href={localizedPath(language.code, href)}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </header>
          <main id="main-content" className="flex flex-1 flex-col gap-10 pt-8 pb-16 sm:pt-12">
            {children}
          </main>
          <footer className="border-sand mt-auto border-t py-8 text-sm">
            <div className="grid gap-8 pb-8 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <div>
                <p className="text-crimson font-semibold">
                  {language.code === "ar" ? "أرشيف التراث القبطي" : "Coptic Heritage Archive"}
                </p>
                <p className="text-ink-muted mt-2 max-w-xs leading-relaxed">
                  {language.code === "ar"
                    ? "دليل رقمي ثنائي اللغة للكنائس والقطع والقصص التاريخية في مصر."
                    : "A bilingual guide to churches, objects, and historic stories in Egypt."}
                </p>
              </div>
              {[
                {
                  title: language.code === "ar" ? "اكتشف" : "Discover",
                  links: [
                    ["/explore", language.code === "ar" ? "ابدأ الاستكشاف" : "Start exploring"],
                    ["/churches", language.code === "ar" ? "دليل الكنائس" : "Church directory"],
                    ["/collections", language.code === "ar" ? "المجموعات" : "Collections"],
                  ],
                },
                {
                  title: language.code === "ar" ? "تعرّف" : "Learn",
                  links: [
                    ["/timeline", language.code === "ar" ? "الخط الزمني" : "Timeline"],
                    ["/stories", language.code === "ar" ? "القصص" : "Stories"],
                    ["/research", language.code === "ar" ? "منهجية البحث" : "Research guide"],
                  ],
                },
                {
                  title: language.code === "ar" ? "شارك" : "Participate",
                  links: [
                    ["/guide", language.code === "ar" ? "أبا جايد" : "Abba Guide"],
                    ["/about", language.code === "ar" ? "عن المشروع" : "About"],
                    ["/contribute", language.code === "ar" ? "ساهم" : "Contribute"],
                    ["/login", language.code === "ar" ? "دخول المحررين" : "Editor access"],
                  ],
                },
              ].map((group) => (
                <div key={group.title}>
                  <h2 className="text-ink font-semibold">{group.title}</h2>
                  <ul className="mt-3 flex flex-col gap-2">
                    {group.links.map(([href, label]) => (
                      <li key={href}>
                        <Link
                          className="text-ink-muted hover:text-crimson transition-colors"
                          href={localizedPath(language.code, href)}
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="border-sand text-ink-muted flex flex-col justify-between gap-2 border-t pt-5 text-xs sm:flex-row">
              <p>
                {language.code === "ar"
                  ? "المحتوى المرجعي يوضح مصادره ولا يعني اعتماداً من الكنائس المذكورة."
                  : "Reference content cites its sources and does not imply endorsement by listed churches."}
              </p>
              <span>Copyright Coptic Heritage Digital Archive</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

import Link from "next/link";

import { FeaturedCard } from "@/components/heritage/featured-image";
import { FEATURED_HERITAGE } from "@/lib/content/featured-heritage";
import { localizedPath } from "@/lib/i18n/paths";

export type GuidePageKind =
  "explore" | "collections" | "timeline" | "research" | "about" | "contribute" | "stories";

const COPY: Record<GuidePageKind, { en: [string, string, string]; ar: [string, string, string] }> =
  {
    explore: {
      en: [
        "Start anywhere",
        "Explore the archive",
        "Move through Egypt’s Coptic heritage by place, object, time, or theme. Each route leads to records with context and sources.",
      ],
      ar: [
        "ابدأ من أي اتجاه",
        "استكشف الأرشيف",
        "تعرّف إلى التراث القبطي في مصر من خلال المكان أو القطعة أو الزمن أو الموضوع. تقودك المسارات إلى سجلات تتضمن سياقاً ومصادر.",
      ],
    },
    collections: {
      en: [
        "Curated paths",
        "Collections to follow",
        "Explore connected places and themes. These collections are editorial guides through the currently documented reference profiles.",
      ],
      ar: [
        "مسارات مختارة",
        "مجموعات تستحق الاكتشاف",
        "استكشف أماكن وموضوعات مترابطة. هذه المجموعات أدلة تحريرية عبر الصفحات المرجعية الموثقة حالياً.",
      ],
    },
    timeline: {
      en: [
        "Time & memory",
        "A layered timeline",
        "Dates in heritage records can be certain, approximate, or debated. Read each event with its context and follow the source behind it.",
      ],
      ar: [
        "الزمن والذاكرة",
        "خط زمني متعدد الطبقات",
        "قد تكون التواريخ في السجلات التراثية مؤكدة أو تقريبية أو محل نقاش. اقرأ كل حدث في سياقه واتبع مصدره.",
      ],
    },
    research: {
      en: [
        "Evidence first",
        "How to read a record",
        "The archive distinguishes documented facts, religious traditions, and open questions. Sources are attached to the claims they support wherever the record allows.",
      ],
      ar: [
        "الأدلة أولاً",
        "كيف تقرأ السجل",
        "يميّز الأرشيف بين المعلومات الموثقة والتقاليد الدينية والأسئلة المفتوحة. تُرفق المصادر بالادعاءات التي تدعمها متى أتاح السجل ذلك.",
      ],
    },
    about: {
      en: [
        "A living archive",
        "About the project",
        "A bilingual digital guide to the history, art, architecture, and memory of Coptic Orthodox churches in Egypt—built to make heritage easier to explore and easier to verify.",
      ],
      ar: [
        "أرشيف حي",
        "عن المشروع",
        "دليل رقمي ثنائي اللغة لتاريخ وعمارة وفنون وذاكرة الكنائس القبطية الأرثوذكسية في مصر، يسهّل اكتشاف التراث والتحقق من معلوماته.",
      ],
    },
    contribute: {
      en: [
        "Help document heritage",
        "Contribute to the archive",
        "Church editors and researchers can help improve records, translations, media permissions, and source citations through the review workflow.",
      ],
      ar: [
        "ساهم في توثيق التراث",
        "شارك في الأرشيف",
        "يمكن لمحرري الكنائس والباحثين المساعدة في تطوير السجلات والترجمات وتصاريح الصور وتوثيق المصادر عبر مسار المراجعة.",
      ],
    },
    stories: {
      en: [
        "Field notes",
        "Stories from historic Cairo",
        "Follow sourced profiles from Old Cairo and Maadi. These pages distinguish a site’s documented history from traditions associated with it.",
      ],
      ar: [
        "من دفاتر الميدان",
        "حكايات من القاهرة التاريخية",
        "تابع صفحات موثقة من مصر القديمة والمعادي. وتفصل هذه الصفحات بين تاريخ الموقع الموثق والتقاليد المرتبطة به.",
      ],
    },
  };

const EXPLORE_LINKS = [
  {
    href: "/churches",
    number: "01",
    en: "Places",
    ar: "الأماكن",
    copyEn: "Browse the active church directory and historic reference profiles.",
    copyAr: "تصفح دليل الكنائس والصفحات المرجعية التاريخية.",
  },
  {
    href: "/collections",
    number: "02",
    en: "Collections",
    ar: "المجموعات",
    copyEn: "Follow themed routes through connected heritage.",
    copyAr: "اتبع مسارات موضوعية عبر عناصر التراث المترابطة.",
  },
  {
    href: "/timeline",
    number: "03",
    en: "Time",
    ar: "الزمن",
    copyEn: "Compare dates, traditions, and historical interpretations.",
    copyAr: "قارن بين التواريخ والتقاليد والتفسيرات التاريخية.",
  },
  {
    href: "/research",
    number: "04",
    en: "Research guide",
    ar: "دليل البحث",
    copyEn: "See how claims and sources are presented and reviewed.",
    copyAr: "تعرّف إلى طريقة عرض الادعاءات والمصادر ومراجعتها.",
  },
];

export function GuidePage({ lang, kind }: { lang: string; kind: GuidePageKind }) {
  const ar = lang === "ar";
  const [eyebrow, title, description] = COPY[kind][ar ? "ar" : "en"];

  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <header className="relative overflow-hidden rounded-[1.75rem] bg-[#132a3a] px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-16">
        <div
          className="absolute inset-y-0 right-0 hidden w-[36%] border-l border-white/10 lg:block"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_45%,rgba(128,197,190,.2),transparent_58%)]" />
        </div>
        <p className="text-xs font-bold tracking-[0.22em] text-[#f2b8a8] uppercase">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
          {description}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={localizedPath(lang, "/churches")}
            className="rounded-full bg-[#176b73] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f5159]"
          >
            {ar ? "دليل الكنائس" : "Open church directory"}
          </Link>
          <Link
            href={localizedPath(lang, "/collections")}
            className="rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {ar ? "استكشف المجموعات" : "Browse collections"}
          </Link>
        </div>
      </header>

      {kind === "explore" ? <ExploreSections lang={lang} /> : null}
      {kind === "collections" || kind === "stories" ? (
        <FeaturedSection lang={lang} kind={kind} />
      ) : null}
      {kind === "timeline" ? <TimelineSection lang={lang} /> : null}
      {kind === "research" ? <ResearchSection lang={lang} /> : null}
      {kind === "about" ? <AboutSection lang={lang} /> : null}
      {kind === "contribute" ? <ContributeSection lang={lang} /> : null}
    </div>
  );
}

function ExploreSections({ lang }: { lang: string }) {
  const ar = lang === "ar";
  return (
    <section aria-label={ar ? "طرق الاستكشاف" : "Ways to explore"}>
      <SectionHeading
        eyebrow={ar ? "اختر مسارك" : "Choose a path"}
        title={ar ? "أربع طرق لاكتشاف الأرشيف" : "Four ways into the archive"}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {EXPLORE_LINKS.map((item) => (
          <Link
            key={item.href}
            href={localizedPath(lang, item.href)}
            className="group border-sand bg-card hover:border-gold grid grid-cols-[3rem_1fr] gap-4 rounded-2xl border p-5 transition hover:-translate-y-0.5 sm:p-7"
          >
            <span className="font-serif text-3xl text-[#d76d56]">{item.number}</span>
            <span>
              <strong className="text-ink block font-serif text-2xl">
                {ar ? item.ar : item.en}
              </strong>
              <span className="text-ink-muted mt-2 block text-sm leading-relaxed">
                {ar ? item.copyAr : item.copyEn}
              </span>
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-8 grid gap-4 rounded-2xl bg-[#e2edf1] p-6 sm:grid-cols-3 sm:p-8">
        {[
          [
            ar ? "أماكن حية" : "Living places",
            ar ? "ابحث عن كنيسة وسجلاتها المنشورة." : "Find a church and its published records.",
          ],
          [
            ar ? "قطع موثقة" : "Documented objects",
            ar
              ? "افتح صفحة القطعة من رمز QR دائم."
              : "Open an object page from its permanent QR code.",
          ],
          [
            ar ? "مصادر مفتوحة" : "Visible sources",
            ar
              ? "تابع المراجع وراء المعلومات التاريخية."
              : "Follow the references behind historical information.",
          ],
        ].map(([heading, copy]) => (
          <div key={heading}>
            <h2 className="font-semibold">{heading}</h2>
            <p className="text-ink-muted mt-2 text-sm leading-relaxed">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturedSection({ lang, kind }: { lang: string; kind: "collections" | "stories" }) {
  const ar = lang === "ar";
  const label =
    kind === "stories"
      ? ar
        ? "صفحات قصصية"
        : "Sourced stories"
      : ar
        ? "مسارات تحريرية"
        : "Editorial routes";
  return (
    <>
      <section>
        <SectionHeading
          eyebrow={label}
          title={ar ? "ثلاثة مداخل إلى ذاكرة المكان" : "Three ways to read a place"}
        />
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {FEATURED_HERITAGE.map((record) => (
            <FeaturedCard key={record.object.publicId} record={record} locale={lang} />
          ))}
        </div>
        <p className="text-ink-muted mt-4 text-xs leading-relaxed">
          {ar
            ? "الصفحات المرجعية مستندة إلى مصادر حكومية مصرية، ولا تعني وجود شراكة مع الكنائس المذكورة."
            : "Reference profiles use Egyptian government sources and do not imply a partnership with the listed churches."}
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          [
            ar ? "العمارة والمواد" : "Architecture & materials",
            ar
              ? "الكنيسة المعلقة: تخطيط بازيليكي وسقف خشبي وعناصر رخامية."
              : "The Hanging Church: basilican plan, timber roof, and marble elements.",
          ],
          [
            ar ? "المغارة والتقليد" : "Cave & tradition",
            ar
              ? "أبو سرجة: تمييز تاريخ البناء المختلف عليه عن تقليد مسار العائلة المقدسة."
              : "Abu Serga: a disputed building date, distinguished from the Holy Family tradition.",
          ],
          [
            ar ? "النهر والمسار" : "River & route",
            ar
              ? "المعادي: قراءة ارتباط الموقع برحلة العائلة المقدسة كما تذكره الوزارة."
              : "Maadi: the route association as described by the Ministry.",
          ],
        ].map(([title, copy]) => (
          <article key={title} className="border-sand bg-card rounded-xl border p-5">
            <h2 className="font-serif text-xl">{title}</h2>
            <p className="text-ink-muted mt-2 text-sm leading-relaxed">{copy}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function TimelineSection({ lang }: { lang: string }) {
  const ar = lang === "ar";
  return (
    <section>
      <SectionHeading
        eyebrow={ar ? "تواريخ وسياقات" : "Dates & context"}
        title={ar ? "اقرأ التسلسل دون اختزال" : "Read the chronology without flattening it"}
      />
      <div className="relative mt-8 flex flex-col gap-5 before:absolute before:top-3 before:bottom-3 before:left-[0.7rem] before:w-px before:bg-[#acc3cb] sm:before:left-[1.1rem]">
        {FEATURED_HERITAGE.flatMap((record) =>
          record.timeline.map((event, index) => ({
            record,
            event,
            key: `${record.object.publicId}-${index}`,
          })),
        ).map(({ record, event }) => (
          <article
            key={`${record.object.publicId}-${event.date}-${event.title.en}`}
            className="border-sand bg-card rounded-xl border-s-2 p-5 sm:p-6"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-crimson text-xs font-bold tracking-wide uppercase">
                  {event.date}
                </p>
                <Link
                  href={localizedPath(lang, `/churches/${record.slug}`)}
                  className="text-ink-muted text-xs underline underline-offset-4"
                >
                  {ar ? record.church.name.ar : record.church.name.en}
                </Link>
              </div>
              <h2 className="mt-2 font-serif text-xl">{ar ? event.title.ar : event.title.en}</h2>
              <p className="text-ink-soft mt-2 max-w-3xl text-sm leading-relaxed">
                {ar ? event.detail.ar : event.detail.en}
              </p>
              <a
                href={record.object.sources[0]?.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="text-crimson mt-4 inline-block text-xs font-semibold underline underline-offset-4"
              >
                {ar ? "المصدر المرجعي" : "View supporting source"}
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResearchSection({ lang }: { lang: string }) {
  const ar = lang === "ar";
  const principles = ar
    ? [
        [
          "نفرّق بين أنواع المعرفة",
          "يُعرض الوصف الأثري والتقليد الديني والتأريخ المختلف عليه بصياغة منفصلة.",
        ],
        [
          "نربط الادعاء بمصدر",
          "تظهر المراجع قرب الادعاءات أو السجل الذي تدعمه، مع روابط مباشرة متى توفرت.",
        ],
        ["نوضح حدود السجل", "غياب تاريخ أو نسبة مؤكدة يظل واضحاً بدلاً من ملئه بتخمين."],
        [
          "نحترم حقوق الصور",
          "تتضمن الوسائط المنشورة بيانات الإذن والنسبة، وتُحجب الملفات غير المصرح بنشرها.",
        ],
      ]
    : [
        [
          "Separate kinds of evidence",
          "Archaeological description, religious tradition, and disputed dating are presented as distinct kinds of information.",
        ],
        [
          "Connect claims to sources",
          "References appear beside the claims or records they support, with direct links where available.",
        ],
        [
          "Make gaps visible",
          "An unknown date or attribution stays unknown instead of being filled with a guess.",
        ],
        [
          "Respect image rights",
          "Published media carries permission and attribution details; restricted files stay hidden.",
        ],
      ];
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2">
        {principles.map(([title, copy], index) => (
          <article key={title} className="border-sand bg-card rounded-xl border p-6">
            <span className="text-gold font-serif text-3xl">0{index + 1}</span>
            <h2 className="mt-3 font-serif text-2xl">{title}</h2>
            <p className="text-ink-muted mt-2 leading-relaxed">{copy}</p>
          </article>
        ))}
      </section>
      <section className="rounded-2xl bg-[#e2edf1] p-6 sm:p-8">
        <SectionHeading
          eyebrow={ar ? "المراجع الحالية" : "Current references"}
          title={ar ? "مصادر الصفحات المرجعية" : "Sources used in the reference profiles"}
        />
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {FEATURED_HERITAGE.flatMap((record) =>
            record.object.sources.map((source) => ({ record, source })),
          ).map(({ record, source }) => (
            <li
              key={`${record.object.publicId}-${source.id}`}
              className="rounded-xl bg-white/70 p-4"
            >
              <p className="text-ink-muted text-xs">
                {ar ? record.church.name.ar : record.church.name.en}
              </p>
              <a
                href={source.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="text-crimson mt-1 inline-block font-semibold underline underline-offset-4"
              >
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function AboutSection({ lang }: { lang: string }) {
  const ar = lang === "ar";
  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="border-sand bg-card rounded-2xl border p-6 sm:p-9">
        <p className="text-crimson text-xs font-bold tracking-[0.18em] uppercase">
          {ar ? "هدفنا" : "Our purpose"}
        </p>
        <h2 className="mt-3 font-serif text-3xl">
          {ar
            ? "التراث يصبح أقرب حين يكون موثقاً ومتاحاً."
            : "Heritage is closer when it is documented and accessible."}
        </h2>
        <p className="text-ink-soft mt-5 leading-relaxed">
          {ar
            ? "يجمع المشروع بين دليل الكنائس، وسجلات القطع، والقصص الزمنية، والمراجع في تجربة واحدة بالعربية والإنجليزية. لكل سجل عام رابط دائم ورمز QR يصل الزائر إلى معلوماته."
            : "The project brings together a church directory, object records, timelines, and references in one Arabic and English experience. Each public record has a permanent link and a QR code that takes visitors to its information."}
        </p>
        <p className="text-ink-muted mt-4 text-sm leading-relaxed">
          {ar
            ? "المحتوى المرجعي لا يعني اعتماداً من الكنيسة، ولا يكتمل توثيق الكنيسة أو مجموعتها إلا بالتعاون والمراجعة."
            : "Reference content does not imply church endorsement. A church or collection record is complete only through documentation and review."}
        </p>
      </div>
      <aside className="rounded-2xl bg-[#132a3a] p-6 text-white sm:p-8">
        <p className="text-xs font-bold tracking-[0.18em] text-[#f2b8a8] uppercase">
          {ar ? "سجل قابل للتتبع" : "A traceable record"}
        </p>
        <ol className="mt-5 flex flex-col gap-4">
          {(ar
            ? [
                "سياق الكنيسة والمكان",
                "وصف القطعة وتاريخها",
                "صور مصرح بها",
                "ادعاءات ومراجع",
                "تاريخ المراجعة والنشر",
              ]
            : [
                "Church and place context",
                "Object description and date",
                "Rights-cleared images",
                "Claims and references",
                "Review and publication history",
              ]
          ).map((line, index) => (
            <li key={line} className="flex gap-3 border-b border-white/15 pb-3 last:border-0">
              <span className="font-serif text-[#f2b8a8]">0{index + 1}</span>
              <span className="text-sm">{line}</span>
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}

function ContributeSection({ lang }: { lang: string }) {
  const ar = lang === "ar";
  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        {(ar
          ? [
              ["كنيسة", "تعاون في مراجعة سجلات الموقع ومجموعاته."],
              ["باحث", "أضف مراجعاً أو وضّح موضع الخلاف."],
              ["مترجم", "ساعد في إتاحة المعلومات بالعربية والإنجليزية."],
            ]
          : [
              ["A church", "Help review the church profile and its collection records."],
              ["A researcher", "Add a reference or clarify a point of disagreement."],
              ["A translator", "Help make records available in Arabic and English."],
            ]
        ).map(([title, copy]) => (
          <article key={title} className="border-sand bg-card rounded-xl border p-6">
            <h2 className="font-serif text-2xl">{title}</h2>
            <p className="text-ink-muted mt-3 text-sm leading-relaxed">{copy}</p>
          </article>
        ))}
      </section>
      <section className="flex flex-col justify-between gap-5 rounded-2xl bg-[#0f5159] p-6 text-white sm:flex-row sm:items-center sm:p-9">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-[#f2b8a8] uppercase">
            {ar ? "محررو الأرشيف" : "Archive editors"}
          </p>
          <h2 className="mt-2 font-serif text-3xl">
            {ar ? "ابدأ من مسار المراجعة" : "Start with the review workflow"}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
            {ar
              ? "تُراجع السجلات قبل نشرها. سجّل الدخول إذا كان لديك حساب محرر، أو تواصل مع إدارة كنيستك لمعرفة طريقة المشاركة."
              : "Records are reviewed before publication. Sign in if you have an editor account, or ask your church administration about participating."}
          </p>
        </div>
        <Link
          href={localizedPath(lang, "/login")}
          className="w-fit shrink-0 rounded-full bg-[#e0f1ed] px-6 py-3 text-sm font-semibold text-[#0f5159] transition hover:bg-white"
        >
          {ar ? "دخول المحررين" : "Editor access"}
        </Link>
      </section>
    </>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-crimson text-xs font-bold tracking-[0.18em] uppercase">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-3xl">{title}</h2>
    </div>
  );
}

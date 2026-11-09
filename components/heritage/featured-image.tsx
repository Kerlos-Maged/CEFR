import type { FeaturedHeritageRecord } from "@/lib/content/featured-heritage";
import Image from "next/image";

export function FeaturedImage({
  record,
  locale,
  className = "",
}: {
  record: FeaturedHeritageRecord;
  locale: string;
  className?: string;
}) {
  const isArabic = locale === "ar";
  return (
    <figure className={`relative aspect-[16/10] overflow-hidden ${className}`}>
      <Image
        src={record.image.src}
        alt={isArabic ? record.image.alt.ar : record.image.alt.en}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        unoptimized
        className="heritage-photo"
        loading="lazy"
        decoding="async"
      />
      <figcaption className="px-3 py-2 text-xs text-white/80">
        <a
          href={record.image.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          {record.image.credit}
        </a>
      </figcaption>
    </figure>
  );
}

export function FeaturedCard({
  record,
  locale,
}: {
  record: FeaturedHeritageRecord;
  locale: string;
}) {
  const isArabic = locale === "ar";
  const name =
    record.kind === "object"
      ? isArabic && record.contentKey === "coptic-mona-lisa"
        ? "الموناليزا القبطية · أيقونة العذراء والطفل"
        : (record.object.content?.title ?? record.church.name.en)
      : isArabic
        ? record.church.name.ar
        : record.church.name.en;
  return (
    <article className="group border-sand bg-card hover:border-gold overflow-hidden rounded-2xl border shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1">
      <a
        href={
          record.kind === "object"
            ? `/${locale}/o/${record.object.publicId}`
            : `/${locale}/churches/${record.slug}`
        }
        className="bg-parchment-deep relative block aspect-[16/10] overflow-hidden"
      >
        <Image
          src={record.image.src}
          alt={isArabic ? record.image.alt.ar : record.image.alt.en}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          unoptimized
          className="heritage-photo transition duration-500 group-hover:scale-[1.035]"
          loading="lazy"
          decoding="async"
        />
      </a>
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-crimson text-[0.68rem] font-bold tracking-[0.17em] uppercase">
            {record.church.district} · {record.church.city}
          </span>
          <span className="bg-gold-tint text-crimson-dark rounded-full px-2.5 py-1 text-[0.66rem] font-semibold">
            {isArabic ? "مرجع تاريخي" : "Historic reference"}
          </span>
        </div>
        <h3 className="text-ink text-xl leading-snug font-semibold">{name}</h3>
        <p className="text-ink-muted line-clamp-3 text-sm leading-relaxed">
          {isArabic ? record.context.ar : record.context.en}
        </p>
        <a
          className="text-crimson decoration-gold mt-1 w-fit text-sm font-semibold underline underline-offset-4"
          href={`/${locale}/o/${record.object.publicId}`}
        >
          {isArabic ? "افتح سجل القطعة ومصادرها" : "Open object record & sources"}
        </a>
      </div>
    </article>
  );
}

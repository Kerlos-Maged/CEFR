import { pickMediaCaption } from "@/lib/db/localization";
import type { PublishedMedia } from "@/lib/db/objects";
import { buildImageSizes, buildImageSrcSet, renderImageUrl } from "@/lib/media/urls";

interface HeritageImageProps {
  media: PublishedMedia;
  locale: string;
  fallbackLanguage: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * Renders a public image with responsive variants and localized alt text. Alt text is required
 * for public images (enforced at publication); when a language has none yet, the caption is used
 * and the image still renders accessibly.
 */
export function HeritageImage({
  media,
  locale,
  fallbackLanguage,
  sizes,
  priority = false,
}: HeritageImageProps) {
  if (!media.url) return null;

  const resolved = pickMediaCaption(media.captions, locale, fallbackLanguage);
  const altText = resolved.altText ?? resolved.caption ?? "";
  const showCaption = Boolean(resolved.caption || media.attribution);

  return (
    <figure className="flex flex-col gap-2">
      <img
        src={renderImageUrl(media.url, { width: 960 })}
        srcSet={buildImageSrcSet(media.url)}
        sizes={sizes ?? buildImageSizes()}
        width={media.width ?? undefined}
        height={media.height ?? undefined}
        alt={altText}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="border-sand bg-parchment-deep h-auto w-full rounded-lg border"
      />
      {showCaption && (
        <figcaption className="text-ink-muted text-sm">
          {resolved.caption}
          {resolved.caption && media.attribution ? " — " : null}
          {media.attribution}
        </figcaption>
      )}
    </figure>
  );
}

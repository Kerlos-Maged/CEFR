"use client";

import { useState } from "react";

import type { PublishedMedia } from "@/lib/db/objects";
import { pickMediaCaption } from "@/lib/db/localization";
import { buildImageThumbnailUrl } from "@/lib/media/urls";

import { HeritageImage } from "./heritage-image";

export function ImageGallery({
  images,
  locale,
  fallbackLanguage,
  label,
}: {
  images: PublishedMedia[];
  locale: string;
  fallbackLanguage: string;
  label: string;
}) {
  const available = images.filter((image) => image.url);
  const [selectedIndex, setSelectedIndex] = useState(0);
  if (available.length === 0) return null;
  const selected = available[selectedIndex] ?? available[0];

  return (
    <div className="flex flex-col gap-3">
      <HeritageImage
        media={selected}
        locale={locale}
        fallbackLanguage={fallbackLanguage}
        priority
      />
      {available.length > 1 ? (
        <div role="group" aria-label={label} className="flex gap-2 overflow-x-auto pb-2">
          {available.map((image, index) => {
            const caption = pickMediaCaption(image.captions, locale, fallbackLanguage);
            const name = caption.altText || caption.caption || `${label} ${index + 1}`;
            return (
              <button
                key={image.id}
                type="button"
                aria-label={name}
                aria-pressed={selectedIndex === index}
                onClick={() => setSelectedIndex(index)}
                className={`border-sand-deep focus-visible:ring-gold h-20 w-20 shrink-0 overflow-hidden rounded border focus-visible:ring-2 ${selectedIndex === index ? "ring-crimson ring-2" : "opacity-75 hover:opacity-100"}`}
              >
                <img
                  src={buildImageThumbnailUrl(image.url!)}
                  alt=""
                  width={80}
                  height={80}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

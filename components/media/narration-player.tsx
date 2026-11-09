"use client";

import { sendAnalyticsEvent } from "@/lib/analytics/client";

interface NarrationPlayerProps {
  src: string;
  label: string;
  mimeType: string;
  attribution?: string | null;
  publicId?: string;
  language?: string;
}

/**
 * Audio narration player (FR-MD-4). Kept minimal and accessible: the caption labels the player,
 * and a download link is shown as a fallback for browsers without supported inline playback.
 */
export function NarrationPlayer({
  src,
  label,
  mimeType,
  attribution,
  publicId,
  language,
}: NarrationPlayerProps) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-crimson text-sm font-medium">{label}</figcaption>
      <audio
        controls
        preload="metadata"
        aria-label={label}
        className="w-full"
        onPlay={() => {
          sendAnalyticsEvent({
            event_type: "audio_play",
            ...(publicId ? { public_id: publicId } : {}),
            ...(language ? { language_code: language } : {}),
          });
        }}
        onEnded={() => {
          sendAnalyticsEvent({
            event_type: "audio_complete",
            ...(publicId ? { public_id: publicId } : {}),
            ...(language ? { language_code: language } : {}),
          });
        }}
      >
        <source src={src} type={mimeType} />
        <a href={src}>Download audio</a>
      </audio>
      {attribution && <p className="text-ink-muted text-sm">{attribution}</p>}
    </figure>
  );
}

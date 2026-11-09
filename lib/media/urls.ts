/**
 * Responsive image URL construction (FR-MD-5). Supabase Storage serves on-the-fly image
 * transformations from `/storage/v1/render/image/public/...`; the same non-guessable path is
 * reused with width/quality parameters so no derivatives are persisted.
 */
export const RESPONSIVE_IMAGE_WIDTHS = [320, 640, 960, 1280, 1920] as const;

const OBJECT_MARKER = "/storage/v1/object/public/";
const RENDER_MARKER = "/storage/v1/render/image/public/";

export interface ImageTransformOptions {
  width: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
}

/**
 * Returns a transformed (server-resized) variant URL. If `publicUrl` is not a Supabase public
 * object URL (e.g. a fixture or an external host), it is returned unchanged.
 */
export function renderImageUrl(publicUrl: string, options: ImageTransformOptions): string {
  if (!publicUrl.includes(OBJECT_MARKER)) return publicUrl;

  const [base, existingQuery] = publicUrl.split("?");
  const params = new URLSearchParams(existingQuery ?? "");
  params.set("width", String(Math.round(options.width)));
  if (options.height) params.set("height", String(Math.round(options.height)));
  params.set("quality", String(options.quality ?? 80));
  if (options.resize) params.set("resize", options.resize);

  return `${base.replace(OBJECT_MARKER, RENDER_MARKER)}?${params.toString()}`;
}

export function buildImageSrcSet(
  publicUrl: string,
  widths: readonly number[] = RESPONSIVE_IMAGE_WIDTHS,
): string {
  return widths.map((width) => `${renderImageUrl(publicUrl, { width })} ${width}w`).join(", ");
}

/** Server-generated square thumbnail rendition for compact cards and previews. */
export function buildImageThumbnailUrl(publicUrl: string, size = 320): string {
  return renderImageUrl(publicUrl, { width: size, height: size, quality: 75, resize: "cover" });
}

export function buildImageSizes(maxWidthPx = 768): string {
  return `(max-width: ${maxWidthPx}px) 100vw, ${maxWidthPx}px`;
}

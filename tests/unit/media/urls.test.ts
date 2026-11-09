import { describe, expect, it } from "vitest";

import {
  buildImageSizes,
  buildImageSrcSet,
  renderImageUrl,
  RESPONSIVE_IMAGE_WIDTHS,
} from "@/lib/media/urls";

const PUBLIC_URL =
  "https://project.supabase.co/storage/v1/object/public/object-media/church/object/photo.jpg";

describe("renderImageUrl", () => {
  it("switches to the render endpoint and applies transform parameters", () => {
    const url = renderImageUrl(PUBLIC_URL, { width: 640, height: 480, resize: "cover" });
    expect(url.startsWith("https://project.supabase.co/storage/v1/render/image/public/")).toBe(
      true,
    );
    const params = new URL(url).searchParams;
    expect(params.get("width")).toBe("640");
    expect(params.get("height")).toBe("480");
    expect(params.get("quality")).toBe("80");
    expect(params.get("resize")).toBe("cover");
  });

  it("preserves an existing query string", () => {
    const url = renderImageUrl(`${PUBLIC_URL}?download=1`, { width: 320 });
    expect(new URL(url).searchParams.get("download")).toBe("1");
    expect(new URL(url).searchParams.get("width")).toBe("320");
  });

  it("leaves non-Supabase URLs untouched", () => {
    const external = "https://example.org/photo.jpg";
    expect(renderImageUrl(external, { width: 640 })).toBe(external);
  });
});

describe("buildImageSrcSet", () => {
  it("emits one width descriptor per variant", () => {
    const srcSet = buildImageSrcSet(PUBLIC_URL);
    const entries = srcSet.split(", ");
    expect(entries).toHaveLength(RESPONSIVE_IMAGE_WIDTHS.length);
    expect(entries[0].endsWith("320w")).toBe(true);
    expect(entries.at(-1)?.endsWith("1920w")).toBe(true);
  });

  it("supports a custom width ladder", () => {
    expect(buildImageSrcSet(PUBLIC_URL, [400, 800])).toContain("400w");
    expect(buildImageSrcSet(PUBLIC_URL, [400, 800])).toContain("800w");
  });
});

describe("buildImageSizes", () => {
  it("produces a mobile-first sizes attribute", () => {
    expect(buildImageSizes(768)).toBe("(max-width: 768px) 100vw, 768px");
  });
});

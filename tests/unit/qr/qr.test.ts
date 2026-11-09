import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `lib/qr` reads `publicEnv` at import time, so set the environment before importing it.
 */
const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://heritage.example";
  vi.resetModules();
});

afterAll(() => {
  if (ORIGINAL_SITE_URL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
});

describe("objectPublicUrl", () => {
  it("builds the permanent /o/{publicId} URL", async () => {
    const { objectPublicUrl } = await import("@/lib/qr");
    expect(objectPublicUrl("PBC0000001")).toBe("https://heritage.example/o/PBC0000001");
  });

  it("returns null for invalid public ids", async () => {
    const { objectPublicUrl } = await import("@/lib/qr");
    expect(objectPublicUrl("lowercase1")).toBeNull();
    expect(objectPublicUrl("../etc")).toBeNull();
    expect(objectPublicUrl("SHORT")).toBeNull();
  });
});

describe("renderQrSvg / renderQrPng", () => {
  it("renders an SVG document", async () => {
    const { renderQrSvg } = await import("@/lib/qr");
    const svg = await renderQrSvg("PBC0000001");
    expect(svg).toContain("<svg");
  });

  it("renders a PNG buffer", async () => {
    const { renderQrPng } = await import("@/lib/qr");
    const png = await renderQrPng("PBC0000001");
    expect(png).not.toBeNull();
    // PNG magic bytes.
    expect(png!.subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("returns null for invalid ids", async () => {
    const { renderQrSvg } = await import("@/lib/qr");
    expect(await renderQrSvg("bad")).toBeNull();
  });
});

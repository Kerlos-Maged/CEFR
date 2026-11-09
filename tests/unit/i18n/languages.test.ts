import { describe, expect, it } from "vitest";

import {
  getDirection,
  getLanguage,
  isRtl,
  isSupportedLanguage,
  normalizeLanguage,
} from "@/lib/i18n/languages";
import { localizedPath, matchLanguage } from "@/lib/i18n/paths";

describe("language registry", () => {
  it("exposes the supported languages with directionality", () => {
    expect(getLanguage("en")).toMatchObject({ name: "English", direction: "ltr" });
    expect(getLanguage("ar")).toMatchObject({ name: "Arabic", direction: "rtl" });
    expect(getLanguage("fr")).toBeNull();
  });

  it("validates supported codes", () => {
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("ar")).toBe(true);
    expect(isSupportedLanguage("de")).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
    expect(isSupportedLanguage(undefined)).toBe(false);
  });

  it("reports direction and rtl-ness, defaulting to ltr", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
    expect(getDirection("zz")).toBe("ltr");
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("en")).toBe(false);
  });

  it("normalizes unknown codes to the default language", () => {
    expect(normalizeLanguage("ar")).toBe("ar");
    expect(normalizeLanguage("fr")).toBe("en");
    expect(normalizeLanguage(null)).toBe("en");
  });
});

describe("locale paths", () => {
  it("matches a supported locale prefix", () => {
    expect(matchLanguage("/ar/o/AB12CD34EF")).toBe("ar");
    expect(matchLanguage("/en")).toBe("en");
    expect(matchLanguage("/o/AB12CD34EF")).toBeNull();
    expect(matchLanguage("/")).toBeNull();
    expect(matchLanguage("/zz/o/AB12CD34EF")).toBeNull();
  });

  it("builds locale-prefixed paths", () => {
    expect(localizedPath("en", "/")).toBe("/en");
    expect(localizedPath("ar", "/o/AB12CD34EF")).toBe("/ar/o/AB12CD34EF");
    expect(localizedPath("en", "o/AB12CD34EF")).toBe("/en/o/AB12CD34EF");
  });
});

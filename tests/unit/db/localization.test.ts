import { describe, expect, it } from "vitest";

import { pickMediaCaption, pickTranslation } from "@/lib/db/localization";

describe("pickTranslation", () => {
  const rows = [
    { language_code: "en", title: "Icon", description: null },
    { language_code: "ar", title: "أيقونة", description: "وصف" },
  ];

  it("returns the exact locale without fallback", () => {
    expect(pickTranslation(rows, "ar", "en")).toEqual({
      translated: rows[1],
      isFallback: false,
    });
  });

  it("falls back to the object default language", () => {
    expect(pickTranslation(rows, "fr", "en")).toEqual({
      translated: rows[0],
      isFallback: true,
    });
  });

  it("returns null when there are no rows", () => {
    expect(pickTranslation([], "ar", "en")).toEqual({ translated: null, isFallback: false });
  });
});

describe("pickMediaCaption", () => {
  const captions = {
    en: { caption: "Baptismal font", altText: "A carved stone font" },
    ar: { caption: "جرن المعمودية", altText: "جرن حجري منقوش" },
  };

  it("returns the requested language", () => {
    expect(pickMediaCaption(captions, "ar", "en")).toEqual({
      caption: "جرن المعمودية",
      altText: "جرن حجري منقوش",
      isFallback: false,
      language: "ar",
    });
  });

  it("falls back to the default language and flags it", () => {
    expect(pickMediaCaption(captions, "fr", "en")).toEqual({
      caption: "Baptismal font",
      altText: "A carved stone font",
      isFallback: true,
      language: "en",
    });
  });

  it("falls back to any available language", () => {
    const arabicOnly = { ar: captions.ar };
    expect(pickMediaCaption(arabicOnly, "en", "en")).toMatchObject({
      caption: "جرن المعمودية",
      isFallback: true,
      language: "ar",
    });
  });

  it("returns empty values when no captions exist", () => {
    expect(pickMediaCaption({}, "ar", "en")).toEqual({
      caption: null,
      altText: null,
      isFallback: false,
      language: null,
    });
  });
});

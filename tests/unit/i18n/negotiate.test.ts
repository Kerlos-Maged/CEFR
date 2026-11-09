import { describe, expect, it } from "vitest";

import { negotiateLanguage, parseAcceptLanguage } from "@/lib/i18n/negotiate";

describe("parseAcceptLanguage", () => {
  it("orders tags by descending quality and drops q=0", () => {
    expect(parseAcceptLanguage("en;q=0.5, ar;q=0.9, fr;q=0")).toEqual(["ar", "en"]);
  });

  it("defaults missing quality to 1 and preserves order for ties", () => {
    expect(parseAcceptLanguage("ar, en")).toEqual(["ar", "en"]);
  });

  it("returns nothing for empty input", () => {
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage("")).toEqual([]);
  });
});

describe("negotiateLanguage", () => {
  it("prefers a remembered cookie over the header", () => {
    expect(negotiateLanguage({ cookie: "ar", acceptLanguage: "en-US,en;q=0.9" })).toBe("ar");
  });

  it("ignores an unsupported cookie", () => {
    expect(negotiateLanguage({ cookie: "fr", acceptLanguage: "ar" })).toBe("ar");
  });

  it("matches regional tags by base language", () => {
    expect(negotiateLanguage({ acceptLanguage: "ar-EG,ar;q=0.9,en;q=0.8" })).toBe("ar");
    expect(negotiateLanguage({ acceptLanguage: "en-GB" })).toBe("en");
  });

  it("honours weights across languages", () => {
    expect(negotiateLanguage({ acceptLanguage: "en;q=0.3, ar;q=0.9" })).toBe("ar");
  });

  it("falls back to the default language", () => {
    expect(negotiateLanguage({ acceptLanguage: "fr-FR, de;q=0.8" })).toBe("en");
    expect(negotiateLanguage({})).toBe("en");
    expect(negotiateLanguage({ acceptLanguage: "*" })).toBe("en");
  });

  it("ignores an unsupported explicit fallback", () => {
    expect(negotiateLanguage({ acceptLanguage: "de", fallback: "fr" })).toBe("en");
  });
});

import { describe, expect, it } from "vitest";

import { sanitizeNextPath } from "@/lib/auth/sanitize-next-path";

describe("sanitizeNextPath", () => {
  it("defaults to /admin when absent", () => {
    expect(sanitizeNextPath(null)).toBe("/admin");
  });

  it("accepts same-origin root-relative paths", () => {
    expect(sanitizeNextPath("/admin/objects/123")).toBe("/admin/objects/123");
    expect(sanitizeNextPath("/ar/admin")).toBe("/ar/admin");
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeNextPath("https://evil.example/steal")).toBe("/admin");
    expect(sanitizeNextPath("http://evil.example")).toBe("/admin");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeNextPath("//evil.example")).toBe("/admin");
  });

  it("rejects backslash tricks", () => {
    expect(sanitizeNextPath("/\\evil.example")).toBe("/admin");
    expect(sanitizeNextPath("/admin\\..\\..")).toBe("/admin");
  });

  it("rejects control characters", () => {
    expect(sanitizeNextPath("/admin\u0000")).toBe("/admin");
    expect(sanitizeNextPath("/admin\nSet-Cookie: x")).toBe("/admin");
  });

  it("rejects values that do not start with a slash", () => {
    expect(sanitizeNextPath("admin")).toBe("/admin");
    expect(sanitizeNextPath("javascript:alert(1)")).toBe("/admin");
  });
});

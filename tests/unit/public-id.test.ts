import { describe, expect, it } from "vitest";

import { isValidPublicId, PUBLIC_ID_LENGTH } from "@/lib/validation/public-id";

describe("isValidPublicId", () => {
  it("accepts canonical 10-character Crockford Base32 identifiers", () => {
    expect(isValidPublicId("7Q2M4XR9KD")).toBe(true);
    expect(isValidPublicId("0000000000")).toBe(true);
    expect(isValidPublicId("ZZZZZZZZZZ")).toBe(true);
  });

  it("rejects identifiers containing ambiguous characters (I, L, O, U)", () => {
    expect(isValidPublicId("7O2M4XR9KD")).toBe(false);
    expect(isValidPublicId("7I2M4XR9KD")).toBe(false);
    expect(isValidPublicId("7L2M4XR9KD")).toBe(false);
    expect(isValidPublicId("7U2M4XR9KD")).toBe(false);
  });

  it("rejects values of the wrong length", () => {
    expect(isValidPublicId("7Q2M4XR9K")).toBe(false);
    expect(isValidPublicId("7Q2M4XR9KDD")).toBe(false);
    expect(isValidPublicId("")).toBe(false);
  });

  it("rejects lowercase and malformed values", () => {
    expect(isValidPublicId("7q2m4xr9kd")).toBe(false);
    expect(isValidPublicId("7Q2M4XR9K-")).toBe(false);
  });

  it("exposes the documented length constant", () => {
    expect(PUBLIC_ID_LENGTH).toBe(10);
  });
});

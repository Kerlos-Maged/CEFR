import { describe, expect, it } from "vitest";

import { generatePublicId } from "@/lib/validation/generate-public-id";
import { isValidPublicId } from "@/lib/validation/public-id";

describe("generatePublicId", () => {
  it("produces a valid 10-character Crockford Base32 id", () => {
    for (let i = 0; i < 200; i += 1) {
      const id = generatePublicId();
      expect(id).toHaveLength(10);
      expect(isValidPublicId(id)).toBe(true);
    }
  });

  it("never emits the ambiguous letters I, L, O, U", () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generatePublicId()).not.toMatch(/[ILOU]/);
    }
  });

  it("is practically collision-resistant across a large sample", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) seen.add(generatePublicId());
    expect(seen.size).toBe(5000);
  });
});

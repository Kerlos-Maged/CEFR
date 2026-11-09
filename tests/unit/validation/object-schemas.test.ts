import { describe, expect, it } from "vitest";

import {
  createMediaSchema,
  createObjectSchema,
  createSourceSchema,
  grantMembershipSchema,
  updateObjectSchema,
  upsertTranslationSchema,
} from "@/lib/validation/object";

const uuid = "12345678-1234-4abc-8abc-1234567890ab";
const uuid2 = "12345678-1234-4abc-8abc-1234567890cd";

describe("createObjectSchema", () => {
  it("accepts a minimal valid object", () => {
    const result = createObjectSchema.safeParse({
      church_id: uuid,
      object_type: "icon",
      default_language: "en",
      title: "The Annunciation icon",
    });
    expect(result.success).toBe(true);
  });

  it("rejects protected fields (strict)", () => {
    const result = createObjectSchema.safeParse({
      church_id: uuid,
      object_type: "icon",
      default_language: "en",
      title: "x",
      status: "published",
      public_id: "ABCDEFGHJK",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown object type", () => {
    const result = createObjectSchema.safeParse({
      church_id: uuid,
      object_type: "spaceship",
      default_language: "en",
      title: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed language code but permits future registered languages", () => {
    const result = createObjectSchema.safeParse({
      church_id: uuid,
      object_type: "icon",
      default_language: "FR",
      title: "x",
    });
    expect(result.success).toBe(false);
    expect(
      createObjectSchema.safeParse({
        church_id: uuid,
        object_type: "icon",
        default_language: "fr",
        title: "x",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = createObjectSchema.safeParse({
      church_id: uuid,
      object_type: "icon",
      default_language: "en",
      title: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("normalises empty optionals to undefined", () => {
    const result = createObjectSchema.parse({
      church_id: uuid,
      object_type: "icon",
      default_language: "en",
      title: "x",
      description: "",
      materials: "",
    });
    expect(result.description).toBeUndefined();
    expect(result.materials).toBeUndefined();
  });
});

describe("updateObjectSchema", () => {
  it("rejects status and church_id (strict)", () => {
    expect(updateObjectSchema.safeParse({ status: "published" }).success).toBe(false);
    expect(updateObjectSchema.safeParse({ church_id: uuid }).success).toBe(false);
  });

  it("accepts partial editable fields", () => {
    expect(updateObjectSchema.safeParse({ materials: "Oil on wood" }).success).toBe(true);
  });
});

describe("upsertTranslationSchema", () => {
  it("requires a title", () => {
    expect(upsertTranslationSchema.safeParse({ language_code: "ar", title: "" }).success).toBe(
      false,
    );
  });

  it("accepts a valid translation", () => {
    expect(
      upsertTranslationSchema.safeParse({ language_code: "ar", title: "أيقونة", description: "" })
        .success,
    ).toBe(true);
  });
});

describe("createSourceSchema", () => {
  it("rejects javascript: URLs", () => {
    expect(createSourceSchema.safeParse({ title: "x", url: "javascript:alert(1)" }).success).toBe(
      false,
    );
  });

  it("accepts http(s) URLs", () => {
    expect(
      createSourceSchema.safeParse({ title: "x", url: "https://archive.example/doc" }).success,
    ).toBe(true);
  });

  it("rejects an unknown source type", () => {
    expect(createSourceSchema.safeParse({ title: "x", source_type: "tweet" }).success).toBe(false);
  });
});

describe("createMediaSchema", () => {
  const base = {
    object_id: uuid,
    media_type: "image",
    mime_type: "image/jpeg",
    size_bytes: 1000,
  };

  it("accepts a well-formed storage path", () => {
    const result = createMediaSchema.safeParse({
      ...base,
      storage_path: `${uuid}/${uuid2}/12345678-1234-4abc-8abc-1234567890ef.jpg`,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a path-traversal storage path", () => {
    const result = createMediaSchema.safeParse({
      ...base,
      storage_path: `../../etc/passwd`,
    });
    expect(result.success).toBe(false);
  });

  it("rejects oversized files", () => {
    const result = createMediaSchema.safeParse({
      ...base,
      storage_path: `${uuid}/${uuid2}/12345678-1234-4abc-8abc-1234567890ef.jpg`,
      size_bytes: 30 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative size", () => {
    const result = createMediaSchema.safeParse({
      ...base,
      storage_path: `${uuid}/${uuid2}/12345678-1234-4abc-8abc-1234567890ef.jpg`,
      size_bytes: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("grantMembershipSchema", () => {
  it("rejects an invalid role", () => {
    expect(
      grantMembershipSchema.safeParse({ user_id: uuid, church_id: uuid2, role: "admin" }).success,
    ).toBe(false);
  });

  it("accepts the three church roles", () => {
    for (const role of ["editor", "historical_reviewer", "church_approver"]) {
      expect(
        grantMembershipSchema.safeParse({ user_id: uuid, church_id: uuid2, role }).success,
      ).toBe(true);
    }
  });
});

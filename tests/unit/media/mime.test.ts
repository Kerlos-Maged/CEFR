import { describe, expect, it } from "vitest";

import {
  canPublishMedia,
  fileExtension,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  mimeTypeForExtension,
  sniffMimeType,
  validateMediaUpload,
} from "@/lib/media/mime";

function header(head: number[], size = 16): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(head);
  return bytes;
}

const JPEG = header([0xff, 0xd8, 0xff, 0xe0]);
const PNG = header([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = header([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const M4A = header([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);
const MP3_ID3 = header([0x49, 0x44, 0x33]);
const MP3_FRAME = header([0xff, 0xfb]);
const AAC_ADTS = header([0xff, 0xf1]);

describe("sniffMimeType", () => {
  it("detects supported image signatures", () => {
    expect(sniffMimeType(JPEG)).toBe("image/jpeg");
    expect(sniffMimeType(PNG)).toBe("image/png");
    expect(sniffMimeType(WEBP)).toBe("image/webp");
  });

  it("detects supported audio signatures", () => {
    expect(sniffMimeType(M4A)).toBe("audio/mp4");
    expect(sniffMimeType(MP3_ID3)).toBe("audio/mpeg");
    expect(sniffMimeType(MP3_FRAME)).toBe("audio/mpeg");
    expect(sniffMimeType(AAC_ADTS)).toBe("audio/aac");
  });

  it("returns null for unknown or too-short content", () => {
    expect(sniffMimeType(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(sniffMimeType(header([0x25, 0x50, 0x44, 0x46]))).toBeNull();
  });
});

describe("extension helpers", () => {
  it("extracts and normalizes extensions", () => {
    expect(fileExtension("photo.JPG")).toBe("jpg");
    expect(fileExtension("no-extension")).toBe("");
  });

  it("maps extensions to MIME types", () => {
    expect(mimeTypeForExtension(".jpeg")).toBe("image/jpeg");
    expect(mimeTypeForExtension("m4a")).toBe("audio/mp4");
    expect(mimeTypeForExtension("gif")).toBeNull();
  });
});

describe("validateMediaUpload", () => {
  it("accepts a valid image whose bytes match", () => {
    expect(
      validateMediaUpload({
        filename: "icon.jpg",
        declaredMimeType: "image/jpeg",
        sizeBytes: 1024,
        bytes: JPEG,
      }),
    ).toEqual({ ok: true, kind: "image", mimeType: "image/jpeg", extension: "jpg" });
  });

  it("accepts a valid audio upload", () => {
    expect(
      validateMediaUpload({
        filename: "narration.mp3",
        declaredMimeType: "audio/mpeg",
        sizeBytes: 2048,
        bytes: MP3_ID3,
      }),
    ).toEqual({ ok: true, kind: "audio", mimeType: "audio/mpeg", extension: "mp3" });
  });

  it("rejects empty uploads", () => {
    expect(
      validateMediaUpload({ filename: "icon.jpg", declaredMimeType: "image/jpeg", sizeBytes: 0 }),
    ).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects unsupported declared types", () => {
    expect(
      validateMediaUpload({
        filename: "icon.gif",
        declaredMimeType: "image/gif",
        sizeBytes: 100,
      }),
    ).toEqual({ ok: false, reason: "unsupported_type" });
  });

  it("rejects files over the per-kind limit", () => {
    expect(
      validateMediaUpload({
        filename: "icon.jpg",
        declaredMimeType: "image/jpeg",
        sizeBytes: MAX_IMAGE_BYTES + 1,
      }),
    ).toEqual({ ok: false, reason: "too_large" });

    expect(
      validateMediaUpload({
        filename: "narration.mp3",
        declaredMimeType: "audio/mpeg",
        sizeBytes: MAX_AUDIO_BYTES + 1,
      }),
    ).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects an extension that contradicts the declared type", () => {
    expect(
      validateMediaUpload({
        filename: "icon.png",
        declaredMimeType: "image/jpeg",
        sizeBytes: 100,
      }),
    ).toEqual({ ok: false, reason: "extension_mismatch" });
  });

  it("rejects bytes that contradict the declared type", () => {
    expect(
      validateMediaUpload({
        filename: "icon.png",
        declaredMimeType: "image/png",
        sizeBytes: 100,
        bytes: JPEG,
      }),
    ).toEqual({ ok: false, reason: "content_mismatch" });
  });
});

describe("canPublishMedia", () => {
  it("requires granted or public-domain rights", () => {
    expect(
      canPublishMedia({ kind: "image", permissionStatus: "pending", altText: "Icon" }),
    ).toEqual({ ok: false, reason: "permission_required" });
    expect(
      canPublishMedia({ kind: "image", permissionStatus: "restricted", altText: "Icon" }),
    ).toEqual({ ok: false, reason: "permission_required" });
  });

  it("requires alt text for public images", () => {
    expect(canPublishMedia({ kind: "image", permissionStatus: "granted" })).toEqual({
      ok: false,
      reason: "missing_alt_text",
    });
    expect(canPublishMedia({ kind: "image", permissionStatus: "granted", altText: "   " })).toEqual(
      { ok: false, reason: "missing_alt_text" },
    );
  });

  it("accepts permitted media with alt text", () => {
    expect(
      canPublishMedia({ kind: "image", permissionStatus: "public_domain", altText: "An icon" }),
    ).toEqual({ ok: true });
    expect(canPublishMedia({ kind: "audio", permissionStatus: "granted" })).toEqual({ ok: true });
  });
});

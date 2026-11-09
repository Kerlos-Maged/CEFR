/**
 * Server-side media upload validation (FR-MD-2/3, security-and-permissions.md §6).
 * Nothing here trusts a browser-provided content type: `validateMediaUpload` can verify the
 * declared type against the file's magic bytes.
 */
export type MediaKind = "image" | "audio";

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AUDIO_MIME_TYPES = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac"] as const;

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];
export type AudioMimeType = (typeof AUDIO_MIME_TYPES)[number];
export type AllowedMimeType = ImageMimeType | AudioMimeType;

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const MIME_TO_EXTENSION: Record<AllowedMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
};

const EXTENSION_TO_MIME: Record<string, AllowedMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
};

const PERMITTED_FOR_PUBLICATION = ["granted", "public_domain"];

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return value in MIME_TO_EXTENSION;
}

export function kindForMimeType(value: string): MediaKind | null {
  if (!isAllowedMimeType(value)) return null;
  return value.startsWith("image/") ? "image" : "audio";
}

export function extensionForMimeType(value: string): string | null {
  return isAllowedMimeType(value) ? MIME_TO_EXTENSION[value] : null;
}

export function mimeTypeForExtension(extension: string): AllowedMimeType | null {
  return EXTENSION_TO_MIME[extension.toLowerCase().replace(/^\./, "")] ?? null;
}

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = start; i < start + length && i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const MP4_BRANDS = new Set(["M4A ", "M4B ", "M4P ", "mp42", "mp41", "isom", "iso2", "qt  "]);

/**
 * Detects the real media type from a file header. Returns `null` when the signature is unknown
 * or the buffer is too short, so callers can reject unverifiable uploads.
 */
export function sniffMimeType(bytes: Uint8Array): AllowedMimeType | null {
  if (bytes.length < 12) return null;

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";

  if (ascii(bytes, 4, 4) === "ftyp" && MP4_BRANDS.has(ascii(bytes, 8, 4))) return "audio/mp4";
  if (ascii(bytes, 0, 3) === "ID3") return "audio/mpeg";
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return "audio/aac";
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";

  return null;
}

export interface MediaUploadDescriptor {
  filename: string;
  declaredMimeType: string;
  sizeBytes: number;
  bytes?: Uint8Array;
}

export type UploadRejectionReason =
  "empty" | "too_large" | "unsupported_type" | "extension_mismatch" | "content_mismatch";

export type UploadValidation =
  | { ok: true; kind: MediaKind; mimeType: AllowedMimeType; extension: string }
  | { ok: false; reason: UploadRejectionReason };

export function validateMediaUpload(descriptor: MediaUploadDescriptor): UploadValidation {
  const { filename, declaredMimeType, sizeBytes, bytes } = descriptor;

  if (sizeBytes <= 0) return { ok: false, reason: "empty" };

  const kind = kindForMimeType(declaredMimeType);
  if (!kind) return { ok: false, reason: "unsupported_type" };

  const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  if (sizeBytes > limit) return { ok: false, reason: "too_large" };

  const extension = extensionForMimeType(declaredMimeType);
  if (!extension) return { ok: false, reason: "unsupported_type" };

  const declaredExtension = fileExtension(filename);
  const expectedFromExtension = mimeTypeForExtension(declaredExtension);
  if (declaredExtension && expectedFromExtension !== declaredMimeType) {
    const sameExtension = extensionForMimeType(expectedFromExtension ?? "") === extension;
    if (!sameExtension) return { ok: false, reason: "extension_mismatch" };
  }

  if (bytes) {
    const sniffed = sniffMimeType(bytes);
    if (!sniffed) return { ok: false, reason: "content_mismatch" };
    const compatible =
      sniffed === declaredMimeType ||
      (kind === "audio" && sniffed === "audio/mp4" && declaredMimeType === "audio/x-m4a");
    if (!compatible) return { ok: false, reason: "content_mismatch" };
  }

  return { ok: true, kind, mimeType: declaredMimeType as AllowedMimeType, extension };
}

export interface PublicationGateInput {
  kind: MediaKind;
  permissionStatus: string;
  altText?: string | null;
}

export type PublicationGate =
  { ok: true } | { ok: false; reason: "permission_required" | "missing_alt_text" };

/** Mirrors the `media` publication gate: permitted rights, and alt text for public images. */
export function canPublishMedia({
  kind,
  permissionStatus,
  altText,
}: PublicationGateInput): PublicationGate {
  if (!PERMITTED_FOR_PUBLICATION.includes(permissionStatus)) {
    return { ok: false, reason: "permission_required" };
  }
  if (kind === "image" && (!altText || altText.trim() === "")) {
    return { ok: false, reason: "missing_alt_text" };
  }
  return { ok: true };
}

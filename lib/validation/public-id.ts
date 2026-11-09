/**
 * Canonical public identifier format for heritage objects (FR-QR-2 / ADR-003).
 *
 * A `publicId` is an opaque, URL-safe value embedded in each object's permanent
 * QR URL (`/o/{publicId}`). It is generated once and never changes.
 *
 * Format: 10 characters of Crockford Base32 (uppercase), excluding the
 * ambiguous letters I, L, O and U. This mirrors the database constraint on
 * `objects.public_id` (`char(10)`, `^[0-9A-HJKMNP-TV-Z]{10}$`).
 */
export const PUBLIC_ID_LENGTH = 10;

export const PUBLIC_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{10}$/;

export function isValidPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}

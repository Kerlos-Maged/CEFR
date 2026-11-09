import { PUBLIC_ID_LENGTH } from "./public-id";

/**
 * Crockford Base32 alphabet (excludes I, L, O, U to avoid visual ambiguity). Matches the
 * database check constraint on `objects.public_id` (`^[0-9A-HJKMNP-TV-Z]{10}$`).
 */
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Generates a random, opaque `publicId`. Uniqueness is enforced by the database
 * (`objects_public_id_key`); callers must retry on a unique-violation rather than assume
 * collision-freedom. Uses `crypto.getRandomValues` (available in Node and the browser).
 */
export function generatePublicId(): string {
  const bytes = new Uint8Array(PUBLIC_ID_LENGTH * 2);
  crypto.getRandomValues(bytes);

  let id = "";
  for (let i = 0; i < PUBLIC_ID_LENGTH; i += 1) {
    // Combine two bytes for a wider range, then reduce modulo the 32-char alphabet.
    const value = (bytes[i * 2] * 256 + bytes[i * 2 + 1]) % CROCKFORD_ALPHABET.length;
    id += CROCKFORD_ALPHABET[value];
  }
  return id;
}

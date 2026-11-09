/**
 * Accepts only same-origin, root-relative paths. Rejects absolute URLs, protocol-relative
 * `//evil.com`, backslash tricks, and control characters.
 */
export function sanitizeNextPath(value: string | null): string {
  if (!value) return "/admin";
  if (!value.startsWith("/")) return "/admin";
  if (value.startsWith("//")) return "/admin";
  if (value.includes("\\")) return "/admin";
  if (/[\u0000-\u001f]/.test(value)) return "/admin";
  return value;
}

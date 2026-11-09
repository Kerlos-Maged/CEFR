import { updateTag } from "next/cache";

/** Invalidate public content after a write performed by a Server Action. */
export function invalidatePublicContent(input: {
  publicId?: string | null;
  churchId?: string | null;
}) {
  updateTag("objects");
  updateTag("churches");
  if (input.publicId) updateTag(`object:${input.publicId}`);
  if (input.churchId) updateTag(`church:${input.churchId}`);
}

import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth/session";
import { renderQrPng, renderQrSvg, type QrFormat } from "@/lib/qr";
import { isValidPublicId } from "@/lib/validation/public-id";

/**
 * `GET /api/qr/[publicId]?format=svg|png&download=1`
 *
 * Authorized export of an object's permanent QR code (api-contracts.md §8.2). Access is granted to
 * a platform admin or a member of the object's church holding `editor` or `church_approver`.
 * Only **published** objects are eligible, so the endpoint never confirms the existence of drafts
 * to unauthorized callers (unpublished/unknown ids both return 404).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  if (!isValidPublicId(publicId)) {
    return errorResponse("NOT_FOUND", "Not found", 404);
  }

  const session = await getSession();
  if (!session) {
    return errorResponse("UNAUTHENTICATED", "Sign in required", 401);
  }

  const { data: object, error } = await session.client
    .from("objects")
    .select("id, church_id, status, public_id")
    .eq("public_id", publicId)
    .maybeSingle();

  if (error || !object || object.status !== "published") {
    return errorResponse("NOT_FOUND", "Not found", 404);
  }

  const authorized =
    session.user.isPlatformAdmin ||
    session.memberships.some(
      (membership) =>
        membership.churchId === object.church_id &&
        (membership.role === "editor" || membership.role === "church_approver"),
    );
  if (!authorized) {
    return errorResponse("FORBIDDEN", "Not permitted", 403);
  }

  const format: QrFormat = request.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
  const download = request.nextUrl.searchParams.get("download") === "1";

  try {
    if (format === "png") {
      const buffer = await renderQrPng(publicId);
      if (!buffer) return errorResponse("NOT_FOUND", "Not found", 404);
      const headers = new Headers({ "content-type": "image/png", "cache-control": "no-store" });
      if (download) headers.set("content-disposition", `attachment; filename="qr-${publicId}.png"`);
      return new NextResponse(new Uint8Array(buffer), { headers });
    }

    const svg = await renderQrSvg(publicId);
    if (!svg) return errorResponse("NOT_FOUND", "Not found", 404);
    const headers = new Headers({
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store",
    });
    if (download) headers.set("content-disposition", `attachment; filename="qr-${publicId}.svg"`);
    return new NextResponse(svg, { headers });
  } catch (cause) {
    // Never surface internal messages to the client; log a non-sensitive marker server-side.
    console.error(
      "[api:qr] render failed",
      cause instanceof Error ? cause.message : "unknown error",
    );
    return errorResponse("INTERNAL", "Failed to render QR code", 500);
  }
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

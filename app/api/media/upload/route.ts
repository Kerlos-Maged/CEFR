import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { canEditObjectContent, requireSession } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import { mapDatabaseError } from "@/lib/actions/result";
import { createServerSessionClient } from "@/lib/db/client";
import { MAX_AUDIO_BYTES, validateMediaUpload } from "@/lib/media/mime";
import { extractMediaMetadata } from "@/lib/media/metadata";

export const maxDuration = 60;

/** Authenticated multipart upload; validate bytes before staging, promote, and register metadata. */
export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length"));
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
      return NextResponse.json({ error: "A valid content length is required." }, { status: 411 });
    }
    if (contentLength > MAX_AUDIO_BYTES + 128 * 1024) {
      return NextResponse.json({ error: "Upload exceeds the 25 MB limit." }, { status: 413 });
    }
    const session = requireSession(await getSession());
    const form = await request.formData();
    const file = form.get("file");
    const objectId = String(form.get("object_id") ?? "");
    if (!(file instanceof File) || !/^[0-9a-f-]{36}$/i.test(objectId)) {
      return NextResponse.json({ error: "Choose a valid file and object." }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateMediaUpload({
      filename: file.name,
      declaredMimeType: file.type,
      sizeBytes: bytes.length,
      bytes,
    });
    if (!validation.ok)
      return NextResponse.json(
        { error: `Upload rejected: ${validation.reason}.` },
        { status: 400 },
      );

    const db = await createServerSessionClient();
    const { data: object, error: readError } = await db
      .from("objects")
      .select("church_id,status")
      .eq("id", objectId)
      .maybeSingle();
    if (readError) throw mapDatabaseError(readError, "Could not load the object.");
    if (!object) return NextResponse.json({ error: "Object not found." }, { status: 404 });
    if (!canEditObjectContent(session, object.church_id, object.status)) {
      return NextResponse.json(
        { error: "You cannot upload media to this object." },
        { status: 403 },
      );
    }

    const path = `${object.church_id}/${objectId}/${randomUUID()}.${validation.extension}`;
    const staged = await db.storage
      .from("incoming")
      .upload(path, bytes, { contentType: validation.mimeType, upsert: false });
    if (staged.error) throw staged.error;
    let registered = false;
    try {
      const downloaded = await db.storage.from("incoming").download(path);
      if (downloaded.error) throw downloaded.error;
      const verifiedBytes = new Uint8Array(await downloaded.data.arrayBuffer());
      const verified = validateMediaUpload({
        filename: file.name,
        declaredMimeType: validation.mimeType,
        sizeBytes: verifiedBytes.length,
        bytes: verifiedBytes,
      });
      if (!verified.ok) throw new Error("Staged file verification failed.");
      const metadata = extractMediaMetadata(verifiedBytes, validation.mimeType);
      const { data: media, error } = await db
        .from("media")
        .insert({
          object_id: objectId,
          media_type: validation.kind,
          storage_path: path,
          bucket: "incoming",
          mime_type: validation.mimeType,
          size_bytes: verifiedBytes.length,
          checksum: createHash("sha256").update(verifiedBytes).digest("hex"),
          width: metadata.width,
          height: metadata.height,
          duration_seconds: metadata.durationSeconds,
          permission_status: "pending",
          is_public: false,
          created_by: session.user.id,
        })
        .select("id")
        .single();
      if (error) {
        throw mapDatabaseError(error, "Could not register the uploaded media.");
      }
      registered = true;
      return NextResponse.json({ id: media.id }, { status: 201 });
    } finally {
      if (!registered) await db.storage.from("incoming").remove([path]);
    }
  } catch (error) {
    console.error("[media-upload]", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { error: "Upload failed. Check your access and try again." },
      { status: 500 },
    );
  }
}

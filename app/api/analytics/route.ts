import { createHmac } from "node:crypto";
import { z } from "zod";

import { createAnonClient, createServiceRoleClient, isSupabaseConfigured } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env.server";
import { isValidPublicId } from "@/lib/validation/public-id";
import { consumeAnalyticsQuota } from "@/lib/analytics/rate-limit";

const requestSchema = z.strictObject({
  event_type: z.enum(["page_view", "language_select", "audio_play", "audio_complete"]),
  public_id: z.string().refine(isValidPublicId, "Invalid public id.").optional(),
  language_code: z
    .string()
    .regex(/^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/)
    .optional(),
  referrer_type: z.enum(["qr", "direct", "internal", "external"]).optional(),
  session_id: z.uuid().optional(),
});

function jsonError(code: string, status: number): Response {
  return Response.json({ error: { code } }, { status, headers: { "Cache-Control": "no-store" } });
}

function monthlySessionHash(sessionId: string | undefined, salt: string): string | null {
  if (!sessionId) return null;
  const month = new Date().toISOString().slice(0, 7);
  return createHmac("sha256", salt).update(`${month}:${sessionId}`).digest("hex");
}

function transientAddressHash(request: Request, salt: string): string | null {
  const address =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  if (!address) return null;
  return createHmac("sha256", salt).update(`rate-limit:${address}`).digest("hex");
}

function privacyOptOut(request: Request): boolean {
  const dnt = request.headers.get("dnt");
  const gpc = request.headers.get("sec-gpc");
  return dnt === "1" || gpc === "1" || gpc?.toLowerCase() === "true";
}

export async function POST(request: Request): Promise<Response> {
  if (privacyOptOut(request)) return new Response(null, { status: 204 });

  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > 2_048) return jsonError("VALIDATION", 400);

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return jsonError("VALIDATION", 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > 2_048) return jsonError("VALIDATION", 400);

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonError("VALIDATION", 400);
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) return jsonError("VALIDATION", 400);
  if (!isSupabaseConfigured()) return new Response(null, { status: 204 });

  try {
    const { ANALYTICS_HASH_SALT: salt } = getServerEnv();
    if (!salt) return new Response(null, { status: 204 });

    const event = parsed.data;
    const sessionHash = monthlySessionHash(event.session_id, salt);
    const addressHash = transientAddressHash(request, salt);
    const rateHash = addressHash ?? sessionHash ?? "anonymous";
    if (!consumeAnalyticsQuota(`address:${rateHash}`, 300)) {
      return new Response(null, {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "60" },
      });
    }
    if (sessionHash && !consumeAnalyticsQuota(`session:${sessionHash}`, 90)) {
      return new Response(null, {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "60" },
      });
    }

    const anonClient = createAnonClient();
    let objectId: string | null = null;
    let churchId: string | null = null;
    if (event.public_id) {
      const { data: resolutions, error: resolveError } = await anonClient.rpc("resolve_public_id", {
        p_public_id: event.public_id,
      });
      if (resolveError) throw resolveError;
      const resolution = resolutions?.[0];
      if (!resolution || resolution.status !== "published")
        return new Response(null, { status: 204 });

      const { data: object, error: objectError } = await anonClient
        .from("objects")
        .select("id, church_id")
        .eq("id", resolution.object_id)
        .eq("status", "published")
        .maybeSingle();
      if (objectError) throw objectError;
      if (!object) return new Response(null, { status: 204 });
      objectId = object.id;
      churchId = object.church_id;
    }

    const { error: insertError } = await createServiceRoleClient()
      .from("analytics_events")
      .insert({
        event_type: event.event_type,
        object_id: objectId,
        church_id: churchId,
        language_code: event.language_code ?? null,
        session_hash: sessionHash,
        referrer_type: event.referrer_type ?? null,
      });
    if (insertError) throw insertError;

    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Analytics failures must never affect the visitor's page or leak database details.
    console.error("Analytics event could not be recorded.");
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
}

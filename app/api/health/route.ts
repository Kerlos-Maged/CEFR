import { NextResponse } from "next/server";

import { createAnonClient, isSupabaseConfigured } from "@/lib/db/client";

/** Readiness probe for uptime monitors; reports no internal URLs, schema, or credentials. */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return response("not_ready", "database_not_configured", 503);
  }

  try {
    const { error } = await createAnonClient().from("languages").select("code").limit(1);
    if (error) return response("not_ready", "database_unavailable", 503);
    return response("ready", "ok", 200);
  } catch {
    return response("not_ready", "database_unavailable", 503);
  }
}

function response(status: "ready" | "not_ready", check: string, code: number) {
  return NextResponse.json(
    { status, check, timestamp: new Date().toISOString() },
    { status: code, headers: { "cache-control": "no-store" } },
  );
}

import { createHash, timingSafeEqual } from "node:crypto";

import { createServiceRoleClient } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env.server";

function authorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedHash = createHash("sha256").update(secret).digest();
  const actualHash = createHash("sha256").update(bearer).digest();
  return timingSafeEqual(expectedHash, actualHash);
}

async function runRetention(request: Request): Promise<Response> {
  const { ANALYTICS_RETENTION_CRON_SECRET: secret } = getServerEnv();
  if (!secret) return Response.json({ error: "Not configured" }, { status: 503 });
  if (!authorized(request, secret))
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data, error } = await createServiceRoleClient().rpc("aggregate_and_purge_analytics");
    if (error) throw error;
    return Response.json(data ?? { aggregated_events: 0, purged_events: 0 }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("Analytics retention job failed.");
    return Response.json({ error: "Retention job failed" }, { status: 500 });
  }
}

export const GET = runRetention;
export const POST = runRetention;

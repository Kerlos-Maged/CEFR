import { z } from "zod";

/**
 * Server-only environment variables.
 *
 * This module MUST NOT be imported by client components. `getServerEnv()` throws
 * if it is ever evaluated in the browser, and none of these values carry the
 * `NEXT_PUBLIC_` prefix, so they are never inlined into the client bundle.
 *
 * Values are optional for the Phase 2 skeleton. From Phase 3 onward, whichever
 * server credentials a feature requires become required checks here.
 */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const optionalSecret = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  ANALYTICS_HASH_SALT: optionalSecret,
  ANALYTICS_RETENTION_CRON_SECRET: optionalSecret,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "getServerEnv() must never be called from the browser; server-only secrets are not available client-side.",
    );
  }

  cached ??= serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANALYTICS_HASH_SALT: process.env.ANALYTICS_HASH_SALT,
    ANALYTICS_RETENTION_CRON_SECRET: process.env.ANALYTICS_RETENTION_CRON_SECRET,
  });

  return cached;
}

if (typeof process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY !== "undefined") {
  throw new Error("Privileged credentials must not be exposed through NEXT_PUBLIC_ variables.");
}

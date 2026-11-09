import { z } from "zod";

/**
 * Browser-safe environment variables.
 *
 * Every value here is prefixed with `NEXT_PUBLIC_` and is therefore embedded in
 * the client bundle. Never add secrets to this module. Server-only secrets live
 * in `lib/env.server.ts`.
 *
 * Values are optional for the Phase 2 skeleton (no database/auth features yet).
 * From Phase 3 onward, Supabase variables become required.
 */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());
const optionalNonEmpty = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmpty,
  NEXT_PUBLIC_SITE_URL: optionalUrl,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export const publicEnv: PublicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";

import type { Database } from "./database.types";
import { DalError } from "./errors";

export type DatabaseClient = SupabaseClient<Database>;

/**
 * True when the public Supabase environment is configured. Public pages use this to render a
 * neutral "temporarily unavailable" state instead of throwing during build/local preview.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Server-side Supabase client using the public anon key. Safe to run on the server for
 * public reads; Row Level Security restricts it to published, publicly-visible rows.
 * No session is persisted (Phase 3 is read-only public access + service-role writes).
 */
export function createAnonClient(): DatabaseClient {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new DalError(
      "INTERNAL",
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }

  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function requireSupabaseConfig(): { url: string; anonKey: string } {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new DalError(
      "INTERNAL",
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }

  return { url, anonKey };
}

/**
 * Request-scoped Supabase client that reads and writes the auth session from Next.js
 * HTTP-only cookies. Use this for authenticated server rendering and server actions so RLS
 * runs with the signed-in user (`auth.uid()`). Must only be used on the server.
 */
export async function createServerSessionClient(): Promise<DatabaseClient> {
  const { url, anonKey } = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Server-only client using the service-role key. This bypasses RLS and MUST never be
 * imported into client components. Used for trusted writes (e.g. analytics ingest).
 */
export function createServiceRoleClient(): DatabaseClient {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new DalError(
      "INTERNAL",
      "Service-role Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Builds the public CDN URL for an object stored in a public storage bucket, or `null`
 * when Supabase is not configured. Paths are non-guessable UUIDs (see security doc §6).
 */
export function publicStorageUrl(bucket: string, storagePath: string): string | null {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  const base = url.replace(/\/$/, "");
  const path = storagePath.replace(/^\//, "");
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

import { cache } from "react";

import { createServerSessionClient, type DatabaseClient } from "@/lib/db/client";
import { isSupabaseConfigured } from "@/lib/db/client";

/**
 * Server-verified authentication state. `getUser()` always calls the Supabase Auth server so a
 * forged or expired cookie cannot grant access (the JWT is validated remotely, not trusted
 * blindly). Everything downstream derives identity from this module only — never from a value
 * the browser supplies.
 */
export interface SessionUser {
  id: string;
  email: string | null;
  displayName: string | null;
  isPlatformAdmin: boolean;
}

export type MembershipRole = "editor" | "historical_reviewer" | "church_approver";

export interface Membership {
  churchId: string;
  role: MembershipRole;
}

export interface Session {
  user: SessionUser;
  memberships: Membership[];
  client: DatabaseClient;
}

/**
 * Loads the current session (verified user + their church memberships). Memoized per request so
 * layout/page/action code can call it freely without re-hitting the auth server.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured()) return null;

  const client = await createServerSessionClient();
  const { data, error } = await client.auth.getUser();
  const authUser = data?.user;
  if (error || !authUser) return null;

  const [profileResult, membershipResult] = await Promise.all([
    client
      .from("profiles")
      .select("display_name, is_platform_admin")
      .eq("id", authUser.id)
      .maybeSingle(),
    client.from("church_memberships").select("church_id, role").eq("user_id", authUser.id),
  ]);

  const memberships: Membership[] = (membershipResult.data ?? []).map((row) => ({
    churchId: row.church_id,
    role: row.role as MembershipRole,
  }));

  return {
    client,
    memberships,
    user: {
      id: authUser.id,
      email: authUser.email ?? null,
      displayName: profileResult.data?.display_name ?? null,
      isPlatformAdmin: profileResult.data?.is_platform_admin ?? false,
    },
  };
});

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

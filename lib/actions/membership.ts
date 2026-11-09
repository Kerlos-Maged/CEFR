"use server";

import { revalidatePath } from "next/cache";

import { mapDatabaseError, runAction } from "@/lib/actions/result";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/client";
import { publicEnv } from "@/lib/env";
import { DalError } from "@/lib/db/errors";
import {
  grantMembershipSchema,
  inviteUserSchema,
  setPlatformAdminSchema,
  type InviteUserInput,
} from "@/lib/validation/object";

import type { ActionResult } from "@/lib/actions/result";
import type { GrantMembershipInput, SetPlatformAdminInput } from "@/lib/validation/object";

/**
 * Church and user administration. Every action here requires a **platform admin** session and is
 * additionally enforced by platform-admin-only RLS policies on `church_memberships` and
 * `profiles`. A user cannot grant themselves a role because the browser never controls
 * `is_platform_admin` and only admins may write memberships.
 */

export const CHURCH_ROLES = ["editor", "historical_reviewer", "church_approver"] as const;

export async function inviteUser(
  input: InviteUserInput,
): Promise<ActionResult<{ userId: string }>> {
  return runAction(async () => {
    const parsed = inviteUserSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Enter a valid email and display name.");
    const session = requirePlatformAdmin(await getSession());
    const adminClient = createServiceRoleClient();
    const redirectTo = publicEnv.NEXT_PUBLIC_SITE_URL
      ? `${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent("/en/admin")}`
      : undefined;
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { display_name: parsed.data.display_name },
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (error)
      throw new DalError(
        "INTERNAL",
        "Could not send the invitation. Check the auth email configuration.",
      );
    if (!data.user) throw new DalError("INTERNAL", "The invitation did not create a user record.");

    const { error: auditError } = await adminClient.from("admin_audit_log").insert({
      actor_id: session.user.id,
      action: "user_invited",
      entity_type: "user",
      entity_id: data.user.id,
      details: {},
    });
    if (auditError) console.error("User invitation audit record could not be written.");

    revalidatePath("/admin/users");
    return { userId: data.user.id };
  }, "inviteUser");
}

export async function grantMembership(
  input: GrantMembershipInput,
): Promise<ActionResult<{ membershipId: string }>> {
  return runAction(async () => {
    const parsed = grantMembershipSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Invalid membership request.");
    const data = parsed.data;

    const session = requirePlatformAdmin(await getSession());

    const { data: created, error } = await session.client
      .from("church_memberships")
      .upsert(
        { user_id: data.user_id, church_id: data.church_id, role: data.role },
        { onConflict: "church_id,user_id,role" },
      )
      .select("id")
      .single();
    if (error) throw mapDatabaseError(error, "Failed to grant the membership.");

    revalidatePath("/admin/users");
    revalidatePath(`/admin/churches/${data.church_id}`);
    return { membershipId: created.id };
  }, "grantMembership");
}

export async function revokeMembership(
  membershipId: string,
): Promise<ActionResult<{ membershipId: string }>> {
  return runAction(async () => {
    const session = requirePlatformAdmin(await getSession());
    const { data: revoked, error } = await session.client
      .from("church_memberships")
      .delete()
      .eq("id", membershipId)
      .select("id")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "Failed to revoke the membership.");
    if (!revoked) throw new DalError("NOT_FOUND", "Membership not found.");

    revalidatePath("/admin/users");
    return { membershipId };
  }, "revokeMembership");
}

export async function setPlatformAdmin(
  input: SetPlatformAdminInput,
): Promise<ActionResult<{ userId: string }>> {
  return runAction(async () => {
    const parsed = setPlatformAdminSchema.safeParse(input);
    if (!parsed.success) throw new DalError("VALIDATION", "Invalid request.");
    const data = parsed.data;

    const session = requirePlatformAdmin(await getSession());

    // Guard against an admin locking everyone out by demoting themselves as the last admin.
    if (!data.value && data.user_id === session.user.id) {
      const { count } = await session.client
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_platform_admin", true);
      if ((count ?? 0) <= 1) {
        throw new DalError("CONFLICT", "You cannot remove the last platform administrator.");
      }
    }

    const { data: updated, error } = await session.client
      .from("profiles")
      .update({ is_platform_admin: data.value })
      .eq("id", data.user_id)
      .select("id")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "Failed to update the administrator flag.");
    if (!updated) throw new DalError("NOT_FOUND", "User profile not found.");

    revalidatePath("/admin/users");
    return { userId: data.user_id };
  }, "setPlatformAdmin");
}

import { DalError } from "@/lib/db/errors";

import type { Membership, MembershipRole, Session } from "./session";

/**
 * Authorization rules that mirror the database RLS policies (docs/architecture/
 * security-and-permissions.md §3, §5). These provide clear UX and fail fast, but they are
 * **not** the security boundary — every mutation is still enforced by RLS and the workflow
 * functions. Nothing here trusts browser-supplied role or church values.
 */

export function isPlatformAdmin(session: Session): boolean {
  return session.user.isPlatformAdmin;
}

export function hasRoleInChurch(session: Session, churchId: string, role: MembershipRole): boolean {
  return session.memberships.some(
    (membership) => membership.churchId === churchId && membership.role === role,
  );
}

export function isMemberOfChurch(session: Session, churchId: string): boolean {
  return session.memberships.some((membership) => membership.churchId === churchId);
}

/** Objects are editable only while `draft`, and only by an editor of the owning church. */
export function canEditObjectContent(session: Session, churchId: string, status: string): boolean {
  if (isPlatformAdmin(session)) return true;
  return status === "draft" && hasRoleInChurch(session, churchId, "editor");
}

export function editableChurches(session: Session): Membership[] {
  return session.memberships.filter((membership) => membership.role === "editor");
}

/** Throws `UNAUTHENTICATED` when there is no verified session. */
export function requireSession(session: Session | null): Session {
  if (!session) {
    throw new DalError("UNAUTHENTICATED", "You must sign in to continue.");
  }
  return session;
}

/** Throws `FORBIDDEN` unless the session is a platform administrator. */
export function requirePlatformAdmin(session: Session | null): Session {
  const current = requireSession(session);
  if (!isPlatformAdmin(current)) {
    throw new DalError("FORBIDDEN", "Platform administrator access is required.");
  }
  return current;
}

export function requireRoleInChurch(
  session: Session | null,
  churchId: string,
  role: MembershipRole,
): Session {
  const current = requireSession(session);
  if (!isPlatformAdmin(current) && !hasRoleInChurch(current, churchId, role)) {
    throw new DalError("FORBIDDEN", `The ${role.replace(/_/g, " ")} role is required.`);
  }
  return current;
}

export function requireAnyChurchRole(session: Session | null): Session {
  const current = requireSession(session);
  if (!isPlatformAdmin(current) && current.memberships.length === 0) {
    throw new DalError("FORBIDDEN", "You do not have access to any church workspace yet.");
  }
  return current;
}

/**
 * Roles a user may act with in the admin UI. Admins act globally; other users act per
 * membership. Returns a de-duplicated role list for navigation/affordance decisions.
 */
export function roleSummary(session: Session): MembershipRole[] {
  if (isPlatformAdmin(session)) {
    return ["editor", "historical_reviewer", "church_approver"];
  }
  const roles = new Set<MembershipRole>();
  for (const membership of session.memberships) roles.add(membership.role);
  return [...roles];
}

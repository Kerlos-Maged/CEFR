"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  inviteUser,
  grantMembership,
  revokeMembership,
  setPlatformAdmin,
} from "@/lib/actions/membership";
import type { AdminChurchSummary, AdminUserSummary } from "@/lib/admin/data";

const ROLES = ["editor", "historical_reviewer", "church_approver"] as const;
type Role = (typeof ROLES)[number];

export function UserManager({
  users,
  churches,
}: {
  users: AdminUserSummary[];
  churches: AdminChurchSummary[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await inviteUser({
      email: value(form, "email"),
      display_name: value(form, "display_name"),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice("Invitation sent. The user will appear after accepting the link.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="border-sand bg-card rounded-lg border p-5">
        <h2 className="text-ink mb-3 text-lg font-semibold">Invite a user</h2>
        <form onSubmit={sendInvite} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-ink-soft flex flex-col gap-1 text-xs font-medium">
            Email address
            <input
              name="email"
              type="email"
              required
              maxLength={320}
              className="border-sand bg-parchment text-ink rounded border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-ink-soft flex flex-col gap-1 text-xs font-medium">
            Display name
            <input
              name="display_name"
              required
              maxLength={200}
              className="border-sand bg-parchment text-ink rounded border px-3 py-2 text-sm"
            />
          </label>
          <button
            disabled={pending}
            className="bg-crimson text-parchment rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send invite"}
          </button>
        </form>
        <Feedback error={error} notice={notice} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-ink text-lg font-semibold">Users and access ({users.length})</h2>
        {users.length === 0 ? (
          <p className="text-ink-muted text-sm">
            No profiles exist yet. Invite the first staff member above.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                churches={churches.filter((church) => church.status === "active")}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function UserCard({ user, churches }: { user: AdminUserSummary; churches: AdminChurchSummary[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function addMembership(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await grantMembership({
      user_id: user.id,
      church_id: value(form, "church_id"),
      role: value(form, "role") as Role,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice("Membership granted.");
    router.refresh();
  }

  async function toggleAdmin() {
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await setPlatformAdmin({ user_id: user.id, value: !user.isPlatformAdmin });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice(
      user.isPlatformAdmin ? "Administrator access removed." : "Administrator access granted.",
    );
    router.refresh();
  }

  async function removeMembership(membershipId: string) {
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await revokeMembership(membershipId);
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice("Membership revoked.");
    router.refresh();
  }

  const churchNames = new Map(churches.map((church) => [church.id, church.name ?? church.slug]));

  return (
    <li className="border-sand bg-card rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-ink font-semibold">{user.displayName ?? "Unnamed user"}</h3>
          <p className="text-ink-muted mt-1 font-mono text-xs">{user.id}</p>
          {user.isPlatformAdmin ? (
            <span className="bg-crimson text-parchment mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold">
              Platform admin
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleAdmin}
          disabled={pending}
          className="border-sand text-crimson rounded border px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {user.isPlatformAdmin ? "Remove platform admin" : "Make platform admin"}
        </button>
      </div>

      {user.memberships.length === 0 ? (
        <p className="text-ink-muted mt-3 text-sm">No church memberships.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {user.memberships.map((membership) => (
            <li
              key={membership.id}
              className="bg-parchment-deep flex flex-wrap items-center justify-between gap-2 rounded px-3 py-2 text-sm"
            >
              <span className="text-ink-soft">
                {churchNames.get(membership.churchId) ?? membership.churchId}:{" "}
                {membership.role.replaceAll("_", " ")}
              </span>
              <button
                type="button"
                onClick={() => removeMembership(membership.id)}
                disabled={pending}
                className="text-crimson text-xs underline disabled:opacity-50"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      {churches.length > 0 ? (
        <form
          onSubmit={addMembership}
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <label className="text-ink-soft flex flex-col gap-1 text-xs font-medium">
            Church
            <select
              name="church_id"
              required
              className="border-sand rounded border px-2 py-2 text-sm"
            >
              {churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name ?? church.slug}
                </option>
              ))}
            </select>
          </label>
          <label className="text-ink-soft flex flex-col gap-1 text-xs font-medium">
            Role
            <select name="role" className="border-sand rounded border px-2 py-2 text-sm">
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={pending}
            className="bg-crimson text-parchment rounded px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Grant role
          </button>
        </form>
      ) : null}
      <Feedback error={error} notice={notice} />
    </li>
  );
}

function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  if (!error && !notice) return null;
  return (
    <p aria-live="polite" className={`mt-3 text-sm ${error ? "text-crimson" : "text-ink-soft"}`}>
      {error ?? notice}
    </p>
  );
}

function value(form: FormData, name: string): string {
  return String(form.get(name) ?? "");
}

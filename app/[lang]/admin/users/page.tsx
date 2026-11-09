import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { UserManager } from "@/components/admin/user-manager";
import { listChurches, listMembershipWorkspace } from "@/lib/admin/data";
import { getSession } from "@/lib/auth/session";
import { normalizeLanguage } from "@/lib/i18n/languages";
import { localizedPath } from "@/lib/i18n/paths";

interface UsersPageProps {
  params: Promise<{ lang: string }>;
}

export default function AdminUsersPage({ params }: UsersPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-ink text-2xl font-semibold">Users and memberships</h1>
      <Suspense fallback={<p className="text-ink-muted text-sm">Loading users…</p>}>
        <UserManagement params={params} />
      </Suspense>
    </div>
  );
}

async function UserManagement({ params }: UsersPageProps) {
  await connection();
  const { lang } = await params;
  const language = normalizeLanguage(lang);
  const session = await getSession();
  if (!session) return null;
  if (!session.user.isPlatformAdmin) redirect(localizedPath(language, "/admin"));

  const [users, churches] = await Promise.all([
    listMembershipWorkspace(session.client),
    listChurches(session.client),
  ]);
  return <UserManager users={users} churches={churches} />;
}

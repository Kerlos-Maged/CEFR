import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdminNav } from "@/components/admin/admin-nav";
import { roleSummary } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/db/client";
import { normalizeLanguage } from "@/lib/i18n/languages";
import { localizedPath } from "@/lib/i18n/paths";

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { lang } = await params;
  const language = normalizeLanguage(lang);

  return (
    <div className="flex w-full flex-col gap-8">
      <Suspense fallback={<AdminLoading />}>
        <AdminShell lang={language}>{children}</AdminShell>
      </Suspense>
    </div>
  );
}

async function AdminShell({ lang, children }: { lang: string; children: React.ReactNode }) {
  // Auth reads depend on the incoming visitor's cookies. When local Supabase is absent,
  // getSession() returns immediately, so explicitly defer the protected subtree to request time.
  await connection();

  if (!isSupabaseConfigured()) {
    redirect(localizedPath(lang, "/login?error=config"));
  }

  const session = await getSession();
  if (!session) {
    redirect(localizedPath(lang, "/login?next=/admin"));
  }

  const isPlatformAdmin = session.user.isPlatformAdmin;
  const hasAnyRole = session.memberships.length > 0;
  if (!isPlatformAdmin && !hasAnyRole) {
    return <NoAccess />;
  }

  return (
    <div className="grid gap-8 md:grid-cols-[200px_1fr]">
      <AdminNav
        lang={lang}
        displayName={session.user.displayName}
        roles={roleSummary(session)}
        isPlatformAdmin={isPlatformAdmin}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AdminLoading() {
  return <p className="text-ink-muted text-sm">Loading administration…</p>;
}

function NoAccess() {
  return (
    <div className="border-sand border-s-crimson bg-card rounded-lg border border-s-4 p-6 shadow-sm">
      <h1 className="text-crimson text-lg font-semibold">No access</h1>
      <p className="text-ink-soft mt-2 text-sm">
        Your account is signed in but has no role on this platform yet. Ask a platform administrator
        to grant you a church role.
      </p>
    </div>
  );
}

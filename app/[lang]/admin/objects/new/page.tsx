import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { NewObjectForm } from "@/components/admin/new-object-form";
import { listChurches } from "@/lib/admin/data";
import { roleSummary } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import { LANGUAGES, normalizeLanguage } from "@/lib/i18n/languages";
import { localizedPath } from "@/lib/i18n/paths";

interface NewObjectPageProps {
  params: Promise<{ lang: string }>;
}

export default function NewObjectPage({ params }: NewObjectPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-ink text-2xl font-semibold">New heritage object</h1>
      <Suspense fallback={<p className="text-ink-muted text-sm">Loading…</p>}>
        <NewObjectContent params={params} />
      </Suspense>
    </div>
  );
}

async function NewObjectContent({ params }: NewObjectPageProps) {
  await connection();
  const { lang } = await params;
  const language = normalizeLanguage(lang);
  const session = await getSession();
  if (!session) return null;

  const canEdit = session.user.isPlatformAdmin || roleSummary(session).includes("editor");
  if (!canEdit) {
    redirect(localizedPath(language, "/admin"));
  }

  const churches = await listChurches(session.client);
  const editable = session.user.isPlatformAdmin
    ? churches
    : churches.filter((church) =>
        session.memberships.some(
          (membership) => membership.churchId === church.id && membership.role === "editor",
        ),
      );

  if (editable.length === 0) {
    return (
      <p className="border-sand bg-card text-ink-soft rounded-lg border p-6 text-sm">
        You do not have an editor role in any church yet.
      </p>
    );
  }

  return (
    <NewObjectForm
      lang={language}
      churches={editable.map((church) => ({
        id: church.id,
        label: church.name ? `${church.name} (${church.slug})` : church.slug,
      }))}
      languages={LANGUAGES.map((entry) => ({ code: entry.code, name: entry.name }))}
    />
  );
}

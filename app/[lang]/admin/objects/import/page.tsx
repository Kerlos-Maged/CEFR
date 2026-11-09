import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ObjectImporter } from "@/components/admin/object-importer";
import { listChurches } from "@/lib/admin/data";
import { getSession } from "@/lib/auth/session";
import { LANGUAGES, normalizeLanguage } from "@/lib/i18n/languages";
import { localizedPath } from "@/lib/i18n/paths";

interface ImportPageProps {
  params: Promise<{ lang: string }>;
}

export default function ImportObjectsPage({ params }: ImportPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-ink text-2xl font-semibold">Import church inventory</h1>
      <Suspense fallback={<p className="text-ink-muted text-sm">Loading…</p>}>
        <ImportContent params={params} />
      </Suspense>
    </div>
  );
}

async function ImportContent({ params }: ImportPageProps) {
  await connection();
  const { lang } = await params;
  const language = normalizeLanguage(lang);
  const session = await getSession();
  if (!session) redirect(localizedPath(language, "/login"));

  const churches = await listChurches(session.client);
  const editable = session.user.isPlatformAdmin
    ? churches
    : churches.filter((church) =>
        session.memberships.some(
          (membership) => membership.churchId === church.id && membership.role === "editor",
        ),
      );

  if (!editable.length) {
    return (
      <p className="border-sand bg-card text-ink-soft rounded-lg border p-6 text-sm">
        You need an editor role in a church to import its inventory.
      </p>
    );
  }

  return (
    <ObjectImporter
      churches={editable.map((church) => ({
        id: church.id,
        name: church.name ? `${church.name} (${church.slug})` : church.slug,
      }))}
      languages={LANGUAGES.map(({ code, name }) => ({ code, name }))}
    />
  );
}

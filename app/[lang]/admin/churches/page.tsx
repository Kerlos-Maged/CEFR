import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ChurchManager } from "@/components/admin/church-manager";
import { listChurches } from "@/lib/admin/data";
import { getSession } from "@/lib/auth/session";
import { normalizeLanguage } from "@/lib/i18n/languages";
import { localizedPath } from "@/lib/i18n/paths";

interface ChurchesPageProps {
  params: Promise<{ lang: string }>;
}

export default function AdminChurchesPage({ params }: ChurchesPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-ink text-2xl font-semibold">Church administration</h1>
      <Suspense fallback={<p className="text-ink-muted text-sm">Loading churches…</p>}>
        <ChurchManagement params={params} />
      </Suspense>
    </div>
  );
}

async function ChurchManagement({ params }: ChurchesPageProps) {
  await connection();
  const { lang } = await params;
  const language = normalizeLanguage(lang);
  const session = await getSession();
  if (!session) return null;
  if (!session.user.isPlatformAdmin) redirect(localizedPath(language, "/admin"));

  const churches = await listChurches(session.client);
  return <ChurchManager churches={churches} lang={language} />;
}

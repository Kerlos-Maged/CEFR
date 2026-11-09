import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { ObjectEditor } from "@/components/admin/object-editor";
import { getObjectForAdmin } from "@/lib/admin/data";
import { getSession } from "@/lib/auth/session";
import { DalError } from "@/lib/db/errors";
import { LANGUAGES, normalizeLanguage } from "@/lib/i18n/languages";
import { localizedPath } from "@/lib/i18n/paths";

interface ObjectEditorPageProps {
  params: Promise<{ lang: string; id: string }>;
}

export default function ObjectEditorPage({ params }: ObjectEditorPageProps) {
  return (
    <Suspense fallback={<p className="text-ink-muted text-sm">Loading object…</p>}>
      <ObjectEditorContent params={params} />
    </Suspense>
  );
}

async function ObjectEditorContent({ params }: ObjectEditorPageProps) {
  await connection();
  const { lang, id } = await params;
  const language = normalizeLanguage(lang);
  const session = await getSession();
  if (!session) return null;

  let object;
  try {
    object = await getObjectForAdmin(session.client, id);
  } catch (error) {
    if (error instanceof DalError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  if (!object) notFound();

  const ownsMembership = session.memberships.some((m) => m.churchId === object.churchId);
  if (!session.user.isPlatformAdmin && !ownsMembership) {
    redirect(localizedPath(language, "/admin"));
  }

  const canEdit =
    session.user.isPlatformAdmin ||
    session.memberships.some((m) => m.churchId === object.churchId && m.role === "editor");
  const isReviewer =
    session.user.isPlatformAdmin ||
    session.memberships.some(
      (m) => m.churchId === object.churchId && m.role === "historical_reviewer",
    );
  const isApprover =
    session.user.isPlatformAdmin ||
    session.memberships.some((m) => m.churchId === object.churchId && m.role === "church_approver");

  return (
    <ObjectEditor
      lang={language}
      object={object}
      canEdit={canEdit}
      isReviewer={isReviewer}
      isApprover={isApprover}
      languages={LANGUAGES.map((entry) => ({ code: entry.code, name: entry.name }))}
    />
  );
}

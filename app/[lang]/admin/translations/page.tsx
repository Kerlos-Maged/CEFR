import Link from "next/link";
import { connection } from "next/server";

import { listObjects } from "@/lib/admin/data";
import { getSession } from "@/lib/auth/session";
import { localizedPath } from "@/lib/i18n/paths";

export default async function TranslationCompletenessPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  await connection();
  const [{ lang }, session] = await Promise.all([params, getSession()]);
  if (!session) return null;
  const [objectResult, languageResult, objects] = await Promise.all([
    session.client
      .from("object_translation_status")
      .select("object_id, language_code, has_row, is_complete"),
    session.client.from("languages").select("code").eq("is_active", true),
    listObjects(session.client),
  ]);
  if (objectResult.error || languageResult.error)
    throw new Error("Could not load translation completeness.");
  const activeCodes = new Set((languageResult.data ?? []).map((language) => language.code));
  const gaps = new Map<string, string[]>();
  for (const row of objectResult.data ?? []) {
    if (!row.object_id || !row.language_code || !activeCodes.has(row.language_code)) continue;
    if (!row.has_row || !row.is_complete) {
      const languages = gaps.get(row.object_id) ?? [];
      languages.push(row.language_code);
      gaps.set(row.object_id, languages);
    }
  }
  const objectById = new Map(objects.map((object) => [object.id, object]));
  const items = [...gaps.entries()]
    .map(([id, languages]) => ({ object: objectById.get(id), languages }))
    .filter((item): item is { object: (typeof objects)[number]; languages: string[] } =>
      Boolean(item.object),
    )
    .sort((a, b) => a.object.title?.localeCompare(b.object.title ?? "") ?? 0);

  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className="text-ink text-2xl font-semibold">Translation completeness</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Objects visible to your account with missing or incomplete active-language translations.
        </p>
      </header>
      {items.length === 0 ? (
        <p className="border-sand bg-card rounded-lg border p-5 text-sm">
          All visible objects have complete translations for active languages.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map(({ object, languages }) => (
            <li
              key={object.id}
              className="border-sand bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
            >
              <div>
                <Link
                  className="text-crimson font-semibold underline"
                  href={localizedPath(lang, `/admin/objects/${object.id}`)}
                >
                  {object.title ?? "(untitled)"}
                </Link>
                <p className="text-ink-muted mt-1 font-mono text-xs">
                  {object.publicId} · {object.status.replaceAll("_", " ")}
                </p>
              </div>
              <p className="text-ink-soft text-sm">Needs: {languages.join(", ")}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

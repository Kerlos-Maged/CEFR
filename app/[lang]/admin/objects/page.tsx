import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import { listObjects } from "@/lib/admin/data";
import { getSession } from "@/lib/auth/session";
import { normalizeLanguage } from "@/lib/i18n/languages";
import { localizedPath } from "@/lib/i18n/paths";

interface ObjectsPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  historical_review: "Historical review",
  church_review: "Church approval",
  published: "Published",
  archived: "Archived",
};

export default function AdminObjectsPage({ params, searchParams }: ObjectsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-ink text-2xl font-semibold">Heritage objects</h1>
        <div className="flex flex-wrap gap-2">
          <Suspense fallback={null}>
            <ImportObjectsLink params={params} />
            <NewObjectLink params={params} />
          </Suspense>
        </div>
      </div>
      <Suspense fallback={<p className="text-ink-muted text-sm">Loading objects…</p>}>
        <ObjectsTable params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewObjectLink({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return (
    <Link
      href={localizedPath(normalizeLanguage(lang), "/admin/objects/new")}
      className="bg-crimson text-parchment hover:bg-crimson-dark rounded-md px-4 py-2 text-sm font-semibold"
    >
      New object
    </Link>
  );
}

async function ImportObjectsLink({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return (
    <Link
      href={localizedPath(normalizeLanguage(lang), "/admin/objects/import")}
      className="border-sand-deep text-ink hover:border-crimson rounded-md border px-4 py-2 text-sm font-semibold"
    >
      Import inventory
    </Link>
  );
}

async function ObjectsTable({ params, searchParams }: ObjectsPageProps) {
  await connection();
  const { lang } = await params;
  const { q = "" } = await searchParams;
  const language = normalizeLanguage(lang);
  const session = await getSession();
  if (!session) return null;

  const objects = await listObjects(session.client, { search: q });

  if (objects.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <ObjectSearch lang={language} query={q} />
        <p className="border-sand bg-card text-ink-soft rounded-lg border p-6 text-sm">
          {q
            ? "No objects match this search."
            : "No heritage objects are visible to your account yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ObjectSearch lang={language} query={q} />
      <div className="border-sand bg-card overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-parchment-deep text-ink-muted text-xs tracking-wide uppercase">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Public ID</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {objects.map((object) => (
              <tr key={object.id} className="border-sand border-t">
                <td className="text-ink px-4 py-3 font-medium">
                  <Link
                    href={localizedPath(language, `/admin/objects/${object.id}`)}
                    className="hover:text-crimson underline"
                  >
                    {object.title ?? "(untitled)"}
                  </Link>
                </td>
                <td className="text-ink-soft px-4 py-3">{object.objectType.replace(/_/g, " ")}</td>
                <td className="text-ink-soft px-4 py-3">
                  {STATUS_LABELS[object.status] ?? object.status}
                </td>
                <td className="text-ink-muted px-4 py-3 font-mono text-xs">{object.publicId}</td>
                <td className="text-ink-muted px-4 py-3">
                  {new Date(object.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ObjectSearch({ lang, query }: { lang: string; query: string }) {
  return (
    <form
      action={localizedPath(lang, "/admin/objects")}
      method="get"
      role="search"
      className="flex gap-2"
    >
      <label className="text-ink-soft sr-only" htmlFor="object-search">
        Search objects
      </label>
      <input
        id="object-search"
        name="q"
        type="search"
        defaultValue={query}
        placeholder="Search title, description, claim, type, or public ID"
        className="border-sand-deep bg-card min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
      />
      <button className="bg-crimson text-parchment rounded-md px-4 py-2 text-sm font-semibold">
        Search
      </button>
    </form>
  );
}

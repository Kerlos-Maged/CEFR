import { Suspense } from "react";
import { connection } from "next/server";

import { getSession } from "@/lib/auth/session";
import { DalError } from "@/lib/db/errors";

interface SourcesPageProps {
  params: Promise<{ lang: string }>;
}

export default function AdminSourcesPage({ params }: SourcesPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-ink text-2xl font-semibold">Scholarly sources</h1>
      <Suspense fallback={<p className="text-ink-muted text-sm">Loading sources…</p>}>
        <SourcesTable params={params} />
      </Suspense>
    </div>
  );
}

async function SourcesTable({ params }: SourcesPageProps) {
  await connection();
  await params;
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await session.client
    .from("sources")
    .select("id, title, author, year, url, source_type")
    .order("title");

  if (error) throw new DalError("INTERNAL", `Failed to list sources: ${error.message}`);

  if (!data || data.length === 0) {
    return (
      <p className="border-sand bg-card text-ink-soft rounded-lg border p-6 text-sm">
        No scholarly sources have been recorded yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.map((source) => (
        <li key={source.id} className="border-sand bg-card rounded-lg border p-3 text-sm">
          <p className="text-ink font-medium">{source.title}</p>
          <p className="text-ink-muted mt-1 text-xs">
            {[source.author, source.year, source.source_type].filter(Boolean).join(" · ")}
          </p>
        </li>
      ))}
    </ul>
  );
}

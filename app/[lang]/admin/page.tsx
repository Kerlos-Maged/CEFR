import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import { getDashboardCounts } from "@/lib/admin/data";
import { getSession } from "@/lib/auth/session";
import { normalizeLanguage } from "@/lib/i18n/languages";
import { localizedPath } from "@/lib/i18n/paths";

interface DashboardProps {
  params: Promise<{ lang: string }>;
}

export default function AdminDashboardPage({ params }: DashboardProps) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-crimson text-2xl font-semibold">Content administration</h1>
      <Suspense fallback={<p className="text-ink-muted text-sm">Loading summary…</p>}>
        <DashboardContent params={params} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ params }: DashboardProps) {
  await connection();
  const { lang } = await params;
  const language = normalizeLanguage(lang);
  const session = await getSession();
  if (!session) return null;

  const counts = await getDashboardCounts(session.client);

  const cards = [
    { label: "Drafts", value: counts.byStatus.draft ?? 0, href: "/admin/objects?status=draft" },
    {
      label: "In historical review",
      value: counts.byStatus.historical_review ?? 0,
      href: "/admin/review",
    },
    {
      label: "Awaiting church approval",
      value: counts.byStatus.church_review ?? 0,
      href: "/admin/review",
    },
    {
      label: "Published",
      value: counts.byStatus.published ?? 0,
      href: "/admin/objects?status=published",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={localizedPath(language, card.href)}
            className="border-sand bg-card hover:border-gold rounded-lg border p-4 shadow-sm transition-colors"
          >
            <p className="text-crimson text-3xl font-semibold">{card.value}</p>
            <p className="text-ink-soft mt-1 text-sm">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={localizedPath(language, "/admin/objects/new")}
          className="bg-crimson text-parchment hover:bg-crimson-dark rounded-md px-4 py-2 text-sm font-semibold transition-colors"
        >
          New heritage object
        </Link>
        <Link
          href={localizedPath(language, "/admin/review")}
          className="border-sand-deep text-crimson hover:bg-parchment-deep rounded-md border px-4 py-2 text-sm font-semibold transition-colors"
        >
          Go to review queue
        </Link>
      </div>
    </div>
  );
}

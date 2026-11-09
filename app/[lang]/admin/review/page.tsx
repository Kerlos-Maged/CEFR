import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import { listReviewQueue } from "@/lib/admin/data";
import { getSession } from "@/lib/auth/session";
import { normalizeLanguage } from "@/lib/i18n/languages";
import { localizedPath } from "@/lib/i18n/paths";

interface ReviewPageProps {
  params: Promise<{ lang: string }>;
}

export default function AdminReviewPage({ params }: ReviewPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-ink text-2xl font-semibold">Editorial review queue</h1>
      <Suspense fallback={<p className="text-ink-muted text-sm">Loading queue…</p>}>
        <ReviewQueue params={params} />
      </Suspense>
    </div>
  );
}

async function ReviewQueue({ params }: ReviewPageProps) {
  await connection();
  const { lang } = await params;
  const language = normalizeLanguage(lang);
  const session = await getSession();
  if (!session) return null;

  const isReviewer =
    session.user.isPlatformAdmin ||
    session.memberships.some((m) => m.role === "historical_reviewer");
  const isApprover =
    session.user.isPlatformAdmin || session.memberships.some((m) => m.role === "church_approver");

  const [historical, approval] = await Promise.all([
    isReviewer ? listReviewQueue(session.client, "historical_review") : Promise.resolve([]),
    isApprover ? listReviewQueue(session.client, "church_review") : Promise.resolve([]),
  ]);

  if (!isReviewer && !isApprover) {
    return (
      <p className="border-sand bg-card text-ink-soft rounded-lg border p-6 text-sm">
        You do not hold a reviewer or approver role, so there are no queues for you.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {isReviewer ? (
        <QueueSection
          title="Awaiting historical review"
          items={historical}
          lang={language}
          empty="Nothing is awaiting historical review."
        />
      ) : null}
      {isApprover ? (
        <QueueSection
          title="Awaiting church approval"
          items={approval}
          lang={language}
          empty="Nothing is awaiting church approval."
        />
      ) : null}
    </div>
  );
}

function QueueSection({
  title,
  items,
  lang,
  empty,
}: {
  title: string;
  items: { id: string; title: string | null; publicId: string; updatedAt: string }[];
  lang: string;
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ink-muted text-sm font-semibold tracking-wide uppercase">{title}</h2>
      {items.length === 0 ? (
        <p className="text-ink-soft text-sm">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-sand bg-card flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <Link
                href={localizedPath(lang, `/admin/objects/${item.id}`)}
                className="text-ink hover:text-crimson font-medium underline"
              >
                {item.title ?? "(untitled)"}
              </Link>
              <span className="text-ink-muted text-xs">
                updated {new Date(item.updatedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

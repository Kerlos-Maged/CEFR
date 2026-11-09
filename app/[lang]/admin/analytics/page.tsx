import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getAnalyticsReport, listChurches } from "@/lib/admin/data";
import { getSession } from "@/lib/auth/session";
import { normalizeLanguage } from "@/lib/i18n/languages";
import { localizedPath } from "@/lib/i18n/paths";

interface AnalyticsPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ from?: string; to?: string; church_id?: string }>;
}

export default function AdminAnalyticsPage(props: AnalyticsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-ink text-2xl font-semibold">Visitor analytics</h1>
      <p className="text-ink-muted text-sm">
        Daily totals are aggregated from privacy-conscious events. Raw events are removed after 90
        days.
      </p>
      <Suspense fallback={<p className="text-ink-muted text-sm">Loading reports…</p>}>
        <AnalyticsReportView {...props} />
      </Suspense>
    </div>
  );
}

async function AnalyticsReportView({ params, searchParams }: AnalyticsPageProps) {
  await connection();
  const [{ lang }, query] = await Promise.all([params, searchParams]);
  const language = normalizeLanguage(lang);
  const session = await getSession();
  if (!session) redirect(localizedPath(language, "/login"));
  if (!session.user.isPlatformAdmin && session.memberships.length === 0) {
    return (
      <p className="border-sand bg-card rounded-lg border p-6 text-sm">
        No church scope is assigned to your account.
      </p>
    );
  }

  const todayDate = new Date();
  const today = todayDate.toISOString().slice(0, 10);
  const defaultFromDate = new Date(todayDate);
  defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - 29);
  const defaultFrom = defaultFromDate.toISOString().slice(0, 10);
  const from = validDate(query.from) ? query.from : defaultFrom;
  const to = validDate(query.to) ? query.to : today;
  const churches = await listChurches(session.client);
  const allowedChurchIds = new Set(churches.map((church) => church.id));
  const selectedChurch =
    query.church_id && allowedChurchIds.has(query.church_id) ? query.church_id : undefined;
  const report =
    from <= to
      ? await getAnalyticsReport(session.client, { from, to, churchId: selectedChurch })
      : null;
  const totalPageViews = report?.totals.page_view ?? 0;
  const totalAudioPlays = report?.totals.audio_play ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <form
        method="get"
        className="border-sand bg-card flex flex-wrap items-end gap-3 rounded-lg border p-4"
      >
        <label className="flex flex-col gap-1 text-xs font-medium">
          From
          <input
            className="border-sand rounded border px-2 py-1.5 text-sm"
            type="date"
            name="from"
            defaultValue={from}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          To
          <input
            className="border-sand rounded border px-2 py-1.5 text-sm"
            type="date"
            name="to"
            defaultValue={to}
          />
        </label>
        <label className="flex min-w-48 flex-col gap-1 text-xs font-medium">
          Church
          <select
            className="border-sand rounded border px-2 py-2 text-sm"
            name="church_id"
            defaultValue={selectedChurch ?? "all"}
          >
            <option value="all">All available churches</option>
            {churches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.name ?? church.slug}
              </option>
            ))}
          </select>
        </label>
        <button
          className="bg-crimson text-parchment rounded px-4 py-2 text-sm font-semibold"
          type="submit"
        >
          Apply
        </button>
      </form>

      {!report ? (
        <p className="border-sand bg-card rounded-lg border p-4 text-sm">
          The start date must be on or before the end date.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Page views" value={totalPageViews} />
            <MetricCard label="Audio plays" value={totalAudioPlays} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <DataTable
              title="Daily activity"
              headers={["Day", "Page views", "Audio plays"]}
              rows={report.byDay.map((row) => [
                row.day,
                formatCount(row.pageViews),
                formatCount(row.audioPlays),
              ])}
              empty="No aggregated activity for this period. The daily job runs at 03:17 UTC."
            />
            <DataTable
              title="By language"
              headers={["Language", "Events"]}
              rows={report.byLanguage.map((row) => [row.language, formatCount(row.count)])}
              empty="No language events for this period."
            />
            <DataTable
              title="By church"
              headers={["Church", "Events"]}
              rows={report.byChurch.map((row) => [row.churchName, formatCount(row.count)])}
              empty="No church-scoped events for this period."
            />
            <DataTable
              title="Top objects"
              headers={["Object", "Public ID", "Events"]}
              rows={report.topObjects.map((row) => [
                row.title,
                row.publicId,
                formatCount(row.count),
              ])}
              empty="No object activity for this period."
            />
            <DataTable
              title="Event types"
              headers={["Event", "Count"]}
              rows={Object.entries(report.totals).map(([event, count]) => [
                event.replaceAll("_", " "),
                formatCount(count),
              ])}
              empty="No events for this period."
            />
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-sand bg-card rounded-lg border p-5">
      <p className="text-ink-muted text-sm">{label}</p>
      <p className="text-crimson mt-1 text-3xl font-semibold tabular-nums">{formatCount(value)}</p>
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
  empty,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-ink text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="border-sand bg-card text-ink-muted rounded-lg border p-4 text-sm">{empty}</p>
      ) : (
        <div className="border-sand bg-card overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-parchment-deep text-ink-muted text-xs uppercase">
              <tr>
                {headers.map((header) => (
                  <th className="px-3 py-2" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr className="border-sand border-t" key={`${index}-${row[0]}`}>
                  {row.map((cell, cellIndex) => (
                    <td className="text-ink-soft px-3 py-2" key={`${index}-${cellIndex}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function validDate(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

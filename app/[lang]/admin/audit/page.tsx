import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";

interface AuditEvent {
  id: string;
  createdAt: string;
  category: string;
  summary: string;
  actorId: string | null;
  objectId?: string;
  notes?: string | null;
}

export default async function AdminAuditPage() {
  await connection();
  const session = requirePlatformAdmin(await getSession());
  const [adminResult, historyResult, reviewResult] = await Promise.all([
    session.client
      .from("admin_audit_log")
      .select("id, actor_id, action, entity_type, entity_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    session.client
      .from("publication_history")
      .select("id, object_id, actor_id, from_status, to_status, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    session.client
      .from("review_records")
      .select("id, object_id, actor_id, review_type, decision, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (adminResult.error || historyResult.error || reviewResult.error) {
    throw new Error("Could not load the audit history.");
  }

  const events: AuditEvent[] = [
    ...(adminResult.data ?? []).map((row) => ({
      id: `admin-${row.id}`,
      createdAt: row.created_at,
      category: "Administration",
      summary: `${row.action.replaceAll("_", " ")} · ${row.entity_type}${row.entity_id ? ` · ${row.entity_id}` : ""}`,
      actorId: row.actor_id,
    })),
    ...(historyResult.data ?? []).map((row) => ({
      id: `history-${row.id}`,
      createdAt: row.created_at,
      category: "Publication",
      summary: `${row.from_status ?? "created"} to ${row.to_status}`,
      actorId: row.actor_id,
      objectId: row.object_id,
      notes: row.notes,
    })),
    ...(reviewResult.data ?? []).map((row) => ({
      id: `review-${row.id}`,
      createdAt: row.created_at,
      category: `Review · ${row.review_type.replaceAll("_", " ")}`,
      summary: row.decision.replaceAll("_", " "),
      actorId: row.actor_id,
      objectId: row.object_id,
      notes: row.notes,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const objectIds = [
    ...new Set(events.flatMap((event) => (event.objectId ? [event.objectId] : []))),
  ];
  const { data: objects, error: objectError } = objectIds.length
    ? await session.client.from("objects").select("id, public_id").in("id", objectIds)
    : { data: [], error: null };
  if (objectError) throw new Error("Could not resolve audit object references.");
  const publicIds = new Map((objects ?? []).map((object) => [object.id, object.public_id]));

  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className="text-ink text-2xl font-semibold">Platform audit history</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Latest administrative, review, and publication events across churches.
        </p>
      </header>
      {events.length === 0 ? (
        <p className="border-sand bg-card rounded-lg border p-5 text-sm">
          No audit events recorded.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id} className="border-sand bg-card rounded-lg border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-crimson text-xs font-semibold uppercase">
                  {event.category}
                </span>
                <time className="text-ink-muted text-xs" dateTime={event.createdAt}>
                  {new Date(event.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="text-ink mt-1 text-sm font-medium">{event.summary}</p>
              {event.objectId ? (
                <p className="text-ink-muted mt-1 font-mono text-xs">
                  Object {publicIds.get(event.objectId) ?? event.objectId}
                </p>
              ) : null}
              {event.notes ? (
                <p className="text-ink-soft mt-2 text-sm whitespace-pre-wrap">{event.notes}</p>
              ) : null}
              {event.actorId ? (
                <p className="text-ink-muted mt-2 font-mono text-xs">Actor {event.actorId}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

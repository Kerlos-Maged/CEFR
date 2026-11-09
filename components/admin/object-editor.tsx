"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  archiveObject,
  recordReviewDecision,
  returnToDraft,
  submitForReview,
  unpublishObject,
} from "@/lib/actions/workflow";
import { updateObject, upsertObjectTranslation } from "@/lib/actions/objects";
import { setClaimVerification } from "@/lib/actions/sources";
import {
  deleteMedia,
  reorderMedia,
  setMediaPublication,
  updateMediaDetails,
  upsertMediaTranslation,
} from "@/lib/actions/media";
import { createObjectRelation, deleteObjectRelation } from "@/lib/actions/relations";
import type { AdminObjectDetail } from "@/lib/admin/data";
import {
  OBJECT_RELATIONSHIP_TYPES,
  OBJECT_TYPES,
  VERIFICATION_STATUSES,
} from "@/lib/validation/object";

interface ObjectEditorProps {
  lang: string;
  object: AdminObjectDetail;
  canEdit: boolean;
  isReviewer: boolean;
  isApprover: boolean;
  languages: { code: string; name: string }[];
}

type Feedback = { kind: "ok" | "error"; message: string } | null;

export function ObjectEditor({
  lang,
  object,
  canEdit,
  isReviewer,
  isApprover,
  languages,
}: ObjectEditorProps) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    startTransition(async () => {
      const result = await fn();
      setFeedback(
        result.ok
          ? { kind: "ok", message: `${label} succeeded.` }
          : { kind: "error", message: result.error?.message ?? `${label} failed.` },
      );
    });
  }

  const isDraft = object.status === "draft";
  const canEditContent = canEdit && isDraft && object.status !== "archived";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-ink text-2xl font-semibold">{object.title ?? "(untitled)"}</h1>
          <span className="bg-sand text-ink-soft rounded-full px-3 py-1 text-xs font-semibold">
            {object.status.replace(/_/g, " ")}
          </span>
        </div>
        <p className="text-ink-muted font-mono text-xs">public id: {object.publicId}</p>
        {object.status === "published" ? (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <a
              href={`/api/qr/${object.publicId}?format=svg`}
              target="_blank"
              rel="noreferrer"
              className="text-ink-soft hover:text-ink font-semibold underline"
            >
              QR (SVG)
            </a>
            <a
              href={`/api/qr/${object.publicId}?format=png&download=1`}
              className="text-ink-soft hover:text-ink font-semibold underline"
            >
              QR (PNG)
            </a>
            <a
              href={`/${lang}/o/${object.publicId}`}
              target="_blank"
              rel="noreferrer"
              className="text-ink-soft hover:text-ink font-semibold underline"
            >
              View public page
            </a>
          </div>
        ) : (
          <p className="text-ink-muted text-xs">
            Public page and QR export become available once the object is published.
          </p>
        )}
      </header>

      {feedback ? (
        <p
          className={
            feedback.kind === "ok"
              ? "border-gold-soft bg-gold-tint text-crimson-dark rounded-md border p-3 text-sm"
              : "border-crimson bg-gold-tint text-crimson-dark rounded-md border p-3 text-sm"
          }
        >
          {feedback.message}
        </p>
      ) : null}

      <WorkflowPanel
        object={object}
        canEdit={canEdit}
        isReviewer={isReviewer}
        isApprover={isApprover}
        pending={pending}
        run={run}
      />

      {canEditContent ? (
        <DetailsForm object={object} pending={pending} run={run} />
      ) : (
        <ReadOnlyDetails object={object} />
      )}

      <TranslationsSection
        object={object}
        languages={languages}
        editable={canEditContent}
        pending={pending}
        run={run}
      />

      <MediaSection
        object={object}
        editable={canEditContent}
        pending={pending}
        run={run}
        languages={languages}
      />

      <ClaimsSection object={object} canVerify={isReviewer} pending={pending} run={run} />

      <RelationshipsSection
        object={object}
        editable={canEditContent}
        pending={pending}
        run={run}
        lang={lang}
      />

      <SourcesSection object={object} />
      <HistorySection object={object} />
    </div>
  );
}

function RelationshipsSection({
  object,
  editable,
  pending,
  run,
  lang,
}: {
  object: AdminObjectDetail;
  editable: boolean;
  pending: boolean;
  run: RunFn;
  lang: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-ink-muted text-sm font-semibold tracking-wide uppercase">
          Related heritage records
        </h2>
        <p className="text-ink-muted mt-1 text-xs">
          Connect icons and objects from this church by subject, artist, set, place, or context.
        </p>
      </div>
      {object.relations.length ? (
        <ul className="flex flex-col gap-2">
          {object.relations.map((relation) => (
            <li
              key={relation.id}
              className="border-sand bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
            >
              <div>
                <a
                  className="text-crimson font-medium underline"
                  href={`/${lang}/admin/objects/${relation.relatedObjectId}`}
                >
                  {relation.relatedTitle ?? relation.relatedPublicId}
                </a>
                <p className="text-ink-muted mt-1 text-xs">
                  {relationLabel(relation.relationshipType)} · {relation.relatedPublicId} ·{" "}
                  {relation.isPublic ? "public when both records are published" : "internal"}
                </p>
                {relation.description ? (
                  <p className="text-ink-soft mt-1 text-xs">{relation.description}</p>
                ) : null}
              </div>
              {editable ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run("Remove relationship", () => deleteObjectRelation(relation.id))
                  }
                  className="border-crimson text-crimson rounded border px-3 py-1 text-xs font-semibold disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft text-sm">No related records are linked yet.</p>
      )}
      {editable ? (
        <form
          className="border-sand bg-parchment-deep grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            run("Link related record", () =>
              createObjectRelation({
                object_id: object.id,
                related_object_id: String(form.get("related_object_id")),
                relationship_type: String(
                  form.get("relationship_type"),
                ) as (typeof OBJECT_RELATIONSHIP_TYPES)[number],
                description: String(form.get("description") ?? ""),
                is_public: form.get("is_public") === "on",
              }),
            );
            event.currentTarget.reset();
          }}
        >
          <label className="text-ink-soft flex flex-col gap-1 text-xs font-medium">
            Related object
            <select
              name="related_object_id"
              required
              defaultValue=""
              className="border-sand-deep bg-card rounded border px-2 py-2 text-sm"
            >
              <option value="" disabled>
                Select an object from this church…
              </option>
              {object.relationCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title ?? candidate.publicId} ·{" "}
                  {candidate.objectType.replaceAll("_", " ")} · {candidate.publicId}
                </option>
              ))}
            </select>
          </label>
          <label className="text-ink-soft flex flex-col gap-1 text-xs font-medium">
            Relationship
            <select
              name="relationship_type"
              defaultValue="related"
              className="border-sand-deep bg-card rounded border px-2 py-2 text-sm"
            >
              {OBJECT_RELATIONSHIP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {relationLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <TextInput name="description" label="Why are they related?" value={null} />
          <label className="text-ink-soft flex items-center gap-2 text-xs">
            <input type="checkbox" name="is_public" className="accent-crimson h-4 w-4" />
            Show this link publicly after both objects are published
          </label>
          <button
            type="submit"
            disabled={pending || object.relationCandidates.length === 0}
            className="bg-crimson text-parchment w-fit rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Link records
          </button>
        </form>
      ) : null}
      {editable && object.relationCandidates.length === 0 ? (
        <p className="text-ink-muted text-xs">
          Create another record for this church first; relationships stay within one church.
        </p>
      ) : null}
    </section>
  );
}

function relationLabel(type: string): string {
  const labels: Record<string, string> = {
    same_subject: "Same depicted subject",
    same_artist: "Same attributed artist",
    same_workshop: "Same workshop",
    part_of_set: "Part of the same set",
    same_location: "Same church location",
    historical_context: "Shared historical context",
    inspired_by: "Inspired by / related model",
    related: "Related record",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

type RunFn = (
  label: string,
  fn: () => Promise<{ ok: boolean; error?: { message: string } }>,
) => void;

function WorkflowPanel({
  object,
  canEdit,
  isReviewer,
  isApprover,
  pending,
  run,
}: {
  object: AdminObjectDetail;
  canEdit: boolean;
  isReviewer: boolean;
  isApprover: boolean;
  pending: boolean;
  run: RunFn;
}) {
  const controls: React.ReactNode[] = [];

  if (object.status === "draft" && canEdit) {
    controls.push(
      <button
        key="submit"
        disabled={pending}
        onClick={() => run("Submit for review", () => submitForReview({ object_id: object.id }))}
        className="bg-crimson text-parchment hover:bg-crimson-dark rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        Submit for historical review
      </button>,
    );
  }

  if (object.status === "historical_review" && isReviewer) {
    controls.push(
      <DecisionButtons
        key="hist"
        pending={pending}
        run={run}
        onDecide={(decision) =>
          run("Historical decision", () =>
            recordReviewDecision({ object_id: object.id, decision, notes: notesFor(decision) }),
          )
        }
      />,
    );
  }

  if (object.status === "church_review" && isApprover) {
    controls.push(
      <DecisionButtons
        key="church"
        pending={pending}
        run={run}
        onDecide={(decision) =>
          run("Church decision", () =>
            recordReviewDecision({ object_id: object.id, decision, notes: notesFor(decision) }),
          )
        }
      />,
    );
  }

  if (object.status === "published" && (isApprover || canEdit)) {
    if (isApprover) {
      controls.push(
        <button
          key="unpublish"
          disabled={pending}
          onClick={() => run("Unpublish", () => unpublishObject({ object_id: object.id }))}
          className="border-sand-deep text-crimson hover:bg-parchment-deep rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Unpublish
        </button>,
      );
    }
  }

  if (object.status !== "archived" && (isApprover || object.status === "historical_review")) {
    controls.push(
      <button
        key="archive"
        disabled={pending}
        onClick={() => run("Archive", () => archiveObject({ object_id: object.id }))}
        className="border-crimson text-crimson hover:bg-gold-tint rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        Archive
      </button>,
    );
  }

  if (object.status === "historical_review" || object.status === "church_review") {
    controls.push(
      <button
        key="draft"
        disabled={pending}
        onClick={() => run("Return to draft", () => returnToDraft({ object_id: object.id }))}
        className="border-sand-deep text-crimson hover:bg-parchment-deep rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        Return to draft
      </button>,
    );
  }

  if (controls.length === 0) {
    return (
      <section className="border-sand bg-parchment-deep text-ink-soft rounded-lg border p-4 text-sm">
        No workflow actions are available to your role at this stage.
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-ink-muted text-sm font-semibold tracking-wide uppercase">Workflow</h2>
      <div className="flex flex-wrap items-center gap-3">{controls}</div>
      <p className="text-ink-muted text-xs">
        Notes are required when rejecting or requesting changes. Every decision is recorded in the
        review history.
      </p>
    </section>
  );
}

function notesFor(decision: "approved" | "rejected" | "changes_requested"): string | undefined {
  if (decision === "approved") return undefined;
  const notes = window.prompt("Notes (required for this decision):") ?? undefined;
  return notes;
}

function DecisionButtons({
  pending,
  run,
  onDecide,
}: {
  pending: boolean;
  run: RunFn;
  onDecide: (decision: "approved" | "rejected" | "changes_requested") => void;
}) {
  void run;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        disabled={pending}
        onClick={() => onDecide("approved")}
        className="bg-gold text-ink hover:bg-gold-bright rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        Approve
      </button>
      <button
        disabled={pending}
        onClick={() => onDecide("changes_requested")}
        className="border-gold-soft text-crimson-dark hover:bg-gold-tint rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        Request changes
      </button>
      <button
        disabled={pending}
        onClick={() => onDecide("rejected")}
        className="border-crimson text-crimson hover:bg-gold-tint rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}

function DetailsForm({
  object,
  pending,
  run,
}: {
  object: AdminObjectDetail;
  pending: boolean;
  run: RunFn;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ink-muted text-sm font-semibold tracking-wide uppercase">Details</h2>
      <form
        className="grid max-w-2xl gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          run("Save details", () =>
            updateObject(object.id, {
              object_type: String(form.get("object_type")) as (typeof OBJECT_TYPES)[number],
              approximate_date: String(form.get("approximate_date") ?? ""),
              location_in_church: String(form.get("location_in_church") ?? ""),
              materials: String(form.get("materials") ?? ""),
              dimensions: String(form.get("dimensions") ?? ""),
              condition_notes: String(form.get("condition_notes") ?? ""),
            }),
          );
        }}
      >
        <label className="text-ink-soft flex flex-col gap-1 text-sm font-medium">
          Type
          <select
            name="object_type"
            defaultValue={object.objectType}
            className="border-sand-deep rounded-md border px-3 py-2"
          >
            {OBJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <TextInput
          name="approximate_date"
          label="Approximate date"
          value={object.approximateDate}
        />
        <TextInput
          name="location_in_church"
          label="Location in church"
          value={object.locationInChurch}
        />
        <TextInput name="materials" label="Materials" value={object.materials} />
        <TextInput name="dimensions" label="Dimensions" value={object.dimensions} />
        <TextInput name="condition_notes" label="Condition notes" value={object.conditionNotes} />
        <button
          type="submit"
          disabled={pending}
          className="bg-crimson text-parchment hover:bg-crimson-dark self-start rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Save details
        </button>
      </form>
    </section>
  );
}

function TextInput({ name, label, value }: { name: string; label: string; value: string | null }) {
  return (
    <label className="text-ink-soft flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        name={name}
        defaultValue={value ?? ""}
        className="border-sand-deep text-ink rounded-md border px-3 py-2"
      />
    </label>
  );
}

function ReadOnlyDetails({ object }: { object: AdminObjectDetail }) {
  const rows: [string, string | null][] = [
    ["Type", object.objectType.replace(/_/g, " ")],
    ["Approximate date", object.approximateDate],
    ["Location in church", object.locationInChurch],
    ["Materials", object.materials],
    ["Dimensions", object.dimensions],
    ["Condition notes", object.conditionNotes],
  ];
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ink-muted text-sm font-semibold tracking-wide uppercase">Details</h2>
      <dl className="grid max-w-2xl gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-ink-muted text-xs uppercase">{label}</dt>
            <dd className="text-ink text-sm">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TranslationsSection({
  object,
  languages,
  editable,
  pending,
  run,
}: {
  object: AdminObjectDetail;
  languages: { code: string; name: string }[];
  editable: boolean;
  pending: boolean;
  run: RunFn;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ink-muted text-sm font-semibold tracking-wide uppercase">Translations</h2>
      <div className="flex flex-col gap-3">
        {languages.map((language) => {
          const existing = object.translations.find((t) => t.languageCode === language.code);
          return (
            <form
              key={language.code}
              className="border-sand bg-card rounded-lg border p-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                run(`Save ${language.name}`, () =>
                  upsertObjectTranslation(object.id, {
                    language_code: language.code,
                    title: String(form.get("title")),
                    description: String(form.get("description") ?? ""),
                    is_complete: Boolean(form.get("is_complete")),
                  }),
                );
              }}
            >
              <p className="text-ink mb-2 text-sm font-semibold">
                {language.name}
                {existing ? (
                  <span className="text-ink-muted ml-2 text-xs font-normal">
                    {existing.isComplete ? "complete" : "incomplete"}
                  </span>
                ) : (
                  <span className="text-ink-muted ml-2 text-xs font-normal">not started</span>
                )}
              </p>
              <div className="flex flex-col gap-2">
                <input
                  name="title"
                  required
                  defaultValue={existing?.title ?? ""}
                  placeholder="Title"
                  disabled={!editable}
                  className="border-sand-deep text-ink disabled:bg-parchment-deep rounded-md border px-3 py-2"
                />
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={existing?.description ?? ""}
                  placeholder="Description"
                  disabled={!editable}
                  className="border-sand-deep text-ink disabled:bg-parchment-deep rounded-md border px-3 py-2"
                />
                <label className="text-ink-soft flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="is_complete"
                    defaultChecked={existing?.isComplete ?? false}
                    disabled={!editable}
                  />
                  Mark as complete
                </label>
                {editable ? (
                  <button
                    type="submit"
                    disabled={pending}
                    className="bg-crimson text-parchment hover:bg-crimson-dark self-start rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                ) : null}
              </div>
            </form>
          );
        })}
      </div>
    </section>
  );
}

function MediaSection({
  object,
  editable,
  pending,
  run,
  languages,
}: {
  object: AdminObjectDetail;
  editable: boolean;
  pending: boolean;
  run: RunFn;
  languages: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File)) return;
    const body = new FormData();
    body.set("file", file);
    body.set("object_id", object.id);
    setUploading(true);
    setUploadMessage("");
    try {
      const response = await fetch("/api/media/upload", { method: "POST", body });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Upload failed.");
      setUploadMessage("Upload complete. Add rights information before publishing this media.");
      form.reset();
      router.refresh();
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ink-muted text-sm font-semibold tracking-wide uppercase">Media</h2>
      {editable ? (
        <form
          onSubmit={upload}
          className="border-sand bg-card flex flex-wrap items-end gap-3 rounded-lg border p-3"
        >
          <label className="text-ink-soft flex flex-col gap-1 text-sm">
            Add an image or audio narration
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac"
              required
            />
          </label>
          <button
            type="submit"
            disabled={uploading}
            className="bg-crimson text-parchment rounded px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload media"}
          </button>
          <p aria-live="polite" className="text-ink-muted w-full text-xs">
            {uploadMessage || "Images up to 15 MB; audio up to 25 MB. Rights default to pending."}
          </p>
        </form>
      ) : null}
      {object.media.length === 0 ? (
        <p className="text-ink-soft text-sm">No media registered.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {object.media.map((media, index) => (
            <li
              key={media.id}
              className="border-sand bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
            >
              <div className="flex flex-col">
                <span className="text-ink font-medium">
                  {media.mediaType} · {media.mimeType}
                </span>
                <span className="text-ink-muted text-xs">
                  {media.permissionStatus} · {media.isPublic ? "public" : "private"}
                </span>
              </div>
              {editable ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending || index === 0}
                    aria-label="Move media up"
                    onClick={() => {
                      const ids = object.media.map((item) => item.id);
                      [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                      run("Reorder media", () =>
                        reorderMedia({ object_id: object.id, media_ids: ids }),
                      );
                    }}
                    className="border-sand-deep text-crimson rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={pending || index === object.media.length - 1}
                    aria-label="Move media down"
                    onClick={() => {
                      const ids = object.media.map((item) => item.id);
                      [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
                      run("Reorder media", () =>
                        reorderMedia({ object_id: object.id, media_ids: ids }),
                      );
                    }}
                    className="border-sand-deep text-crimson rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run("Media publication", () =>
                        setMediaPublication({ media_id: media.id, is_public: !media.isPublic }),
                      )
                    }
                    className="border-sand-deep text-crimson hover:bg-parchment-deep rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {media.isPublic ? "Make private" : "Make public"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Delete this media file and its metadata? This cannot be undone.",
                        )
                      ) {
                        run("Delete media", () => deleteMedia(media.id));
                      }
                    }}
                    className="border-crimson text-crimson rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
              <div className="mt-3 grid w-full gap-3">
                <form
                  className="grid gap-2 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    run("Save media rights", () =>
                      updateMediaDetails({
                        media_id: media.id,
                        permission_status: String(form.get("permission_status")) as
                          "granted" | "public_domain" | "pending" | "restricted",
                        copyright_holder: String(form.get("copyright_holder") ?? ""),
                        attribution: String(form.get("attribution") ?? ""),
                      }),
                    );
                  }}
                >
                  <label className="text-ink-soft flex flex-col gap-1 text-xs">
                    Permission status
                    <select
                      name="permission_status"
                      defaultValue={media.permissionStatus}
                      disabled={!editable}
                      className="border-sand-deep rounded border px-2 py-1"
                    >
                      <option value="pending">Pending</option>
                      <option value="restricted">Restricted</option>
                      <option value="granted">Granted</option>
                      <option value="public_domain">Public domain</option>
                    </select>
                  </label>
                  <TextInput
                    name="copyright_holder"
                    label="Copyright holder"
                    value={media.copyrightHolder}
                  />
                  <TextInput
                    name="attribution"
                    label="Attribution / credit"
                    value={media.attribution}
                  />
                  {editable ? (
                    <button className="border-sand-deep text-crimson rounded border px-3 py-1 text-xs font-semibold">
                      Save rights
                    </button>
                  ) : null}
                </form>
                {languages.map((language) => (
                  <form
                    key={language.code}
                    className="grid gap-2 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      run(`Save ${language.name} media text`, () =>
                        upsertMediaTranslation({
                          media_id: media.id,
                          language_code: language.code,
                          caption: String(form.get("caption") ?? ""),
                          alt_text: String(form.get("alt_text") ?? ""),
                        }),
                      );
                    }}
                  >
                    <p className="text-ink-muted text-xs font-semibold sm:col-span-2">
                      {language.name} ({language.code})
                    </p>
                    <TextInput
                      name="caption"
                      label="Caption"
                      value={media.captions[language.code] ?? null}
                    />
                    {media.mediaType === "image" ? (
                      <TextInput
                        name="alt_text"
                        label="Alternative text"
                        value={media.altTexts[language.code] ?? null}
                      />
                    ) : null}
                    {editable ? (
                      <button className="border-sand-deep text-crimson w-fit rounded border px-3 py-1 text-xs font-semibold">
                        Save text
                      </button>
                    ) : null}
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ClaimsSection({
  object,
  canVerify,
  pending,
  run,
}: {
  object: AdminObjectDetail;
  canVerify: boolean;
  pending: boolean;
  run: RunFn;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ink-muted text-sm font-semibold tracking-wide uppercase">
        Historical claims
      </h2>
      {object.claims.length === 0 ? (
        <p className="text-ink-soft text-sm">No claims recorded.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {object.claims.map((claim) => (
            <li key={claim.id} className="border-sand bg-card rounded-lg border p-3 text-sm">
              <p className="text-ink">{claim.text}</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-ink-muted text-xs">
                  {claim.verification} · {claim.isPublic ? "public" : "internal"}
                </span>
                {canVerify ? (
                  <select
                    disabled={pending}
                    value={claim.verification}
                    onChange={(event) =>
                      run("Set verification", () =>
                        setClaimVerification({
                          claim_id: claim.id,
                          verification: event.target
                            .value as (typeof VERIFICATION_STATUSES)[number],
                        }),
                      )
                    }
                    className="border-sand-deep rounded-md border px-2 py-1 text-xs"
                  >
                    {VERIFICATION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SourcesSection({ object }: { object: AdminObjectDetail }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ink-muted text-sm font-semibold tracking-wide uppercase">Sources</h2>
      {object.sources.length === 0 ? (
        <p className="text-ink-soft text-sm">No sources linked.</p>
      ) : (
        <ul className="text-ink-soft flex flex-col gap-1 text-sm">
          {object.sources.map((source) => (
            <li key={source.id}>
              {source.title}
              {source.author ? ` — ${source.author}` : ""}
              {source.year ? ` (${source.year})` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HistorySection({ object }: { object: AdminObjectDetail }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ink-muted text-sm font-semibold tracking-wide uppercase">
        Publication history
      </h2>
      <ul className="flex flex-col gap-2 text-sm">
        {object.history
          .slice()
          .reverse()
          .map((entry, index) => (
            <li key={`${entry.createdAt}-${index}`} className="bg-parchment-deep rounded-md p-2">
              <span className="text-ink-soft font-medium">
                {entry.fromStatus} to {entry.toStatus}
              </span>
              <span className="text-ink-muted ml-2 text-xs">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
              {entry.notes ? <p className="text-ink-soft mt-1 text-xs">{entry.notes}</p> : null}
            </li>
          ))}
      </ul>
      <h3 className="text-ink-muted mt-2 text-xs font-semibold tracking-wide uppercase">
        Review records
      </h3>
      <ul className="flex flex-col gap-2 text-sm">
        {object.reviews.map((review, index) => (
          <li key={`${review.createdAt}-${index}`} className="bg-parchment-deep rounded-md p-2">
            <span className="text-ink-soft font-medium">
              {review.reviewType.replace(/_/g, " ")}: {review.decision.replace(/_/g, " ")}
            </span>
            <span className="text-ink-muted ml-2 text-xs">
              {new Date(review.createdAt).toLocaleString()}
            </span>
            {review.notes ? <p className="text-ink-soft mt-1 text-xs">{review.notes}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

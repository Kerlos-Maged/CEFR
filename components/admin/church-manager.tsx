"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

import {
  archiveChurch,
  createChurch,
  updateChurch,
  upsertChurchTranslation,
} from "@/lib/actions/churches";
import type { AdminChurchSummary } from "@/lib/admin/data";

export function ChurchManager({
  churches,
  lang,
}: {
  churches: AdminChurchSummary[];
  lang: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await createChurch({
      slug: text(form, "slug"),
      name_en: text(form, "name_en"),
      name_ar: text(form, "name_ar"),
      description_en: text(form, "description_en"),
      description_ar: text(form, "description_ar"),
      city: text(form, "city"),
      district: text(form, "district"),
      dedication_date: text(form, "dedication_date"),
      rite: text(form, "rite"),
      latitude: numberOrUndefined(form, "latitude"),
      longitude: numberOrUndefined(form, "longitude"),
      external_links: parseExternalLinks(text(form, "external_links")),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    formElement.reset();
    setNotice("Church created.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="border-sand bg-card rounded-lg border p-5">
        <h2 className="text-ink mb-4 text-lg font-semibold">Onboard a church</h2>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <Field name="slug" label="Permanent slug" required />
          <Field name="name_en" label="English name" required />
          <Field name="name_ar" label="Arabic name" dir="rtl" />
          <Field name="city" label="City / area" />
          <Field name="district" label="District" />
          <Field name="dedication_date" label="Founded / dedication date (approximate)" />
          <Field name="rite" label="Rite" defaultValue="coptic_orthodox" />
          <Field
            name="latitude"
            label="Latitude (optional, coarse location only)"
            inputMode="decimal"
          />
          <Field
            name="longitude"
            label="Longitude (optional, coarse location only)"
            inputMode="decimal"
          />
          <TextArea name="description_en" label="English description" />
          <TextArea name="description_ar" label="Arabic description" dir="rtl" />
          <TextArea
            name="external_links"
            label="External reference URLs (one http(s) URL per line)"
          />
          <div className="sm:col-span-2">
            <button
              className="bg-crimson text-parchment rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={pending}
            >
              {pending ? "Saving…" : "Create church"}
            </button>
          </div>
          <Feedback error={error} notice={notice} />
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-ink text-lg font-semibold">Church records ({churches.length})</h2>
        {churches.length === 0 ? (
          <p className="text-ink-muted text-sm">No churches have been created yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {churches.map((church) => (
              <ChurchCard key={church.id} church={church} lang={lang} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ChurchCard({ church, lang }: { church: AdminChurchSummary; lang: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await updateChurch({
      church_id: church.id,
      slug: text(form, "slug"),
      city: text(form, "city"),
      district: text(form, "district"),
      dedication_date: text(form, "dedication_date"),
      rite: text(form, "rite"),
      latitude: numberOrUndefined(form, "latitude"),
      longitude: numberOrUndefined(form, "longitude"),
      external_links: parseExternalLinks(text(form, "external_links")),
      cover_media_id: text(form, "cover_media_id"),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice("Church details saved.");
    router.refresh();
  }

  async function saveTranslation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await upsertChurchTranslation({
      church_id: church.id,
      language_code: text(form, "language_code"),
      name: text(form, "name"),
      description: text(form, "description"),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice("Translation saved.");
    router.refresh();
  }

  async function archive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(`Archive ${church.name ?? church.slug} and retire its heritage records?`))
      return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await archiveChurch({ church_id: church.id, notes: text(form, "notes") });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice("Church and its objects have been archived.");
    router.refresh();
  }

  return (
    <li className="border-sand bg-card rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-ink font-semibold">{church.name ?? church.slug}</h3>
          <p className="text-ink-muted text-xs">
            {church.slug} · {church.status}
          </p>
        </div>
        {church.status === "active" ? (
          <Link
            className="text-crimson text-sm underline"
            href={`/${lang}/churches/${church.slug}`}
          >
            Open public page
          </Link>
        ) : null}
      </div>

      <details>
        <summary className="text-crimson cursor-pointer text-sm font-medium">Edit record</summary>
        <div className="mt-4 flex flex-col gap-4">
          <form onSubmit={saveDetails} className="grid gap-3 sm:grid-cols-2">
            <Field
              name="slug"
              label="Slug"
              required
              defaultValue={church.slug}
              disabled={church.status !== "active"}
            />
            <Field
              name="city"
              label="City / area"
              defaultValue={church.city ?? ""}
              disabled={church.status !== "active"}
            />
            <Field
              name="district"
              label="District"
              defaultValue={church.district ?? ""}
              disabled={church.status !== "active"}
            />
            <Field
              name="dedication_date"
              label="Founded / dedication date"
              defaultValue={church.dedicationDate ?? ""}
              disabled={church.status !== "active"}
            />
            <Field
              name="rite"
              label="Rite"
              defaultValue={church.rite ?? ""}
              disabled={church.status !== "active"}
            />
            <Field
              name="latitude"
              label="Latitude"
              inputMode="decimal"
              defaultValue={church.latitude?.toString() ?? ""}
              disabled={church.status !== "active"}
            />
            <Field
              name="longitude"
              label="Longitude"
              inputMode="decimal"
              defaultValue={church.longitude?.toString() ?? ""}
              disabled={church.status !== "active"}
            />
            <TextArea
              name="external_links"
              label="External reference URLs (one http(s) URL per line)"
              defaultValue={church.externalLinks.join("\n")}
              disabled={church.status !== "active"}
            />
            <label className="text-ink-soft flex flex-col gap-1 text-xs font-medium">
              Public cover image
              <select
                name="cover_media_id"
                defaultValue={church.coverMediaId ?? ""}
                disabled={church.status !== "active"}
                className="border-sand rounded border bg-white px-3 py-2 text-sm"
              >
                <option value="">No cover image</option>
                {church.coverMediaChoices.map((media) => (
                  <option key={media.id} value={media.id}>
                    {media.label} · {media.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <span className="text-ink-muted font-normal">
                Only published, public images with cleared rights are listed.
              </span>
            </label>
            {church.status === "active" ? (
              <button
                className="bg-crimson text-parchment self-end rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
                disabled={pending}
              >
                Save details
              </button>
            ) : null}
          </form>
          {(["en", "ar"] as const).map((code) => {
            const translation = church.translations.find((entry) => entry.languageCode === code);
            return (
              <form
                key={code}
                onSubmit={saveTranslation}
                className="border-sand grid gap-3 border-t pt-3 sm:grid-cols-2"
              >
                <input type="hidden" name="language_code" value={code} />
                <Field
                  name="name"
                  label={`${code.toUpperCase()} name`}
                  required
                  defaultValue={translation?.name ?? ""}
                  dir={code === "ar" ? "rtl" : undefined}
                  disabled={church.status !== "active"}
                />
                <TextArea
                  name="description"
                  label={`${code.toUpperCase()} description`}
                  defaultValue={translation?.description ?? ""}
                  dir={code === "ar" ? "rtl" : undefined}
                  disabled={church.status !== "active"}
                />
                {church.status === "active" ? (
                  <button
                    className="bg-crimson text-parchment self-end rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    disabled={pending}
                  >
                    Save {code.toUpperCase()} translation
                  </button>
                ) : null}
              </form>
            );
          })}
          {church.status === "active" ? (
            <form
              onSubmit={archive}
              className="border-crimson/30 flex flex-wrap items-end gap-3 border-t pt-3"
            >
              <label className="text-ink-soft flex min-w-64 flex-1 flex-col gap-1 text-xs font-medium">
                Archive reason (also recorded in object histories)
                <input
                  name="notes"
                  required
                  maxLength={4000}
                  className="border-sand rounded border px-3 py-2 text-sm"
                />
              </label>
              <button
                type="submit"
                className="border-crimson text-crimson rounded border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                disabled={pending}
              >
                Archive church
              </button>
            </form>
          ) : null}
        </div>
      </details>
      <Feedback error={error} notice={notice} />
    </li>
  );
}

function Field({
  name,
  label,
  required,
  defaultValue,
  disabled,
  dir,
  inputMode,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  disabled?: boolean;
  dir?: "rtl" | "ltr";
  inputMode?: "decimal";
}) {
  return (
    <label className="text-ink-soft flex flex-col gap-1 text-xs font-medium">
      {label}
      <input
        className="border-sand bg-parchment text-ink rounded border px-3 py-2 text-sm disabled:opacity-60"
        name={name}
        required={required}
        defaultValue={defaultValue}
        disabled={disabled}
        dir={dir}
        inputMode={inputMode}
        maxLength={inputMode ? 30 : 10000}
      />
    </label>
  );
}

function TextArea({
  name,
  label,
  defaultValue,
  dir,
  disabled,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  dir?: "rtl" | "ltr";
  disabled?: boolean;
}) {
  return (
    <label className="text-ink-soft flex flex-col gap-1 text-xs font-medium">
      {label}
      <textarea
        className="border-sand bg-parchment text-ink rounded border px-3 py-2 text-sm disabled:opacity-60"
        name={name}
        rows={3}
        defaultValue={defaultValue}
        dir={dir}
        disabled={disabled}
        maxLength={10000}
      />
    </label>
  );
}

function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  if (!error && !notice) return null;
  return (
    <p aria-live="polite" className={`text-sm ${error ? "text-crimson" : "text-ink-soft"}`}>
      {error ?? notice}
    </p>
  );
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "");
}

function parseExternalLinks(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\r?\n/)
        .map((link) => link.trim())
        .filter(Boolean),
    ),
  ];
}

function numberOrUndefined(form: FormData, name: string): number | undefined {
  const value = text(form, name).trim();
  return value ? Number(value) : undefined;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createObject } from "@/lib/actions/objects";
import { OBJECT_TYPES } from "@/lib/validation/object";

interface NewObjectFormProps {
  lang: string;
  churches: { id: string; label: string }[];
  languages: { code: string; name: string }[];
}

export function NewObjectForm({ lang, churches, languages }: NewObjectFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await createObject({
      church_id: String(form.get("church_id")),
      object_type: String(form.get("object_type")) as (typeof OBJECT_TYPES)[number],
      default_language: String(form.get("default_language")),
      title: String(form.get("title")),
      description: String(form.get("description") ?? ""),
      approximate_date: String(form.get("approximate_date") ?? ""),
      location_in_church: String(form.get("location_in_church") ?? ""),
      materials: String(form.get("materials") ?? ""),
      dimensions: String(form.get("dimensions") ?? ""),
      condition_notes: String(form.get("condition_notes") ?? ""),
    });

    if (result.ok) {
      router.push(`/${lang}/admin/objects/${result.data.objectId}`);
    } else {
      setError(
        result.error.fieldErrors
          ? Object.values(result.error.fieldErrors).flat().join(" ")
          : result.error.message,
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      {error ? (
        <p className="border-crimson bg-gold-tint text-crimson-dark rounded-md border p-3 text-sm">
          {error}
        </p>
      ) : null}

      <label className="text-ink-soft flex flex-col gap-1 text-sm font-medium">
        Church
        <select
          name="church_id"
          required
          className="border-sand bg-card focus:border-gold rounded-md border px-3 py-2 focus:outline-none"
        >
          {churches.map((church) => (
            <option key={church.id} value={church.id}>
              {church.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-ink-soft flex flex-col gap-1 text-sm font-medium">
        Object type
        <select
          name="object_type"
          required
          className="border-sand bg-card focus:border-gold rounded-md border px-3 py-2 focus:outline-none"
        >
          {OBJECT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="text-ink-soft flex flex-col gap-1 text-sm font-medium">
        Default language
        <select
          name="default_language"
          required
          className="border-sand bg-card focus:border-gold rounded-md border px-3 py-2 focus:outline-none"
        >
          {languages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.name}
            </option>
          ))}
        </select>
      </label>

      <TextField name="title" label="Title" required />
      <TextArea name="description" label="Description" />
      <TextField name="approximate_date" label="Approximate date" />
      <TextField name="location_in_church" label="Location in church" />
      <TextField name="materials" label="Materials" />
      <TextField name="dimensions" label="Dimensions" />
      <TextArea name="condition_notes" label="Condition notes" />

      <button
        type="submit"
        disabled={pending}
        className="bg-crimson text-parchment hover:bg-crimson-dark self-start rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}

function TextField({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <label className="text-ink-soft flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        name={name}
        required={required}
        className="border-sand bg-card text-ink focus:border-gold rounded-md border px-3 py-2 focus:outline-none"
      />
    </label>
  );
}

function TextArea({ name, label }: { name: string; label: string }) {
  return (
    <label className="text-ink-soft flex flex-col gap-1 text-sm font-medium">
      {label}
      <textarea
        name={name}
        rows={3}
        className="border-sand bg-card text-ink focus:border-gold rounded-md border px-3 py-2 focus:outline-none"
      />
    </label>
  );
}

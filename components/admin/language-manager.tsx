"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveLanguage, setDefaultLanguage } from "@/lib/actions/languages";

export interface LanguageSetting {
  code: string;
  name: string;
  native_name: string;
  direction: "ltr" | "rtl";
  is_active: boolean;
  is_default: boolean;
}

export function LanguageManager({ languages }: { languages: LanguageSetting[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function run(
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.ok ? success : (result.error?.message ?? "Could not save language settings."),
      );
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-ink text-2xl font-semibold">Languages</h1>
      <p className="text-ink-muted text-sm">
        Enable interface languages and choose the platform fallback. New languages use English
        interface labels until translations are added.
      </p>
      <form
        action={(data: FormData) => {
          run(
            () =>
              saveLanguage({
                code: String(data.get("code") ?? ""),
                name: String(data.get("name") ?? ""),
                native_name: String(data.get("native_name") ?? ""),
                direction: String(data.get("direction")) as "ltr" | "rtl",
                is_active: data.get("is_active") === "on",
              }),
            "Language added.",
          );
        }}
        className="border-sand bg-card grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
      >
        <h2 className="text-ink font-semibold sm:col-span-2">Add a language</h2>
        <label className="text-ink-soft flex flex-col gap-1 text-sm">
          Code (BCP 47)
          <input
            name="code"
            placeholder="fr"
            pattern="[a-z]{2,8}(-[a-z0-9]{2,8})*"
            required
            className="border-sand-deep rounded border px-2 py-1"
          />
        </label>
        <label className="text-ink-soft flex flex-col gap-1 text-sm">
          Name
          <input name="name" required className="border-sand-deep rounded border px-2 py-1" />
        </label>
        <label className="text-ink-soft flex flex-col gap-1 text-sm">
          Native name
          <input
            name="native_name"
            required
            className="border-sand-deep rounded border px-2 py-1"
          />
        </label>
        <label className="text-ink-soft flex items-center gap-2 text-sm">
          Direction
          <select
            name="direction"
            defaultValue="ltr"
            className="border-sand-deep rounded border px-2 py-1"
          >
            <option value="ltr">Left to right</option>
            <option value="rtl">Right to left</option>
          </select>
        </label>
        <label className="text-ink-soft flex items-center gap-2 text-sm">
          <input name="is_active" type="checkbox" defaultChecked />
          Active on the public site
        </label>
        <button
          disabled={pending}
          className="bg-crimson text-parchment w-fit rounded px-3 py-2 text-sm font-semibold"
        >
          Add language
        </button>
      </form>
      {languages.map((language) => (
        <form
          key={language.code}
          action={(data: FormData) => {
            run(
              () =>
                saveLanguage({
                  code: language.code,
                  name: String(data.get("name") ?? ""),
                  native_name: String(data.get("native_name") ?? ""),
                  direction: String(data.get("direction")) as "ltr" | "rtl",
                  is_active: data.get("is_active") === "on",
                }),
              "Language settings saved.",
            );
          }}
          className="border-sand bg-card grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
        >
          <p className="text-ink font-semibold">
            {language.code.toUpperCase()} {language.is_default ? "· Platform default" : ""}
          </p>
          <label className="text-ink-soft flex flex-col gap-1 text-sm">
            Name
            <input
              name="name"
              defaultValue={language.name}
              required
              className="border-sand-deep rounded border px-2 py-1"
            />
          </label>
          <label className="text-ink-soft flex flex-col gap-1 text-sm">
            Native name
            <input
              name="native_name"
              defaultValue={language.native_name}
              required
              className="border-sand-deep rounded border px-2 py-1"
            />
          </label>
          <label className="text-ink-soft flex items-center gap-2 text-sm">
            Direction
            <select
              name="direction"
              defaultValue={language.direction}
              className="border-sand-deep rounded border px-2 py-1"
            >
              <option value="ltr">Left to right</option>
              <option value="rtl">Right to left</option>
            </select>
          </label>
          <label className="text-ink-soft flex items-center gap-2 text-sm">
            <input name="is_active" type="checkbox" defaultChecked={language.is_active} />
            Active in the public site
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={pending}
              className="bg-crimson text-parchment rounded px-3 py-2 text-sm font-semibold"
            >
              Save settings
            </button>
            {!language.is_default && language.is_active ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setDefaultLanguage({ code: language.code }),
                    "Default language changed.",
                  )
                }
                className="border-sand-deep text-crimson rounded border px-3 py-2 text-sm font-semibold"
              >
                Set as default
              </button>
            ) : null}
          </div>
        </form>
      ))}
      <p aria-live="polite" className="text-ink-muted text-sm">
        {message}
      </p>
    </section>
  );
}

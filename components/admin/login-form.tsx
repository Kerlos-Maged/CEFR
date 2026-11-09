"use client";

import { useState } from "react";

import { createBrowserSessionClient } from "@/lib/db/browser-client";

interface LoginFormProps {
  lang: string;
  nextPath: string;
  labels: {
    email: string;
    submit: string;
    sentTitle: string;
    sentBody: string;
    errorTitle: string;
    errorBody: string;
  };
}

/**
 * Magic-link request form. Runs entirely in the browser with the anon key; the redirect target is
 * validated server-side by `/auth/callback`, so a tampered `next` cannot cause an open redirect.
 */
export function LoginForm({ lang, nextPath, labels }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");

    try {
      const supabase = createBrowserSessionClient();
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", nextPath);
      callback.searchParams.set("lang", lang);

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callback.toString(), shouldCreateUser: false },
      });

      setState(error ? "error" : "sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="border-sand border-s-gold bg-card rounded-lg border border-s-4 p-6 shadow-sm">
        <h2 className="text-crimson text-lg font-semibold">{labels.sentTitle}</h2>
        <p className="text-ink-soft mt-2 text-sm">{labels.sentBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {state === "error" ? (
        <div className="border-crimson bg-gold-tint rounded-lg border p-4">
          <h2 className="text-crimson-dark text-sm font-semibold">{labels.errorTitle}</h2>
          <p className="text-crimson mt-1 text-sm">{labels.errorBody}</p>
        </div>
      ) : null}

      <label className="text-ink-soft flex flex-col gap-1 text-sm font-medium">
        {labels.email}
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="border-sand bg-card text-ink focus:border-gold rounded-md border px-3 py-2 text-base focus:outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={state === "sending"}
        className="bg-crimson text-parchment hover:bg-crimson-dark rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {labels.submit}
      </button>
    </form>
  );
}

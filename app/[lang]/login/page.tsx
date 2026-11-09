import { Suspense } from "react";

import { LoginForm } from "@/components/admin/login-form";
import { getMessages } from "@/lib/i18n/messages";
import { normalizeLanguage } from "@/lib/i18n/languages";

interface LoginPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { lang } = await params;
  const language = normalizeLanguage(lang);
  const messages = getMessages(language);

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-crimson text-2xl font-semibold">{messages.signInTitle}</h1>
        <div className="archive-rule" aria-hidden="true" />
        <p className="text-ink-soft text-sm">{messages.signInBody}</p>
      </header>
      <Suspense fallback={null}>
        <LoginFormSection lang={language} labels={messages} />
      </Suspense>
      {process.env.NODE_ENV === "development" ? (
        <aside className="border-sand rounded-xl border bg-[#e2edf1] p-4 text-sm">
          <h2 className="text-ink font-semibold">
            {language === "ar" ? "حسابات الاختبار المحلية" : "Local demo accounts"}
          </h2>
          <p className="text-ink-muted mt-1 leading-relaxed">
            {language === "ar"
              ? "بعد إعادة ضبط قاعدة Supabase المحلية، استخدم editor@example.com أو reviewer@example.com أو approver@example.com أو admin@example.com. الروابط تصل إلى صندوق Inbucket المحلي على المنفذ 54324."
              : "After resetting local Supabase, use editor@example.com, reviewer@example.com, approver@example.com, or admin@example.com. Sign-in links appear in local Inbucket at port 54324."}
          </p>
        </aside>
      ) : null}
    </section>
  );
}

async function LoginFormSection({
  lang,
  labels,
}: {
  lang: string;
  labels: ReturnType<typeof getMessages>;
}) {
  return (
    <LoginForm
      lang={lang}
      nextPath="/admin"
      labels={{
        email: labels.signInEmailLabel,
        submit: labels.signInButton,
        sentTitle: labels.signInSentTitle,
        sentBody: labels.signInSentBody,
        errorTitle: labels.signInErrorTitle,
        errorBody: labels.signInErrorBody,
      }}
    />
  );
}

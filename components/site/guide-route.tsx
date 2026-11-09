import { notFound } from "next/navigation";

import { isActiveLanguage } from "@/lib/i18n/registry";

import { GuidePage, type GuidePageKind } from "./guide-page";

export async function GuideRoute({
  params,
  kind,
}: {
  params: Promise<{ lang: string }>;
  kind: GuidePageKind;
}) {
  const { lang } = await params;
  if (!(await isActiveLanguage(lang))) notFound();
  return <GuidePage lang={lang} kind={kind} />;
}

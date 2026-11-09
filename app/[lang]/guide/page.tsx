import { notFound } from "next/navigation";

import { AbbaGuide } from "@/components/site/abba-guide";
import { isActiveLanguage } from "@/lib/i18n/registry";

export default async function AbbaGuidePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!(await isActiveLanguage(lang))) notFound();
  return <AbbaGuide lang={lang} />;
}

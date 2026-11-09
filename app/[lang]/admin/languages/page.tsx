import { connection } from "next/server";
import { LanguageManager, type LanguageSetting } from "@/components/admin/language-manager";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";

export default async function AdminLanguagesPage() {
  await connection();
  const session = requirePlatformAdmin(await getSession());
  const { data, error } = await session.client
    .from("languages")
    .select("code, name, native_name, direction, is_active, is_default")
    .order("code");
  if (error) throw new Error("Could not load language settings.");
  return <LanguageManager languages={(data ?? []) as LanguageSetting[]} />;
}

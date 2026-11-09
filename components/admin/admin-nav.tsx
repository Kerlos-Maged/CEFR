import Link from "next/link";

import { signOut } from "@/lib/actions/auth";
import type { MembershipRole } from "@/lib/auth/session";
import { localizedPath } from "@/lib/i18n/paths";
import { getMessages } from "@/lib/i18n/messages";

interface AdminNavProps {
  lang: string;
  displayName: string | null;
  roles: MembershipRole[];
  isPlatformAdmin: boolean;
}

const ADMIN_SECTIONS = [
  { href: "/admin", key: "dashboard" },
  { href: "/admin/objects", key: "objects" },
  { href: "/admin/review", key: "review" },
  { href: "/admin/sources", key: "sources" },
  { href: "/admin/analytics", key: "analytics" },
] as const;

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  objects: "Objects",
  review: "Review queue",
  sources: "Sources",
  analytics: "Analytics",
  churches: "Churches",
  users: "Users",
  languages: "Languages",
  audit: "Audit history",
  translations: "Translations",
};

/** Sidebar navigation. Administrative-only sections appear solely for platform administrators. */
export function AdminNav({ lang, displayName, roles, isPlatformAdmin }: AdminNavProps) {
  const messages = getMessages(lang);
  const sections = isPlatformAdmin
    ? [
        ...ADMIN_SECTIONS,
        { href: "/admin/churches", key: "churches" },
        { href: "/admin/users", key: "users" },
        { href: "/admin/languages", key: "languages" },
        { href: "/admin/audit", key: "audit" },
      ]
    : ADMIN_SECTIONS;
  const visibleSections = [...sections, { href: "/admin/translations", key: "translations" }];

  return (
    <aside className="grid content-start gap-4 lg:sticky lg:top-28">
      <section className="overflow-hidden rounded-2xl bg-[#132a3a] p-5 text-white shadow-[var(--shadow-soft)]">
        <p className="text-xs font-bold tracking-[0.18em] text-[#f2b8a8] uppercase">
          {lang === "ar" ? "مساحة إدارة الأرشيف" : "Archive workspace"}
        </p>
        <h2 className="mt-3 font-serif text-2xl">{displayName ?? "Staff"}</h2>
        <p className="mt-1 text-xs text-white/70">
          {isPlatformAdmin ? "Platform administrator" : roles.join(", ")}
        </p>
        <form action={signOut} className="mt-3">
          <input type="hidden" name="lang" value={lang} />
          <button
            type="submit"
            className="mt-2 rounded-md border border-white/25 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            {messages.signOutButton}
          </button>
        </form>
      </section>

      <nav
        aria-label={lang === "ar" ? "إدارة الأرشيف" : "Archive administration"}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2"
      >
        {visibleSections.map((section) => (
          <Link
            key={section.href}
            href={localizedPath(lang, section.href)}
            className="border-sand bg-card text-ink-soft hover:border-crimson rounded-xl border p-3 text-sm font-semibold transition hover:bg-[#e2edf1]"
          >
            {LABELS[section.key]}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

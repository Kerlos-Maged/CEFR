"use client";

import { sendAnalyticsEvent } from "@/lib/analytics/client";
import { LOCALE_COOKIE } from "@/lib/i18n/languages";

export interface LanguageSwitchOption {
  code: string;
  label: string;
  href: string;
}

interface LanguageSwitchProps {
  current: string;
  label: string;
  options: LanguageSwitchOption[];
  publicId?: string;
}

/**
 * Server-driven language switcher. Alternate URLs are computed on the server so the component
 * needs no route hooks (which would require a Suspense boundary under Cache Components). The
 * selected locale is remembered client-side in a cookie for the bare QR URL.
 */
export function LanguageSwitch({ current, label, options, publicId }: LanguageSwitchProps) {
  return (
    <nav aria-label={label} className="flex items-center gap-2 text-sm">
      {options.map((option) => {
        const isCurrent = option.code === current;
        return (
          <a
            key={option.code}
            href={option.href}
            hrefLang={option.code}
            aria-current={isCurrent ? "true" : undefined}
            className={
              isCurrent
                ? "border-crimson bg-crimson text-parchment rounded border px-2 py-1 font-medium"
                : "border-sand text-ink-soft hover:border-gold hover:text-crimson rounded border px-2 py-1"
            }
            onClick={() => {
              document.cookie = `${LOCALE_COOKIE}=${option.code}; path=/; max-age=31536000; samesite=lax`;
              if (!isCurrent) {
                sendAnalyticsEvent({
                  event_type: "language_select",
                  ...(publicId ? { public_id: publicId } : {}),
                  language_code: option.code,
                });
              }
            }}
          >
            {option.label}
          </a>
        );
      })}
    </nav>
  );
}

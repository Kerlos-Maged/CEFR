import { getMessages } from "@/lib/i18n/messages";

/**
 * Rendered for unknown published ids and unmatched paths. `not-found.tsx` receives no route
 * params, so this page shows both supported languages.
 */
export default function NotFound() {
  const en = getMessages("en");
  const ar = getMessages("ar");

  return (
    <div className="flex flex-col gap-6">
      <div className="border-sand border-s-crimson bg-card rounded-lg border border-s-4 p-6 shadow-sm">
        <h1 className="text-crimson text-xl font-semibold">{en.notFoundTitle}</h1>
        <p className="text-ink-soft mt-2">{en.notFoundBody}</p>
      </div>
      <div
        dir="rtl"
        lang="ar"
        className="border-sand border-s-gold bg-card rounded-lg border border-s-4 p-6 shadow-sm"
      >
        <h1 className="text-crimson text-xl font-semibold">{ar.notFoundTitle}</h1>
        <p className="text-ink-soft mt-2">{ar.notFoundBody}</p>
      </div>
    </div>
  );
}

export default function LanguageLoading() {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Loading Coptic heritage archive"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-5"
    >
      <span className="loading-rule" aria-hidden="true" />
      <p className="text-ink-muted text-sm">Loading the heritage archive…</p>
      <span className="sr-only">Please wait while the page loads.</span>
    </section>
  );
}

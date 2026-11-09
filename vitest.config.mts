import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Deterministic public Supabase config so code paths that build storage/CDN URLs and
    // that check `isSupabaseConfigured()` behave identically in every environment. These are
    // fake, non-secret values used only to exercise URL construction.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    },
    // The integration suite boots an in-process PostgreSQL (PGlite) and applies every
    // migration in `beforeAll`, which is CPU-heavy. Run files sequentially and allow
    // generous timeouts so DB setup never races the default 5s/10s limits.
    fileParallelism: false,
    isolate: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

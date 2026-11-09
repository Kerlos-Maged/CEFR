import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end tests (gated).
 *
 * These run only when `E2E_BASE_URL` points at a running instance that is wired to a **real
 * Supabase** project (Auth, Postgres, Storage). Without Docker or a hosted project on this
 * machine the full journeys (magic-link sign-in, signed uploads) cannot execute, so the suite is
 * skipped by default and never runs in CI unless explicitly enabled. The in-process
 * `tests/integration/db/*` suite covers the same behaviour at the data layer in every environment.
 *
 * To run locally:
 *   1. Set the public Supabase env vars for a **test** project (see .env.example).
 *   2. `npm run build && npm run start`            (or `E2E_WEB_SERVER=1` to let Playwright start it)
 *   3. `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`
 */
const baseURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_WEB_SERVER
    ? {
        command: "npm run start",
        url: baseURL ?? "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});

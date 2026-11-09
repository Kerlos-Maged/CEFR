import { expect, test } from "@playwright/test";

/**
 * Public navigation journeys (no authentication required). These run only against a live instance
 * (see playwright.config.ts); they are skipped by default so `npm run test:e2e` without
 * `E2E_BASE_URL` does not fail and CI stays green without a running server.
 */
test.skip(!process.env.E2E_BASE_URL, "Set E2E_BASE_URL to run browser E2E tests.");

test.describe("Journey A — public shell and localisation", () => {
  test("the English landing page renders the site name", async ({ page }) => {
    await page.goto("/en");
    await expect(
      page.getByRole("heading", { level: 1, name: "Coptic Heritage Digital Platform" }),
    ).toBeVisible();
  });

  test("the Arabic landing page is right-to-left and localised", async ({ page }) => {
    await page.goto("/ar");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", "ar");
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { level: 1, name: "منصة التراث القبطي الرقمية" }),
    ).toBeVisible();
  });

  test("an unsupported locale is not found", async ({ page }) => {
    const response = await page.goto("/zz");
    expect(response?.status()).toBe(404);
  });

  test("the language switch moves between Arabic and English", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("link", { name: "العربية" }).click();
    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});

test.describe("Journey A — unknown QR id", () => {
  test("a malformed public id shows the not-found page without a server error", async ({
    page,
  }) => {
    const response = await page.goto("/en/o/not-a-valid-id");
    // Format validation runs before any backend call, so this is a not-found in every environment.
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: "Object not found" })).toBeVisible();
  });

  test("a syntactically valid but unknown id renders a neutral notice, never a 5xx", async ({
    page,
  }) => {
    const response = await page.goto("/en/o/ZZZZZZZZZZ");
    expect(response?.status()).toBeLessThan(500);
    // With Supabase configured this shows "Object not found"; when the backend is unconfigured in
    // this environment it shows the "temporarily unavailable" notice. Either way: a neutral page.
    await expect(
      page.getByRole("heading", {
        name: /Object not found|Content temporarily unavailable/,
      }),
    ).toBeVisible();
  });

  test("an unknown public id returns HTTP 404", async ({ page }) => {
    const response = await page.goto("/en/o/ZZZZZZZZZZ");
    expect(response?.status()).toBe(404);
  });

  test("a malformed public id returns HTTP 404", async ({ page }) => {
    const response = await page.goto("/en/o/not-a-valid-id");
    expect(response?.status()).toBe(404);
  });
});

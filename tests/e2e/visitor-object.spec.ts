import { expect, test } from "@playwright/test";

/**
 * Visitor object page (the QR destination). Requires a live instance backed by a Supabase test
 * project that has been seeded. Set `E2E_PUBLISHED_PUBLIC_ID` to a known published id, and
 * optionally `E2E_ARCHIVED_PUBLIC_ID` to an archived id, to run the full checks.
 */
test.skip(!process.env.E2E_BASE_URL, "Set E2E_BASE_URL to run browser E2E tests.");

test.describe("Journey A — published object page", () => {
  test("a published object renders its title and localized content", async ({ page }) => {
    const publicId = process.env.E2E_PUBLISHED_PUBLIC_ID;
    test.skip(!publicId, "Set E2E_PUBLISHED_PUBLIC_ID to seed-linked published id.");

    const response = await page.goto(`/en/o/${publicId}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("an archived object returns HTTP 410 with a neutral notice", async ({ page }) => {
    const publicId = process.env.E2E_ARCHIVED_PUBLIC_ID;
    test.skip(!publicId, "Set E2E_ARCHIVED_PUBLIC_ID to a seeded archived id.");

    const response = await page.goto(`/en/o/${publicId}`);
    expect(response?.status()).toBe(410);
    await expect(page.getByText("no longer available")).toBeVisible();
  });
});

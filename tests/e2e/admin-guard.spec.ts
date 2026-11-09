import { expect, test } from "@playwright/test";

/**
 * Admin access control at the HTTP boundary. These require a live instance; the sign-in redirect is
 * asserted without following the magic link (which needs a real mailbox).
 */
test.skip(!process.env.E2E_BASE_URL, "Set E2E_BASE_URL to run browser E2E tests.");

test.describe("Journey D — admin boundary", () => {
  test("an unauthenticated visitor is redirected from /admin to sign-in", async ({ page }) => {
    await page.goto("/en/admin");
    // When Supabase is configured the redirect targets ?next=/admin; when it is not configured in
    // this environment the layout redirects with ?error=config. Both land on the sign-in page.
    await expect(page).toHaveURL(/\/en\/login\?(next=%2Fadmin|error=config)$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("the sign-in page offers the email form", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send sign-in link" })).toBeVisible();
  });

  test("an unknown admin sub-path is not found", async ({ page }) => {
    const response = await page.goto("/en/admin/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});

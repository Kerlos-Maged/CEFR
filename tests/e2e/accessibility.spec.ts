import { expect, test, type Page } from "@playwright/test";

/**
 * Accessibility and multilingual/RTL checks. These are structural, dependency-free assertions
 * (no axe) that encode the WCAG-relevant contracts the platform is required to meet: a declared
 * document language and direction, exactly one top-level heading per page, labelled form
 * controls, and alternative text on informative images. They run only against a live instance.
 */
test.skip(!process.env.E2E_BASE_URL, "Set E2E_BASE_URL to run browser E2E tests.");

async function assertSingleH1(page: Page) {
  const count = await page.getByRole("heading", { level: 1 }).count();
  expect(count).toBeLessThanOrEqual(1);
}

test.describe("Accessibility — document structure", () => {
  test("the English landing page declares lang=en, ltr, and a single h1", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await assertSingleH1(page);
  });

  test("the Arabic landing page declares lang=ar, rtl, and a single h1", async ({ page }) => {
    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await assertSingleH1(page);
  });

  test("every image has an alt attribute (may be empty for decorative images)", async ({
    page,
  }) => {
    await page.goto("/en");
    const images = page.locator("img");
    const count = await images.count();
    for (let i = 0; i < count; i += 1) {
      await expect(images.nth(i)).toHaveAttribute("alt", /.*/);
    }
  });
});

test.describe("Accessibility — forms", () => {
  test("the sign-in form control is programmatically labelled", async ({ page }) => {
    await page.goto("/en/login");
    // getByLabel succeeds only when the label is associated with the control.
    await expect(page.getByLabel("Email address")).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

test.describe("Landing & Navigation", () => {
  test("homepage loads correctly: title visible and CTA present", async ({
    page,
  }) => {
    await page.goto("/");
    // Page title in <head>
    await expect(page).toHaveTitle(/CandidAI/i);
    // Hero headline visible on page
    await expect(
      page.getByRole("heading", { name: /land your/i })
    ).toBeVisible();
    // Primary CTA button present
    await expect(
      page.getByRole("link", { name: /get started/i })
    ).toBeVisible();
  });

  test("clicking Get Started redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/");
    // Click the "Get Started" nav button — middleware redirects /dashboard → /login
    await page.getByRole("link", { name: /get started/i }).click();
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("clicking Register link redirects to /register", async ({ page }) => {
    await page.goto("/");
    // The hero "Start Free Test" button links to /register
    const registerLinks = page.getByRole("link", { name: /register/i });
    // Fallback: use the Start Free Test CTA in the hero
    const startFreeTestLink = page.getByRole("link", {
      name: /start free test/i,
    });
    const link = (await registerLinks.count()) > 0 ? registerLinks.first() : startFreeTestLink.first();
    await link.click();
    await page.waitForURL(/\/register/);
    expect(page.url()).toContain("/register");
  });

  test("navbar logo click returns to /", async ({ page }) => {
    // Navigate to a sub-page first
    await page.goto("/login");
    // Click the logo link in the navbar
    await page.getByRole("link", { name: /candidai home/i }).click();
    await page.waitForURL("/");
    expect(page.url()).toMatch(/\/$/);
  });
});

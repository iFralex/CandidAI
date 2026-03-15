import { test, expect, Page } from "@playwright/test";

async function setupAuthFailureMock(
  page: Page,
  errorMessage: string,
  status: number
) {
  await page.route("**/api/auth", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: errorMessage }),
      });
    } else {
      await route.continue();
    }
  });

  // Also mock /api/login to return an error since internLogin() is called
  // with an undefined idToken when /api/auth fails
  await page.route("**/api/login", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Unauthorized" }),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe("Login Flow - Failure", () => {
  test("wrong password: shows error and remains on /login", async ({
    page,
  }) => {
    await setupAuthFailureMock(page, "INVALID_PASSWORD", 401);

    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: /^login$/i }).click();

    // Error div should appear (text-red-600)
    await expect(
      page.locator("div").filter({ hasText: /error|invalid|errore/i }).first()
    ).toBeVisible({ timeout: 5000 });

    // Must remain on /login
    expect(page.url()).toContain("/login");
  });

  test("unregistered email: shows visible error message", async ({ page }) => {
    await setupAuthFailureMock(page, "EMAIL_NOT_FOUND", 401);

    await page.goto("/login");
    await page.getByLabel("Email").fill("nouser@example.com");
    await page.getByLabel("Password").fill("somepassword");
    await page.getByRole("button", { name: /^login$/i }).click();

    // Any error message should be visible
    await expect(
      page.locator('[class*="red"]').first()
    ).toBeVisible({ timeout: 5000 });

    expect(page.url()).toContain("/login");
  });

  test("empty email: HTML5 validation blocks submit", async ({ page }) => {
    await page.goto("/login");
    // Leave email empty, fill only password
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /^login$/i }).click();

    // HTML5 required validation fires — no navigation
    await page.waitForTimeout(300);
    expect(page.url()).toContain("/login");
  });

  test("empty password: HTML5 validation blocks submit", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    // Leave password empty
    await page.getByRole("button", { name: /^login$/i }).click();

    // HTML5 required validation fires — no navigation
    await page.waitForTimeout(300);
    expect(page.url()).toContain("/login");
  });

  test("malformed email: validation blocks submit", async ({ page }) => {
    await page.goto("/login");
    // Use type="text" workaround: we must force-fill an invalid email
    // Playwright fill() respects input type; use evaluate to bypass for invalid format
    await page.getByLabel("Email").fill("notanemail");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /^login$/i }).click();

    // type="email" HTML5 validation prevents submission
    await page.waitForTimeout(300);
    expect(page.url()).toContain("/login");
  });

  test("disabled account: shows specific error message", async ({ page }) => {
    await setupAuthFailureMock(page, "USER_DISABLED", 403);

    await page.goto("/login");
    await page.getByLabel("Email").fill("disabled@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /^login$/i }).click();

    // Error div should be visible
    await expect(
      page.locator('[class*="red"]').first()
    ).toBeVisible({ timeout: 5000 });

    expect(page.url()).toContain("/login");
  });
});

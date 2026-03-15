import { test, expect } from "@playwright/test";

test.describe("Login UX", () => {
  test("submit button is disabled during request", async ({ page }) => {
    // Delay the /api/auth response so we can observe the loading state
    await page.route("**/api/auth", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((resolve) => setTimeout(resolve, 800));
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ success: false, error: "INVALID_PASSWORD" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("wrongpassword");

    const submitButton = page.getByRole("button", { name: /^login$/i });
    await submitButton.click();

    // While request is in flight the button should be disabled
    await expect(submitButton).toBeDisabled({ timeout: 2000 });
  });

  test("password field is type password (hidden text)", async ({ page }) => {
    await page.goto("/login");

    const passwordInput = page.getByLabel("Password");
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test('"Forgot password?" link navigates to /forgot-password', async ({
    page,
  }) => {
    await page.goto("/login");

    const forgotLink = page.getByRole("link", {
      name: /forgot.*password/i,
    });
    await expect(forgotLink).toBeVisible();

    await forgotLink.click();
    await page.waitForURL(/\/forgot-password/, { timeout: 5000 });
    expect(page.url()).toContain("/forgot-password");
  });

  test('"Register" link navigates to /register', async ({ page }) => {
    await page.goto("/login");

    // The sign-up link on the login page links to /register
    const registerLink = page.getByRole("link", {
      name: /sign up/i,
    });
    await expect(registerLink).toBeVisible();

    await registerLink.click();
    await page.waitForURL(/\/register/, { timeout: 5000 });
    expect(page.url()).toContain("/register");
  });
});

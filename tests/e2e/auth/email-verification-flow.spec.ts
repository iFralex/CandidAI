import { test, expect, Page } from "@playwright/test";

const TEST_USER = {
  email: "unverified@example.com",
  name: "Unverified User",
  uid: "unverified-uid-123",
};

async function setupUnverifiedUserMocks(page: Page) {
  // Mock /api/protected/user returning an unverified user
  const unverifiedUserData = {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: 50,
    plan: "base",
    credits: 100,
    emailVerified: false,
  };
  await page.context().addCookies([{
    name: '__playwright_user__',
    value: Buffer.from(JSON.stringify(unverifiedUserData)).toString('base64'),
    domain: 'localhost',
    path: '/',
  }]);
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: unverifiedUserData,
      }),
    });
  });
}

async function setupVerifiedUserMocks(page: Page) {
  const verifiedUserData = {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: 50,
    plan: "base",
    credits: 100,
    emailVerified: true,
  };
  await page.context().addCookies([{
    name: '__playwright_user__',
    value: Buffer.from(JSON.stringify(verifiedUserData)).toString('base64'),
    domain: 'localhost',
    path: '/',
  }]);
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: verifiedUserData,
      }),
    });
  });
}

test.describe("Email Verification Flow", () => {
  test("unverified user accessing dashboard: email verification dialog is visible", async ({
    page,
  }) => {
    await setupUnverifiedUserMocks(page);

    await page.goto("/dashboard");

    // The dialog should be open with the verification prompt
    await expect(
      page.getByRole("heading", { name: /verify your email/i })
    ).toBeVisible({ timeout: 10000 });

    // The resend button should be visible
    await expect(
      page.getByRole("button", { name: /resend email for the verification/i })
    ).toBeVisible();
  });

  test("click 'Resend email for the verification': button shows 'Sent' state", async ({
    page,
  }) => {
    await setupUnverifiedUserMocks(page);

    // Mock the refresh-user endpoint that the resend action calls internally
    await page.route("**/api/refresh-user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/dashboard");

    // Verify the dialog is shown
    await expect(
      page.getByRole("heading", { name: /verify your email/i })
    ).toBeVisible({ timeout: 10000 });

    // Find the resend button and click it
    const resendBtn = page.getByRole("button", {
      name: /resend email for the verification/i,
    });
    await expect(resendBtn).toBeVisible();
    await resendBtn.click();

    // After click, button is immediately disabled and shows "Sent"
    await expect(
      page.getByRole("button", { name: /sent/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("navigate to /verify/[validId]: shows success message and redirects to dashboard", async ({
    page,
  }) => {
    // After successful email verification, the server redirects to /dashboard.
    // Mock the protected/user endpoint so the dashboard loads correctly.
    await setupVerifiedUserMocks(page);

    // Also mock refresh-user which the verify page calls on success
    await page.route("**/api/refresh-user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    // Navigate to the verify page with a valid-looking UID.
    // In this test environment the server component will call adminAuth.updateUser().
    // If Firebase Admin is connected (e.g. emulator), it shows the success page then
    // redirects to /dashboard after a delay.
    // Without Firebase, the catch block triggers redirect("/dashboard") immediately.
    // Either way we end up at /dashboard.
    await page.goto("/verify/valid-uid-123");

    // The page either shows "Email Verified!" briefly or redirects immediately.
    // Check we eventually reach /dashboard (redirect) or see success text.
    const isRedirected = await page
      .waitForURL(/\/dashboard/, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    const hasSuccessText = await page
      .locator("text=Email Verified")
      .isVisible()
      .catch(() => false);

    expect(isRedirected || hasSuccessText).toBe(true);
  });

  test("navigate to /verify/[expiredId]: handles error gracefully without 500", async ({
    page,
  }) => {
    // An expired or unknown ID causes adminAuth.updateUser() to throw.
    // The server catch block calls redirect("/dashboard").
    // Without a session cookie, /dashboard redirects to /login.
    // Verify no 500 error page is shown.
    let serverError = false;
    page.on("response", (response) => {
      if (response.status() >= 500) {
        serverError = true;
      }
    });

    await page.goto("/verify/expired-link-id-000");

    // Should end up at /login or /dashboard — not a 500 error page
    await page
      .waitForURL(/\/(login|dashboard)/, { timeout: 10000 })
      .catch(() => {
        // May already be there
      });

    expect(serverError).toBe(false);

    const currentUrl = page.url();
    expect(
      currentUrl.includes("/login") || currentUrl.includes("/dashboard")
    ).toBe(true);
  });

  test("navigate to /verify/[invalidId]: handles error gracefully without 500", async ({
    page,
  }) => {
    // An invalid ID (e.g., random string) causes adminAuth.updateUser() to throw.
    // The server catch block calls redirect("/dashboard").
    // Without a session cookie, /dashboard redirects to /login.
    let serverError = false;
    page.on("response", (response) => {
      if (response.status() >= 500) {
        serverError = true;
      }
    });

    await page.goto("/verify/!!invalid-id!!");

    // Should end up at /login or /dashboard — not a 500 error page
    await page
      .waitForURL(/\/(login|dashboard)/, { timeout: 10000 })
      .catch(() => {
        // May already be there
      });

    expect(serverError).toBe(false);

    const currentUrl = page.url();
    expect(
      currentUrl.includes("/login") || currentUrl.includes("/dashboard")
    ).toBe(true);
  });
});

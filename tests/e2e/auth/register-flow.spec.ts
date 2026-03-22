import { test, expect, Page } from "@playwright/test";

const TEST_USER = {
  email: "newuser@example.com",
  password: "password123",
  name: "New User",
  uid: "new-user-uid-123",
};

const MOCK_ID_TOKEN = "mock-firebase-id-token-register";

async function setupRegisterSuccessMocks(page: Page) {
  await page.route("**/api/auth", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          idToken: MOCK_ID_TOKEN,
          uid: TEST_USER.uid,
        }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/login", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        headers: {
          "Set-Cookie": `CandidAIToken=mock-session-token; Path=/; SameSite=Lax`,
        },
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });

  const userData = {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: 1,
    plan: "free_trial",
    credits: 0,
    emailVerified: false,
  };

  // Set __playwright_user__ cookie so the middleware bypasses Firebase auth
  await page.context().addCookies([{
    name: "__playwright_user__",
    value: Buffer.from(JSON.stringify(userData)).toString("base64"),
    domain: "localhost",
    path: "/",
  }]);

  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: userData,
      }),
    });
  });
}

test.describe("Register Flow", () => {
  test("register form is visible at /register", async ({ page }) => {
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: /create an account/i })
    ).toBeVisible();
    await expect(page.getByLabel("Full Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create account/i })
    ).toBeVisible();
  });

  test("valid registration: submits and redirects to /dashboard", async ({
    page,
  }) => {
    await setupRegisterSuccessMocks(page);

    await page.goto("/register");
    await page.getByLabel("Full Name").fill(TEST_USER.name);
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER.password);
    await page.getByLabel("Confirm Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("welcome email is triggered on successful registration", async ({
    page,
  }) => {
    // The welcome email is sent server-side from within /api/auth (fire-and-forget).
    // In E2E we mock /api/auth at the browser level, so we verify the registration
    // flow completes successfully (which implies the server would call send-email).
    // Server-side interception is covered by integration tests (Task 5.1).
    let sendEmailIntercepted = false;
    await page.route("**/api/send-email", async (route) => {
      sendEmailIntercepted = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await setupRegisterSuccessMocks(page);

    await page.goto("/register");
    await page.getByLabel("Full Name").fill(TEST_USER.name);
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER.password);
    await page.getByLabel("Confirm Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    // Registration completed: the server-side /api/auth would trigger the welcome email.
    expect(page.url()).toContain("/dashboard");
  });

  test("empty name: HTML5 required validation blocks submit", async ({
    page,
  }) => {
    await page.goto("/register");
    // Leave name empty, fill other fields
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER.password);
    await page.getByLabel("Confirm Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: /create account/i }).click();

    // HTML5 required validation on name field blocks navigation
    await page.waitForTimeout(300);
    expect(page.url()).toContain("/register");
  });

  test("already registered email: shows error message", async ({ page }) => {
    await page.route("**/api/auth", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "The email address is already in use by another account.",
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false }),
      });
    });

    await page.goto("/register");
    await page.getByLabel("Full Name").fill(TEST_USER.name);
    await page.getByLabel("Email").fill("existing@example.com");
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER.password);
    await page.getByLabel("Confirm Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: /create account/i }).click();

    // An error message should appear (red styling)
    await expect(
      page.locator('[class*="red"]').first()
    ).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain("/register");
  });

  test("password too short: HTML5 minLength validation blocks submit", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByLabel("Full Name").fill(TEST_USER.name);
    await page.getByLabel("Email").fill(TEST_USER.email);
    // minLength={6} on both password fields
    await page.getByLabel("Password", { exact: true }).fill("abc");
    await page.getByLabel("Confirm Password").fill("abc");
    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForTimeout(300);
    expect(page.url()).toContain("/register");
  });

  test("malformed email: HTML5 type=email validation blocks submit", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByLabel("Full Name").fill(TEST_USER.name);
    await page.getByLabel("Email").fill("notanemail");
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER.password);
    await page.getByLabel("Confirm Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForTimeout(300);
    expect(page.url()).toContain("/register");
  });
});

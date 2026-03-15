import { test, expect, Page } from "@playwright/test";

const TEST_USER = {
  email: "test@example.com",
  password: "password123",
  name: "Test User",
  uid: "test-uid-123",
};

const MOCK_ID_TOKEN = "mock-firebase-id-token-for-testing";

async function setupLoginMocks(page: Page) {
  // Mock /api/auth — returns a fake Firebase idToken
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

  // Mock /api/login — the next-firebase-auth-edge session endpoint that sets the cookie
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

  // Mock /api/protected/user — dashboard layout fetches user data server-side
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: {
          uid: TEST_USER.uid,
          name: TEST_USER.name,
          email: TEST_USER.email,
          onboardingStep: 50,
          plan: "base",
          credits: 100,
          emailVerified: true,
        },
      }),
    });
  });
}

test.describe("Login Flow - Success", () => {
  test("login form is visible at /login", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: /login to your account/i })
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^login$/i })
    ).toBeVisible();
  });

  test("valid credentials: login form submits and redirects to /dashboard", async ({
    page,
  }) => {
    await setupLoginMocks(page);

    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: /^login$/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("CandidAIToken cookie is present after successful login", async ({
    page,
    context,
  }) => {
    await setupLoginMocks(page);

    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);

    // Wait for the /api/login response which sets the session cookie
    const [loginResponse] = await Promise.all([
      page.waitForResponse("**/api/login"),
      page.getByRole("button", { name: /^login$/i }).click(),
    ]);

    expect(loginResponse.status()).toBe(200);

    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name === "CandidAIToken");
    expect(authCookie).toBeDefined();
  });

  test("dashboard header shows logged-in username after successful login", async ({
    page,
  }) => {
    await setupLoginMocks(page);

    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: /^login$/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // The sidebar footer displays the logged-in user's name
    await expect(page.getByText(TEST_USER.name)).toBeVisible();
  });
});

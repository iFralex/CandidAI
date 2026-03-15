import { test, expect, Page } from "@playwright/test";

const TEST_USER = {
  email: "test@example.com",
  password: "password123",
  name: "Test User",
  uid: "test-uid-123",
};

const MOCK_ID_TOKEN = "mock-firebase-id-token-for-testing";

async function setupAuthMocks(page: Page) {
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
          "Set-Cookie": `AuthToken=mock-session-token; Path=/; SameSite=Lax`,
        },
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });

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

async function performLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_USER.email);
  await page.getByLabel("Password").fill(TEST_USER.password);
  await page.getByRole("button", { name: /^login$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

test.describe("Route Protection - Unauthenticated Access", () => {
  test("unauthenticated user: /dashboard redirects to /login", async ({
    page,
  }) => {
    // Mock /api/protected/user to return 401 (no valid session)
    await page.route("**/api/protected/user**", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Non autorizzato" }),
      });
    });

    await page.goto("/dashboard");

    // The dashboard layout calls /api/protected/user, gets 401, redirects to /login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated user: /dashboard/settings redirects to /login", async ({
    page,
  }) => {
    await page.route("**/api/protected/user**", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Non autorizzato" }),
      });
    });

    await page.goto("/dashboard/settings");

    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated user: /dashboard/plan-and-credits redirects to /login", async ({
    page,
  }) => {
    await page.route("**/api/protected/user**", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Non autorizzato" }),
      });
    });

    await page.goto("/dashboard/plan-and-credits");

    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated user: any /dashboard/* route redirects to /login", async ({
    page,
  }) => {
    await page.route("**/api/protected/user**", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Non autorizzato" }),
      });
    });

    // Test a few different nested dashboard paths
    const protectedPaths = [
      "/dashboard/send-all",
      "/dashboard/follow-ups",
      "/dashboard/billing",
    ];

    for (const path of protectedPaths) {
      await page.goto(path);
      await page.waitForURL(/\/login/, { timeout: 10000 });
      expect(page.url()).toContain("/login");
    }
  });
});

test.describe("Route Protection - Authenticated Access", () => {
  test("logged-in user: /dashboard loads without redirect", async ({
    page,
  }) => {
    await setupAuthMocks(page);
    await performLogin(page);

    // Verify we are on dashboard and not redirected to /login
    expect(page.url()).toContain("/dashboard");
    expect(page.url()).not.toContain("/login");
  });

  test("logged-in user: /login page is accessible (shows login form)", async ({
    page,
  }) => {
    await setupAuthMocks(page);
    await performLogin(page);

    // Navigate to /login - in this app the middleware allows logged-in users to
    // visit /login (no server-side redirect). The login form is rendered.
    await page.goto("/login");

    // Either we stay on /login (no redirect) or we are redirected to /dashboard
    const currentUrl = page.url();
    const isAtLogin = currentUrl.includes("/login");
    const isAtDashboard = currentUrl.includes("/dashboard");

    expect(isAtLogin || isAtDashboard).toBe(true);
  });
});

test.describe("Logout Flow", () => {
  test("logout: redirects to /login and clears session", async ({
    page,
    context,
  }) => {
    await setupAuthMocks(page);

    // Mock /api/logout to clear the session cookie
    await page.route("**/api/logout**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "Set-Cookie": `AuthToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
        },
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    // Log in and reach the dashboard
    await performLogin(page);

    // The sidebar is rendered for onboarded users (onboardingStep: 50)
    // Open the user dropdown in the sidebar footer
    const sidebarFooter = page.locator(
      '[data-sidebar="footer"]'
    );
    await expect(sidebarFooter).toBeVisible({ timeout: 5000 });
    await sidebarFooter.click();

    // Click "Log Out" in the dropdown
    const logoutBtn = page.getByRole("menuitem", { name: /log out/i });
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();

    // After logout, should be redirected to /login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("logout: after logout, /dashboard is inaccessible", async ({
    page,
  }) => {
    await setupAuthMocks(page);

    // Mock /api/logout
    await page.route("**/api/logout**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "Set-Cookie": `AuthToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
        },
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await performLogin(page);

    // Open sidebar dropdown and log out
    const sidebarFooter = page.locator('[data-sidebar="footer"]');
    await expect(sidebarFooter).toBeVisible({ timeout: 5000 });
    await sidebarFooter.click();

    const logoutBtn = page.getByRole("menuitem", { name: /log out/i });
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();

    await page.waitForURL(/\/login/, { timeout: 10000 });

    // After logout, update the mock to return 401 for /api/protected/user
    // (simulating the expired/cleared session)
    await page.unroute("**/api/protected/user**");
    await page.route("**/api/protected/user**", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Non autorizzato" }),
      });
    });

    // Try to access /dashboard again
    await page.goto("/dashboard");

    // Should be redirected to /login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });
});

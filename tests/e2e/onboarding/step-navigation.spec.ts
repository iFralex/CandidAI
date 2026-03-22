import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 13.6: Onboarding – Step Navigation
// Tests that step navigation is enforced server-side:
// - Cannot skip steps via URL (step is determined by server-side onboardingStep)
// - onboardingStep=50 means onboarding is done; /dashboard shows full dashboard
// - Completed steps are not shown again when onboardingStep is further along
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "step-nav@example.com",
  name: "Step Navigation Test User",
  uid: "onboard-uid-step-nav",
};

function buildMockUser(step: number, plan: string | null = null) {
  return {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: step,
    plan: plan ?? (step >= 2 ? "base" : null),
    credits: 10,
    emailVerified: true,
  };
}

async function mockUserAtStep(page: Page, step: number, plan?: string | null) {
  await page.context().addCookies([{
    name: '__playwright_user__',
    value: Buffer.from(JSON.stringify(buildMockUser(step, plan))).toString('base64'),
    domain: 'localhost',
    path: '/',
  }]);
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: buildMockUser(step, plan),
      }),
    });
  });
}

async function mockResults(page: Page) {
  await page.route("**/api/protected/results**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {},
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test 1: Cannot skip steps via URL
// A user at step 2 navigating to /dashboard always lands on step 2,
// not a later step — the step is controlled server-side, not by URL.
// ---------------------------------------------------------------------------

test.describe("Onboarding - Step Navigation - Cannot Skip Steps Via URL", () => {
  test("user at step 2 navigating to /dashboard sees step 2, not step 4", async ({
    page,
  }) => {
    await mockUserAtStep(page, 2, "base");
    await page.route("**/api.brandfetch.io/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // Navigate to /dashboard (the only onboarding URL)
    await page.goto("/dashboard");

    // Step 2 content should be visible (Add Companies)
    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });

    // Step 4 content (Setup Complete) should NOT be visible
    await expect(
      page.getByText("Setup Complete")
    ).not.toBeVisible({ timeout: 3000 });
  });

  test("user at step 3 navigating to /dashboard sees step 3, not step 2", async ({
    page,
  }) => {
    await mockUserAtStep(page, 3, "base");

    await page.goto("/dashboard");

    // Step 3 (LinkedIn Profile) should be visible
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });

    // Step 2 (Add Companies) should NOT be visible
    await expect(
      page.getByText("Add Your Target Companies")
    ).not.toBeVisible({ timeout: 3000 });
  });

  test("user at step 1 navigating to /dashboard sees step 1, not step 3", async ({
    page,
  }) => {
    await mockUserAtStep(page, 1, null);

    await page.goto("/dashboard");

    // Step 1 (Plan Selection) should be visible
    await expect(
      page.getByText("Choose Your Success Plan")
    ).toBeVisible({ timeout: 10000 });

    // Step 3 (LinkedIn Profile) should NOT be visible
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).not.toBeVisible({ timeout: 3000 });
  });

  test("user at step 2 cannot reach step 4 by reloading with different user state expectation", async ({
    page,
  }) => {
    // This test verifies that even if a user tries to reload /dashboard
    // (attempting to somehow jump steps), the server always returns the
    // correct step based on stored onboardingStep.
    await mockUserAtStep(page, 2, "base");
    await page.route("**/api.brandfetch.io/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/dashboard");

    // First load: step 2
    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });

    // Reload — server still returns step 2, so step 2 is still shown
    await page.reload();

    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Test 2: onboardingStep=50 → direct access to /dashboard shows full dashboard
// When onboardingStep is 50 (> 10), the user is fully onboarded.
// Accessing /dashboard should render the main dashboard, not onboarding.
// ---------------------------------------------------------------------------

test.describe("Onboarding - Step Navigation - Fully Onboarded User (step=50)", () => {
  test("user with onboardingStep=50 sees the main Dashboard, not onboarding", async ({
    page,
  }) => {
    await mockUserAtStep(page, 50, "base");
    await mockResults(page);

    await page.goto("/dashboard");

    // Main dashboard header should be visible
    await expect(page.getByText("Dashboard").first()).toBeVisible({ timeout: 10000 });

    // Onboarding UI should NOT be present
    await expect(
      page.getByText("Choose Your Success Plan")
    ).not.toBeVisible({ timeout: 3000 });
    await expect(
      page.getByText("Add Your Target Companies")
    ).not.toBeVisible({ timeout: 3000 });
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).not.toBeVisible({ timeout: 3000 });
  });

  test("user with onboardingStep=50 does not see the onboarding progress bar", async ({
    page,
  }) => {
    await mockUserAtStep(page, 50, "base");
    await mockResults(page);

    await page.goto("/dashboard");

    // The progress "Setup Progress: Step X of Y" text should NOT be visible
    await expect(
      page.getByText(/Setup Progress/i)
    ).not.toBeVisible({ timeout: 5000 });
  });

  test("user with onboardingStep=20 (any value > 10) also sees the full dashboard", async ({
    page,
  }) => {
    await mockUserAtStep(page, 20, "base");
    await mockResults(page);

    await page.goto("/dashboard");

    // Main dashboard, not onboarding
    await expect(page.getByText("Dashboard").first()).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText("Choose Your Success Plan")
    ).not.toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Test 3: Completed steps are not shown again if onboardingStep is further along
// If a user is at step 3, they should not see step 1 or step 2 content.
// The onboarding renders only the current step.
// ---------------------------------------------------------------------------

test.describe("Onboarding - Step Navigation - Completed Steps Not Shown Again", () => {
  test("user at step 3 does not see step 1 (plan selection) content", async ({
    page,
  }) => {
    await mockUserAtStep(page, 3, "base");

    await page.goto("/dashboard");

    // Step 3 visible
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });

    // Step 1 not visible
    await expect(
      page.getByText("Choose Your Success Plan")
    ).not.toBeVisible({ timeout: 3000 });
  });

  test("user at step 4 does not see step 1, 2, or 3 content", async ({
    page,
  }) => {
    // Use "pro" plan: for free_trial, step 4 auto-executes server-side (submitQueries)
    // which requires real Firebase auth. Pro plan shows the Advanced Recruiter Filters UI.
    await mockUserAtStep(page, 4, "pro");

    await page.goto("/dashboard");

    // Step 4 with pro plan shows Advanced Recruiter Filters
    await expect(
      page.getByText("Advanced Recruiter Filters")
    ).toBeVisible({ timeout: 10000 });

    // Earlier steps should not be visible
    await expect(
      page.getByText("Choose Your Success Plan")
    ).not.toBeVisible({ timeout: 3000 });

    await expect(
      page.getByText("Add Your Target Companies")
    ).not.toBeVisible({ timeout: 3000 });

    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).not.toBeVisible({ timeout: 3000 });
  });

  test("user at step 6 (payment) does not see steps 1-5 content", async ({
    page,
  }) => {
    await mockUserAtStep(page, 6, "base");
    await page.route("**/api/create-payment**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          client_secret: "pi_mock_nav_secret",
          type: "one_time",
          amount: 3000,
        }),
      });
    });

    await page.goto("/dashboard");

    // Step 6 — payment
    await expect(
      page.getByText("Complete Your Purchase")
    ).toBeVisible({ timeout: 15000 });

    // Earlier steps should not be visible
    await expect(
      page.getByText("Choose Your Success Plan")
    ).not.toBeVisible({ timeout: 3000 });

    await expect(
      page.getByText("Add Your Target Companies")
    ).not.toBeVisible({ timeout: 3000 });

    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).not.toBeVisible({ timeout: 3000 });
  });

  test("user at step 2 does not see step 3, 4, or 6 content", async ({
    page,
  }) => {
    await mockUserAtStep(page, 2, "base");
    await page.route("**/api.brandfetch.io/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/dashboard");

    // Step 2 visible
    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });

    // Future steps should not be visible
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).not.toBeVisible({ timeout: 3000 });

    await expect(
      page.getByText("Complete Your Purchase")
    ).not.toBeVisible({ timeout: 3000 });
  });
});

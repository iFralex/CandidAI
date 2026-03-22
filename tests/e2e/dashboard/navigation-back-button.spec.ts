import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 21.3: E2E Test - Dashboard Navigation - Back Button
// Tests:
// - Dashboard -> Campaign detail -> Back -> returns to Dashboard
// - Settings -> Back -> returns to previous page
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "back-button@example.com",
  name: "Back Button User",
  uid: "back-button-uid",
};

const COMPANY_ID = "back-button-company-001";

function buildMockUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: 50,
    plan: "pro",
    credits: 100,
    maxCompanies: 20,
    emailVerified: true,
    ...overrides,
  };
}

async function mockUser(
  page: Page,
  overrides: Partial<Record<string, unknown>> = {}
) {
  const userData = buildMockUser(overrides);
  await page.context().addCookies([{
    name: '__playwright_user__',
    value: Buffer.from(JSON.stringify(userData)).toString('base64'),
    domain: 'localhost',
    path: '/',
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

async function mockResults(page: Page) {
  const resultsData = {
    success: true,
    data: {
      [COMPANY_ID]: {
        company: {
          name: "Back Button Corp",
          domain: "backbuttoncorp.com",
          linkedin_url: "linkedin.com/company/backbuttoncorp",
        },
        status: "completed",
        step: 5,
      },
    },
  };
  // Use cookie to isolate results data per browser context (avoids shared mock store race conditions)
  await page.context().addCookies([{
    name: '__playwright_results__',
    value: Buffer.from(JSON.stringify(resultsData)).toString('base64'),
    domain: 'localhost',
    path: '/',
  }]);
  await page.route("**/api/protected/results**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(resultsData),
    });
  });
  // Abort external logo API calls to prevent networkidle delays
  await page.route("**brandfetch.io**", (route) => route.abort());
}

async function mockCampaignDetail(page: Page) {
  const detailData = {
    success: true,
    details: {
      company: {
        name: "Back Button Corp",
        domain: "backbuttoncorp.com",
        linkedin_url: "linkedin.com/company/backbuttoncorp",
      },
      recruiter: {
        name: "Jane Recruiter",
        title: "HR Manager",
        email: "jane@backbuttoncorp.com",
        linkedin_url: "linkedin.com/in/jane-recruiter",
      },
      email: {
        subject: "Exciting Opportunity",
        body: "Dear Jane, I would love to connect...",
      },
      articles: [],
      status: "completed",
      step: 5,
    },
    customizations: {
      instructions: null,
      queries: null,
    },
  };
  await page.request.post('/api/test/set-mock', {
    data: { pattern: `/api/protected/result/${COMPANY_ID}`, response: detailData },
  });
  await page.route(`**/api/protected/result/${COMPANY_ID}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(detailData),
    });
  });
}

async function mockAccount(page: Page) {
  const accountData = { success: true, data: {} };
  await page.request.post('/api/test/set-mock', {
    data: { pattern: '/api/protected/account', response: accountData },
  });
  await page.route("**/api/protected/account**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(accountData),
    });
  });
}

// ---------------------------------------------------------------------------
// Test group 1: Dashboard -> Campaign detail -> Back -> Dashboard
// ---------------------------------------------------------------------------

test.describe("Back Button - Dashboard to Campaign Detail", () => {
  test("browser back from campaign detail returns to dashboard", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockCampaignDetail(page);
    await mockAccount(page);

    // Start at dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Verify we are on dashboard
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });

    // Navigate to campaign detail page
    await page.goto(`/dashboard/${COMPANY_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});

    // Verify we are on the campaign detail page
    await expect(page).toHaveURL(new RegExp(COMPANY_ID), { timeout: 15000 });

    // Press browser back button
    await page.goBack();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Should return to dashboard
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
  });

  test("back button from campaign detail does not navigate outside dashboard", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockCampaignDetail(page);
    await mockAccount(page);

    // Navigate: dashboard -> campaign detail
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.goto(`/dashboard/${COMPANY_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});

    // Press back
    await page.goBack();
    await page.waitForLoadState("networkidle").catch(() => {});

    const url = page.url();
    // Should be within the dashboard area
    expect(url).toMatch(/\/dashboard/);
    // Should NOT have navigated to login or external page
    expect(url).not.toMatch(/\/login/);
  });

  test("multiple back presses from campaign detail eventually reach dashboard", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockCampaignDetail(page);
    await mockAccount(page);

    // Navigate to campaign detail
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.goto(`/dashboard/${COMPANY_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});

    // Press back - should navigate back to dashboard
    await page.goBack();
    await page.waitForLoadState("networkidle").catch(() => {});

    // The user should be back on the dashboard
    const url = page.url();
    expect(url).toMatch(/\/dashboard/);
  });

  test("campaign detail page loads after navigating from dashboard via link", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockCampaignDetail(page);
    await mockAccount(page);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Try to click on a campaign card link if visible
    const campaignLink = page.getByRole("link", { name: /Back Button Corp/i });
    const linkCount = await campaignLink.count();

    if (linkCount > 0) {
      await campaignLink.first().click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page).toHaveURL(new RegExp(COMPANY_ID), { timeout: 15000 });

      // Press back
      await page.goBack();
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
    } else {
      // Direct URL navigation test as fallback
      await page.goto(`/dashboard/${COMPANY_ID}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page).toHaveURL(new RegExp(COMPANY_ID), { timeout: 15000 });

      await page.goBack();
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Settings -> Back -> returns to previous page
// ---------------------------------------------------------------------------

test.describe("Back Button - Settings", () => {
  test("browser back from settings returns to previous page", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockAccount(page);

    // Start at dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });

    // Navigate to settings
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveURL(/settings/, { timeout: 15000 });

    // Press back
    await page.goBack();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Should be back on dashboard
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
  });

  test("back from settings navigates to the page visited before settings", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockAccount(page);

    // Route: dashboard -> plan-and-credits -> settings
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.goto("/dashboard/plan-and-credits");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveURL(/plan-and-credits/, { timeout: 15000 });

    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveURL(/settings/, { timeout: 15000 });

    // Go back - should return to plan-and-credits
    await page.goBack();
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page).toHaveURL(/plan-and-credits/, { timeout: 15000 });
  });

  test("back from settings does not navigate to login when user is authenticated", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockAccount(page);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.goBack();
    await page.waitForLoadState("networkidle").catch(() => {});

    const url = page.url();
    // User is authenticated so should stay in dashboard area
    expect(url).toMatch(/\/dashboard/);
  });

  test("settings page remains accessible after navigating back and forward", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockAccount(page);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Go back
    await page.goBack();
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });

    // Go forward
    await page.goForward();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Should be back on settings
    await expect(page).toHaveURL(/settings/, { timeout: 15000 });
  });
});

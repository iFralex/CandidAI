import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 14.3: E2E Test - Main Dashboard - Companies To Confirm
// Tests:
// - Section "Companies To Confirm" visible when companies_to_confirm not empty
// - List shown with data (company names and details)
// - Click "Confirm" -> company marked as confirmed (Confirmed badge visible)
// - Click "Wrong Company" -> dialog form to update company data
// - Correct confirmation: company removed from list (section gone on reload)
// - Cancel: company remains in list (unselected state after cancellation)
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "dashboard-confirm@example.com",
  name: "Dashboard Confirm User",
  uid: "dashboard-uid-confirm",
};

function buildMockUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: 50,
    plan: "base",
    credits: 100,
    emailVerified: true,
    ...overrides,
  };
}

async function mockUser(
  page: Page,
  overrides: Partial<Record<string, unknown>> = {}
) {
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: buildMockUser(overrides),
      }),
    });
  });
}

/**
 * Mock /api/protected/results with one company in companies_to_confirm and
 * one active campaign.
 */
async function mockResultsWithConfirm(page: Page) {
  await page.route("**/api/protected/results**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          companies_to_confirm: ["ctc-company-id-1"],
          // Active campaign not in companies_to_confirm
          "active-company-id-1": {
            company: { name: "Active Corp", domain: "activecorp.com" },
            recruiter: { name: "John Doe", job_title: "HR Director" },
            blog_articles: 2,
            start_date: { _seconds: 1700000000, _nanoseconds: 0 },
          },
        },
      }),
    });
  });
}

/**
 * Mock /api/protected/results with two companies in companies_to_confirm to
 * verify that multiple entries are listed.
 */
async function mockResultsWithMultipleConfirm(page: Page) {
  await page.route("**/api/protected/results**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          companies_to_confirm: ["ctc-company-id-1", "ctc-company-id-2"],
          "active-company-id-1": {
            company: { name: "Active Corp", domain: "activecorp.com" },
            blog_articles: 1,
            start_date: { _seconds: 1700000000, _nanoseconds: 0 },
          },
        },
      }),
    });
  });
}

/**
 * Mock /api/protected/results with NO companies_to_confirm (absent key means
 * no pending confirmations).
 */
async function mockResultsWithoutConfirm(page: Page) {
  await page.route("**/api/protected/results**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          "active-company-id-1": {
            company: { name: "Active Corp", domain: "activecorp.com" },
            blog_articles: 1,
            start_date: { _seconds: 1700000000, _nanoseconds: 0 },
          },
        },
      }),
    });
  });
}

/** Mock /api/protected/all_details POST for one company */
async function mockAllDetails(page: Page) {
  await page.route("**/api/protected/all_details**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          {
            companyId: "ctc-company-id-1",
            data: {
              company_info: {
                display_name: "Confirm Corp",
                name: "Confirm Corp",
                website: "confirmcorp.com",
                headline: "An innovative company awaiting confirmation",
                location: { name: "San Francisco, CA" },
                employee_count: 500,
                industry_v2: "Technology",
              },
              company: {
                name: "Confirm Corp",
                domain: "confirmcorp.com",
                linkedin_url:
                  "https://linkedin.com/company/confirmcorp",
              },
            },
          },
        ],
      }),
    });
  });
}

/** Mock /api/protected/all_details POST for two companies */
async function mockAllDetailsMultiple(page: Page) {
  await page.route("**/api/protected/all_details**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          {
            companyId: "ctc-company-id-1",
            data: {
              company_info: {
                display_name: "Confirm Corp",
                name: "Confirm Corp",
                website: "confirmcorp.com",
              },
              company: {
                name: "Confirm Corp",
                domain: "confirmcorp.com",
              },
            },
          },
          {
            companyId: "ctc-company-id-2",
            data: {
              company_info: {
                display_name: "Second Confirm Corp",
                name: "Second Confirm Corp",
                website: "secondconfirmcorp.com",
              },
              company: {
                name: "Second Confirm Corp",
                domain: "secondconfirmcorp.com",
              },
            },
          },
        ],
      }),
    });
  });
}

/** Mock /api/protected/account GET */
async function mockAccount(page: Page) {
  await page.route("**/api/protected/account**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          queries: [
            { name: "Software Engineer", domain: "tech", icon: null },
          ],
          customizations: {
            instructions: "Default email instructions for outreach",
          },
        },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test group 1: Section visibility
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Companies To Confirm - Section Visibility", () => {
  test('section "Companies To Be Confirmed" is visible when companies_to_confirm is not empty', async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: /Companies To Be Confirmed/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("companies_to_confirm count badge is shown in section header", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    // Badge shows "1 total" for one company
    await expect(page.getByText(/1 total/i)).toBeVisible({ timeout: 10000 });
  });

  test("section is NOT shown when companies_to_confirm is absent", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithoutConfirm(page);
    // no need to mock all_details/account since section won't render

    await page.goto("/dashboard");

    // Wait for page to load (Active Campaigns heading always present)
    await expect(
      page.getByRole("heading", { name: /Active Campaigns/i })
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole("heading", { name: /Companies To Be Confirmed/i })
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test group 2: List shown with data
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Companies To Confirm - List With Data", () => {
  test("company name is shown in the confirm section", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });
  });

  test("multiple companies are shown when companies_to_confirm has multiple entries", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithMultipleConfirm(page);
    await mockAllDetailsMultiple(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Second Confirm Corp")).toBeVisible({
      timeout: 10000,
    });
  });

  test("company card shows Confirm and Wrong Company buttons", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    // Both action buttons should be visible
    await expect(
      page.getByRole("button", { name: /^Confirm$/i }).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: /Wrong Company/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Confirm button interaction
// ---------------------------------------------------------------------------

test.describe('Main Dashboard - Companies To Confirm - "Confirm" Button', () => {
  test("clicking Confirm shows a Confirmed badge on the company card", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    // Wait for company to load
    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    // Click the Confirm button
    await page.getByRole("button", { name: /^Confirm$/i }).first().click();

    // "Confirmed" selection badge should appear
    await expect(page.getByText(/Confirmed/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("clicking Confirm replaces action buttons with Cancel Selection", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: /^Confirm$/i }).first().click();

    // Cancel Selection button should be visible
    await expect(
      page.getByRole("button", { name: /Cancel Selection/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("floating action bar appears with pending count after Confirm click", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: /^Confirm$/i }).first().click();

    // Floating bar shows "N changes pending"
    await expect(page.getByText(/changes pending/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("floating bar shows confirmed count after Confirm click", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: /^Confirm$/i }).first().click();

    // Floating bar shows "1 confirmed"
    await expect(page.getByText(/1 confirmed/i)).toBeVisible({
      timeout: 5000,
    });
  });
});

// ---------------------------------------------------------------------------
// Test group 4: Wrong Company button interaction (form to update company data)
// ---------------------------------------------------------------------------

test.describe('Main Dashboard - Companies To Confirm - "Wrong Company" Form', () => {
  test('clicking "Wrong Company" opens a dialog form to update company data', async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    // Click Wrong Company
    await page
      .getByRole("button", { name: /Wrong Company/i })
      .first()
      .click();

    // Dialog should open with the form
    await expect(
      page.getByRole("dialog")
    ).toBeVisible({ timeout: 5000 });
  });

  test("dialog form has fields for company name, domain, and LinkedIn URL", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    await page
      .getByRole("button", { name: /Wrong Company/i })
      .first()
      .click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Form fields visible
    await expect(page.getByLabel(/New name/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel(/New domain/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByLabel(/New LinkedIn URL/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("dialog form has Cancel and Confirm Changes buttons", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    await page
      .getByRole("button", { name: /Wrong Company/i })
      .first()
      .click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole("button", { name: /Confirm Changes/i })
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: /Cancel/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("dialog form is pre-filled with existing company name", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    await page
      .getByRole("button", { name: /Wrong Company/i })
      .first()
      .click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // The name field should be pre-filled with "Confirm Corp"
    await expect(page.getByLabel(/New name/i)).toHaveValue("Confirm Corp", {
      timeout: 5000,
    });
  });

  test("cancelling the Wrong Company dialog keeps the company in the list unselected", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    // Open Wrong Company dialog
    await page
      .getByRole("button", { name: /Wrong Company/i })
      .first()
      .click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Close dialog with Cancel
    await page
      .getByRole("button", { name: /Cancel/i })
      .first()
      .click();

    // Dialog should be closed
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Company card is still in the list
    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 5000,
    });

    // Original buttons (Confirm, Wrong Company) should be back
    await expect(
      page.getByRole("button", { name: /^Confirm$/i }).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: /Wrong Company/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 5: Cancel Selection - company remains in list
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Companies To Confirm - Cancel Selection", () => {
  test("Cancel Selection after Confirm restores company to unselected state", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    // Click Confirm to select the company
    await page.getByRole("button", { name: /^Confirm$/i }).first().click();

    // Verified: Confirmed badge is visible
    await expect(page.getByText(/Confirmed/i).first()).toBeVisible({
      timeout: 5000,
    });

    // Click Cancel Selection to undo
    await page
      .getByRole("button", { name: /Cancel Selection/i })
      .click();

    // Confirmed badge should no longer be visible
    await expect(page.getByText(/^Confirmed$/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Company card is still in the list
    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 5000,
    });
  });

  test("Cancel Selection after Confirm restores original action buttons", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: /^Confirm$/i }).first().click();
    await expect(
      page.getByRole("button", { name: /Cancel Selection/i })
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Cancel Selection/i }).click();

    // Original Confirm and Wrong Company buttons should be back
    await expect(
      page.getByRole("button", { name: /^Confirm$/i }).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: /Wrong Company/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("floating action bar disappears after Cancel Selection", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: /^Confirm$/i }).first().click();

    // Floating bar visible after selection
    await expect(page.getByText(/changes pending/i)).toBeVisible({
      timeout: 5000,
    });

    await page.getByRole("button", { name: /Cancel Selection/i }).click();

    // Floating bar should disappear
    await expect(page.getByText(/changes pending/i)).not.toBeVisible({
      timeout: 5000,
    });
  });
});

// ---------------------------------------------------------------------------
// Test group 6: Correct confirmation - company processed and removed from list
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Companies To Confirm - Correct Confirmation", () => {
  test("section disappears on reload when companies_to_confirm is empty", async ({
    page,
  }) => {
    // First load: show companies_to_confirm section
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: /Companies To Be Confirmed/i })
    ).toBeVisible({ timeout: 10000 });

    // Simulate that after confirmation, the server no longer returns
    // companies_to_confirm - reload with updated mock
    await page.unroute("**/api/protected/results**");
    await mockResultsWithoutConfirm(page);

    await page.reload();

    // Active Campaigns heading should still be present
    await expect(
      page.getByRole("heading", { name: /Active Campaigns/i })
    ).toBeVisible({ timeout: 10000 });

    // Companies To Be Confirmed section should be gone
    await expect(
      page.getByRole("heading", { name: /Companies To Be Confirmed/i })
    ).not.toBeVisible({ timeout: 5000 });
  });

  test("Save All button is visible in the floating bar after confirming a company", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithConfirm(page);
    await mockAllDetails(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: /^Confirm$/i }).first().click();

    // Save All button should appear in the floating action bar
    await expect(
      page.getByRole("button", { name: /Save All/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("Reset button in floating bar clears all pending selections", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithMultipleConfirm(page);
    await mockAllDetailsMultiple(page);
    await mockAccount(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Confirm Corp")).toBeVisible({
      timeout: 10000,
    });

    // Confirm all visible companies
    const confirmButtons = page.getByRole("button", {
      name: /^Confirm$/i,
    });
    const count = await confirmButtons.count();
    for (let i = 0; i < count; i++) {
      // Re-query because the DOM changes after each click
      await page
        .getByRole("button", { name: /^Confirm$/i })
        .first()
        .click();
    }

    // Floating bar should be visible
    await expect(page.getByText(/changes pending/i)).toBeVisible({
      timeout: 5000,
    });

    // Click Reset
    await page.getByRole("button", { name: /Reset/i }).click();

    // Floating bar should disappear
    await expect(page.getByText(/changes pending/i)).not.toBeVisible({
      timeout: 5000,
    });
  });
});

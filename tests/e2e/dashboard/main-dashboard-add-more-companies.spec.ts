import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 14.4: E2E Test - Main Dashboard - Add More Companies
// Tests:
// - Click "Add More Companies" -> dialog opens
// - Enter valid companies -> submit -> dialog closes -> list updated
// - Invalid domain -> inline error
// - Duplicate domain -> "Already in list" error (code silently ignores)
// - Attempt adding beyond limit -> "Limit Reached" error shown inline
// - Cancel dialog -> no changes
// - ESC key -> closes dialog
// - Click outside dialog -> closes dialog
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "dashboard-add-companies@example.com",
  name: "Dashboard Add Companies User",
  uid: "dashboard-uid-add-companies",
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

async function mockResults(page: Page) {
  await page.route("**/api/protected/results**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
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
 * Mock the brandfetch autocomplete API to return no results.
 * This prevents external API calls during tests.
 */
async function mockBrandfetchEmpty(page: Page) {
  await page.route("https://api.brandfetch.io/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

/**
 * Mock the Next.js server action POST to /dashboard.
 * Returns a successful action response so the component receives
 * { success: true } and closes the dialog.
 *
 * The response uses the React Flight format for server action returns:
 *   0:["$@1"]    -> root references element 1
 *   1:{...}      -> element 1 is the action's return value
 */
async function mockAddCompaniesSuccess(page: Page) {
  await page.route("**/dashboard", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().headers()["next-action"]
    ) {
      await route.fulfill({
        status: 200,
        contentType: "text/x-component",
        body: '1:{"success":true}\n0:["$@1"]\n',
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock the Next.js server action POST to return a limit-exceeded error.
 * The component will call setError() with the error message, showing it inline.
 */
async function mockAddCompaniesLimitError(page: Page) {
  await page.route("**/dashboard", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().headers()["next-action"]
    ) {
      await route.fulfill({
        status: 200,
        contentType: "text/x-component",
        body: '1:{"success":false,"error":"Exceeds plan limit (3/3 used)."}\n0:["$@1"]\n',
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Navigate to the dashboard and wait for the Active Campaigns section.
 * This ensures the "Add More Companies" button is visible and clickable.
 */
async function gotoAndWait(page: Page) {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Active Campaigns/i })
  ).toBeVisible({ timeout: 10000 });
}

/**
 * Open the "Add More Companies" dialog by clicking the trigger button.
 */
async function openDialog(page: Page) {
  await page.getByRole("button", { name: /Add More Companies/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
}

/**
 * Add a company to the dialog chip list via a LinkedIn URL.
 * LinkedIn URLs bypass the brandfetch API and use the handleAddRawInput path.
 *
 * Steps:
 *   1. Type the LinkedIn URL into the search input
 *   2. Click the "Add from LinkedIn URL" dropdown option
 */
async function addCompanyViaLinkedIn(
  page: Page,
  slug: string = "testcorp"
) {
  const linkedinUrl = `https://linkedin.com/company/${slug}`;
  const input = page.getByRole("dialog").getByRole("textbox");
  await input.click();
  await input.fill(linkedinUrl);
  // The CompanyAutocomplete shows an "Add from LinkedIn URL" option
  // when the input value contains "linkedin.com/company/"
  await page.getByText(`Add "${linkedinUrl}"`).click();
}

// ---------------------------------------------------------------------------
// Test group 1: Dialog opens
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Add More Companies - Dialog Open", () => {
  test('clicking "Add More Companies" button opens the dialog', async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);
  });

  test("dialog has title 'Add Target Companies'", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: /Add Target Companies/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("dialog shows 'No companies selected yet' placeholder initially", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    await expect(
      page.getByRole("dialog").getByText(/No companies selected yet/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("submit button is disabled when no companies selected", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    // Submit button contains "Companies" text and is disabled with 0 selection
    const submitBtn = page
      .getByRole("dialog")
      .getByRole("button", { name: /Add.*Compan/i });
    await expect(submitBtn).toBeDisabled({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Dialog dismiss (Cancel, ESC, click outside)
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Add More Companies - Dialog Dismiss", () => {
  test("Cancel button closes the dialog", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Cancel/i })
      .click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
  });

  test("pressing ESC closes the dialog", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
  });

  test("clicking outside the dialog (backdrop) closes it", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    // Click on the top-left corner, which is outside the dialog content
    await page.mouse.click(10, 10);

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
  });

  test("cancelling dialog does not show the typed company in the main page", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    // Add a company chip inside the dialog
    await addCompanyViaLinkedIn(page, "canceltest");

    // Verify chip appeared inside dialog
    await expect(
      page.getByRole("dialog").getByText(/Canceltest/i)
    ).toBeVisible({ timeout: 5000 });

    // Cancel without submitting
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Cancel/i })
      .click();

    // Dialog should be closed
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Active Campaigns section should still be visible (no new company added)
    await expect(
      page.getByRole("heading", { name: /Active Campaigns/i })
    ).toBeVisible({ timeout: 5000 });
    // Canceltest company should NOT appear in the campaigns list
    await expect(
      page.locator('[data-slot="card"]').filter({ hasText: "Canceltest" })
    ).not.toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Company selection (client-side chip behavior)
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Add More Companies - Company Selection", () => {
  test("typing a LinkedIn URL shows 'Add from LinkedIn URL' dropdown option", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    const linkedinUrl = "https://linkedin.com/company/google";
    const input = page.getByRole("dialog").getByRole("textbox");
    await input.click();
    await input.fill(linkedinUrl);

    await expect(
      page.getByText(`Add "${linkedinUrl}"`)
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(/Add from LinkedIn URL/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("clicking the LinkedIn URL option adds a company chip to the list", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    await addCompanyViaLinkedIn(page, "google");

    // Placeholder text should be replaced by the chip
    await expect(
      page.getByRole("dialog").getByText(/No companies selected yet/i)
    ).not.toBeVisible({ timeout: 5000 });

    // Chip with company name "Google" should be visible
    await expect(
      page.getByRole("dialog").getByText("Google")
    ).toBeVisible({ timeout: 5000 });
  });

  test("adding the same LinkedIn URL twice does not create a duplicate chip", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    // Add first time
    await addCompanyViaLinkedIn(page, "google");
    await expect(
      page.getByRole("dialog").getByText("Google")
    ).toBeVisible({ timeout: 5000 });

    // Try to add the same company again
    await addCompanyViaLinkedIn(page, "google");

    // Submit button should still say "Add 1 Company" (not "Add 2 Companies")
    // because the duplicate was silently rejected
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: /Add 1 Company/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("company chip can be removed by clicking its X button", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    await addCompanyViaLinkedIn(page, "google");
    await expect(
      page.getByRole("dialog").getByText("Google")
    ).toBeVisible({ timeout: 5000 });

    // Find and click the remove (X) button on the chip
    // The chip contains "Google" text and a button sibling
    const chip = page
      .getByRole("dialog")
      .locator("div")
      .filter({ hasText: /^Google$/ })
      .first();
    await chip.getByRole("button").click();

    // Chip removed; placeholder shows again
    await expect(
      page.getByRole("dialog").getByText(/No companies selected yet/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("submit button becomes enabled after adding at least one company", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    const submitBtn = page
      .getByRole("dialog")
      .getByRole("button", { name: /Add.*Compan/i });

    // Disabled initially
    await expect(submitBtn).toBeDisabled({ timeout: 5000 });

    // Add a company
    await addCompanyViaLinkedIn(page, "google");

    // Now enabled
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
  });

  test("submit button label reflects the number of selected companies", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);

    await gotoAndWait(page);
    await openDialog(page);

    await addCompanyViaLinkedIn(page, "google");
    // 1 company: "Add 1 Company"
    await expect(
      page.getByRole("dialog").getByRole("button", { name: /Add 1 Company/i })
    ).toBeVisible({ timeout: 5000 });

    await addCompanyViaLinkedIn(page, "microsoft");
    // 2 companies: "Add 2 Companies"
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: /Add 2 Companies/i })
    ).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 4: Submit - valid companies (uses server action mock)
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Add More Companies - Valid Submit", () => {
  test("submit button shows loading state ('Adding...') when clicked", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);
    await mockAddCompaniesSuccess(page);

    await gotoAndWait(page);
    await openDialog(page);

    await addCompanyViaLinkedIn(page, "google");

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Add 1 Company/i })
      .click();

    // While pending, the button label changes to "Adding..."
    await expect(
      page.getByRole("dialog").getByText(/Adding\.\.\./i)
    ).toBeVisible({ timeout: 3000 });
  });

  test("dialog closes after successful submission", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);
    await mockAddCompaniesSuccess(page);

    await gotoAndWait(page);
    await openDialog(page);

    await addCompanyViaLinkedIn(page, "google");

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Add 1 Company/i })
      .click();

    // After a successful server action response, the dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 5: Submit - server returns error (limit exceeded / invalid)
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Add More Companies - Server Error", () => {
  test("server limit error is shown as inline error message in the dialog", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);
    await mockAddCompaniesLimitError(page);

    await gotoAndWait(page);
    await openDialog(page);

    await addCompanyViaLinkedIn(page, "google");

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Add 1 Company/i })
      .click();

    // Inline error from the server action should appear inside the dialog
    await expect(
      page.getByRole("dialog").getByText(/Exceeds plan limit/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("dialog remains open when the server returns an error", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);
    await mockBrandfetchEmpty(page);
    await mockAddCompaniesLimitError(page);

    await gotoAndWait(page);
    await openDialog(page);

    await addCompanyViaLinkedIn(page, "google");

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Add 1 Company/i })
      .click();

    // Error shown, dialog must still be visible (not closed)
    await expect(
      page.getByRole("dialog").getByText(/Exceeds plan limit/i)
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  });
});

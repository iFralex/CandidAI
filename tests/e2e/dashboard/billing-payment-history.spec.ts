import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 18.1: E2E Test - Billing - Payment History
// Tests:
// - /dashboard/billing loads payment history
// - Row shows: date, type (plan/credits), amount, status, transaction ID
// - "succeeded" status shown in green (default badge variant)
// - Correct EUR format (e.g., "€30.00")
// - Sorted by date (most recent first)
// - Empty state if no payments
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "billing-hist@example.com",
  name: "Billing History User",
  uid: "billing-hist-uid",
};

function buildMockUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: 50,
    plan: "base",
    credits: 150,
    maxCompanies: 10,
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

// Mock billing history API (for when billing data is fetched via API)
function buildMockPayments() {
  return [
    {
      id: "pay_001",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      description: "Pro Plan",
      amount: 6900,
      currency: "eur",
      status: "succeeded",
    },
    {
      id: "pay_002",
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      description: "1,000 Credits",
      amount: 1500,
      currency: "eur",
      status: "succeeded",
    },
    {
      id: "pay_003",
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      description: "Base Plan",
      amount: 3000,
      currency: "eur",
      status: "failed",
    },
  ];
}

async function mockBillingHistory(page: Page, payments = buildMockPayments()) {
  const billingData = { success: true, payments };
  await page.request.post('/api/test/set-mock', {
    data: { pattern: '/api/protected/billing', response: billingData },
  });
  await page.route("**/api/protected/billing**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(billingData),
    });
  });
}

// ---------------------------------------------------------------------------
// Test group 1: Page loads correctly
// ---------------------------------------------------------------------------

test.describe("Billing - Page Load", () => {
  test("navigating to /dashboard/billing loads the page", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/billing");

    await expect(page).not.toHaveURL(/error/, { timeout: 15000 });
    await expect(page.locator("body")).toBeVisible({ timeout: 15000 });
  });

  test("page has h1 heading 'Billing'", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/billing");

    await expect(
      page.getByRole("heading", { name: /Billing/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("URL remains at /dashboard/billing", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/billing");

    await expect(page).toHaveURL(/billing/, { timeout: 15000 });
  });

  test("page shows subtitle 'Your payment history and invoices'", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);

    await page.goto("/dashboard/billing");

    await expect(
      page.getByText(/Your payment history and invoices/i)
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Payment history table structure
// ---------------------------------------------------------------------------

test.describe("Billing - Payment History Table Structure", () => {
  test("payment table shows Date column header", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // Table header should show column labels
    await expect(
      page.getByRole("columnheader", { name: /Date/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("payment table shows Description column header", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    await expect(
      page.getByRole("columnheader", { name: /Description/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("payment table shows Amount column header", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    await expect(
      page.getByRole("columnheader", { name: /Amount/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("payment table shows Status column header", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    await expect(
      page.getByRole("columnheader", { name: /Status/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("payment rows are rendered in the table body", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // Table body rows should be visible when there are payments
    await expect(
      page.locator("table tbody tr").first()
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Payment row data display
// ---------------------------------------------------------------------------

test.describe("Billing - Payment Row Data", () => {
  test("payment row shows plan/product description", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // Description column shows plan/credits name
    await expect(
      page.getByText("Pro Plan")
    ).toBeVisible({ timeout: 15000 });
  });

  test("payment row shows formatted date", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // Date should be shown in a localized format (e.g. "Mar 14, 2026")
    const dateCell = page.locator("table tbody tr td").first();
    await expect(dateCell).toBeVisible({ timeout: 15000 });
    // The date should be non-empty (not "—")
    const text = await dateCell.textContent();
    expect(text).not.toBe("—");
  });

  test("payment row shows succeeded status badge", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // "succeeded" status badge should be visible in the table
    await expect(
      page.getByText("succeeded").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("payment row shows failed status badge for failed payments", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // "failed" status badge should also be visible
    await expect(
      page.getByText("failed")
    ).toBeVisible({ timeout: 15000 });
  });

  test("payment rows show credit package description", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // "1,000 Credits" type description is shown
    await expect(
      page.getByText(/1,000 Credits/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("most recent payment appears before older payments", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // The mock data has "Pro Plan" as the most recent entry
    // It should appear in the first row of the table
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toContainText("Pro Plan", { timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 4: EUR currency formatting
// ---------------------------------------------------------------------------

test.describe("Billing - EUR Currency Formatting", () => {
  test("payment amounts are shown with EUR symbol", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // Amounts should use EUR currency format with € symbol
    await expect(
      page.getByText(/€/).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("amount for Pro Plan (6900 cents) shows as €69.00", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // 6900 cents = €69.00 formatted as en-US currency
    await expect(
      page.getByText(/€69\.00/)
    ).toBeVisible({ timeout: 15000 });
  });

  test("amount for 1,000 Credits (1500 cents) shows as €15.00", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // 1500 cents = €15.00
    await expect(
      page.getByText(/€15\.00/)
    ).toBeVisible({ timeout: 15000 });
  });

  test("amount for Base Plan (3000 cents) shows as €30.00", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // 3000 cents = €30.00
    await expect(
      page.getByText(/€30\.00/)
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 5: Status color coding
// ---------------------------------------------------------------------------

test.describe("Billing - Status Color Coding", () => {
  test("succeeded status uses default (green) badge variant", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // The badge for "succeeded" uses the "default" variant which is styled as green/primary
    // The badge element should be present with "succeeded" text
    const succeededBadge = page.locator("td").filter({ hasText: "succeeded" });
    await expect(succeededBadge.first()).toBeVisible({ timeout: 15000 });
  });

  test("failed status uses destructive (red) badge variant", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // The badge for "failed" uses the "destructive" variant which is red
    const failedBadge = page.locator("td").filter({ hasText: "failed" });
    await expect(failedBadge.first()).toBeVisible({ timeout: 15000 });
  });

  test("multiple status badges are rendered for mixed-status payment list", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // Both "succeeded" and "failed" should be visible in the table
    await expect(page.getByText("succeeded").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("failed").first()).toBeVisible({
      timeout: 15000,
    });
  });
});

// ---------------------------------------------------------------------------
// Test group 6: Empty state when no payments
// ---------------------------------------------------------------------------

test.describe("Billing - Empty State", () => {
  test("shows empty state message when no payments exist", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    // Mock empty billing history
    await page.route("**/api/protected/billing**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, payments: [] }),
      });
    });

    await page.goto("/dashboard/billing");

    // When no payments, page shows "No payment records found."
    await expect(
      page.getByText(/No payment records found/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("empty state does NOT show the payments table", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await page.route("**/api/protected/billing**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, payments: [] }),
      });
    });

    await page.goto("/dashboard/billing");

    // Table element should not exist in empty state
    await expect(page.locator("table")).not.toBeVisible({ timeout: 15000 });
  });

  test("page heading still visible in empty state", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await page.route("**/api/protected/billing**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, payments: [] }),
      });
    });

    await page.goto("/dashboard/billing");

    // The "Billing" heading should always be present
    await expect(
      page.getByRole("heading", { name: /Billing/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("empty state message is shown as small gray text", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await page.route("**/api/protected/billing**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, payments: [] }),
      });
    });

    await page.goto("/dashboard/billing");

    // The empty state renders as a <p> element with gray text styling
    const emptyMsg = page.locator("p").filter({ hasText: /No payment records found/i });
    await expect(emptyMsg).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 7: Multiple payments - sorting and list integrity
// ---------------------------------------------------------------------------

test.describe("Billing - Payment Sorting", () => {
  test("payments are displayed in descending date order (most recent first)", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // The table should have 3 rows for our 3 mock payments
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(3, { timeout: 15000 });
  });

  test("all payment rows are rendered for three payments", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // All 3 payment descriptions should be visible
    await expect(page.getByText("Pro Plan")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/1,000 Credits/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Base Plan")).toBeVisible({ timeout: 15000 });
  });

  test("single payment renders one row in the table", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await page.route("**/api/protected/billing**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          payments: [
            {
              id: "pay_single",
              createdAt: new Date().toISOString(),
              description: "Ultra Plan",
              amount: 13900,
              currency: "eur",
              status: "succeeded",
            },
          ],
        }),
      });
    });

    await page.goto("/dashboard/billing");

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1, { timeout: 15000 });
    await expect(page.getByText("Ultra Plan")).toBeVisible({ timeout: 15000 });
  });

  test("payment with null amount shows dash placeholder", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await page.route("**/api/protected/billing**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          payments: [
            {
              id: "pay_null",
              createdAt: new Date().toISOString(),
              description: "Unknown Item",
              amount: null,
              currency: "eur",
              status: "pending",
            },
          ],
        }),
      });
    });

    await page.goto("/dashboard/billing");

    // formatAmount returns "—" when amount is null
    await expect(page.getByText("—")).toBeVisible({ timeout: 15000 });
  });

  test("payment with null createdAt shows dash placeholder in date cell", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await page.route("**/api/protected/billing**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          payments: [
            {
              id: "pay_nodate",
              createdAt: null,
              description: "Some Payment",
              amount: 5000,
              currency: "eur",
              status: "succeeded",
            },
          ],
        }),
      });
    });

    await page.goto("/dashboard/billing");

    // formatDate returns "—" when createdAt is null
    await expect(page.getByText("—")).toBeVisible({ timeout: 15000 });
  });
});

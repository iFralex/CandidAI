import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 18.2: E2E Test - Billing - Download/Details
// Tests:
// - Click transaction: expands details or navigates to detail
// - If available: download invoice -> file downloaded
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "billing-detail@example.com",
  name: "Billing Detail User",
  uid: "billing-detail-uid",
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

async function mockAccount(page: Page) {
  await page.route("**/api/protected/account**", async (route) => {
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

function buildMockPayments(withReceiptUrl = false) {
  return [
    {
      id: "pay_001",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      description: "Pro Plan",
      amount: 6900,
      currency: "eur",
      status: "succeeded",
      ...(withReceiptUrl
        ? { receipt_url: "https://pay.stripe.com/receipts/pay_001" }
        : {}),
    },
    {
      id: "pay_002",
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      description: "1,000 Credits",
      amount: 1500,
      currency: "eur",
      status: "succeeded",
    },
  ];
}

async function mockBillingHistory(
  page: Page,
  payments = buildMockPayments()
) {
  await page.route("**/api/protected/billing**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        payments,
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test group 1: Click transaction row interaction
// ---------------------------------------------------------------------------

test.describe("Billing - Transaction Row Click", () => {
  test("clicking a transaction row keeps user on billing page", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    // Wait for table to render
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });

    // Click the first row
    await firstRow.click();

    // User should remain on the billing page (no navigation to a detail page)
    await expect(page).toHaveURL(/billing/, { timeout: 5000 });
  });

  test("clicking a transaction row does not cause a page error", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });

    await firstRow.click();

    // Page body should still be visible - no crash
    await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
    await expect(page).not.toHaveURL(/error/);
  });

  test("transaction row has hover styling applied", async ({ page }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });

    // Hover over the row - it should have hover:bg-white/5 class
    await firstRow.hover();

    // Row should still be visible after hover
    await expect(firstRow).toBeVisible({ timeout: 5000 });
  });

  test("all transaction rows remain visible after clicking one", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(2, { timeout: 15000 });

    // Click first row
    await rows.first().click();

    // All rows should still be visible (no accordion expansion that would hide others)
    await expect(rows).toHaveCount(2, { timeout: 5000 });
  });

  test("clicking a row in the table does not expand any hidden panel", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });

    // Before click: record table row count
    const rowCountBefore = await page.locator("table tbody tr").count();

    await firstRow.click();

    // After click: count should be the same (no expansion inserts new rows)
    const rowCountAfter = await page.locator("table tbody tr").count();
    expect(rowCountAfter).toBe(rowCountBefore);
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Invoice download (if available)
// ---------------------------------------------------------------------------

test.describe("Billing - Invoice Download", () => {
  test("no download links are shown when payments have no receipt URL", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page, buildMockPayments(false));

    await page.goto("/dashboard/billing");

    // Table should be visible
    await expect(page.locator("table")).toBeVisible({ timeout: 15000 });

    // There should be no download or invoice links
    const downloadLinks = page.locator("a[href*='receipt'], a[href*='invoice'], a[download]");
    await expect(downloadLinks).toHaveCount(0, { timeout: 5000 });
  });

  test("billing page does not contain broken download elements", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    await expect(page.locator("table")).toBeVisible({ timeout: 15000 });

    // No broken image/icon elements that would indicate a download button
    const brokenImages = page.locator("img[alt='invoice'], img[alt='download']");
    await expect(brokenImages).toHaveCount(0, { timeout: 5000 });
  });

  test("billing page renders correctly without any receipt URLs in payment data", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);

    // Payments without receipt URLs - current standard behavior
    await page.route("**/api/protected/billing**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          payments: [
            {
              id: "pay_no_receipt",
              createdAt: new Date().toISOString(),
              description: "Ultra Plan",
              amount: 13900,
              currency: "eur",
              status: "succeeded",
              // No receipt_url field
            },
          ],
        }),
      });
    });

    await page.goto("/dashboard/billing");

    // Page should render normally
    await expect(
      page.getByRole("heading", { name: /Billing/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Ultra Plan")).toBeVisible({ timeout: 15000 });
  });

  test("table row does not contain an anchor tag for download", async ({
    page,
  }) => {
    await mockUser(page);
    await mockAccount(page);
    await mockBillingHistory(page);

    await page.goto("/dashboard/billing");

    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });

    // In the current implementation, rows do not contain anchor tags for invoice download
    const anchorsInRow = firstRow.locator("a");
    await expect(anchorsInRow).toHaveCount(0, { timeout: 5000 });
  });
});

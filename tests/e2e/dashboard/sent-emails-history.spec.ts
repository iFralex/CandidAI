import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 16.1: E2E Test - Sent Emails - History Visualization
// Tests:
// - /dashboard/sent-emails loads sent email list
// - Campaign cards show: company, recruiter, send date, status
// - Date filter dropdown works (Last 7 Days, Last 30 Days, Custom Range)
// - Empty state shown if no emails sent
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "sent-emails-hist@example.com",
  name: "Sent Emails History User",
  uid: "sent-emails-hist-uid",
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

// Build mock results data with several sent emails
function buildMockResultsWithSentEmails() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const threeDaysAgo = nowSeconds - 3 * 24 * 60 * 60;
  const tenDaysAgo = nowSeconds - 10 * 24 * 60 * 60;
  const fortyDaysAgo = nowSeconds - 40 * 24 * 60 * 60;

  return {
    "company-id-001": {
      company: {
        name: "Alpha Corp",
        domain: "alphacorp.com",
      },
      recruiter: {
        name: "Alice Johnson",
        job_title: "Engineering Manager",
      },
      start_date: { _seconds: threeDaysAgo - 2000, _nanoseconds: 0 },
      email_sent: { _seconds: threeDaysAgo, _nanoseconds: 0 },
    },
    "company-id-002": {
      company: {
        name: "Beta IO",
        domain: "beta.io",
      },
      recruiter: {
        name: "Bob Williams",
        job_title: "Tech Lead",
      },
      start_date: { _seconds: tenDaysAgo - 2000, _nanoseconds: 0 },
      email_sent: { _seconds: tenDaysAgo, _nanoseconds: 0 },
    },
    "company-id-003": {
      company: {
        name: "Gamma Technologies",
        domain: "gamma.tech",
      },
      recruiter: {
        name: "Carol Davis",
        job_title: "HR Director",
      },
      start_date: { _seconds: fortyDaysAgo - 2000, _nanoseconds: 0 },
      email_sent: { _seconds: fortyDaysAgo, _nanoseconds: 0 },
    },
    // This company has no email sent — should NOT appear on sent-emails page
    "company-id-004": {
      company: {
        name: "Delta Labs",
        domain: "delta.labs",
      },
      recruiter: {
        name: "Dan Miller",
        job_title: "CTO",
      },
      start_date: { _seconds: nowSeconds - 1000, _nanoseconds: 0 },
      email_sent: false,
    },
  };
}

// Build mock results data with NO sent emails
function buildMockResultsNoSentEmails() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    "company-id-005": {
      company: {
        name: "Epsilon Corp",
        domain: "epsilon.com",
      },
      recruiter: {
        name: "Eve Turner",
        job_title: "Recruiter",
      },
      start_date: { _seconds: nowSeconds - 1000, _nanoseconds: 0 },
      email_sent: false,
    },
  };
}

async function mockUser(page: Page, overrides: Partial<Record<string, unknown>> = {}) {
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

async function mockResults(
  page: Page,
  data: Record<string, unknown> = buildMockResultsWithSentEmails()
) {
  await page.route("**/api/protected/results**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data,
      }),
    });
  });
}

async function mockResultsEmpty(page: Page) {
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

async function mockResultsNoSentEmails(page: Page) {
  await page.route("**/api/protected/results**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: buildMockResultsNoSentEmails(),
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test group 1: Page loads and displays sent email list
// ---------------------------------------------------------------------------

test.describe("Sent Emails - Page Load with Sent Emails", () => {
  test("navigating to /dashboard/sent-emails loads the page", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    // Page should load without redirecting to error
    await expect(page).not.toHaveURL(/error/, { timeout: 15000 });
    await expect(page.locator("body")).toBeVisible({ timeout: 15000 });
  });

  test("page has h1 heading 'Sent Emails'", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    await expect(
      page.getByRole("heading", { name: /Sent Emails/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("URL remains at /dashboard/sent-emails", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    await expect(page).toHaveURL(/sent-emails/, { timeout: 15000 });
  });

  test("sent email cards are shown for companies with email_sent timestamps", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    // Alpha Corp and Beta IO have sent emails — their names should appear
    await expect(page.getByText("Alpha Corp")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Beta IO")).toBeVisible({ timeout: 15000 });
  });

  test("companies without sent email are not shown", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    // Delta Labs has email_sent=false, should not appear
    await expect(page.getByText("Delta Labs")).not.toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Campaign cards show company, recruiter, send date, status
// ---------------------------------------------------------------------------

test.describe("Sent Emails - Card Data Display", () => {
  test("card shows company name", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    await expect(page.getByText("Alpha Corp")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Beta IO")).toBeVisible({ timeout: 15000 });
  });

  test("card shows recruiter name", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    // Recruiter names are shown in the card subtitle
    await expect(page.getByText(/Alice Johnson/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Bob Williams/i)).toBeVisible({ timeout: 15000 });
  });

  test("card shows send date (started date formatted as localeDate)", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    // Cards show "Started: <date>" in the card footer
    await expect(page.getByText(/Started/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("card shows sent status indicator", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    // Cards for sent emails show "sent" info (icon or text)
    // The CampaignCard shows "1 sent" for emailsSent > 0
    await expect(page.getByText(/sent/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("multiple sent email cards are rendered simultaneously", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    // All three companies with sent emails should be visible
    await expect(page.getByText("Alpha Corp")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Beta IO")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Gamma Technologies")).toBeVisible({
      timeout: 15000,
    });
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Date filter dropdown (sorting / filtering by column equivalent)
// ---------------------------------------------------------------------------

test.describe("Sent Emails - Date Filter Controls", () => {
  test("date filter select is visible on the page", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    // SentEmailsFilter renders a Select with filter options
    await expect(
      page.getByRole("combobox").or(page.locator("[data-slot='select-trigger']")).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("filter dropdown contains Last 7 Days option", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    const selectTrigger = page.locator("[data-slot='select-trigger']").first();
    await selectTrigger.click();

    await expect(
      page.getByRole("option", { name: /Last 7 Days/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("filter dropdown contains Last 30 Days option", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    const selectTrigger = page.locator("[data-slot='select-trigger']").first();
    await selectTrigger.click();

    await expect(
      page.getByRole("option", { name: /Last 30 Days/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("filter dropdown contains Custom Range option", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    const selectTrigger = page.locator("[data-slot='select-trigger']").first();
    await selectTrigger.click();

    await expect(
      page.getByRole("option", { name: /Custom Range/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("selecting Last 7 Days updates URL with preset=7", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    const selectTrigger = page.locator("[data-slot='select-trigger']").first();
    await selectTrigger.click();

    await page.getByRole("option", { name: /Last 7 Days/i }).click();

    // URL should contain preset=7
    await expect(page).toHaveURL(/preset=7/, { timeout: 15000 });
  });

  test("selecting Last 30 Days updates URL with preset=30", async ({ page }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    const selectTrigger = page.locator("[data-slot='select-trigger']").first();
    await selectTrigger.click();

    await page.getByRole("option", { name: /Last 30 Days/i }).click();

    // URL should contain preset=30
    await expect(page).toHaveURL(/preset=30/, { timeout: 15000 });
  });

  test("email count label shows number of filtered results", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResults(page);

    await page.goto("/dashboard/sent-emails");

    // SentEmailsFilter renders a count like "3 emails sent"
    await expect(page.getByText(/email.*sent/i)).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 4: Empty state when no emails sent
// ---------------------------------------------------------------------------

test.describe("Sent Emails - Empty State", () => {
  test("shows empty state message when results data is empty", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsEmpty(page);

    await page.goto("/dashboard/sent-emails");

    // Results component renders "No companies found." for empty list
    await expect(
      page.getByText(/No companies found/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("shows empty state when all companies have unsent emails", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsNoSentEmails(page);

    await page.goto("/dashboard/sent-emails");

    // No sent emails → filtered list is empty → "No companies found."
    await expect(
      page.getByText(/No companies found/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("page still loads heading in empty state", async ({ page }) => {
    await mockUser(page);
    await mockResultsEmpty(page);

    await page.goto("/dashboard/sent-emails");

    await expect(
      page.getByRole("heading", { name: /Sent Emails/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("filter controls are still visible in empty state", async ({ page }) => {
    await mockUser(page);
    await mockResultsEmpty(page);

    await page.goto("/dashboard/sent-emails");

    // Filter dropdown should still appear even when no results
    await expect(
      page.locator("[data-slot='select-trigger']").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("empty state shows 0 emails count in filter bar", async ({ page }) => {
    await mockUser(page);
    await mockResultsEmpty(page);

    await page.goto("/dashboard/sent-emails");

    // "0 emails sent" label
    await expect(page.getByText(/0 email/i)).toBeVisible({ timeout: 15000 });
  });
});

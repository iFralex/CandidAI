import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 14.2: E2E Test - Main Dashboard - Active Campaigns
// Tests:
// - Campaign list shows card for each company
// - Card shows: company name, recruiter name, status, progress bar
// - Progress bar reflects real state (recruiter found, articles, email generated)
// - Click card -> navigate to /dashboard/[companyId]
// - "Processing" state shows processing indicator
// - Ready campaign shows "Send" button or similar
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "dashboard-campaigns@example.com",
  name: "Dashboard Campaigns User",
  uid: "dashboard-uid-campaigns",
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

async function mockUser(page: Page, overrides: Partial<Record<string, unknown>> = {}) {
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

/**
 * Mock /api/protected/results with campaigns in different states.
 *
 * Progress calculation (calculateProgress):
 *   blog_articles present  => +50
 *   recruiter present      => +30
 *   email_sent !== undefined => +20
 *
 * Campaign states:
 *   processing-corp  (company-id-proc):  blog_articles=3, recruiter found     => 80%  → processing
 *   early-corp       (company-id-early): no blog_articles, no recruiter        =>  0%  → processing (Finding recruiter)
 *   ready-corp       (company-id-ready): blog_articles=2, recruiter, email_sent._seconds=0  => 100% → completed (ready to send)
 *   sent-corp        (company-id-sent):  email_sent._seconds>0 → filtered out by parseResults
 */
async function mockResultsWithCampaigns(page: Page) {
  const resultsData = {
    success: true,
    data: {
      // Processing campaign – recruiter found, articles analyzed
      "company-id-proc": {
        company: { name: "Processing Corp", domain: "processing-corp.com" },
        recruiter: {
          name: "Alice Smith",
          job_title: "HR Manager",
          email: "alice@processing-corp.com",
        },
        blog_articles: 3,
        start_date: { _seconds: 1700000000, _nanoseconds: 0 },
      },
      // Early processing – nothing found yet
      "company-id-early": {
        company: { name: "Early Corp", domain: "early-corp.com" },
        start_date: { _seconds: 1700000100, _nanoseconds: 0 },
      },
      // Ready to send – all stages complete, email generated but not sent
      "company-id-ready": {
        company: { name: "Ready Corp", domain: "ready-corp.com" },
        recruiter: {
          name: "Bob Jones",
          job_title: "Tech Lead",
          email: "bob@ready-corp.com",
        },
        blog_articles: 2,
        email_sent: { _seconds: 0, _nanoseconds: 0 },
        start_date: { _seconds: 1700000200, _nanoseconds: 0 },
      },
      // Sent – filtered out by parseResults (email_sent._seconds > 0)
      "company-id-sent": {
        company: { name: "Sent Corp", domain: "sent-corp.com" },
        recruiter: { name: "Carol White", job_title: "CTO" },
        blog_articles: 1,
        email_sent: { _seconds: 1700100000, _nanoseconds: 0 },
        start_date: { _seconds: 1700000300, _nanoseconds: 0 },
      },
    },
  };
  await page.request.post('/api/test/set-mock', {
    data: { pattern: '/api/protected/results', response: resultsData },
  });
  await page.route("**/api/protected/results**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(resultsData),
    });
  });
}

// ---------------------------------------------------------------------------
// Test group 1: Campaign cards are rendered
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Active Campaigns - Card Rendering", () => {
  test("campaign cards are rendered for each non-sent company", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    // Three campaigns visible (processing, early, ready) – sent one filtered out
    await expect(page.getByText("Processing Corp")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Early Corp")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Ready Corp")).toBeVisible({ timeout: 10000 });
  });

  test("sent campaign does not appear in active campaigns list", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    // Wait for real content to load
    await expect(page.getByText("Processing Corp")).toBeVisible({ timeout: 10000 });

    // Sent campaign should not be rendered
    await expect(page.getByText("Sent Corp")).not.toBeVisible();
  });

  test("card shows company name", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Processing Corp")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Ready Corp")).toBeVisible({ timeout: 10000 });
  });

  test("card shows recruiter name when recruiter is found", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    // Alice Smith on Processing Corp card
    await expect(page.getByText(/Alice Smith/i).first()).toBeVisible({ timeout: 10000 });
    // Bob Jones on Ready Corp card
    await expect(page.getByText(/Bob Jones/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("card does not show recruiter line when no recruiter found yet", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    // Early Corp has no recruiter – its card should not show a recruiter name
    // (but we must confirm Early Corp itself is visible first)
    await expect(page.getByText("Early Corp")).toBeVisible({ timeout: 10000 });
    // There is no recruiter text associated with Early Corp
    // (other cards do have recruiters, so we check the card specifically)
    const earlyCard = page.locator('[data-slot="card"]').filter({ hasText: "Early Corp" }).first();
    await expect(earlyCard).not.toContainText("HR Manager");
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Progress bar reflects real state
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Active Campaigns - Progress Bar", () => {
  test("processing campaign shows progress bar", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Processing Corp")).toBeVisible({ timeout: 10000 });

    // Progress bar is rendered inside the Processing Corp card
    const processingCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Processing Corp" })
      .first();

    // Progress bar shows a percentage text (80% for Processing Corp)
    await expect(processingCard).toContainText("80%", { timeout: 10000 });
  });

  test("early processing campaign shows 0% progress", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Early Corp")).toBeVisible({ timeout: 10000 });

    const earlyCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Early Corp" })
      .first();

    await expect(earlyCard).toContainText("0%", { timeout: 10000 });
  });

  test("processing campaign stage label reflects recruiter-found state", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Processing Corp")).toBeVisible({ timeout: 10000 });

    // Processing Corp has recruiter + blog_articles but no email → stage = "Generating email"
    const processingCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Processing Corp" })
      .first();
    await expect(processingCard).toContainText(/Generating email/i, { timeout: 10000 });
  });

  test("early processing campaign stage shows Finding recruiter", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Early Corp")).toBeVisible({ timeout: 10000 });

    const earlyCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Early Corp" })
      .first();
    await expect(earlyCard).toContainText(/Finding recruiter/i, { timeout: 10000 });
  });

  test("ready campaign (100%) does not show progress bar", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Ready Corp")).toBeVisible({ timeout: 10000 });

    // Ready Corp has progress=100 (status='completed'), so no progress bar displayed
    const readyCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Ready Corp" })
      .first();
    // Card should not show a percentage
    await expect(readyCard).not.toContainText("100%");
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Processing indicator
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Active Campaigns - Processing Indicator", () => {
  test("processing campaign card contains stage text as processing indicator", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Processing Corp")).toBeVisible({ timeout: 10000 });

    // The stage label acts as a processing indicator
    const processingCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Processing Corp" })
      .first();
    // Stage label is shown in the progress bar section
    await expect(processingCard).toContainText(/Generating email/i, { timeout: 10000 });
  });

  test("early processing campaign shows Finding recruiter stage indicator", async ({
    page,
  }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Early Corp")).toBeVisible({ timeout: 10000 });

    const earlyCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Early Corp" })
      .first();
    await expect(earlyCard).toContainText(/Finding recruiter/i, { timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 4: Navigation - click card goes to /dashboard/[companyId]
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Active Campaigns - Navigation", () => {
  test("clicking a campaign card navigates to /dashboard/[companyId]", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    // Mock detail page API so navigation doesn't fail
    await page.route("**/api/protected/result/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    await page.goto("/dashboard");

    await expect(page.getByText("Processing Corp")).toBeVisible({ timeout: 10000 });

    // Find the link wrapping the Processing Corp card
    const campaignLink = page
      .getByRole("link")
      .filter({ has: page.getByText("Processing Corp") })
      .first();

    const href = await campaignLink.getAttribute("href");
    expect(href).toBe("/dashboard/company-id-proc");
  });

  test("each campaign card is wrapped in a link to its detail page", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Ready Corp")).toBeVisible({ timeout: 10000 });

    const readyLink = page
      .getByRole("link")
      .filter({ has: page.getByText("Ready Corp") })
      .first();

    const href = await readyLink.getAttribute("href");
    expect(href).toBe("/dashboard/company-id-ready");
  });

  test("early processing campaign card links to correct detail page", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Early Corp")).toBeVisible({ timeout: 10000 });

    const earlyLink = page
      .getByRole("link")
      .filter({ has: page.getByText("Early Corp") })
      .first();

    const href = await earlyLink.getAttribute("href");
    expect(href).toBe("/dashboard/company-id-early");
  });
});

// ---------------------------------------------------------------------------
// Test group 5: Ready campaign navigation element
// ---------------------------------------------------------------------------

test.describe("Main Dashboard - Active Campaigns - Ready Campaign", () => {
  test("ready campaign card shows Info navigation button", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Ready Corp")).toBeVisible({ timeout: 10000 });

    // The card renders an "Info" button with ArrowRight icon for navigation
    const readyCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Ready Corp" })
      .first();
    await expect(readyCard.getByRole("button", { name: /Info/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("ready campaign card shows Email generated label", async ({ page }) => {
    await mockUser(page);
    await mockResultsWithCampaigns(page);

    await page.goto("/dashboard");

    await expect(page.getByText("Ready Corp")).toBeVisible({ timeout: 10000 });

    const readyCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Ready Corp" })
      .first();
    // emailsGenerated > 0 renders "Email generated" text
    await expect(readyCard).toContainText(/Email\s+generated/i, { timeout: 10000 });
  });
});

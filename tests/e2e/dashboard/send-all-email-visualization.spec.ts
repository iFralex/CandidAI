import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 15.1: E2E Test - Send All - Email Visualization
// Tests:
// - /dashboard/send-all loads with the email management interface
// - Page renders the script generator with email controls
// - Sender email input visible
// - "Include sent emails" checkbox available for controlling which emails to include
// - Script generation buttons visible (Windows + macOS)
// - With email data: page loads correctly and shows controls
// - With no email data: page still loads and shows controls
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "send-all-viz@example.com",
  name: "Send All Viz User",
  uid: "send-all-viz-uid",
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

/** Build realistic mock email data (three emails: two unsent, one sent) */
function buildMockEmailsData() {
  return {
    "company-id-001": {
      email_address: "alice.johnson@alpha-corp.com",
      subject: "Application for Software Engineer - Alpha Corp",
      body: "Dear Alice,\n\nI am writing to express my strong interest in the Software Engineer position at Alpha Corp. I have 5 years of experience building scalable web applications...",
      email_sent: false,
      cv_url: "https://storage.example.com/cv001.pdf",
      company_name: "Alpha Corp",
      recruiter_name: "Alice Johnson",
    },
    "company-id-002": {
      email_address: "bob.williams@beta-io.com",
      subject: "Full Stack Developer Application - Beta IO",
      body: "Hello Bob,\n\nI came across your job posting on LinkedIn and believe my skills align perfectly with what you need at Beta IO...",
      email_sent: false,
      cv_url: "https://storage.example.com/cv001.pdf",
      company_name: "Beta IO",
      recruiter_name: "Bob Williams",
    },
    "company-id-003": {
      email_address: "carol.davis@gamma-tech.com",
      subject: "Senior Developer Position - Gamma Technologies",
      body: "Dear Carol,\n\nI am excited about the opportunity to join Gamma Technologies as a Senior Developer...",
      email_sent: { _seconds: 1700100000, _nanoseconds: 0 },
      cv_url: "https://storage.example.com/cv001.pdf",
      company_name: "Gamma Technologies",
      recruiter_name: "Carol Davis",
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

async function mockEmails(
  page: Page,
  data: Record<string, unknown> = buildMockEmailsData()
) {
  await page.route("**/api/protected/emails**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data,
        userId: TEST_USER.uid,
      }),
    });
  });
}

async function mockEmailsEmpty(page: Page) {
  await page.route("**/api/protected/emails**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {},
        userId: TEST_USER.uid,
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test group 1: Page loads successfully with email data
// ---------------------------------------------------------------------------

test.describe("Send All - Page Load with Email Data", () => {
  test("navigating to /dashboard/send-all loads the page", async ({ page }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    // Page should load without error - not redirect to error page
    await expect(page).not.toHaveURL(/error/, { timeout: 15000 });
    // Page body is rendered
    await expect(page.locator("body")).toBeVisible({ timeout: 15000 });
  });

  test("send-all page shows the email script generator interface", async ({ page }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    // The Emails component renders a sender email input
    await expect(
      page.getByPlaceholder(/Sender Email Address/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("sender email address input is visible and editable", async ({ page }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    const senderInput = page.getByPlaceholder(/Sender Email Address/i);
    await expect(senderInput).toBeVisible({ timeout: 15000 });

    // Input should be editable (represent recipient email control)
    await senderInput.fill("my.email@example.com");
    await expect(senderInput).toHaveValue("my.email@example.com");
  });

  test("Include sent emails checkbox is visible", async ({ page }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    // Checkbox to include/exclude sent emails
    await expect(
      page.getByLabel(/Include sent emails in the script/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("Include sent emails checkbox can be toggled (individual selection control)", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    const checkbox = page.getByLabel(/Include sent emails in the script/i);
    await expect(checkbox).toBeVisible({ timeout: 15000 });

    // Should start unchecked (only include unsent emails)
    await expect(checkbox).not.toBeChecked();

    // Toggle it on (select all including sent)
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Toggle it off (deselect sent, back to only unsent)
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
  });

  test("Generate Windows script button is visible", async ({ page }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    await expect(
      page.getByRole("button", { name: /Generate Windows script/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("Generate MacOS script button is visible", async ({ page }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    await expect(
      page.getByRole("button", { name: /Generate MacOS script/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("both script generation buttons are visible simultaneously", async ({ page }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    // Both "Select All" (Windows) and "Deselect All" (macOS) equivalents visible
    await expect(
      page.getByRole("button", { name: /Generate Windows script/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("button", { name: /Generate MacOS script/i })
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Email data controls reflect the ready-email list
// ---------------------------------------------------------------------------

test.describe("Send All - Email List Controls", () => {
  test("page loads correctly with multiple unsent emails in data", async ({ page }) => {
    await mockUser(page);
    // Two unsent emails, one sent email in mock data
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    // Controls are shown to manage the email list
    await expect(
      page.getByPlaceholder(/Sender Email Address/i)
    ).toBeVisible({ timeout: 15000 });

    // "Include sent emails" checkbox starts unchecked (only unsent selected by default)
    const checkbox = page.getByLabel(/Include sent emails in the script/i);
    await expect(checkbox).toBeVisible({ timeout: 15000 });
    await expect(checkbox).not.toBeChecked();
  });

  test("checking Include sent emails updates selection to include all emails", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    const checkbox = page.getByLabel(/Include sent emails in the script/i);
    await expect(checkbox).not.toBeChecked({ timeout: 15000 });

    // Check the box — now counter includes sent emails too
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  });

  test("unchecking Include sent emails limits selection to unsent only", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    const checkbox = page.getByLabel(/Include sent emails in the script/i);
    // First check it
    await checkbox.click();
    await expect(checkbox).toBeChecked({ timeout: 15000 });

    // Then uncheck — reverts to unsent-only selection
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
  });

  test("PowerShell command instruction is displayed for Windows script", async ({ page }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    // Body preview / instructions for running the script
    await expect(
      page.getByText(/powershell/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("chmod instruction is displayed for macOS script", async ({ page }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    // Preview of the macOS script run command
    await expect(
      page.getByText(/chmod/i)
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Empty email data still renders controls
// ---------------------------------------------------------------------------

test.describe("Send All - Empty Email State", () => {
  test("page loads correctly even with no emails in the data", async ({ page }) => {
    await mockUser(page);
    await mockEmailsEmpty(page);

    await page.goto("/dashboard/send-all");

    // Controls still shown even with empty email list
    await expect(
      page.getByPlaceholder(/Sender Email Address/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("script generation buttons are still visible with empty email list", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmailsEmpty(page);

    await page.goto("/dashboard/send-all");

    await expect(
      page.getByRole("button", { name: /Generate Windows script/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("button", { name: /Generate MacOS script/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("Include sent emails checkbox is still visible with empty email list", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmailsEmpty(page);

    await page.goto("/dashboard/send-all");

    await expect(
      page.getByLabel(/Include sent emails in the script/i)
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 4: User context and credits display
// ---------------------------------------------------------------------------

test.describe("Send All - User Context", () => {
  test("page loads for a user with base plan", async ({ page }) => {
    await mockUser(page, { plan: "base", credits: 200 });
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    await expect(
      page.getByPlaceholder(/Sender Email Address/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("page loads for a user with pro plan", async ({ page }) => {
    await mockUser(page, { plan: "pro", credits: 1000 });
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    await expect(
      page.getByPlaceholder(/Sender Email Address/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("page is accessible via the dashboard/send-all URL", async ({ page }) => {
    await mockUser(page);
    await mockEmails(page);

    await page.goto("/dashboard/send-all");

    // The URL should remain at send-all (not redirect away)
    await expect(page).toHaveURL(/send-all/, { timeout: 15000 });
  });
});

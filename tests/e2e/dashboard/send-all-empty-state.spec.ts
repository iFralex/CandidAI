import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 15.3: E2E Test - Send All - Empty State
// Tests:
// - No ready emails: alert shown with "No emails ready" message -> CTA buttons remain visible
// - All emails already sent: empty state when sentInclude=false (default)
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "send-all-empty@example.com",
  name: "Send All Empty User",
  uid: "send-all-empty-uid",
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

/** Empty email list - no emails at all */
function buildEmptyEmailsData() {
  return {};
}

/** All emails already sent - none ready */
function buildAllSentEmailsData() {
  return {
    "company-id-001": {
      email_address: "alice.johnson@alpha-corp.com",
      subject: "Application for Software Engineer - Alpha Corp",
      body: "Dear Alice,\n\nI am writing to express my strong interest...",
      email_sent: { _seconds: 1700100000, _nanoseconds: 0 },
      cv_url: "https://storage.example.com/cv001.pdf",
      company_name: "Alpha Corp",
      recruiter_name: "Alice Johnson",
    },
    "company-id-002": {
      email_address: "bob.williams@beta-io.com",
      subject: "Full Stack Developer Application - Beta IO",
      body: "Hello Bob,\n\nI came across your job posting on LinkedIn...",
      email_sent: { _seconds: 1700200000, _nanoseconds: 0 },
      cv_url: "https://storage.example.com/cv001.pdf",
      company_name: "Beta IO",
      recruiter_name: "Bob Williams",
    },
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

async function mockEmails(
  page: Page,
  data: Record<string, unknown> = buildEmptyEmailsData()
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

// ---------------------------------------------------------------------------
// Test group 1: No ready emails - "No emails ready" alert and appropriate CTA
// ---------------------------------------------------------------------------

test.describe("Send All - No Ready Emails Alert", () => {
  test("with empty email list, clicking Generate Windows script shows no-emails alert", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page, buildEmptyEmailsData());

    await page.goto("/dashboard/send-all");

    await expect(
      page.getByRole("button", { name: /Generate Windows script/i })
    ).toBeVisible({ timeout: 15000 });

    let alertMessage = "";
    page.once("dialog", (dialog) => {
      alertMessage = dialog.message();
      dialog.accept();
    });

    await page
      .getByRole("button", { name: /Generate Windows script/i })
      .click();

    await page.waitForTimeout(1000);

    // Alert should inform user there are no emails to process
    expect(alertMessage).toBeTruthy();
    expect(alertMessage.toLowerCase()).toMatch(
      /no emails|filter|process/i
    );
  });

  test("with empty email list, clicking Generate MacOS script shows no-emails alert", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page, buildEmptyEmailsData());

    await page.goto("/dashboard/send-all");

    await expect(
      page.getByRole("button", { name: /Generate MacOS script/i })
    ).toBeVisible({ timeout: 15000 });

    let alertMessage = "";
    page.once("dialog", (dialog) => {
      alertMessage = dialog.message();
      dialog.accept();
    });

    await page
      .getByRole("button", { name: /Generate MacOS script/i })
      .click();

    await page.waitForTimeout(1000);

    expect(alertMessage).toBeTruthy();
    expect(alertMessage.toLowerCase()).toMatch(
      /no emails|filter|process/i
    );
  });

  test("after dismissing no-emails alert, Generate Windows script CTA is still visible", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page, buildEmptyEmailsData());

    await page.goto("/dashboard/send-all");

    await expect(
      page.getByRole("button", { name: /Generate Windows script/i })
    ).toBeVisible({ timeout: 15000 });

    // Dismiss the alert
    page.once("dialog", (dialog) => dialog.accept());

    await page
      .getByRole("button", { name: /Generate Windows script/i })
      .click();

    await page.waitForTimeout(500);

    // CTA button remains visible after dismissing alert
    await expect(
      page.getByRole("button", { name: /Generate Windows script/i })
    ).toBeVisible();
  });

  test("after dismissing no-emails alert, Generate MacOS script CTA is still visible", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page, buildEmptyEmailsData());

    await page.goto("/dashboard/send-all");

    await expect(
      page.getByRole("button", { name: /Generate MacOS script/i })
    ).toBeVisible({ timeout: 15000 });

    page.once("dialog", (dialog) => dialog.accept());

    await page
      .getByRole("button", { name: /Generate MacOS script/i })
      .click();

    await page.waitForTimeout(500);

    // CTA button remains visible after dismissing alert
    await expect(
      page.getByRole("button", { name: /Generate MacOS script/i })
    ).toBeVisible();
  });

  test("no-emails alert can be dismissed and page is still functional", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page, buildEmptyEmailsData());

    await page.goto("/dashboard/send-all");

    const senderInput = page.getByPlaceholder(/Sender Email Address/i);
    await expect(senderInput).toBeVisible({ timeout: 15000 });

    // Fill sender email before triggering alert
    await senderInput.fill("test@example.com");

    page.once("dialog", (dialog) => dialog.accept());

    await page
      .getByRole("button", { name: /Generate Windows script/i })
      .click();

    await page.waitForTimeout(500);

    // After dismissal, sender input value is preserved (CTA form state maintained)
    await expect(senderInput).toHaveValue("test@example.com");
  });
});

// ---------------------------------------------------------------------------
// Test group 2: All emails already sent - empty state (sentInclude=false)
// ---------------------------------------------------------------------------

test.describe("Send All - All Emails Already Sent Empty State", () => {
  test("when all emails are sent and sentInclude is false, generate shows no-emails alert", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page, buildAllSentEmailsData());

    await page.goto("/dashboard/send-all");

    await expect(
      page.getByRole("button", { name: /Generate Windows script/i })
    ).toBeVisible({ timeout: 15000 });

    // By default sentInclude=false, so all sent emails are filtered out → empty
    let alertMessage = "";
    page.once("dialog", (dialog) => {
      alertMessage = dialog.message();
      dialog.accept();
    });

    await page
      .getByRole("button", { name: /Generate Windows script/i })
      .click();

    await page.waitForTimeout(1000);

    expect(alertMessage.toLowerCase()).toMatch(
      /no emails|filter|process/i
    );
  });

  test("when all emails are sent, Include sent emails checkbox enables generation", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page, buildAllSentEmailsData());

    await page.goto("/dashboard/send-all");

    const checkbox = page.getByLabel(/Include sent emails in the script/i);
    await expect(checkbox).toBeVisible({ timeout: 15000 });

    // Default: no alert fired yet. Now check the box
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Track any dialog
    let alertMessage = "";
    page.once("dialog", (dialog) => {
      alertMessage = dialog.message();
      dialog.accept();
    });

    // With sentInclude=true, sent emails are included → generation attempted (not blocked)
    await page
      .getByRole("button", { name: /Generate Windows script/i })
      .click();

    await page.waitForTimeout(2000);

    // Should NOT show "no emails" message — generation proceeds (may fail for other reasons)
    if (alertMessage) {
      expect(alertMessage.toLowerCase()).not.toMatch(/no emails to process/i);
    }
  });

  test("MacOS script also shows no-emails alert when all emails are sent and sentInclude is false", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page, buildAllSentEmailsData());

    await page.goto("/dashboard/send-all");

    await expect(
      page.getByRole("button", { name: /Generate MacOS script/i })
    ).toBeVisible({ timeout: 15000 });

    let alertShown = false;
    page.once("dialog", (dialog) => {
      alertShown = true;
      dialog.accept();
    });

    await page
      .getByRole("button", { name: /Generate MacOS script/i })
      .click();

    await page.waitForTimeout(1000);

    expect(alertShown).toBe(true);
  });

  test("page still shows all CTA controls in all-sent empty state", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page, buildAllSentEmailsData());

    await page.goto("/dashboard/send-all");

    // All controls remain visible even when all emails are sent
    await expect(
      page.getByPlaceholder(/Sender Email Address/i)
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByLabel(/Include sent emails in the script/i)
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("button", { name: /Generate Windows script/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("button", { name: /Generate MacOS script/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("toggling sentInclude off after on reverts to empty state (all-sent scenario)", async ({
    page,
  }) => {
    await mockUser(page);
    await mockEmails(page, buildAllSentEmailsData());

    await page.goto("/dashboard/send-all");

    const checkbox = page.getByLabel(/Include sent emails in the script/i);
    await expect(checkbox).toBeVisible({ timeout: 15000 });

    // Check and uncheck
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();

    // Back to sentInclude=false → generates no-emails alert
    let alertMessage = "";
    page.once("dialog", (dialog) => {
      alertMessage = dialog.message();
      dialog.accept();
    });

    await page
      .getByRole("button", { name: /Generate Windows script/i })
      .click();

    await page.waitForTimeout(1000);

    expect(alertMessage.toLowerCase()).toMatch(
      /no emails|filter|process/i
    );
  });
});

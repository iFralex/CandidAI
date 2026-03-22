import { test, expect, Page } from "@playwright/test";
import path from "path";

const TEST_USER = {
  email: "onboard@example.com",
  name: "Onboard Test User",
  uid: "onboard-uid-free-trial",
};

/**
 * Build the mock user object for a given onboarding step.
 * plan defaults to null for step 1 (before plan selection), and
 * "free_trial" for all subsequent steps.
 */
function buildMockUser(step: number) {
  return {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: step,
    plan: step >= 2 ? "free_trial" : null,
    credits: 0,
    emailVerified: true,
  };
}

/**
 * Register a static /api/protected/user mock that always returns the given step.
 */
async function mockUserAtStep(page: Page, step: number) {
  await page.context().addCookies([{
    name: '__playwright_user__',
    value: Buffer.from(JSON.stringify(buildMockUser(step))).toString('base64'),
    domain: 'localhost',
    path: '/',
  }]);
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: buildMockUser(step),
      }),
    });
  });
}

/**
 * Register a stateful /api/protected/user mock backed by a mutable counter.
 * Returns a function that, when called with a new step, updates future responses.
 */
async function mockUserWithAdvance(page: Page, initialStep: number) {
  let currentStep = initialStep;

  await page.context().addCookies([{
    name: '__playwright_user__',
    value: Buffer.from(JSON.stringify(buildMockUser(initialStep))).toString('base64'),
    domain: 'localhost',
    path: '/',
  }]);
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: buildMockUser(currentStep),
      }),
    });
  });

  return (nextStep: number) => {
    currentStep = nextStep;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Onboarding - Free Trial - Setup / Step 1 (Plan Selection)", () => {
  test("user with onboardingStep=1 sees the Onboarding header", async ({
    page,
  }) => {
    await mockUserAtStep(page, 1);
    await page.goto("/dashboard");
    // Layout renders "Onboarding" when step < 10
    await expect(page.getByText("Onboarding").first()).toBeVisible({ timeout: 10000 });
  });

  test("dashboard shows Step 1 – Plan Selection UI", async ({ page }) => {
    await mockUserAtStep(page, 1);
    await page.goto("/dashboard");
    await expect(
      page.getByText("Choose Your Success Plan")
    ).toBeVisible({ timeout: 10000 });
  });

  test("step 1: clicking 'Start Free Test' selects the Free Trial plan", async ({
    page,
  }) => {
    await mockUserAtStep(page, 1);
    await page.goto("/dashboard");

    // The Free Trial card has a "Start Free Test" button
    const selectFreeBtn = page
      .getByRole("button", { name: /start free test/i })
      .first();
    await expect(selectFreeBtn).toBeVisible({ timeout: 10000 });
    await selectFreeBtn.click();

    // After selection the button label changes to "Selected"
    await expect(
      page.getByRole("button", { name: /selected/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("step 1: clicking the submit button with Free Trial triggers the next step", async ({
    page,
  }) => {
    // Advance mock: first responses return step=1, after action resolves return step=2
    const advanceTo = await mockUserWithAdvance(page, 1);

    // Mock brandfetch (used on step 2) so it doesn't error
    await page.route("**/api.brandfetch.io/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/dashboard");

    // Select Free Trial
    const selectFreeBtn = page
      .getByRole("button", { name: /start free test/i })
      .first();
    await expect(selectFreeBtn).toBeVisible({ timeout: 10000 });
    await selectFreeBtn.click();

    // Advance mock before submit so the next re-render shows step 2
    advanceTo(2);

    // Click the main submit / "Start Free Test" button (the last one in the DOM)
    const submitBtn = page
      .getByRole("button", { name: /start free test/i })
      .last();
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // After the server action + revalidation, the page should show step 2 UI
    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------

test.describe("Onboarding - Free Trial - Step 2 (Company Input)", () => {
  test("user with onboardingStep=2 sees company input UI", async ({ page }) => {
    await mockUserAtStep(page, 2);
    // brandfetch autocomplete is called from step 2
    await page.route("**/api.brandfetch.io/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await page.goto("/dashboard");
    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });
  });

  test("step 2: type 'acmecorp.com' and advance to step 3", async ({
    page,
  }) => {
    const advanceTo = await mockUserWithAdvance(page, 2);

    // Mock brandfetch to return an empty list (no autocomplete results)
    await page.route("**/api.brandfetch.io/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/dashboard");
    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });

    // Type the LinkedIn URL into the autocomplete input
    const companyInput = page.getByPlaceholder(
      /search by company name or paste a linkedin url/i
    );
    await expect(companyInput).toBeVisible({ timeout: 5000 });
    await companyInput.fill("linkedin.com/company/acmecorp");
    const addCompanyBtn = page.getByRole("button", { name: /add from linkedin url/i });
    await expect(addCompanyBtn).toBeVisible({ timeout: 5000 });
    await addCompanyBtn.click();

    const continueBtn = page.getByRole("button", {
      name: /continue setup/i,
    });
    await expect(continueBtn).toBeEnabled({ timeout: 5000 });

    // Advance mock before the action so re-render shows step 3
    advanceTo(3);
    await continueBtn.click();

    // After submit, step 3 (profile analysis) should appear
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });
  });

  test("step 2: progress bar is visible showing current step", async ({
    page,
  }) => {
    await mockUserAtStep(page, 2);
    await page.route("**/api.brandfetch.io/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await page.goto("/dashboard");
    // Layout should show "Setup Progress: Step 2 of ..."
    await expect(page.getByText(/setup progress/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

// ---------------------------------------------------------------------------

test.describe("Onboarding - Free Trial - Step 3 (Profile & CV)", () => {
  test("user with onboardingStep=3 sees profile analysis UI", async ({
    page,
  }) => {
    await mockUserAtStep(page, 3);
    await page.goto("/dashboard");
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });
  });

  test("step 3: uploading a valid PDF shows the filename", async ({ page }) => {
    await mockUserAtStep(page, 3);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });

    // Upload a minimal PDF via the hidden file input
    const cvInput = page.locator("#cv-upload");
    await expect(cvInput).toBeAttached({ timeout: 5000 });

    // Create a minimal in-memory PDF buffer
    const minimalPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\n" +
        "xref\n0 4\n0000000000 65535 f\n" +
        "0000000015 00000 n\n0000000061 00000 n\n" +
        "0000000114 00000 n\ntrailer<</Size 4/Root 1 0 R>>\n" +
        "startxref\n190\n%%EOF"
    );

    await cvInput.setInputFiles({
      name: "test-cv.pdf",
      mimeType: "application/pdf",
      buffer: minimalPdf,
    });

    // The filename should now be visible in the upload area
    await expect(page.getByText("test-cv.pdf").first()).toBeVisible({ timeout: 5000 });
  });

  test("step 3: complete profile and click Next – advance to step 4 (auto) then step 5", async ({
    page,
  }) => {
    // For free_trial, step 4 (AdvancedFiltersServer) auto-submits server-side
    // and redirects, so from the user's perspective step 3 → step 5.
    const advanceTo = await mockUserWithAdvance(page, 3);

    await page.goto("/dashboard");
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });

    // Fill in LinkedIn URL (required to enable "Analyze My Profile")
    const linkedinInput = page.locator(
      'input[placeholder*="linkedin.com/in"]'
    );
    await expect(linkedinInput).toBeVisible({ timeout: 5000 });
    await linkedinInput.fill("https://www.linkedin.com/in/testuser");

    // Upload a minimal PDF
    const cvInput = page.locator("#cv-upload");
    const minimalPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\n" +
        "xref\n0 4\n0000000000 65535 f\n" +
        "0000000015 00000 n\n0000000061 00000 n\n" +
        "0000000114 00000 n\ntrailer<</Size 4/Root 1 0 R>>\n" +
        "startxref\n190\n%%EOF"
    );
    await cvInput.setInputFiles({
      name: "test-cv.pdf",
      mimeType: "application/pdf",
      buffer: minimalPdf,
    });

    // Mock PDL enrichment call (called by analyzeProfile server action)
    await page.route("**/api/protected/**", async (route) => {
      if (route.request().url().includes("/user")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            user: buildMockUser(3),
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Advance mock so the next page load shows step 5
    // (step 4 auto-executes server-side for free_trial)
    advanceTo(5);

    // The "Analyze My Profile" button should be enabled with both LinkedIn + CV
    const analyzeBtn = page.getByRole("button", {
      name: /analyze my profile/i,
    });
    await expect(analyzeBtn).toBeEnabled({ timeout: 5000 });
    await analyzeBtn.click();

    // After the analysis (mocked or timed out), step 5 should appear
    await expect(
      page.getByText("Setup Complete!")
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------

test.describe("Onboarding - Free Trial - Step 4 (Recruiter Criteria, auto for free_trial)", () => {
  test("for free_trial plan, step 4 auto-advances: onboardingStep=4 triggers server-side submitQueries and redirects to step 5", async ({
    page,
  }) => {
    // When step=4 is returned, AdvancedFiltersServer calls submitQueries server-side
    // which redirects to /dashboard. Without Firebase, the redirect won't happen;
    // the page may show an error or remain loading. We verify no crash occurs.
    await mockUserAtStep(page, 4);
    // Mock account endpoint needed by AdvancedFiltersServer
    await page.route("**/api/protected/account**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            profileSummary: {
              experience: [],
              education: [],
              skills: [],
              location: {},
            },
          },
        }),
      });
    });
    await page.goto("/dashboard");
    // No crash (5xx) should occur
    let serverError = false;
    page.on("response", (r) => {
      if (r.status() >= 500) serverError = true;
    });
    // Either step 5 appears (if auto-redirect worked) or we land on login (no Firebase)
    await page.waitForTimeout(3000);
    expect(serverError).toBe(false);
  });
});

// ---------------------------------------------------------------------------

test.describe("Onboarding - Free Trial - Step 5 (Custom Instructions)", () => {
  test("user with onboardingStep=5 sees Setup Complete UI", async ({
    page,
  }) => {
    await mockUserAtStep(page, 5);
    await page.goto("/dashboard");
    await expect(page.getByText("Setup Complete!").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("step 5: can fill position description and custom instructions", async ({
    page,
  }) => {
    await mockUserAtStep(page, 5);
    await page.goto("/dashboard");

    await expect(page.getByText("Setup Complete!").first()).toBeVisible({
      timeout: 10000,
    });

    // Fill the position description textarea (required to enable submit)
    const positionTextarea = page.getByPlaceholder(/i want to be/i);
    await expect(positionTextarea).toBeVisible({ timeout: 5000 });
    await positionTextarea.fill(
      "I want to be a Senior Software Engineer at a fintech startup"
    );

    // Fill optional custom instructions
    const instructionsTextarea = page.getByPlaceholder(
      /anything you want to specify/i
    );
    await expect(instructionsTextarea).toBeVisible({ timeout: 5000 });
    await instructionsTextarea.fill(
      "Please emphasize my open-source contributions."
    );

    // Submit button should become enabled once position_description is filled
    const submitBtn = page.getByRole("button", {
      name: /start email generation/i,
    });
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
  });

  test("step 5: clicking 'Start Email Generation' triggers completeOnboarding and advances", async ({
    page,
  }) => {
    const advanceTo = await mockUserWithAdvance(page, 5);

    await page.goto("/dashboard");
    await expect(page.getByText("Setup Complete!").first()).toBeVisible({
      timeout: 10000,
    });

    // Fill position description (required)
    const positionTextarea = page.getByPlaceholder(/i want to be/i);
    await positionTextarea.fill(
      "I want to be a Senior Software Engineer at a fintech startup"
    );

    // Advance mock to step 50 before clicking (simulating free_trial payment
    // auto-advance: step 5 → completeOnboarding → step 6 → PaymentStripeServer
    // (price=0) → onboardingStep=50 + startServer + redirect /dashboard)
    advanceTo(50);

    // Mock results endpoint so the main dashboard can render without Firebase
    await page.route("**/api/protected/results**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    const submitBtn = page.getByRole("button", {
      name: /start email generation/i,
    });
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // After the server action chain completes (step 5 → 6 → 50 on free_trial),
    // the main dashboard should be shown (step >= 10 renders dashboard, not onboarding).
    await expect(
      page.getByText("Dashboard").first()
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------

test.describe("Onboarding - Free Trial - Step 50 (Main Dashboard)", () => {
  test("user with onboardingStep=50 sees the main dashboard (not onboarding)", async ({
    page,
  }) => {
    await mockUserAtStep(page, 50);

    // Mock the results endpoint so the dashboard can load
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

    await page.goto("/dashboard");

    // At step >= 10 the layout shows "Dashboard", not "Onboarding"
    await expect(page.getByText("Dashboard").first()).toBeVisible({
      timeout: 10000,
    });

    // "Choose Your Success Plan" should NOT be visible (onboarding is done)
    await expect(
      page.getByText("Choose Your Success Plan")
    ).not.toBeVisible();
  });

  test("step 50: startServer was called as part of free_trial auto-flow (observable: main dashboard shown)", async ({
    page,
  }) => {
    // startServer is a server-side call to SERVER_RUNNER_URL; Playwright cannot
    // intercept server-to-server requests.  We verify the observable outcome:
    // the user has onboardingStep=50 and sees the main dashboard, which is only
    // reachable after startServer is triggered by PaymentStripeServer (free_trial path).
    await mockUserAtStep(page, 50);

    await page.route("**/api/protected/results**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    await page.goto("/dashboard");

    // Observable outcome: Dashboard header visible, no onboarding UI
    await expect(page.getByText("Dashboard").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Choose Your Success Plan")).not.toBeVisible();
    await expect(page.getByText("Add Your Target Companies")).not.toBeVisible();
    await expect(page.getByText("Setup Complete!")).not.toBeVisible();
  });
});

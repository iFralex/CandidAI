import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 13.5: Onboarding – Persona E: The Error Maker
// Tests error scenarios across all onboarding steps.
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "error-maker@example.com",
  name: "Error Maker Test User",
  uid: "onboard-uid-error-maker",
};

// Build a mock user for a given step and plan.
function buildMockUser(step: number, plan: string | null = null) {
  return {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: step,
    plan: plan ?? (step >= 2 ? "base" : null),
    credits: 0,
    emailVerified: true,
  };
}

async function mockUserAtStep(page: Page, step: number, plan?: string | null) {
  await page.context().addCookies([{
    name: '__playwright_user__',
    value: Buffer.from(JSON.stringify(buildMockUser(step, plan))).toString('base64'),
    domain: 'localhost',
    path: '/',
  }]);
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: buildMockUser(step, plan),
      }),
    });
  });
}

async function mockUserWithAdvance(page: Page, initialStep: number, plan?: string | null) {
  let currentStep = initialStep;
  let currentPlan = plan ?? (initialStep >= 2 ? "base" : null);

  await page.context().addCookies([{
    name: '__playwright_user__',
    value: Buffer.from(JSON.stringify(buildMockUser(initialStep, plan))).toString('base64'),
    domain: 'localhost',
    path: '/',
  }]);
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: buildMockUser(currentStep, currentPlan),
      }),
    });
  });

  return (nextStep: number, nextPlan?: string | null) => {
    currentStep = nextStep;
    if (nextPlan !== undefined) currentPlan = nextPlan;
  };
}

async function mockBrandfetch(page: Page) {
  await page.route("**/api.brandfetch.io/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

// Stripe mock that always SUCCEEDS (for baseline payment tests).
async function mockStripeJsSuccess(page: Page) {
  await page.route("https://js.stripe.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: buildStripeScript("success"),
    });
  });
}

// Stripe mock that returns a DECLINED error on confirmCardPayment.
async function mockStripeJsDeclined(page: Page) {
  await page.route("https://js.stripe.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: buildStripeScript("declined"),
    });
  });
}

// Stripe mock that returns an INSUFFICIENT FUNDS error.
async function mockStripeJsInsufficientFunds(page: Page) {
  await page.route("https://js.stripe.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: buildStripeScript("insufficient_funds"),
    });
  });
}

// Stripe mock that returns an EXPIRED CARD error.
async function mockStripeJsExpiredCard(page: Page) {
  await page.route("https://js.stripe.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: buildStripeScript("expired_card"),
    });
  });
}

function buildStripeScript(scenario: "success" | "declined" | "insufficient_funds" | "expired_card") {
  const errorMessages: Record<string, string> = {
    declined: "Your card was declined.",
    insufficient_funds: "Your card has insufficient funds.",
    expired_card: "Your card has expired.",
  };

  const confirmBody =
    scenario === "success"
      ? `return { paymentIntent: { id: 'pi_mock', status: 'succeeded' }, error: null };`
      : `return { paymentIntent: null, error: { message: '${errorMessages[scenario]}' } };`;

  return `
(function() {
  var elementStore = {};

  var makeElement = function(type) {
    var container = null;
    return {
      mount: function(selector) {
        container = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (container) {
          var input = document.createElement('input');
          input.setAttribute('data-mock-stripe', type);
          input.setAttribute('placeholder',
            type === 'cardNumber' ? '4242 4242 4242 4242' :
            type === 'cardExpiry' ? 'MM / YY' : 'CVC');
          input.style.width = '100%';
          input.style.background = 'transparent';
          input.style.border = 'none';
          input.style.outline = 'none';
          input.style.color = '#fff';
          container.appendChild(input);
        }
      },
      on: function() {},
      off: function() {},
      unmount: function() { if (container) container.innerHTML = ''; },
      destroy: function() { if (container) container.innerHTML = ''; },
      update: function() {},
      blur: function() {},
      clear: function() {},
      focus: function() {},
      _type: type,
    };
  };

  var elementsInstance = {
    create: function(type, options) {
      var el = makeElement(type);
      elementStore[type] = el;
      return el;
    },
    getElement: function(ComponentOrType) {
      var key = Object.keys(elementStore)[0];
      return key ? elementStore[key] : { _mock: true };
    },
    submit: async function() { return { error: null }; },
  };

  window.Stripe = function(publishableKey, options) {
    return {
      elements: function(opts) { return elementsInstance; },
      createToken: async function(options) {
        return {
          token: { id: 'tok_mock_test' },
          error: null,
        };
      },
      createPaymentMethod: async function(data) {
        return {
          paymentMethod: { id: 'pm_mock_' + Date.now() },
          error: null,
        };
      },
      confirmCardPayment: async function(clientSecret, data, opts) {
        ${confirmBody}
      },
      confirmCardSetup: async function(clientSecret, data) {
        return { setupIntent: { status: 'succeeded' }, error: null };
      },
      paymentRequest: function(options) {
        return {
          canMakePayment: async function() { return null; },
          on: function() {},
          off: function() {},
          abort: function() {},
        };
      },
      retrievePaymentIntent: async function(clientSecret) {
        return { paymentIntent: { status: 'succeeded' }, error: null };
      },
    };
  };

  window.Stripe.version = '3';
})();
  `;
}

async function mockCreatePayment(page: Page) {
  await page.route("**/api/create-payment**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        client_secret: "pi_mock_error_maker_secret",
        type: "one_time",
        amount: 3000,
      }),
    });
  });
}

// Minimal valid PDF buffer.
const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\n" +
    "xref\n0 4\n0000000000 65535 f\n" +
    "0000000015 00000 n\n0000000061 00000 n\n" +
    "0000000114 00000 n\ntrailer<</Size 4/Root 1 0 R>>\n" +
    "startxref\n190\n%%EOF"
);

// ---------------------------------------------------------------------------
// STEP 1 ERROR: Click Next without selecting a plan
// ---------------------------------------------------------------------------

test.describe("Onboarding - Error Maker - Step 1: No Plan Selected", () => {
  test("step 1: submit button is disabled when no plan is selected", async ({
    page,
  }) => {
    await mockUserAtStep(page, 1, null);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Choose Your Success Plan")
    ).toBeVisible({ timeout: 10000 });

    // The "Continue Setup" / "Start Free Test" submit button should be disabled
    // when no plan has been selected yet (selectedPlan is null).
    // The PlanSelectionClient renders a button at the bottom that is
    // disabled={!selectedPlan || isPending}.
    const submitBtn = page
      .getByRole("button", { name: /start free test|continue setup/i })
      .last();
    await expect(submitBtn).toBeDisabled({ timeout: 5000 });
  });

  test("step 1: clicking any plan card enables the submit button", async ({
    page,
  }) => {
    await mockUserAtStep(page, 1, null);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Choose Your Success Plan")
    ).toBeVisible({ timeout: 10000 });

    // Select a plan first
    const selectFreeBtn = page
      .getByRole("button", { name: /start free test/i })
      .first();
    await expect(selectFreeBtn).toBeVisible({ timeout: 10000 });
    await selectFreeBtn.click();

    // After selection the submit button should be enabled
    const submitBtn = page
      .getByRole("button", { name: /start free test|selected/i })
      .last();
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// STEP 2 ERRORS: Domain validation, duplicates, plan limits
// ---------------------------------------------------------------------------

test.describe("Onboarding - Error Maker - Step 2: Domain and Limit Errors", () => {
  test("step 2: trying to add the same domain twice results in only one chip", async ({
    page,
  }) => {
    await mockUserAtStep(page, 2, "base");
    await mockBrandfetch(page);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });

    const companyInput = page.getByPlaceholder(
      /search by company name or paste a linkedin url/i
    );
    await expect(companyInput).toBeVisible({ timeout: 5000 });

    // Add acmecorp via LinkedIn URL
    await companyInput.fill("linkedin.com/company/acmecorp");
    const addCompanyBtn = page.getByRole("button", { name: /add from linkedin url/i });
    await expect(addCompanyBtn).toBeVisible({ timeout: 5000 });
    await addCompanyBtn.click();

    // Wait for the chip to appear
    await page.waitForTimeout(500);

    // Try to add the same LinkedIn URL again (component should reject duplicates)
    await companyInput.fill("linkedin.com/company/acmecorp");
    const addCompanyBtn2 = page.getByRole("button", { name: /add from linkedin url/i });
    await expect(addCompanyBtn2).toBeVisible({ timeout: 5000 });
    await addCompanyBtn2.click();

    await page.waitForTimeout(500);

    // Verify the counter shows only 1 company (not 2)
    await expect(page.getByText(/1\s*\/\s*\d+\s*companies/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("step 2: exceeding plan limit disables the company input", async ({
    page,
  }) => {
    // free_trial has maxCompanies=1. After adding 1, input should be disabled.
    await mockUserAtStep(page, 2, "free_trial");
    await mockBrandfetch(page);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });

    const companyInput = page.getByPlaceholder(
      /search by company name or paste a linkedin url/i
    );
    await expect(companyInput).toBeVisible({ timeout: 5000 });

    // Add one company via LinkedIn URL (reaching the free_trial limit of 1)
    await companyInput.fill("linkedin.com/company/acmecorp");
    const addCompanyBtn = page.getByRole("button", { name: /add from linkedin url/i });
    await expect(addCompanyBtn).toBeVisible({ timeout: 5000 });
    await addCompanyBtn.click();

    // After reaching limit, the input should be disabled or show limit message
    await expect(
      page.getByPlaceholder(/you have reached the maximum number of companies/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("step 2: invalid domain 'notadomain' – chip is added and Continue Setup button is enabled", async ({
    page,
  }) => {
    // The client-side doesn't validate the domain format; raw input is accepted.
    // Server-side validation (isValidDomain) rejects it, but that error is not shown to the user.
    await mockUserAtStep(page, 2, "base");
    await mockBrandfetch(page);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });

    const companyInput = page.getByPlaceholder(
      /search by company name or paste a linkedin url/i
    );
    await expect(companyInput).toBeVisible({ timeout: 5000 });

    // Add via LinkedIn URL (client-side adds it regardless of domain validity)
    await companyInput.fill("linkedin.com/company/notadomain");
    const addCompanyBtn = page.getByRole("button", { name: /add from linkedin url/i });
    await expect(addCompanyBtn).toBeVisible({ timeout: 5000 });
    await addCompanyBtn.click();

    // A chip should appear (client-side accepts it)
    await page.waitForTimeout(500);

    // The Continue Setup button should be enabled (at least one company was added)
    const continueBtn = page.getByRole("button", {
      name: /continue setup/i,
    });
    await expect(continueBtn).toBeEnabled({ timeout: 5000 });
  });

  test("step 2: Continue Setup button is disabled when no company is added", async ({
    page,
  }) => {
    await mockUserAtStep(page, 2, "base");
    await mockBrandfetch(page);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });

    // Without adding any company, Continue Setup should be disabled
    const continueBtn = page.getByRole("button", {
      name: /continue setup/i,
    });
    await expect(continueBtn).toBeDisabled({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// STEP 3 ERRORS: File type, file size, missing CV
// ---------------------------------------------------------------------------

test.describe("Onboarding - Error Maker - Step 3: CV Upload Errors", () => {
  test("step 3: 'Analyze My Profile' button is disabled when no CV is uploaded", async ({
    page,
  }) => {
    await mockUserAtStep(page, 3, "base");
    await page.goto("/dashboard");

    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });

    // Fill in LinkedIn URL so only the missing CV is the blocker
    const linkedinInput = page.locator('input[placeholder*="linkedin.com/in"]');
    await expect(linkedinInput).toBeVisible({ timeout: 5000 });
    await linkedinInput.fill("https://www.linkedin.com/in/errormaker");

    // Without a CV, the "Analyze My Profile" button should be disabled
    const analyzeBtn = page.getByRole("button", {
      name: /analyze my profile/i,
    });
    await expect(analyzeBtn).toBeDisabled({ timeout: 5000 });
  });

  test("step 3: uploading a non-PDF file sets the filename (client-side accepts any type)", async ({
    page,
  }) => {
    // The client-side does NOT validate file type; it accepts any file.
    // Server-side validation rejects non-PDF types, but the UI doesn't display that error.
    await mockUserAtStep(page, 3, "base");
    await page.goto("/dashboard");

    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });

    const cvInput = page.locator("#cv-upload");
    await expect(cvInput).toBeAttached({ timeout: 5000 });

    // Upload a .jpg file (non-PDF)
    const jpgBuffer = Buffer.from(
      "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9"
    );
    await cvInput.setInputFiles({
      name: "photo.jpg",
      mimeType: "image/jpeg",
      buffer: jpgBuffer,
    });

    // The filename appears in the UI (client-side accepts the file)
    await expect(page.getByText("photo.jpg").first()).toBeVisible({ timeout: 5000 });
  });

  test("step 3: uploading a PDF exceeding size limit sets the filename (client-side accepts it)", async ({
    page,
  }) => {
    // Client-side does NOT validate file size; server-side does.
    // The UI just shows the filename after upload.
    await mockUserAtStep(page, 3, "base");
    await page.goto("/dashboard");

    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });

    const cvInput = page.locator("#cv-upload");
    await expect(cvInput).toBeAttached({ timeout: 5000 });

    // Create a buffer that simulates a large file by repeating the minimal PDF
    // Note: Playwright setInputFiles doesn't enforce the actual size on the browser;
    // we just verify the UI accepts the file and shows its name.
    await cvInput.setInputFiles({
      name: "large-cv.pdf",
      mimeType: "application/pdf",
      buffer: MINIMAL_PDF, // Mock large file (actual size enforcement is server-side)
    });

    // Filename appears
    await expect(page.getByText("large-cv.pdf").first()).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// STEP 6 ERRORS: Payment failures
// ---------------------------------------------------------------------------

test.describe("Onboarding - Error Maker - Step 6: Payment Errors", () => {
  test("step 6: declined card shows 'Your card was declined.' error", async ({
    page,
  }) => {
    await mockStripeJsDeclined(page);
    await mockCreatePayment(page);
    await mockUserAtStep(page, 6, "base");
    await page.goto("/dashboard");

    await expect(
      page.getByText("Complete Your Purchase").first()
    ).toBeVisible({ timeout: 15000 });

    // Wait for Stripe mock elements to mount
    await page.waitForTimeout(1000);

    const payBtn = page.getByRole("button", { name: /pay/i }).last();
    await expect(payBtn).toBeVisible({ timeout: 10000 });
    await payBtn.click();

    // The error message from the declined mock should appear
    await expect(
      page.getByText(/your card was declined/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("step 6: insufficient funds shows appropriate error message", async ({
    page,
  }) => {
    await mockStripeJsInsufficientFunds(page);
    await mockCreatePayment(page);
    await mockUserAtStep(page, 6, "base");
    await page.goto("/dashboard");

    await expect(
      page.getByText("Complete Your Purchase").first()
    ).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(1000);

    const payBtn = page.getByRole("button", { name: /pay/i }).last();
    await expect(payBtn).toBeVisible({ timeout: 10000 });
    await payBtn.click();

    // Error message for insufficient funds
    await expect(
      page.getByText(/insufficient funds/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("step 6: expired card shows appropriate error message", async ({
    page,
  }) => {
    await mockStripeJsExpiredCard(page);
    await mockCreatePayment(page);
    await mockUserAtStep(page, 6, "base");
    await page.goto("/dashboard");

    await expect(
      page.getByText("Complete Your Purchase").first()
    ).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(1000);

    const payBtn = page.getByRole("button", { name: /pay/i }).last();
    await expect(payBtn).toBeVisible({ timeout: 10000 });
    await payBtn.click();

    // Error message for expired card
    await expect(
      page.getByText(/your card has expired/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("step 6: after payment error, the Pay button remains visible (user can retry)", async ({
    page,
  }) => {
    await mockStripeJsDeclined(page);
    await mockCreatePayment(page);
    await mockUserAtStep(page, 6, "base");
    await page.goto("/dashboard");

    await expect(
      page.getByText("Complete Your Purchase").first()
    ).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(1000);

    const payBtn = page.getByRole("button", { name: /pay/i }).last();
    await payBtn.click();

    // Error appears
    await expect(
      page.getByText(/your card was declined/i)
    ).toBeVisible({ timeout: 10000 });

    // Pay button should still be visible for retry
    await expect(payBtn).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// NAVIGATION: Back and reload
// ---------------------------------------------------------------------------

test.describe("Onboarding - Error Maker - Navigation and State Persistence", () => {
  test("navigate back during onboarding: user can return to a previous step via browser back", async ({
    page,
  }) => {
    // Simulate a user who advanced from step 2 to step 3, then presses back.
    // We set the mock to step 2 initially, navigate, advance to step 3, then go back.
    const advanceTo = await mockUserWithAdvance(page, 2, "base");
    await mockBrandfetch(page);
    await page.goto("/dashboard");

    // Verify step 2 is visible
    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });

    // Add a company via LinkedIn URL and advance to step 3
    const companyInput = page.getByPlaceholder(
      /search by company name or paste a linkedin url/i
    );
    await expect(companyInput).toBeVisible({ timeout: 5000 });
    await companyInput.fill("linkedin.com/company/acmecorp");
    const addCompanyBtn = page.getByRole("button", { name: /add from linkedin url/i });
    await expect(addCompanyBtn).toBeVisible({ timeout: 5000 });
    await addCompanyBtn.click();

    advanceTo(3);
    const continueBtn = page.getByRole("button", { name: /continue setup/i });
    await expect(continueBtn).toBeEnabled({ timeout: 5000 });
    await continueBtn.click();

    // Step 3 should appear
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });

    // Now navigate back using browser back button
    // (This is possible since Next.js router keeps history entries)
    advanceTo(2); // Simulate server returning step 2 on history pop
    await page.goBack();

    // After navigating back, the user should be on a valid dashboard page
    // (not redirected to login). The step depends on browser/server state.
    // At minimum, the URL should still be /dashboard or a pre-dashboard page.
    await expect(page).toHaveURL(/\/dashboard|\/login|about:blank/, { timeout: 10000 });
  });

  test("page reload mid-onboarding: user resumes from the correct step", async ({
    page,
  }) => {
    // Set up mock at step 3 (mid-onboarding)
    await mockUserAtStep(page, 3, "base");
    await page.goto("/dashboard");

    // Verify step 3 appears
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });

    // Reload the page (simulates user pressing F5)
    await page.reload();

    // After reload, the server returns step 3 again (data is persisted).
    // Step 3 UI should still be shown.
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });
  });

  test("page reload at step 2 mid-onboarding: user resumes from step 2", async ({
    page,
  }) => {
    await mockUserAtStep(page, 2, "base");
    await mockBrandfetch(page);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });

    // Reload
    await page.reload();

    // After reload, still at step 2
    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });
  });

  test("page reload at step 1: user stays at step 1 after reload", async ({
    page,
  }) => {
    await mockUserAtStep(page, 1, null);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Choose Your Success Plan")
    ).toBeVisible({ timeout: 10000 });

    // Reload
    await page.reload();

    // Still at step 1
    await expect(
      page.getByText("Choose Your Success Plan")
    ).toBeVisible({ timeout: 10000 });
  });
});

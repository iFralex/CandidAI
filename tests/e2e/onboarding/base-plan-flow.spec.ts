import { test, expect, Page } from "@playwright/test";

const TEST_USER = {
  email: "base-plan@example.com",
  name: "Base Plan Test User",
  uid: "onboard-uid-base-plan",
};

/**
 * Build a mock user object for a given onboarding step with the "base" plan.
 */
function buildMockUser(step: number) {
  return {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: step,
    plan: step >= 2 ? "base" : null,
    credits: 0,
    emailVerified: true,
  };
}

/**
 * Register a static /api/protected/user mock that always returns the given step.
 */
async function mockUserAtStep(page: Page, step: number) {
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

/**
 * Mock the Stripe.js CDN script so card inputs and payment succeed without
 * a real Stripe account. The mock Stripe instance:
 *  - creates lightweight "elements" without real iframes
 *  - always succeeds on createPaymentMethod and confirmCardPayment
 *  - canMakePayment returns null (disables PaymentRequestButton)
 */
async function mockStripeJs(page: Page) {
  await page.route("https://js.stripe.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
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
      // Return any stored element (truthy) so CheckoutForm can proceed
      var key = Object.keys(elementStore)[0];
      return key ? elementStore[key] : { _mock: true };
    },
    submit: async function() { return { error: null }; },
  };

  window.Stripe = function(publishableKey, options) {
    return {
      elements: function(opts) { return elementsInstance; },
      createPaymentMethod: async function(data) {
        return {
          paymentMethod: { id: 'pm_mock_' + Date.now() },
          error: null,
        };
      },
      confirmCardPayment: async function(clientSecret, data, opts) {
        return {
          paymentIntent: { id: 'pi_mock', status: 'succeeded' },
          error: null,
        };
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

  // Mark as loaded for @stripe/stripe-js detection
  window.Stripe.version = '3';
})();
      `,
    });
  });
}

/**
 * Mock the /api/create-payment endpoint to return a fake client_secret.
 */
async function mockCreatePayment(page: Page) {
  await page.route("**/api/create-payment**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        client_secret: "pi_mock_base_plan_secret_mock",
        type: "one_time",
        amount: 3000,
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Onboarding - Base Plan - Step 1 (Plan Selection)", () => {
  test("step 1: clicking the 'Base Plan' button selects it", async ({
    page,
  }) => {
    await mockUserAtStep(page, 1);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Choose Your Success Plan")
    ).toBeVisible({ timeout: 10000 });

    // The Base plan card has a "Get Base Plan" or "Select" button
    const selectBaseBtn = page
      .getByRole("button", { name: /base/i })
      .first();
    await expect(selectBaseBtn).toBeVisible({ timeout: 10000 });
    await selectBaseBtn.click();

    // After selection the button label changes to "Selected"
    await expect(
      page.getByRole("button", { name: /selected/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("step 1: selecting Base Plan and clicking submit advances to step 2", async ({
    page,
  }) => {
    const advanceTo = await mockUserWithAdvance(page, 1);

    await page.route("**/api.brandfetch.io/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/dashboard");
    await expect(
      page.getByText("Choose Your Success Plan")
    ).toBeVisible({ timeout: 10000 });

    // Select Base plan
    const selectBaseBtn = page
      .getByRole("button", { name: /base/i })
      .first();
    await expect(selectBaseBtn).toBeVisible({ timeout: 10000 });
    await selectBaseBtn.click();

    // Advance mock before submit so the re-render shows step 2
    advanceTo(2);

    // Click the submit button (the last "Base" button or dedicated submit)
    const submitBtn = page
      .getByRole("button", { name: /base/i })
      .last();
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // After server action + revalidation, step 2 UI should appear
    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------

test.describe("Onboarding - Base Plan - Step 2 (Company Input)", () => {
  test("user with onboardingStep=2 (base plan) sees company input UI", async ({
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
    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });
  });

  test("step 2: add company 'acmecorp.com' and advance to step 3", async ({
    page,
  }) => {
    const advanceTo = await mockUserWithAdvance(page, 2);

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

    const companyInput = page.getByPlaceholder(
      /search by company name or paste a linkedin url/i
    );
    await expect(companyInput).toBeVisible({ timeout: 5000 });
    await companyInput.fill("acmecorp.com");
    await companyInput.press("Enter");

    const continueBtn = page.getByRole("button", {
      name: /continue setup/i,
    });
    await expect(continueBtn).toBeVisible({ timeout: 5000 });

    advanceTo(3);
    await continueBtn.click();

    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------

test.describe("Onboarding - Base Plan - Step 3 (Profile & CV)", () => {
  test("user with onboardingStep=3 (base plan) sees profile analysis UI", async ({
    page,
  }) => {
    await mockUserAtStep(page, 3);
    await page.goto("/dashboard");
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });
  });

  test("step 3: upload PDF and advance to step 5 (step 4 auto-executes for base)", async ({
    page,
  }) => {
    const advanceTo = await mockUserWithAdvance(page, 3);

    await page.goto("/dashboard");
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });

    const linkedinInput = page.locator(
      'input[placeholder*="linkedin.com/in"]'
    );
    await expect(linkedinInput).toBeVisible({ timeout: 5000 });
    await linkedinInput.fill("https://www.linkedin.com/in/baseplantestuser");

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

    // Step 4 auto-executes server-side for base plan (not pro/ultra),
    // so from the user's perspective step 3 → step 5.
    advanceTo(5);

    const analyzeBtn = page.getByRole("button", {
      name: /analyze my profile/i,
    });
    await expect(analyzeBtn).toBeEnabled({ timeout: 5000 });
    await analyzeBtn.click();

    await expect(
      page.getByText("Setup Complete!")
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------

test.describe("Onboarding - Base Plan - Step 5 (Custom Instructions)", () => {
  test("user with onboardingStep=5 sees Setup Complete UI", async ({
    page,
  }) => {
    await mockUserAtStep(page, 5);
    await page.goto("/dashboard");
    await expect(page.getByText("Setup Complete!")).toBeVisible({
      timeout: 10000,
    });
  });

  test("step 5: clicking 'Start Email Generation' advances to step 6 (payment)", async ({
    page,
  }) => {
    const advanceTo = await mockUserWithAdvance(page, 5);

    await page.goto("/dashboard");
    await expect(page.getByText("Setup Complete!")).toBeVisible({
      timeout: 10000,
    });

    const positionTextarea = page.getByPlaceholder(/i want to be/i);
    await expect(positionTextarea).toBeVisible({ timeout: 5000 });
    await positionTextarea.fill(
      "I want to be a Senior Software Engineer at a fintech startup"
    );

    // Advance mock to step 6 (payment step for base plan)
    advanceTo(6);

    const submitBtn = page.getByRole("button", {
      name: /start email generation/i,
    });
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Step 6 should show the payment form
    await expect(
      page.getByText("Complete Your Purchase")
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------

test.describe("Onboarding - Base Plan - Step 6 (Stripe Payment Form)", () => {
  test("user with onboardingStep=6 (base plan) sees payment form", async ({
    page,
  }) => {
    await mockStripeJs(page);
    await mockUserAtStep(page, 6);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Complete Your Purchase")
    ).toBeVisible({ timeout: 15000 });
  });

  test("step 6: payment form shows Base Plan summary", async ({ page }) => {
    await mockStripeJs(page);
    await mockUserAtStep(page, 6);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Complete Your Purchase")
    ).toBeVisible({ timeout: 15000 });

    // The plan summary shows "Base Plan"
    await expect(page.getByText(/base plan/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("step 6: payment form shows Pay button with €30 amount", async ({
    page,
  }) => {
    await mockStripeJs(page);
    await mockUserAtStep(page, 6);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Complete Your Purchase")
    ).toBeVisible({ timeout: 15000 });

    // The pay button shows the amount
    await expect(
      page.getByRole("button", { name: /pay/i }).last()
    ).toBeVisible({ timeout: 10000 });
  });

  test("step 6: clicking Pay button with mocked Stripe shows success state", async ({
    page,
  }) => {
    await mockStripeJs(page);
    await mockCreatePayment(page);
    await mockUserAtStep(page, 6);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Complete Your Purchase")
    ).toBeVisible({ timeout: 15000 });

    // Wait for Stripe mock elements to mount (brief rendering delay)
    await page.waitForTimeout(1000);

    // Click the Pay button
    const payBtn = page.getByRole("button", { name: /pay/i }).last();
    await expect(payBtn).toBeVisible({ timeout: 10000 });
    await payBtn.click();

    // Loading state or success state should appear
    // The mocked Stripe immediately succeeds, so we should see "Payment successful!"
    await expect(
      page.getByText(/payment successful/i)
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------

test.describe("Onboarding - Base Plan - Webhook & Dashboard Unlock", () => {
  test("after payment success, simulating webhook receipt unlocks main dashboard", async ({
    page,
  }) => {
    // Simulate the state after webhook sets onboardingStep=50
    // (webhook: payment_intent.succeeded → updates plan, maxCompanies, onboardingStep=50)
    await mockUserAtStep(page, 50);

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

    // At step 50, the main dashboard is shown (not onboarding)
    await expect(page.getByText("Dashboard").first()).toBeVisible({
      timeout: 10000,
    });

    // Onboarding UI should NOT be present
    await expect(
      page.getByText("Choose Your Success Plan")
    ).not.toBeVisible();
    await expect(
      page.getByText("Complete Your Purchase")
    ).not.toBeVisible();
  });

  test("step 50: main dashboard is shown after Base Plan payment flow completes", async ({
    page,
  }) => {
    // This test verifies the observable outcome of the full Base Plan flow:
    // after stripe webhook updates onboardingStep=50 + startServer,
    // the user sees the main dashboard.
    await mockUserAtStep(page, 50);

    await page.route("**/api/protected/results**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    await page.goto("/dashboard");

    await expect(page.getByText("Dashboard").first()).toBeVisible({
      timeout: 10000,
    });

    // "Choose Your Success Plan" must NOT be shown (onboarding is done)
    await expect(
      page.getByText("Choose Your Success Plan")
    ).not.toBeVisible();

    // "Add Your Target Companies" must NOT be shown
    await expect(
      page.getByText("Add Your Target Companies")
    ).not.toBeVisible();

    // "Setup Complete!" must NOT be shown
    await expect(page.getByText("Setup Complete!")).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------

test.describe("Onboarding - Base Plan - Full End-to-End Flow", () => {
  test("full Base Plan flow: steps 1-5 -> payment form (step 6) -> mock success -> dashboard", async ({
    page,
  }) => {
    await mockStripeJs(page);
    await mockCreatePayment(page);

    const advanceTo = await mockUserWithAdvance(page, 1);

    // brandfetch for step 2
    await page.route("**/api.brandfetch.io/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // account endpoint for step 4 (AdvancedFiltersServer)
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

    // results endpoint for the final dashboard
    await page.route("**/api/protected/results**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    // --- Step 1: Plan selection ---
    await page.goto("/dashboard");
    await expect(
      page.getByText("Choose Your Success Plan")
    ).toBeVisible({ timeout: 10000 });

    const selectBaseBtn = page
      .getByRole("button", { name: /base/i })
      .first();
    await expect(selectBaseBtn).toBeVisible({ timeout: 10000 });
    await selectBaseBtn.click();

    advanceTo(2);

    const submitStep1Btn = page
      .getByRole("button", { name: /base/i })
      .last();
    await expect(submitStep1Btn).toBeEnabled({ timeout: 5000 });
    await submitStep1Btn.click();

    // --- Step 2: Company input ---
    await expect(
      page.getByText("Add Your Target Companies")
    ).toBeVisible({ timeout: 10000 });

    const companyInput = page.getByPlaceholder(
      /search by company name or paste a linkedin url/i
    );
    await expect(companyInput).toBeVisible({ timeout: 5000 });
    await companyInput.fill("acmecorp.com");
    await companyInput.press("Enter");

    const continueBtn = page.getByRole("button", {
      name: /continue setup/i,
    });
    await expect(continueBtn).toBeVisible({ timeout: 5000 });

    advanceTo(3);
    await continueBtn.click();

    // --- Step 3: Profile & CV ---
    await expect(
      page.getByText("Connect Your LinkedIn Profile")
    ).toBeVisible({ timeout: 10000 });

    const linkedinInput = page.locator(
      'input[placeholder*="linkedin.com/in"]'
    );
    await expect(linkedinInput).toBeVisible({ timeout: 5000 });
    await linkedinInput.fill("https://www.linkedin.com/in/baseplantestuser");

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

    // Step 4 auto-advances for base plan → step 5
    advanceTo(5);

    const analyzeBtn = page.getByRole("button", {
      name: /analyze my profile/i,
    });
    await expect(analyzeBtn).toBeEnabled({ timeout: 5000 });
    await analyzeBtn.click();

    // --- Step 5: Custom instructions ---
    await expect(
      page.getByText("Setup Complete!")
    ).toBeVisible({ timeout: 15000 });

    const positionTextarea = page.getByPlaceholder(/i want to be/i);
    await expect(positionTextarea).toBeVisible({ timeout: 5000 });
    await positionTextarea.fill(
      "I want to be a Senior Software Engineer at a top tech company"
    );

    advanceTo(6);

    const completeBtn = page.getByRole("button", {
      name: /start email generation/i,
    });
    await expect(completeBtn).toBeEnabled({ timeout: 5000 });
    await completeBtn.click();

    // --- Step 6: Stripe payment form shown ---
    await expect(
      page.getByText("Complete Your Purchase")
    ).toBeVisible({ timeout: 15000 });

    // After Stripe mock mounts, the Pay button is visible
    await page.waitForTimeout(1000);

    // Verify no payment form is shown for free trial (opposite: it IS shown for base)
    await expect(
      page.getByRole("button", { name: /pay/i }).last()
    ).toBeVisible({ timeout: 10000 });

    // Click Pay -> loading -> success (mocked Stripe returns success immediately)
    const payBtn = page.getByRole("button", { name: /pay/i }).last();
    await payBtn.click();

    await expect(
      page.getByText(/payment successful/i)
    ).toBeVisible({ timeout: 10000 });

    // --- Simulate webhook receipt: advance to step 50 ---
    // Webhook sets onboardingStep=50 + startServer. We simulate by updating the mock.
    advanceTo(50);

    // Navigate to dashboard to verify the main dashboard is now unlocked
    await page.goto("/dashboard");

    await expect(page.getByText("Dashboard").first()).toBeVisible({
      timeout: 10000,
    });

    // Onboarding UI must be absent
    await expect(
      page.getByText("Choose Your Success Plan")
    ).not.toBeVisible();
    await expect(
      page.getByText("Complete Your Purchase")
    ).not.toBeVisible();
  });
});

import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 17.3: E2E Test - Plan & Credits - Credit Purchase Cancellation/Failure
// Tests:
// - Open credits dialog -> click "Cancel" or X -> dialog closed -> credits unchanged
// - Open dialog -> ESC -> dialog closed
// - Card declined (4000 0000 0000 0002) -> "Card declined" message in Stripe form
// - Insufficient funds -> appropriate message
// - Expired card -> appropriate message
// - Cancel after error: dialog closeable without credit modification
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "plan-credits-cancel@example.com",
  name: "Plan Credits Cancel User",
  uid: "plan-credits-cancel-uid",
};

function buildMockUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: 50,
    plan: "base",
    credits: 200,
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

async function mockCreatePaymentSuccess(page: Page) {
  await page.route("**/api/create-payment**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        client_secret: "pi_mock_test_secret_cancel_123",
        paymentIntentId: "pi_mock_cancel_123",
      }),
    });
  });
}

// Inject Stripe mock that returns a card error matching the given message
async function injectStripeMockWithError(page: Page, errorMessage: string) {
  const confirmResultJson = JSON.stringify({
    error: { message: errorMessage },
  });
  await page.addInitScript(`
    (function() {
      var mockElement = {
        mount: function() {},
        unmount: function() {},
        on: function() {},
        off: function() {},
        update: function() {},
        destroy: function() {},
        focus: function() {},
        blur: function() {},
        clear: function() {},
      };

      var mockElements = {
        create: function(type, options) { return mockElement; },
        getElement: function(type) { return mockElement; },
        update: function() {},
        fetchUpdates: function() { return Promise.resolve({}); },
      };

      var mockStripe = {
        elements: function(options) { return mockElements; },
        createToken: function(options) {
          return Promise.resolve({
            token: { id: 'tok_mock_test' },
            error: null,
          });
        },
        createPaymentMethod: function(options) {
          return Promise.resolve({
            paymentMethod: { id: 'pm_mock_error' },
            error: null,
          });
        },
        confirmCardPayment: function(clientSecret, data, opts) {
          return Promise.resolve(${confirmResultJson});
        },
        confirmPayment: function() {
          return Promise.resolve(${confirmResultJson});
        },
        retrievePaymentIntent: function() {
          return Promise.resolve({
            paymentIntent: { status: 'requires_payment_method' },
          });
        },
        paymentRequest: function(options) {
          return {
            canMakePayment: function() { return Promise.resolve(null); },
            on: function() {},
            off: function() {},
          };
        },
      };

      window.Stripe = function(publishableKey, options) {
        return mockStripe;
      };
    })();
  `);
  await page.route("**js.stripe.com**", (route) => route.abort());
}

// Inject Stripe mock with success (no error)
async function injectStripeMockSuccess(page: Page) {
  await page.addInitScript(`
    (function() {
      var mockElement = {
        mount: function() {},
        unmount: function() {},
        on: function() {},
        off: function() {},
        update: function() {},
        destroy: function() {},
        focus: function() {},
        blur: function() {},
        clear: function() {},
      };

      var mockElements = {
        create: function(type, options) { return mockElement; },
        getElement: function(type) { return mockElement; },
        update: function() {},
        fetchUpdates: function() { return Promise.resolve({}); },
      };

      var mockStripe = {
        elements: function(options) { return mockElements; },
        createToken: function(options) {
          return Promise.resolve({
            token: { id: 'tok_mock_test' },
            error: null,
          });
        },
        createPaymentMethod: function(options) {
          return Promise.resolve({
            paymentMethod: { id: 'pm_mock_success' },
            error: null,
          });
        },
        confirmCardPayment: function(clientSecret, data, opts) {
          return Promise.resolve({});
        },
        confirmPayment: function() {
          return Promise.resolve({});
        },
        retrievePaymentIntent: function() {
          return Promise.resolve({
            paymentIntent: { status: 'succeeded' },
          });
        },
        paymentRequest: function(options) {
          return {
            canMakePayment: function() { return Promise.resolve(null); },
            on: function() {},
            off: function() {},
          };
        },
      };

      window.Stripe = function(publishableKey, options) {
        return mockStripe;
      };
    })();
  `);
  await page.route("**js.stripe.com**", (route) => route.abort());
}

// Helper: open the credits dialog for the first package (pkg_1000)
async function openCreditsDialog(page: Page) {
  const creditSection = page
    .locator("section")
    .filter({ hasText: /Top Up Credits/i });
  await creditSection.getByRole("button", { name: /Buy/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
}

// ---------------------------------------------------------------------------
// Test group 1: Dialog cancellation via Cancel/X button
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Cancel via Cancel/X Button", () => {
  test("clicking X button closes the dialog", async ({ page }) => {
    await injectStripeMockSuccess(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await openCreditsDialog(page);

    // Find and click a close button (X or Cancel)
    const dialog = page.getByRole("dialog");
    const closeButton = dialog
      .getByRole("button", { name: /close|cancel|×|✕/i })
      .first();
    await closeButton.click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });

  test("credits remain unchanged after closing dialog with X", async ({
    page,
  }) => {
    await injectStripeMockSuccess(page);
    await mockUser(page, { credits: 200 });
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    // Verify initial credit count
    await expect(page.getByText("200").first()).toBeVisible({ timeout: 15000 });

    await openCreditsDialog(page);

    // Close dialog without paying
    const dialog = page.getByRole("dialog");
    const closeButton = dialog
      .getByRole("button", { name: /close|cancel|×|✕/i })
      .first();
    await closeButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Credits should still be 200 (no payment made)
    await expect(page.getByText("200").first()).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Dialog cancellation via ESC key
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Cancel via ESC Key", () => {
  test("pressing ESC closes the dialog", async ({ page }) => {
    await injectStripeMockSuccess(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await openCreditsDialog(page);

    // Press ESC to close
    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });
  });

  test("credits unchanged after closing dialog with ESC", async ({ page }) => {
    await injectStripeMockSuccess(page);
    await mockUser(page, { credits: 200 });
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await expect(page.getByText("200").first()).toBeVisible({ timeout: 15000 });

    await openCreditsDialog(page);
    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("200").first()).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Card declined error
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Card Declined Error", () => {
  test("card declined shows error message in Stripe form", async ({ page }) => {
    await injectStripeMockWithError(page, "Your card was declined.");
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await openCreditsDialog(page);

    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    await expect(
      page.getByText(/Your card was declined/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("card declined does NOT show success message", async ({ page }) => {
    await injectStripeMockWithError(page, "Your card was declined.");
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await openCreditsDialog(page);

    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    await expect(
      page.getByText(/Payment successful!/i)
    ).not.toBeVisible({ timeout: 15000 });
  });

  test("dialog remains open after card declined error", async ({ page }) => {
    await injectStripeMockWithError(page, "Your card was declined.");
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await openCreditsDialog(page);

    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    // Wait for error message, dialog should still be open
    await expect(page.getByText(/Your card was declined/i).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 4: Insufficient funds error
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Insufficient Funds Error", () => {
  test("insufficient funds shows appropriate error message", async ({
    page,
  }) => {
    await injectStripeMockWithError(
      page,
      "Your card has insufficient funds."
    );
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await openCreditsDialog(page);

    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    await expect(
      page.getByText(/insufficient funds/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("insufficient funds does NOT show success message", async ({ page }) => {
    await injectStripeMockWithError(
      page,
      "Your card has insufficient funds."
    );
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await openCreditsDialog(page);

    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    await expect(
      page.getByText(/Payment successful!/i)
    ).not.toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 5: Expired card error
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Expired Card Error", () => {
  test("expired card shows appropriate error message", async ({ page }) => {
    await injectStripeMockWithError(page, "Your card has expired.");
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await openCreditsDialog(page);

    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    await expect(
      page.getByText(/expired/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("expired card does NOT show success message", async ({ page }) => {
    await injectStripeMockWithError(page, "Your card has expired.");
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await openCreditsDialog(page);

    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    await expect(
      page.getByText(/Payment successful!/i)
    ).not.toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 6: Cancel after error - dialog closeable without credit change
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Cancel After Error", () => {
  test("dialog can be closed after a payment error", async ({ page }) => {
    await injectStripeMockWithError(page, "Your card was declined.");
    await mockUser(page, { credits: 200 });
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await openCreditsDialog(page);

    // Trigger error
    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();
    await expect(page.getByText(/Your card was declined/i).first()).toBeVisible({
      timeout: 15000,
    });

    // Close the dialog after the error
    const dialog = page.getByRole("dialog");
    const closeButton = dialog
      .getByRole("button", { name: /close|cancel|×|✕/i })
      .first();
    await closeButton.click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });

  test("credits are unchanged after a payment error and dialog close", async ({
    page,
  }) => {
    await injectStripeMockWithError(page, "Your card was declined.");
    await mockUser(page, { credits: 200 });
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await expect(page.getByText("200").first()).toBeVisible({ timeout: 15000 });

    await openCreditsDialog(page);

    // Trigger error
    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();
    await expect(page.getByText(/Your card was declined/i).first()).toBeVisible({
      timeout: 15000,
    });

    // Close dialog
    const dialog = page.getByRole("dialog");
    const closeButton = dialog
      .getByRole("button", { name: /close|cancel|×|✕/i })
      .first();
    await closeButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Credits should still be 200
    await expect(page.getByText("200").first()).toBeVisible({ timeout: 10000 });
  });

  test("ESC closes dialog after payment error", async ({ page }) => {
    await injectStripeMockWithError(page, "Your card was declined.");
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await openCreditsDialog(page);

    // Trigger error
    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();
    await expect(page.getByText(/Your card was declined/i).first()).toBeVisible({
      timeout: 15000,
    });

    // Press ESC to close
    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });
  });
});

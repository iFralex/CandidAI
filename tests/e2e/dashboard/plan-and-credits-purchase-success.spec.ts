import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 17.2: E2E Test - Plan & Credits - Credit Purchase Success
// Tests:
// - Click "Buy Credits" -> select pkg_1000 -> Stripe form dialog
// - Enter test card 4242... -> pay -> success
// - Sidebar credit badge updated (+1000)
// - Success message shown
// - Select pkg_2500 -> pay -> credits +2500
// - Select pkg_5000 -> pay -> credits +5000
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "plan-credits-purchase@example.com",
  name: "Plan Credits Purchase User",
  uid: "plan-credits-purchase-uid",
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

// Mock the /api/protected/user endpoint
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

// Mock the /api/protected/account endpoint
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

// Mock /api/create-payment to return a mock client_secret (success scenario)
async function mockCreatePaymentSuccess(page: Page) {
  await page.route("**/api/create-payment**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        client_secret: "pi_mock_test_secret_success_123",
        paymentIntentId: "pi_mock_test_123",
      }),
    });
  });
}

// Mock /api/create-payment to return an error (card declined scenario)
async function mockCreatePaymentDeclined(page: Page) {
  await page.route("**/api/create-payment**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Your card was declined.",
      }),
    });
  });
}

// Inject a Stripe mock so the checkout form works without the real Stripe CDN.
// window.Stripe is set before the page loads; loadStripe() from @stripe/stripe-js
// detects it and uses the mock instead of loading from CDN.
async function injectStripeMock(
  page: Page,
  confirmResult: { error?: { message: string } } = {}
) {
  const confirmResultJson = JSON.stringify(confirmResult);
  await page.addInitScript(`
    (function() {
      // Stripe mock element
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

      // Stripe mock elements container
      var mockElements = {
        create: function(type, options) { return mockElement; },
        getElement: function(type) { return mockElement; },
        update: function() {},
        fetchUpdates: function() { return Promise.resolve({}); },
      };

      // Stripe mock instance
      var mockStripe = {
        elements: function(options) { return mockElements; },
        createPaymentMethod: function(options) {
          return Promise.resolve({
            paymentMethod: { id: 'pm_mock_test_4242_123' },
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

      // Override window.Stripe so loadStripe() picks up the mock
      window.Stripe = function(publishableKey, options) {
        return mockStripe;
      };
    })();
  `);

  // Block the real Stripe CDN to prevent overwriting our mock
  await page.route("**js.stripe.com**", (route) => route.abort());
}

// ---------------------------------------------------------------------------
// Test group 1: Credit purchase success - pkg_1000
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Credit Purchase Success - pkg_1000", () => {
  test("clicking Buy on pkg_1000 opens the checkout dialog", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    // Find the credit buy button in the "Top Up Credits" section
    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    const buyButton = creditSection.getByRole("button", { name: /Buy/i }).first();
    await buyButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
  });

  test("checkout dialog shows '1,000 Credits' title for pkg_1000", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    const buyButton = creditSection.getByRole("button", { name: /Buy/i }).first();
    await buyButton.click();

    await expect(
      page.getByRole("dialog").getByText(/1,000/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("checkout dialog shows the Stripe card form with Pay button", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();

    // The UnifiedCheckout renders a pay button with the formatted amount
    await expect(
      page.getByRole("dialog").getByRole("button", { name: /Pay/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("clicking Pay shows 'Payment successful!' after mock Stripe confirms", async ({
    page,
  }) => {
    await injectStripeMock(page); // mock: confirmCardPayment returns {}
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    // Open dialog for pkg_1000
    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });

    // Click the Pay button
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();

    // The CheckoutForm shows "Payment successful!" on success
    await expect(
      page.getByText(/Payment successful!/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("success message shows receipt sent to user email", async ({ page }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });

    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    // Success card shows receipt message with the user's email
    await expect(
      page.getByText(new RegExp(TEST_USER.email, "i"))
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Credit badge updates after successful purchase
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Credit Badge After Purchase", () => {
  test("header shows initial credit count before purchase", async ({ page }) => {
    await injectStripeMock(page);
    await mockUser(page, { credits: 150 });
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    // The header badge shows the current credits (150)
    await expect(page.getByText("150")).toBeVisible({ timeout: 15000 });
  });

  test("header shows updated credits (+1000) after page reload following purchase", async ({
    page,
  }) => {
    let callCount = 0;

    // First call returns 150 credits; subsequent calls return 1150 (after purchase)
    await page.route("**/api/protected/user**", async (route) => {
      callCount++;
      const credits = callCount <= 1 ? 150 : 1150;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: buildMockUser({ credits }),
        }),
      });
    });

    await injectStripeMock(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    // Initial page load — badge shows 150
    await page.goto("/dashboard/plan-and-credits");
    await expect(page.getByText("150")).toBeVisible({ timeout: 15000 });

    // Purchase credits
    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();
    await expect(page.getByText(/Payment successful!/i)).toBeVisible({
      timeout: 15000,
    });

    // Reload the page; second call to user API returns 1150 credits
    await page.reload();
    await expect(page.getByText("1150")).toBeVisible({ timeout: 15000 });
  });

  test("header shows updated credits (+2500) after pkg_2500 purchase and reload", async ({
    page,
  }) => {
    let callCount = 0;

    await page.route("**/api/protected/user**", async (route) => {
      callCount++;
      const credits = callCount <= 1 ? 150 : 2650;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: buildMockUser({ credits }),
        }),
      });
    });

    await injectStripeMock(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await expect(page.getByText("150")).toBeVisible({ timeout: 15000 });

    // Click the second Buy button (pkg_2500)
    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    const buyButtons = creditSection.getByRole("button", { name: /Buy/i });
    await buyButtons.nth(1).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();
    await expect(page.getByText(/Payment successful!/i)).toBeVisible({
      timeout: 15000,
    });

    await page.reload();
    await expect(page.getByText("2650")).toBeVisible({ timeout: 15000 });
  });

  test("header shows updated credits (+5000) after pkg_5000 purchase and reload", async ({
    page,
  }) => {
    let callCount = 0;

    await page.route("**/api/protected/user**", async (route) => {
      callCount++;
      const credits = callCount <= 1 ? 150 : 5150;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: buildMockUser({ credits }),
        }),
      });
    });

    await injectStripeMock(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await expect(page.getByText("150")).toBeVisible({ timeout: 15000 });

    // Click the third Buy button (pkg_5000)
    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    const buyButtons = creditSection.getByRole("button", { name: /Buy/i });
    await buyButtons.nth(2).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();
    await expect(page.getByText(/Payment successful!/i)).toBeVisible({
      timeout: 15000,
    });

    await page.reload();
    await expect(page.getByText("5150")).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Purchase success for each package
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Success Flow for Each Package", () => {
  test("pkg_1000 purchase shows correct credit count (1,000) in dialog", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();

    // Dialog title says "Buy 1,000 Credits"
    await expect(
      page.getByRole("dialog").getByText(/1,000 Credits/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("pkg_2500 purchase shows correct credit count (2,500) in dialog", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).nth(1).click();

    await expect(
      page.getByRole("dialog").getByText(/2,500 Credits/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("pkg_5000 purchase shows correct credit count (5,000) in dialog", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).nth(2).click();

    await expect(
      page.getByRole("dialog").getByText(/5,000 Credits/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("pkg_1000 pay flow: success message visible after payment", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    await expect(page.getByText(/Payment successful!/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test("pkg_2500 pay flow: success message visible after payment", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).nth(1).click();
    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    await expect(page.getByText(/Payment successful!/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test("pkg_5000 pay flow: success message visible after payment", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).nth(2).click();
    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    await expect(page.getByText(/Payment successful!/i)).toBeVisible({
      timeout: 15000,
    });
  });
});

// ---------------------------------------------------------------------------
// Test group 4: API error on create-payment
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Create Payment API Error", () => {
  test("shows error message when /api/create-payment returns error", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentDeclined(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });

    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    // The CheckoutForm renders the error in a red div
    await expect(
      page.getByText(/declined/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("dialog remains open after payment error (user can retry)", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentDeclined(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    // Dialog should still be open (not closed on error)
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 5: Stripe confirmation error
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Stripe Confirmation Error", () => {
  test("shows 'Card declined' when Stripe confirmCardPayment returns error", async ({
    page,
  }) => {
    await injectStripeMock(page, {
      error: { message: "Your card was declined." },
    });
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });

    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    // The CheckoutForm renders confirmError.message in red
    await expect(
      page.getByText(/Your card was declined/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("'Payment successful!' is NOT shown when Stripe returns confirmation error", async ({
    page,
  }) => {
    await injectStripeMock(page, {
      error: { message: "Payment confirmation failed." },
    });
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: /Pay/i }).click();

    await expect(
      page.getByText(/Payment successful!/i)
    ).not.toBeVisible({ timeout: 15000 });
  });
});

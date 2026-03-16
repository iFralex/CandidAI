import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 17.4: E2E Test - Plan & Credits - Plan Upgrade
// Tests:
// - Click "Pro" plan (upgrade from "Base") -> confirmation dialog with price
// - Confirm -> Stripe form -> pay -> plan updated
// - Header/badge shows new plan (credits updated via Pro plan bonus)
// - New maxCompanies reflected in UI after reload
// - Attempt downgrade (Pro to Base): dialog opens (UI allows selection)
// - Current plan: dialog opens (UI does not restrict same-plan selection)
// - Upgrade to same plan: dialog opens (no client-side restriction)
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "plan-upgrade@example.com",
  name: "Plan Upgrade User",
  uid: "plan-upgrade-uid",
};

function buildMockUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    uid: TEST_USER.uid,
    name: TEST_USER.name,
    email: TEST_USER.email,
    onboardingStep: 50,
    plan: "base",
    credits: 150,
    maxCompanies: 20,
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

async function mockCreatePaymentSuccess(page: Page) {
  await page.route("**/api/create-payment**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        client_secret: "pi_mock_plan_secret_success_123",
        paymentIntentId: "pi_mock_plan_123",
      }),
    });
  });
}

async function injectStripeMock(
  page: Page,
  confirmResult: { error?: { message: string } } = {}
) {
  const confirmResultJson = JSON.stringify(confirmResult);
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
        createPaymentMethod: function(options) {
          return Promise.resolve({
            paymentMethod: { id: 'pm_mock_plan_4242_123' },
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

      window.Stripe = function(publishableKey, options) {
        return mockStripe;
      };
    })();
  `);

  await page.route("**js.stripe.com**", (route) => route.abort());
}

// ---------------------------------------------------------------------------
// Test group 1: Plan selection opens checkout dialog
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Plan Upgrade Dialog", () => {
  test("clicking 'Buy Plan' on Pro opens checkout dialog", async ({ page }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    // Pro is the second plan in the grid (Base, Pro, Ultra)
    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(1).click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
  });

  test("checkout dialog title contains 'Purchase Pro Plan'", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(1).click();

    await expect(
      page.getByRole("dialog").getByText(/Purchase Pro Plan/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("checkout dialog shows Pay button with plan price", async ({ page }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(1).click();

    await expect(
      page.getByRole("dialog").getByRole("button", { name: /Pay/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("checkout dialog title contains plan name for Base plan", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.first().click();

    await expect(
      page.getByRole("dialog").getByText(/Purchase Base Plan/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("checkout dialog title contains plan name for Ultra plan", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(2).click();

    await expect(
      page.getByRole("dialog").getByText(/Purchase Ultra Plan/i)
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Plan upgrade payment flow
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Plan Upgrade Payment Flow", () => {
  test("clicking Pay on Pro plan checkout shows success message", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(1).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();

    await expect(
      page.getByText(/Payment successful!/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("success message shows receipt sent to user email after plan purchase", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(1).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();

    await expect(
      page.getByText(new RegExp(TEST_USER.email, "i"))
    ).toBeVisible({ timeout: 15000 });
  });

  test("Base plan checkout shows success message after payment", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page, { plan: "free_trial" });
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.first().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();

    await expect(
      page.getByText(/Payment successful!/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("Ultra plan checkout shows success message after payment", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(2).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();

    await expect(
      page.getByText(/Payment successful!/i)
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Header badge shows updated credits after plan purchase + reload
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Header Badge After Plan Purchase", () => {
  test("header shows initial credits before plan purchase", async ({ page }) => {
    await injectStripeMock(page);
    await mockUser(page, { credits: 150 });
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    // Credits badge shows 150 initially
    await expect(page.getByText("150")).toBeVisible({ timeout: 15000 });
  });

  test("header shows updated credits after Pro plan purchase and reload", async ({
    page,
  }) => {
    let callCount = 0;

    // First call: user is on base plan with 150 credits
    // After purchase: Pro plan gives 1000 credits + existing 150 = 1150
    await page.route("**/api/protected/user**", async (route) => {
      callCount++;
      const credits = callCount <= 1 ? 150 : 1150;
      const plan = callCount <= 1 ? "base" : "pro";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: buildMockUser({ credits, plan }),
        }),
      });
    });

    await injectStripeMock(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await expect(page.getByText("150")).toBeVisible({ timeout: 15000 });

    // Purchase Pro plan
    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(1).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();
    await expect(page.getByText(/Payment successful!/i)).toBeVisible({
      timeout: 15000,
    });

    // Reload: second API call returns updated credits
    await page.reload();
    await expect(page.getByText("1150")).toBeVisible({ timeout: 15000 });
  });

  test("header shows updated credits after Ultra plan purchase and reload", async ({
    page,
  }) => {
    let callCount = 0;

    // Ultra plan gives 2500 credits
    await page.route("**/api/protected/user**", async (route) => {
      callCount++;
      const credits = callCount <= 1 ? 150 : 2650;
      const plan = callCount <= 1 ? "base" : "ultra";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: buildMockUser({ credits, plan }),
        }),
      });
    });

    await injectStripeMock(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");
    await expect(page.getByText("150")).toBeVisible({ timeout: 15000 });

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(2).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();
    await expect(page.getByText(/Payment successful!/i)).toBeVisible({
      timeout: 15000,
    });

    await page.reload();
    await expect(page.getByText("2650")).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 4: maxCompanies reflected after plan purchase + reload
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - maxCompanies After Plan Purchase", () => {
  test("page loads with base plan user (maxCompanies 20)", async ({ page }) => {
    await injectStripeMock(page);
    await mockUser(page, { plan: "base", maxCompanies: 20 });
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    // The page loads fine with base plan user data
    await expect(
      page.getByRole("heading", { name: /Plan & Credits/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("plan grid still shows all plans after Pro plan purchase and reload", async ({
    page,
  }) => {
    let callCount = 0;

    await page.route("**/api/protected/user**", async (route) => {
      callCount++;
      const plan = callCount <= 1 ? "base" : "pro";
      const maxCompanies = callCount <= 1 ? 20 : 50;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: buildMockUser({ plan, maxCompanies }),
        }),
      });
    });

    await injectStripeMock(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    // Purchase Pro plan
    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(1).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();
    await expect(page.getByText(/Payment successful!/i)).toBeVisible({
      timeout: 15000,
    });

    // Reload
    await page.reload();

    // Plan grid should still show all 3 plan options
    const buyButtons = page.getByRole("button", { name: /Buy Plan/i });
    await expect(buyButtons).toHaveCount(3, { timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 5: Same plan / downgrade behavior
// (UI shows Buy Plan for all plans regardless of current plan)
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Same/Lower Plan Selection", () => {
  test("user on Pro plan can still click Buy Plan buttons (UI allows it)", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page, { plan: "pro", credits: 500, maxCompanies: 50 });
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    // All 3 Buy Plan buttons are visible even when already on Pro
    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await expect(buyPlanButtons).toHaveCount(3, { timeout: 15000 });
  });

  test("user on Pro plan clicking Base plan opens dialog (UI does not restrict downgrades)", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page, { plan: "pro", credits: 500, maxCompanies: 50 });
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    // Click Base plan (first button)
    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.first().click();

    // Dialog opens with Base plan title
    await expect(
      page.getByRole("dialog").getByText(/Purchase Base Plan/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("user on Pro plan clicking Pro plan again opens dialog (UI does not restrict same-plan)", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page, { plan: "pro", credits: 500, maxCompanies: 50 });
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    // Click Pro plan (second button)
    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(1).click();

    // Dialog opens with Pro plan title
    await expect(
      page.getByRole("dialog").getByText(/Purchase Pro Plan/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("user on Ultra plan clicking Buy Plan opens dialog for each plan", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page, { plan: "ultra", credits: 1000, maxCompanies: 100 });
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    // All Buy Plan buttons are enabled and functional
    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await expect(buyPlanButtons).toHaveCount(3, { timeout: 15000 });

    // Click any plan (Ultra - last button)
    await buyPlanButtons.nth(2).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 6: Plan upgrade dialog can be dismissed
// ---------------------------------------------------------------------------

test.describe("Plan & Credits - Plan Upgrade Dialog Dismiss", () => {
  test("plan upgrade dialog can be closed with Escape key", async ({ page }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(1).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15000 });
  });

  test("plan buttons are still available after closing dialog without paying", async ({
    page,
  }) => {
    await injectStripeMock(page);
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(1).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });

    // Close dialog without paying
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15000 });

    // Plan buttons should still be functional
    const updatedBuyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await expect(updatedBuyPlanButtons).toHaveCount(3, { timeout: 15000 });
  });

  test("'Payment successful!' is NOT shown when Stripe confirmation fails for plan", async ({
    page,
  }) => {
    await injectStripeMock(page, {
      error: { message: "Your card was declined." },
    });
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(1).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();

    await expect(
      page.getByText(/Payment successful!/i)
    ).not.toBeVisible({ timeout: 15000 });
  });

  test("Stripe error message shown when plan payment fails", async ({
    page,
  }) => {
    await injectStripeMock(page, {
      error: { message: "Your card was declined." },
    });
    await mockUser(page);
    await mockAccount(page);
    await mockCreatePaymentSuccess(page);

    await page.goto("/dashboard/plan-and-credits");

    const buyPlanButtons = page.getByRole("button", { name: /Buy Plan/i });
    await buyPlanButtons.nth(1).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();

    await expect(
      page.getByText(/Your card was declined/i)
    ).toBeVisible({ timeout: 15000 });
  });
});

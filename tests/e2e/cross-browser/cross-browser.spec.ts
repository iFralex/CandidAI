import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Task 24.1: Cross-Browser Tests
// Verifies that critical flows (auth, onboarding, dashboard), forms, dialogs,
// and Stripe Elements work correctly on Chromium, Firefox, and WebKit.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: "cross-browser@example.com",
  password: "password123",
  name: "Cross Browser User",
  uid: "cross-browser-uid-123",
};

const MOCK_ID_TOKEN = "mock-firebase-id-token-cross-browser";

async function setupAuthMocks(page: Page) {
  await page.route("**/api/auth", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          idToken: MOCK_ID_TOKEN,
          uid: TEST_USER.uid,
        }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/login", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        headers: {
          "Set-Cookie": `CandidAIToken=mock-session-token; Path=/; SameSite=Lax`,
        },
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: {
          uid: TEST_USER.uid,
          name: TEST_USER.name,
          email: TEST_USER.email,
          onboardingStep: 50,
          plan: "base",
          credits: 100,
          emailVerified: true,
        },
      }),
    });
  });
}

async function setupDashboardMocks(page: Page) {
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: {
          uid: TEST_USER.uid,
          name: TEST_USER.name,
          email: TEST_USER.email,
          onboardingStep: 50,
          plan: "base",
          credits: 100,
          emailVerified: true,
        },
      }),
    });
  });

  await page.route("**/api/protected/account**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

async function setupOnboardingMocks(page: Page) {
  await page.route("**/api/protected/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: {
          uid: TEST_USER.uid,
          name: TEST_USER.name,
          email: TEST_USER.email,
          onboardingStep: 0,
          plan: "free_trial",
          credits: 0,
          emailVerified: true,
        },
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
            paymentMethod: { id: 'pm_mock_cross_browser_4242' },
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
// Auth - Login form renders on all browsers
// ---------------------------------------------------------------------------

test.describe("Cross-Browser: Auth - Login Form", () => {
  test("login form renders on all browsers", async ({ page, browserName }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: /login to your account/i })
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^login$/i })
    ).toBeVisible();
  });

  test("password field type is password (not plain text) on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/login");

    const passwordInput = page.getByLabel("Password");
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("email and password inputs accept typed values on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);

    await expect(page.getByLabel("Email")).toHaveValue(TEST_USER.email);
    await expect(page.getByLabel("Password")).toHaveValue(TEST_USER.password);
  });

  test("login form submits and redirects to dashboard on all browsers", async ({
    page,
    browserName,
  }) => {
    await setupAuthMocks(page);

    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: /^login$/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("register link navigates to /register on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/login");

    const registerLink = page.getByRole("link", { name: /register/i });
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute("href", /register/);
  });

  test("forgot password link navigates to /forgot-password on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/login");

    const forgotLink = page.getByRole("link", {
      name: /forgot password/i,
    });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute("href", /forgot-password/);
  });
});

// ---------------------------------------------------------------------------
// Auth - Register form on all browsers
// ---------------------------------------------------------------------------

test.describe("Cross-Browser: Auth - Register Form", () => {
  test("register form renders all fields on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/register");

    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /register/i })
    ).toBeVisible();
  });

  test("form fields accept input on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/register");

    await page.getByLabel(/name/i).fill(TEST_USER.name);
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);

    await expect(page.getByLabel(/name/i)).toHaveValue(TEST_USER.name);
    await expect(page.getByLabel(/email/i)).toHaveValue(TEST_USER.email);
    await expect(page.getByLabel(/password/i)).toHaveValue(
      TEST_USER.password
    );
  });
});

// ---------------------------------------------------------------------------
// Auth - Forgot password form on all browsers
// ---------------------------------------------------------------------------

test.describe("Cross-Browser: Auth - Forgot Password Form", () => {
  test("forgot password form renders on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/forgot-password");

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send reset link/i })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Dashboard - Renders sidebar and navigation on all browsers
// ---------------------------------------------------------------------------

test.describe("Cross-Browser: Dashboard - Navigation", () => {
  test("dashboard page loads and shows user name in sidebar on all browsers", async ({
    page,
    browserName,
  }) => {
    await setupDashboardMocks(page);

    await page.goto("/dashboard");

    await expect(page.getByText(TEST_USER.name)).toBeVisible({
      timeout: 15000,
    });
  });

  test("sidebar navigation links are visible on all browsers", async ({
    page,
    browserName,
  }) => {
    await setupDashboardMocks(page);

    await page.goto("/dashboard");

    // Sidebar should be visible
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Dashboard - Dialogs render correctly on all browsers
// ---------------------------------------------------------------------------

test.describe("Cross-Browser: Dashboard - Dialogs", () => {
  test("checkout dialog opens and renders on all browsers", async ({
    page,
    browserName,
  }) => {
    await injectStripeMock(page);
    await setupDashboardMocks(page);
    await page.route("**/api/create-payment**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          client_secret: "pi_mock_cross_browser_secret_123",
          paymentIntentId: "pi_mock_cross_browser_123",
        }),
      });
    });

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    const buyButton = creditSection
      .getByRole("button", { name: /Buy/i })
      .first();
    await buyButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
  });

  test("dialog can be dismissed with close button on all browsers", async ({
    page,
    browserName,
  }) => {
    await injectStripeMock(page);
    await setupDashboardMocks(page);
    await page.route("**/api/create-payment**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          client_secret: "pi_mock_cross_browser_secret_dismiss",
          paymentIntentId: "pi_mock_cross_browser_dismiss",
        }),
      });
    });

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });

    // Close the dialog - try close button, then Escape key as fallback
    const closeButton = page
      .getByRole("dialog")
      .getByRole("button", { name: /close/i });
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
    } else {
      await page.keyboard.press("Escape");
    }

    await expect(page.getByRole("dialog")).not.toBeVisible({
      timeout: 10000,
    });
  });
});

// ---------------------------------------------------------------------------
// Stripe Elements - Works on all browsers
// ---------------------------------------------------------------------------

test.describe("Cross-Browser: Stripe Elements", () => {
  test("Stripe mock intercepts CDN on all browsers", async ({
    page,
    browserName,
  }) => {
    // Track whether the Stripe CDN was blocked
    const stripeRequests: string[] = [];
    page.on("requestfailed", (req) => {
      if (req.url().includes("js.stripe.com")) {
        stripeRequests.push(req.url());
      }
    });

    await injectStripeMock(page);
    await setupDashboardMocks(page);
    await page.route("**/api/create-payment**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          client_secret: "pi_mock_stripe_elements_secret",
          paymentIntentId: "pi_mock_stripe_elements",
        }),
      });
    });

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
    // Stripe mock is active — Pay button should be present
    await expect(
      page.getByRole("dialog").getByRole("button", { name: /Pay/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("Stripe Pay button is functional on all browsers", async ({
    page,
    browserName,
  }) => {
    await injectStripeMock(page);
    await setupDashboardMocks(page);
    await page.route("**/api/create-payment**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          client_secret: "pi_mock_stripe_pay_success",
          paymentIntentId: "pi_mock_stripe_pay",
        }),
      });
    });

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();

    await expect(page.getByText(/Payment successful!/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test("Stripe error message displays correctly on all browsers", async ({
    page,
    browserName,
  }) => {
    await injectStripeMock(page, {
      error: { message: "Your card was declined." },
    });
    await setupDashboardMocks(page);
    await page.route("**/api/create-payment**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          client_secret: "pi_mock_stripe_error_secret",
          paymentIntentId: "pi_mock_stripe_error",
        }),
      });
    });

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();

    await expect(page.getByText(/Your card was declined/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test("Stripe payment success state does not appear on error on all browsers", async ({
    page,
    browserName,
  }) => {
    await injectStripeMock(page, {
      error: { message: "Payment failed." },
    });
    await setupDashboardMocks(page);
    await page.route("**/api/create-payment**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          client_secret: "pi_mock_stripe_no_success_secret",
          paymentIntentId: "pi_mock_stripe_no_success",
        }),
      });
    });

    await page.goto("/dashboard/plan-and-credits");

    const creditSection = page
      .locator("section")
      .filter({ hasText: /Top Up Credits/i });
    await creditSection.getByRole("button", { name: /Buy/i }).first().click();

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Pay/i })
      .click();

    await expect(page.getByText(/Payment successful!/i)).not.toBeVisible({
      timeout: 15000,
    });
  });
});

// ---------------------------------------------------------------------------
// Onboarding - Free trial flow renders on all browsers
// ---------------------------------------------------------------------------

test.describe("Cross-Browser: Onboarding - Free Trial", () => {
  test("onboarding page loads without errors on all browsers", async ({
    page,
    browserName,
  }) => {
    await setupOnboardingMocks(page);

    await page.goto("/onboarding");

    // The page should load - verify it doesn't show a 500 error
    await expect(page).not.toHaveTitle(/500|error/i, { timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Cross-browser: Form validation behaviors
// ---------------------------------------------------------------------------

test.describe("Cross-Browser: Form Validation", () => {
  test("empty email submission shows validation on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/login");

    // Leave email empty and submit
    await page.getByLabel("Password").fill("somepassword");
    await page.getByRole("button", { name: /^login$/i }).click();

    // Either HTML5 native validation or custom error message
    const emailInput = page.getByLabel("Email");
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => {
      return !el.validity.valid;
    });
    expect(isInvalid).toBe(true);
  });

  test("malformed email shows validation error on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("notanemail");
    await page.getByLabel("Password").fill("somepassword");
    await page.getByRole("button", { name: /^login$/i }).click();

    const emailInput = page.getByLabel("Email");
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => {
      return !el.validity.valid;
    });
    expect(isInvalid).toBe(true);
  });

  test("empty password shows validation on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(TEST_USER.email);
    // Leave password empty and submit
    await page.getByRole("button", { name: /^login$/i }).click();

    const passwordInput = page.getByLabel("Password");
    const isInvalid = await passwordInput.evaluate(
      (el: HTMLInputElement) => {
        return !el.validity.valid;
      }
    );
    expect(isInvalid).toBe(true);
  });

  test("forgot-password form validates empty email on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/forgot-password");

    await page.getByRole("button", { name: /send reset link/i }).click();

    const emailInput = page.getByLabel(/email/i);
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => {
      return !el.validity.valid;
    });
    expect(isInvalid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cross-browser: No browser-specific regressions in page rendering
// ---------------------------------------------------------------------------

test.describe("Cross-Browser: Rendering Regressions", () => {
  test("login page has no horizontal overflow on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/login");

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 1280;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // allow 1px tolerance
  });

  test("register page has no horizontal overflow on all browsers", async ({
    page,
    browserName,
  }) => {
    await page.goto("/register");

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 1280;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test("dashboard page has no horizontal overflow on all browsers", async ({
    page,
    browserName,
  }) => {
    await setupDashboardMocks(page);
    await page.goto("/dashboard");

    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 1280;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });
});
